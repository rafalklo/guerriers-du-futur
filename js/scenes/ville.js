// FrmVille (towns) + FrmCoffre (chests). Also exports the walking helpers shared with carte.js (FrmMap).
import { show, close, audio, box, img, el, A } from '../core.js';
import { G, D, tile, setTile, startPlayTime } from '../state.js';

// VB TmrDeplacement has Interval = 1 ms, i.e. the OS timer minimum. On the Win9x machines of 2001 that was 55 ms
// (on NT/XP it would be ~15.6 ms). One tick = one frame of the walk cycle.
export const TICK_MS = 55;

export const HAUT = 1, GAUCHE = 2, BAS = 3, DROITE = 4;
export const DIRNAME = [null, 'haut', 'gauche', 'bas', 'droite'];
// original keys (Home/End/Delete/PageDown, the inverted T of the nav block) + arrow keys (touch pad sends arrows)
const KEYDIR = { Home: HAUT, ArrowUp: HAUT, Delete: GAUCHE, ArrowLeft: GAUCHE, End: BAS, ArrowDown: BAS, PageDown: DROITE, ArrowRight: DROITE };

// ---------- image preloading (tiles are drawn on a canvas so scrolling never flickers) ----------
const imgCache = new Map();
export function loadImage(path) {
  let p = imgCache.get(path);
  if (!p) {
    p = new Promise((res) => {
      const im = new Image();
      im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(im));
      im.onerror = () => res(null);
      im.src = A(path);
    });
    imgCache.set(path, p);
  }
  return p;
}
export async function preload(paths) {
  const out = {};
  await Promise.all([...new Set(paths)].map(async (p) => { out[p] = await loadImage(p); }));
  return out;
}
export const heroFrames = () => DIRNAME.slice(1).flatMap((d) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `ville/${d}${n}.gif`));

// ---------- base class for the two walking screens ----------
// Hold-to-walk: a direction keeps walking while it is held (touch pad or keyboard); browser auto-repeat is ignored.
export class Marche {
  initMarche(cols, rows, cell, mapKey) {
    this.walk = true;          // main.js shows the touch pad
    this.held = [];
    this.busy = true;          // = VB KeyPreview False (until the images are loaded, and during a step / a modal)
    this.closed = false;
    this.cols = cols; this.rows = rows; this.cell = cell; this.mapKey = mapKey;
    this.mw = D.maps[mapKey].w; this.mh = D.maps[mapKey].h;
    this.frame = 'bas1';
    this._blur = () => { this.held = []; };
    window.addEventListener('blur', this._blur);
    const c = this.canvas = el('canvas', { width: 768, height: 576, style: { position: 'absolute', left: '0', top: '0', width: '768px', height: '576px' } }, this.root);
    this.ctx = c.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.bg = document.createElement('canvas');
    this.bg.width = 768; this.bg.height = 576;
    this.bctx = this.bg.getContext('2d');
    this.bctx.imageSmoothingEnabled = false;
    this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, 768, 576);
  }
  async preloadMap(extra = []) {
    this.imgs = await preload([...D.maps[this.mapKey].paths, ...extra, ...heroFrames()]);
  }
  endMarche() { this.closed = true; window.removeEventListener('blur', this._blur); }

  get pos() { return G.heros.position; }
  set pos(v) { G.heros.position = v; }
  cellXY(k) { return [(k % this.cols) * this.cell, Math.floor(k / this.cols) * this.cell]; }
  snapHero() { [this.hx, this.hy] = this.cellXY(this.pos); }
  // map tile shown in screen cell k (TabPos(k+1)); null outside the map (= solid, drawn black)
  tileAt(k) {
    if (k < 0 || k >= this.cols * this.rows) return null;
    const r = this.vr + Math.floor(k / this.cols), c = this.vc + (k % this.cols);
    if (r < 0 || c < 0 || r >= this.mh || c >= this.mw) return null;
    return tile(this.mapKey, r * this.mw + c);
  }
  mapIndex(k) { return (this.vr + Math.floor(k / this.cols)) * this.mw + this.vc + (k % this.cols); }
  neighbour(d) { return this.pos + [0, -this.cols, -1, this.cols, 1][d]; }
  possibleHero(d) { const t = this.tileAt(this.neighbour(d)); return !!(t && t.active); }
  possibleAction(d) { const t = this.tileAt(this.neighbour(d)); return !!(t && t.action); }

  drawBg() {
    const g = this.bctx, n = this.cols * this.rows, s = this.cell;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 768, 576);
    for (let k = 0; k < n; k++) {
      const t = this.tileAt(k);
      const im = t && this.imgs[t.path];
      if (im) g.drawImage(im, (k % this.cols) * s, Math.floor(k / this.cols) * s, s, s);
    }
  }
  draw() {
    const g = this.ctx;
    g.drawImage(this.bg, 0, 0);
    const im = this.imgs[`ville/${this.frame}.gif`];
    if (im) g.drawImage(im, this.hx, this.hy, this.cell, this.cell);
  }

  keydown(key, e = {}) {
    const d = KEYDIR[key];
    if (d) {
      if (e.preventDefault) e.preventDefault();
      if (e.repeat) return;
      this.held = this.held.filter((x) => x !== d);
      this.held.push(d);
      if (!this.busy) this.essai(d);
      return;
    }
    if ((key === 's' || key === 'S') && !e.repeat && !this.busy) this.ouvreStats();
    // Escape: deliberately nothing (the original quit the program). Space/Tab debug buttons: ignored.
  }
  keyup(key) {
    const d = KEYDIR[key];
    if (d) this.held = this.held.filter((x) => x !== d);
  }
  // run a modal child form; keys pressed before it are forgotten afterwards (their keyup went to the child)
  async modal(fn) {
    this.busy = true;
    try { await fn(); } catch (err) { console.error(err); }
    this.held = [];
    if (!this.closed) { this.busy = false; this.draw(); }
  }
  ouvreStats() {
    return this.modal(async () => {
      const { Stats } = await import('./stats.js');
      await show(new Stats());
      this.apresStats();
    });
  }
  apresStats() {}
  // end of a walking step: continue if a direction is still held
  finPas() {
    this.busy = false;
    if (this.closed) return;
    const d = this.held[this.held.length - 1];
    if (d) this.essai(d);
  }
}

// ---------- FrmVille ----------
let noImgHero = 0;       // module level like the VB form variable: only the very first step has 5 ticks
let action = '';         // global Action (never reset in the original)
let coffreOuvert = false; // global CoffreOuvert (never reset in the original)

export class Ville extends Marche {
  load(opts = {}) {
    const mode = opts.mode || 'entrer';
    G.ville = D.villes[G.heros.endroit];
    const v = G.ville;
    this.initMarche(12, 9, 64, 'ville' + G.heros.endroit);
    audio.playMusic(v.musique, true);                      // LitInfoVille (looped: author's intent)
    G.heros.nbrHeros = 2;                                  // forced every time
    if (mode === 'nouvelle') {
      this.initialiseVille(18, 14);
      startPlayTime(null);
    } else if (mode === 'continuer') {
      this.initialiseVille(v.posHorLoad, v.posVerLoad);
      startPlayTime(G.heros.tempsJoue);
    } else {
      this.initialiseVille(v.posHorEntre, v.posVerEntre);
      this.pos = v.position;
    }
    this.snapHero();
    this.preloadMap(['ville/278.jpg', 'ville/280.jpg']).then(() => {
      if (this.closed) return;
      this.drawBg(); this.draw();
      this.busy = false;
    });
  }
  unload() { this.endMarche(); audio.stopMusic(); }

  initialiseVille(ph, pv) {
    if (!(pv >= 0 && pv <= 27)) pv = 27;   // (sic) out of range clamps to the max
    if (!(ph >= 0 && ph <= 36)) ph = 36;
    this.vc = ph; this.vr = pv;
  }
  possibleVille(d) {
    if (d === HAUT) return this.vr > 0;
    if (d === BAS) return this.vr < 27;
    if (d === GAUCHE) return this.vc > 0;
    return this.vc < 36;
  }
  static trigger(d, p) {
    if (d === HAUT) return p >= 24 && p <= 35;
    if (d === BAS) return p >= 72 && p <= 83;
    if (d === DROITE) return p % 12 === 9;
    return p % 12 === 2;
  }
  // Form_KeyDown for one direction
  essai(d) {
    if (this.possibleHero(d)) {
      if (Ville.trigger(d, this.pos) && this.possibleVille(d)) {
        this.deplaceVille(d);
        this.pas(d, false);
      } else {
        this.pos = this.neighbour(d);
        this.pas(d, true);
      }
    } else {
      this.frame = DIRNAME[d] + '1';
      this.draw();
      if (this.possibleAction(d)) this.determineAction(d);
    }
    if (this.pos > 95) this.sortie();
  }
  deplaceVille(d) {
    if (d === HAUT) this.vr--; else if (d === BAS) this.vr++; else if (d === GAUCHE) this.vc--; else this.vc++;
    this.drawBg();
  }
  // MovementHero + TmrDeplacement: frames 2,4,6,8 then rest frame 2; sprite snapped to the grid (drift fixed)
  pas(d, slide) {
    this.busy = true;
    const ticks = (8 - noImgHero) / 2 + 1;
    const fx = this.hx, fy = this.hy;
    const [tx, ty] = this.cellXY(this.pos);
    let k = 0;
    const t = this.timers.every(TICK_MS, () => {
      let stop = false;
      if (noImgHero >= 8) { t.stop(); noImgHero = 0; stop = true; }
      noImgHero += 2; k++;
      if (slide) {
        const f = stop ? 1 : Math.min(1, k / ticks);
        this.hx = Math.round(fx + (tx - fx) * f); this.hy = Math.round(fy + (ty - fy) * f);
      }
      this.frame = DIRNAME[d] + noImgHero;
      this.draw();
      if (stop) this.finPas();
    });
    this.stepTimer = t;
  }
  sortie() {
    if (this.stepTimer) this.stepTimer.stop();
    this.closed = true;
    G.heros.endroit = 0;
    close(this, { to: 'carte' });
  }
  async determineAction(d) {
    if (d === HAUT) {
      const t = this.tileAt(this.pos - 12);
      if (t && t.path === 'ville/280.jpg') action = 'Coffre';
      else {
        const s = this.tileAt(this.pos - 11);   // sign right of the door
        const n = { 'ville/281.jpg': 'Armes', 'ville/282.jpg': 'Potions', 'ville/283.jpg': 'Motel', 'ville/284.jpg': 'Taverne', 'ville/285.jpg': 'Armures' }[s && s.path];
        if (n) action = n;                        // no match: keeps the old value (original)
      }
    } else action = 'Coffre';
    if (action === 'Coffre') {
      await this.modal(async () => {
        await show(new Coffre());
        if (coffreOuvert) this.ouvreLeCoffre([0, -12, -1, 12, 1][d]);
      });
    } else if (action === 'Armes' || action === 'Potions' || action === 'Motel' || action === 'Armures') {
      const a = action;
      await this.modal(async () => {
        audio.playMusic('magasin', false);
        try {
          const { Magasin } = await import('./magasin.js');
          await show(new Magasin(), a);
        } finally {
          audio.playMusic(G.ville.musique, true);   // deliberate fix: the original town stayed silent
        }
      });
    }
    // Taverne: nothing happens
  }
  ouvreLeCoffre(off) {
    const k = this.pos + off;
    const t = this.tileAt(k);
    if (!t) return;
    setTile(this.mapKey, this.mapIndex(k), 'ville/278.jpg', t.active, false);
    this.drawBg();
  }
}

// ---------- FrmCoffre: gives the first unopened Coffres.gdf record ----------
export class Coffre {
  load() {
    let msg = '';
    for (let i = 1; i <= 20; i++) {
      const tr = G.coffres[i];
      if (tr.ouvert) continue;
      if (tr.contenu <= 16) {
        const p = G.heros.potions;
        let s = 1;
        while (s <= 10 && p[s] !== 0) s++;
        if (s === 11) {
          coffreOuvert = false;
          msg = 'Le Coffre contient la potion no : ' + tr.contenu + ' mais votre sac est deja plein.';
        } else {
          p[s] = tr.contenu;
          tr.ouvert = true;
          msg = 'Vous trouvez la potion : ' + (D.potions[tr.contenu].nomRaw || D.potions[tr.contenu].nom);
          coffreOuvert = true;
        }
      } else {
        G.heros.argent += tr.contenu;
        tr.ouvert = true;
        msg = 'Vous avez trouvé : ' + tr.contenu + ' $';
        coffreOuvert = true;
      }
      break;
    }
    const f = box(this.root, 228, 205, 312, 166, { style: { background: '#0000ff' } });
    img(f, 'ville/280.jpg', 8, 8, 48, 48);
    box(f, 8, 64, 297, 65, { text: msg, style: { color: '#c0c000', font: 'italic bold 16px "Book Antiqua", "Palatino Linotype", Palatino, serif', whiteSpace: 'pre-wrap', lineHeight: '1.2', overflow: 'hidden' } });
    const b = box(f, 120, 136, 73, 25, { tag: 'button', text: 'Accepter', cls: 'btn',
      style: { background: '#00c0c0', color: '#000', font: '11px "MS Sans Serif", Tahoma, sans-serif', border: '2px outset #e0ffff', padding: '0' } });
    b.addEventListener('click', () => close(this));
  }
  keydown(key) { if (key === 'Enter' || key === ' ') close(this); }
}
