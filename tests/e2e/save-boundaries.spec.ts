import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ProjectV1 } from '../../src/domain/types';
import fixture from '../fixtures/project-v1.json' with { type: 'json' };
import content from '../../src/content/stories/reunion-v1.json' with { type: 'json' };

type Mode = 'full' | 'guided';
type NodeId = NonNullable<ProjectV1['story']>['nodeId'];
const wait = { timeout: 15_000 };
const runtime = (page: Page) => page.locator('#story-runtime');
const saved = (page: Page) => expect(page.locator('#save-state')).toHaveAttribute('data-state', 'saved', wait);

test.beforeEach(() => { test.setTimeout(90_000); });

function at(nodeId: NodeId, mode: Mode = 'full'): ProjectV1 {
  const project = structuredClone(fixture) as ProjectV1;
  const story = project.story!;
  story.nodeId = nodeId; story.mode = mode; story.assistedNodeIds = [];
  if (['intro', 'craft', 'memory-wave', 'memory-separate', 'road', 'training', 'guardian', 'approach-choice'].includes(nodeId)) {
    story.approach = null; story.approachSource = null;
  } else if (nodeId.startsWith('split-')) story.approach = 'split-first';
  if (['intro', 'craft'].includes(nodeId)) story.castSnapshot = null;
  return project;
}

async function seed(page: Page, project: ProjectV1) {
  // Only fixture setup writes storage directly. Every tested save uses the real product UI.
  await page.goto('/study.html');
  await page.evaluate(async project => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('yingzuo-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readwrite');
        tx.objectStore('snapshots').put(JSON.stringify(project), 'draft');
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, project);
}

async function stored(page: Page): Promise<ProjectV1> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('yingzuo-v1', 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      const json = await new Promise<string>((resolve, reject) => {
        const request = db.transaction('snapshots').objectStore('snapshots').get('draft');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      return JSON.parse(json);
    } finally { db.close(); }
  });
}

async function ready(page: Page, nodeId?: NodeId) {
  await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready', wait);
  await expect(runtime(page)).toHaveAttribute('data-state', 'paused', wait);
  if (nodeId) await expect(runtime(page)).toHaveAttribute('data-node', nodeId);
}

async function directorClock(page: Page) {
  await page.addInitScript(() => {
    let now = 0, id = 0;
    const frames = new Map<number, FrameRequestCallback>();
    Object.defineProperty(performance, 'now', { value: () => now });
    window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
    window.cancelAnimationFrame = id => { frames.delete(id); };
    Reflect.set(window, '__saveBoundaryFrame', (delta: number) => {
      now += delta; const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback(now));
    });
    Reflect.set(window, '__saveBoundaryFrames', () => frames.size);
  });
}

async function advance(page: Page, ms: number) {
  await page.evaluate(async remaining => {
    while (remaining > 0) {
      const delta = Math.min(100, remaining);
      Reflect.get(window, '__saveBoundaryFrame')(delta); remaining -= delta; await Promise.resolve();
    }
  }, ms);
}

async function range(page: Page, id: string, value: number) {
  await page.locator(id).evaluate((input: HTMLInputElement, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function exportProject(page: Page): Promise<ProjectV1> {
  if (!(await page.locator('#project-tools').getAttribute('open'))) {
    // An open details element has open="", so check its boolean property.
    if (!(await page.locator('#project-tools').evaluate((details: HTMLDetailsElement) => details.open))) {
      await page.locator('#open-project-tools').click();
    }
  }
  const downloading = page.waitForEvent('download');
  await page.locator('#export-project').click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function freezeTimers(page: Page) {
  const time = new Date('2026-10-19T08:00:00.000Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
}

const closeCases = ['opening', 'before-choice', 'after-choice', 'operating', 'operation-saved', 'curtain'] as const;
for (const mode of ['full', 'guided'] as const) for (const phase of closeCases) {
  test(`${mode} ${phase}: close the tab and restore a fresh page at the saved checkpoint`, async ({ page, context }) => {
    const errors: string[] = [];
    context.on('page', next => next.on('pageerror', error => errors.push(error.message)));
    page.on('pageerror', error => errors.push(error.message));
    await directorClock(page);
    const initialNode = phase === 'opening' ? 'intro' : phase === 'operation-saved' ? 'call-light' :
      phase === 'curtain' ? 'reunion-hold' : phase === 'operating' ? 'split-axe' : 'approach-choice';
    const project = at(initialNode, mode);
    if (phase === 'opening') project.story = null;
    await seed(page, project); await page.goto('/#/story');
    if (phase === 'opening') {
      await page.locator('#story-start').click(); await ready(page, 'intro');
      if (mode === 'guided') { await page.locator('#story-mode').selectOption(mode); await ready(page, 'intro'); }
      await page.locator('#story-play').click(); await advance(page, 4500);
    } else {
      await ready(page, initialNode);
      if (phase === 'after-choice') { await page.locator('#story-split-first').click(); await ready(page, 'split-axe'); }
      if (phase === 'operating') {
        await page.locator('#story-play').click(); await range(page, '#story-rod-rightShoulder', 1.2); await advance(page, 300);
        await expect(page.locator('#story-rod-rightShoulder')).toHaveValue('1.2');
      }
      if (phase === 'operation-saved') {
        await page.locator('#story-play').click(); await range(page, '#story-distance', .4);
        await range(page, '#story-rod-x', .535); await range(page, '#story-rod-y', .565);
        await advance(page, 2600); await ready(page, 'call-response');
      }
      if (phase === 'curtain') {
        await page.locator('#story-play').click(); await advance(page, 4000);
        await page.locator('#story-finish').click(); await ready(page, 'curtain');
        await page.locator('#story-play').click(); await advance(page, 1500);
      }
    }
    await saved(page);
    const checkpoint = await stored(page);
    if (phase === 'before-choice') expect(checkpoint.story!.approach).toBeNull();
    if (phase === 'after-choice') expect(checkpoint.story).toMatchObject({ nodeId: 'split-axe', approach: 'split-first', revision: project.story!.revision + 1 });
    if (phase === 'operation-saved') expect(checkpoint.story).toMatchObject({ nodeId: 'call-response', revision: project.story!.revision + 1, assistedNodeIds: [] });
    if (phase === 'curtain') expect(checkpoint.story!.completedAt).not.toBeNull();
    await page.close();
    const reopened = await context.newPage(); await directorClock(reopened); await reopened.goto('/#/story');
    await ready(reopened, checkpoint.story!.nodeId); await saved(reopened);
    await expect(runtime(reopened)).toHaveAttribute('data-elapsed', '0');
    expect(await reopened.evaluate(() => Reflect.get(window, '__saveBoundaryFrames')())).toBe(0);
    if (phase === 'operating') await expect(reopened.locator('#story-rod-rightShoulder')).toHaveValue('0');
    // Exact equality also protects run/result identity, completedAt, frozen cast and save revision.
    expect(await stored(reopened)).toEqual(checkpoint);
    expect(await exportProject(reopened)).toEqual(checkpoint);
    expect(errors).toEqual([]);
  });
}

for (const mode of ['full', 'guided'] as const) {
  test(`${mode}: close after the guardian checkpoint commits while its required image is still loading`, async ({ page, context }) => {
    let requested = false;
    // Leave this response pending until page.close aborts it; page routes are not inherited by the new page.
    await page.route(/\/assets\/(?:puppets\/guardian-v1\/head-color\.png|delivery\/guardian-v1-head-color\.webp)(?:\?|$)/, () => { requested = true; });
    await directorClock(page);
    const project = at('training', mode); await seed(page, project); await page.goto('/#/story'); await ready(page, 'training');
    await page.locator('#story-play').click();
    const definition = content.nodes.find(node => node.id === 'training')!;
    await advance(page, (mode === 'full' ? definition.fullTiming : definition.guidedTiming).targetMs);
    await expect.poll(() => requested, wait).toBe(true);
    await expect(runtime(page)).toHaveAttribute('data-node', 'guardian');
    await expect(runtime(page)).toHaveAttribute('data-state', 'loading'); await saved(page);
    const checkpoint = await stored(page);
    expect(checkpoint.story).toMatchObject({ nodeId: 'guardian', revision: project.story!.revision + 1 });
    expect(checkpoint.saveRevision).toBe(project.saveRevision + 1);
    await page.close();
    const reopened = await context.newPage(); await directorClock(reopened); await reopened.goto('/#/story');
    await ready(reopened, 'guardian'); await expect(runtime(reopened)).toHaveAttribute('data-elapsed', '0');
    expect(await stored(reopened)).toEqual(checkpoint);
  });
}

test('product craft tabs keep both edited palettes when one transaction loses the version check', async ({ page, context }) => {
  const project = at('approach-choice'); project.lastRoute = '/craft';
  await seed(page, project); await freezeTimers(page); await page.goto('/#/craft');
  await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready', wait); await saved(page);
  const second = await context.newPage(); await second.goto('/#/craft');
  await expect(second.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready', wait); await saved(second);
  // Both drafts are dirty before either is persisted. Frozen timers prevent a host pause changing the winner.
  await page.locator('#craft-palette').selectOption('woodland-v1');
  await second.locator('#craft-palette').selectOption('vermilion-v1');
  await page.getByRole('button', { name: '保存这身行装', exact: true }).click(); await saved(page);
  const winner = await stored(page);
  await second.getByRole('button', { name: '保存这身行装', exact: true }).click();
  await expect(second.locator('#save-state')).toHaveAttribute('data-state', 'conflict', wait);
  const winnerExport = await exportProject(page), loserExport = await exportProject(second);
  expect(winnerExport).toEqual(winner);
  expect(winner.appearance.paletteId).toBe('woodland-v1'); expect(loserExport.appearance.paletteId).toBe('vermilion-v1');
  expect(winner.story).toEqual(project.story); expect(loserExport.story).toEqual(project.story);
  await page.clock.runFor(2500); expect(await stored(second)).toEqual(winner);
  await second.close(); expect(await stored(page)).toEqual(winner);
  await page.reload(); await saved(page); await expect(page.locator('#craft-palette')).toHaveValue('woodland-v1');
});

test('product story tabs export both branch decisions while the stale candidate cannot replace the winner', async ({ page, context }) => {
  const project = at('approach-choice'); await seed(page, project); await page.goto('/#/story'); await ready(page, 'approach-choice');
  const second = await context.newPage(); await second.goto('/#/story'); await ready(second, 'approach-choice');
  await page.locator('#story-call-first').click(); await ready(page, 'call-light'); await saved(page);
  const winner = await stored(page);
  await second.locator('#story-split-first').click();
  await expect(second.locator('#save-state')).toHaveAttribute('data-state', 'conflict', wait);
  await expect(runtime(second)).toHaveAttribute('data-node', 'approach-choice');
  expect(await exportProject(page)).toEqual(winner);
  const candidate = await exportProject(second);
  expect(winner.story).toMatchObject({ nodeId: 'call-light', approach: 'call-first', revision: project.story!.revision + 1 });
  expect(candidate.story).toMatchObject({ nodeId: 'split-axe', approach: 'split-first', revision: project.story!.revision + 1 });
  expect(candidate.story!.castSnapshot).toEqual(project.story!.castSnapshot);
  expect(candidate.projectId).toBe(winner.projectId); expect(candidate.story!.runId).toBe(winner.story!.runId);
  await second.locator('#cancel-pending').click();
  await expect(second.locator('#cancel-pending')).toBeHidden();
  await expect(second.locator('#save-state')).toHaveAttribute('data-state', 'conflict');
  expect(await stored(second)).toEqual(winner);
  await second.locator('#reload-project').click(); await ready(second, 'call-light'); await saved(second);
  expect(await stored(second)).toEqual(winner); expect(await exportProject(second)).toEqual(winner);
});

for (const approach of ['call-first', 'split-first'] as const) {
  test(`palette edit then ${approach} within 500ms commits the latest whole project and invalidates old timers`, async ({ page }) => {
    const project = at('approach-choice'); project.lastRoute = '/craft'; await seed(page, project);
    await freezeTimers(page); await page.goto('/#/craft');
    await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready', wait); await saved(page);
    await page.evaluate(() => {
      document.addEventListener('change', event => {
        if ((event.target as HTMLElement).id === 'craft-palette') Reflect.set(window, '__paletteChangedAt', performance.now());
      });
      document.addEventListener('click', event => {
        if (['story-call-first', 'story-split-first'].includes((event.target as HTMLElement).id)) Reflect.set(window, '__branchChosenAt', performance.now());
      });
    });
    await page.locator('#craft-palette').selectOption('woodland-v1');
    await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'unsaved');
    await page.clock.runFor(100);
    await page.locator('#craft-return').click(); await ready(page, 'approach-choice');
    await page.locator(approach === 'call-first' ? '#story-call-first' : '#story-split-first').click();
    const nodeId = approach === 'call-first' ? 'call-light' : 'split-axe'; await ready(page, nodeId); await saved(page);
    const elapsed = await page.evaluate(() => Reflect.get(window, '__branchChosenAt') - Reflect.get(window, '__paletteChangedAt'));
    expect(elapsed).toBe(100); expect(elapsed).toBeLessThan(500);
    const checkpoint = await stored(page);
    expect(checkpoint.appearance.paletteId).toBe('woodland-v1');
    expect(checkpoint.story).toMatchObject({ nodeId, approach, revision: project.story!.revision + 1 });
    expect(checkpoint.story!.castSnapshot).toEqual(project.story!.castSnapshot);
    expect(checkpoint.story!.castSnapshot!.appearance.paletteId).toBe('vermilion-v1');
    expect(checkpoint.saveRevision).toBe(project.saveRevision + 1); expect(checkpoint.lastRoute).toBe('/story');
    await page.clock.runFor(2500); expect(await stored(page)).toEqual(checkpoint);
    await page.reload(); await ready(page, nodeId); await saved(page);
    await expect(runtime(page)).toHaveAttribute('data-elapsed', '0');
    expect(await stored(page)).toEqual(checkpoint); expect(await exportProject(page)).toEqual(checkpoint);
  });
}
