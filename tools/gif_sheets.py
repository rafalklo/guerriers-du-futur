"""Explode animated GIFs into horizontal PNG sprite sheets + frame delays.

usage: python3 -I gif_sheets.py <assets dir> <out json> <subdir> [<subdir> ...]
For every assets/<subdir>/*.gif with >1 frame writes <name>.sheet.webp next to it.
JSON: { "<subdir>/<name>.gif": {"w":..,"h":..,"n":..,"delays":[ms,...]} }
"""
import json
import os
import sys

from PIL import Image, ImageSequence

root, out = sys.argv[1], sys.argv[2]
meta = json.load(open(out)) if os.path.exists(out) else {}
for sub in sys.argv[3:]:
    d = os.path.join(root, sub)
    for f in sorted(os.listdir(d)):
        if not f.lower().endswith('.gif') or f.endswith('.sheet.webp'):
            continue
        p = os.path.join(d, f)
        im = Image.open(p)
        frames, delays = [], []
        for fr in ImageSequence.Iterator(im):
            frames.append(fr.convert('RGBA'))
            delays.append(fr.info.get('duration', 0))
        w, h = im.size
        sheet = Image.new('RGBA', (w * len(frames), h))
        for i, fr in enumerate(frames):
            sheet.paste(fr, (i * w, 0))
        sheet_name = os.path.splitext(f)[0].lower() + '.sheet.webp'
        sheet.save(os.path.join(d, sheet_name), optimize=True)
        # also a static first-frame png for <img> use
        frames[0].save(os.path.join(d, os.path.splitext(f)[0].lower() + '.f0.png'))
        meta[f'{sub}/{f.lower()}'] = dict(w=w, h=h, n=len(frames), delays=delays)
        print(sub, f, w, h, len(frames))
json.dump(meta, open(out, 'w'), indent=0)
