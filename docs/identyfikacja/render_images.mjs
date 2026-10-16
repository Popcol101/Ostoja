// Rysuje PNG do dokumentu identyfikacji wizualnej (.docx) z plików SVG w public/brand.
// Uruchom z katalogu repozytorium: node docs/identyfikacja/render_images.mjs
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const root = new URL("../../", import.meta.url).pathname;
const out = `${root}docs/identyfikacja/obrazy/`;
mkdirSync(out, { recursive: true });

// [plik SVG, nazwa PNG, szerokość w px (CSS), tło, margines]
const jobs = [
  ["ostoja-logo.svg", "logo", 520, "#F4F4F2", 56],
  ["ostoja-logo-pionowe.svg", "logo-pionowe", 300, "#F4F4F2", 56],
  ["ostoja-logo-ciemne-tlo.svg", "logo-ciemne-tlo", 520, "#1E2422", 56],
  ["ostoja-logo-czarne.svg", "logo-czarne", 520, "#FFFFFF", 56],
  ["ostoja-logo-biale.svg", "logo-biale", 520, "#3F5650", 56],
  ["ostoja-znak.svg", "znak", 220, "#F4F4F2", 40],
  ["ostoja-znak-maly.svg", "znak-maly", 96, "#F4F4F2", 24],
  ["ostoja-ikona-aplikacji.svg", "ikona-aplikacji", 220, "#F4F4F2", 24],
  ["zastosowanie-wizytowka.svg", "wizytowka", 1400, "#ECEDEB", 0],
  ["zastosowanie-naklejka-partnera.svg", "naklejka-partnera", 600, "#ECEDEB", 0],
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const [file, name, width, bg, pad] of jobs) {
  const svg = readFileSync(`${root}public/brand/${file}`, "utf8").replace(/<\?xml[^>]*\?>/, "");
  await page.setViewportSize({ width: width + pad * 2, height: 2000 });
  await page.setContent(`<body style="margin:0"><div id="box" style="display:inline-block;background:${bg};padding:${pad}px;line-height:0">
    <div style="width:${width}px">${svg.replace(/<svg /, '<svg style="width:100%;height:auto;display:block" ')}</div></div></body>`);
  await page.locator("#box").screenshot({ path: `${out}${name}.png` });
}
await browser.close();
console.log("Gotowe:", jobs.length, "obrazów w", out);
