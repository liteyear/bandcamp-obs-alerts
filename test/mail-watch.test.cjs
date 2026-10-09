const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
test('new IMAP events advance a stale UID snapshot, deduplicate receipts, and exclude other artists', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bca-mail-test-'));
  const port = 24000 + Math.floor(Math.random() * 5000);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['-r', path.join(__dirname, 'fake-imap.cjs'), path.join(__dirname, '..', 'server.cjs')], { env: { ...process.env, BCA_DEMO: '0', BCA_PORT: String(port), BCA_DATA_DIR: dir }, stdio: 'ignore' });
  t.after(() => { child.kill('SIGTERM'); fs.rmSync(dir, { recursive: true, force: true }); });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 50)); }
  const key = new URLSearchParams(new URL(fs.readFileSync(path.join(dir, 'control-url.txt'), 'utf8')).hash.slice(1)).get('key');
  const headers = { 'x-admin-key': key, 'Content-Type': 'application/json' };
  const connection = await fetch(base + '/api/connect', { method: 'POST', headers, body: JSON.stringify({ artistName: 'Example Artist', email: 'seller@example.test', password: 'abcdefghijklmnop' }) });
  assert.equal(connection.status, 200);
  let state;
  for (let i = 0; i < 100; i++) { state = await (await fetch(base + '/api/status', { headers })).json(); if (state.ignored === 1) break; await new Promise(r => setTimeout(r, 50)); }
  assert.equal(state.connection, 'connected');
  assert.equal(state.received, 1);
  assert.equal(state.ignored, 1);
  assert.equal(state.queued, 0);
  const saved = fs.readFileSync(path.join(dir, 'settings.json'), 'utf8');
  assert.ok(!saved.includes('abcdefghijklmnop'));
  assert.ok(!saved.includes('buyer@example'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'seen.json'), 'utf8')).length, 1);
  await fetch(base + '/api/stop', { method: 'POST', headers, body: '{}' });
  await new Promise(resolve => child.once('exit', resolve));
});
