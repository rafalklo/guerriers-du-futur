// FrmStats: status screen. show(new Stats()) from the town or the map; closes with "Fermer" (or Esc / S).
import { box, img, close } from '../core.js';
import { G, D, calculeAttaque, calculeDefence } from '../state.js';
import { font, label, vbText, NL } from './formui.js';

const TXT = '#ffc080';

export class Stats {
  load() {
    const r = this.root;
    const H = G.heros;
    r.style.background = '#000080';
    const shape = (x, y, w, h, opaque) => box(r, x, y, w, h, { style: { border: '5px solid #804000', borderRadius: '14px',
      background: opaque ? '#c0c0c0' : 'transparent' } });
    const titre = (x, y, w, h, t) => label(r, x, y, w, h, t, { font: font(13.5, 'ms', true), color: TXT, textAlign: 'center' });

    shape(4, 4, 249, 89, true);
    let endroit = '';
    if (H.endroit === 0) endroit = 'Carte Du Monde';
    else if (H.endroit === 125) endroit = 'Carte Du Monde (Bataille)';
    else if (H.endroit >= 1 && H.endroit <= 10 && D.villes[H.endroit]) endroit = 'Ville De ' + D.villes[H.endroit].nomRaw;
    label(r, 256, 8, 505, 49, endroit, { font: font(24, 'book', true, true), color: '#c0c000', textAlign: 'center' });
    titre(496, 56, 177, 25, 'Portrait');
    shape(513, 88, 151, 161, true);
    titre(104, 104, 177, 25, 'Statistiques');
    shape(16, 136, 169, 177);
    shape(184, 136, 169, 177);
    titre(512, 264, 177, 25, 'Équipement');
    shape(448, 296, 273, 273, true);
    titre(24, 328, 105, 25, 'Ammo');
    titre(192, 328, 105, 25, 'Potions');
    shape(8, 360, 121, 216);
    shape(136, 360, 217, 97);
    shape(136, 472, 217, 97);

    // portraits: ImgHero(1) big (disabled), ImgHero(2..4) small
    this.ordre = [0, 1, 2, 3, 4];
    this.sel = 1;
    const pos = [null, [529, 104, 120, 133], [20, 16, 60, 66], [103, 16, 60, 66], [180, 16, 60, 66]];
    this.imgHero = [null];
    for (let i = 1; i <= 4; i++) {
      const e = img(r, 'images/stats/1.png', ...pos[i]);
      e.style.display = i <= H.nbrHeros ? '' : 'none';
      if (i > 1) { e.style.cursor = 'pointer'; e.addEventListener('click', () => this.clickHero(i)); }
      this.imgHero.push(e);
    }

    const b11 = { font: font(11.25, 'book', true), color: TXT, whiteSpace: 'pre' };
    this.lblNom = label(r, 32, 152, 137, 25, '', { font: font(14.25, 'book', true), color: '#ff0000', textAlign: 'center' });
    label(r, 24, 192, 81, 105, ['NIVEAU', 'VIE', 'ATTAQUE'].join(NL + NL), b11);
    this.stats0 = label(r, 112, 192, 65, 105, '', { ...b11, textAlign: 'right' });
    label(r, 192, 152, 81, 145, ['AGE', 'EXP', 'MAGIE', 'DEFENCE'].join(NL + NL), b11);
    this.stats1 = label(r, 280, 152, 65, 145, '', { ...b11, textAlign: 'right' });

    // equipment (native size)
    const eq = (x, y) => { const e = box(r, x, y, null, null, { tag: 'img' }); e.draggable = false; return e; };
    this.imgHeaume = eq(560, 328);
    this.imgArme = eq(480, 408);
    this.imgBouclier = eq(640, 408);
    this.imgArmure = eq(560, 440);

    // ammo (built once, like the original)
    const b12 = { font: font(12, 'book', true), color: TXT, whiteSpace: 'pre', textAlign: 'right' };
    let ammo = '';
    for (let i = 11; i <= 15; i++) {
      img(r, D.potions[i].img, 40, 376 + (i - 11) * 40, 28, 28);
      ammo += (H.munition[i] || 0) + NL + NL;
    }
    label(r, 72, 376, 33, 193, ammo, { ...b12, lineHeight: '20px' });

    // potions (double-click / double-tap uses it on the selected hero)
    this.imgPotion = [null];
    for (let i = 1; i <= 10; i++) {
      const e = box(r, 152 + ((i - 1) % 5) * 40, i <= 5 ? 376 : 416, null, null, { tag: 'img', style: { display: 'none', cursor: 'pointer' } });
      e.draggable = false;
      e.addEventListener('dblclick', () => this.utilisePotion(i));
      let last = 0;
      e.addEventListener('pointerup', (ev) => {
        if (ev.pointerType === 'mouse') return; // mouse uses the native dblclick
        const now = Date.now();
        if (now - last < 400) { last = 0; this.utilisePotion(i); } else last = now;
      });
      this.imgPotion.push(e);
      if (H.potions[i] > 0) {
        const p = D.potions[H.potions[i]];
        e.src = 'assets/' + p.img;
        e.title = (p.nomRaw || p.nom) + '+ ' + p.force;
        e.style.display = '';
      }
    }

    label(r, 144, 488, 97, 65, 'ARGENT :' + NL + NL + 'TEMPS :', b12);
    this.txtArgent = label(r, 240, 488, 105, 65, '', b12);
    this.afficheArgent();
    this.timers.every(1000, () => this.afficheArgent());

    const f = box(r, 360, 544, 81, 25, { tag: 'button', text: 'Fermer', style: { background: '#8080ff', color: '#000',
      font: font(8), border: '2px outset #c0c0ff', padding: '0', cursor: 'pointer' } });
    f.addEventListener('click', () => this.fermer());

    this.affichePortraits();
    this.afficheStatsHero();
  }

  afficheArgent() { this.txtArgent.textContent = vbText(G.heros.argent + ' $' + NL + NL + G.temps.str); }

  affichePortraits() {
    for (let i = 1; i <= G.heros.nbrHeros; i++) this.imgHero[i].src = `assets/images/stats/${this.ordre[i]}.png`;
  }
  clickHero(i) {
    const t = this.ordre[1]; this.ordre[1] = this.ordre[i]; this.ordre[i] = t;
    this.sel = this.ordre[1];
    this.affichePortraits();
    this.afficheStatsHero();
  }

  afficheStatsHero() {
    const h = G.heros.infoHero[this.sel];
    const set = (e, id, tab, f) => {
      if (id !== 0) { const x = tab[id]; e.src = 'assets/' + x.img; e.title = x.nom + ' + ' + x[f]; e.style.display = ''; }
      else { e.removeAttribute('src'); e.title = ''; e.style.display = 'none'; }
    };
    // tooltip names: VB fixed-length strings (Armes 17, Heaumes 15, Armures 21, Boucliers 15)
    set(this.imgArme, h.arme, padTab(D.armes, 17), 'attaque');
    set(this.imgHeaume, h.heaume, padTab(D.heaumes, 15), 'defence');
    set(this.imgArmure, h.armure, padTab(D.armures, 21), 'defence');
    set(this.imgBouclier, h.bouclier, padTab(D.boucliers, 15), 'defence');
    this.lblNom.textContent = h.nom;
    this.reAfficherDonnes();
  }
  reAfficherDonnes() {
    const s = this.sel, h = G.heros.infoHero[s];
    this.stats0.textContent = vbText([h.niveau, h.ptsVieActuel + ' / ' + h.ptsVieMax, h.attaque + calculeAttaque(s)].join(NL + NL));
    this.stats1.textContent = vbText([h.age, h.experience, h.ptsMagieActuel + ' / ' + h.ptsMagieMax, h.defence + calculeDefence(s)].join(NL + NL));
  }

  utilisePotion(i) {
    const H = G.heros, id = H.potions[i];
    if (!id) return;
    const p = D.potions[id], h = H.infoHero[this.sel];
    if (p.categorie === 1) h.ptsVieActuel = Math.min(h.ptsVieActuel + p.force, h.ptsVieMax);
    else h.ptsMagieActuel = Math.min(h.ptsMagieActuel + p.force, h.ptsMagieMax);
    H.potions[i] = 0;
    this.imgPotion[i].style.display = 'none';
    this.reAfficherDonnes();
  }

  fermer() {
    // FrmBataille.TmrTours re-enable (Endroit 125) is handled by the battle scene when show() resolves
    close(this);
  }
  keydown(key, e) {
    if (e && e.repeat) return;
    if (key === 'Escape' || key === 's' || key === 'S') this.fermer();
  }
}

const padCache = new Map();
function padTab(tab, n) {
  if (!padCache.has(tab)) padCache.set(tab, tab.map((x) => (x ? { ...x, nom: (x.nom + ' '.repeat(n)).slice(0, n) } : x)));
  return padCache.get(tab);
}
