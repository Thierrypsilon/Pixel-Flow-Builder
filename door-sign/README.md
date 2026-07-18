# Türschild "GESCHLOSSEN" — Bikecenter Meyer

Erzeugt ein druckfertiges A4-Türschild (`door_sign.png` + `door_sign.pdf`,
2480×3508 px @ 300 dpi) im selben Design wie die Social-Media-Grafiken
(`../social-closed/`).

## Setup

1. Fonts in `fonts/` ablegen:
   - `BigShoulders-Bold.ttf`
   - `BigShoulders-Regular.ttf`
   - `GeistMono-Regular.ttf`
   - `GeistMono-Bold.ttf`
2. Bike-Icon (weiß, transparenter Hintergrund) als PNG unter `assets/bike-icon.png` ablegen.
3. `pip install Pillow`
4. `python make_door_sign.py`

Ergebnis landet in `output/`.

## Schließtage anpassen

`CLOSURE_ENTRIES` in `make_door_sign.py` ist eine Liste — pro Schließtag ein
Eintrag mit `day_de`/`day_fr` (Datum) und `detail_de`/`detail_fr` (Uhrzeit/Grund).
Beliebig viele Einträge möglich, das Layout passt sich automatisch an.
