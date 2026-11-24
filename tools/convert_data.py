"""Convert the original VB6 .gdf data files into web/data/game.json.

usage: python3 -I convert_data.py <path to 'Guerrier du future' folder> <out json>
Records are packed little-endian VB6 random-access records; UDT arrays are 0-based (n+1 items).
"""
import json
import os
import struct
import sys

SRC, OUT = sys.argv[1], sys.argv[2]


def s(b):
    return b.decode('cp1252').rstrip(' \x00')


def raw_s(b):
    # keep VB String*N padding (shown padded in the original UI)
    return b.decode('cp1252').replace('\x00', ' ')


def img_path(p):
    """'\\Images\\Armes\\01.DES' -> 'images/armes/01_des.gif'"""
    p = p.strip().replace('\\', '/').lstrip('/').lower()
    if p.endswith('.des'):
        p = p[:-4] + '_des.gif'
    return p


def read(name, size):
    data = open(os.path.join(SRC, 'Donnees', name), 'rb').read()
    return [data[i:i + size] for i in range(0, len(data) - size + 1, size)]


def i16(b, o):
    return struct.unpack_from('<h', b, o)[0]


out = {}
# index 0 = null so record numbers match VB (1-based Get)
out['armes'] = [None] + [dict(no=b[0], hero=b[1], nom=s(b[2:19]), prix=i16(b, 19), attaque=b[21],
                               img=img_path(s(b[22:42]))) for b in read('Armes.gdf', 42)]
out['armures'] = [None] + [dict(no=b[0], nom=s(b[1:22]), prix=i16(b, 22), defence=b[24],
                                 img=img_path(s(b[25:47])) if b[0] else '') for b in read('Armures.gdf', 47)]
out['boucliers'] = [None] + [dict(no=b[0], nom=s(b[1:16]), prix=i16(b, 16), defence=b[18],
                                   img=img_path(s(b[19:42]))) for b in read('Boucliers.gdf', 42)]
out['heaumes'] = [None] + [dict(no=b[0], nom=s(b[1:16]), prix=i16(b, 16), defence=b[18],
                                 img=img_path(s(b[19:40]))) for b in read('Heaumes.gdf', 40)]
out['potions'] = [None] + [dict(no=b[0], nom=s(b[1:16]), nomRaw=raw_s(b[1:16]), categorie=b[16], force=b[17],
                                 prix=i16(b, 18), img=img_path(s(b[20:48]))) for b in read('Potions.gdf', 48)[:15]]
en = []
for b in read('Ennemis.gdf', 48):
    en.append(dict(no=b[0], nom=s(b[1:16]), ptvMax=i16(b, 16), ptvActuel=i16(b, 18), argent=i16(b, 20),
                   img=img_path(s(b[22:37])), nbTouche=b[37], touche=list(struct.unpack_from('<4h', b, 38)),
                   attaque=b[46], defence=b[47]))
out['ennemis'] = [None] + en
villes = []
for b in read('Villes.gdf', 53):
    villes.append(dict(
        position=i16(b, 0), arme=list(b[2:7]), armure=b[7], potion=list(b[8:17]), bouclier=b[17], heaume=b[18],
        posVerEntre=b[19], posHorEntre=b[20], posVerLoad=b[21], posHorLoad=b[22], taverne=list(b[23:27]),
        nom=s(b[27:36]), nomRaw=raw_s(b[27:36]), musique=s(b[36:47]).replace('\\', '/').strip('/').lower(),
        posHorSortie=i16(b, 47), posVerSortie=i16(b, 49), posHeroSortie=i16(b, 51)))
out['villes'] = [None] + villes


def heros(path):
    b = open(path, 'rb').read()
    h = dict(munition={str(11 + i): v for i, v in enumerate(struct.unpack_from('<5h', b, 0))},
             position=b[10], nbrHeros=b[11], argent=struct.unpack_from('<i', b, 12)[0], endroit=b[16],
             potions=list(b[17:28]), tempsJoue=b[28:41].decode('cp1252').replace('\x00', ' '), infoHero=[])
    for k in range(5):
        r = b[41 + k * 28: 69 + k * 28]
        pv = struct.unpack_from('<4h', r, 14)
        h['infoHero'].append(dict(niveau=r[0], experience=i16(r, 1), nom=raw_s(r[3:13]), age=r[13],
                                  ptsVieMax=pv[0], ptsVieActuel=pv[1], ptsMagieMax=pv[2], ptsMagieActuel=pv[3],
                                  defence=r[22], attaque=r[23], arme=r[24], armure=r[25], heaume=r[26],
                                  bouclier=r[27]))
    return h


def coffres(path):
    d = open(path, 'rb').read()
    return [None] + [dict(no=d[i], ouvert=i16(d, i + 1) != 0, contenu=i16(d, i + 3)) for i in range(0, len(d) - 4, 5)]


out['nouveau'] = dict(heros=heros(os.path.join(SRC, 'FicOriginale', 'HerosDefault.gdf')),
                      coffres=coffres(os.path.join(SRC, 'FicOriginale', 'Coffres.gdf')))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
print('wrote', OUT, {k: len(v) for k, v in out.items() if isinstance(v, list)})


# ---------------- maps ----------------
REC = 25
DIMS = {'carte1': (160, 72), 'ville1': (48, 36), 'ville2': (48, 36), 'ville3': (48, 36)}


def find_ci(folder, name):
    for f in os.listdir(folder):
        if f.lower() == name.lower():
            return os.path.join(folder, f)
    raise FileNotFoundError(name)


def read_map(path):
    data = open(path, 'rb').read()
    n = (len(data) + REC - 1) // REC
    data = data + b'\0' * (n * REC - len(data))
    tiles = []
    for i in range(n):
        r = data[i * REC:(i + 1) * REC]
        ln = struct.unpack_from('<H', r, 0)[0]
        chemin = r[2:2 + ln].decode('cp1252').replace('\\', '/').lower()
        act = struct.unpack_from('<h', r, 2 + ln)[0] != 0 if 2 + ln + 2 <= REC else False
        acn = struct.unpack_from('<h', r, 4 + ln)[0] != 0 if 4 + ln + 2 <= REC else False
        tiles.append((chemin, act, acn))
    return tiles


def load_maps(folder):
    return {k: read_map(find_ci(folder, k + '.map')) for k in DIMS}


orig = load_maps(os.path.join(SRC, 'FicOriginale'))
maps_out = {}
for k, (w, h) in DIMS.items():
    t = orig[k][:w * h]
    paths = sorted(set(c for c, _, _ in t))
    maps_out[k] = dict(w=w, h=h, paths=paths, tile=[paths.index(c) for c, _, _ in t],
                       active=''.join('1' if a else '0' for _, a, _ in t),
                       action=''.join('1' if a else '0' for _, _, a in t))
out['maps'] = maps_out


def map_diff(m):
    d = []
    for k, (w, h) in DIMS.items():
        for i, (a, b) in enumerate(zip(orig[k][:w * h], m[k][:w * h])):
            if a != b:
                d.append([k, i, b[0], b[1], b[2]])
    return d


saves = {}
for n in ('1', '2', '3'):
    f = os.path.join(SRC, 'Sauvegarde', n)
    saves[n] = dict(heros=heros(find_ci(f, 'herosdefault.gdf')), coffres=coffres(find_ci(f, 'coffres.gdf')),
                    mapDiff=map_diff(load_maps(f)))
out['savesOriginales'] = saves
json.dump(out, open(OUT, 'w'), ensure_ascii=False)
print('maps', {k: (v['w'], v['h'], len(v['tile'])) for k, v in maps_out.items()},
      'saves diffs', {k: len(v['mapDiff']) for k, v in saves.items()})
