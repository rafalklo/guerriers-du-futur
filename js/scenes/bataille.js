// FrmBataille + FrmStatsBataille + FrmChoixAmmo / FrmChoixPotion / FrmChoixMagie.
// Faithful port of the 2001 VB6 battle. See the battle spec for the original code paths.
// Deliberate deviations (see report): action buttons hidden once an action starts, enemy record clamped to 20,
// defeat returns 'defaite' (main menu) instead of quitting, touch support (bigger hit areas, long-press info box),
// oversized enemy GIFs centred (not scaled) in the 152x152 attack box.
import { el, box, img, show, close, audio, Rnd, Int, A, padName } from '../core.js';
import { G, D, ANIMS, calculeAttaque, calculeDefence } from '../state.js';

const FONT = '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, Arial, sans-serif';
const PT = (p) => Math.round(p * 4 / 3) + 'px';  // VB points -> px at 96 dpi
const HP_COLOR = '#FF0000';   // ColorBar default fill (BarColor not set in the .frm) -> classic red
const MP_COLOR = '#0000FF';   // PBCMagie: blue
const EPEE = 1, FUSIL = 2, MAGIE = 3, POTION = 4;
const PCT_HERO_FRAPPE = 7;
const HERO_LEFT = [null, 136, 408, 272, 8];
const sheetOf = (key) => A(key.replace(/\.gif$/i, '.sheet.webp'));
const f0Of = (key) => key.replace(/\.gif$/i, '.f0.png');

// enemy slot layout (index = enemy slot 1..18): [imageLeft, row] ; row 'b' bottom (img 153, label 119, bar 140) / 't' top (34, 0, 21)
const SLOTS = [null,
  [341.3, 'b', 341], [256, 't', 256], [426.7, 't', 427], [170.7, 'b', 170.7], [512, 'b', 512], [85.3, 't', 85],
  [597.3, 't', 597], [0, 'b', 0], [682.7, 'b', 680], [341.3, 't', 341], [256, 'b', 256], [426.7, 'b', 426.7],
  [170.7, 't', 171], [512, 't', 512], [85.3, 'b', 85.3], [597.3, 'b', 597.3], [0, 't', 0], [682.7, 't', 680]];

// ---------- one-time CSS for battle widgets ----------
let cssDone = false;
function injectCss() {
  if (cssDone) return;
  cssDone = true;
  el('style', { text: `
.gdf-bar { position:absolute; overflow:hidden; }
.gdf-bar > i { position:absolute; left:0; top:0; bottom:0; }
.gdf-bar > b { position:absolute; inset:0; text-align:center; font:normal ${PT(8.25)}/13px ${FONT}; color:#fff; white-space:pre; }
.gdf-opt { position:absolute; width:24px; height:33px; background:#FFC080; border:2px solid; border-color:#fff #404040 #404040 #fff;
  box-shadow: inset -1px -1px #808080; cursor:pointer; }
.gdf-opt.on { border-color:#404040 #fff #fff #404040; box-shadow: inset 1px 1px #808080; background:#ffd8a8; }
.gdf-opt img { pointer-events:none; }
.gdf-opt.on img { transform: translate(1px,1px); }
.gdf-hit { position:absolute; cursor:pointer; background:transparent; }
.gdf-vbbtn { position:absolute; background:#00C0C0; border:2px solid; border-color:#fff #404040 #404040 #fff; font:bold ${PT(8.25)} ${FONT};
  color:#000; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0; }
.gdf-vbbtn:active { border-color:#404040 #fff #fff #404040; }
.gdf-txt { position:absolute; border:2px solid; border-color:#808080 #fff #fff #808080; padding:1px 3px; margin:0; white-space:pre-wrap; overflow:hidden; }
.gdf-ennimg { position:absolute; cursor:pointer; -webkit-touch-callout:none; }
.gdf-dlg { position:absolute; background:#000080; }
.gdf-dlg .row { cursor:pointer; }
`, }, document.head);
}

// ---------- ColorBar (PBCVie / PBCMagie / PBCEnnemi) ----------
class Bar {
  constructor(parent, x, y, w, h, fill, bg = '#000') {
    this.w = w;
    this.e = box(parent, x, y, w, h, { cls: 'gdf-bar', style: { background: bg } });
    this.f = el('i', { style: { background: fill } }, this.e);
    this.t = el('b', {}, this.e);
    this.max = 100; this._v = 0;
  }
  get value() { return this._v; }
  set value(v) {
    this._v = v;
    const r = this.max > 0 ? Math.max(0, Math.min(1, v / this.max)) : 0;
    this.f.style.width = (r * this.w) + 'px';
    this.t.textContent = String(v);
  }
  set visible(b) { this.e.style.display = b ? '' : 'none'; }
}

// ---------- AniGIF replacement: steps frames of a sprite sheet with the GIF delays ----------
// read(key): load + show frame 0, stopped. play(onStep): advance; onStep(frame) fires on each new frame (AniGIF _Step).
// Every animation stops by itself on its last frame (the VB handlers all did that explicitly).
class Sprite {
  constructor(scene, parent, x, y, w, h, opts = {}) {
    this.scene = scene;
    this.bw = w; this.bh = h; this.center = !!opts.center;
    this.box = box(parent, x, y, w, h, { style: { pointerEvents: 'none', overflow: 'visible' } });
    this.inner = el('div', { style: { position: 'absolute', backgroundRepeat: 'no-repeat', display: 'none' } }, this.box);
    this.meta = null; this.f = 0; this.gen = 0; this.playing = false; this.key = null;
  }
  read(key) {
    this.stop();
    this.key = key;
    if (!key) { this.meta = null; this.inner.style.display = 'none'; return; }
    const m = ANIMS[key];
    this.meta = m;
    const s = this.inner.style;
    s.backgroundImage = `url("${sheetOf(key)}")`;
    s.width = m.w + 'px'; s.height = m.h + 'px';
    s.left = (this.center ? Math.round((this.bw - m.w) / 2) : 0) + 'px';
    s.top = (this.center ? Math.round((this.bh - m.h) / 2) : 0) + 'px';
    s.display = '';
    this.frame = 0;
  }
  get frames() { return this.meta ? this.meta.n : 0; }
  get frame() { return this.f; }
  set frame(f) {
    if (!this.meta) return;
    this.f = Math.max(0, Math.min(this.meta.n - 1, f));
    this.inner.style.backgroundPosition = `${-this.f * this.meta.w}px 0px`;
  }
  set visible(b) { this.box.style.display = b ? '' : 'none'; }
  play(onStep) {
    if (!this.meta) return;
    this.onStep = onStep;
    this.playing = true;
    this._next(++this.gen);
  }
  _next(g) {
    const d = this.meta.delays[this.f];
    this.scene.timers.after(d > 10 ? d : 100, () => {          // 0-delay frames (hero GIFs) -> 100 ms
      if (g !== this.gen || !this.playing) return;
      if (this.f >= this.meta.n - 1) { this.playing = false; return; }
      this.frame = this.f + 1;
      if (this.onStep) this.onStep(this.f);
      if (g !== this.gen || !this.playing) return;
      if (this.f >= this.meta.n - 1) { this.playing = false; return; }
      this._next(g);
    });
  }
  stop() { this.playing = false; this.gen++; }
}

// VB 3D-ish command button
function vbButton(parent, x, y, w, h, text, onClick, extra = {}) {
  const b = box(parent, x, y, w, h, { tag: 'button', cls: 'gdf-vbbtn', text, ...extra });
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}
function label(parent, x, y, w, h, text, style = {}) {
  return box(parent, x, y, w, h, { cls: 'lbl', text, style: { fontFamily: FONT, ...style } });
}
const isMouse = (e) => e.pointerType === 'mouse' || e.pointerType === 'pen';

// =====================================================================================================
export class Bataille {
  load() {
    injectCss();
    const r = this.root;
    r.style.background = '#000';
    // widgets overflow the 576 px form bottom like the original (clipped); never let the form scroll
    r.style.overflow = 'clip';
    r.addEventListener('scroll', () => { r.scrollTop = 0; r.scrollLeft = 0; });
    this.nbrHeros = G.heros.nbrHeros || 2;

    // preload the sheets so frame 0 never shows blank
    this._pre = [];
    for (let h = 1; h <= this.nbrHeros; h++) for (const p of 'aefm') this._pre.push(sheetOf(`herosbataille/${p}${h}.gif`));
    for (let h = 1; h <= this.nbrHeros; h++) this._pre.push(sheetOf(`magie/${h}.gif`));
    this._pre = this._pre.map((u) => { const i = new Image(); i.src = u; return i; });

    // ----- widgets -----
    this.imgEnnemi = []; this.lblNomEnnemi = []; this.pbcEnnemi = [];
    this.agcHero = []; this.pbcVie = []; this.pbcMagie = []; this.shpClignote = [];

    this.imgMagie = box(r, 0, 238, null, null, { tag: 'img', style: { display: 'none', pointerEvents: 'none' } });
    this.imgMagie.draggable = false;
    // enemy attack / pulled-down enemy (152x152, not transparent; oversized GIFs centred, not scaled)
    this.agcAttEnnemi = new Sprite(this, r, HERO_LEFT[1], 238, 152, 152, { center: true });
    for (let h = 1; h <= this.nbrHeros; h++) {
      const x = HERO_LEFT[h];
      this.agcHero[h] = new Sprite(this, r, x, 392, 120, 120);
      this.shpClignote[h] = box(r, x, 392, 120, 120, { style: {
        display: 'none', pointerEvents: 'none', border: '1px solid #000', borderRadius: '12px',
        background: 'repeating-linear-gradient(-45deg, transparent 0 7px, #FF0000 7px 8px)' } });
      this.pbcVie[h] = new Bar(r, x, 512, 117, 13, HP_COLOR, '#000');
      this.pbcMagie[h] = new Bar(r, x, 525, 117, 13, MP_COLOR, '#000');
    }
    this.agcMagie = new Sprite(this, r, HERO_LEFT[1], 166.7, 256, 224);
    this.agcMagie.visible = false;

    // action buttons (OptHero 1..4); hit area enlarged upward for phones
    this.optHero = [];
    const icons = [null, 'opt1_epee', 'opt2_fusil', 'opt3_magie', 'opt4_potion'];
    const tips = [null, "Attquer avec l'épée", 'Tirer avec le fusil', 'Attaquer avec la magie', 'Utiliser une potion'];
    for (let i = 1; i <= 4; i++) {
      const b = box(r, 136 + 24 * (i - 1), 554, null, null, { cls: 'gdf-opt', title: tips[i], style: { display: 'none' } });
      const clip = el('div', { style: { position: 'absolute', inset: '0', overflow: 'hidden' } }, b);
      img(clip, `ui/${icons[i]}.png`, -6, -2, 32, 32);
      const hit = box(b, -2, -26, 24, 59, { cls: 'gdf-hit', title: tips[i] });
      hit.style.zIndex = 2;
      const go = (e) => { e.preventDefault(); e.stopPropagation(); this.optClick(i); };
      b.addEventListener('pointerdown', go);
      this.optHero[i] = { e: b, on: false };
    }

    this.txtCommentaires = el('textarea', { cls: 'gdf-txt', readOnly: true, value: 'Debut de la bataille\r\n', style: {
      left: '528px', top: '512px', width: '233px', height: '81px', background: '#000', color: '#fff',
      font: `${PT(8.25)}/1.15 ${FONT}`, overflowY: 'scroll', whiteSpace: 'pre', overflowX: 'hidden' } }, r);
    this.txtCommentaires.tabIndex = -1;

    this.txtInfoEnnemi = box(r, 528, 424, 113, 89, { cls: 'gdf-txt', style: {
      display: 'none', background: '#0000FF', color: '#fff', font: `${PT(9.75)}/1.2 ${FONT}`, whiteSpace: 'pre', zIndex: 5, pointerEvents: 'none' } });

    this.imgDefaite = img(r, 'images/bataille/defaite.gif', 304, 80, 200, 65);
    this.imgDefaite.style.display = 'none';

    // Form_MouseMove: hide the info box
    r.addEventListener('pointermove', (e) => { if (e.target === r) this.hideInfo(); });
    r.addEventListener('pointerdown', () => { if (this.defaite) this.appuieButton = true; });

    // ----- Form_Load -----
    this.tag = '';
    this.heroAttaque = false;
    this.appuieButton = false;
    this.argentRecu = 0;
    this.expRecu = [0, 0, 0, 0, 0];
    this.noAtt = 0;
    this.debut = true;
    this.heroTurn = false;      // port: true only while the acting hero may choose an action
    this.selOpt = 0;
    this.enleveVie = 0;
    this.hAtt = 0; this.heroAttaque_ = 0; this.ennemiAttaque = 0;

    this.initialiseBataille();
    // TmrPause: 800 ms then 1000 ms
    this.timers.after(800, () => {
      for (let i = 1; i <= this.nbrHeros; i++) {
        if (this.tag !== 'Echappe' && this.pbcVie[i].value > 0) this.agcHero[i].play((f) => this.heroStep(i, f));
      }
      this.debut = false;
      this.timers.after(1000, () => this.enableTours());
    });
  }

  unload() {
    G.heros.endroit -= 125;
    audio.stopMusic();
  }

  // ---------------- setup ----------------
  initialiseBataille() {
    audio.playMusic('bataille', true);            // looped (author's intent; MCI Done events never fired)
    G.heros.endroit += 125;
    this.afficheDonneesHero();
    this.determineNbrEnnemis();
    this.determineLesEnnemis();
    this.creeEtMelangeTableauTours();
  }
  afficheDonneesHero() {
    for (let i = 1; i <= this.nbrHeros; i++) {
      const h = G.heros.infoHero[i];
      this.pbcVie[i].max = h.ptsVieMax; this.pbcVie[i].value = h.ptsVieActuel;
      this.pbcMagie[i].max = h.ptsMagieMax; this.pbcMagie[i].value = h.ptsMagieActuel;
      if (this.pbcVie[i].value > 0) this.agcHero[i].read(`herosbataille/a${i}.gif`);
      else { this.agcHero[i].read(`herosbataille/m${i}.gif`); this.agcHero[i].frame = 7; }
    }
  }
  determineNbrEnnemis() {
    const min = this.nbrHeros * 2, max = 2 ** this.nbrHeros + 2;
    let n;
    do { n = Int(Rnd() * 17) + 1; } while (n > max || n < min);
    this.nbrEnnemis = n;
  }
  determineLesEnnemis() {
    this.tabEnnemis = [0];
    const r = this.root;
    for (let i = 1; i <= this.nbrEnnemis; i++) {
      let id;
      do { id = Int(Rnd() * (G.heros.infoHero[1].niveau + 2)); } while (id === 0);
      id = Math.min(id, 20);                      // port: original crashed on records > 20 (hero 1 level >= 20)
      this.tabEnnemis[i] = id;
      const e = D.ennemis[id];
      const [x, row, bx] = SLOTS[i];
      const top = row === 'b' ? 153 : 34, ltop = row === 'b' ? 119 : 0, btop = row === 'b' ? 140 : 21;
      const lbl = label(r, x, ltop, 85, 21, padName(e.nom, 15), { textAlign: 'center', color: '#fff', fontSize: PT(8.25), lineHeight: '14px' });
      const bar = new Bar(r, bx, btop, 85, 13, HP_COLOR, '#000');
      bar.max = e.ptvMax; bar.value = e.ptvActuel;
      const im = img(r, f0Of(e.img), x, top, 85, 85, { cls: 'gdf-ennimg' });
      this.lblNomEnnemi[i] = lbl; this.pbcEnnemi[i] = bar; this.imgEnnemi[i] = im;
      lbl.addEventListener('pointermove', () => this.hideInfo());
      bar.e.addEventListener('pointermove', () => this.hideInfo());
      this.wireEnemy(i, im);
    }
  }
  wireEnemy(i, im) {
    let lp = null, longPressed = false;
    im.addEventListener('pointermove', (e) => { if (isMouse(e)) this.showInfo(i); });
    im.addEventListener('pointerup', (e) => { this.hideInfo(); if (lp) { lp.stop(); lp = null; } if (!isMouse(e) && longPressed) e.preventDefault(); });
    im.addEventListener('pointerdown', (e) => {
      longPressed = false;
      if (!isMouse(e)) lp = this.timers.after(450, () => { lp = null; longPressed = true; this.showInfo(i); });
    });
    im.addEventListener('pointercancel', () => { if (lp) { lp.stop(); lp = null; } this.hideInfo(); });
    im.addEventListener('contextmenu', (e) => e.preventDefault());
    im.addEventListener('click', (e) => {
      e.stopPropagation();
      if (longPressed) { longPressed = false; return; }
      this.imgEnnemiClick(i);
    });
  }
  creeEtMelangeTableauTours() {
    const N = this.nbrEnnemis, H = this.nbrHeros, U = N + 2 * H;
    const t = new Array(U + 1).fill(0);
    for (let i = 1; i <= N; i++) t[i] = i;
    for (let i = 1 + N; i <= H + N; i++) t[i] = i - N + 90;
    for (let i = 1 + N + H; i <= H * 2 + N; i++) t[i] = i - (N + H) + 90;
    for (let i = 1; i <= U; i++) {                 // naive biased shuffle, as original
      const j = Int(Rnd() * U) + 1;
      const tmp = t[i]; t[i] = t[j]; t[j] = tmp;
    }
    this.tabTours = t;
  }

  // ---------------- enemy info box ----------------
  showInfo(i) {
    if (this.imgEnnemi[i].style.display === 'none') return;
    const e = D.ennemis[this.tabEnnemis[i]];
    this.txtInfoEnnemi.textContent = padName(e.nom, 15) + '\n' + 'PtsVie--: ' + e.ptvMax + '\n' + 'Attaque-: ' + e.attaque +
      '\n' + 'Defence-: ' + e.defence + '\n' + '$$$$$$--: ' + e.argent;
    const [x, row] = SLOTS[i];
    this.txtInfoEnnemi.style.left = (x + 85.333) + 'px';
    this.txtInfoEnnemi.style.top = (row === 'b' ? 153 : 34) + 'px';
    this.txtInfoEnnemi.style.display = '';
  }
  hideInfo() { this.txtInfoEnnemi.style.display = 'none'; }

  // ---------------- comments ----------------
  comment(quel) {
    const hn = (h) => G.heros.infoHero[h].nom;
    const en = (slot) => padName(D.ennemis[this.tabEnnemis[slot]].nom, 15);
    let s = '';
    switch (quel) {
      case 'EnnAtt': s = padName(this.dEnnemis.nom, 15) + ' attaque ' + hn(this.heroAttaque_); break;
      case 'HeroAtt': s = hn(this.hAtt) + ' attaque ' + en(this.ennemiAttaque); break;
      case 'HeroMort': s = hn(this.heroAttaque_) + ' est mort'; break;
      case 'EnnMort': s = en(this.ennemiAttaque) + ' est mort'; this.argentRecu += D.ennemis[this.tabEnnemis[this.ennemiAttaque]].argent; break;
      case 'HeroTouche': s = hn(this.heroAttaque_) + ' a perdu ' + this.enleveVie + ' points de vie'; break;
      case 'EnnemiTouche': s = hn(this.hAtt) + ' a enlevé ' + this.enleveVie + ' points de vie'; break;
      case 'EnnManque': s = hn(this.heroAttaque_) + " s'est protégé de l'attaque"; break;
      case 'HeroManque': s = en(this.ennemiAttaque) + " s'est protégé de l'attaque"; break;
      case 'TousMort': s = 'VOUS ÊTES TOUS MORT!'; break;
      case 'AttMagie': s = hn(this.hAtt) + ' a enlevé ' + (this.magieChoisie * 3) + ' points de vie'; break;
    }
    const t = this.txtCommentaires;
    t.value += s + '\r\n';
    t.scrollTop = t.scrollHeight;
  }

  // ---------------- scheduler (TmrTours, 100 ms one-shot) ----------------
  enableTours() {
    if (this.toursPending || this.finished) return;
    this.toursPending = true;
    this.timers.after(100, () => { this.toursPending = false; this.tmrTours(); });
  }
  tmrTours() {
    if (this.finished) return;
    const U = 2 * this.nbrHeros + this.nbrEnnemis;
    for (let guard = 0; guard <= U + 1; guard++) {
      this.noAtt += 1;
      if (this.noAtt > U) this.noAtt = 1;
      let ennVivant = false, heroVivant = false;
      for (let i = 1; i <= U; i++) {
        const a = this.tabTours[i];
        if (a < 90) { if (this.pbcEnnemi[a].value > 0) ennVivant = true; }
        else if (this.pbcVie[a - 90].value > 0) heroVivant = true;
      }
      if (!ennVivant) { this.victoire(); return; }
      if (!heroVivant) { this.defaiteFn(); return; }
      const a = this.tabTours[this.noAtt];
      if (a > 90) {
        if (this.pbcVie[a - 90].value === 0) continue;
        this.attaqueHero(a - 90);
      } else {
        if (this.pbcEnnemi[a].value === 0) continue;
        this.attaqueEnnemi(a);
      }
      return;
    }
  }

  // ---------------- hero turn ----------------
  attaqueHero(noHero) {
    for (let i = 1; i <= 4; i++) {
      const o = this.optHero[i];
      o.e.style.left = (HERO_LEFT[noHero] + 24 * (i - 1)) + 'px';
      o.e.style.display = '';
      this.setOpt(i, false);
    }
    if (this.pbcMagie[noHero].value === 0) this.optHero[MAGIE].e.style.display = 'none';
    let t = false;
    for (let i = 1; i <= 10; i++) if (G.heros.potions[i] > 0) t = true;
    if (!t) this.optHero[POTION].e.style.display = 'none';
    t = false;
    for (let i = 11; i <= 15; i++) if (G.heros.munition[i] > 0) t = true;
    if (!t) this.optHero[FUSIL].e.style.display = 'none';
    this.heroAttaque = true;
    this.agcAttEnnemi.box.style.left = HERO_LEFT[noHero] + 'px';
    this.agcMagie.box.style.left = HERO_LEFT[noHero] + 'px';
    this.imgMagie.style.left = HERO_LEFT[noHero] + 'px';
    this.hAtt = this.tabTours[this.noAtt] - 90;
    this.selOpt = 0;
    this.heroTurn = true;
  }
  setOpt(i, on) { this.optHero[i].on = on; this.optHero[i].e.classList.toggle('on', on); }
  hideOpts() {   // ActionAccomplie (port: used for every action)
    for (let i = 1; i <= 4; i++) { this.optHero[i].e.style.display = 'none'; this.setOpt(i, false); }
    this.selOpt = 0;
    this.heroTurn = false;
  }
  async optClick(i) {
    if (!this.heroTurn || this.busy) return;
    if (i !== POTION) {                              // graphical OptionButton group: select
      for (let k = 1; k <= 4; k++) this.setOpt(k, k === i);
      this.selOpt = i;
      return;
    }
    // Potion: immediate
    this.setOpt(POTION, true);
    this.busy = true;
    const slot = await show(new ChoixPotion());
    this.busy = false;
    this.setOpt(POTION, false);
    const h = this.hAtt;
    if (slot !== 0) {
      const p = D.potions[G.heros.potions[slot]];
      if (p.categorie === 1) {
        this.pbcVie[h].value = Math.min(this.pbcVie[h].value + p.force, this.pbcVie[h].max);
      } else {
        this.pbcMagie[h].value = Math.min(this.pbcMagie[h].value + p.force, this.pbcMagie[h].max);
      }
      G.heros.potions[slot] = 0;
    }
    this.hideOpts();
    this.enableTours();
  }

  async imgEnnemiClick(index) {
    if (!this.heroTurn || this.busy || !this.selOpt) return;
    if (this.imgEnnemi[index].style.display === 'none') return;
    const h = this.hAtt;
    const opt = this.selOpt;
    this.hideOpts();                                  // port: no out-of-turn attacks
    if (opt === EPEE) {
      this.tag = 'Epee';
      this.ennemiAttaque = index;
      this.comment('HeroAtt');
      this.agcAttEnnemi.read(D.ennemis[this.tabEnnemis[index]].img);
      this.agcHero[h].read(`herosbataille/e${h}.gif`);
      this.imgEnnemi[index].style.display = 'none';
      audio.sfx('epee', 'effets');
      this.agcHero[h].play((f) => this.heroStep(h, f));
    } else if (opt === FUSIL) {
      this.tag = 'Fusil';
      this.ennemiAttaque = index;
      this.busy = true;
      this.ammoChoisie = await show(new ChoixAmmo());
      this.busy = false;
      G.heros.munition[this.ammoChoisie + 10] -= 1;
      this.agcAttEnnemi.read(D.ennemis[this.tabEnnemis[index]].img);
      this.agcHero[h].read(`herosbataille/f${h}.gif`);
      this.imgEnnemi[index].style.display = 'none';
      audio.sfx('tirer', 'effets');
      this.agcHero[h].play((f) => this.heroStep(h, f));
    } else if (opt === MAGIE) {
      this.ennemiAttaque = index;
      this.imgEnnemi[index].style.display = 'none';
      this.imgMagie.src = A(f0Of(D.ennemis[this.tabEnnemis[index]].img));
      this.imgMagie.style.display = '';
      this.busy = true;
      this.magieChoisie = await show(new ChoixMagie(), this.pbcMagie[h].value);
      this.busy = false;
      this.agcMagie.read(`magie/${h}.gif`);
      this.agcMagie.visible = true;
      this.agcMagie.play((f) => this.magieStep(f));
      audio.sfx('thunder', 'effets');
    }
  }

  // ---------------- damage / xp ----------------
  determineDommage(sorte) {
    const en = D.ennemis[this.tabEnnemis[this.ennemiAttaque]];
    const h = G.heros.infoHero[this.hAtt];
    let d;
    if (sorte === EPEE) d = Int(Rnd() * ((h.attaque + calculeAttaque(this.hAtt)) - en.defence / 2) + 1);
    else d = Int(Rnd() * ((h.attaque + calculeAttaque(this.hAtt) + D.potions[this.ammoChoisie + 10].force) - en.defence / 5) + 1);
    if (d <= 0) d = 1;
    this.enleveVie = d;
    return d;
  }
  calculeExperience(avecQuoi, tueOuFrappe, hero) {
    const no = D.ennemis[this.tabEnnemis[this.ennemiAttaque]].no;
    const niv = G.heros.infoHero[hero].niveau;
    const c = no < niv ? 0 : no === niv ? 1 : 2;
    let x;
    if (avecQuoi !== 'Magie') {
      if (tueOuFrappe === 'Frappe') x = Int(Rnd() * 3 + [1, 3, 5][c]);
      else x = Int(Rnd() * [4, 6, 7][c] + [6, 8, 11][c]);
    } else {
      const P = this.magieChoisie;
      const add = [P / 3, P / 2, P][c];
      if (tueOuFrappe === 'Frappe') x = Int(Rnd() * 3 + add);
      else x = Int(Rnd() * [5, 6, 7][c] + add);
    }
    this.expRecu[hero] += x;
  }

  // ---------------- AGCHero_Step ----------------
  heroStep(index, frame) {
    const spr = this.agcHero[index];
    const strike = (sorte, killFrame, name) => {
      if ((Rnd() * 100) + 1 > PCT_HERO_FRAPPE) {
        const bar = this.pbcEnnemi[this.ennemiAttaque];
        bar.value = bar.value - this.determineDommage(sorte);
        this.comment('EnnemiTouche');
        this.calculeExperience(name, 'Frappe', index);
        if (bar.value <= 0) {
          bar.value = 0;
          this.comment('EnnMort');
          spr.frame = killFrame;
          this.calculeExperience(name, 'Tue', index);
        }
      } else this.comment('HeroManque');
    };
    switch (this.tag) {
      case 'Epee': if (frame === 4 || frame === 8) strike(EPEE, 10, 'Epee'); break;
      case 'Fusil': if ([2, 4, 6, 8, 10].includes(frame)) strike(FUSIL, 11, 'Fusil'); break;
      case 'Mort':
        if (spr.frame === 7) {
          this.imgEnnemi[this.tabTours[this.noAtt]].style.display = '';
          this.agcAttEnnemi.read(null);
        }
        break;
    }
    if (spr.frame === spr.frames - 1) {
      spr.stop();
      if (this.tag === 'Mort') this.enableTours();
      if (this.heroAttaque) {
        this.heroAttaque = false;
        this.agcAttEnnemi.read(null);
        const s = this.ennemiAttaque;
        if (s && this.pbcEnnemi[s] && this.pbcEnnemi[s].value > 0) this.imgEnnemi[s].style.display = '';
        this.enableTours();
      }
    }
  }

  // ---------------- AGCMagie_Step ----------------
  magieStep(frame) {
    const bar = this.pbcEnnemi[this.ennemiAttaque];
    if (frame === 8) {
      bar.value = bar.value - this.magieChoisie * 3;
      this.comment('AttMagie');
      this.pbcMagie[this.hAtt].value = this.pbcMagie[this.hAtt].value - this.magieChoisie;
      this.calculeExperience('Magie', 'Frappe', this.hAtt);
      if (bar.value <= 0) {
        bar.value = 0;
        this.comment('EnnMort');
        this.calculeExperience('Magie', 'Tue', this.hAtt);
      }
    }
    if (frame === this.agcMagie.frames - 1) {
      this.agcMagie.stop();
      this.agcMagie.visible = false;
      this.imgMagie.style.display = 'none';
      if (bar.value > 0) this.imgEnnemi[this.ennemiAttaque].style.display = '';
      this.enableTours();
    }
  }

  // ---------------- enemy turn ----------------
  attaqueEnnemi(no) {
    this.dEnnemis = D.ennemis[this.tabEnnemis[no]];
    this.agcAttEnnemi.read(this.dEnnemis.img);
    this.imgEnnemi[no].style.display = 'none';
    let h;
    do { h = Int(Rnd() * this.nbrHeros + 1); } while (this.pbcVie[h].value <= 0);
    this.heroAttaque_ = h;
    this.agcAttEnnemi.box.style.left = HERO_LEFT[h] + 'px';
    this.agcAttEnnemi.play((f) => this.attEnnemiStep(f));
    this.comment('EnnAtt');
  }
  calculePtsEnnEnleve() {
    const e = this.dEnnemis, h = this.heroAttaque_;
    return Int(Rnd() * (e.attaque - (G.heros.infoHero[h].defence + calculeDefence(h))) / e.nbTouche + 1);
  }
  attEnnemiStep(frame) {
    const h = this.heroAttaque_, e = this.dEnnemis, spr = this.agcAttEnnemi;
    this.enleveVie = this.calculePtsEnnEnleve();
    if (this.enleveVie <= 0) this.enleveVie = 1;
    for (let k = 1; k <= 3; k++) {
      if (frame === e.touche[k] - 1) {
        if (Int(Rnd() * 100 + 1) > 66) this.comment('EnnManque');      // EviteAttaque: 34 %
        else {
          this.shpClignote[h].style.display = '';
          this.pbcVie[h].value = this.pbcVie[h].value - this.enleveVie;
          this.comment('HeroTouche');
          if (this.pbcVie[h].value <= 0) {
            this.pbcVie[h].value = 0;
            spr.stop();
            this.shpClignote[h].style.display = 'none';
            this.mort(h);
            return;
          }
        }
      }
      if (frame === e.touche[k]) {
        this.shpClignote[h].style.display = 'none';
        this.agcHero[h].read(`herosbataille/m${h}.gif`);     // static hurt pose, even when dodged
      }
    }
    if (frame === spr.frames - 1) {
      spr.stop();
      spr.read(null);
      this.imgEnnemi[this.tabTours[this.noAtt]].style.display = '';
      this.enableTours();
    }
  }
  mort(h) {
    this.comment('HeroMort');
    this.tag = 'Mort';
    this.agcHero[h].read(`herosbataille/m${h}.gif`);
    this.agcHero[h].play((f) => this.heroStep(h, f));
    audio.sfx('mort', 'effets');
    G.heros.infoHero[h].ptsVieActuel = 0;
  }

  // ---------------- end of battle ----------------
  async victoire() {
    this.finished = true;
    audio.playMusic('victoire', false);
    for (let i = 1; i <= this.nbrHeros; i++) {
      G.heros.infoHero[i].ptsVieActuel = this.pbcVie[i].value;
      G.heros.infoHero[i].ptsMagieActuel = this.pbcMagie[i].value;
    }
    await show(new StatsBataille(), this.expRecu, this.argentRecu);
    close(this, 'victoire');
  }
  defaiteFn() {
    this.finished = true;
    audio.playMusic('defaite', false);
    this.comment('TousMort');
    for (let i = 1; i <= this.nbrEnnemis; i++) {
      this.pbcEnnemi[i].visible = false; this.imgEnnemi[i].style.display = 'none'; this.lblNomEnnemi[i].style.display = 'none';
    }
    for (let i = 1; i <= this.nbrHeros; i++) {
      this.pbcVie[i].visible = false; this.pbcMagie[i].visible = false; this.agcHero[i].visible = false;
    }
    this.hideOpts();
    this.hideInfo();
    this.txtCommentaires.style.display = 'none';
    this.imgDefaite.style.display = '';
    this.root.style.background = `#000 url("${A('images/bataille/mort.jpg')}") 0 0 / 768px 576px no-repeat`;
    this.defaite = true;
    this.appuieButton = false;
    // TmrMort: polls every 3 s for a key press (port: or a tap/click)
    this.timers.every(3000, () => { if (this.appuieButton) close(this, 'defaite'); });
  }
  keydown() {
    if (this.defaite) this.appuieButton = true;
  }
}

// =====================================================================================================
// FrmStatsBataille: money counter, experience, level up
let PTV = 0, DEF = 0, ATQ = 0, PTM = 0;   // module-level like the VB form (heroes 3/4 reuse them)
export class StatsBataille {
  load(expRecu, argentRecu) {
    injectCss();
    const r = this.root;
    r.style.background = '#000080';
    const nb = G.heros.nbrHeros || 2;
    // thick dark bars (Line, BorderWidth 85, round caps)
    for (const x of [40, 728]) box(r, x - 42.5, 40 - 42.5, 85, 512 + 85, { style: { background: '#400000', borderRadius: '42.5px' } });
    label(r, 112, 16, 561, 41, 'VICTOIRE', { textAlign: 'center', color: '#C04000', font: `bold ${PT(24)}/41px "Monotype Corsiva", "URW Chancery L", "Apple Chancery", cursive` });
    const big = { fontSize: PT(18), lineHeight: '30px' };
    label(r, 88, 64, 145, 41, 'Argent', { ...big, color: '#00C000' });
    box(r, 88, 96, 80, 1, { style: { background: '#00C000' } });
    label(r, 168, 104, 217, 41, 'Argent Recu', { ...big, color: '#FF80FF' });
    const lblArgent2 = label(r, 448, 104, 113, 41, '0', { ...big, color: '#C0C000', textAlign: 'right' });
    label(r, 168, 144, 217, 41, 'Argent Total', { ...big, color: '#FF80FF' });
    const lblATotE = label(r, 448, 144, 113, 41, '0', { ...big, color: '#C0C000', textAlign: 'right' });
    label(r, 88, 184, 145, 41, 'Experience', { ...big, color: '#00C000' });
    box(r, 88, 216, 128, 1, { style: { background: '#00C000' } });
    const hdr = { fontSize: PT(12), fontWeight: 'bold', color: '#00C000', lineHeight: '20px' };
    label(r, 96, 232, 121, 25, 'Hero', hdr);
    label(r, 224, 232, 73, 25, 'Niveau', { ...hdr, textAlign: 'center' });
    label(r, 304, 232, 49, 25, 'Exp', { ...hdr, textAlign: 'center' });
    label(r, 360, 232, 57, 25, 'Recu', { ...hdr, textAlign: 'center' });
    label(r, 424, 232, 57, 25, 'Total', { ...hdr, textAlign: 'center' });
    const lvlHdr = ['PTV', 'PTM', 'ATQ', 'DEF'].map((t, k) => {
      const l = label(r, 488 + 48 * k, 232, 41, 25, t, { ...hdr, textAlign: 'center' });
      l.style.display = 'none';
      return l;
    });
    const row = { fontSize: PT(12), fontWeight: 'bold', lineHeight: '17px', color: '#FF80FF' };
    const rowR = { ...row, textAlign: 'right' };

    this.argentRecu = argentRecu;
    this.argent = G.heros.argent;
    this.lblATot = G.heros.argent;
    lblATotE.textContent = String(this.lblATot);
    const niveauPlus = [false, false, false, false, false];
    const blink = [];
    for (let j = 1; j <= nb; j++) {
      const h = G.heros.infoHero[j];
      const y = 280 + 24 * (j - 1);
      label(r, 96, y, 121, 17, h.nom, row);
      label(r, 304, y, 49, 17, String(h.experience), rowR);
      label(r, 360, y, 57, 17, String(expRecu[j]), rowR);
      h.experience += expRecu[j];
      label(r, 424, y, 57, 17, String(h.experience), rowR);
      const red = { ...rowR, color: '#FF0000' };
      const lv = [];
      if (h.experience > h.niveau * 250) {
        h.niveau += 1;
        niveauPlus[j] = true;
        for (const l of lvlHdr) l.style.display = '';
        if (j === 1) { PTV = Int(Rnd() * 4 + 1); DEF = Int(Rnd() * 2 + 1); ATQ = Int(Rnd() * 3 + 1); PTM = Int(Rnd() * 2 + 1); }
        else if (j === 2) { PTV = Int(Rnd() * 2 + 1); DEF = Int(Rnd() * 4 + 1); ATQ = Int(Rnd() * 2 + 1); PTM = Int(Rnd() * 3 + 1); }
        h.attaque += ATQ; h.defence += DEF; h.ptsMagieMax += PTM; h.ptsVieMax += PTV;
        lv.push(label(r, 488, y, 41, 17, '+ ' + PTV, red), label(r, 536, y, 41, 17, '+ ' + PTM, red),
          label(r, 584, y, 41, 17, '+ ' + ATQ, red), label(r, 632, y, 41, 17, '+ ' + DEF, red));
      }
      const lblNiv = label(r, 224, y, 73, 17, String(h.niveau), rowR);
      if (niveauPlus[j]) blink.push([lblNiv, ...lv]);
    }
    // TmrClignote 250 ms: red <-> blue
    let isRed = false;
    this.timers.every(250, () => {
      isRed = !isRed;
      for (const ls of blink) for (const l of ls) l.style.color = isRed ? '#FF0000' : '#0000FF';
    });
    // OK button, hidden until the count is done
    this.ok = vbButton(r, 352, 536, 89, 33, 'OK', () => this.fin(), { style: { display: 'none', fontWeight: 'normal' } });
    // TmrArgent (Interval 1 -> one OS timer tick, ~16 ms): +5 per tick
    let i = 0;
    const t = this.timers.every(16, () => {
      i += 5;
      if (i <= this.argentRecu) {
        lblArgent2.textContent = String(i);
        this.lblATot = this.argent + i;
        lblATotE.textContent = String(this.lblATot);
      } else {
        this.ok.style.display = '';
        t.stop();
      }
    });
  }
  keydown(key) {
    if ((key === 'Enter' || key === ' ') && this.ok.style.display !== 'none') this.fin();
  }
  fin() {
    if (this.done) return;
    this.done = true;
    G.heros.argent = this.lblATot;    // Form_Unload: money credited = displayed total
    close(this);
  }
}

// =====================================================================================================
// Dialogs: borderless navy forms centred on the battle form, 5 px black frame (Shape1, default BorderColor)
function dialog(scene, w, h) {
  const r = scene.root;
  r.addEventListener('pointerdown', (e) => e.stopPropagation());
  const d = box(r, Math.round((768 - w) / 2), Math.round((576 - h) / 2), w, h, { cls: 'gdf-dlg' });
  box(d, 2, 2, w - 4, h - 4, { style: { border: '5px solid #000', pointerEvents: 'none' } });
  return d;
}

// FrmChoixAmmo: no cancel; resolves AmmoChoisie 1..5
export class ChoixAmmo {
  load() {
    injectCss();
    const d = dialog(this, 290, 222);
    label(d, 8, 8, 273, 33, 'Choissisez les munitions a utiliser', { fontSize: PT(12), fontWeight: 'bold', color: '#FF80FF', whiteSpace: 'normal' });
    const ys = [null, 48, 80, 112, 144, 176];
    for (let k = 1; k <= 5; k++) {
      const q = G.heros.munition[k + 10];
      if (!(q > 0)) continue;
      const p = D.potions[k + 10];
      const st = { fontSize: PT(13.5), color: '#00C000', lineHeight: '22px' };
      const row = box(d, 16, ys[k] - 2, 250, 32, { cls: 'row' });
      img(row, p.img, 8, 2, 28, 28);
      label(row, 48, 2, 145, 28, p.nomRaw || padName(p.nom, 15), st);
      label(row, 200, 2, 41, 28, String(q), { ...st, textAlign: 'right' });
      row.addEventListener('click', () => close(this, k));
    }
  }
}

// FrmChoixPotion: resolves slot 1..10, or 0 on Annuler
export class ChoixPotion {
  load() {
    injectCss();
    const d = dialog(this, 449, 237);
    label(d, 96, 8, 273, 25, 'Choissisez la potion a utiliser', { fontSize: PT(12), fontWeight: 'bold', color: '#FF80FF' });
    for (let i = 1; i <= 10; i++) {
      const rec = G.heros.potions[i];
      if (!rec) continue;
      const p = D.potions[rec];
      const y = 40 + 32 * ((i - 1) % 5);
      const x = i <= 5 ? 8 : 216;
      const row = box(d, x, y - 2, 204, 32, { cls: 'row' });
      img(row, p.img, 0, 2, 28, 28);
      label(row, 32, 2, 167, 28, (p.nomRaw || padName(p.nom, 15)) + ' +' + p.force, { fontSize: PT(13.5), color: '#00C000', lineHeight: '22px' });
      row.addEventListener('click', () => close(this, i));
    }
    vbButton(d, 160, 208, 121, 17, 'Annuler', () => close(this, 0), { style: { fontWeight: 'normal' } });
  }
  keydown(key) { if (key === 'Escape') close(this, 0); }
}

// FrmChoixMagie: power 1..current MP (vertical scrollbar, down arrow increases); no cancel
export class ChoixMagie {
  load(maxMP) {
    injectCss();
    this.max = Math.max(1, maxMP);
    this.v = 1;
    const d = dialog(this, 389, 152);
    label(d, 0, 8, 393, 25, 'Choissisez la puissance de la magie', { textAlign: 'center', fontSize: PT(12), fontWeight: 'bold', color: '#FF80FF' });
    this.lbl = label(d, 104, 64, 57, 33, '1', { textAlign: 'right', font: `bold ${PT(24)}/33px ${FONT}`, color: '#C0C000' });
    // scrollbar 17x33 at (176,64): up arrow / thumb track / down arrow
    const sb = box(d, 176, 64, 17, 33, { style: { background: '#e0e0e0' } });
    const arrow = (y, ch) => box(sb, 0, y, 17, 16, { text: ch, style: {
      background: '#c0c0c0', border: '1px solid', borderColor: '#fff #404040 #404040 #fff', font: `8px/14px ${FONT}`,
      color: '#000', textAlign: 'center' } });
    arrow(0, '▲'); arrow(17, '▼');
    // enlarged hit areas (phones) around the tiny arrows
    const up = box(d, 162, 50, 37, 30, { cls: 'gdf-hit' });
    const dn = box(d, 162, 81, 37, 30, { cls: 'gdf-hit' });
    up.addEventListener('click', () => this.set(this.v - 1));
    dn.addEventListener('click', () => this.set(this.v + 1));
    vbButton(d, 200, 64, 73, 17, 'Minimum', () => this.set(1));
    vbButton(d, 200, 80, 73, 17, 'Maximum', () => this.set(this.max));
    vbButton(d, 128, 112, 121, 25, 'Frapper', () => close(this, this.v));
  }
  set(v) { this.v = Math.max(1, Math.min(this.max, v)); this.lbl.textContent = String(this.v); }
  keydown(key) {
    if (key === 'ArrowDown' || key === 'ArrowRight') this.set(this.v + 1);
    else if (key === 'ArrowUp' || key === 'ArrowLeft') this.set(this.v - 1);
    else if (key === 'Enter') close(this, this.v);
  }
}
