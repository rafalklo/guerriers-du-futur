// Core engine: stage scaling, scenes, assets, audio, timers, saves.
export const W = 768, H = 576;
export const A = (p) => 'assets/' + p;

export const stage = document.getElementById('stage');
const wrap = document.getElementById('wrap');

export function fit() {
  const pad = document.body.classList.contains('touch') ? touchReserve() : { x: 0, y: 0 };
  const vw = window.innerWidth - pad.x, vh = window.innerHeight - pad.y;
  const k = Math.min(vw / W, vh / H);
  stage.style.transform = `scale(${k})`;
  wrap.style.width = W * k + 'px';
  wrap.style.height = H * k + 'px';
}
function touchReserve() {
  // reserve room for the touch pad below (portrait) or beside (landscape)
  return window.innerWidth > window.innerHeight ? { x: 0, y: 0 } : { x: 0, y: 190 };
}
window.addEventListener('resize', fit);

// ---------- DOM helpers ----------
export function el(tag, props = {}, parent = null) {
  const e = document.createElement(tag);
  const { style, cls, text, html, ...rest } = props;
  if (cls) e.className = cls;
  if (style) Object.assign(e.style, style);
  if (text !== undefined) e.textContent = text;
  if (html !== undefined) e.innerHTML = html;
  Object.assign(e, rest);
  if (parent) parent.appendChild(e);
  return e;
}
// absolute box in stage px
export function box(parent, x, y, w, h, props = {}) {
  const e = el(props.tag || 'div', props, parent);
  Object.assign(e.style, { position: 'absolute', left: x + 'px', top: y + 'px' });
  if (w != null) e.style.width = w + 'px';
  if (h != null) e.style.height = h + 'px';
  return e;
}
export function img(parent, src, x, y, w, h, props = {}) {
  const e = box(parent, x, y, w, h, { ...props, tag: 'img' });
  e.src = A(src);
  e.draggable = false;
  return e;
}

// ---------- timers bound to a scene ----------
export class Timers {
  constructor() { this.ids = new Set(); }
  every(ms, fn) { const id = setInterval(fn, ms); this.ids.add(id); return { stop: () => { clearInterval(id); this.ids.delete(id); } }; }
  after(ms, fn) { const id = setTimeout(() => { this.ids.delete(id); fn(); }, ms); this.ids.add(id); return { stop: () => clearTimeout(id) }; }
  clear() { for (const id of this.ids) { clearInterval(id); clearTimeout(id); } this.ids.clear(); }
}

// ---------- scenes (modal stack like VB forms) ----------
const stack = [];
export function top() { return stack[stack.length - 1]; }
// push a modal scene; returns a promise resolved with its result when closed
export function show(scene, ...args) {
  return new Promise((resolve) => {
    const root = el('div', { cls: 'form' }, stage);
    scene.root = root;
    scene.timers = new Timers();
    scene._resolve = resolve;
    stack.push(scene);
    scene.load(...args);
  });
}
export function close(scene, result) {
  const i = stack.indexOf(scene);
  if (i < 0) return;
  stack.splice(i, 1);
  scene.timers.clear();
  if (scene.unload) scene.unload();
  scene.root.remove();
  scene._resolve(result);
}

// keyboard routed to the top scene
window.addEventListener('keydown', (e) => {
  const s = top();
  if (s && s.keydown) {
    if (s.keydown(e.key, e) !== false && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  }
});
export function sendKey(key) { const s = top(); if (s && s.keydown) s.keydown(key, {}); }
export function sendKeyUp(key) { const s = top(); if (s && s.keyup) s.keyup(key, {}); }
window.addEventListener('keyup', (e) => sendKeyUp(e.key));

// ---------- audio ----------
// Music: one channel (like FrmFond.MMCMusique). Sfx: named channels (like MMCEffets devices).
export const audio = {
  music: null, musicName: null, unlocked: false, muted: false,
  playMusic(name, loop = true) {
    this.stopMusic();
    const a = new Audio(A('music/' + name.toLowerCase().replace(/^villes\//, '') + '.mp3'));
    a.loop = loop;
    a.muted = this.muted;
    this.music = a; this.musicName = name;
    a.play().catch(() => {});
  },
  stopMusic() { if (this.music) { this.music.pause(); this.music = null; this.musicName = null; } },
  channels: {},
  // play a wav on a channel; if busy and !restart, do nothing (VB: If Position = 0 Then Play)
  sfx(name, channel = name, restart = true) {
    let a = this.channels[channel];
    if (a && !a.paused && !a.ended && !restart) return a;
    if (a) a.pause();
    a = new Audio(A('sfx/' + name.toLowerCase() + '.wav'));
    a.muted = this.muted;
    this.channels[channel] = a;
    a.play().catch(() => {});
    return a;
  },
  stopSfx(channel) { const a = this.channels[channel]; if (a) { a.pause(); delete this.channels[channel]; } },
  setMuted(m) {
    this.muted = m;
    if (this.music) this.music.muted = m;
    for (const a of Object.values(this.channels)) a.muted = m;
  },
};

// ---------- RNG: VB Rnd semantics (0 <= r < 1) ----------
export const Rnd = () => Math.random();
export const Int = (x) => Math.floor(x); // VB Int() floors toward -infinity
// VB CInt: banker's rounding
export function CInt(x) {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}
export const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
export const padName = (s, n) => (s + ' '.repeat(n)).slice(0, n);

// ---------- storage (replaces the Sauvegarde\N folders) ----------
const KEY = 'gdf-save-';
export const storage = {
  get(slot) { try { const v = localStorage.getItem(KEY + slot); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(slot, data) { try { localStorage.setItem(KEY + slot, JSON.stringify(data)); return true; } catch { return false; } },
};

export const clone = (o) => JSON.parse(JSON.stringify(o));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
