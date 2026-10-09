const { simpleParser } = require('mailparser');
function normalizeArtist(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) return '';
  const name = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  return name.length > 0 && name.length <= 80 ? name : '';
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function parseText(text, artistName) {
  const artist = normalizeArtist(artistName);
  if (!artist) return null;
  text = text.normalize('NFC').replace(/\r/g, '').replace(/\u00a0/g, ' ');
  // Label / account greetings can differ; match the artist on the purchased item.
  if (!/Greetings\s+[^,\n]+\s*,/iu.test(text)) return null;
  const sale = text.match(/(?:^|\n)\s*([^\n]+?)\s*\(([^\n]*@[^\n]*)\)\s+just paid\s+([\d,.]+)\s+([A-Z]{3})\s+for\s*:/i);
  if (!sale || !/This sale was completed\s+on/i.test(text)) return null;
  const after = text.slice(sale.index + sale[0].length).replace(/(?:<https?:\/\/[^>]+>|\[https?:\/\/[^\]]+\])/g, '').trim();
  const artistPattern = escapeRegex(artist).replace(/ /g, '\\s+');
  const item = after.match(new RegExp(`^([\\s\\S]{1,600}?)\\s+by\\s+${artistPattern}(?=\\s*(?:,|\\n|$))`, 'iu'));
  if (!item) return null;
  const amount = Number(sale[3].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const buyer = sale[1].replace(/<[^>]*>/g, '').trim();
  const title = item[1].replace(/\s+/g, ' ').trim();
  return { buyer: !buyer || buyer.includes('@') ? 'Someone' : buyer.slice(0, 80), title: title.slice(0, 180), amount, currency: sale[4].toUpperCase(), artist };
}
async function parseReceipt(source, { artistName } = {}) {
  const mail = await simpleParser(source, { skipHtmlToText: false, skipTextToHtml: true, skipImageLinks: true });
  const senders = mail.from?.value || [];
  if (senders.length !== 1 || senders[0].address?.toLowerCase() !== 'noreply@bandcamp.com') return null;
  const auth = mail.headerLines.filter(h => h.key === 'authentication-results').map(h => h.line.replace(/\r?\n\s+/g, ' '));
  const gmailAuth = auth.find(h => /^Authentication-Results:\s*mx\.google\.com\s*;/i.test(h));
  if (!gmailAuth || !/dkim=pass\b[^;]*(?:header\.i=@bandcamp\.com|header\.d=bandcamp\.com)(?=[\s;]|$)/i.test(gmailAuth)) return null;
  const event = parseText(mail.text || '', artistName);
  return event ? { ...event, receiptId: mail.messageId || null } : null;
}
module.exports = { normalizeArtist, parseText, parseReceipt };
