import { describe, expect, it } from 'vitest';
import { createProject, defaultAppearance } from '../../src/domain/defaults';
import { museumPreviewFrame } from '../../src/features/museum/demo-geometry';
import { assetCatalog } from '../../src/content/catalog';
import { prepareFrame } from '../../src/renderers/canvas/frame';
import type { StoryProgress } from '../../src/domain/types';

const project = () => createProject('museum-demo-project', 'museum-demo-writer', '2026-10-17T00:00:00.000Z');

describe('museum display boundary', () => {
  it('shows a complete default example without a project and ignores an unfrozen edit draft', () => {
    const draft = project(); draft.appearance.patternId = 'flower-v1'; draft.appearance.carvedSegments = [true, true, true];
    draft.stage.lampX = -.8; draft.stage.puppetDistance = .4; draft.pose.x = .1; draft.pose.joints.rightShoulder = 1.8;
    const empty = museumPreviewFrame(null), actual = museumPreviewFrame(draft);
    expect(actual).toEqual(empty); expect(prepareFrame(actual, assetCatalog).actors).toHaveLength(1);
    expect(actual.actors[0]).toMatchObject({ actorId: 'chenxiang', appearance: defaultAppearance() });
  });
  it('uses only frozen appearance while retaining neutral geometry, with independent mutable copies', () => {
    const frozen = project(), appearance = { ...defaultAppearance(), patternId: 'wave-v1' as const, carvedSegments: [true, false, true] as [boolean, boolean, boolean] };
    frozen.story = { castSnapshot: { appearance } } as StoryProgress;
    const first = museumPreviewFrame(frozen), second = museumPreviewFrame(frozen);
    expect(first.actors[0]).toMatchObject({ appearance }); expect(first.stage).toEqual({ backgroundId: 'plain-v1', lampX: 0, puppetDistance: .2 });
    const actor = first.actors[0]!; if (actor.actorId !== 'chenxiang') throw new Error('Expected Chenxiang');
    actor.appearance.colorSlots.body = 4; actor.appearance.carvedSegments[0] = false; actor.pose.joints.rightShoulder = 1.2;
    expect(frozen.story.castSnapshot!.appearance.colorSlots.body).toBe(0);
    expect(frozen.story.castSnapshot!.appearance.carvedSegments).toEqual([true, false, true]);
    expect(second.actors[0]).toMatchObject({ appearance, pose: { joints: { rightShoulder: 0 } } });
    expect(prepareFrame(second, assetCatalog).actors[0]).toMatchObject({ appearance });
  });
});
