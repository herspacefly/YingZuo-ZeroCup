import { describe, expect, it } from 'vitest';
import { createReunionArtifact } from '../../src/features/result/artifact';
import { createResultPresentation, wrapProgrammeText } from '../../src/features/result/presentation';
import { CHOICE_RUNS, choiceAt } from '../helpers/choice-story';
import fixture from '../fixtures/project-v1.json';
import type { ProjectV1 } from '../../src/domain/types';

describe('read-only result presentation', () => {
  for (const run of CHOICE_RUNS) it(`${run.journeyIntent}/${run.mountainPact}/${run.approach}/${run.finalAction}`, () => {
    const project = choiceAt('completed', run), before = JSON.stringify(project);
    const summary = createReunionArtifact(project).summary, presentation = createResultPresentation(summary);
    expect(presentation.decisions).toHaveLength(4);
    const indices = presentation.decisions.flatMap((item, index) => item.decisive ? [index] : []);
    if (run.finalAction === 'wait') {
      expect(indices).toEqual([3]); expect(presentation.stamp).toBe('相守');
      expect(presentation.explanation).toContain('封印仍未解开');
    } else if (run.mountainPact === 'self') {
      expect(indices).toEqual([1, 3]); expect(presentation.stamp).toBe('化山');
      expect(presentation.explanation).toContain('永久化为山影');
    } else if (run.approach === 'split-first') {
      expect(indices).toEqual([1, 2, 3]); expect(presentation.stamp).toBe('同行');
    } else {
      expect(indices).toEqual([0, 1, 2, 3]); expect(presentation.stamp).toBe(run.journeyIntent === 'home' ? '归家' : '守灯');
    }
    expect(JSON.stringify(project)).toBe(before);
    expect(presentation.summary).toBeTruthy();
  });
  it('does not invent four choices or a cumulative explanation for a legacy run', () => {
    const project = JSON.parse(JSON.stringify(fixture)) as ProjectV1;
    Object.assign(project.story!, { nodeId: 'completed', completedAt: '2026-10-18T00:00:00.000Z' });
    const result = createResultPresentation(createReunionArtifact(project).summary);
    expect(result).toMatchObject({ title: '一幕团圆', stamp: '团圆', decisions: [], explanation: '' });
  });
  it('refuses a mismatched result instead of explaining a fabricated ending', () => {
    const summary = createReunionArtifact(choiceAt('completed', CHOICE_RUNS[1])).summary;
    summary.ending = 'sacrifice';
    expect(() => createResultPresentation(summary)).toThrow('四次选择与终章不一致');
  });
  it.each([2, 3, 4] as const)('v%s retains its authored ending without invented cumulative choices', version => {
    const project = JSON.parse(JSON.stringify(fixture)) as ProjectV1;
    Object.assign(project.story!, { nodeId: 'completed', completedAt: '2026-10-18T00:00:00.000Z' });
    const summary = createReunionArtifact(project).summary;
    summary.definitionVersion = version; summary.ending = 'home';
    expect(createResultPresentation(summary)).toMatchObject({ stamp: '归家', decisions: [], explanation: '' });
  });
  it('wraps by measured glyph width, retains paragraphs and handles empty text', () => {
    const measure = (text: string) => Array.from(text).reduce((n, char) => n + (char === 'W' ? 2 : 1), 0);
    expect(wrapProgrammeText('W母亲W自由', 4, measure)).toEqual(['W母亲', 'W自由']);
    expect(wrapProgrammeText('灯\n山', 4, measure)).toEqual(['灯', '山']);
    expect(wrapProgrammeText('', 4, measure)).toEqual(['']);
  });
});
