const key = new URLSearchParams(location.hash.slice(1)).get('key');
const card = document.getElementById('alert');
let lastId = null, timer;
function hide() { card.classList.remove('visible'); }
function show(event) {
  if (!event || event.endsAt <= Date.now()) { hide(); return; }
  if (event.id === lastId) return;
  lastId = event.id; clearTimeout(timer);
  document.getElementById('buyerName').textContent = event.showBuyer ? event.buyer : 'Someone';
  document.getElementById('artistName').textContent = event.artist;
  document.getElementById('title').textContent = event.title;
  document.getElementById('testTag').hidden = !event.test;
  let amount = '';
  if (event.showAmount) { try { amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: event.currency }).format(event.amount); } catch { amount = `${event.currency} ${event.amount.toFixed(2)}`; } }
  document.getElementById('amountText').textContent = amount;
  card.classList.remove('visible'); requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('visible')));
  timer = setTimeout(hide, Math.max(0, event.endsAt - Date.now()));
}
if (key) { const events = new EventSource('/events?key=' + encodeURIComponent(key)); events.onmessage = e => { try { show(JSON.parse(e.data)); } catch {} }; }
