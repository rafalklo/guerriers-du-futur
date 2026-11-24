// Shared VB-like widgets for Menu / Magasin / Stats: fonts, picture buttons, flat scrollbar,
// slot preview (FichierContinuer / FichierSauvegarder) and the OUI/NON popup (FrmQuestion).
import { box, img, show, close } from '../core.js';
import { D, slotData } from '../state.js';

// VB point sizes -> CSS px (96 dpi)
const FAM = {
  ms: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, Arial, sans-serif',
  book: '"Book Antiqua", "Palatino Linotype", Palatino, "URW Palladio L", Georgia, serif',
  times: '"Times New Roman", Times, "Liberation Serif", serif',
  courier: '"Courier New", Courier, "Liberation Mono", monospace',
  tahoma: 'Tahoma, Verdana, "DejaVu Sans", sans-serif',
  fixed: 'Fixedsys, "Lucida Console", "Courier New", monospace',
};
export function font(pt, fam = 'ms', bold = false, italic = false) {
  return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${Math.round(pt * 4 / 3 * 100) / 100}px ${FAM[fam]}`;
}
// VB text: vbNewLine = CRLF (2 chars); render as one line break
export const vbText = (s) => String(s).replace(/\r\n/g, '\n').replace(/\r/g, '');
export const NL = '\r\n';

// label (VB Label): rect, caption, style
export function label(parent, x, y, w, h, text, style = {}, props = {}) {
  return box(parent, x, y, w, h, { cls: 'lbl', text: vbText(text), style, ...props });
}

// Picture button: ImgOption (buton1.gif stretched) + transparent centred label on top.
// MouseDown -> buton2.gif + italic, MouseUp -> buton1.gif. Both picture and label are clickable.
export function picButton(parent, imgRect, lblRect, caption, lblFont, onClick) {
  const pic = img(parent, 'images/menu/buton1.gif', ...imgRect);
  const lbl = label(parent, ...lblRect, caption, { font: lblFont, color: '#fff', textAlign: 'center', cursor: 'pointer' });
  pic.style.cursor = 'pointer';
  const b = { pic, lbl, enabled: true, visible: true };
  const down = (e) => { if (!b.enabled) return; e.preventDefault(); pic.src = 'assets/images/menu/buton2.gif'; lbl.style.fontStyle = 'italic'; };
  const up = () => { pic.src = 'assets/images/menu/buton1.gif'; lbl.style.fontStyle = 'normal'; };
  for (const t of [pic, lbl]) {
    t.addEventListener('pointerdown', down);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointerleave', up);
    t.addEventListener('pointercancel', up);
    t.addEventListener('click', (e) => { if (b.enabled && b.visible) onClick(e); });
  }
  b.setEnabled = (on) => { b.enabled = on; lbl.style.color = on ? '#fff' : '#808080'; lbl.style.cursor = pic.style.cursor = on ? 'pointer' : 'default'; };
  b.setVisible = (on) => { b.visible = on; pic.style.display = lbl.style.display = on ? '' : 'none'; };
  return b;
}

// Vertical FlatScrollBar (Min..Max, SmallChange 1, LargeChange large). Arrow hit zones are widened
// to the left (invisible) so they are usable with a finger; wheel also scrolls.
export function vScroll(parent, x, y, w, h, min, max, large, onChange) {
  const s = { value: min };
  const bar = box(parent, x, y, w, h, { style: { background: '#e0e0e0', border: '1px solid #808080' } });
  const btnStyle = { background: '#c0c0c0', border: '1px solid #808080', color: '#000', font: '9px Arial, sans-serif',
    textAlign: 'center', lineHeight: (w - 2) + 'px', cursor: 'pointer' };
  const up = box(bar, -1, -1, w, w, { text: '▲', style: btnStyle });
  const dn = box(bar, -1, h - w - 1, w, w, { text: '▼', style: btnStyle });
  const track = h - 2 * w;
  const thumbH = Math.max(12, Math.round(track * large / (max - min + large)));
  const thumb = box(bar, -1, w, w, thumbH, { style: { background: '#c0c0c0', border: '1px solid #808080' } });
  const set = (v) => {
    v = Math.max(min, Math.min(max, v));
    const changed = v !== s.value;
    s.value = v;
    thumb.style.top = (w - 1 + Math.round((track - thumbH) * (v - min) / (max - min))) + 'px';
    if (changed) onChange(v);
  };
  s.set = set;
  const hit = (yy, hh, fn) => {
    const z = box(parent, x - 34, yy, w + 34, hh, { style: { cursor: 'pointer' } });
    z.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); });
    return z;
  };
  hit(y, w + 14, () => set(s.value - 1));
  hit(y + h - w - 14, w + 14, () => set(s.value + 1));
  bar.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = bar.getBoundingClientRect();
    const k = r.height / h;
    const py = (e.clientY - r.top) / k;
    if (py < w) set(s.value - 1);
    else if (py > h - w) set(s.value + 1);
    else {
      const tt = parseFloat(thumb.style.top);
      if (py < tt) set(s.value - large); else if (py > tt + thumbH) set(s.value + large);
    }
  });
  parent.addEventListener('wheel', (e) => { e.preventDefault(); set(s.value + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
  set(min);
  return s;
}

// Slot preview (FrmMenu.FichierContinuer / FrmMagasin.FichierSauvegarder).
// L = { contour:[x,y,w,h], no:[...], por:[x, y1,y2,y3,y4], etiq:[...], donnees:[...], vide:[...] }
export function slotPreview(parent, L) {
  const p = {};
  img(parent, 'images/menu/fontcontinuer.gif', ...L.contour);
  p.no = label(parent, ...L.no, '- 1 -', { font: font(9, 'fixed', true), color: '#000', textAlign: 'center' });
  p.por = [null];
  for (let i = 1; i <= 4; i++) {
    const e = img(parent, `images/menu/${i}.gif`, L.por[0], L.por[i], 60, 66);
    e.style.display = 'none';
    p.por.push(e);
  }
  const txt = { font: font(12, 'courier', true, true), background: '#008000', color: '#00ffff', lineHeight: '18px', whiteSpace: 'pre' };
  p.etiq = label(parent, ...L.etiq, ['NOM', 'VIE', 'NIVEAU', 'ARGENT', 'VILLE', 'TEMPS'].join(NL + NL), txt);
  p.donnees = label(parent, ...L.donnees, '', { ...txt, textAlign: 'center' });
  p.vide = label(parent, ...L.vide, '- VIDE -', { font: font(18, 'tahoma', true), color: '#000', textAlign: 'center' });
  // returns true if the slot exists
  p.update = (n) => {
    p.no.textContent = '- ' + n + ' -';
    const s = slotData(n);
    const existe = !!s;
    p.vide.style.display = existe ? 'none' : '';
    p.etiq.style.display = p.donnees.style.display = existe ? '' : 'none';
    if (existe) {
      const h = s.heros, h1 = h.infoHero[1];
      for (let i = 1; i <= h.nbrHeros && i <= 4; i++) p.por[i].style.display = '';
      const v = D.villes[h.endroit];
      p.donnees.textContent = vbText([h1.nom, h1.ptsVieActuel + ' / ' + h1.ptsVieMax, h1.niveau, h.argent,
        v ? v.nomRaw : '', h.tempsJoue].join(NL + NL));
    } else {
      for (let i = 1; i <= 4; i++) p.por[i].style.display = 'none';
    }
    return existe;
  };
  return p;
}

// FrmQuestion: 208x32 modal popup at (40,377), OUI / NON. Resolves true (OUI) / false (NON).
export class Question {
  load() {
    const r = this.root; // transparent full-stage layer = modal (blocks the shop below)
    const f = box(r, 40, 377, 208, 32, { style: { background: '#000080', overflow: 'hidden' } });
    const st = { font: font(18, 'ms', true), color: '#ffff00', textAlign: 'center', cursor: 'pointer', lineHeight: '33px' };
    const oui = label(f, 0, 0, 97, 33, 'OUI', st);
    const non = label(f, 104, 0, 105, 33, 'NON', st);
    oui.addEventListener('pointermove', () => { oui.style.color = '#ff0000'; non.style.color = '#ffff00'; });
    non.addEventListener('pointermove', () => { non.style.color = '#ff0000'; oui.style.color = '#ffff00'; });
    oui.addEventListener('click', () => close(this, true));
    non.addEventListener('click', () => close(this, false));
  }
}
export const ask = () => show(new Question());
