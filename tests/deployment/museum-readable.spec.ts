import { test, expect } from '@playwright/test';

test('knowledge and search metadata are present in production HTML', async ({ request }) => {
  const response = await request.get('museum.html');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).not.toMatch(/<script\b/i);
  expect(html).not.toContain('<!-- museum-content -->');
  for (let index = 1; index <= 7; index++) {
    expect(html).toContain(`id="E0${index}"`);
    expect(html).toContain(`./index.html#/museum/E0${index}`);
  }
  expect(html).toContain('工艺与剧目资料');
  expect(html).toContain('数字示意');
  expect(html).toContain('本作原创');
  expect(html).toContain('图片原资料页面');
  expect(html).toContain('具体复用许可');
  const origin = 'https://herspacefly.github.io/YingZuo-ZeroCup/';
  for (const file of ['', 'museum.html', 'credits.html']) {
    const page = await request.get(file || './');
    expect(page.status()).toBe(200);
    expect(await page.text()).toContain(`rel="canonical" href="${origin}${file}"`);
  }
  const sitemap = await request.get('sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1])).toEqual([origin, origin + 'museum.html', origin + 'credits.html']);
});

test('knowledge remains readable and navigable without JavaScript or app startup', async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: info.project.use.viewport });
  try {
    const page = await context.newPage(), activeResources: string[] = [];
    page.on('request', request => {
      if (['script', 'media'].includes(request.resourceType()) || request.url().includes('/assets/delivery/')) activeResources.push(request.url());
    });
    await page.goto('museum.html');
    await expect(page.locator('.museum-reader-exhibit')).toHaveCount(7);
    await expect(page.getByRole('heading', { name: '从一张皮，读到一出戏。' })).toBeVisible();
    await page.locator('.museum-reader-toc a[href="#E07"]').click();
    await expect(page).toHaveURL(/museum\.html#E07$/);
    await expect(page.locator('#title-E07')).toBeInViewport();
    await page.locator('#E07 summary').click();
    await expect(page.locator('#E07 details[open]')).toBeVisible();
    await expect(page.locator('#E07 a[href="./index.html#/museum/E07"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
    expect(activeResources).toEqual([]);
  } finally { await context.close(); }
});
