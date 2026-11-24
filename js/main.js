// Entry point = FrmFond: black backdrop, loading bar, and the flow between Menu / Ville / Carte.
import { stage, fit, show, close, top, box, img, el, sendKey, sendKeyUp, audio, Timers } from './core.js';
import { loadData, G, stopPlayTime } from './state.js';
import { Menu } from './scenes/menu.js';
import { Ville } from './scenes/ville.js';
import { Carte } from './scenes/carte.js';

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
function orient() { document.body.classList.toggle('landscape', window.innerWidth > window.innerHeight); fit(); }
window.addEventListener('resize', orient);
orient();

// show the touch pad only while a walking scene (scene.walk === true) is on top
setInterval(() => {
  const s = top();
  const on = !!(s && s.walk);
  if (document.body.classList.contains('walk') !== on) { document.body.classList.toggle('walk', on); fit(); }
}, 150);

// touch pad -> key events (held while pressed)
for (const b of document.querySelectorAll('#pad button')) {
  const key = b.dataset.key;
  const down = (e) => { e.preventDefault(); b.classList.add('on'); sendKey(key); };
  const up = (e) => { e.preventDefault(); if (!b.classList.contains('on')) return; b.classList.remove('on'); sendKeyUp(key); };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
}
const mute = document.getElementById('mute');
mute.addEventListener('click', () => { audio.setMuted(!audio.muted); mute.textContent = audio.muted ? '🔇' : '🔊'; });

// ---------- title splash (FrmTitre: logoa.gif + TITRE.WAV). Also unlocks audio on phones. ----------
class Titre {
  load() {
    const r = this.root;
    r.style.background = '#fff';
    this.logo = img(r, 'images/titre/logoa.gif', 60, 0, 648, 576);
    this.hint = box(r, 0, 520, 768, 40, { cls: 'lbl', text: 'Cliquez ou touchez l\'écran pour commencer',
      style: { textAlign: 'center', color: '#c00000', font: 'bold 20px Tahoma, sans-serif' } });
    this.timers.every(600, () => { this.hint.style.visibility = this.hint.style.visibility === 'hidden' ? 'visible' : 'hidden'; });
    this.started = false;
    const go = () => this.start();
    r.addEventListener('pointerdown', go);
  }
  keydown() { this.start(); }
  start() {
    if (this.started) { close(this); return; } // second tap skips
    this.started = true;
    this.hint.remove();
    this.logo.src = 'assets/images/titre/logoa.gif?' + Date.now(); // restart animation
    const a = audio.sfx('titre', 'effets');
    a.addEventListener('ended', () => close(this));
    this.timers.after(11000, () => close(this));
  }
}

// ---------- loading screen (FrmFond TmrCharge: +2 every 25 ms, 50 ticks) ----------
class Chargement {
  load() {
    const r = this.root;
    r.style.background = '#000';
    const y = Math.round(576 / 3), x = 384;
    box(r, x - 217 - 7, y, 217, 17, { cls: 'lbl', text: 'CHARGEMENT EN COURS ...',
      style: { color: '#c00000', font: 'bold 13px "MS Sans Serif", Tahoma, sans-serif', textAlign: 'right' } });
    const bar = box(r, x, y, 209, 17, { style: { border: '1px solid #808080', background: '#fff' } });
    const fill = box(bar, 0, 0, 0, 15, { style: { background: '#000080' } });
    let c = 0;
    this.timers.every(25, () => {
      c += 2;
      fill.style.width = (c / 100 * 207) + 'px';
      if (c >= 100) close(this);
    });
  }
}

async function run() {
  await loadData();
  await show(new Titre());
  for (;;) {
    stopPlayTime();
    const choix = await show(new Menu());           // 'nouvelle' | 'continuer' (state prepared by Menu)
    let next = { to: 'ville', mode: choix };
    while (next && next.to !== 'menu') {
      await show(new Chargement());
      if (next.to === 'ville') next = await show(new Ville(), next);   // -> {to:'carte'} | {to:'menu'}
      else next = await show(new Carte(), next);                       // -> {to:'ville', mode:'entrer'} | {to:'menu'}
    }
    audio.stopMusic();
  }
}
run().catch((e) => {
  console.error(e);
  el('pre', { text: 'Erreur: ' + e.message, style: { color: '#f66', padding: '20px', whiteSpace: 'pre-wrap' } }, stage);
});
