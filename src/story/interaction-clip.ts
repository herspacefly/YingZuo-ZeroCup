import { assetCatalog } from '../content/catalog';
import { actionDefinitions, sampleAction } from '../domain/actions';
import type { ActionId } from '../domain/actions';
import type { StoryNode } from '../domain/story-types';
import type { Pose, StageConfig } from '../domain/types';
import type { CanvasFrame } from '../renderers/canvas/types';
import type { SceneSample, createSceneDirector } from './director';
import { interactionGoal } from './node-interaction';
import { holdingFrame, stagePlayFrame } from './play-staging';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const between = (n: number, a: number, b: number) => smooth((n - a) / (b - a));
function blend(from: Pose, to: Pose, amount: number): Pose {
  const pose = copy(from), t = clamp(amount);
  pose.x += (to.x - pose.x) * t; pose.y += (to.y - pose.y) * t;
  pose.scale += (to.scale - pose.scale) * t;
  for (const id of Object.keys(pose.joints) as (keyof Pose['joints'])[]) pose.joints[id] += (to.joints[id] - pose.joints[id]) * t;
  return pose;
}
function action(id: ActionId, node: StoryNode, progress: number): Pose {
  const template = assetCatalog.puppets.find(item => item.id === 'chenxiang-v1')!;
  const duration = actionDefinitions.find(item => item.id === id)!.durationMs;
  const result = sampleAction(id, node.entryPoses.chenxiang!, clamp(progress) * duration, template, node.entryStage);
  if (!result.fits) throw new RangeError('编排动作与附件无法完整放入幕面。');
  return result.pose;
}

/** Pure absolute-time choreography, shared by live showcases and read-only result replays.
 * It captures canonical entry data only: no manual pose, command, timer or storage is accepted. */
export function createInteractionClip(node: StoryNode, director: ReturnType<typeof createSceneDirector>) {
  const captured = copy(node), first = director.sample(0).frame;
  const goal = captured.kind === 'interaction' && captured.completion.kind !== 'craft' ? interactionGoal(captured, first) : null;
  const holding = captured.id === 'reunion-reach' ? holdingFrame(first) : null;
  if (captured.kind === 'interaction' && captured.completion.kind !== 'craft' && !goal) throw new RangeError('当前片段缺少可绘制的编排目标。');
  const durationMs = captured.completion.kind === 'axe' ? 7600 : captured.completion.kind === 'wave' ? 5600 : 6600;
  function sample(progress: number, elapsedMs: number, reducedMotion: boolean): SceneSample {
    const p = clamp(Number.isFinite(progress) ? progress : progress === Infinity ? 1 : 0);
    const beat = reducedMotion && p < 1 ? Math.floor(p * 4) / 4 : p;
    let pose: Pose | undefined, stage: Pick<StageConfig, 'lampX' | 'puppetDistance'> | undefined, label: string | undefined;
    const effects = { opening: 0, reveal: 0, reaction: 0, guardianExit: 0 };
    switch (captured.id) {
      case 'memory-wave': pose = action('wave-v1', captured, beat); effects.reaction = between(beat, .35, .7); label = '招手与回应'; break;
      case 'road': pose = action('walk-v1', captured, beat); label = '一步一步走向远山'; break;
      case 'guardian':
        pose = blend(captured.entryPoses.chenxiang!, goal!.pose, between(beat, .05, .5)); effects.guardianExit = between(beat, .65, 1); label = '稳住身形，山门让路'; break;
      case 'call-light': case 'split-search': {
        const t = between(beat, .05, .65);
        pose = blend(captured.entryPoses.chenxiang!, goal!.pose, t);
        stage = { lampX: captured.entryStage.lampX + .18 * Math.sin(Math.PI * beat), puppetDistance: captured.entryStage.puppetDistance + (goal!.stage.puppetDistance - captured.entryStage.puppetDistance) * t };
        effects.reveal = between(beat, .45, .9); label = '循着灯光，看见母亲'; break;
      }
      case 'call-split': case 'split-axe': case 'ending-sacrifice-axe':
        pose = action('raise-axe-v1', captured, beat / .8); effects.opening = between(beat, .5, .9); label = beat < .5 ? '稳身举斧' : '落手开山，山片分开'; break;
      case 'ending-light-place': case 'ending-waiting-light':
        pose = blend(captured.entryPoses.chenxiang!, goal!.pose, between(beat, .1, .8)); stage = goal!.stage; label = '把灯留在彼此看得见的地方'; break;
      case 'ending-road-walk': pose = blend(captured.entryPoses.chenxiang!, goal!.pose, between(beat, .1, .85)); label = '母子同行，走向天明'; break;
      case 'reunion-reach': pose = action('reach-v1', captured, beat / .6); label = '最后伸手，母子相见'; break;
    }
    if(captured.id==='ending-sacrifice-axe'&&pose)pose.x-=.18;
    const result = director.sample(elapsedMs, { chenxiangPose: pose, stage }, reducedMotion);
    if(captured.id==='ending-road-walk'){
      const chen=result.frame.actors.find(actor=>actor.actorId==='chenxiang'),mother=result.frame.actors.find(actor=>actor.actorId==='mother');
      if(chen&&mother){mother.pose.x=chen.pose.x-.28;mother.pose.scale=.72;mother.pose.y=chen.pose.y;mother.pose.joints.leftHip=.14*Math.sin(beat*Math.PI*4);mother.pose.joints.rightHip=-mother.pose.joints.leftHip;}
    }
    if (holding) result.frame.actors = result.frame.actors.map(actor => ({ ...actor, pose: blend(actor.pose, holding.actors.find(item => item.actorId === actor.actorId)!.pose, between(beat, .2, 1)) }));
    result.frame = stagePlayFrame(captured, result.frame, effects);
    if (label) result.shotLabel = label;
    return result;
  }
  return {
    durationMs,
    /** Authored replay preserves original scene duration and captions. */
    sample,
    /** 600ms curtain/reset followed by a 5–7s excerpt. This never repeats the full dialogue. */
    showcase(elapsedMs: number, reducedMotion = false): SceneSample {
      const elapsed = elapsedMs === Infinity ? durationMs : Number.isFinite(elapsedMs) ? Math.max(0, Math.min(durationMs, elapsedMs)) : 0;
      const p = clamp((elapsed - 600) / (durationMs - 600));
      const result = sample(p, p * director.durationMs, reducedMotion);
      result.elapsedMs = elapsed; result.durationMs = durationMs; result.ended = elapsed >= durationMs; result.automatic = false; result.cues = []; result.frame.showRods = false;
      result.lightLevel = reducedMotion ? 1 : elapsed < 300 ? 1 - elapsed / 300 : elapsed < 600 ? (elapsed - 300) / 300 : 1;
      if(result.frame.spatial) result.frame.spatial={...result.frame.spatial,light:result.lightLevel};
      result.shotLabel = elapsed < 600 ? '收杆定场 · 回到编排站位' : `这一段，演成了 · ${result.shotLabel}`;
      return result;
    },
    endFrame(): CanvasFrame { const frame=copy(sample(1, director.durationMs, false).frame);frame.showRods=false;return frame; },
  };
}
