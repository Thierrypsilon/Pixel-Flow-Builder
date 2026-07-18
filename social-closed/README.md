# Social-Media-Grafiken „GESCHLOSSEN" — Bikecenter Meyer

Erzeugt `ig_feed.png` (1080×1350), `ig_story.png` (1080×1920), `fb_square.png`
(1080×1080) sowie `social_geschlossen.pdf`, im selben Design wie das Türschild
(`../door-sign/`). Unterstützt beliebig viele Schließtage über `CLOSURE_ENTRIES`.

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

`CLOSURE_ENTRIES` in `make_social.py` ist eine Liste — pro Schließtag ein
Eintrag mit `day_de`/`day_fr` (Datum) und `detail_de`/`detail_fr` (Uhrzeit/Grund).
Beliebig viele Einträge möglich, das Layout passt sich automatisch an.
