// FrmMenu: main menu (NOUVELLE PARTIE / CONTINUER / A PROPOS / QUITTER) with its sub-panels.
// show(new Menu()) -> 'nouvelle' (after newGame(nom, age)) | 'continuer' (after loadSlot(n)).
import { box, img, close, audio } from '../core.js';
import { newGame, loadSlot, anySlot, SLOTS } from '../state.js';
import { font, label, picButton, vScroll, slotPreview, NL } from './formui.js';

// FrmMenu ScaleHeight 8336.08 (user units) for controls placed directly on the form
const UY = (v) => Math.round(v * 8640 / 8336.08 / 15 * 10) / 10;

export class Menu {
  load() {
    const r = this.root;
    this.lbl = {};          // LblOption(i)
    this.opt = 1;           // OptionADesactiver
    img(r, 'images/menu/fondmenu.jpg', 0, 0, 768, 576);
    img(r, 'images/titre/logo.gif', 8, UY(120), 243, UY(3374));
    r.addEventListener('pointermove', () => this.whiten());     // Form_MouseMove

    audio.playMusic('menu', true);

    const optFont = font(13.5);
    const main = (idx, caption, lblTop, imgTop, fn) =>
      this.option(r, idx, [520, UY(imgTop), 229, UY(675)], [520, UY(lblTop), 229, 26], caption, optFont, fn);
    main(1, 'NOUVELLE PARTIE', 3360, 3240, () => this.showPanel(1));
    const bCon = main(2, 'CONTINUER', 4641, 4522, () => this.showPanel(2));
    main(4, 'A PROPOS', 5921, 5802, () => this.showPanel(4));
    main(5, 'QUITTER', 7202, 7083, () => this.timers.after(750, () => this.quitter()));
    bCon.setEnabled(anySlot());

    // ---- sub-panels (FraMenu 1, 2, 4) at x 423, overlaying the right column ----
    this.fra = {};
    for (const i of [1, 2, 4]) {
      const f = box(r, 423, 0, 345, 576, { style: { display: 'none', overflow: 'hidden' } });
      const cadre = img(f, 'images/menu/fondsousmenu.jpg', 0, 0, 345, 576);
      cadre.addEventListener('pointermove', () => this.whiten());   // ImgCadre_MouseMove
      this.fra[i] = f;
    }

    // FraMenu(1) NOUVELLE PARTIE
    const f1 = this.fra[1];
    const shp = { background: '#000080', border: '5px solid #0000ff', borderRadius: '14px', boxSizing: 'border-box' };
    box(f1, 160, 200, 105, 113, { style: shp });
    img(f1, 'images/menu/1.gif', 168, 208, 90, 100);
    box(f1, 136, 320, 153, 137, { style: shp });
    const lblSt = { font: font(13.5), color: '#fff', textAlign: 'center' };
    label(f1, 168, 328, 89, 25, 'NOM', lblSt);
    label(f1, 160, 392, 105, 25, 'AGE', lblSt);
    const txt = (x, y, w, h, val, max, numeric) => {
      const t = box(f1, x, y, w, h, { tag: 'input', style: {
        background: '#008080', color: '#ffff00', font: font(13.5), textAlign: 'center',
        border: '2px inset #808080', padding: '0', outline: 'none', userSelect: 'text', webkitUserSelect: 'text' } });
      t.type = 'text'; t.value = val; t.maxLength = max;
      t.autocomplete = 'off'; t.spellcheck = false;
      t.setAttribute('autocapitalize', 'characters');
      if (numeric) t.inputMode = 'numeric';
      t.addEventListener('keydown', (e) => { if (e.key === 'Enter') t.blur(); e.stopPropagation(); });
      return t;
    };
    this.txtNom = txt(144, 352, 137, 33, 'RAFAL', 10, false);
    this.txtAge = txt(176, 416, 73, 33, '20', 2, true);
    this.option(f1, 6, [97, 464, 229, 43], [97, 472, 229, 25], 'COMMENCER', optFont, () => this.commencer());
    this.option(f1, 7, [97, 512, 229, 43], [97, 520, 229, 25], 'REVENIR AU MENU', optFont, () => this.hidePanel(1));

    // FraMenu(2) CONTINUER (slot picker)
    const f2 = this.fra[2];
    this.prev = slotPreview(f2, {
      contour: [24, 192, 313, 318], no: [160, 208, 89, 17], por: [32, 208, 280, 352, 424],
      etiq: [112, 240, 73, 225], donnees: [184, 240, 121, 225], vide: [24, 336, 313, 41],
    });
    this.bOk = this.option(f2, 10, [112, 480, 209, 19], [112, 482, 209, 17], 'OK', font(8), () => this.continuer());
    this.option(f2, 9, [96, 520, 229, 43], [120, 528, 185, 25], 'REVENIR AU MENU', optFont, () => this.hidePanel(2));
    this.scroll = vScroll(f2, 0, 192, 17, 321, 1, SLOTS, 3, (v) => this.fichierContinuer(v));
    this.fichierContinuer(1);

    // FraMenu(4) A PROPOS
    const f4 = this.fra[4];
    const ap = (x, y, w, h, pt, t) => label(f4, x, y, w, h, t, { font: font(pt, 'times', true), color: '#c0c000', textAlign: 'center' });
    ap(100, 200, 220, 25, 14.25, 'GUERRIERS DU FUTUR');
    ap(104, 253, 220, 50, 12, 'CREATEUR : ' + NL + 'RAFAL KLODZINSKI');
    ap(100, 328, 220, 33, 12, 'PROJET DU COURS 420-835');
    ap(100, 376, 220, 25, 12, 'VERSION : 1.0.0');
    ap(100, 429, 220, 25, 12, '15 SEPTEMBRE 2001');
    this.option(f4, 8, [97, 512, 229, 43], [97, 520, 229, 25], 'REVENIR AU MENU', optFont, () => this.hidePanel(4));
  }

  // one ImgOption/LblOption pair with the hover colour logic and the click sound
  option(parent, idx, imgRect, lblRect, caption, f, fn) {
    const b = picButton(parent, imgRect, lblRect, caption, f, () => {
      audio.sfx('menu_sel', 'effets', false);   // If MMCEffets.Position = 0 Then JouerSon
      fn();
    });
    this.lbl[idx] = b;
    b.lbl.addEventListener('pointermove', (e) => {
      e.stopPropagation();
      if (!b.enabled) return;
      if (this.opt === idx) b.lbl.style.color = '#ff0000';
      else this.color(this.opt, '#fff');
      this.opt = idx;
    });
    return b;
  }
  color(idx, c) { const b = this.lbl[idx]; if (b && b.enabled) b.lbl.style.color = c; }
  whiten() { this.color(this.opt, '#fff'); }

  showPanel(i) { this.fra[i].style.display = ''; }
  hidePanel(i) { this.fra[i].style.display = 'none'; }

  fichierContinuer(n) {
    const existe = this.prev.update(n);
    this.bOk.setVisible(existe);
  }

  commencer() {
    newGame(this.txtNom.value, this.txtAge.value);
    close(this, 'nouvelle');
  }
  continuer() {
    if (!loadSlot(this.scroll.value)) return;
    close(this, 'continuer');
  }
  // QUITTER: a web page cannot End; show a short thank-you message and stay in the menu (port decision)
  quitter() {
    if (this.msg) this.msg.remove();
    const m = box(this.root, 234, 258, 300, 60, { cls: 'lbl', text: "Merci d'avoir joué !", style: {
      font: font(14.25, 'times', true), color: '#c0c000', background: '#000080', border: '3px solid #0000ff',
      borderRadius: '10px', textAlign: 'center', lineHeight: '54px', zIndex: 5 } });
    this.msg = m;
    m.addEventListener('click', () => m.remove());
    this.timers.after(2500, () => m.remove());
  }
  unload() { audio.stopMusic(); }
}
