// FrmMap2.frm (runtime name FrmMap): the world map. 16x12 viewport of 48 px tiles over the 160x72 Carte1 map.
import { show, close, audio, CInt, Rnd } from '../core.js';
import { G, D } from '../state.js';
import { Marche, TICK_MS, HAUT, BAS, GAUCHE, DROITE, DIRNAME } from './ville.js';

const PCT_BATAILLE = 90;   // battle when CInt(Rnd*100) >= 90 -> 10.5 % per step
const VILLES = { 'map/105.jpg': 1, 'map/107.jpg': 2, 'map/106.jpg': 3 };   // Ville1, Ville2 (107), Ville3 (106)

let noImgHero = 0;   // module level like the VB form variable: only the very first step has 9 ticks

export class Carte extends Marche {
  load() {
    this.initMarche(16, 12, 48, 'carte1');
    const v = G.ville || D.villes[1];
    this.vc = v.posHorSortie; this.vr = v.posVerSortie;   // InitialiseCarte
    this.pos = v.posHeroSortie;
    G.heros.endroit = 0;
    this.snapHero();
    audio.playMusic('monde', true);                         // Form_Activate (looped: author's intent)
    this.preloadMap().then(() => {
      if (this.closed) return;
      this.drawBg(); this.draw();
      this.busy = false;
    });
  }
  unload() { this.endMarche(); audio.stopMusic(); }

  apresStats() { if (audio.musicName !== 'monde') audio.playMusic('monde', true); }

  static trigger(d, p) {
    if (d === HAUT) return p >= 48 && p <= 59;      // (sic) cols 0..11 only; harmless
    if (d === BAS) return p >= 128 && p <= 143;
    if (d === DROITE) return p % 16 === 11;
    return p % 16 === 4;
  }
  essai(d) {
    if (this.possibleHero(d)) {
      if (Carte.trigger(d, this.pos)) {
        this.deplaceCarte(d);
        this.pas(d, false);
      } else {
        this.pos = this.neighbour(d);
        this.pas(d, true);
      }
    } else {
      this.frame = DIRNAME[d] + '1';
      this.draw();
      if (this.possibleAction(d)) {
        const t = this.tileAt(this.neighbour(d));
        const n = VILLES[t.path];
        if (n) {
          G.heros.endroit = n;
          this.closed = true;
          close(this, { to: 'ville', mode: 'entrer' });
        }
      }
    }
  }
  deplaceCarte(d) {
    if (d === HAUT) this.vr--; else if (d === BAS) this.vr++; else if (d === GAUCHE) this.vc--; else this.vc++;
    this.drawBg();
  }
  // TmrDeplacement: frames 1..8, rest frame 1; battle roll on the stop tick. Sprite snapped to the grid.
  pas(d, slide) {
    this.busy = true;
    const ticks = 8 - noImgHero + 1;
    const fx = this.hx, fy = this.hy;
    const [tx, ty] = this.cellXY(this.pos);
    let k = 0;
    const t = this.timers.every(TICK_MS, async () => {
      let stop = false;
      if (noImgHero >= 8) {
        t.stop(); noImgHero = 0; stop = true;
        if (CInt(Rnd() * 100) >= PCT_BATAILLE) {
          const r = await this.bataille();
          if (r === 'defaite' || this.closed) return;
        }
      }
      noImgHero += 1; k++;
      if (slide) {
        const f = stop ? 1 : Math.min(1, k / ticks);
        this.hx = Math.round(fx + (tx - fx) * f); this.hy = Math.round(fy + (ty - fy) * f);
      }
      this.frame = DIRNAME[d] + noImgHero;
      this.draw();
      if (stop) this.finPas();
    });
  }
  async bataille() {
    audio.stopMusic();
    let r;
    try {
      const { Bataille } = await import('./bataille.js');
      r = await show(new Bataille());
    } catch (err) { console.error(err); }
    this.held = [];
    if (r === 'defaite') {
      this.closed = true;
      close(this, { to: 'menu' });
      return r;
    }
    audio.playMusic('monde', true);   // deliberate: the map music restarts after a battle
    return r;
  }
}
