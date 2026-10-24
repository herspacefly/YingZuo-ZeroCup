import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import content from '../../src/content/stories/reunion-v3.json' with { type: 'json' };
import current from '../../src/content/stories/reunion-v4.json' with { type: 'json' };
import previous from '../../src/content/stories/reunion-v2.json' with { type: 'json' };
import fixture from '../fixtures/project-v1.json' with { type: 'json' };
import type { ProjectV1, StoryNodeId, EndingId, Approach } from '../../src/domain/types';
import type { StoryDefinition } from '../../src/domain/story-types';
const definition = content as unknown as StoryDefinition;
const runtime = (page: Page) => page.locator('#story-runtime');
function projectAt(id: StoryNodeId, approach: Approach = 'call-first', ending: EndingId = 'home', mode: 'full' | 'guided' = 'guided', version: 3 | 4 = 3) {
  const project = structuredClone(fixture) as ProjectV1, story = project.story!;
  story.definitionVersion = version; story.nodeId = id; story.mode = mode; story.assistedNodeIds = [];
  const prefix = ['intro', 'craft', 'memory-wave', 'memory-words', 'memory-separate', 'road', 'road-rest', 'training', 'guardian', 'guardian-parley', 'approach-choice'];
  story.approach = prefix.includes(id) ? null : approach; story.approachSource = story.approach ? 'user' : null;
  story.ending = id.startsWith('ending-') && id !== 'ending-choice' || ['curtain', 'completed', 'reunion-reach', 'reunion-hold'].includes(id) ? ending : null;
  story.endingSource = story.ending ? 'user' : null; story.completedAt = ['curtain', 'completed'].includes(id) ? '2026-10-21T08:00:00.000Z' : null;
  if (['intro', 'craft'].includes(id)) story.castSnapshot = null;
  return project;
}
async function seed(page: Page, value: ProjectV1) {
  await page.goto('/study.html');
  await page.evaluate(async value => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('yingzuo-v1', 1); r.onupgradeneeded = () => r.result.createObjectStore('snapshots'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('snapshots', 'readwrite'); tx.objectStore('snapshots').put(JSON.stringify(value), 'draft'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
  }, value);
}
async function stored(page: Page) {
  return page.evaluate(async () => { const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('yingzuo-v1', 1); r.onsuccess = () => resolve(r.result); }); const value = await new Promise<string>(resolve => { const r = db.transaction('snapshots').objectStore('snapshots').get('draft'); r.onsuccess = () => resolve(r.result as string); }); db.close(); return JSON.parse(value) as ProjectV1; });
}
async function clock(page: Page) {
  await page.addInitScript(() => { let now = 0, id = 0; const callbacks = new Map<number, FrameRequestCallback>(); Object.defineProperty(performance, 'now', { value: () => now }); window.requestAnimationFrame = cb => { callbacks.set(++id, cb); return id; }; window.cancelAnimationFrame = id => { callbacks.delete(id); }; Reflect.set(window, '__advance', async (ms: number) => { while (ms > 0) { const d = Math.min(200, ms); ms -= d; now += d; const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(cb => cb(now)); await Promise.resolve(); } }); });
}
const advance = (page: Page, ms: number) => page.evaluate(ms => Reflect.get(window, '__advance')(ms), ms);
async function ready(page: Page, id?: string) {
  await expect(runtime(page)).toHaveAttribute('data-state', 'paused', { timeout: 15000 });
  await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state', 'ready', { timeout: 15000 });
  if (id) await expect(runtime(page)).toHaveAttribute('data-node', id);
}
test('restored v2 and v3 retain their own ending choice labels in graphical and text entries',async({page})=>{
  test.setTimeout(60000);await clock(page);
  for(const version of [2,3] as const){
    const project=projectAt('ending-choice');project.story!.definitionVersion=version;
    await seed(page,project);await page.goto('/#/story');await ready(page,'ending-choice');
    const endings=(version===2?previous:content).endings;
    for(const ending of endings)await expect(page.locator('#story-ending-'+ending.id)).toHaveText(ending.choiceLabel);
    await page.goto('/story.html');await expect(page.locator('#story-status')).toHaveAttribute('data-state','saved');
    for(const ending of endings)await expect(page.locator('#text-ending-'+ending.id)).toHaveText(ending.choiceLabel);
    await page.goto('/#/story');await ready(page,'ending-choice');
    if(version===3){await page.locator('#story-play').click();await advance(page,definition.nodes.find(node=>node.id==='ending-choice')!.guidedTiming.targetMs);}
    await page.locator('#story-ending-light').click();await expect.poll(async()=>(await stored(page)).story!.ending).toBe('light');
  }
});
for (const version of [3,4] as const) for (const approach of ['call-first', 'split-first'] as const) for (const ending of ['home', 'light', 'road', 'waiting', 'sacrifice'] as const) {
  test(`v${version} ${approach}/${ending}: complete route, canonical showcase, result and replay`, async ({ page }) => {
    test.setTimeout(180000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const definition=(version===4?current:content) as unknown as StoryDefinition;
    await clock(page); await seed(page, projectAt('intro', approach, ending, 'guided', version)); await page.goto('/#/story'); await ready(page, 'intro');
    const visited: string[] = [];
    for (let i = 0; i < 25; i++) {
      const id = (await runtime(page).getAttribute('data-node'))!, node = definition.nodes.find(node => node.id === id)!; visited.push(id); if (id === 'completed') break;
      if (id === 'craft') await page.locator('#story-confirm-craft').click();
      else {
        await page.locator('#story-play').click(); await advance(page, node.guidedTiming.targetMs);
        if (node.kind === 'choice') await page.locator(id === 'ending-choice' ? '#story-ending-' + ending : '#story-' + approach).click();
        else if (node.kind === 'interaction') {
          await expect(page.locator('.limb-overlay')).toBeVisible(); await page.locator('#story-assist').click(); await advance(page, 3600);
          await expect(runtime(page)).toHaveAttribute('data-showcase', 'playing'); await expect(page.locator('.limb-overlay')).toBeHidden(); await page.locator('#showcase-skip').click();
        } else if (node.completion.kind === 'scene' && node.completion.activation === 'user') await page.locator('#story-finish').click();
      }
      await expect(runtime(page)).not.toHaveAttribute('data-node', id); await ready(page);
    }
    expect(visited).toHaveLength(21); const saved = await stored(page); expect(saved.story).toMatchObject({ definitionVersion: version, nodeId: 'completed', ending, approach });
    await page.reload(); await ready(page, 'completed'); await page.goto('/#/result'); await expect(page.locator('#result-capture canvas.reunion-artifact')).toHaveAttribute('data-state', 'ready'); await expect(page.locator('#result-id')).toContainText(':ending:' + ending);
    if(version===4&&approach==='call-first')await page.locator('#result-capture').screenshot({path:`docs/evidence/t25-t28/ending-${ending}-${test.info().project.name}.png`});
    await page.locator('#result-replay').click(); await expect(page.locator('#replay-segment option')).toHaveCount(20); await page.locator('#replay-segment').selectOption('19'); await expect(page.locator('#result-replay-player .canvas-stage-status')).toHaveAttribute('data-state', 'ready'); expect(errors).toEqual([]);
  });
}
test('first visit follows background, draft craft, light, practice and explicit story confirmation', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/'); await expect(page.getByRole('button', { name: '从故事缘起开始', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '从故事缘起开始', exact: true }).click(); await expect(page.locator('#story-background')).toBeInViewport();
  await expect(page.locator('#story-background')).toContainText('刘彦昌'); await page.locator('#journey-to-craft').click();
  await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready'); await expect(page.locator('#craft-pattern')).toHaveCount(0); await page.locator('#craft-palette').selectOption('indigo-v1'); await page.locator('#journey-to-light').click();
  await expect(page).toHaveURL(/#\/light$/); expect((await stored(page)).story).toBeNull(); await page.locator('#journey-to-practice').click();
  await expect(page).toHaveURL(/#\/practice$/); await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready');
  await page.locator('#journey-to-story').click(); await ready(page, 'intro'); expect((await stored(page)).story).toMatchObject({ definitionVersion: 4, castSnapshot: null });
  await page.locator('#story-skip').click(); await ready(page, 'craft'); await expect(page).toHaveURL(/#\/story$/);
  await page.locator('#story-confirm-craft').click(); await ready(page, 'memory-wave'); expect((await stored(page)).story!.castSnapshot!.appearance.paletteId).toBe('indigo-v1');
  await page.goto('/'); await expect(page.getByRole('link', { name: '继续这一场 ↗', exact: true })).toBeVisible();
});
test('canonical showcase pauses, restarts, refreshes safely and a skipped failed save retries once', async ({ page }) => {
  await clock(page); await seed(page, projectAt('memory-wave')); await page.goto('/#/story'); await ready(page);
  await expect(page.locator('#story-assist')).toBeDisabled(); await page.locator('#story-play').click(); await advance(page, definition.nodes.find(node => node.id === 'memory-wave')!.guidedTiming.targetMs);
  await page.locator('#story-assist').click(); await advance(page, 3600); await expect(runtime(page)).toHaveAttribute('data-showcase', 'playing'); await page.locator('#story-pause').click(); const elapsed = await runtime(page).getAttribute('data-showcase-elapsed'); await advance(page, 2000); expect(await runtime(page).getAttribute('data-showcase-elapsed')).toBe(elapsed);
  await page.locator('#showcase-again').click(); await expect(runtime(page)).toHaveAttribute('data-showcase-elapsed', '0'); expect((await stored(page)).story!.nodeId).toBe('memory-wave');
  await page.reload(); await ready(page, 'memory-wave'); await expect(runtime(page)).toHaveAttribute('data-showcase', 'none');
  await page.locator('#story-play').click(); await advance(page, definition.nodes.find(node => node.id === 'memory-wave')!.guidedTiming.targetMs); await page.locator('#story-assist').click(); await advance(page, 3600);
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; let fail = true; IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) { if (fail && key === 'draft') { fail = false; throw new DOMException('T24 quota probe', 'QuotaExceededError'); } return put.call(this, value, key); }; });
  const revision = (await stored(page)).story!.revision; await page.locator('#showcase-skip').click(); await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'error'); expect((await stored(page)).story!.nodeId).toBe('memory-wave'); await page.locator('#retry-save').click(); await ready(page, 'memory-words'); expect((await stored(page)).story!.revision).toBe(revision + 1); expect((await stored(page)).story!.assistedNodeIds).toEqual(['memory-wave']);
});
test('real foot dragging and body movement produce the same canonical film as an untouched stage', async ({ page }) => {
  test.setTimeout(60000); await clock(page); const pictures: string[] = [];
  for (const chaotic of [false, true]) {
    await seed(page, projectAt('guardian')); await page.goto('/#/story'); await ready(page, 'guardian');
    await page.locator('#story-play').click(); await advance(page, definition.nodes.find(node => node.id === 'guardian')!.guidedTiming.targetMs);
    if (chaotic) {
      const foot = page.locator('[data-limb="leftFoot"]'); await foot.scrollIntoViewIfNeeded(); const b = (await foot.boundingBox())!;
      const initial = await page.locator('#story-rod-leftHip').inputValue();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2 - 40, b.y + b.height / 2 - 35, { steps: 8 }); await page.mouse.up();
      await expect(page.locator('#story-rod-leftHip')).not.toHaveValue(initial);
      await page.locator('.canvas-stage-screen').focus(); await page.keyboard.down('ArrowLeft'); await advance(page, 400); await page.keyboard.up('ArrowLeft');
      await expect(runtime(page)).toHaveAttribute('data-node', 'guardian');
    }
    await page.locator('#story-assist').click(); await advance(page, 3600); await expect(runtime(page)).toHaveAttribute('data-showcase', 'playing');
    await expect(page.locator('.rod-overlay')).toBeHidden(); await expect(page.locator('.limb-overlay')).toBeHidden();
    await page.locator('#showcase-again').click(); await advance(page, 4000); await page.locator('#story-pause').click();
    pictures.push(await page.locator('canvas.shadow-stage').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL()));
  }
  expect(pictures[1]).toBe(pictures[0]);
});
