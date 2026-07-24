# Jahresurlaub — Bikecenter Meyer

Zwei Skripte im selben Design wie die übrigen Schilder (`../door-sign/`,
`../social-closed/`), für den Jahresurlaub:

- **`make_vacation_sign.py`** — druckfertiges A4-Türschild
  (`vacation_sign.png` + `vacation_sign.pdf`, 2480×3508 px @ 300 dpi)
- **`make_vacation_social.py`** — Social-Media-Grafiken
  (`ig_feed.png` 1080×1350, `ig_story.png` 1080×1920, `fb_square.png` 1080×1080)
  plus `social_urlaub.pdf`. Mit prominenter Rückkehr-Botschaft
  „Ab Montag 17. August 2026 wieder da".

## Setup

1. Fonts in `fonts/` ablegen:
   - `BigShoulders-Bold.ttf`
   - `BigShoulders-Regular.ttf`
   - `GeistMono-Regular.ttf`
   - `GeistMono-Bold.ttf`
2. Bike-Icon (weiß, transparenter Hintergrund) als PNG unter `assets/bike-icon.png` ablegen.
3. `pip install Pillow`
4. `python make_vacation_sign.py` und/oder `python make_vacation_social.py`

Ergebnisse landen in `output/`.

## Urlaubszeitraum anpassen

Beide Skripte haben ihre Konfiguration ganz oben. `CLOSURE_ENTRIES` ist eine
Liste (Datum + Text pro Eintrag). Im Social-Skript wird die Rückkehr zusätzlich
über `RETURN_DE`/`RETURN_FR` groß hervorgehoben.
