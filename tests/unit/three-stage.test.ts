import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import { defaultAppearance, defaultPose } from '../../src/domain/defaults';
import { partTransform, transformPoint } from '../../src/domain/pose';
import { localToWorld, projectLocalPoint, projectPoint } from '../../src/domain/projection';
import type { CanvasFrame } from '../../src/renderers/canvas/types';
import { boundedTextureSize, spatialPartPoint, spatialResourceScope, stageCamera } from '../../src/renderers/three/geometry';
import type { StageView } from '../../src/renderers/three/geometry';

const frame = (): CanvasFrame => ({ actors: [{ actorId: 'chenxiang', templateId: 'chenxiang-v1', appearance: defaultAppearance(), pose: defaultPose() }],
  stage: { backgroundId: 'plain-v1', lampX: .4, puppetDistance: .2 }, attachments: [] });

describe('spatial observation boundaries', () => {
  it('keeps the audience on positive z with an unmirrored x axis and the lamp behind the puppet', () => {
    const front = stageCamera('front'), backstage = stageCamera('backstage');
    expect(front.position[0]).toBe(front.target[0]); expect(front.position[2]).toBeGreaterThan(front.target[2]);
    expect(backstage.position[2]).toBeLessThan(-1.2);
    for (const view of ['workshop', 'front', 'backstage', 'exhibit'] as StageView[]) {
      const preset = stageCamera(view); expect([...preset.position, ...preset.target, preset.height].every(Number.isFinite)).toBe(true);
      expect(preset.height).toBeGreaterThan(1.5);
    }
    const next = stageCamera('front'); next.position[0] = 10; expect(stageCamera('front').position[0]).toBe(0);
  });
  it('uses exactly the same part bind, articulated pose, facing and world transform as the Canvas shadow', () => {
    const input = frame(), actor = input.actors[0]!; actor.pose.facing = -1; actor.pose.scale = .73; actor.pose.x = .63; actor.pose.y = .42; actor.pose.joints.rightShoulder = .8;
    const original = JSON.stringify(input), template = assetCatalog.puppets[0]!, part = template.parts.find(item => item.parentJoint === 'rightShoulder')!;
    const point = { x: part.bounds.maxX, y: part.bounds.minY }, local = transformPoint(point, partTransform(template, actor.pose, part));
    const result = spatialPartPoint(actor, template, part, point, input.stage.puppetDistance);
    expect(result).toEqual({ ...localToWorld(local, actor.pose), z: -.2 });
    expect(projectPoint(result, input.stage)).toEqual(projectLocalPoint(local, actor.pose, input.stage));
    expect(JSON.stringify(input)).toBe(original);
  });
  it('does not restart asynchronous resources for pose, lamp, distance, fades or draw options', () => {
    const first = frame(), next = frame(), initial = spatialResourceScope(first);
    next.actors[0]!.pose.joints.leftElbow = .6; next.stage.lampX = -.7; next.stage.puppetDistance = .4; next.showRods = true; next.actorOpacity = { chenxiang: .3 };
    expect(spatialResourceScope(next)).toBe(initial);
    const actor = next.actors[0]!; if (actor.actorId !== 'chenxiang') throw new Error('Expected Chenxiang');
    actor.appearance.carvedSegments[0] = true; expect(spatialResourceScope(next)).not.toBe(initial);
    next.actors = []; expect(spatialResourceScope(next)).not.toBe(initial);
    const different = frame(); different.stage.backgroundId = 'home-v1'; expect(spatialResourceScope(different)).not.toBe(initial);
  });
  it('caps both dimensions without enlarging a source, retaining its aspect for constrained GPUs', () => {
    expect(boundedTextureSize(2048, 1536, 512)).toEqual({ width: 512, height: 384 });
    expect(boundedTextureSize(256, 512, 512)).toEqual({ width: 256, height: 512 });
    expect(boundedTextureSize(4096, 2048, 9999)).toEqual({ width: 1024, height: 512 });
    expect(boundedTextureSize(0, Number.NaN, Number.NaN)).toEqual({ width: 1, height: 1 });
  });
});
