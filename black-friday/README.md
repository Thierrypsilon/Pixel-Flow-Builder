# Black Friday — Bikecenter Meyer

Aktion: **5 % Zusatzrabatt auf alle Fahrräder** und **10 % Rabatt auf alle
Zubehörartikel**, gültig **Freitag 27. und Samstag 28. November 2026**.

Zwei Skripte:

- **`make_bf_poster.py`** — A4-Schaufensterplakat (`bf_poster.png` / `.pdf`,
  2480×3508 px @ 300 dpi). Schwarz-Weiß (`MONOCHROME = True`), weißer
  Hintergrund — tonersparend auf einem S/W-Drucker.
- **`make_bf_social.py`** — Instagram Feed (1080×1350), Story (1080×1920) und
  Facebook-Quadrat (1080×1080) plus `bf_social.pdf`. Dunkler Black-Friday-Look
  (`DARK_MODE = True`): schwarzer Hintergrund, Orange-Akzentband. Auf `False`
  für die helle Papierweiß-Variante der übrigen Grafiken.

## Setup

1. Fonts in `fonts/` ablegen:
   - `BigShoulders-Bold.ttf`
   - `BigShoulders-Regular.ttf`
   - `GeistMono-Regular.ttf`
   - `GeistMono-Bold.ttf`
2. `pip install Pillow`
3. `python make_bf_poster.py` und/oder `python make_bf_social.py`

Ergebnisse landen in `output/`. Beim Drucken „Tatsächliche Größe / 100 %"
wählen, nicht „an Seite anpassen".

## Angebote anpassen

`CLOSURE_ENTRIES` ist eine Liste — ein Eintrag pro Angebot, mit `day_de`/`day_fr`
(Rabatt) und `detail_de`/`detail_fr` (worauf). Beliebig viele Einträge möglich.
Zeitraum steht in `MESSAGE_HEADLINE_FR` (Orange-Band) und `REASON_DE`/`REASON_FR`.

## Post-Texte

Die fertigen Captions für Instagram und Facebook (DE/FR) stehen in
[`post-texte.md`](post-texte.md) — inklusive Posting-Plan.
