# Türschild "AUSNAHMSWEISE GESCHLOSSEN" — Bikecenter Meyer

Erzeugt ein druckfertiges A4-Türschild (`door_sign.png` + `door_sign.pdf`,
2480×3508 px @ 300 dpi) für einen einzelnen ausnahmsweisen Schließtag, im
selben Design wie die übrigen Schilder (`../vacation-sign/`, `../service-tip/`).

Standardmäßig **Schwarz-Weiß** (`MONOCHROME = True`): weißer Hintergrund,
Akzentband schwarz mit weißer Schrift — sauber auf einem S/W-Drucker. Auf
`False` stellen für die farbige Orange-Version. Kein Bike-Icon
(`SHOW_ICON = False`).

## Setup

1. Fonts in `fonts/` ablegen:
   - `BigShoulders-Bold.ttf`
   - `BigShoulders-Regular.ttf`
   - `GeistMono-Regular.ttf`
   - `GeistMono-Bold.ttf`
2. `pip install Pillow`
3. `python make_door_sign.py`

Ergebnis landet in `output/`. Beim Ausdrucken „Tatsächliche Größe / 100 %"
wählen, nicht „an Seite anpassen".

## Schließtage anpassen

Alle Texte stehen als Konstanten oben in `make_door_sign.py`.
`CLOSURE_ENTRIES` ist eine Liste — pro Schließtag ein Eintrag mit
`day_de`/`day_fr` (Datum) und `detail_de`/`detail_fr` (Uhrzeit/Grund).
Beliebig viele Einträge möglich, das Layout passt sich automatisch an.
`REASON_DE`/`REASON_FR` ist die Zeile darunter (z.B. ab wann wieder geöffnet).
