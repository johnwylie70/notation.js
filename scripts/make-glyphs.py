#!/usr/bin/env python3
"""The outlines of the music symbols staves.js draws, taken from a SMuFL font and written into staves.js.

    python3 -m pip install fonttools
    python3 scripts/make-glyphs.py /path/to/Leland.otf /path/to/leland_metadata.json /path/to/glyphnames.json

Leland is MuseScore's font (https://github.com/MuseScoreFonts/Leland), under the SIL Open Font
Licence 1.1; glyphnames.json is SMuFL's (https://github.com/w3c/smufl, metadata/). Each outline is
written as an SVG path in the font's own units (1000 to the em, so 250 to the gap between two staff
lines), with y turned to run down the page as a canvas has it. What is written goes between the
GLYPHS:BEGIN and GLYPHS:END lines of staves.js; nothing else is touched. The outlines stay under
the font's licence: see LICENSE-GLYPHS.
"""
import json
import os
import re
import sys

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

NAMES = """gClef fClef unpitchedPercussionClef1
noteheadBlack noteheadHalf noteheadWhole noteheadXBlack
flag8thUp flag8thDown flag16thUp flag16thDown flag32ndUp flag32ndDown
restWhole restHalf restQuarter rest8th rest16th rest32nd
brace
accidentalSharp accidentalFlat accidentalNatural
timeSig0 timeSig1 timeSig2 timeSig3 timeSig4 timeSig5 timeSig6 timeSig7 timeSig8 timeSig9
wiggleArpeggiatoUp""".split()


class Path(BasePen):
    """An outline as a short SVG path: whole numbers, each point given from the last."""

    def __init__(self, glyphs):
        super().__init__(glyphs)
        self.out = []
        self.at = (0, 0)

    def _rel(self, pt):
        x, y = round(pt[0]), round(-pt[1])
        dx, dy = x - self.at[0], y - self.at[1]
        self.at = (x, y)
        return "%d %d" % (dx, dy)

    def _moveTo(self, pt):
        self.out.append("m" + self._rel(pt))
        self.start = self.at

    def _lineTo(self, pt):
        self.out.append("l" + self._rel(pt))

    def _curveToOne(self, a, b, c):
        start = self.at
        parts = []
        for pt in (a, b, c):
            x, y = round(pt[0]), round(-pt[1])
            parts.append("%d %d" % (x - start[0], y - start[1]))
        self.at = (round(c[0]), round(-c[1]))
        self.out.append("c" + " ".join(parts))

    def _closePath(self):
        self.out.append("z")
        self.at = self.start  # closing a path takes the pen back to where the path began

    def text(self):
        return re.sub(r" -", "-", "".join(self.out))


def main():
    font_path, meta_path, names_path = sys.argv[1:4]
    font = TTFont(font_path)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    codes = json.load(open(names_path))
    meta = json.load(open(meta_path))
    assert font["head"].unitsPerEm == 1000
    lines = []
    for name in NAMES:
        glyph = glyphs[cmap[int(codes[name]["codepoint"][2:], 16)]]
        pen = Path(glyphs)
        glyph.draw(pen)
        box = meta["glyphBBoxes"][name]
        # left, top, right, bottom of the ink in font units (y down), then the outline
        l, r = round(box["bBoxSW"][0] * 250), round(box["bBoxNE"][0] * 250)
        t, b = round(-box["bBoxNE"][1] * 250), round(-box["bBoxSW"][1] * 250)
        lines.append("  %s: [%d, %d, %d, %d, '%s']," % (name, l, t, r, b, pen.text()))
    anchors = {}
    for name in ("noteheadBlack", "noteheadHalf", "noteheadXBlack"):
        a = meta["glyphsWithAnchors"][name]
        anchors[name] = [round(a["stemUpSE"][0] * 250), round(-a["stemUpSE"][1] * 250), round(a["stemDownNW"][0] * 250), round(-a["stemDownNW"][1] * 250)]
    d = meta["engravingDefaults"]
    keep = {k: d[k] for k in ("staffLineThickness", "stemThickness", "beamThickness", "beamSpacing", "legerLineThickness", "legerLineExtension", "thinBarlineThickness", "thickBarlineThickness", "barlineSeparation", "tieEndpointThickness", "tieMidpointThickness") if k in d}
    block = ("/* GLYPHS:BEGIN */\n// %s %s. Written by scripts/make-glyphs.py; do not edit by hand.\n"
             "const GLYPHS = {\n%s\n}\n// Where a stem meets its note head: up-stem x, y, down-stem x, y (font units).\nconst STEM_AT = %s\n"
             "// The font's own thicknesses, in staff spaces.\nconst ENGRAVING = %s\n/* GLYPHS:END */") % (
        meta.get("fontName", "Leland"), meta.get("fontVersion", ""), "\n".join(lines),
        json.dumps(anchors).replace('"', ""), json.dumps(keep).replace('"', ""))
    target = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "staves.js")
    if os.path.exists(target):
        text = open(target, encoding="utf-8").read()
        if "/* GLYPHS:BEGIN */" in text:
            text = re.sub(r"/\* GLYPHS:BEGIN \*/.*?/\* GLYPHS:END \*/", lambda m: block, text, flags=re.S)
            open(target, "w", encoding="utf-8").write(text)
            print("staves.js: %d glyphs, %d bytes" % (len(NAMES), len(block)))
            return
    print(block)


main()
