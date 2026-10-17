import { describe, expect, it } from 'vitest';
import { createHashRouter, parseHash, routeHash } from '../../src/app/router';
import type { HashLocationPort } from '../../src/app/router';
import { EXHIBIT_IDS, PROJECT_ROUTES } from '../../src/domain/limits';

describe('product hash contract', () => {
  it('accepts eight stable roots and eight museum children', () => {
    for (const path of PROJECT_ROUTES) expect(parseHash(`#${path}`)).toEqual({ route: { path, exhibitId: null }, canonicalHash: `#${path}`, redirected: false, invalid: false });
    for (const exhibitId of EXHIBIT_IDS) {
      const parsed = parseHash(`#/museum/${exhibitId}`);
      expect(parsed.route).toEqual({ path: '/museum', exhibitId }); expect(parsed.invalid).toBe(false);
      expect(routeHash(parsed.route)).toBe(`#/museum/${exhibitId}`);
    }
  });
  it('normalizes only known legacy aliases and empty home', () => {
    for (const input of ['', '#', '#main']) expect(parseHash(input).canonicalHash).toBe('#/');
    expect(parseHash('#/stage')).toMatchObject({ canonicalHash: '#/practice', invalid: false, redirected: true });
    expect(parseHash('#light-study').canonicalHash).toBe('#/light');
  });
  it('does not interpret arbitrary hashes as a story command or exhibit visit', () => {
    for (const input of ['#/story/curtain', '#/museum/E09', '#/museum/e01', '#/museum/E01/extra', '#/craft?done=true', '#/story?node=completed', 'toString', '#__proto__', '#/stage/']) {
      expect(parseHash(input)).toMatchObject({ route: { path: '/', exhibitId: null }, invalid: true, canonicalHash: '#/' });
    }
  });
});

function location(hash: string) {
  let listener = () => {}; const replacements: string[] = [], pushes: string[] = [];
  const port: HashLocationPort = {
    read: () => hash, push(value) { pushes.push(value); hash = value; },
    replace(value) { replacements.push(value); hash = value; },
    listen(callback) { listener = callback; return () => { listener = () => {}; }; },
  };
  return { port, replacements, pushes, event(value?: string) { if (value !== undefined) hash = value; listener(); } };
}
describe('router lifecycle and navigation guard', () => {
  it('replaces an alias once and does not mount again on the following hash event', () => {
    const browser = location('#/stage'), mounted: string[] = [];
    const router = createHashRouter(browser.port, parsed => { mounted.push(parsed.canonicalHash); return true; });
    router.start(); browser.event();
    expect(browser.replacements).toEqual(['#/practice']); expect(mounted).toEqual(['#/practice']);
    router.navigate({ path: '/museum', exhibitId: 'E01' }); browser.event();
    expect(mounted).toEqual(['#/practice', '#/museum/E01']);
  });
  it('rejects an external/back hash before replacing the mounted route', () => {
    const browser = location('#/craft'); let blocked = false; const mounted: string[] = [];
    const router = createHashRouter(browser.port, parsed => { if (blocked) return false; mounted.push(parsed.canonicalHash); return true; });
    router.start(); blocked = true; browser.event('#/result');
    expect(browser.port.read()).toBe('#/craft'); expect(mounted).toEqual(['#/craft']);
    blocked = false; browser.event('#/result'); expect(mounted).toEqual(['#/craft', '#/result']);
  });
  it('has no callbacks or mutations after disposal', () => {
    const browser = location('#/'); let count = 0;
    const router = createHashRouter(browser.port, () => { count++; return true; });
    router.start(); router.dispose(); browser.event('#/craft'); router.start(); router.navigate({ path: '/story', exhibitId: null });
    expect(count).toBe(1); expect(browser.pushes).toEqual([]);
  });
});
