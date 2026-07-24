# Türschild "JAHRESURLAUB" — Bikecenter Meyer

Erzeugt ein druckfertiges A4-Türschild (`vacation_sign.png` + `vacation_sign.pdf`,
2480×3508 px @ 300 dpi) im selben Design wie die übrigen Schilder
(`../door-sign/`, `../social-closed/`), für den Jahresurlaub.

## Setup

1. Fonts in `fonts/` ablegen:
   - `BigShoulders-Bold.ttf`
   - `BigShoulders-Regular.ttf`
   - `GeistMono-Regular.ttf`
   - `GeistMono-Bold.ttf`
2. Bike-Icon (weiß, transparenter Hintergrund) als PNG unter `assets/bike-icon.png` ablegen.
3. `pip install Pillow`
4. `python make_vacation_sign.py`

Ergebnis landet in `output/`.

## Urlaubszeitraum anpassen

`CLOSURE_ENTRIES` in `make_vacation_sign.py` ist eine Liste — der erste Eintrag
ist der geschlossene Zeitraum, der zweite die Wiedereröffnung. Pro Eintrag:
`day_de`/`day_fr` (Datum) und `detail_de`/`detail_fr` (Text). Beliebig viele
Einträge möglich, das Layout passt sich automatisch an.
