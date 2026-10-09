const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReceipt: parseReceiptRaw, parseText: parseTextRaw, normalizeArtist } = require('../receipt.cjs');
const parseReceipt = (source, options = {}) => parseReceiptRaw(source, { artistName: 'Example Artist', ...options });
const parseText = text => parseTextRaw(text, 'Example Artist');
const text = `Greetings Example Artist,

BandcampFan (buyer@example.test) just paid 11.00 USD for:

Example Album by Example Artist, Digital album $11.00 USD

Order total: $11.00
Your share: $10.38 USD
This sale was completed on October 2, 2026 at 12:26 PM PDT.
Thanks for using Bandcamp!`;
function mail(body, auth = 'dkim=pass header.i=@bandcamp.com', sender = 'noreply@bandcamp.com', contentType = 'text/plain') {
  return `From: Bandcamp <${sender}>\r\nSubject: Woo hoo! Another $11.00, courtesy of the Bandcamp music feed\r\nMessage-ID: <synthetic-receipt@example.test>\r\nAuthentication-Results: mx.google.com; ${auth}\r\nMIME-Version: 1.0\r\nContent-Type: ${contentType}; charset=UTF-8\r\n\r\n${body}`;
}
test('extracts paid amount, public username, and item; never email or payout share', async () => {
  const parsed = await parseReceipt(mail(text));
  assert.deepEqual(parsed, { buyer: 'BandcampFan', title: 'Example Album', amount: 11, currency: 'USD', artist: 'Example Artist', receiptId: '<synthetic-receipt@example.test>' });
  assert.ok(!JSON.stringify(parsed).includes('buyer@example'));
});
test('HTML receipt with linked album', async () => {
  const html = `<p>Greetings Example Artist,</p><p>BandcampFan (<a href="mailto:buyer@example.test">buyer@example.test</a>) just paid 11.00 USD for:</p><p><a href="https://exampleartist.bandcamp.com/album/example-album">Example Album</a> by Example Artist, Digital album $11.00 USD</p><p>This sale was completed on October 2, 2026.</p>`;
  assert.equal((await parseReceipt(mail(html, undefined, undefined, 'text/html'))).title, 'Example Album');
});
test('rejects other artist, payout, and buyer receipts', () => {
  assert.equal(parseText(text.replaceAll('Example Artist', 'Another Artist')), null);
  assert.equal(parseText('Greetings Example Artist,\nYour payout was sent: $11 USD'), null);
  assert.equal(parseText('Thanks for purchasing Example Album by Example Artist'), null);
});
test('rejects spoofed sender and failed / missing Bandcamp authentication', async () => {
  assert.equal(await parseReceipt(mail(text, 'dkim=fail header.i=@bandcamp.com')), null);
  assert.equal(await parseReceipt(mail(text, 'dkim=pass header.i=@evil.test')), null);
  assert.equal(await parseReceipt(mail(text, undefined, 'other@bandcamp.com')), null);
  assert.equal(await parseReceipt(mail(text).replace('mx.google.com;', 'evil.test;')), null);
});
test('handles currency, line wraps and amount commas', () => {
  assert.equal(parseText(text.replace('11.00 USD for', '1,234.56 EUR for')).amount, 1234.56);
  assert.equal(parseText(text.replace('Example Album by', 'Example\nAlbum by')).title, 'Example Album');
});
test('zero-price downloads and refund-like messages do not alert', () => {
  assert.equal(parseText(text.replace('11.00 USD for', '0.00 USD for')), null);
  assert.equal(parseText(text.replace('just paid', 'was refunded')), null);
});
module.exports = { text, mail };
test('artist names are configurable, Unicode-safe, and treated literally', () => {
  for (const artist of ['Étoile & The Satellites', 'A.B [Live] (2026)+', 'ÆTHER', 'Noise!']) {
    assert.equal(parseTextRaw(text.replaceAll('Example Artist', artist), artist).artist, artist);
  }
  assert.equal(normalizeArtist('  Example   Artist  '), 'Example Artist');
  assert.equal(normalizeArtist('Example\nArtist'), '');
  assert.equal(parseTextRaw(text, ''), null);
  assert.equal(parseTextRaw(text.replaceAll('Example Artist', 'Example Artist Extended'), 'Example Artist'), null);
});
test('a label greeting can differ from the artist on the purchased item', () => {
  assert.equal(parseTextRaw(text.replace('Greetings Example Artist,', 'Greetings Example Records,'), 'Example Artist').title, 'Example Album');
});
test('lookalike DKIM domains and upstream forged authentication headers are rejected', async () => {
  assert.equal(await parseReceipt(mail(text, 'dkim=pass header.i=@bandcamp.com.evil.test')), null);
  const source = mail(text, 'dkim=fail header.i=@bandcamp.com').replace('MIME-Version:', 'Authentication-Results: mx.google.com; dkim=pass header.i=@bandcamp.com\r\nMIME-Version:');
  assert.equal(await parseReceipt(source), null);
});
