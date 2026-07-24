# Service-Tipp-Karte — Bikecenter Meyer

A5-Handzettel zum Mitgeben (`service_card.png` + `service_card.pdf`,
1748×2480 px @ 300 dpi), im selben Design wie die übrigen Schilder. Bittet
Kund:innen freundlich, ihr Rad in der ruhigen Jahreszeit (Herbst/Winter/Frühjahr)
statt im Hochsommer zum Service zu bringen.

## Setup

1. Fonts in `fonts/` ablegen:
   - `BigShoulders-Bold.ttf`
   - `BigShoulders-Regular.ttf`
   - `GeistMono-Regular.ttf`
   - `GeistMono-Bold.ttf`
2. `pip install Pillow`
3. `python make_service_card.py`

Ergebnis landet in `output/`. Kein Icon nötig.

## Texte anpassen

Alle Texte stehen als Konstanten oben in `make_service_card.py`
(`HEADLINE_LINES`, `BAND_FR`, `BODY_DE`/`BODY_FR`, `HIGHLIGHT`, `THANKS_*`).
Der Fließtext wird automatisch umbrochen.
