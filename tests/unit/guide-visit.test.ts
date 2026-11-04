import { describe, expect, it } from 'vitest';
import { createGuideVisit } from '../../src/features/shared/guide-visit';
import type { GuideExitReason, GuideSkill } from '../../src/features/shared/guide-visit';

describe('document guide experience', () => {
  it.each(['complete', 'skip', 'escape'] as GuideExitReason[])('remembers deliberate %s for only that skill', reason => {
    const visit = createGuideVisit();
    visit.finish('transport', reason);
    expect(visit.has('transport')).toBe(true);
    expect(visit.has('puppetry')).toBe(false);
  });

  it.each(['interrupted', 'error'] as GuideExitReason[])('does not remember %s', reason => {
    const visit = createGuideVisit();
    for (const skill of ['craft', 'light', 'practice', 'transport', 'puppetry'] as GuideSkill[]) {
      visit.finish(skill, reason);
      expect(visit.has(skill)).toBe(false);
    }
  });

  it('a new document memory starts fresh without modifying an existing visit', () => {
    const visit = createGuideVisit();
    visit.finish('craft', 'complete');
    expect(createGuideVisit().has('craft')).toBe(false);
    expect(visit.has('craft')).toBe(true);
  });
});
