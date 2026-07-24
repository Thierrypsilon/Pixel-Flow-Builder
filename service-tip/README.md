# Service-Tipp-Karte — Bikecenter Meyer

Handzettel zum Mitgeben, im selben Design wie die übrigen Schilder. Bittet
Kund:innen freundlich, ihr Rad in der ruhigen Jahreszeit (Herbst/Winter/Frühjahr)
statt im Hochsommer zum Service zu bringen.

Erzeugt in einem Durchlauf:
- `service_card.png` / `.pdf` — einzelne, schmale Hochformat-Karte (ca. 99×210 mm)
- `service_card_3up_a4.png` / `.pdf` — **A4 quer mit 3 Karten nebeneinander**,
  inkl. gestrichelter Schnittlinien und Eck-Marken zum Ausschneiden

## Setup

1. Fonts in `fonts/` ablegen:
   - `BigShoulders-Bold.ttf`
   - `BigShoulders-Regular.ttf`
   - `GeistMono-Regular.ttf`
   - `GeistMono-Bold.ttf`
2. `pip install Pillow`
3. `python make_service_card.py`

Ergebnis landet in `output/`. Kein Icon nötig. Anzahl Karten pro Blatt über
`COPIES_PER_SHEET` einstellbar.

## Texte anpassen

Alle Texte stehen als Konstanten oben in `make_service_card.py`
(`HEADLINE_LINES`, `BAND_FR`, `BODY_DE`/`BODY_FR`, `HIGHLIGHT`, `THANKS_*`).
Der Fließtext wird automatisch umbrochen.
