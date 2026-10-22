import { expect, test } from '@playwright/test';
import media from '../../src/content/museum-media.json' with { type: 'json' };

test('museum photo gallery keeps local lazy images, actual captions and keyboard modal focus', async ({ page }) => {
  await page.goto('/#/museum/E07');
  const gallery = page.locator('#museum-gallery');
  await expect(gallery.locator('.museum-photo-card')).toHaveCount(2);
  await expect(gallery.locator('img').first()).toHaveAttribute('loading', 'lazy');
  await expect(gallery).toContainText('华县');
  await expect(gallery).toContainText('华阴老腔是另一项目');
  await expect(gallery.locator('.museum-photo-attribution').first()).toContainText('许可状态保留未知');
  const opener = gallery.locator('.museum-photo-enlarge').first();
  await opener.click();
  const dialog = page.getByRole('dialog', { name: '唐山影人 · 髯' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('img')).toHaveJSProperty('naturalWidth', 600);
  await expect(dialog.getByRole('button', { name: '关闭大图 ×' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: '查看原始图片 ↗' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '关闭大图 ×' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('gallery load failure reports and really retries; exiting an open modal releases it', async ({ page }) => {
  let fail = true;
  await page.route('**/assets/museum/tangshan-ran.jpg*', route => fail ? route.abort() : route.continue());
  await page.goto('/#/museum/E07'); const card = page.locator('#museum-gallery .museum-photo-card').first();
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('.museum-photo-error')).toContainText('暂时未能载入');
  fail = false; await card.getByRole('button', { name: '重试载入图片' }).click();
  await expect(card.locator('img')).toHaveJSProperty('naturalWidth', 600);
  await expect(card.locator('.museum-photo-error')).toBeHidden();
  await card.locator('.museum-photo-enlarge').click();
  await page.evaluate(() => { location.hash = '#/museum'; });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('all eight photo readings retain their declared counts and original files', async ({ page }) => {
  for (const exhibit of media.exhibits) {
    await page.goto(`/#/museum/${exhibit.exhibitId}`);
    const gallery = page.locator('#museum-gallery');
    await expect(gallery.locator('.museum-photo-card')).toHaveCount(exhibit.mediaIds.length);
    await expect(gallery.locator('.museum-gallery-paragraph')).toHaveCount(exhibit.paragraphs.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
