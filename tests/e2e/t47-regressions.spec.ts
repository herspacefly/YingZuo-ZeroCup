import { test, expect } from './formal-fixture';
import type { Page } from '@playwright/test';
import { currentProject } from '../helpers/current-project';
import definition from '../../src/content/stories/reunion.json' with { type: 'json' };
import type { StoryNodeId } from '../../src/domain/types';

async function seed(page: Page, node: StoryNodeId) {
  const value = currentProject(node);
  await page.goto('/study.html');
  await page.evaluate(async value => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('yingzuo-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      tx.objectStore('snapshots').put(JSON.stringify(value), 'draft');
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, value);
  return value;
}

test('chosen endings stay in progress until the actual result checkpoint', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const ending of definition.endings) {
    const action = definition.nodes.find(node => node.kind === 'interaction' && 'ending' in node.prerequisites && node.prerequisites.ending === ending.id)!;
    for (const node of [action.id, ending.epilogueNodeId]) {
      const project = await seed(page, node as StoryNodeId);
      expect(project.story!.completedAt).toBeNull();
      await page.goto('/#/result');
      await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'saved');
      await expect(page.locator('#app-view h1')).toHaveText('这一场，还在路上。');
      await expect(page.locator('#app-view .page-lead')).not.toHaveText(ending.summary);
      await expect(page.locator('#result-png')).toBeHidden();
      await expect(page.locator('#result-json')).toBeHidden();
      await expect(page.locator('#result-stamp')).toBeHidden();
      await expect(page.locator('#result-capture canvas')).toHaveCount(0);
      await expect(page.locator('.result-records')).toContainText(definition.nodes.find(item => item.id === node)!.title);
    }
  }
});

test('museum drag handles retain their centered transform on hover and press', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#/museum/E03');
  await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('.opening-curtain')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  for (const rod of ['body', 'leftHand', 'rightHand']) {
    await page.locator('#museum-demo-reset').click();
    const handle = page.locator(`[data-rod=${rod}]`);
    await handle.scrollIntoViewIfNeeded();
    const transform = () => handle.evaluate(node => getComputedStyle(node).transform);
    const before = await transform(), box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (isMobile) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      expect(await transform()).toBe(before);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 16, y: y - 20 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-rod=${rod}]` });
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
      await handle.evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))); });
      expect(await transform()).toBe(before);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      await cdp.detach();
      await page.mouse.move(x, y);
      await expect.poll(transform).toBe(before);
      const hovered = (await handle.boundingBox())!;
      expect(hovered.x).toBeCloseTo(box.x, 1); expect(hovered.y).toBeCloseTo(box.y, 1);
      await page.mouse.down(); expect(await transform()).toBe(before);
      await page.mouse.move(x + 16, y - 20, { steps: 6 }); await page.mouse.up();
    }
    await expect(page.locator('#museum-demo-root')).toHaveAttribute('data-last-rod', rod);
  }
});
