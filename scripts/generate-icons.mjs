// Genera los íconos PNG de la PWA a partir de un SVG, usando Chromium (Playwright).
// Uso: node scripts/generate-icons.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

// Anillo de progreso: el motivo visual de la app (objetivo diario).
const mark = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <circle cx="256" cy="256" r="150" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="56"/>
    <path d="M256 106 A150 150 0 1 1 113.3 302.4" fill="none" stroke="#fff" stroke-width="56" stroke-linecap="round"/>
  </g>`;

const svg = (scale, rounded) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff7a45"/><stop offset="1" stop-color="#f2481f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
  ${mark(scale)}
</svg>`;

const targets = [
  { file: "icon-192.png", size: 192, scale: 1, rounded: true },
  { file: "icon-512.png", size: 512, scale: 1, rounded: true },
  // Maskable: el sistema recorta; el motivo queda dentro de la zona segura (80 %).
  { file: "icon-maskable-512.png", size: 512, scale: 0.78, rounded: false },
  // iOS redondea las esquinas por su cuenta: fondo a sangre.
  { file: "apple-touch-icon.png", size: 180, scale: 1, rounded: false },
  { file: "favicon-32.png", size: 32, scale: 1.1, rounded: true },
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  const body = svg(t.scale, t.rounded).replace('width="512" height="512"', `width="${t.size}" height="${t.size}"`);
  await page.setContent(`<html><body style="margin:0;background:transparent">${body}</body></html>`);
  await page.screenshot({ path: `public/icons/${t.file}`, omitBackground: true });
  await page.close();
}
await browser.close();
console.log("Íconos generados en public/icons");
