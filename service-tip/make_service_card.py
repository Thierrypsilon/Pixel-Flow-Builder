#!/usr/bin/env python3
"""
make_service_card.py — A5-Handzettel "Service-Tipp" für Bikecenter Meyer.

Kleine Karte zum Mitgeben: freundlicher Hinweis, das Fahrrad am besten in der
ruhigen Jahreszeit (Herbst, Winter, Frühjahr) zum Service zu bringen statt im
Hochsommer, wenn die Werkstatt voll ist. Gleiche Design-Sprache wie die
übrigen Schilder (Papierweiß, Graphit-Tinte, Signal-Orange-Akzentband,
Big-Shoulders-Headline, Mono-Detailtext).

Ausführen:
    python make_service_card.py
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFont

# ============================================================
# KONFIGURATION — Texte hier anpassen
# ============================================================

BRAND = "BIKECENTER MEYER"
ADDRESS = "Malmedyer Str. 66 · 4780 Sankt Vith"

MARKER_TEXT = "— SERVICE-TIPP · CONSEIL SERVICE —"

# Mehrzeilige Headline (jede Zeile eigener Eintrag, gemeinsame Größe)
HEADLINE_LINES = ["AM BESTEN IN DER", "RUHIGEN ZEIT"]
BAND_FR = "HORS SAISON, C'EST L'IDÉAL"

BODY_DE = ("Bringen Sie Ihr Fahrrad am besten im Herbst, Winter oder Frühjahr "
           "zum Service. Im Hochsommer ist unsere Werkstatt oft randvoll — die "
           "Wartezeiten werden dann schnell lang.")
BODY_FR = ("Confiez-nous votre vélo de préférence en automne, en hiver ou au "
           "printemps. En plein été, notre atelier est souvent débordé et les "
           "délais s'allongent vite.")

# Hervorgehobener Kasten
HIGHLIGHT = {
    "day_de": "HERBST · WINTER · FRÜHJAHR",
    "day_fr": "Automne · hiver · printemps",
    "detail_de": "Die ideale Zeit für Service & Reparatur",
    "detail_fr": "Le moment idéal pour l'entretien et les réparations",
}

THANKS_DE = "Danke — so hat Ihr Rad die Zeit, die es verdient"
THANKS_FR = "Merci — votre vélo aura tout le soin qu'il mérite"

FONT_DIR = "./fonts"
OUTPUT_DIR = "./output"

# A5 bei 300 dpi (148 x 210 mm)
PAGE_W = 1748
PAGE_H = 2480

SS = 2  # Supersampling-Faktor (Rendern in 2x, dann LANCZOS-Downscale)

# Farben (exakt)
PAPER = (243, 240, 233)
PAPER_DK = (233, 229, 220)
INK = (26, 26, 24)
INK_SOFT = (74, 72, 68)
ORANGE = (232, 93, 24)
ORANGE_DK = (196, 74, 14)
HAIRLINE = (200, 195, 185)

FONT_FILES = {
    "shoulders_bold": "BigShoulders-Bold.ttf",
    "shoulders_regular": "BigShoulders-Regular.ttf",
    "mono_regular": "GeistMono-Regular.ttf",
    "mono_bold": "GeistMono-Bold.ttf",
}

# Layout-Basiswerte, definiert für eine Referenzbreite von 1080px
# (scale = W / 1080 skaliert sie auf die tatsächliche Canvas-Breite).
MARGIN_X = 104
MARGIN_TOP = 96
MARGIN_BOTTOM = 96

MARKER_SIZE = 20
MARKER_TRACKING = 3.0
GAP_MARKER_BRAND = 44

BRAND_SIZE = 34
BRAND_TRACKING = 5
GAP_BRAND_HAIRLINE = 18

HAIRLINE_WIDTH = 210
HAIRLINE_THICK = 2
GAP_HAIRLINE_HEADLINE = 42

HEADLINE_SIZE = 116
HEADLINE_TRACKING = 0
HEADLINE_LINE_GAP = 6
GAP_HEADLINE_BAND = 34

BAND_FONT_SIZE = 54
BAND_TRACKING = 0
BAND_PAD_Y = 24
GAP_BAND_BODY = 44

BODY_DE_SIZE = 27
BODY_FR_SIZE = 23
BODY_LINE_GAP = 9
GAP_BODY_DE_FR = 20
GAP_BODY_HIGHLIGHT = 44

HIGHLIGHT_PAD_X = 40
HIGHLIGHT_PAD_Y = 32
HIGHLIGHT_DAY_SIZE = 27
HIGHLIGHT_DAY_TRACKING = 1.4
HIGHLIGHT_DAYFR_SIZE = 20
HIGHLIGHT_DETAIL_SIZE = 23
HIGHLIGHT_DETAILFR_SIZE = 18
HIGHLIGHT_LINE_GAP = 6
HIGHLIGHT_ROW_GAP = 12
TICK_W = 46
TICK_H = 10
BORDER_THICK = 2
GAP_HIGHLIGHT_FOOTER = 46

FOOTER_ADDR_SIZE = 20
FOOTER_THANKS_SIZE = 17
FOOTER_LINE_GAP = 10


# ============================================================
# Asset-Prüfung — kein stiller Fallback
# ============================================================

def check_assets():
    missing = []
    for filename in FONT_FILES.values():
        path = os.path.join(FONT_DIR, filename)
        if not os.path.isfile(path):
            missing.append(path)
    if missing:
        listed = "\n".join(f"  - {p}" for p in missing)
        sys.exit(
            "FEHLER: Folgende Font-Datei(en) wurden nicht gefunden:\n"
            f"{listed}\n\n"
            "Bitte lege die vier Fonts (BigShoulders-Bold.ttf, BigShoulders-Regular.ttf,\n"
            "GeistMono-Regular.ttf, GeistMono-Bold.ttf) in FONT_DIR ab. Es gibt keinen\n"
            "stillen Fallback — das Skript bricht bewusst ab."
        )


# ============================================================
# Font-Cache
# ============================================================

_FONT_CACHE = {}


def font_at(path, size):
    size = max(1, int(round(size)))
    key = (path, size)
    font = _FONT_CACHE.get(key)
    if font is None:
        font = ImageFont.truetype(path, size)
        _FONT_CACHE[key] = font
    return font


# ============================================================
# Getrackter Text: Messen & Zeichnen
# ============================================================

def text_width_tracked(draw, text, font, tracking=0):
    if not text:
        return 0
    width = sum(draw.textlength(ch, font=font) for ch in text)
    width += tracking * (len(text) - 1)
    return width


def tracked_text_metrics(draw, text, font, tracking=0):
    if not text:
        return {"width": 0, "height": 0, "top": 0}
    width = text_width_tracked(draw, text, font, tracking)
    bbox = draw.textbbox((0, 0), text, font=font)
    return {"width": width, "height": bbox[3] - bbox[1], "top": bbox[1]}


def draw_text_tracked(draw, x, y, text, font, fill, tracking=0, align="left"):
    """Zeichnet `text` mit Buchstaben-Tracking. (x, y) ist die visuelle
    Oben-Position (top-left/top-center/top-right je nach `align`)."""
    if not text:
        return 0
    metrics = tracked_text_metrics(draw, text, font, tracking)
    width = metrics["width"]
    if align == "center":
        cursor_x = x - width / 2
    elif align == "right":
        cursor_x = x - width
    else:
        cursor_x = x
    draw_y = y - metrics["top"]
    for ch in text:
        draw.text((cursor_x, draw_y), ch, font=font, fill=fill)
        cursor_x += draw.textlength(ch, font=font) + tracking
    return width


def fit_font_size(draw, text, font_path, max_width, start_size, tracking=0, min_size=8, step=2):
    """Reduziert die Schriftgröße schrittweise, bis `text` in `max_width` passt."""
    size = max(min_size, int(round(start_size)))
    if max_width <= 0:
        return size
    while size > min_size:
        f = font_at(font_path, size)
        if text_width_tracked(draw, text, f, tracking) <= max_width:
            return size
        size -= step
    return min_size


def fit_uniform_size(draw, texts, font_path, max_width, start_size, tracking=0):
    """Gemeinsame Größe für mehrere Texte, damit sie visuell konsistent bleiben."""
    size = start_size
    for text in texts:
        size = min(size, fit_font_size(draw, text, font_path, max_width, size, tracking=tracking))
    return size


def wrap_lines(draw, text, font, max_width):
    """Greedy-Wortumbruch auf `max_width`."""
    words = text.split()
    lines = []
    cur = ""
    for w in words:
        trial = w if not cur else cur + " " + w
        if draw.textlength(trial, font=font) <= max_width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ============================================================
# Layout-Blöcke
# ============================================================

def build_blocks(draw, ss_w, scale, ss, content_scale, gap_mult, font_paths):
    cx = ss_w / 2

    def M(base):
        return base * scale * ss

    def U(base):
        return base * scale * ss * content_scale

    def GAP(base):
        return base * scale * ss * content_scale * gap_mult

    avail_w = ss_w - 2 * M(MARGIN_X)

    def make_text_block(text, font_path, base_size, tracking_base, color, gap_after_base):
        tracking = U(tracking_base)
        size = fit_font_size(draw, text, font_path, avail_w, U(base_size), tracking=tracking)
        font = font_at(font_path, size)
        metrics = tracked_text_metrics(draw, text, font, tracking)

        def _draw(top):
            draw_text_tracked(draw, cx, top, text, font, color, tracking=tracking, align="center")

        return {"height": metrics["height"], "gap_after": GAP(gap_after_base), "draw": _draw}

    def make_hairline_block(width_base, thick_base, gap_after_base):
        width = U(width_base)
        thick = max(1, U(thick_base))

        def _draw(top):
            y0 = top + thick / 2
            draw.line([(cx - width / 2, y0), (cx + width / 2, y0)], fill=HAIRLINE, width=int(round(thick)))

        return {"height": thick, "gap_after": GAP(gap_after_base), "draw": _draw}

    def make_headline_block(lines, gap_after_base):
        tracking = U(HEADLINE_TRACKING)
        size = fit_uniform_size(draw, lines, font_paths["shoulders_bold"], avail_w, U(HEADLINE_SIZE), tracking=tracking)
        font = font_at(font_paths["shoulders_bold"], size)
        line_gap = U(HEADLINE_LINE_GAP)
        mets = [tracked_text_metrics(draw, ln, font, tracking) for ln in lines]
        height = sum(m["height"] for m in mets) + line_gap * (len(lines) - 1)

        def _draw(top):
            y = top
            for ln, m in zip(lines, mets):
                draw_text_tracked(draw, cx, y, ln, font, INK, tracking=tracking, align="center")
                y += m["height"] + line_gap

        return {"height": height, "gap_after": GAP(gap_after_base), "draw": _draw}

    def make_band_block(text, gap_after_base):
        tracking = U(BAND_TRACKING)
        size = fit_font_size(draw, text, font_paths["shoulders_bold"], avail_w, U(BAND_FONT_SIZE), tracking=tracking)
        font = font_at(font_paths["shoulders_bold"], size)
        metrics = tracked_text_metrics(draw, text, font, tracking)
        pad_y = U(BAND_PAD_Y)
        band_height = metrics["height"] + 2 * pad_y

        def _draw(top):
            draw.rectangle([0, top, ss_w, top + band_height], fill=ORANGE)
            draw_text_tracked(draw, cx, top + pad_y, text, font, PAPER, tracking=tracking, align="center")

        return {"height": band_height, "gap_after": GAP(gap_after_base), "draw": _draw}

    def make_paragraph_block(text, size_base, color, gap_after_base, font_path, width_frac=0.98):
        size = U(size_base)
        font = font_at(font_path, size)
        max_w = avail_w * width_frac
        lines = wrap_lines(draw, text, font, max_w)
        asc, desc = font.getmetrics()
        lh = asc + desc
        line_gap = U(BODY_LINE_GAP)
        height = len(lines) * lh + line_gap * (len(lines) - 1)

        def _draw(top):
            y = top
            for ln in lines:
                draw_text_tracked(draw, cx, y, ln, font, color, tracking=0, align="center")
                y += lh + line_gap

        return {"height": height, "gap_after": GAP(gap_after_base), "draw": _draw}

    def make_highlight_block(entry, gap_after_base):
        pad_x = U(HIGHLIGHT_PAD_X)
        pad_y = U(HIGHLIGHT_PAD_Y)
        line_gap = U(HIGHLIGHT_LINE_GAP)
        row_gap = U(HIGHLIGHT_ROW_GAP)
        inner_max_w = avail_w - 2 * pad_x
        day_tracking = U(HIGHLIGHT_DAY_TRACKING)

        size_day = fit_font_size(draw, entry["day_de"], font_paths["mono_bold"], inner_max_w, U(HIGHLIGHT_DAY_SIZE), tracking=day_tracking)
        size_dayfr = fit_font_size(draw, entry["day_fr"], font_paths["mono_regular"], inner_max_w, U(HIGHLIGHT_DAYFR_SIZE))
        size_detail = fit_font_size(draw, entry["detail_de"], font_paths["mono_regular"], inner_max_w, U(HIGHLIGHT_DETAIL_SIZE))
        size_detailfr = fit_font_size(draw, entry["detail_fr"], font_paths["mono_regular"], inner_max_w, U(HIGHLIGHT_DETAILFR_SIZE))

        f_day = font_at(font_paths["mono_bold"], size_day)
        f_dayfr = font_at(font_paths["mono_regular"], size_dayfr)
        f_detail = font_at(font_paths["mono_regular"], size_detail)
        f_detailfr = font_at(font_paths["mono_regular"], size_detailfr)

        m_day = tracked_text_metrics(draw, entry["day_de"], f_day, day_tracking)
        m_dayfr = tracked_text_metrics(draw, entry["day_fr"], f_dayfr, 0)
        m_detail = tracked_text_metrics(draw, entry["detail_de"], f_detail, 0)
        m_detailfr = tracked_text_metrics(draw, entry["detail_fr"], f_detailfr, 0)

        inner_h = (m_day["height"] + line_gap + m_dayfr["height"] + row_gap
                   + m_detail["height"] + line_gap + m_detailfr["height"])
        box_h = inner_h + 2 * pad_y
        box_w = avail_w
        tick_w = U(TICK_W)
        tick_h = U(TICK_H)
        border = max(1, U(BORDER_THICK))
        total_h = box_h + tick_h / 2

        def _draw(top):
            box_top = top + tick_h / 2
            box_left = cx - box_w / 2
            box_right = cx + box_w / 2
            draw.rectangle([box_left, box_top, box_right, box_top + box_h],
                            outline=HAIRLINE, width=int(round(border)))
            draw.rectangle([cx - tick_w / 2, box_top - tick_h / 2, cx + tick_w / 2, box_top + tick_h / 2], fill=ORANGE)
            y = box_top + pad_y
            draw_text_tracked(draw, cx, y, entry["day_de"], f_day, INK, tracking=day_tracking, align="center")
            y += m_day["height"] + line_gap
            draw_text_tracked(draw, cx, y, entry["day_fr"], f_dayfr, INK_SOFT, tracking=0, align="center")
            y += m_dayfr["height"] + row_gap
            draw_text_tracked(draw, cx, y, entry["detail_de"], f_detail, INK, tracking=0, align="center")
            y += m_detail["height"] + line_gap
            draw_text_tracked(draw, cx, y, entry["detail_fr"], f_detailfr, INK_SOFT, tracking=0, align="center")

        return {"height": total_h, "gap_after": GAP(gap_after_base), "draw": _draw}

    def make_two_line_block(line1, size1_base, color1, line2, size2_base, color2,
                             line_gap_base, gap_after_base, font_path):
        size1 = fit_font_size(draw, line1, font_path, avail_w, U(size1_base))
        size2 = fit_font_size(draw, line2, font_path, avail_w, U(size2_base))
        font1 = font_at(font_path, size1)
        font2 = font_at(font_path, size2)
        m1 = tracked_text_metrics(draw, line1, font1, 0)
        m2 = tracked_text_metrics(draw, line2, font2, 0)
        line_gap = U(line_gap_base)
        height = m1["height"] + line_gap + m2["height"]

        def _draw(top):
            draw_text_tracked(draw, cx, top, line1, font1, color1, tracking=0, align="center")
            draw_text_tracked(draw, cx, top + m1["height"] + line_gap, line2, font2, color2, tracking=0, align="center")

        return {"height": height, "gap_after": GAP(gap_after_base), "draw": _draw}

    blocks = [
        make_text_block(MARKER_TEXT, font_paths["mono_bold"], MARKER_SIZE, MARKER_TRACKING, ORANGE, GAP_MARKER_BRAND),
        make_text_block(BRAND, font_paths["shoulders_bold"], BRAND_SIZE, BRAND_TRACKING, INK, GAP_BRAND_HAIRLINE),
        make_hairline_block(HAIRLINE_WIDTH, HAIRLINE_THICK, GAP_HAIRLINE_HEADLINE),
        make_headline_block(HEADLINE_LINES, GAP_HEADLINE_BAND),
        make_band_block(BAND_FR, GAP_BAND_BODY),
        make_paragraph_block(BODY_DE, BODY_DE_SIZE, INK, GAP_BODY_DE_FR, font_paths["mono_regular"]),
        make_paragraph_block(BODY_FR, BODY_FR_SIZE, INK_SOFT, GAP_BODY_HIGHLIGHT, font_paths["mono_regular"]),
        make_highlight_block(HIGHLIGHT, GAP_HIGHLIGHT_FOOTER),
        make_two_line_block(ADDRESS, FOOTER_ADDR_SIZE, INK_SOFT,
                            f"{THANKS_DE} · {THANKS_FR}", FOOTER_THANKS_SIZE, INK_SOFT,
                            FOOTER_LINE_GAP, 0, font_paths["mono_regular"]),
    ]
    return blocks


def total_block_height(blocks):
    if not blocks:
        return 0
    return sum(b["height"] for b in blocks) + sum(b["gap_after"] for b in blocks[:-1])


# ============================================================
# Rendern
# ============================================================

def render_card(w, h, font_paths):
    scale = w / 1080
    ss_w, ss_h = w * SS, h * SS

    aspect = h / w
    gap_mult = min(1.5, max(0.70, 0.80 + 0.55 * (aspect - 1.0)))

    canvas = Image.new("RGBA", (ss_w, ss_h), PAPER + (255,))
    draw = ImageDraw.Draw(canvas)

    available_h = (h - MARGIN_TOP * scale - MARGIN_BOTTOM * scale) * SS

    blocks = build_blocks(draw, ss_w, scale, SS, 1.0, gap_mult, font_paths)
    raw_total = total_block_height(blocks)

    content_scale = 1.0
    if raw_total > available_h:
        content_scale = max(0.35, (available_h / raw_total) * 0.985)

    blocks = build_blocks(draw, ss_w, scale, SS, content_scale, gap_mult, font_paths)
    total_h = total_block_height(blocks)

    slack = max(0.0, available_h - total_h)
    margin_slack = slack * 0.25
    gap_slack = slack - margin_slack
    gaps = [block["gap_after"] for block in blocks[:-1]]
    sum_gaps = sum(gaps)
    if gap_slack > 0 and sum_gaps > 0:
        stretch = (sum_gaps + gap_slack) / sum_gaps
        for block in blocks[:-1]:
            block["gap_after"] *= stretch

    start_y = MARGIN_TOP * scale * SS + margin_slack / 2

    cursor = start_y
    for i, block in enumerate(blocks):
        block["draw"](cursor)
        cursor += block["height"]
        if i < len(blocks) - 1:
            cursor += block["gap_after"]

    return canvas.convert("RGB").resize((w, h), Image.LANCZOS)


def main():
    check_assets()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    font_paths = {key: os.path.join(FONT_DIR, filename) for key, filename in FONT_FILES.items()}
    img = render_card(PAGE_W, PAGE_H, font_paths)

    png_path = os.path.join(OUTPUT_DIR, "service_card.png")
    img.save(png_path, "PNG", dpi=(300, 300))
    pdf_path = os.path.join(OUTPUT_DIR, "service_card.pdf")
    img.save(pdf_path, "PDF", resolution=300.0)

    print("\nFertig! Erzeugte Dateien:\n")
    print(f"  {png_path}  ({img.size[0]} x {img.size[1]} px, 300 dpi, A5)")
    print(f"  {pdf_path}  (1 Seite, A5, druckfertig)")


if __name__ == "__main__":
    main()
