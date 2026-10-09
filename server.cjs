const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { ImapFlow } = require('imapflow');
const { normalizeArtist, parseReceipt } = require('./receipt.cjs');

const PORT = Number(process.env.BCA_PORT || 17864);
const DATA = process.env.BCA_DATA_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'Bandcamp OBS Alerts');
fs.mkdirSync(DATA, { recursive: true, mode: 0o700 });
const configFile = path.join(DATA, 'settings.json');
function read(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function write(file, data) { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 }); fs.renameSync(tmp, file); }
const config = read(configFile, {});
config.viewerKey ||= crypto.randomBytes(24).toString('hex');
config.artistName = normalizeArtist(config.artistName || '');
config.duration ||= 9;
config.showAmount ??= true;
config.showBuyer ??= true;
write(configFile, config);
const adminKey = crypto.randomBytes(24).toString('hex');
const origin = `http://127.0.0.1:${PORT}`;
const adminUrl = `${origin}/#key=${adminKey}`;

const state = { connection: 'disconnected', message: 'Connect Gmail to start receiving new purchases for your artist.', received: 0, ignored: 0, lastCheck: null };
const clients = new Set();
let queue = [], active = null, alertTimer, client = null, generation = 0, scanningGeneration = null, rescan = false, pollTimer, retryTimer, memoryPassword = null, stopped = false;
let cursor = 0, uidValidity = '', seen = new Set(read(path.join(DATA, 'seen.json'), []));
function saveSeen() { write(path.join(DATA, 'seen.json'), [...seen].slice(-2000)); }
function packet() { return active ? { ...active, buyer: config.showBuyer ? active.buyer : 'Someone', showAmount: config.showAmount, showBuyer: config.showBuyer } : null; }
function publish() { const message = `data: ${JSON.stringify(packet())}\n\n`; for (const response of clients) response.write(message); }
function nextAlert() {
  clearTimeout(alertTimer);
  const event = queue.shift();
  active = event ? { ...event, id: crypto.randomUUID(), startedAt: Date.now(), endsAt: Date.now() + config.duration * 1000 } : null;
  publish();
  if (active) alertTimer = setTimeout(nextAlert, config.duration * 1000 + 700);
}
function enqueue(event) { if (queue.length >= 100) return false; queue.push(event); if (!active) nextAlert(); return true; }
function keychainGet(email) {
  if (process.env.BCA_DEMO === '1') return null;
  try { return execFileSync('/usr/bin/security', ['find-generic-password', '-a', email, '-s', 'com.bandcampobsalerts.local', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}
function keychainSet(email, password) {
  // Never write the app password to settings, receipts, or a log file.
  execFileSync('/usr/bin/security', ['add-generic-password', '-U', '-a', email, '-s', 'com.bandcampobsalerts.local', '-w', password], { stdio: 'ignore' });
}
function keychainDelete(email) { try { execFileSync('/usr/bin/security', ['delete-generic-password', '-a', email, '-s', 'com.bandcampobsalerts.local'], { stdio: 'ignore' }); } catch {} }

function scheduleReconnect(g) {
  if (stopped || g !== generation) return;
  clearTimeout(retryTimer);
  state.connection = 'reconnecting'; state.message = 'Gmail connection interrupted. Retrying automatically in 15 seconds.';
  retryTimer = setTimeout(() => connect(config.email, memoryPassword || keychainGet(config.email), false).catch(() => {}), 15000);
}
async function scan(g) {
  if (g !== generation || !client || !client.usable) return;
  if (scanningGeneration === g) { rescan = true; return; }
  scanningGeneration = g;
  const current = client;
  try {
    do {
      rescan = false;
      const lock = await current.getMailboxLock(current.mailbox.path, { readOnly: true });
      try {
        if (g !== generation) return;
        // EXISTS carries a message count, not UIDNEXT. Refresh the UID boundary
        // explicitly so a new email is never missed because of a stale mailbox snapshot.
        const snapshot = await current.status(current.mailbox.path, { uidNext: true, uidValidity: true });
        if (!snapshot || !snapshot.uidNext || !snapshot.uidValidity) throw new Error('Mailbox status unavailable');
        if (String(snapshot.uidValidity) !== uidValidity) {
          uidValidity = String(snapshot.uidValidity); cursor = snapshot.uidNext - 1;
          state.message = 'Mailbox refreshed. Watching new purchases.';
        }
        const through = snapshot.uidNext - 1;
        if (through > cursor) {
          const uids = await current.search({ uid: `${cursor + 1}:${through}`, from: 'noreply@bandcamp.com' }, { uid: true });
          for (let offset = 0; offset < uids.length; offset += 25) {
            const sizes = await current.fetchAll(uids.slice(offset, offset + 25), { size: true }, { uid: true });
            const allowed = sizes.filter(record => record.size <= 2 * 1024 * 1024).map(record => record.uid);
            state.ignored += sizes.length - allowed.length;
            if (!allowed.length) continue;
            const records = await current.fetchAll(allowed, { source: true }, { uid: true });
            for (const record of records) {
              if (g !== generation) return;
              const event = await parseReceipt(record.source, { artistName: config.artistName });
              if (!event) { state.ignored++; continue; }
              const rawId = event.receiptId || crypto.createHash('sha256').update(record.source).digest('hex');
              const id = crypto.createHash('sha256').update(config.email + ':' + config.artistName + ':' + rawId).digest('hex');
              if (seen.has(id)) continue;
              const { receiptId, ...displayEvent } = event;
              if (!enqueue(displayEvent)) throw new Error('Alert queue is full');
              seen.add(id); if (seen.size > 2000) seen.delete(seen.values().next().value); saveSeen(); state.received++;
            }
          }
          cursor = through;
        }
        state.lastCheck = new Date().toISOString();
      } finally { lock.release(); }
    } while (rescan && g === generation);
  } catch {
    if (g === generation) { current.close(); scheduleReconnect(g); }
  } finally { if (scanningGeneration === g) scanningGeneration = null; }
}
async function disconnect() {
  generation++; clearTimeout(retryTimer); clearInterval(pollTimer);
  if (client) { const old = client; client = null; old.close(); }
}
async function connect(email, password, fresh = true) {
  if (!config.artistName) { state.connection = 'disconnected'; state.message = 'Set your artist name before connecting Gmail.'; throw new Error(state.message); }
  if (!password) { state.connection = 'disconnected'; state.message = 'Enter a Gmail app password in the setup window.'; throw new Error(state.message); }
  await disconnect();
  const g = generation;
  state.connection = 'connecting'; state.message = 'Connecting securely to Gmail…';
  const current = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: email, pass: password }, logger: false, connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 120000, maxIdleTime: 60000 });
  client = current;
  current.on('error', () => {});
  current.on('close', () => { if (g === generation) scheduleReconnect(g); });
  try {
    await current.connect();
    const boxes = await current.list();
    const allMail = boxes.find(b => b.specialUse === '\\All');
    const box = await current.mailboxOpen(allMail?.path || 'INBOX', { readOnly: true });
    if (g !== generation) { current.close(); throw new Error('Connection replaced'); }
    if (fresh || String(box.uidValidity) !== uidValidity) cursor = box.uidNext - 1;
    uidValidity = String(box.uidValidity);
    memoryPassword = password;
    state.connection = 'connected'; state.message = `Listening for new ${config.artistName} sales. Existing emails are skipped.`;
    current.on('exists', () => scan(g));
    pollTimer = setInterval(() => scan(g), 60000);
    await scan(g);
  } catch {
    if (g === generation) {
      await disconnect();
      state.connection = 'disconnected'; state.message = 'Could not connect to Gmail. Check the email and 16-character app password, plus the internet connection.';
      if (!fresh) scheduleReconnect(generation);
    }
    throw new Error(state.message);
  }
}
function auth(req, key, type) { return req.headers[`x-${type}-key`] === key; }
function json(res, status, object) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(object)); }
async function body(req) {
  if (req.headers['content-type'] !== 'application/json') throw new Error('Expected JSON');
  let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 8192) throw new Error('Request too large'); }
  return JSON.parse(data || '{}');
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
  if (req.headers.host !== `127.0.0.1:${PORT}`) return json(res, 403, { error: 'Local access only' });
  if (req.headers.origin && req.headers.origin !== origin) return json(res, 403, { error: 'Invalid origin' });
  const url = new URL(req.url, origin);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { app: 'bandcamp-obs-alerts', version: '1.0.1' });
    if (req.method === 'GET' && url.pathname === '/events') {
      if (url.searchParams.get('key') !== config.viewerKey) return json(res, 403, { error: 'Invalid overlay key' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive' });
      clients.add(res); res.write(`data: ${JSON.stringify(packet())}\n\n`);
      const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 25000);
      req.on('close', () => { clearInterval(heartbeat); clients.delete(res); }); return;
    }
    if (url.pathname.startsWith('/api/')) {
      if (!auth(req, adminKey, 'admin')) return json(res, 403, { error: 'Open the control window using the launcher.' });
      if (req.method === 'GET' && url.pathname === '/api/status') return json(res, 200, { ...state, artistName: config.artistName, email: config.email || '', duration: config.duration, showAmount: config.showAmount, showBuyer: config.showBuyer, overlayUrl: `${origin}/overlay#key=${config.viewerKey}`, queued: queue.length, demo: process.env.BCA_DEMO === '1' });
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      const input = await body(req);
      if (url.pathname === '/api/connect') {
        if (process.env.BCA_DEMO === '1') return json(res, 400, { error: 'Demo mode does not connect to Gmail.' });
        const email = String(input.email || '').trim();
        const password = String(input.password || '').replace(/\s/g, '');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^[a-zA-Z0-9]{16}$/.test(password)) return json(res, 400, { error: 'Enter a valid Gmail address and its 16-character app password.' });
        const artistName = normalizeArtist(input.artistName);
        if (!artistName) return json(res, 400, { error: 'Enter the artist name exactly as it appears after “by” in a Bandcamp sale receipt (1–80 characters).' });
        config.artistName = artistName;
        await connect(email, password, true);
        try { keychainSet(email, password); }
        catch { await disconnect(); memoryPassword = null; state.connection = 'disconnected'; state.message = 'Gmail worked, but macOS Keychain could not save the app password. Allow Keychain access and try again.'; return json(res, 400, { error: state.message }); }
        if (config.email && config.email !== email) keychainDelete(config.email);
        config.email = email; write(configFile, config);
      } else if (url.pathname === '/api/disconnect') {
        await disconnect(); if (config.email) keychainDelete(config.email); memoryPassword = null; delete config.email; write(configFile, config);
        queue = []; active = null; clearTimeout(alertTimer); publish();
        state.connection = 'disconnected'; state.message = 'Gmail disconnected and its saved app password removed.';
      } else if (url.pathname === '/api/settings') {
        const artistName = normalizeArtist(input.artistName ?? config.artistName);
        if (!artistName) return json(res, 400, { error: 'Enter an artist name (1–80 characters).' });
        if (client && artistName !== config.artistName) return json(res, 409, { error: 'Disconnect Gmail before changing the artist name.' });
        config.artistName = artistName;
        config.duration = Math.max(5, Math.min(20, Number(input.duration) || 9));
        config.showAmount = !!input.showAmount; config.showBuyer = !!input.showBuyer; write(configFile, config);
      } else if (url.pathname === '/api/test') {
        if (!enqueue({ buyer: 'BandcampFan', artist: config.artistName || 'YOUR ARTIST NAME', title: 'Example Album', amount: 11, currency: 'USD', test: true })) return json(res, 429, { error: 'Alert queue is full.' });
      } else if (url.pathname === '/api/stop') {
        json(res, 200, { ok: true }); setTimeout(shutdown, 100); return;
      } else return json(res, 404, { error: 'Not found' });
      return json(res, 200, { ok: true });
    }
    const routes = { '/': 'setup.html', '/overlay': 'overlay.html', '/setup.js': 'setup.js', '/overlay.js': 'overlay.js', '/style.css': 'style.css' };
    const file = routes[url.pathname];
    if (!file || req.method !== 'GET') return json(res, 404, { error: 'Not found' });
    const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8';
    res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(path.join(__dirname, 'web', file)).pipe(res);
  } catch (error) { json(res, 400, { error: error.message === state.message ? state.message : 'Could not complete this action. Check the connection and try again.' }); }
});
async function shutdown() { stopped = true; await disconnect(); clearTimeout(alertTimer); for (const response of clients) response.end(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
server.on('error', err => { console.error(err.code === 'EADDRINUSE' ? 'The alert helper is already running, or its port is in use.' : 'Could not start the local alert helper.'); process.exit(1); });
server.listen(PORT, '127.0.0.1', () => {
  fs.writeFileSync(path.join(DATA, 'control-url.txt'), adminUrl, { mode: 0o600 });
  console.log('Bandcamp OBS Alerts is ready.');
  if (config.email && config.artistName && process.env.BCA_DEMO !== '1') connect(config.email, keychainGet(config.email), true).catch(() => {});
});
