"""Generuje pliki znaku Ostoi (SVG) z geometrii znaku i kroju Newsreader zamienionego na krzywe.
Uruchom: python3 scripts/brand/build_logo.py  (wymaga: fonttools, brotli, uharfbuzz)"""
import io, os
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "brand")
os.makedirs(OUT, exist_ok=True)

GREEN, AMBER, INK, LIGHT, AMBER_ON_DARK = "#3F5650", "#A68B5B", "#1E2422", "#E4E7E5", "#CDB98F"
GROUND = "#F4F4F2"

# Znak „Brama i droga”: dwie bramy jedna za drugą (perspektywa, próg za progiem) i prosta droga
# w osi symetrii, prowadząca w głąb – ostatnia droga. Siatka 32 × 32.
ARCH = "M6.25 28V14.75a9.75 9.75 0 0 1 19.5 0V28"
INNER = "M11 28V18.5a5 5 0 0 1 10 0V28"
ROAD = "M16 28V21"
# Wersja do 24 px i mniej: bez wewnętrznej bramy, grubsze linie (inaczej zlewa się w plamę).
ARCH_S = "M6 28.5V15a10 10 0 0 1 20 0v13.5"
ROAD_S = "M16 28.5V18"


def mark(arch_color, road_color, small=False):
    p = lambda d, c, w: f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round"/>'
    if small:
        return p(ARCH_S, arch_color, 3.4) + p(ROAD_S, road_color, 3)
    return p(ARCH, arch_color, 2.5) + p(INNER, arch_color, 1.6) + p(ROAD, road_color, 2.2)


def svg(w, h, body, vb=None, title="Ostoja"):
    vb = vb or f"0 0 {w} {h}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}" role="img" aria-label="{title}">'
            f"<title>{title}</title>{body}</svg>\n")


def wordmark_path(text="Ostoja", wght=500, opsz=48):
    src = os.path.join(ROOT, "node_modules/@fontsource-variable/newsreader/files/newsreader-latin-standard-normal.woff2")
    font = TTFont(src)
    inst = instantiateVariableFont(font, {"wght": wght, "opsz": opsz})
    buf = io.BytesIO()
    inst.flavor = None
    inst.save(buf)
    data = buf.getvalue()
    face = hb.Face(data)
    hbf = hb.Font(face)
    b = hb.Buffer()
    b.add_str(text)
    b.guess_segment_properties()
    hb.shape(hbf, b, {"kern": True, "liga": True})
    upm = inst["head"].unitsPerEm
    gs = inst.getGlyphSet()
    order = inst.getGlyphOrder()
    pen = SVGPathPen(gs)
    from fontTools.pens.boundsPen import BoundsPen
    bounds = BoundsPen(gs)
    x = 0
    for info, pos in zip(b.glyph_infos, b.glyph_positions):
        name = order[info.codepoint]
        # Odwrócenie osi Y (font: w górę, SVG: w dół), linia bazowa w y = 0.
        tp = TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset))
        gs[name].draw(tp)
        gs[name].draw(TransformPen(bounds, (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)))
        x += pos.x_advance
    os2 = inst["OS/2"]
    # bounds[3] = najniższy punkt (ogonek „j”) po odwróceniu osi Y
    return pen.getCommands(), x, upm, os2.sCapHeight, bounds.bounds[3]


path, adv, upm, cap, desc = wordmark_path()
s = 1 / upm  # jednostki fontu → em

# Logo poziome: znak 32 × 32, napis o wysokości wersalików ≈ 0,62 wysokości znaku.
H = 32
size = 0.56 * H / (cap * s)  # rozmiar fontu w jednostkach SVG
k = size * s
word_w = adv * k
gap = 9
W = 32 + gap + word_w
base = 28.25  # linia bazowa = podstawa drogi
HH = max(32, round(base + desc * k + 0.5, 2))  # wysokość z ogonkiem „j”
word = lambda color: f'<path transform="translate({32 + gap} {base}) scale({k:.5f})" d="{path}" fill="{color}"/>'

files = {
    "ostoja-znak.svg": svg(32, 32, mark(GREEN, AMBER), title="Ostoja – znak"),
    "ostoja-znak-maly.svg": svg(32, 32, mark(GREEN, AMBER, small=True), title="Ostoja – znak, wersja do 24 px"),
    "ostoja-znak-czarny.svg": svg(32, 32, mark("#000", "#000"), title="Ostoja – znak czarny"),
    "ostoja-znak-bialy.svg": svg(32, 32, mark("#fff", "#fff"), title="Ostoja – znak biały"),
    "ostoja-logo.svg": svg(round(W, 2), HH, mark(GREEN, AMBER) + word(INK), title="Ostoja"),
    "ostoja-logo-ciemne-tlo.svg": svg(round(W, 2), HH, mark(LIGHT, AMBER_ON_DARK) + word(LIGHT), title="Ostoja"),
    "ostoja-logo-czarne.svg": svg(round(W, 2), HH, mark("#000", "#000") + word("#000"), title="Ostoja"),
    "ostoja-logo-biale.svg": svg(round(W, 2), HH, mark("#fff", "#fff") + word("#fff"), title="Ostoja"),
    "ostoja-ikona-aplikacji.svg": svg(
        512, 512,
        f'<rect width="512" height="512" rx="112" fill="{GREEN}"/>'
        f'<g transform="translate(96 78.5) scale(10)">{mark(LIGHT, AMBER_ON_DARK)}</g>',
        title="Ostoja – ikona aplikacji",
    ),
}

# Logo pionowe (do stopek, pieczątek, materiałów drukowanych): znak nad napisem.
Wv = max(word_w, 32) + 8
mark_x = (Wv - 32) / 2
word_x = (Wv - word_w) / 2
files["ostoja-logo-pionowe.svg"] = svg(
    round(Wv, 2), round(32 + 10 + cap * k + desc * k + 0.5, 2),
    f'<g transform="translate({mark_x:.2f} 0)">{mark(GREEN, AMBER)}</g>'
    f'<path transform="translate({word_x:.2f} {32 + 10 + cap * k:.2f}) scale({k:.5f})" d="{path}" fill="{INK}"/>',
    title="Ostoja",
)

for name, content in files.items():
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(content)
    print(name)

with open(os.path.join(OUT, "wordmark-path.txt"), "w") as fh:
    fh.write(f"scale={k:.5f} width={word_w:.3f} height={HH} gap={gap}\n{path}\n")


# --- Zastosowania: wizytówka i naklejka partnera (tekst zamieniony na krzywe) -------------------
_font_cache = {}


def _instance(file, wght, opsz=None):
    key = (file, wght, opsz)
    if key not in _font_cache:
        font = TTFont(os.path.join(ROOT, "node_modules", file))
        axes = {"wght": wght}
        if opsz and "opsz" in [a.axisTag for a in font["fvar"].axes]:
            axes["opsz"] = opsz
        inst = instantiateVariableFont(font, axes)
        inst.flavor = None
        buf = io.BytesIO()
        inst.save(buf)
        _font_cache[key] = (inst, buf.getvalue())
    return _font_cache[key]


FAMILIES = {
    "serif": ["@fontsource-variable/newsreader/files/newsreader-latin-standard-normal.woff2",
              "@fontsource-variable/newsreader/files/newsreader-latin-ext-standard-normal.woff2"],
    "sans": ["@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2",
             "@fontsource-variable/figtree/files/figtree-latin-ext-wght-normal.woff2"],
}


def text_path(text, family, wght, size, x, y, fill, opsz=None, anchor="start"):
    """Tekst jako ścieżka SVG; znaki spoza podstawowej łaciny (ą, ł, ż…) z pliku latin-ext."""
    files = [_instance(f, wght, opsz) for f in FAMILIES[family]]
    runs, cur, cur_i = [], "", None
    for ch in text:
        i = next((n for n, (inst, _) in enumerate(files) if ord(ch) in inst.getBestCmap()), 0)
        if i != cur_i and cur:
            runs.append((cur_i, cur)); cur = ""
        cur_i, cur = i, cur + ch
    if cur:
        runs.append((cur_i, cur))
    pieces, pen_x = [], 0.0
    for i, run in runs:
        inst, data = files[i]
        hbf = hb.Font(hb.Face(data))
        b = hb.Buffer(); b.add_str(run); b.guess_segment_properties()
        hb.shape(hbf, b, {"kern": True})
        gs, order, upm = inst.getGlyphSet(), inst.getGlyphOrder(), inst["head"].unitsPerEm
        k = size / upm
        pen = SVGPathPen(gs)
        gx = 0
        for info, pos in zip(b.glyph_infos, b.glyph_positions):
            gs[order[info.codepoint]].draw(TransformPen(pen, (1, 0, 0, -1, gx + pos.x_offset, -pos.y_offset)))
            gx += pos.x_advance
        pieces.append((pen_x, k, pen.getCommands()))
        pen_x += gx * k
    shift = {"start": 0, "middle": -pen_x / 2, "end": -pen_x}[anchor]
    return "".join(
        f'<path transform="translate({x + shift + px:.2f} {y}) scale({k:.5f})" d="{d}" fill="{fill}"/>'
        for px, k, d in pieces
    )


def logo_at(x, y, h, mark_c, road_c, word_c):
    """Logo poziome w miejscu (x, y) o wysokości znaku h."""
    sc = h / 32
    return (f'<g transform="translate({x} {y}) scale({sc:.4f})">{mark(mark_c, road_c)}'
            f'<path transform="translate({32 + gap} {base}) scale({k:.5f})" d="{path}" fill="{word_c}"/></g>')


# Wizytówka 85 × 55 mm (1 mm = 10 jednostek), przód i tył obok siebie.
card = (
    f'<rect x="0" y="0" width="850" height="550" rx="0" fill="#FFFFFF"/>'
    + logo_at(70, 62, 70, GREEN, AMBER, INK)
    + text_path("Anna Przykładowa", "sans", 600, 40, 70, 330, INK)
    + text_path("Opiekunka zakładów partnerskich", "sans", 400, 28, 70, 372, "#5C6461")
    + text_path("+48 000 000 000", "sans", 500, 28, 70, 450, INK)
    + text_path("anna@ostoja.example", "sans", 400, 28, 70, 490, "#5C6461")
    + f'<rect x="900" y="0" width="850" height="550" fill="{GREEN}"/>'
    + f'<g transform="translate({900 + 425 - 70} 150) scale(4.375)">{mark(LIGHT, AMBER_ON_DARK)}</g>'
    + text_path("Pomagamy przejść przez to spokojnie.", "serif", 400, 34, 900 + 425, 430, LIGHT, opsz=24, anchor="middle")
)
with open(os.path.join(OUT, "zastosowanie-wizytowka.svg"), "w") as fh:
    fh.write(svg(1750, 550, card, title="Ostoja – wizytówka, przód i tył"))

# Naklejka na drzwi zakładu partnerskiego, 120 × 120 mm.
badge = (
    f'<rect x="0" y="0" width="1200" height="1200" rx="120" fill="{GROUND}"/>'
    f'<rect x="40" y="40" width="1120" height="1120" rx="92" fill="none" stroke="#D8DAD7" stroke-width="4"/>'
    + f'<g transform="translate(440 180) scale(10)">{mark(GREEN, AMBER)}</g>'
    + text_path("Partner Ostoi", "serif", 500, 120, 600, 720, INK, opsz=72, anchor="middle")
    + text_path("Zweryfikowany zakład pogrzebowy", "sans", 500, 48, 600, 820, "#5C6461", anchor="middle")
    + f'<path d="M420 920H780" stroke="#D8DAD7" stroke-width="4" stroke-linecap="round"/>'
    + text_path("Ceny bez gwiazdek · odpowiedź w 15 minut", "sans", 400, 40, 600, 1010, "#5C6461", anchor="middle")
)
with open(os.path.join(OUT, "zastosowanie-naklejka-partnera.svg"), "w") as fh:
    fh.write(svg(1200, 1200, badge, title="Ostoja – naklejka Partner Ostoi"))
print("zastosowania gotowe")
