// Synthetic IMAP transport for integration tests; never used by the launcher.
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const originalLoad = Module._load;
function receipt(artist = 'Example Artist') { return Buffer.from(`From: Bandcamp <noreply@bandcamp.com>\r\nAuthentication-Results: mx.google.com; dkim=pass header.i=@bandcamp.com\r\nMessage-ID: <one-sale@example.test>\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nGreetings ${artist},\n\nBandcampFan (buyer@example.test) just paid 11.00 USD for:\n\nExample Album by ${artist}, Digital album $11.00 USD\n\nThis sale was completed on October 8, 2026.\n`); }
class FakeImap extends EventEmitter {
  constructor() { super(); this.usable = false; this.latest = 100; this.records = new Map(); this.timers = []; }
  async connect() { this.usable = true; }
  async list() { return [{ path: '[Gmail]/All Mail', specialUse: '\\All' }]; }
  async mailboxOpen(path, options) {
    if (!options.readOnly) throw new Error('Mailbox must be read-only');
    this.mailbox = { path, uidNext: 100, uidValidity: 1 };
    // EXISTS intentionally leaves the cached UIDNEXT at 100, as real servers can.
    for (const [delay, uid, data] of [[200, 100, receipt()], [400, 101, receipt()], [600, 102, receipt('Another Artist')]]) {
      this.timers.push(setTimeout(() => { this.records.set(uid, data); this.latest = uid + 1; this.emit('exists'); }, delay));
    }
    return this.mailbox;
  }
  async getMailboxLock(path, options) { if (!options.readOnly) throw new Error('Lock must preserve read-only'); return { release() {} }; }
  async status() { return { uidNext: this.latest, uidValidity: 1 }; }
  async search(query) { const [start, end] = query.uid.split(':').map(Number); return [...this.records.keys()].filter(uid => uid >= start && uid <= end); }
  async fetchAll(uids, query) { return uids.map(uid => ({ uid, ...(query.size ? { size: this.records.get(uid).length } : {}), ...(query.source ? { source: this.records.get(uid) } : {}) })); }
  close() { for (const timer of this.timers) clearTimeout(timer); this.usable = false; this.emit('close'); }
}
Module._load = function(id, ...args) {
  if (id === 'imapflow') return { ImapFlow: FakeImap };
  if (id === 'node:child_process') { const actual = originalLoad.call(this, id, ...args); return { ...actual, execFileSync: () => '' }; }
  return originalLoad.call(this, id, ...args);
};
