/**
 * Renders the PWA app icons (SPEC §15.0): Tara's face on a round Physics-purple stepping stone with the
 * gold ✓ badge.
 *
 *   npx tsx scripts/make-icons.ts
 *
 * Writes public/icons/icon-192.png, icon-512.png (transparent corners) and icon-maskable-512.png
 * (full-bleed sky background; stone + badge kept inside the 80% maskable safe zone). Uses Playwright's
 * Chromium to rasterise the SVG, so no image library is needed. Re-run after changing the artwork.
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const OUT = resolve('public/icons');

/* Colours from tokens.css (Physics + gold) and Tara's palette, lifted a little to read on purple. */
const PHYSICS = '#7a5af8';
const PHYSICS_D = '#5536d1';
const GOLD = '#ffc83d';
const GOLD_D = '#d99e00';
const ON_GOLD = '#3a2600';
const TARA = '#c3cdea';
const TARA_EAR = '#ffb0c8';
const INK = '#1b2845';

/** Tara (same drawing as src/components/Tara.tsx, happy mood) in a 120×120 box. */
const tara = `
  <ellipse cx="25" cy="56" rx="23" ry="27" fill="${TARA}"/>
  <ellipse cx="27" cy="58" rx="14" ry="18" fill="${TARA_EAR}"/>
  <ellipse cx="95" cy="56" rx="23" ry="27" fill="${TARA}"/>
  <ellipse cx="93" cy="58" rx="14" ry="18" fill="${TARA_EAR}"/>
  <path d="M57 78 C55 92 57 103 66 106 C74 108 79 101 74 96" fill="none" stroke="${TARA}" stroke-width="13" stroke-linecap="round"/>
  <circle cx="60" cy="58" r="33" fill="${TARA}"/>
  <path d="M50 30 q4 -8 8 -1 M58 28 q5 -9 9 0" fill="none" stroke="${TARA}" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="48" cy="55" rx="5" ry="6" fill="${INK}"/>
  <ellipse cx="72" cy="55" rx="5" ry="6" fill="${INK}"/>
  <circle cx="49.8" cy="52.8" r="1.9" fill="#fff"/>
  <circle cx="73.8" cy="52.8" r="1.9" fill="#fff"/>
  <ellipse cx="40" cy="68" rx="7" ry="4.5" fill="#ff7aa2" opacity=".6"/>
  <ellipse cx="80" cy="68" rx="7" ry="4.5" fill="#ff7aa2" opacity=".6"/>
  <path d="M53 74 q7 5 14 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>
  <g transform="translate(96 28)">
    <g fill="#ffffff" stroke="#dfe6f2" stroke-width="1">
      ${[0, 72, 144, 216, 288].map((r) => `<ellipse rx="4.6" ry="8" transform="rotate(${r}) translate(0 -6.5)"/>`).join('')}
    </g>
    <circle r="3.4" fill="#ffd23f"/>
  </g>`;

/**
 * The icon on a 100×100 canvas. `r` is the stone radius; the stone is centred slightly high so its
 * solid "ledge" (the darker bottom edge) shows, like the stones on Today's trail.
 */
function iconSvg(size: number, opts: { r: number; background?: boolean }): string {
  const { r } = opts;
  const cx = 50;
  const cy = 50 - r * 0.04;
  const ledge = r * 0.09;
  const badgeR = r * 0.24;
  const bx = cx + r * 0.7;
  const by = cy - r * 0.7;
  const taraSize = r * 1.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#bfe7ff"/><stop offset="1" stop-color="#f1fbff"/>
      </linearGradient>
      <radialGradient id="shine" cx=".35" cy=".3" r=".8">
        <stop offset="0" stop-color="#9a80ff"/><stop offset="1" stop-color="${PHYSICS}"/>
      </radialGradient>
    </defs>
    ${opts.background ? '<rect width="100" height="100" fill="url(#sky)"/>' : ''}
    <circle cx="${cx}" cy="${cy + ledge}" r="${r}" fill="${PHYSICS_D}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#shine)"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.84}" fill="none" stroke="#ffffff" stroke-opacity=".9"
      stroke-width="${r * 0.05}" stroke-linecap="round" stroke-dasharray="0 ${r * 0.16}"/>
    <svg x="${cx - taraSize / 2}" y="${cy - taraSize / 2 + r * 0.04}" width="${taraSize}" height="${taraSize}" viewBox="0 0 120 120">${tara}</svg>
    <circle cx="${bx}" cy="${by + badgeR * 0.16}" r="${badgeR}" fill="${GOLD_D}"/>
    <circle cx="${bx}" cy="${by}" r="${badgeR}" fill="${GOLD}" stroke="#ffffff" stroke-width="${badgeR * 0.2}"/>
    <path d="M${bx - badgeR * 0.45} ${by + badgeR * 0.02} l${badgeR * 0.3} ${badgeR * 0.32} l${badgeR * 0.6} ${-badgeR * 0.66}"
      fill="none" stroke="${ON_GOLD}" stroke-width="${badgeR * 0.26}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const jobs = [
      { file: 'icon-192.png', size: 192, r: 40, background: false },
      { file: 'icon-512.png', size: 512, r: 40, background: false },
      // maskable: everything inside the centre circle of radius 40% (safe zone)
      { file: 'icon-maskable-512.png', size: 512, r: 29, background: true },
    ];
    for (const j of jobs) {
      const page = await browser.newPage({
        viewport: { width: j.size, height: j.size },
        deviceScaleFactor: 1,
      });
      await page.setContent(
        `<!doctype html><html><body style="margin:0;background:transparent">${iconSvg(j.size, j)}</body></html>`,
      );
      await page
        .locator('svg')
        .first()
        .screenshot({ path: `${OUT}/${j.file}`, omitBackground: !j.background });
      await page.close();
      console.log(`saved public/icons/${j.file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
