#!/usr/bin/env python3
"""
make_bike_icon.py — erzeugt ein schlichtes, lizenzfreies Fahrrad-Piktogramm
(weiße Linien auf transparentem Hintergrund) für die Schilder- und Social-Skripte.

Das Ergebnis ist ein PNG, das die Skripte über `load_bike_icon()` einlesen und
in die Tinten-Farbe umfärben. Weiß = Motiv, transparent = Hintergrund.

Ausführen:
    python make_bike_icon.py [ziel.png]

Standard-Ziel ist ./bike-icon.png. Für ein Skript z.B.:
    python make_bike_icon.py vacation-sign/assets/bike-icon.png
"""

import sys

from PIL import Image, ImageDraw

SS = 4  # Supersampling, danach LANCZOS-Downscale
W, H = 600, 380

# Anker im 600x380-Raster
REAR_HUB = (130, 248)
FRONT_HUB = (470, 248)
BB = (298, 250)     # Tretlager (Spitze des vorderen Dreiecks, über dem Vorderrad)
SEAT = (226, 122)   # oberes Ende des Sattelrohrs
STEM = (386, 120)   # oberes Ende des Steuerrohrs (Lenker-Anschluss)
WHEEL_R = 90

WHITE = (255, 255, 255, 255)


def build(target_path):
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    stroke = int(round(18 * SS))

    def s2(p):
        return (int(round(p[0] * SS)), int(round(p[1] * SS)))

    def line(a, b, w=stroke):
        d.line([s2(a), s2(b)], fill=WHITE, width=w, joint="curve")

    def dot(p, r=None):
        if r is None:
            r = stroke // 2
        cx, cy = s2(p)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)

    def ring(p, radius, w):
        cx, cy = s2(p)
        rr = int(round(radius * SS))
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=WHITE, width=w)

    # Räder
    ring(REAR_HUB, WHEEL_R, stroke)
    ring(FRONT_HUB, WHEEL_R, stroke)
    dot(REAR_HUB, int(round(9 * SS)))
    dot(FRONT_HUB, int(round(9 * SS)))

    # Rahmen (sauberes Diamant-Design)
    frame = [
        (SEAT, STEM),        # Oberrohr
        (SEAT, BB),          # Sattelrohr
        (STEM, BB),          # Unterrohr
        (STEM, FRONT_HUB),   # Steuerrohr / Gabel
        (BB, REAR_HUB),      # Kettenstrebe
        (SEAT, REAR_HUB),    # Sitzstrebe
    ]
    for a, b in frame:
        line(a, b)
    for p in (REAR_HUB, FRONT_HUB, BB, SEAT, STEM):
        dot(p)

    # dezente Kurbel-Nabe (ohne störendes Pedal)
    ring(BB, 15, int(round(9 * SS)))

    # Lenker: Vorbau hoch, flacher Griff, kleiner Aufschwung zum Fahrer hin
    bar_stem_top = (388, 104)
    bar_front = (424, 100)
    bar_back = (360, 106)
    bar_hook = (356, 84)
    line(STEM, bar_stem_top)
    line(bar_back, bar_front)
    line(bar_back, bar_hook)
    for p in (bar_stem_top, bar_front, bar_back, bar_hook):
        dot(p)

    # Sattel: schmale Nase nach vorne (links)
    sad_back = (250, 108)
    sad_nose = (198, 114)
    line(sad_nose, sad_back, w=int(round(15 * SS)))
    dot(sad_back, int(round(8 * SS)))
    dot(sad_nose, int(round(6 * SS)))

    img = img.resize((W, H), Image.LANCZOS)
    img.save(target_path)
    print(f"Fahrrad-Piktogramm gespeichert: {target_path}  ({W} x {H} px)")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "bike-icon.png"
    build(target)
