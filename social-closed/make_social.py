#!/usr/bin/env python3
"""
make_social.py — "HEUTE GESCHLOSSEN" Social-Media-Grafiken für Bikecenter Meyer.

Erzeugt in einem Durchlauf drei Formate (Instagram Feed, Instagram Story/Reel,
Facebook/Quadrat) als PNG sowie eine mehrseitige PDF, im selben Design wie das
bestehende Türschild (Papierweiß, Graphit-Tinte, Signal-Orange-Akzentband,
Big-Shoulders-Headline, Mono-Detailtext).

Ausführen:
    python make_social.py
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFont, ImageChops

# ============================================================
# KONFIGURATION — hier für den nächsten Schließtag anpassen
# ============================================================

BRAND = "BIKECENTER MEYER"
ADDRESS = "Malmedyer Str. 66 · 4780 Sankt Vith"

MARKER_TEXT = "— HEUTE GESCHLOSSEN · AUJOURD'HUI FERMÉ —"

MESSAGE_HEADLINE_DE = "GESCHLOSSEN"
MESSAGE_HEADLINE_FR = "FERMÉ"

MESSAGE_SUB_DE = "Heute den ganzen Tag geschlossen"
MESSAGE_SUB_FR = "Fermé toute la journée"

REASON_DE = "Wir sind auf einer Ausstellung."
REASON_FR = "Nous sommes présents à un salon."

DATE_DE = "MONTAG · 6. JULI 2026"
DATE_FR = "LUNDI · 6 JUILLET 2026"

THANKS_DE = "Danke für Ihr Verständnis"
THANKS_FR = "Merci de votre compréhension"

BIKE_ICON_PATH = "./assets/bike-icon.png"
FONT_DIR = "./fonts"
OUTPUT_DIR = "./output"

SS = 2  # Supersampling-Faktor (Rendern in 2x, dann LANCZOS-Downscale)

# Farben (exakt)
PAPER = (243, 240, 233)
PAPER_DK = (233, 229, 220)
INK = (26, 26, 24)
INK_SOFT = (74, 72, 68)
ORANGE = (232, 93, 24)
ORANGE_DK = (196, 74, 14)
HAIRLINE = (200, 195, 185)

FORMATS = [
    ("ig_feed", 1080, 1350),
    ("ig_story", 1080, 1920),
    ("fb_square", 1080, 1080),
]

FONT_FILES = {
    "shoulders_bold": "BigShoulders-Bold.ttf",
    "shoulders_regular": "BigShoulders-Regular.ttf",
    "mono_regular": "GeistMono-Regular.ttf",
    "mono_bold": "GeistMono-Bold.ttf",
}

# Layout-Basiswerte, definiert für eine Referenzbreite von 1080px
# (scale = W / 1080 skaliert sie für andere Canvas-Breiten).
MARGIN_X = 96
MARGIN_TOP = 84
MARGIN_BOTTOM = 84

MARKER_SIZE = 19
MARKER_TRACKING = 3.2
GAP_MARKER_BRAND = 42

BRAND_SIZE = 33
BRAND_TRACKING = 5
GAP_BRAND_HAIRLINE = 16

HAIRLINE_WIDTH = 210
HAIRLINE_THICK = 2
GAP_HAIRLINE_HEADLINE = 40

HEADLINE_SIZE = 168
HEADLINE_TRACKING = 0
GAP_HEADLINE_BAND = 34

BAND_FONT_SIZE = 70
BAND_TRACKING = 0
BAND_PAD_Y = 26
GAP_BAND_MESSAGE = 40

MESSAGE_DE_SIZE = 32
MESSAGE_FR_SIZE = 26
MESSAGE_LINE_GAP = 8
GAP_MESSAGE_REASON = 26

REASON_DE_SIZE = 26
REASON_FR_SIZE = 21
REASON_LINE_GAP = 6
GAP_REASON_DATE = 40

DATE_BOX_PAD_X = 34
DATE_BOX_PAD_Y = 20
DATE_DE_SIZE = 24
DATE_DE_TRACKING = 1.5
DATE_FR_SIZE = 16
DATE_LINE_GAP = 6
DATE_TICK_W = 46
DATE_TICK_H = 10
DATE_BORDER_THICK = 2
GAP_DATE_ICON = 40

ICON_WIDTH = 190
GAP_ICON_FOOTER = 40

FOOTER_ADDR_SIZE = 19
FOOTER_THANKS_SIZE = 16
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
    if not os.path.isfile(BIKE_ICON_PATH):
        missing.append(BIKE_ICON_PATH)
    if missing:
        listed = "\n".join(f"  - {p}" for p in missing)
        sys.exit(
            "FEHLER: Folgende benötigte Datei(en) wurden nicht gefunden:\n"
            f"{listed}\n\n"
            "Bitte lege die vier Fonts (BigShoulders-Bold.ttf, BigShoulders-Regular.ttf,\n"
            "GeistMono-Regular.ttf, GeistMono-Bold.ttf) in FONT_DIR ab und stelle sicher,\n"
            "dass BIKE_ICON_PATH auf ein vorhandenes PNG zeigt. Es gibt keinen stillen\n"
            "Fallback — das Skript bricht bewusst ab."
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


# ============================================================
# Bike-Icon: Weiß -> Alpha über Luminanz, Umfärben, Resize, zentriertes Einfügen
# ============================================================

def load_bike_icon(path, tint):
    img = Image.open(path).convert("RGBA")
    r, g, b, a = img.split()
    luminance = Image.merge("RGB", (r, g, b)).convert("L")
    alpha = ImageChops.multiply(luminance, a)
    tinted = Image.new("RGBA", img.size, tint + (0,))
    tinted.putalpha(alpha)
    return tinted


def resize_icon(icon, target_width):
    target_width = max(1, int(round(target_width)))
    w, h = icon.size
    if w == 0:
        return icon
    target_height = max(1, int(round(h * (target_width / w))))
    return icon.resize((target_width, target_height), Image.LANCZOS)


# ============================================================
# Layout-Blöcke
# ============================================================

def build_blocks(draw, canvas, ss_w, scale, ss, content_scale, gap_mult, font_paths, bike_icon_master):
    cx = ss_w / 2

    def M(base):
        """Skalierung für den festen Rahmen (Ränder) — unabhängig von content_scale."""
        return base * scale * ss

    def U(base):
        """Skalierung für Inhaltselemente (Schriftgrößen, Innenabstände, Linienstärken)."""
        return base * scale * ss * content_scale

    def GAP(base):
        """Skalierung für Abstände zwischen Blöcken — atmet zusätzlich mit gap_mult."""
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

    def make_date_block(gap_after_base):
        tracking_de = U(DATE_DE_TRACKING)
        pad_x = U(DATE_BOX_PAD_X)
        pad_y = U(DATE_BOX_PAD_Y)
        inner_max_w = avail_w - 2 * pad_x
        size_de = fit_font_size(draw, DATE_DE, font_paths["mono_bold"], inner_max_w, U(DATE_DE_SIZE), tracking=tracking_de)
        size_fr = fit_font_size(draw, DATE_FR, font_paths["mono_regular"], inner_max_w, U(DATE_FR_SIZE))
        font_de = font_at(font_paths["mono_bold"], size_de)
        font_fr = font_at(font_paths["mono_regular"], size_fr)
        m_de = tracked_text_metrics(draw, DATE_DE, font_de, tracking_de)
        m_fr = tracked_text_metrics(draw, DATE_FR, font_fr, 0)
        line_gap = U(DATE_LINE_GAP)
        inner_h = m_de["height"] + line_gap + m_fr["height"]
        box_h = inner_h + 2 * pad_y
        box_w = max(m_de["width"], m_fr["width"]) + 2 * pad_x
        tick_w = U(DATE_TICK_W)
        tick_h = U(DATE_TICK_H)
        border = max(1, U(DATE_BORDER_THICK))
        total_h = box_h + tick_h / 2

        def _draw(top):
            box_top = top + tick_h / 2
            box_left = cx - box_w / 2
            box_right = cx + box_w / 2
            draw.rectangle([box_left, box_top, box_right, box_top + box_h],
                            outline=HAIRLINE, width=int(round(border)))
            draw.rectangle([cx - tick_w / 2, box_top - tick_h / 2, cx + tick_w / 2, box_top + tick_h / 2], fill=ORANGE)
            inner_top = box_top + pad_y
            draw_text_tracked(draw, cx, inner_top, DATE_DE, font_de, INK, tracking=tracking_de, align="center")
            draw_text_tracked(draw, cx, inner_top + m_de["height"] + line_gap, DATE_FR, font_fr, INK_SOFT,
                               tracking=0, align="center")

        return {"height": total_h, "gap_after": GAP(gap_after_base), "draw": _draw}

    def make_icon_block(gap_after_base):
        icon_w = U(ICON_WIDTH)
        icon = resize_icon(bike_icon_master, icon_w)

        def _draw(top):
            x = int(round(cx - icon.width / 2))
            canvas.alpha_composite(icon, (x, int(round(top))))

        return {"height": icon.height, "gap_after": GAP(gap_after_base), "draw": _draw}

    blocks = [
        make_text_block(MARKER_TEXT, font_paths["mono_bold"], MARKER_SIZE, MARKER_TRACKING, ORANGE, GAP_MARKER_BRAND),
        make_text_block(BRAND, font_paths["shoulders_bold"], BRAND_SIZE, BRAND_TRACKING, INK, GAP_BRAND_HAIRLINE),
        make_hairline_block(HAIRLINE_WIDTH, HAIRLINE_THICK, GAP_HAIRLINE_HEADLINE),
        make_text_block(MESSAGE_HEADLINE_DE, font_paths["shoulders_bold"], HEADLINE_SIZE, HEADLINE_TRACKING, INK, GAP_HEADLINE_BAND),
        make_band_block(MESSAGE_HEADLINE_FR, GAP_BAND_MESSAGE),
        make_two_line_block(MESSAGE_SUB_DE, MESSAGE_DE_SIZE, INK, MESSAGE_SUB_FR, MESSAGE_FR_SIZE, INK_SOFT,
                             MESSAGE_LINE_GAP, GAP_MESSAGE_REASON, font_paths["mono_regular"]),
        make_two_line_block(REASON_DE, REASON_DE_SIZE, INK_SOFT, REASON_FR, REASON_FR_SIZE, INK_SOFT,
                             REASON_LINE_GAP, GAP_REASON_DATE, font_paths["mono_regular"]),
        make_date_block(GAP_DATE_ICON),
        make_icon_block(GAP_ICON_FOOTER),
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
# Rendern eines Formats
# ============================================================

def render_format(w, h, font_paths, bike_icon_master):
    scale = w / 1080  # zentraler Skalierungsfaktor relativ zur Canvas-Breite
    ss_w, ss_h = w * SS, h * SS

    aspect = h / w
    gap_mult = min(1.5, max(0.70, 0.80 + 0.55 * (aspect - 1.0)))

    canvas = Image.new("RGBA", (ss_w, ss_h), PAPER + (255,))
    draw = ImageDraw.Draw(canvas)

    available_h = (h - MARGIN_TOP * scale - MARGIN_BOTTOM * scale) * SS

    # Pass 1: Rohhöhe bei content_scale=1.0 messen
    blocks = build_blocks(draw, canvas, ss_w, scale, SS, 1.0, gap_mult, font_paths, bike_icon_master)
    raw_total = total_block_height(blocks)

    content_scale = 1.0
    if raw_total > available_h:
        content_scale = max(0.35, (available_h / raw_total) * 0.985)

    # Pass 2: finale Blöcke mit passendem content_scale bauen
    blocks = build_blocks(draw, canvas, ss_w, scale, SS, content_scale, gap_mult, font_paths, bike_icon_master)
    total_h = total_block_height(blocks)

    # Übriger Platz (z.B. bei 9:16) fließt größtenteils als zusätzliche Luft
    # zwischen die Blöcke, nicht nur als toter Rand oben/unten.
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

    rgb_canvas = canvas.convert("RGB")
    final_img = rgb_canvas.resize((w, h), Image.LANCZOS)
    return final_img


# ============================================================
# Main
# ============================================================

def main():
    check_assets()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    font_paths = {key: os.path.join(FONT_DIR, filename) for key, filename in FONT_FILES.items()}
    bike_icon_master = load_bike_icon(BIKE_ICON_PATH, INK)

    png_results = []
    pdf_pages = []
    for name, w, h in FORMATS:
        img = render_format(w, h, font_paths, bike_icon_master)
        png_path = os.path.join(OUTPUT_DIR, f"{name}.png")
        img.save(png_path, "PNG", dpi=(300, 300))
        png_results.append((png_path, img.size))
        pdf_pages.append(img)

    pdf_path = os.path.join(OUTPUT_DIR, "social_geschlossen.pdf")
    first_page, *rest_pages = pdf_pages
    first_page.save(pdf_path, "PDF", save_all=True, append_images=rest_pages, resolution=300.0)

    print("\nFertig! Erzeugte Dateien:\n")
    for path, size in png_results:
        print(f"  {path}  ({size[0]} x {size[1]} px)")
    print(f"  {pdf_path}  (3 Seiten, je gemäß PNG-Maßen oben)")


if __name__ == "__main__":
    main()
