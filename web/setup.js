const key = new URLSearchParams(location.hash.slice(1)).get('key');
const $ = id => document.getElementById(id);
let connecting = false, loaded = false;
function notice(text, error = false) { $('notice').textContent = text; $('notice').className = error ? 'error' : ''; }
async function request(route, data) {
  const response = await fetch('/api/' + route, { method: data ? 'POST' : 'GET', headers: { 'x-admin-key': key || '', ...(data ? { 'Content-Type': 'application/json' } : {}) }, body: data ? JSON.stringify(data) : undefined });
  const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
}
async function refresh() {
  try {
    const state = await request('status');
    $('status').textContent = state.demo ? 'PREVIEW MODE · NO EMAIL CONNECTION' : state.connection.toUpperCase();
    $('status').className = 'badge ' + state.connection;
    $('detail').textContent = state.message;
    $('stats').textContent = `${state.received} purchases this session · ${state.queued} waiting · ${state.lastCheck ? 'Last check ' + new Date(state.lastCheck).toLocaleTimeString() : 'Waiting for Gmail connection'}`;
    $('artist').readOnly = state.connection === 'connected' || state.connection === 'connecting' || state.connection === 'reconnecting';
    $('url').value = state.overlayUrl; $('preview').href = state.overlayUrl;
    if (!loaded) { $('artist').value = state.artistName; $('email').value = state.email; $('duration').value = state.duration; $('buyer').checked = state.showBuyer; $('amount').checked = state.showAmount; loaded = true; }
  } catch (error) { $('status').textContent = 'HELPER UNAVAILABLE'; $('detail').textContent = error.message || 'Restart the launcher to reconnect.'; }
}
$('connect').addEventListener('submit', async event => {
  event.preventDefault(); if (connecting) return; connecting = true; $('connectButton').disabled = true; $('connectButton').textContent = 'Connecting…';
  try { await request('connect', { artistName: $('artist').value, email: $('email').value, password: $('password').value }); $('password').value = ''; notice('Gmail connected. New purchases for your artist will trigger alerts.'); }
  catch (error) { notice(error.message, true); }
  finally { connecting = false; $('connectButton').disabled = false; $('connectButton').textContent = 'Connect Gmail'; await refresh(); }
});
$('disconnect').onclick = async () => { try { await request('disconnect', {}); $('password').value = ''; $('email').value = ''; notice('Disconnected and saved credential removed.'); await refresh(); } catch (error) { notice(error.message, true); } };
$('settings').onsubmit = async event => { event.preventDefault(); try { await request('settings', { artistName: $('artist').value, duration: Number($('duration').value), showBuyer: $('buyer').checked, showAmount: $('amount').checked }); notice('Preferences saved. They apply to the next alert.'); } catch (error) { notice(error.message, true); } };
$('test').onclick = async () => { try { await request('test', {}); notice('Test alert sent. Check OBS or open the overlay preview.'); } catch (error) { notice(error.message, true); } };
$('copy').onclick = async () => { try { await navigator.clipboard.writeText($('url').value); notice('OBS URL copied.'); } catch { $('url').select(); notice('Select and copy this URL.'); } };
$('stop').onclick = async () => { try { await request('stop', {}); clearInterval(timer); $('status').textContent = 'STOPPED'; notice('Helper stopped. Use the launcher before your next stream.'); } catch (error) { notice(error.message, true); } };
refresh(); const timer = setInterval(refresh, 5000);
