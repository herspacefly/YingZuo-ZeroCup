export type GuideSkill = 'craft' | 'light' | 'practice' | 'transport' | 'puppetry';
export type GuideExitReason = 'complete' | 'skip' | 'escape' | 'interrupted' | 'error';

/** Presentation memory for one document, independent of projects and browser storage. */
export function createGuideVisit() {
  const experienced = new Set<GuideSkill>();
  return {
    has(skill: GuideSkill) { return experienced.has(skill); },
    finish(skill: GuideSkill, reason: GuideExitReason) {
      if (reason === 'complete' || reason === 'skip' || reason === 'escape') experienced.add(skill);
    },
  };
}

// A new document evaluates this module again; route changes retain the same memory.
export const guideVisit = createGuideVisit();
