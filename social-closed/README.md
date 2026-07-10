# Social-Media-Grafiken „HEUTE GESCHLOSSEN" — Bikecenter Meyer

Erzeugt `ig_feed.png` (1080×1350), `ig_story.png` (1080×1920), `fb_square.png`
(1080×1080) sowie `social_geschlossen.pdf` im Design des bestehenden Türschilds.

## Setup

1. Fonts in `fonts/` ablegen:
   - `BigShoulders-Bold.ttf`
   - `BigShoulders-Regular.ttf`
   - `GeistMono-Regular.ttf`
   - `GeistMono-Bold.ttf`
2. Bike-Icon (weiß, transparenter Hintergrund) als PNG unter `assets/bike-icon.png` ablegen.
3. `pip install Pillow`
4. `python make_social.py`

Ergebnisse landen in `output/`.

## Nächsten Schließtag eintragen

Alle Texte, Datum und Grund stehen als Konstanten ganz oben in `make_social.py`
(`MESSAGE_HEADLINE_DE`, `REASON_DE`/`REASON_FR`, `DATE_DE`/`DATE_FR`, …).
