// FrmMagasin: shops (Armes / Potions / Armures) and the MOTEL (Repos + Sauvegarder).
// show(new Magasin(), action). The caller handles the shop / town music.
import { box, img, close, audio, CInt, padName } from '../core.js';
import { G, D, saveSlot, SLOTS } from '../state.js';
import { font, label, vbText, NL, picButton, vScroll, slotPreview, ask } from './formui.js';

const YEL = '#ffff00', OLIVE = '#c0c000';
const nomArme = (r) => padName(r.nom, 17);
const nomArmure = (r) => padName(r.nom, 21);
const nomBouclier = (r) => padName(r.nom, 15);
const nomHeaume = (r) => padName(r.nom, 15);
const nomPotion = (r) => r.nomRaw || padName(r.nom, 15);

export class Magasin {
  load(action) {
    this.action = action;
    const A = action.toUpperCase();
    this.A = A;
    const r = this.root;
    r.style.background = '#404000';
    this.rabais = 0;            // value shown in LblRabais(1)
    this.texte = '';
    this.typing = null;
    const H = G.heros;

    // Form_MouseMove: bare background resets the rabais
    r.addEventListener('pointermove', (e) => { if (e.target === r) this.afficheRabais(0); });

    // ---- static layout ----
    label(r, 8, 8, 753, 41, A, { font: font(24, 'book', true), color: '#0000ff', background: '#400000',
      textAlign: 'center', border: '1px solid #000', lineHeight: '39px' });
    img(r, `images/magasin/${action.toLowerCase()}.gif`, 32, 80, 113, 121);
    box(r, 32, 240, 225, 177, { style: { background: '#000080', border: '4px solid #400000', borderRadius: '14px' } });
    this.txt = box(r, 40, 248, 209, 161, { style: { background: '#000080', color: YEL, font: font(12, 'ms', true),
      whiteSpace: 'pre-wrap', overflowWrap: 'break-word', overflow: 'hidden', lineHeight: '1.2' } });
    const y12 = { font: font(12, 'ms', true), color: YEL };
    label(r, 24, 448, 89, 25, 'ARGENT', y12);
    this.lblArgent = label(r, 112, 448, 137, 25, '', { ...y12, textAlign: 'right' });
    this.lblRabais0 = label(r, 24, 472, 89, 25, 'RABAIS', y12);
    this.lblRabais1 = label(r, 112, 472, 137, 25, '0 $', { ...y12, textAlign: 'right' });
    this.lblRabais0.style.display = this.lblRabais1.style.display = 'none';
    // CmdQuitter (Ville\263.jpg)
    const q = box(r, 32, 512, 49, 49, { style: { border: '1px solid #000', cursor: 'pointer', background: '#c0c0c0' } });
    img(q, 'ville/263.jpg', 0, 0, 48, 48);
    q.addEventListener('click', () => close(this));

    // item slots (ImgAchat / LblNom / LblPrix 1..8)
    this.items = [null];
    const ys = [64, 200, 336, 472];
    const prixPos = [null, [336, 112], [336, 248], [336, 384], [336, 520], [584, 112], [584, 256], [584, 384], [592, 528]];
    for (let i = 1; i <= 8; i++) {
      const x = i <= 4 ? 272 : 520, y = ys[(i - 1) % 4];
      const pic = box(r, x, y, null, null, { tag: 'img', style: { display: 'none', cursor: 'pointer' } });
      pic.draggable = false;
      const nom = label(r, x + 64, y + 16, 177, 25, '', { font: font(9.75, 'ms', true), color: OLIVE, display: 'none' });
      const prix = label(r, prixPos[i][0], prixPos[i][1], 73, 25, '', { font: font(12, 'ms', true), color: OLIVE, textAlign: 'right', display: 'none' });
      pic.addEventListener('pointermove', (e) => { e.stopPropagation(); if (e.pointerType !== 'touch') this.hoverItem(i); });
      pic.addEventListener('click', () => this.clickItem(i));
      this.items.push({ pic, nom, prix });
    }

    this.afficheArgent();
    this.texte = A === 'MOTEL' ? 'Bienvenue dans le MOTEL.'
      : 'Bienvenue dans le magasin des ' + A + ' comment puis-je vous aider ?';

    if (A === 'ARMES') {
      this.lblRabais0.style.display = this.lblRabais1.style.display = '';
      for (let i = 1; i <= H.nbrHeros; i++) {
        const a = D.armes[G.ville.arme[i]];
        this.setItem(i, a.img, nomArme(a), a.prix, nomArme(a) + ' +' + a.attaque);
      }
    } else if (A === 'POTIONS') {
      label(r, 8, 208, 225, 25, 'ESPACES POUR POTIONS', y12);
      this.lblEspace = label(r, 232, 208, 33, 25, '', { ...y12, textAlign: 'right' });
      this.afficheEspace();
      for (let i = 1; i <= 8; i++) {
        const p = D.potions[G.ville.potion[i]];
        this.setItem(i, p.img, nomPotion(p), p.prix, nomPotion(p) + ' +' + p.force);
      }
    } else if (A === 'ARMURES') {
      this.lblRabais0.style.display = this.lblRabais1.style.display = '';
      const recs = [null, D.armures[G.ville.armure], D.boucliers[G.ville.bouclier], D.heaumes[G.ville.heaume]];
      const noms = [null, nomArmure, nomBouclier, nomHeaume];
      for (let i = 1; i <= 3; i++) {
        const x = recs[i];
        this.setItem(i, x.img, noms[i](x), x.prix, noms[i](x) + ' +' + x.defence);
      }
      // LstArmure
      this.sel = -1;
      const lst = box(r, 272, 472, 129, 84, { style: { background: '#808000', border: '2px inset #808080',
        font: font(12, 'ms', true, true), color: '#000', overflowY: 'auto' } });
      this.lstRows = [];
      for (let i = 1; i <= H.nbrHeros; i++) {
        const row = el('div', H.infoHero[i].nom, lst);
        row.addEventListener('click', () => this.selectHero(i - 1));
        this.lstRows.push(row);
      }
    } else if (A === 'MOTEL') {
      const cmd = (y, t, bg, fn) => {
        const b = box(r, 96, y, 145, 25, { tag: 'button', text: t, style: { background: bg, font: font(9.75, 'ms', true),
          color: '#000', border: '2px outset #e0e0e0', padding: '0', cursor: 'pointer' } });
        b.addEventListener('click', fn);
        return b;
      };
      cmd(512, 'Repos', '#c04000', () => this.repos());
      cmd(544, 'Sauvegarder', '#008000', () => { this.fra.style.display = ''; if (this.bAnnuler) this.bAnnuler.setVisible(true); });
    }

    this.buildSauvegarde();
    this.afficheTexte();
  }

  setItem(i, src, nom, prix, tip) {
    const it = this.items[i];
    it.pic.src = 'assets/' + src;
    it.pic.title = tip;
    it.pic.style.display = it.nom.style.display = it.prix.style.display = '';
    it.nom.textContent = nom;
    it.prix.textContent = prix + ' $';
  }

  // ---------- vendor text (TmrTexte 25 ms + Texte.wav) ----------
  afficheTexte() {
    if (this.typing) this.typing.stop();
    let cpt = 1;
    this.txt.textContent = '';
    const t = this.texte;
    this.typing = this.timers.every(25, () => {
      audio.sfx('texte', 'magasin', false);
      cpt += 1;
      this.txt.textContent = vbText(t.slice(0, cpt));
      if (cpt >= t.length) { this.typing.stop(); this.typing = null; audio.stopSfx('magasin'); }
    });
  }
  say(t) { this.texte = t; this.afficheTexte(); }

  afficheArgent() { this.lblArgent.textContent = G.heros.argent + ' $'; }
  afficheRabais(n) { this.rabais = n; this.lblRabais1.textContent = n + ' $'; }
  afficheEspace() { let n = 0; for (let i = 1; i <= 10; i++) if (G.heros.potions[i] === 0) n++; this.lblEspace.textContent = n; }

  // ---------- rabais = CInt(price of equipped item / 2) ----------
  // ImgAchat_MouseMove. stale=true reproduces the armour quirk (label not updated when the slot is empty).
  hoverItem(i, stale = true) {
    const H = G.heros;
    if (this.A === 'ARMES') {
      const a = H.infoHero[i].arme;
      this.afficheRabais(a !== 0 ? CInt(D.armes[a].prix / 2) : 0);
    } else if (this.A === 'ARMURES') {
      if (this.sel < 0) { this.afficheRabais(0); return; }
      const h = H.infoHero[this.sel + 1];
      const cur = [null, [h.armure, D.armures], [h.bouclier, D.boucliers], [h.heaume, D.heaumes]][i];
      if (cur[0] !== 0) this.afficheRabais(CInt(cur[1][cur[0]].prix / 2));
      else if (!stale) this.afficheRabais(0);
    }
  }

  selectHero(idx) {
    this.sel = idx;
    this.lstRows.forEach((row, k) => { row.style.background = k === idx ? '#000080' : ''; row.style.color = k === idx ? '#fff' : '#000'; });
  }

  async clickItem(i) {
    if (this.busy) return;
    this.busy = true;
    try {
      // tap = hover-then-click: the rabais is the one for the clicked item
      this.hoverItem(i, false);
      if (this.A === 'ARMES') await this.achatArme(i);
      else if (this.A === 'POTIONS') await this.achatPotion(i);
      else if (this.A === 'ARMURES') await this.achatArmure(i);
      this.afficheTexte();
    } finally { this.busy = false; }
  }

  async achatArme(index) {
    const H = G.heros, a = D.armes[G.ville.arme[index]], nom = nomArme(a);
    if (a.no === H.infoHero[index].arme) {
      this.say('Vous êtes déjà en possesion de ' + NL + nom);
      return;
    }
    const net = a.prix - this.rabais;
    if (net < 0) this.texte = 'Si vous achetez le ' + NL + nom + NL + 'je vais vous payer ' + (net * -1) + ' $';
    else this.texte = 'Voulez-vous acheter le ' + NL + nom + NL + ' pour ' + net + '$ ?';
    this.afficheTexte();
    if (await ask()) {
      if (net > H.argent) this.texte = "Vous n'avez pas suffisamment d'argent";
      else {
        H.argent -= net;
        this.afficheArgent();
        H.infoHero[index].arme = a.no;
        this.texte = H.infoHero[index].nom + ' a équipé le ' + NL + nom;
      }
    } else this.texte = 'Voulez-vous autre chose ?';
  }

  async achatPotion(index) {
    const H = G.heros, p = D.potions[G.ville.potion[index]], nom = nomPotion(p);
    let espace = 100;
    if (index !== 7 && index !== 8) {
      espace = 0;
      for (let i = 1; i <= 10; i++) if (H.potions[i] === 0) { espace = i; break; }
    }
    if (espace === 0) {
      this.say("Vous n'avez plus de place dans votre sac à potions ! ");
      return;
    }
    if (p.no < 10) this.texte = 'Voulez-vous acheter la Potion ' + NL + nom + NL + ' pour ' + p.prix + '$ ?';
    else this.texte = 'Voulez-vous acheter les munitions ' + NL + nom + NL + ' pour ' + p.prix + '$ ?';
    this.afficheTexte();
    if (await ask()) {
      if (p.prix > H.argent) this.texte = "Vous n'avez pas suffisamment d'argent";
      else {
        H.argent -= p.prix;
        this.afficheArgent();
        if (index !== 7 && index !== 8) {
          H.potions[espace] = p.no;
          this.afficheEspace();
          this.texte = "Merci d'avoir acheté la Potion " + nom;
        } else {
          H.munition[p.no] = (H.munition[p.no] || 0) + 1;
          this.texte = "Merci d'avoir acheté les munitions " + nom;
        }
      }
    } else this.texte = 'Voulez-vous autre chose ?';
  }

  async achatArmure(index) {
    const H = G.heros;
    if (this.sel < 0) {
      this.say('Vous devez sélectionner le héros que vous voulez équiper!');
      return;
    }
    const sel = this.sel + 1, h = H.infoHero[sel];
    const slot = [null, ['armure', D.armures[G.ville.armure], nomArmure], ['bouclier', D.boucliers[G.ville.bouclier], nomBouclier],
      ['heaume', D.heaumes[G.ville.heaume], nomHeaume]][index];
    const [champ, x, fNom] = slot, nom = fNom(x);
    if (x.no === h[champ]) {
      this.texte = h.nom + ' porte déjà : ' + NL + nom;       // ADeja
      return;
    }
    const net = x.prix - this.rabais;
    if (net < 0) this.texte = 'Si vous achetez le ' + NL + nom + NL + 'Pour :' + h.nom + NL + 'Je vais vous payer ' + (net * -1) + ' $';
    else this.texte = 'Voulez-vous équiper: ' + NL + h.nom + 'avec' + NL + nom + NL + 'Pour : ' + net + ' $';
    this.afficheTexte();
    if (await ask()) {
      if (net > H.argent) this.texte = "Vous n'avez pas suffisamment d'argent";
      else {
        H.argent -= net;
        this.afficheArgent();
        h[champ] = x.no;
        this.texte = h.nom + ' a équipé le ' + NL + nom;
      }
    } else this.texte = 'Voulez-vous autre chose ?';
  }

  // ---------- MOTEL ----------
  async repos() {
    if (this.busy) return;
    this.busy = true;
    try {
      const H = G.heros;
      const prix = H.endroit * H.nbrHeros * 25;
      this.say('Voulez-vous vous reposer pour ' + prix + ' $');
      if (await ask()) {
        if (H.argent < prix) this.say("Vous n'avez pas suffisamment d'argent!");
        else {
          H.argent -= prix;
          this.afficheArgent();
          for (let i = 1; i <= H.nbrHeros; i++) {
            H.infoHero[i].ptsMagieActuel = H.infoHero[i].ptsMagieMax;
            H.infoHero[i].ptsVieActuel = H.infoHero[i].ptsVieMax;
          }
          // no message: the question stays on screen (original)
        }
      } else this.say('Voulez-vous autre chose?');
    } finally { this.busy = false; }
  }

  // FraSauvegarde (272,192, 329x321, ButtonFace grey). Built for every shop like the original; shown from the Motel.
  buildSauvegarde() {
    const f = box(this.root, 272, 192, 329, 321, { style: { background: '#c0c0c0', display: 'none', zIndex: 2 } });
    this.fra = f;
    f.addEventListener('pointermove', (e) => e.stopPropagation());
    this.prevSauv = slotPreview(f, {
      contour: [16, 0, 313, 318], no: [128, 24, 89, 17], por: [32, 16, 88, 160, 240],
      etiq: [112, 56, 73, 225], donnees: [184, 56, 121, 225], vide: [24, 144, 313, 41],
    });
    picButton(f, [104, 288, 209, 19], [104, 290, 209, 17], 'Sauvegarder', font(8), () => this.sauvegarder());
    this.scrollSauv = vScroll(f, 0, 0, 17, 321, 1, SLOTS, 3, (v) => this.prevSauv.update(v));
    this.prevSauv.update(1);
    // Port addition: a way to close the panel without saving (the original had none)
    if (this.A === 'MOTEL') {
      this.bAnnuler = picButton(this.root, [376, 520, 209, 19], [376, 522, 209, 17], 'Annuler', font(8), () => this.fermerSauv());
      this.bAnnuler.pic.style.zIndex = this.bAnnuler.lbl.style.zIndex = 2;
      this.bAnnuler.setVisible(false);
    }
  }
  fermerSauv() {
    if (this.attend) { this.attend.stop(); this.attend = null; }
    this.fra.style.display = 'none';
    if (this.bAnnuler) this.bAnnuler.setVisible(false);
  }
  sauvegarder() {
    if (this.attend) return;
    const n = this.scrollSauv.value;
    saveSlot(n);
    this.say('Votre jeu à été sauvegardée correctement dans la case no ' + n);
    this.prevSauv.update(n);
    this.attend = this.timers.after(1500, () => { this.attend = null; this.fermerSauv(); });
  }

  unload() { audio.stopSfx('magasin'); }
}

function el(tag, text, parent) { const e = document.createElement(tag); e.textContent = text; e.style.whiteSpace = 'pre'; e.style.cursor = 'pointer'; parent.appendChild(e); return e; }
