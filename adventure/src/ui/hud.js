// HUD — DOM overlay inside #ui. Hearts, bosom-shard counter, context action ring,
// minimap/compass, area title cards, title screen and pause menu.
// Exposes ctx.hud and ctx.ui (see bottom of init()).
import './hud.css';
import { LANDMARKS, heightAt as layoutHeightAt, normalAt as layoutNormalAt, WATER_LEVEL } from '../world/layout.js';
import { buildMinimapImage } from './minimap.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const HEART_PATH = 'M13 22.6C9.2 19.3 1.4 14.3 1.4 7.9 1.4 4.1 4.2 1.4 7.5 1.4c2.4 0 4.3 1.3 5.5 3.4 1.2-2.1 3.1-3.4 5.5-3.4 3.3 0 6.1 2.7 6.1 6.5 0 6.4-7.8 11.4-11.6 14.7z';
// quarter order (clockwise from bottom-left): BL, TL, TR, BR
const QUADS = [[0, 12, 13, 13], [0, 0, 13, 12], [13, 0, 13, 12], [13, 12, 13, 13]];

export const REGIONS = [
  { id: 'shrine', name: 'The Old Shrine', sub: 'Ruins upon the hill', x: LANDMARKS.shrine.x, z: LANDMARKS.shrine.z, r: LANDMARKS.shrine.r + 22 },
  { id: 'village', name: "Brennan's Hollow", sub: 'A farming village', x: LANDMARKS.village.x, z: LANDMARKS.village.z, r: LANDMARKS.village.r + 4 },
  { id: 'lake', name: 'Mirrorlake', sub: 'Still waters', x: LANDMARKS.lake.x, z: LANDMARKS.lake.z, r: LANDMARKS.lake.r + 16 },
  { id: 'forest', name: 'Whisperwood', sub: 'The old forest', x: LANDMARKS.forest.x, z: LANDMARKS.forest.z, r: LANDMARKS.forest.r },
  { id: 'meadow', name: "Koto's Meadow", sub: 'Province of Bosom', x: LANDMARKS.spawn.x, z: LANDMARKS.spawn.z, r: 42 },
];
const WILDS = { id: 'wilds', name: 'Bosom Wilds', sub: '' };
export function regionAt(x, z) {
  for (const r of REGIONS) if (Math.hypot(x - r.x, z - r.z) < r.r) return r;
  return WILDS;
}

function el(tag, attrs = {}, parent, html) {
  const e = document.createElement(tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
const store = {
  get(k, d) { try { const v = localStorage.getItem('koto.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('koto.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

const ICONS = {
  sword: `<svg viewBox="-12 -12 24 24"><g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-8.5 8.5 L6.2 -6.2 L8.6 -8.6 L7.6 -4.6 L-7 10" fill="#f4ecd8" stroke="#2a2218" stroke-width=".8"/>
    <path d="M-7.2 4.2 L-4.2 7.2" stroke="#e9d7a6" stroke-width="2.4"/><path d="M-9.4 9.4 L-6.6 6.6" stroke="#8a6a3c" stroke-width="2.2"/>
    <circle cx="-10" cy="10" r="1.2" fill="#e9d7a6"/></g></svg>`,
  roll: `<svg viewBox="-12 -12 24 24"><g fill="none" stroke="#f4ecd8" stroke-width="1.7" stroke-linecap="round">
    <path d="M7.5 -3.5 A8 8 0 1 0 6 5.6"/><path d="M3.2 -1.8 A4 4 0 1 0 2.6 2.8" opacity=".7"/>
    <path d="M8.6 -7.4 L7.6 -3.2 L3.6 -4.4" stroke-linejoin="round"/></g></svg>`,
  talk: `<svg viewBox="-12 -12 24 24"><path d="M-8.5 -6.5 h17 a2 2 0 0 1 2 2 v8 a2 2 0 0 1 -2 2 h-9 l-5 4.5 v-4.5 h-3 a2 2 0 0 1 -2 -2 v-8 a2 2 0 0 1 2 -2z" fill="none" stroke="#f4ecd8" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="-4" cy="-.5" r="1.2" fill="#e9d7a6"/><circle cx="0" cy="-.5" r="1.2" fill="#e9d7a6"/><circle cx="4" cy="-.5" r="1.2" fill="#e9d7a6"/></svg>`,
  focus: `<svg viewBox="-12 -12 24 24"><g fill="none" stroke="#f4ecd8" stroke-width="1.6" stroke-linecap="round">
    <path d="M-9 -4 V-9 H-4 M4 -9 H9 V-4 M9 4 V9 H4 M-4 9 H-9 V4"/></g><path d="M0 -3.4 L3.4 0 L0 3.4 L-3.4 0Z" fill="#e9d7a6"/></svg>`,
  look: `<svg viewBox="-12 -12 24 24"><path d="M-10 0 Q0 -9 10 0 Q0 9 -10 0Z" fill="none" stroke="#f4ecd8" stroke-width="1.5"/><circle r="3" fill="#e9d7a6"/></svg>`,
};
const RULE_SVG = (w) => `<svg class="k-rule" viewBox="${-w / 2} -9 ${w} 18" preserveAspectRatio="xMidYMid meet">
  <path class="k-line" d="M-14 0 H${-w / 2 + 6}" stroke="#e9d7a6" stroke-width="1" stroke-dasharray="240" stroke-dashoffset="0" opacity=".85"/>
  <path class="k-line" d="M14 0 H${w / 2 - 6}" stroke="#e9d7a6" stroke-width="1" stroke-dasharray="240" stroke-dashoffset="0" opacity=".85"/>
  <path d="M0 -6 L6 0 L0 6 L-6 0Z" fill="none" stroke="#e9d7a6" stroke-width="1"/><path d="M0 -2.6 L2.6 0 L0 2.6 L-2.6 0Z" fill="#e9d7a6"/>
  <circle cx="-11" cy="0" r="1.3" fill="#e9d7a6"/><circle cx="11" cy="0" r="1.3" fill="#e9d7a6"/></svg>`;
const SHARD_SVG = `<svg viewBox="-9 -12 18 24"><defs><linearGradient id="k-shard-g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#e8fff8"/><stop offset=".45" stop-color="#7fd9c8"/><stop offset="1" stop-color="#b5579a"/></linearGradient></defs>
  <path d="M0 -11 L7 -3 L3.5 10.5 L-3.5 10.5 L-7 -3Z" fill="url(#k-shard-g)" stroke="#f6eedb" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M0 -11 L-2 -2 L0 10.5 M-7 -3 L-2 -2 L7 -3" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".6"/></svg>`;

export async function init(ctx) {
  const root = document.getElementById('ui') || el('div', { id: 'ui' }, document.body);
  const shotMode = !!ctx.params?.get?.('shot');
  const skipTitle = shotMode || ctx.params?.has?.('notitle');
  const THREE = ctx.THREE;

  // shared SVG defs (heart gradient)
  const defs = document.createElementNS(SVGNS, 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.style.position = 'absolute';
  defs.innerHTML = `<defs>
    <radialGradient id="k-heart-fill" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#ff7a6a"/><stop offset=".45" stop-color="#d4202e"/><stop offset="1" stop-color="#7a0a16"/></radialGradient>
    <linearGradient id="k-heart-empty" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(40,22,20,.62)"/><stop offset="1" stop-color="rgba(14,8,8,.72)"/></linearGradient>
    ${[1, 2, 3].map(n => `<clipPath id="k-q${n}">${QUADS.slice(0, n).map(q => `<rect x="${q[0]}" y="${q[1]}" width="${q[2]}" height="${q[3]}"/>`).join('')}</clipPath>`).join('')}
  </defs>`;
  root.appendChild(defs);

  // ================= gameplay HUD =================
  const hud = el('div', { id: 'k-hud', class: 'k-layer' }, root);
  el('div', { id: 'k-low-vignette' }, hud);
  const hurtFlash = el('div', { id: 'k-hurt-flash' }, hud);

  const vitals = el('div', { id: 'k-vitals' }, hud);
  el('div', { id: 'k-badge' }, vitals, '<img src="/ui/hero-avatar-badge.webp" alt="">');
  const vr = el('div', { id: 'k-vit-right' }, vitals);
  const heartsEl = el('div', { id: 'k-hearts' }, vr);
  const shardsEl = el('div', { id: 'k-shards' }, vr, SHARD_SVG + '<span id="k-shard-count">0</span><span id="k-shard-label">Bosom Shards</span>');
  const shardCountEl = shardsEl.querySelector('#k-shard-count');

  // action ring
  const actions = el('div', { id: 'k-actions' }, hud);
  function mkBtn(id) {
    const b = el('div', { id, class: 'k-btn' }, actions);
    const disc = el('div', { class: 'k-disc' }, b);
    const key = el('div', { class: 'k-key' }, disc); key.style.display = 'none';
    const icon = el('div', { style: 'display:contents' }, disc);
    const lab = el('div', { class: 'k-lab' }, b);
    return { b, icon, lab, key, state: '' };
  }
  const btnA = mkBtn('k-btn-a'), btnB = mkBtn('k-btn-b'), btnC = mkBtn('k-btn-c');
  function setBtn(btn, label, icon, dim, key) {
    const st = label + '|' + icon + '|' + dim + '|' + key;
    if (st === btn.state) return; btn.state = st;
    btn.lab.textContent = label;
    btn.icon.innerHTML = ICONS[icon] || '';
    btn.b.classList.toggle('k-dim', !!dim);
    if (key) { btn.key.textContent = key; btn.key.style.display = ''; } else btn.key.style.display = 'none';
  }
  function flashBtn(btn) { btn.b.classList.remove('k-flash'); void btn.b.offsetWidth; btn.b.classList.add('k-flash'); }

  // minimap
  const map = el('div', { id: 'k-map' }, hud);
  const disc = el('div', { id: 'k-map-disc' }, map);
  const canvas = el('canvas', { id: 'k-map-canvas' }, disc);
  const ring = document.createElementNS(SVGNS, 'svg');
  ring.setAttribute('id', 'k-map-ring'); ring.setAttribute('viewBox', '0 0 208 208');
  ring.innerHTML = ringSVG();
  map.appendChild(ring);
  const rose = ring.querySelector('#k-map-rose');
  const mapArea = el('div', { id: 'k-map-area' }, map);
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.height = Math.round(180 * DPR);
  const g = canvas.getContext('2d');
  const mapImg = buildMinimapImage({ heightAt: (x, z) => (ctx.terrain?.heightAt ? ctx.terrain.heightAt(x, z) : layoutHeightAt(x, z)) });

  // area card
  const card = el('div', { id: 'k-area-card', class: 'k-layer', style: 'inset:auto' }, hud);
  card.innerHTML = `<div class="k-sub"></div><div class="k-name"></div>${RULE_SVG(520)}`;

  // ================= title screen =================
  let titleActive = !skipTitle;
  let title = null;
  if (titleActive) {
    title = el('div', { id: 'k-title', class: 'k-layer' }, root);
    title.innerHTML = `<img id="k-title-logo" src="/ui/title-logo.webp" alt="Saga of Koto">
      <div id="k-title-sub">Bosom of the Wilds</div>
      <div id="k-title-press">Press any key<svg class="k-orn" viewBox="-90 -6 180 12"><path d="M-86 0 H-10 M10 0 H86" stroke="#e9d7a6" stroke-width=".8" opacity=".7"/><path d="M0 -4 L4 0 L0 4 L-4 0Z" fill="#e9d7a6"/></svg></div>
      <div id="k-title-foot">An original tale of Koto &middot; Brennan's Hollow</div>`;
    hud.classList.add('k-hidden');
  }
  function dismissTitle() {
    if (!titleActive) return;
    titleActive = false; ui.titleActive = false;
    title.classList.add('k-fade');
    setTimeout(() => title.remove(), 1700);
    hud.classList.remove('k-hidden');
    ctx.emit('title-dismissed');
    pendingRegionCard = 1.2; // show the current region's card shortly after
  }

  // ================= pause menu =================
  const pause = el('div', { id: 'k-pause', class: 'k-layer' }, root);
  pause.innerHTML = `<div id="k-pause-panel">
    <h1>Paused</h1>${RULE_SVG(360)}
    <div id="k-pause-cols">
      <div><div id="k-memory"><video src="/ui/opening-video.mp4" muted loop playsinline preload="none"></video></div>
        <div id="k-memory-cap">A memory of home</div></div>
      <div id="k-pause-info">
        <div class="k-row"><span class="k-k">Region</span><span class="k-v" data-f="region"></span></div>
        <div class="k-row"><span class="k-k">Vitality</span><span class="k-v" data-f="hearts"></span></div>
        <div class="k-row"><span class="k-k">Bosom Shards</span><span class="k-v" data-f="shards"></span></div>
        <div class="k-row"><span class="k-k">Hour</span><span class="k-v" data-f="hour"></span></div>
        <div class="k-row"><span class="k-k">Master volume</span><span class="k-slider"><input type="range" min="0" max="100" data-vol="master"><span class="k-pct"></span></span></div>
        <div class="k-row"><span class="k-k">Music</span><span class="k-slider"><input type="range" min="0" max="100" data-vol="music"><span class="k-pct"></span></span></div>
        <div id="k-controls">
          <div><b>Move</b> W A S D</div><div><b>Camera</b> Mouse</div>
          <div><b>Attack</b> Click / J</div><div><b>Roll</b> Space</div>
          <div><b>Focus</b> Right click / Q</div><div><b>Pause</b> Esc</div>
        </div>
        <div id="k-pause-btns"><button class="k-menu-btn" data-act="resume">Resume</button></div>
      </div>
    </div></div>`;
  const pauseVideo = pause.querySelector('video');
  const vols = { master: store.get('vol.master', 0.8), music: store.get('vol.music', 0.7) };
  for (const inp of pause.querySelectorAll('input[data-vol]')) {
    const k = inp.dataset.vol;
    const pct = inp.parentElement.querySelector('.k-pct');
    const apply = () => {
      const v = inp.value / 100; vols[k] = v; store.set('vol.' + k, v);
      inp.style.setProperty('--p', inp.value + '%'); pct.textContent = inp.value;
      ctx.audio?.setVolume?.(k, v);
    };
    inp.value = Math.round(vols[k] * 100);
    inp.addEventListener('input', apply);
    inp.style.setProperty('--p', inp.value + '%'); pct.textContent = inp.value;
    inp.addEventListener('keydown', e => e.stopPropagation());
  }
  pause.querySelector('[data-act=resume]').addEventListener('click', () => setPaused(false));
  pause.addEventListener('pointerdown', e => { if (e.target === pause) setPaused(false); });

  let paused = false, lastToggle = -1;
  function setPaused(p) {
    if (p === paused || titleActive) return;
    const now = performance.now();
    if (now - lastToggle < 180) return;
    lastToggle = now;
    paused = p; ui.paused = p; ctx.paused = p;
    pause.classList.toggle('k-open', p);
    if (p) {
      try { document.exitPointerLock?.(); } catch { }
      refreshPauseInfo();
      try { pauseVideo.preload = 'auto'; const pr = pauseVideo.play(); pr?.catch?.(() => { }); } catch { }
    } else {
      try { pauseVideo.pause(); } catch { }
    }
    ctx.emit('pause', { paused: p });
  }
  function refreshPauseInfo() {
    const f = n => pause.querySelector(`[data-f=${n}]`);
    f('region').textContent = currentRegion.name;
    const { health, max } = healthUnits();
    f('hearts').textContent = `${fmtHearts(health)} / ${fmtHearts(max)} hearts`;
    f('shards').textContent = String(shards);
    f('hour').textContent = hourName(getTod());
  }

  // ================= input =================
  window.addEventListener('keydown', e => {
    if (titleActive) {
      if (e.key === 'F5' || e.key === 'F12' || e.metaKey || e.ctrlKey) return;
      e.preventDefault(); dismissTitle(); return;
    }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (e.key === 'Escape' || !e.repeat) setPaused(!paused);
    }
  }, true);
  window.addEventListener('pointerdown', () => { if (titleActive) dismissTitle(); }, true);

  // ================= state =================
  let shards = 0, shownHealth = null, shownMax = null;
  let lowHealth = false;
  let currentRegion = WILDS, candidate = null, candT = 0, pendingRegionCard = 0;
  const lastHurt = { t: -10 };

  function healthUnits() {
    const h = ctx.hero;
    let max = Number.isFinite(h?.maxHealth) ? h.maxHealth : 12;
    let health = Number.isFinite(h?.health) ? h.health : max;
    // quarter-heart units: 4 units per heart. Large pools (e.g. 100 HP) are mapped onto 10 hearts.
    const upH = h?.unitsPerHeart || (max > 80 ? max / 10 : 4);
    return { health: Math.max(0, health) / upH * 4, max: max / upH * 4 };
  }
  const fmtHearts = u => { const q = Math.round(u) / 4; return q % 1 ? q.toFixed(2).replace(/0$/, '') : String(q); };

  function renderHearts(health, max) {
    const n = Math.max(1, Math.ceil(max / 4 - 1e-6));
    const q = Math.max(0, Math.round(health));
    let html = '';
    for (let i = 0; i < n; i++) {
      const fill = Math.max(0, Math.min(4, q - i * 4));
      const last = fill > 0 && (q - i * 4) <= 4;
      const clip = fill === 4 ? '' : fill === 0 ? null : `clip-path="url(#k-q${fill})"`;
      html += `<div class="k-heart${last ? ' k-last' : ''}" data-i="${i}"><svg viewBox="0 0 26 24">
        <path d="${HEART_PATH}" fill="url(#k-heart-empty)" stroke="rgba(0,0,0,.65)" stroke-width="2.6"/>
        ${clip === null ? '' : `<g ${clip}><path d="${HEART_PATH}" fill="url(#k-heart-fill)"/><ellipse cx="7.6" cy="6.6" rx="3.2" ry="2.1" fill="rgba(255,235,225,.55)" transform="rotate(-28 7.6 6.6)"/></g>`}
        <path d="${HEART_PATH}" fill="none" stroke="#f1e0b4" stroke-width="1.05" opacity="${fill ? .95 : .55}"/></svg></div>`;
    }
    heartsEl.innerHTML = html;
  }
  function pulseHeart() {
    const hs = heartsEl.querySelectorAll('.k-heart');
    const { health } = healthUnits();
    const i = Math.min(hs.length - 1, Math.max(0, Math.ceil(health / 4) - 1));
    const target = hs[Math.min(hs.length - 1, i + 1)] || hs[i];
    for (const h of [hs[i], target]) if (h) { h.classList.remove('k-pulse'); void h.offsetWidth; h.classList.add('k-pulse'); }
  }

  function showArea(name, sub = '') {
    card.querySelector('.k-name').textContent = name;
    card.querySelector('.k-sub').textContent = sub;
    card.classList.remove('k-show'); void card.offsetWidth; card.classList.add('k-show');
    ctx.emit('area', { name });
  }

  // events
  ctx.on('rupee', d => {
    shards += (d && Number.isFinite(d.amount)) ? d.amount : (Number.isFinite(d) ? d : 1);
    shardCountEl.textContent = shards;
    shardsEl.classList.remove('k-bump'); void shardsEl.offsetWidth; shardsEl.classList.add('k-bump');
  });
  ctx.on('hero-hurt', () => {
    lastHurt.t = ctx.time;
    shownHealth = null; // force rerender
    hurtFlash.classList.remove('k-on'); void hurtFlash.offsetWidth; hurtFlash.classList.add('k-on');
    requestAnimationFrame(pulseHeart);
  });
  ctx.on('swing', () => flashBtn(btnB));
  ctx.on('roll', () => flashBtn(btnA));

  // ================= helpers =================
  const v3 = THREE ? new THREE.Vector3() : null;
  function heroPos() {
    const h = ctx.hero;
    const p = h?.position || h?.root?.position;
    if (p) return p;
    if (ctx.shot?.hero) return { x: ctx.shot.hero[0], y: ctx.shot.hero[1], z: ctx.shot.hero[2] };
    return ctx.camera.position;
  }
  function heroYaw() {
    const h = ctx.hero;
    if (Number.isFinite(h?.yaw)) return h.yaw;
    if (h?.root?.rotation) return h.root.rotation.y;
    return ctx.shot?.yaw ?? 0;
  }
  function getTod() {
    const v = ctx.timeOfDay ?? ctx.tod ?? ctx.sky?.tod ?? ctx.lighting?.tod ?? ctx.shot?.tod;
    return Number.isFinite(v) ? v : 0.4;
  }
  function hourName(t) {
    if (t < 0.2 || t > 0.85) return 'Deep night';
    if (t < 0.28) return 'Dawn';
    if (t < 0.4) return 'Morning';
    if (t < 0.55) return 'Midday';
    if (t < 0.68) return 'Afternoon';
    if (t < 0.78) return 'Dusk';
    return 'Evening';
  }
  function nearestNPC(p) {
    const lists = [ctx.npcs, ctx.village?.npcs, ctx.interactables];
    let best = null, bd = 1e9;
    for (const L of lists) if (Array.isArray(L)) for (const n of L) {
      const q = n.position || n.root?.position; if (!q) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best && bd < (best.talkRadius || 3.2) ? best : null;
  }
  function keyFor(name) {
    const b = ctx.input?.bindings?.[name];
    if (!b) return '';
    const k = Array.isArray(b) ? b[0] : b;
    return String(k).replace(/^Key/, '').replace(/^Digit/, '').replace('Space', '␣').replace('Mouse0', 'LMB').replace('Mouse2', 'RMB').slice(0, 4);
  }

  // ================= minimap draw =================
  const MAP_R = 90, VIEW_M = 72; // px radius, metres shown to the edge
  const LM_ICONS = [
    { id: 'village', x: LANDMARKS.village.x, z: LANDMARKS.village.z, kind: 'house' },
    { id: 'lake', x: LANDMARKS.lake.x, z: LANDMARKS.lake.z, kind: 'drop' },
    { id: 'forest', x: LANDMARKS.forest.x, z: LANDMARKS.forest.z, kind: 'tree' },
    { id: 'shrine', x: LANDMARKS.shrine.x, z: LANDMARKS.shrine.z, kind: 'shrine' },
  ];
  const fwd = { x: 0, z: -1 };
  function drawMinimap() {
    const p = heroPos();
    if (v3) { ctx.camera.getWorldDirection(v3); const l = Math.hypot(v3.x, v3.z) || 1; fwd.x = v3.x / l; fwd.z = v3.z / l; }
    const fx = fwd.x, fz = fwd.z;
    const S = (MAP_R / VIEW_M) * DPR, cx = MAP_R * DPR, cy = MAP_R * DPR;
    const W = canvas.width;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, W);
    g.fillStyle = '#2b3a2c'; g.fillRect(0, 0, W, W);
    // world->screen: sx = cx + S*(-fz*dx + fx*dz), sy = cy + S*(-fx*dx - fz*dz)
    const k = mapImg.metresPerPixel, R = mapImg.halfExtent;
    const ox = -R - p.x, oz = -R - p.z;
    g.setTransform(S * -fz * k, S * -fx * k, S * fx * k, S * -fz * k,
      cx + S * (-fz * ox + fx * oz), cy + S * (-fx * ox - fz * oz));
    g.imageSmoothingEnabled = true;
    g.drawImage(mapImg.canvas, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const toScreen = (x, z) => { const dx = x - p.x, dz = z - p.z; return [cx + S * (-fz * dx + fx * dz), cy + S * (-fx * dx - fz * dz)]; };
    // inner shade
    const grd = g.createRadialGradient(cx, cy, W * 0.3, cx, cy, W * 0.5);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(10,8,4,.55)');
    g.fillStyle = grd; g.fillRect(0, 0, W, W);
    // view cone
    g.save(); g.translate(cx, cy);
    const cone = g.createRadialGradient(0, 0, 0, 0, 0, 70 * DPR);
    cone.addColorStop(0, 'rgba(255,245,215,.30)'); cone.addColorStop(1, 'rgba(255,245,215,0)');
    g.fillStyle = cone; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 70 * DPR, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); g.closePath(); g.fill();
    g.restore();
    // landmarks
    for (const lm of LM_ICONS) {
      let [sx, sy] = toScreen(lm.x, lm.z);
      const dx = sx - cx, dy = sy - cy, d = Math.hypot(dx, dy), lim = (MAP_R - 13) * DPR;
      let edge = false;
      if (d > lim) { sx = cx + dx / d * lim; sy = cy + dy / d * lim; edge = true; }
      drawIcon(lm.kind, sx, sy, edge ? 0.8 : 1, edge ? 0.75 : 1);
    }
    // enemies
    const es = ctx.enemies || [];
    for (const e of es) {
      if (e.alive === false) continue;
      const q = e.position || e.root?.position; if (!q) continue;
      const [sx, sy] = toScreen(q.x, q.z);
      if (Math.hypot(sx - cx, sy - cy) > (MAP_R - 6) * DPR) continue;
      g.fillStyle = '#e0473c'; g.strokeStyle = 'rgba(30,10,6,.9)'; g.lineWidth = 1.2 * DPR;
      g.beginPath(); g.arc(sx, sy, 3.4 * DPR, 0, 7); g.fill(); g.stroke();
    }
    // hero arrow (heading relative to camera forward)
    const yaw = heroYaw();
    const hx = Math.sin(yaw), hz = Math.cos(yaw);
    const ang = Math.atan2(-fz * hx + fx * hz, -(-fx * hx - fz * hz)); // screen angle from up
    g.save(); g.translate(cx, cy); g.rotate(ang); g.scale(DPR, DPR);
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 4;
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 7); g.lineTo(0, 3.5); g.lineTo(-7, 7); g.closePath();
    g.fillStyle = '#f7eed4'; g.fill(); g.shadowBlur = 0;
    g.lineWidth = 1.3; g.strokeStyle = '#3a2c18'; g.stroke();
    g.beginPath(); g.moveTo(0, -10); g.lineTo(0, 3.5); g.lineTo(7, 7); g.closePath(); g.fillStyle = 'rgba(184,150,81,.75)'; g.fill();
    g.restore();
    // compass rose rotation: north (0,-1) on screen
    const nAng = Math.atan2(-fx, fz) * 180 / Math.PI;
    rose.setAttribute('transform', `rotate(${nAng.toFixed(2)} 104 104)`);
  }
  function drawIcon(kind, x, y, s, a) {
    g.save(); g.translate(x, y); g.scale(DPR * s, DPR * s); g.globalAlpha = a;
    // medallion
    g.beginPath(); g.arc(0, 0, 8.5, 0, 7); g.fillStyle = 'rgba(24,20,14,.82)'; g.fill();
    g.lineWidth = 1.2; g.strokeStyle = '#e9d7a6'; g.stroke();
    g.fillStyle = '#f3e8cc'; g.strokeStyle = '#f3e8cc'; g.lineWidth = 1.2;
    g.beginPath();
    if (kind === 'house') { g.moveTo(-4.5, 0); g.lineTo(0, -4.5); g.lineTo(4.5, 0); g.lineTo(3.2, 0); g.lineTo(3.2, 4); g.lineTo(-3.2, 4); g.lineTo(-3.2, 0); g.closePath(); g.fill(); }
    else if (kind === 'drop') { g.moveTo(0, -5); g.bezierCurveTo(3, -1, 4, 1, 4, 2); g.arc(0, 2, 4, 0, Math.PI); g.bezierCurveTo(-4, 1, -3, -1, 0, -5); g.fillStyle = '#9fd6dc'; g.fill(); }
    else if (kind === 'tree') { g.moveTo(0, -5.5); g.lineTo(4.5, 2); g.lineTo(-4.5, 2); g.closePath(); g.fillStyle = '#a9cf8a'; g.fill(); g.fillRect(-.8, 2, 1.6, 3); }
    else if (kind === 'shrine') { g.fillRect(-5, -4.6, 10, 1.6); g.fillRect(-3.8, -3, 1.5, 7.5); g.fillRect(2.3, -3, 1.5, 7.5); g.fillRect(-4.5, 4, 9, 1); }
    g.restore();
  }

  // ================= title camera =================
  const titleLook = { x: 18, y: 0, z: -90 };
  function titleCamera(t) {
    const a = -0.35 + t * 0.022;
    const r = 58;
    const x = Math.sin(a) * r + 6, z = Math.cos(a) * r + 18;
    const hAt = ctx.terrain?.heightAt || layoutHeightAt;
    const y = Math.max(hAt(x, z), WATER_LEVEL) + 13 + Math.sin(t * 0.07) * 2;
    ctx.camera.position.set(x, y, z);
    const ly = hAt(titleLook.x, titleLook.z) + 14;
    ctx.camera.lookAt(titleLook.x + Math.sin(t * 0.05) * 20, ly, titleLook.z);
  }

  // ================= service =================
  const ui = { titleActive, paused: false, get region() { return currentRegion; } };
  ctx.ui = ui;
  ctx.hud = {
    showArea, setPaused, dismissTitle, regionAt,
    prompts: {}, // others may set ctx.hud.prompts.a = 'Open' (string) or null
    setPrompt(slot, label) { this.prompts[slot] = label; },
    get volumes() { return { ...vols }; },
  };
  // let audio pick up stored volumes once it exists
  queueMicrotask(() => { for (const k in vols) ctx.audio?.setVolume?.(k, vols[k]); });

  let mapAcc = 0;
  return {
    update(dt, t) {
      if (titleActive) { titleCamera(t); return; }
      if (ctx.input?.pressed?.('pause')) setPaused(!paused);

      // hearts
      const { health, max } = healthUnits();
      const hr = Math.round(health), mr = Math.round(max);
      if (hr !== shownHealth || mr !== shownMax) {
        if (shownHealth != null && hr > shownHealth) requestAnimationFrame(pulseHeart);
        shownHealth = hr; shownMax = mr; renderHearts(hr, mr);
      }
      const low = hr > 0 && hr <= Math.max(4, mr * 0.25);
      if (low !== lowHealth) { lowHealth = low; hud.classList.toggle('k-low', low); ctx.emit('low-health', { low }); }

      // region
      const p = heroPos();
      const reg = regionAt(p.x, p.z);
      if (reg !== currentRegion) {
        if (candidate !== reg) { candidate = reg; candT = 0; }
        candT += dt;
        if (candT > 0.7) {
          currentRegion = reg; mapArea.textContent = reg.name;
          if (reg !== WILDS && !shotMode) showArea(reg.name, reg.sub);
        }
      } else candidate = null;
      if (!mapArea.textContent) mapArea.textContent = currentRegion.name;
      if (pendingRegionCard > 0) {
        pendingRegionCard -= dt;
        if (pendingRegionCard <= 0) {
          const r = regionAt(p.x, p.z); currentRegion = r; mapArea.textContent = r.name;
          if (r !== WILDS) showArea(r.name, r.sub);
        }
      }

      // action prompts
      let enemyNear = false;
      for (const e of ctx.enemies || []) {
        if (e.alive === false) continue;
        const q = e.position || e.root?.position; if (!q) continue;
        if (Math.hypot(q.x - p.x, q.z - p.z) < 14) { enemyNear = true; break; }
      }
      const moving = (ctx.input?.move?.lengthSq?.() || 0) > 0.01;
      const npc = nearestNPC(p);
      const P = ctx.hud.prompts;
      if (P.a !== undefined && P.a !== null) setBtn(btnA, P.a, P.aIcon || 'look', false, keyFor('interact'));
      else if (npc) setBtn(btnA, npc.talkLabel || 'Talk', 'talk', false, keyFor('interact'));
      else setBtn(btnA, 'Roll', 'roll', !(moving || enemyNear), keyFor('roll'));
      setBtn(btnB, P.b || 'Attack', 'sword', false, keyFor('attack'));
      setBtn(btnC, P.c || 'Focus', 'focus', !enemyNear && !ctx.cameraRig?.lockTarget, keyFor('lock') || keyFor('focus'));

      // minimap (30 Hz is plenty)
      mapAcc += dt;
      if (mapAcc > 1 / 30) { mapAcc = 0; mapImg.step(); drawMinimap(); }
      if (paused && ((t * 2) | 0) % 2 === 0) refreshPauseInfo();
    },
  };
}

function ringSVG() {
  const C = 104;
  let ticks = '';
  for (let i = 0; i < 72; i++) {
    if (i % 18 === 0) continue;
    const a = i / 72 * Math.PI * 2, big = i % 9 === 0;
    const r0 = big ? 92.5 : 93.5, r1 = big ? 98.5 : 96.5;
    ticks += `<line x1="${(C + Math.sin(a) * r0).toFixed(2)}" y1="${(C - Math.cos(a) * r0).toFixed(2)}" x2="${(C + Math.sin(a) * r1).toFixed(2)}" y2="${(C - Math.cos(a) * r1).toFixed(2)}" stroke="#e9d7a6" stroke-width="${big ? 1.1 : .7}" opacity="${big ? .9 : .55}"/>`;
  }
  const letter = (ch, ang, fill, size) => {
    const a = ang * Math.PI / 180, r = 95.6;
    return `<text x="${(C + Math.sin(a) * r).toFixed(2)}" y="${(C - Math.cos(a) * r).toFixed(2)}" transform="rotate(${ang} ${(C + Math.sin(a) * r).toFixed(2)} ${(C - Math.cos(a) * r).toFixed(2)})"
      text-anchor="middle" dominant-baseline="central" font-family="var(--k-serif)" font-size="${size}" fill="${fill}" letter-spacing="0">${ch}</text>`;
  };
  return `<defs><linearGradient id="k-ring-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3124"/><stop offset="1" stop-color="#16120c"/></linearGradient></defs>
    <circle cx="${C}" cy="${C}" r="96" fill="none" stroke="url(#k-ring-g)" stroke-width="13" opacity=".92"/>
    <circle cx="${C}" cy="${C}" r="102.3" fill="none" stroke="#e9d7a6" stroke-width="1.3"/>
    <circle cx="${C}" cy="${C}" r="89.6" fill="none" stroke="#e9d7a6" stroke-width="1.1"/>
    <circle cx="${C}" cy="${C}" r="87.6" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="2"/>
    <g id="k-map-rose">${ticks}
      <path d="M${C} ${C - 108} L${C + 5} ${C - 100} L${C} ${C - 102.5} L${C - 5} ${C - 100}Z" fill="#e05a43" stroke="#2a1a10" stroke-width=".8"/>
      ${letter('N', 0, '#ffd9a0', 12)}${letter('E', 90, '#e9d7a6', 10)}${letter('S', 180, '#e9d7a6', 10)}${letter('W', 270, '#e9d7a6', 10)}
    </g>
    <path d="M${C} ${C - 87} l3.2 -4 h-6.4z" fill="#f7eed4" opacity=".9"/>`;
}
