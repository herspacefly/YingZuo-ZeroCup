import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('./', import.meta.url));
const base = process.env.YINGZUO_PREVIEW ?? 'http://127.0.0.1:5173/';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const rows = [];
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  for (const width of [320, 360, 390, 600, 760, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await page.locator('#save-state[data-state="saved"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (width <= 760) await page.locator('#menu-toggle').click();
    const row = await page.evaluate(() => {
      const font = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
      const targets = [...document.querySelectorAll('.site-header button,.site-nav a')].filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).map(el => ({ text: el.textContent.trim(), height: el.getBoundingClientRect().height }));
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        title: font('.site-positioning'), subtitle: font('.site-positioning-subtitle'),
        navigation: font('.site-nav'), music: font('.music-toggle'), targets };
    });
    if (row.scrollWidth > width || row.targets.some(target => target.height < 44)) throw new Error(JSON.stringify(row));
    if (width <= 760 && (row.navigation > 14 || row.music > 14)) throw new Error('Mobile header text did not shrink');
    rows.push(row);
    if ([320, 390, 1440].includes(width)) await page.screenshot({ path: `${output}header-${width}.png` });
  }
  writeFileSync(`${output}header.json`, JSON.stringify({ base, rows }, null, 2) + '\n');
  process.stdout.write(`PASS: ${rows.length} header widths; no overflow; all visible controls at least 44px high.\n`);
} finally {
  await browser.close();
}
