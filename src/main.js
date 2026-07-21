const WINDY_ENDPOINT = 'https://api.windy.com/api/point-forecast/v2';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const fallbackDropzones = [
  { id: 'fallback-1', name: 'Skydive Perris', lat: 33.7617, lon: -117.2184, place: 'Perris, CA' },
  { id: 'fallback-2', name: 'Skydive Spaceland Houston', lat: 29.6028, lon: -95.6106, place: 'Rosharon, TX' },
  { id: 'fallback-3', name: 'Skydive Chicago', lat: 42.1587, lon: -88.4636, place: 'Ottawa, IL' },
  { id: 'fallback-4', name: 'Skydive Dubai Desert Campus', lat: 24.9112, lon: 55.4742, place: 'Dubai, UAE' }
];

const state = {
  apiKey: localStorage.getItem('windy-key') || '',
  selected: fallbackDropzones[0],
  dropzones: fallbackDropzones,
  forecast: null,
  forecastIndex: 0,
  source: 'Demo forecast',
  busy: false,
  limits: JSON.parse(localStorage.getItem('dz-limits') || '{"A":14,"B":18,"C":22,"D":25}')
};

const demo = {
  ts: [0, 3, 6, 9, 12, 15].map(h => Date.now() + h * 3600000),
  units: { 'wind_u-surface': 'm*s-1', 'wind_v-surface': 'm*s-1', 'gust-surface': 'm*s-1', 'past3hprecip-surface': 'mm', 'cbase-surface': 'm', 'visibility-surface': 'm', 'weatherwarnings-surface': null },
  'wind_u-surface': [2.1, 2.8, 3.5, 4.1, 3.2, 2.5],
  'wind_v-surface': [-1.6, -2.2, -2.8, -3.2, -2.6, -1.8],
  'gust-surface': [3.9, 4.8, 6, 7.5, 5.7, 4.2],
  'past3hprecip-surface': [0, 0, 0, 0, 0.2, 0],
  'cbase-surface': [2100, 1900, 1750, 1600, 1100, 1900],
  'visibility-surface': [15000, 15000, 12000, 10000, 8500, 15000],
  'weatherwarnings-surface': [null, null, null, null, null, null]
};

const app = document.querySelector('#app');
const msToMph = value => (Number(value || 0) * 2.23694);
const fmt = n => Number.isFinite(n) ? Math.round(n) : '—';
const windValue = (f, i) => Math.hypot(f['wind_u-surface']?.[i] || 0, f['wind_v-surface']?.[i] || 0);
const isDangerWarning = code => code === 95 || code === 96 || code === 99;

function condition(f, i) {
  const wind = msToMph(windValue(f, i));
  const gust = msToMph(f['gust-surface']?.[i]);
  const precip = f['past3hprecip-surface']?.[i] || 0;
  const cloudBase = f['cbase-surface']?.[i];
  const visibility = f['visibility-surface']?.[i];
  const warning = f['weatherwarnings-surface']?.[i];
  const blocked = isDangerWarning(warning) || precip > 0.2 || (cloudBase && cloudBase < 900) || (visibility && visibility < 4800);
  return { wind, gust, precip, cloudBase, visibility, warning, blocked };
}

function recommendation(c, category) {
  const limit = Number(state.limits[category]);
  if (c.blocked) return { level: 'hold', label: 'Hold', reason: c.warning ? 'Convective weather warning' : c.precip > .2 ? 'Precipitation forecast' : c.cloudBase < 900 ? 'Low cloud base' : 'Reduced visibility' };
  if (c.gust > limit + 6) return { level: 'hold', label: 'Hold', reason: `Gusts ${fmt(c.gust)} mph exceed policy` };
  if (c.wind > limit || c.gust > limit) return { level: 'caution', label: 'Caution', reason: `Wind/gust above ${category} policy` };
  return { level: 'go', label: 'Within policy', reason: `≤ ${limit} mph policy wind/gust` };
}

function render() {
  const f = state.forecast || demo;
  const index = Math.min(state.forecastIndex, f.ts.length - 1);
  const c = condition(f, index);
  const date = new Date(f.ts[index]);
  app.innerHTML = `
    <main>
      <header>
        <div class="brand"><span class="mark">↟</span><div><h1>EXIT WINDOW</h1><p>DROPZONE WEATHER INTELLIGENCE</p></div></div>
        <button class="ghost" id="settings">Weather connection</button>
      </header>
      <section class="hero">
        <div class="hero-copy"><p class="eyebrow">Surface forecast + jump suitability</p><h2>Make the weather<br><em>readable.</em></h2><p>Windy forecast data, dropzone discovery, and a deliberately conservative visual assessment.</p></div>
        <div class="selected-card"><span class="pin">●</span><div><small>Selected dropzone</small><strong>${escapeHtml(state.selected.name)}</strong><span>${state.selected.place || `${state.selected.lat.toFixed(3)}, ${state.selected.lon.toFixed(3)}`}</span></div><button id="findDz">Discover nearby</button></div>
      </section>
      <section class="controls"><label>Dropzone <select id="dropzone">${state.dropzones.map(d => `<option value="${d.id}" ${d.id === state.selected.id ? 'selected' : ''}>${escapeHtml(d.name)}${d.place ? ` — ${escapeHtml(d.place)}` : ''}</option>`).join('')}</select></label><button id="refresh" class="primary">↻ Refresh forecast</button><span class="source">${state.source}</span></section>
      <section class="timeline"><div class="section-title"><span>Forecast window</span><strong>${date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</strong></div><div class="hours">${f.ts.map((ts, i) => { const x = condition(f,i); return `<button data-time="${i}" class="hour ${i === index ? 'active' : ''} ${x.blocked ? 'blocked' : ''}"><small>${new Date(ts).toLocaleDateString([], {weekday:'short'})}</small><b>${new Date(ts).toLocaleTimeString([], {hour:'numeric'})}</b><span>${fmt(msToMph(windValue(f,i)))}<small> mph</small></span></button>`; }).join('')}</div></section>
      <section class="readout"><article class="wind"><p class="eyebrow">Surface wind</p><div class="big">${fmt(c.wind)}<span>mph</span></div><p>Gusts <b>${fmt(c.gust)} mph</b> · direction derived from Windy vector data</p><div class="wind-bars"><i style="height:${Math.min(100,c.wind*3)}%"></i><i style="height:${Math.min(100,c.gust*3)}%"></i></div></article><article><p class="eyebrow">Sky & visibility</p><div class="metric-row"><div><strong>${c.cloudBase ? `${fmt(c.cloudBase * 3.281)} ft` : '—'}</strong><span>cloud base</span></div><div><strong>${c.visibility ? `${fmt(c.visibility / 1609)} mi` : '—'}</strong><span>visibility</span></div><div><strong>${c.precip ? `${c.precip} mm` : 'None'}</strong><span>3h precip.</span></div></div><p class="muted">${c.warning ? `Windy warning code ${c.warning}` : 'No significant weather warning returned'}</p></article></section>
      <section class="assessment"><div class="assessment-head"><div><p class="eyebrow">Jump assessment</p><h3>Who is inside today’s <em>site policy?</em></h3></div><button id="editLimits" class="ghost">Edit policy limits</button></div><div class="licenses">${['A','B','C','D'].map(cat => { const r = recommendation(c,cat); return `<article class="license ${r.level}"><div class="license-top"><span class="badge">${cat}</span><span class="status">${r.label}</span></div><strong>USPA ${cat} license</strong><p>${r.reason}</p><small>Configured limit: ${state.limits[cat]} mph</small></article>`; }).join('')}</div><p class="disclaimer">Planning aid only — not a release to jump. A–D are USPA licence qualifications, not USPA wind-limit categories. Check DZ rules, S&TA/pilot direction, upper winds, aircraft status, NOTAMs and your own experience.</p></section>
      <footer><span>Weather: Windy Point Forecast API</span><span>Dropzones: OpenStreetMap / Overpass</span><a href="https://www.uspa.org/SIM-ONLINE" target="_blank" rel="noreferrer">USPA SIM ↗</a></footer>
    </main>
    <dialog id="config"><form method="dialog"><button class="close" value="cancel">×</button><p class="eyebrow">Configuration</p><h3>Weather connection</h3><p>Use your Windy Point Forecast API key. It is saved only in this browser.</p><label>Windy API key<input id="apiKey" type="password" value="${escapeHtml(state.apiKey)}" placeholder="Paste Point Forecast API key" /></label><button class="primary" id="saveKey" value="default">Save & refresh</button><hr><p class="small">No key? The dashboard displays clearly marked sample data so you can explore the interface.</p></form></dialog>
    <dialog id="policy"><form method="dialog"><button class="close" value="cancel">×</button><p class="eyebrow">Dropzone policy</p><h3>Editable policy limits</h3><p>These are not USPA limits. Confirm the values with the dropzone’s S&TA.</p><div class="limits">${['A','B','C','D'].map(x => `<label>${x} licence<input type="number" min="1" max="60" id="limit-${x}" value="${state.limits[x]}" /> mph</label>`).join('')}</div><button class="primary" id="saveLimits" value="default">Save policy</button></form></dialog>
  `;
  bind();
}

function bind() {
  document.querySelector('#settings').onclick = () => document.querySelector('#config').showModal();
  document.querySelector('#editLimits').onclick = () => document.querySelector('#policy').showModal();
  document.querySelector('#saveKey').onclick = e => { e.preventDefault(); state.apiKey = document.querySelector('#apiKey').value.trim(); localStorage.setItem('windy-key', state.apiKey); document.querySelector('#config').close(); loadForecast(); };
  document.querySelector('#saveLimits').onclick = e => { e.preventDefault(); ['A','B','C','D'].forEach(x => state.limits[x] = Number(document.querySelector(`#limit-${x}`).value)); localStorage.setItem('dz-limits', JSON.stringify(state.limits)); document.querySelector('#policy').close(); render(); };
  document.querySelector('#dropzone').onchange = e => { state.selected = state.dropzones.find(d => d.id === e.target.value); state.forecastIndex = 0; loadForecast(); };
  document.querySelector('#refresh').onclick = loadForecast;
  document.querySelector('#findDz').onclick = discoverDropzones;
  document.querySelectorAll('[data-time]').forEach(el => el.onclick = () => { state.forecastIndex = Number(el.dataset.time); render(); });
}

async function loadForecast() {
  if (!state.apiKey) { state.forecast = demo; state.source = 'Demo forecast — add a Windy Point Forecast key'; render(); return; }
  state.busy = true; state.source = 'Loading Windy forecast…'; render();
  try {
    const response = await fetch(WINDY_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: state.selected.lat, lon: state.selected.lon, model: 'gfs', parameters: ['wind', 'windGust', 'precip', 'cbase', 'visibility', 'weatherWarnings'], levels: ['surface'], key: state.apiKey }) });
    if (!response.ok) throw new Error(`Windy returned ${response.status}`);
    state.forecast = await response.json(); state.forecastIndex = 0; state.source = 'Live Windy Point Forecast · GFS';
  } catch (error) { state.forecast = demo; state.source = `Demo forecast — ${error.message}`; }
  state.busy = false; render();
}

async function discoverDropzones() {
  const button = document.querySelector('#findDz'); button.textContent = 'Searching…'; button.disabled = true;
  const origin = await new Promise(resolve => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => resolve([p.coords.latitude, p.coords.longitude]), () => resolve([state.selected.lat, state.selected.lon]), { timeout: 7000 }) : resolve([state.selected.lat, state.selected.lon]));
  const query = `[out:json][timeout:25];(nwr(around:300000,${origin[0]},${origin[1]})["sport"="skydiving"];nwr(around:300000,${origin[0]},${origin[1]})["name"~"skydive|drop ?zone|parachut",i];);out center tags;`;
  try {
    let data; for (const endpoint of OVERPASS_ENDPOINTS) { try { const res = await fetch(endpoint, { method:'POST', body: query }); if (res.ok) { data = await res.json(); break; } } catch {} }
    const found = (data?.elements || []).map((x, i) => ({ id: `osm-${x.type}-${x.id}`, name: x.tags?.name || 'Unnamed dropzone', lat: x.lat || x.center?.lat, lon: x.lon || x.center?.lon, place: [x.tags?.['addr:city'], x.tags?.['addr:country']].filter(Boolean).join(', ') || 'OpenStreetMap' })).filter(x => x.lat && x.lon);
    if (!found.length) throw new Error('No tagged dropzones found nearby');
    state.dropzones = found; state.selected = found[0]; state.source = `${found.length} nearby dropzones from OpenStreetMap`; loadForecast();
  } catch (err) { state.source = `Dropzone search unavailable — using curated fallback`; render(); }
}

function escapeHtml(v) { return String(v || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
render();
