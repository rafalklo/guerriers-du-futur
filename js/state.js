// Shared game state = the VB globals (DHeros, Ville, coffres, live map files, play time).
import { storage, clone, pad2 } from './core.js';

export let D = null;      // static data from data/game.json (armes, armures, ..., villes, maps, nouveau, savesOriginales)
export let ANIMS = null;  // sprite-sheet metadata from data/anims.json: {"ennemis/01.gif": {w,h,n,delays}}

export async function loadData() {
  [D, ANIMS] = await Promise.all([
    fetch('data/game.json').then((r) => r.json()),
    fetch('data/anims.json').then((r) => r.json()),
  ]);
  seedOriginalSaves();
}

// ---------------- live game state ----------------
export const G = {
  heros: null,      // InfoGenerales: {munition:{"11".."15"}, position, nbrHeros, argent, endroit, potions[0..10], tempsJoue, infoHero[0..4]}
  coffres: null,    // [null, {no, ouvert, contenu} x20]
  mapDiff: [],      // [[mapKey, idx, path, active, action]] changes vs original maps (opened chests ...)
  ville: null,      // current Villes record (D.villes[n])
  temps: { h: 0, m: 0, s: 0, str: '', timer: null },
};

// Map access with diffs applied. mapKey: 'carte1' | 'ville1' | 'ville2' | 'ville3'.
// tile(mapKey, idx) -> {path:'map/6.jpg', active:bool, action:bool}
const cache = {};
function buildMap(k) {
  const m = D.maps[k];
  const t = new Array(m.tile.length);
  for (let i = 0; i < t.length; i++) t[i] = { path: m.paths[m.tile[i]], active: m.active[i] === '1', action: m.action[i] === '1' };
  for (const [mk, i, path, active, action] of G.mapDiff) if (mk === k) t[i] = { path, active, action };
  cache[k] = t;
}
export function mapInfo(k) { return { w: D.maps[k].w, h: D.maps[k].h }; }
export function tile(k, idx) { if (!cache[k]) buildMap(k); return cache[k][idx]; }
export function setTile(k, idx, path, active, action) {
  if (!cache[k]) buildMap(k);
  cache[k][idx] = { path, active, action };
  G.mapDiff = G.mapDiff.filter((d) => !(d[0] === k && d[1] === idx));
  G.mapDiff.push([k, idx, path, active, action]);
}
function resetMapCache() { for (const k of Object.keys(cache)) delete cache[k]; }

// ---------------- helpers (Procedures.bas) ----------------
export const hero = (i) => G.heros.infoHero[i];
export function calculeAttaque(h) {
  const a = hero(h).arme;
  return a > 0 ? D.armes[a].attaque : 0;
}
export function calculeDefence(h) {
  const x = hero(h);
  let d = 0;
  if (x.armure > 0) d += D.armures[x.armure].defence;
  if (x.bouclier > 0) d += D.boucliers[x.bouclier].defence;
  if (x.heaume > 0) d += D.heaumes[x.heaume].defence;
  return d;
}

// ---------------- play time (CalculeTempsJoué, 1000 ms, never stopped once started) ----------------
export function startPlayTime(fromString) {
  const t = G.temps;
  if (fromString) {
    const m = /(\d+)h (\d+)m (\d+)s/.exec(fromString);
    if (m) { t.h = +m[1]; t.m = +m[2]; t.s = +m[3]; }
  } else if (fromString === null) { t.h = t.m = t.s = 0; }
  t.str = '';
  if (t.timer) clearInterval(t.timer);
  t.timer = setInterval(() => {
    t.s += 1;
    if (t.s === 60) { t.m += 1; t.s = 0; }
    if (t.m === 60) { t.h += 1; t.m = 0; }
    t.str = `${pad2(t.h)}h ${pad2(t.m)}m ${pad2(t.s)}s `;
  }, 1000);
}
export function stopPlayTime() { if (G.temps.timer) clearInterval(G.temps.timer); G.temps.timer = null; }

// ---------------- new game / save / load (replaces file copies) ----------------
const SLOTS = 15;
export function newGame(nom, age) {
  G.heros = clone(D.nouveau.heros);
  G.coffres = clone(D.nouveau.coffres);
  G.mapDiff = [];
  resetMapCache();
  if (nom) G.heros.infoHero[1].nom = (nom.toUpperCase() + ' '.repeat(10)).slice(0, 10);
  if (age !== '' && age != null) {
    const n = parseInt(age, 10);
    if (!Number.isNaN(n)) G.heros.infoHero[1].age = Math.max(0, Math.min(255, n)); // original crashed on non-numeric
  }
  G.ville = null;
}
export function slotData(n) { return storage.get(n); }
export function slotExists(n) { return !!storage.get(n); }
export function anySlot() { for (let i = 1; i <= SLOTS; i++) if (slotExists(i)) return true; return false; }
export function saveSlot(n) {
  const h = clone(G.heros);
  h.position = 53;                       // saved Position is always 53 (original behaviour)
  h.tempsJoue = (G.temps.str + ' '.repeat(13)).slice(0, 13);
  return storage.set(n, { heros: h, coffres: G.coffres, mapDiff: G.mapDiff });
}
export function loadSlot(n) {
  const s = storage.get(n);
  if (!s) return false;
  G.heros = clone(s.heros);
  G.coffres = clone(s.coffres);
  G.mapDiff = clone(s.mapDiff || []);
  resetMapCache();
  return true;
}
// First run: the 3 save slots shipped with the 2001 game become slots 1-3.
function seedOriginalSaves() {
  try {
    if (localStorage.getItem('gdf-seeded')) return;
    for (const [n, s] of Object.entries(D.savesOriginales)) if (!storage.get(n)) storage.set(n, s);
    localStorage.setItem('gdf-seeded', '1');
  } catch { /* storage unavailable: no saves */ }
}
export { SLOTS };
