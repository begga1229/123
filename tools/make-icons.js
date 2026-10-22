#!/usr/bin/env node
/*
 * Formula Studio — icon generator (dev-time only, not shipped).
 * Draws the app icon as SVG, renders every size separately with Playwright/Chromium and
 * writes assets/icons/icon.svg, icon.png (512×512) and icon.ico (PNG-in-ICO: 256,128,64,48,32,16).
 *
 *   EFS_DEV_NODE_MODULES=/path/to/node_modules node tools/make-icons.js
 *
 * Needs `playwright` (and a Chromium; set EFS_CHROMIUM to an executable to override).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'icons');
const NM = process.env.EFS_DEV_NODE_MODULES || path.join(ROOT, 'node_modules');
const ICO_SIZES = [256, 128, 64, 48, 32, 16];

/** The icon as an SVG string. Small sizes drop the grid so "fx" stays readable. */
function iconSvg(size) {
  const simple = size <= 32;
  const grid = [];
  if (!simple) {
    // a 4×4 sheet grid, faint white lines, slightly stronger header row/column
    for (let i = 1; i < 4; i++) {
      const p = 64 + i * 96;
      const w = i === 1 ? 12 : 8;
      const o = i === 1 ? 0.55 : 0.28;
      grid.push(`<line x1="${p}" y1="64" x2="${p}" y2="448" stroke="#fff" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"/>`);
      grid.push(`<line x1="64" y1="${p}" x2="448" y2="${p}" stroke="#fff" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"/>`);
    }
    grid.push('<rect x="64" y="64" width="384" height="384" rx="28" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="12"/>');
  }
  const fx = simple
    ? '<text x="256" y="350" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-style="italic" font-size="300" fill="#fff" letter-spacing="-12">fx</text>'
    : '<g filter="url(#sh)"><text x="292" y="392" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-style="italic" font-size="236" fill="#fff" letter-spacing="-8">fx</text></g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2bb673"/>
      <stop offset="1" stop-color="#127a43"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#06331b" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect x="${simple ? 8 : 16}" y="${simple ? 8 : 16}" width="${simple ? 496 : 480}" height="${simple ? 496 : 480}" rx="${simple ? 96 : 108}" fill="url(#bg)"/>
  ${grid.join('\n  ')}
  ${fx}
</svg>`;
}

/** Build an .ico from [{size, png:Buffer}] (PNG-compressed entries, valid on Windows Vista+). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach((img, i) => {
    const b = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b);
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b + 1);
    dir.writeUInt8(0, b + 2);       // palette colours
    dir.writeUInt8(0, b + 3);       // reserved
    dir.writeUInt16LE(1, b + 4);    // colour planes
    dir.writeUInt16LE(32, b + 6);   // bits per pixel
    dir.writeUInt32LE(img.png.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += img.png.length;
  });
  return Buffer.concat([header, dir].concat(images.map((i) => i.png)));
}

async function main() {
  const { chromium } = require(path.join(NM, 'playwright'));
  const launch = { args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] };
  if (process.env.EFS_CHROMIUM) launch.executablePath = process.env.EFS_CHROMIUM;
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  async function render(size) {
    await page.setViewportSize({ width: Math.max(size, 64), height: Math.max(size, 64) });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${iconSvg(size)}</body></html>`);
    return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'icon.svg'), iconSvg(512));
  const big = await render(512);
  fs.writeFileSync(path.join(OUT, 'icon.png'), big);
  const images = [];
  for (const s of ICO_SIZES) images.push({ size: s, png: await render(s) });
  fs.writeFileSync(path.join(OUT, 'icon.ico'), buildIco(images));
  if (process.env.EFS_ICON_PREVIEW_DIR) {
    for (const s of [256, 32, 16]) fs.writeFileSync(path.join(process.env.EFS_ICON_PREVIEW_DIR, `preview-${s}.png`), images.find((i) => i.size === s).png);
  }
  await browser.close();
  console.log('icons written to', OUT);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { iconSvg, buildIco };
