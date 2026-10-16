// Identyfikacja wizualna Ostoi jako dokument Word (.docx), z docs/identyfikacja-wizualna.md.
// Najpierw obrazy: node docs/identyfikacja/render_images.mjs, potem: node docs/identyfikacja/build_docx.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, ImageRun, Footer, PageNumber, LevelFormat, TableLayoutType,
  VerticalAlign,
} = require("docx");

const DIR = __dirname;
const ROOT = path.join(DIR, "..", "..");
const MD = fs.readFileSync(path.join(ROOT, "docs", "identyfikacja-wizualna.md"), "utf8");
const IMG = (n) => fs.readFileSync(path.join(DIR, "obrazy", `${n}.png`));

const C = { ink: "1E2422", muted: "5C6461", brand: "3F5650", tint: "E6EAE8", line: "D8DAD7", sand: "A68B5B", ground: "F4F4F2" };
const SERIF = "Georgia";
const SANS = "Arial";
const MONO = "Consolas";
const W = 9638; // A4 minus marginesy 2 cm
const PX = 9525; // EMU na piksel – docx liczy obrazy w pikselach przy 96 dpi

// --- Tekst -------------------------------------------------------------------------------------
const t = (text, o = {}) => new TextRun({ text, font: SANS, size: 21, color: C.ink, ...o });
const code = (text, o = {}) => new TextRun({ text, font: MONO, size: (o.size ?? 21) - 2, color: C.brand });

function rich(s, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(t(s.slice(last, m.index), base));
    const tok = m[0];
    out.push(tok.startsWith("**") ? t(tok.slice(2, -2), { ...base, bold: true }) : code(tok.slice(1, -1), base));
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(t(s.slice(last), base));
  return out;
}

const p = (s, o = {}) => new Paragraph({ children: rich(s, o.run), spacing: { after: 140, line: 312 }, ...o.par });
const h2 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(s)] });
const bullet = (s) => new Paragraph({ numbering: { reference: "kropki", level: 0 }, children: rich(s), spacing: { after: 90, line: 300 } });
const quote = (s) => new Paragraph({
  children: rich(s, { font: SERIF, size: 23, italics: true }),
  shading: { type: ShadingType.CLEAR, fill: C.ground, color: "auto" },
  border: { left: { style: BorderStyle.SINGLE, size: 12, color: C.sand, space: 10 } },
  indent: { left: 240, right: 240 }, spacing: { before: 80, after: 160, line: 312 },
});
const caption = (s) => new Paragraph({ children: [t(s, { size: 17, color: C.muted })], spacing: { before: 60, after: 200 } });

function image(name, widthPx, o = {}) {
  const buf = IMG(name);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  return new Paragraph({
    alignment: o.align ?? AlignmentType.LEFT,
    spacing: { before: 120, after: o.after ?? 60 },
    children: [new ImageRun({ type: "png", data: buf, transformation: { width: widthPx, height: Math.round((widthPx * h) / w) },
      altText: { title: o.alt ?? name, description: o.alt ?? name, name } })],
  });
}

// --- Tabele ------------------------------------------------------------------------------------
const border = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

function luminance(hex) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function cell(content, width, o = {}) {
  const hex = o.swatch;
  const textColor = hex ? (luminance(hex) > 0.25 ? C.ink : "FFFFFF") : undefined;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: o.head ? { type: ShadingType.CLEAR, fill: C.tint, color: "auto" }
      : hex ? { type: ShadingType.CLEAR, fill: hex, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: [new Paragraph({
      spacing: { after: 0, line: 264 },
      children: o.head ? [t(content, { size: 18, bold: true, color: C.brand })]
        : hex ? [t(`#${hex}`, { size: 18, font: MONO, color: textColor })]
        : rich(content, { size: 19 }),
    })],
  });
}

function mdTable(rows) {
  const [head, ...body] = rows;
  const n = head.length;
  const known = {
    Nazwa: [1500, 1650, 1250, 1250, 3988],
    Element: [1900, 3600, 2000, 2138],
    Plik: [3900, 5738],
    Piszemy: [4819, 4819],
    Zamiast: [4819, 4819],
  };
  const widths = known[head[0]] ?? Array(n).fill(Math.floor(W / n));
  const isColor = head[0] === "Nazwa";
  return new Table({
    width: { size: widths.reduce((a, x) => a + x, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, widths[i], { head: true })) }),
      ...body.map((r) => new TableRow({
        cantSplit: true,
        children: r.map((c, i) => {
          const hex = isColor && (i === 2 || i === 3) ? c.replace("#", "") : undefined;
          return cell(c, widths[i], { swatch: hex });
        }),
      })),
    ],
  });
}

// Siatka wersji logo: obraz + podpis, dwie kolumny.
function logoGrid(items) {
  const half = W / 2;
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(new TableRow({
      cantSplit: true,
      children: [0, 1].map((k) => {
        const it = items[i + k];
        return new TableCell({
          width: { size: half, type: WidthType.DXA }, borders: noBorders,
          margins: { top: 60, bottom: 60, left: 0, right: k === 0 ? 160 : 0 },
          children: it ? [image(it[0], it[2] ?? 300, { after: 0, alt: it[1] }), caption(it[1])] : [new Paragraph("")],
        });
      }),
    }));
  }
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [half, half], layout: TableLayoutType.FIXED, borders: noBorders, rows });
}

// --- Markdown → akapity ------------------------------------------------------------------------
// Dzieli plik na sekcje „## ” i zamienia ich treść na elementy dokumentu.
function sections(md) {
  const out = {};
  let name = null;
  for (const line of md.split("\n")) {
    if (line.startsWith("## ")) { name = line.slice(3).trim(); out[name] = []; continue; }
    if (name) out[name].push(line);
  }
  return out;
}

function render(lines, hooks = {}) {
  const els = [];
  let table = null;
  const flush = () => { if (table) { els.push(mdTable(table), new Paragraph({ spacing: { after: 120 }, children: [] })); table = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("|")) {
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue;
      (table ??= []).push(cells);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    if (line.startsWith("### ")) {
      const title = line.slice(4).trim();
      els.push(h2(title));
      if (hooks[`przed:${title}`]) els.push(...hooks[`przed:${title}`]());
      continue;
    }
    if (line.startsWith("- ")) { els.push(bullet(line.slice(2))); continue; }
    if (line.startsWith("> ")) { els.push(quote(line.slice(2))); continue; }
    els.push(p(line));
  }
  flush();
  return els;
}

const S = sections(MD);
const intro = MD.split("\n").filter((l, i) => i > 2 && i < 6 && l.trim()).join(" ");

const hooks = {
  "przed:Konstrukcja (siatka 32 × 32)": () => [
    logoGrid([["znak", "Znak – od 25 px", 170], ["znak-maly", "Wersja mała – 16–24 px", 90]]),
  ],
  "przed:Czego nie robić": () => [],
  "przed:Wersje i pliki": () => [
    logoGrid([
      ["logo", "Logo poziome – wersja podstawowa"],
      ["logo-pionowe", "Logo pionowe", 200],
      ["logo-ciemne-tlo", "Na ciemne tło (night, brand)"],
      ["logo-czarne", "Jednobarwne czarne"],
      ["logo-biale", "Jednobarwne białe"],
      ["ikona-aplikacji", "Ikona aplikacji", 150],
    ]),
  ],
  "przed:Materiały firmowe": () => [
    image("wizytowka", 640, { alt: "Wizytówka – przód i tył" }),
    caption("Wizytówka 85 × 55 mm: przód biały, tył w kolorze szałwii."),
  ],
};
const znakHooks = {
  ...hooks,
  "przed:Znak partnera": () => [
    image("naklejka-partnera", 220, { alt: "Naklejka Partner Ostoi" }),
    caption("Naklejka „Partner Ostoi”, 120 × 120 mm."),
  ],
};

// Kolejność jak w księdze znaku: idea, znak, kolor, typografia… W pliku .md znak jest niżej.
const order = ["Idea", "Znak i logo", "Kolor", "Typografia", "Układ i kształt", "Ikony", "Zdjęcia i grafika", "Ruch",
  "Dostępność", "Ton i język", "Zastosowania"];
for (const k of Object.keys(S)) if (!order.includes(k)) throw new Error(`Sekcja „${k}” nie ma miejsca w dokumencie`);

const body = [];
// Nowa strona tylko dla głównych rozdziałów; krótkie zasady (ikony, ruch…) płyną po typografii.
const newPage = new Set(["Idea", "Kolor", "Typografia", "Zdjęcia i grafika", "Ton i język", "Zastosowania"]);
order.forEach((name, i) => {
  body.push(new Paragraph({
    heading: HeadingLevel.HEADING_1, pageBreakBefore: newPage.has(name), keepNext: true,
    spacing: newPage.has(name) ? undefined : { before: 480, after: 240 },
    children: [new TextRun({ text: `${i + 1}  `, color: C.sand }), new TextRun(name)],
  }));
  if (name === "Typografia") {
    body.push(...render(S[name], hooks));
    body.push(p("W tym pliku Word nagłówki są złożone krojem Georgia, a tekst krojem Arial – Newsreader i Figtree nie są wbudowane w dokument, a Word bez nich podmieniłby kroje dowolnie.",
      { run: { size: 18, color: C.muted, italics: true } }));
    return;
  }
  body.push(...render(S[name], name === "Znak i logo" ? znakHooks : hooks));
});

// --- Okładka -----------------------------------------------------------------------------------
const cover = [
  new Paragraph({ spacing: { before: 2400 }, children: [] }),
  image("logo", 300, { alt: "Logo Ostoi" }),
  new Paragraph({ spacing: { before: 600, after: 120 }, children: [new TextRun({ text: "Identyfikacja wizualna", font: SERIF, size: 64, color: C.ink })] }),
  new Paragraph({ spacing: { after: 600 }, children: [t("Księga znaku, kolor, typografia, ton i zastosowania", { size: 26, color: C.muted })] }),
  p(intro, { run: { size: 22 } }),
  new Paragraph({ spacing: { before: 1600 }, children: [t("Wersja 1.0 · październik 2026", { size: 18, color: C.muted })] }),
  new Paragraph({ children: [
    t("Pliki znaku: ", { size: 18, color: C.muted }), code("public/brand/", { size: 18 }),
    t(" w repozytorium Ostoi (generuje je ", { size: 18, color: C.muted }), code("scripts/brand/build_logo.py", { size: 18 }),
    t("). Tokeny w kodzie: ", { size: 18, color: C.muted }), code("docs/design-system.md", { size: 18 }), t(".", { size: 18, color: C.muted }),
  ] }),
];

const doc = new Document({
  creator: "Ostoja",
  title: "Ostoja – identyfikacja wizualna",
  styles: {
    default: { document: { run: { font: SANS, size: 21, color: C.ink } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: SERIF, size: 44, color: C.ink }, paragraph: { spacing: { before: 0, after: 280 }, outlineLevel: 0, keepNext: true, keepLines: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: SERIF, size: 30, color: C.brand }, paragraph: { spacing: { before: 360, after: 140 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: { config: [{ reference: "kropki", levels: [{ level: 0, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360, hanging: 260 } }, run: { color: C.sand } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      t("Ostoja · Identyfikacja wizualna · ", { size: 16, color: C.muted }),
      new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 16, color: C.muted }),
    ] })] }) },
    children: [...cover, ...body],
  }],
});

const out = path.join(DIR, "Ostoja-identyfikacja-wizualna.docx");
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("Zapisano", out); });
