// Rysuje PNG z plików SVG znaku: ikony aplikacji, ikona Apple i obraz do udostępnień (Open Graph).
// Uruchom po build_logo.py: node scripts/brand/render_png.mjs
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const root = new URL("../../", import.meta.url).pathname;
const icon = readFileSync(`${root}public/brand/ostoja-ikona-aplikacji.svg`, "utf8");
const logo = readFileSync(`${root}public/brand/ostoja-logo.svg`, "utf8");
const font = (p) => `${root}node_modules/@fontsource-variable/${p}`;

const browser = await chromium.launch();
for (const [size, out, square] of [
  [192, "public/brand/ostoja-ikona-192.png", false],
  [512, "public/brand/ostoja-ikona-512.png", false],
  [180, "src/app/apple-icon.png", true], // iOS sam zaokrągla rogi
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const svg = icon.replace('width="512" height="512"', `width="${size}" height="${size}"`).replace('rx="112"', square ? 'rx="0"' : 'rx="112"');
  await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  await page.screenshot({ path: `${root}${out}`, omitBackground: true });
}

const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.setContent(`<html><head><style>
@font-face{font-family:N;src:url(file://${font("newsreader/files/newsreader-latin-wght-normal.woff2")})}
@font-face{font-family:N;src:url(file://${font("newsreader/files/newsreader-latin-ext-wght-normal.woff2")});unicode-range:U+0100-024F}
@font-face{font-family:F;src:url(file://${font("figtree/files/figtree-latin-wght-normal.woff2")})}
@font-face{font-family:F;src:url(file://${font("figtree/files/figtree-latin-ext-wght-normal.woff2")});unicode-range:U+0100-024F}
body{margin:0}.og{width:1200px;height:630px;background:#F4F4F2;display:flex;flex-direction:column;justify-content:space-between;padding:80px 88px;box-sizing:border-box;position:relative;overflow:hidden}
.logo svg{height:58px;width:auto}
h1{font-family:N;font-weight:450;font-size:68px;line-height:1.08;color:#1E2422;margin:0;max-width:760px}
p{font-family:F;font-size:28px;color:#5C6461;margin:22px 0 0;max-width:700px}
.big{position:absolute;right:-30px;bottom:-60px;width:440px}
</style></head><body><div class="og"><div class="logo">${logo}</div>
<div><h1>Pomożemy zorganizować pogrzeb. Spokojnie, krok po kroku.</h1><p>Pełne ceny zakładów w Twoim mieście. Zakład oddzwoni w 15 minut.</p></div>
<svg class="big" viewBox="0 0 32 32"><path d="M6.25 28V14.75a9.75 9.75 0 0 1 19.5 0V28" fill="none" stroke="#E2E6E3" stroke-width="2.5" stroke-linecap="round"/><path d="M11 28V18.5a5 5 0 0 1 10 0V28" fill="none" stroke="#E2E6E3" stroke-width="1.6" stroke-linecap="round"/><path d="M16 28V21" stroke="#E6DDCB" stroke-width="2.2" stroke-linecap="round"/></svg>
</div></body></html>`);
await og.waitForTimeout(300);
await og.screenshot({ path: `${root}src/app/opengraph-image.png` });
await browser.close();
console.log("PNG gotowe");
