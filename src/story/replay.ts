import { assetCatalog } from '../content/catalog';
import { definitionFor } from '../content/reunion';
import { subtitlesForMode } from '../content/story-contract';
import { actionDefinitions, sampleAction } from '../domain/actions';
import type { ActionId } from '../domain/actions';
import { reunionSummary, storyGuard } from '../domain/story';
import type { StoryNode } from '../domain/story-types';
import type { Pose, ProjectV1, StoryNodeId } from '../domain/types';
import { validateProject } from '../domain/validation';
import type { CanvasFrame } from '../renderers/canvas/types';
import { createSceneDirector } from './director';
import type { SceneSample } from './director';
import { interactionGoal } from './node-interaction';
import { holdingFrame, stagePlayFrame } from './play-staging';

export interface ReunionReplaySegment {
  id: StoryNodeId;
  title: string;
  durationMs: number;
}
export interface ReunionReplaySample {
  frame: CanvasFrame;
  cues: StoryNode['subtitles'];
  allCues: StoryNode['subtitles'];
  lightLevel: number;
  shotLabel: string;
  ended: boolean;
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const between = (value: number, from: number, to: number) => smooth((value - from) / (to - from));
function blendPose(from: Pose, to: Pose, amount: number): Pose {
  const pose = copy(from), t = clamp(amount);
  pose.x += (to.x - pose.x) * t;
  pose.y += (to.y - pose.y) * t;
  pose.scale += (to.scale - pose.scale) * t;
  for (const joint of Object.keys(pose.joints) as (keyof Pose['joints'])[]) {
    pose.joints[joint] += (to.joints[joint] - pose.joints[joint]) * t;
  }
  return pose;
}
function actionPose(id: ActionId, node: StoryNode, progress: number): Pose {
  const template = assetCatalog.puppets.find(item => item.id === 'chenxiang-v1')!;
  const duration = actionDefinitions.find(item => item.id === id)!.durationMs;
  const action = sampleAction(id, node.entryPoses.chenxiang!, clamp(progress) * duration, template, node.entryStage);
  if (!action.fits) throw new RangeError('重演动作与附件无法完整放入幕面。');
  return action.pose;
}

/**
 * A read-only, absolute-time arrangement of an already reunited run, not a recording of its inputs.
 * The original validated project/cast/mode/path are captured once. No clocks, commands or saves exist
 * here; even intro/craft use the frozen cast. Segment zero duration means an immediately ended still.
 * Invalid segment indices throw. Negative/NaN/-Infinity time means zero; +Infinity/late time holds end.
 */
export function createReunionReplay(project: ProjectV1) {
  const captured = validateProject(project), summary = reunionSummary(captured);
  if (!summary) throw new RangeError('请先完成本场团圆，再按本场编排重演。');
  const definition = copy(definitionFor(captured.story)), story = captured.story!;
  const nodes: StoryNode[] = [], seen = new Set<StoryNodeId>();
  let id: StoryNodeId = definition.startNodeId;
  while (id !== 'completed') {
    if (seen.has(id)) throw new RangeError('重演剧本的节点路径发生循环。');
    seen.add(id);
    let node = definition.nodes.find(item => item.id === id);
    if(node && id==='curtain' && story.definitionVersion===2){const end=definition.endings!.find(e=>e.id===story.ending)!;const pose=definition.nodes.find(n=>n.id===end.epilogueNodeId)!;node={...node,entryPoses:copy(pose.entryPoses),entryStage:copy(pose.entryStage),entrySceneLayers:copy(pose.entrySceneLayers),entryAttachments:copy(pose.entryAttachments),assetIds:[...new Set([...node.assetIds,...pose.assetIds])],prerequisites:{...node.prerequisites,ending:story.ending}};}
    if (!node) throw new RangeError('重演剧本缺少当前片段。');
    nodes.push(node);
    if (id === 'curtain') break;
    if (!node.next) throw new RangeError('重演剧本尚未到达谢幕。');
    id = 'default' in node.next ? node.next.default : (node.next as Record<string,StoryNodeId>)[node.id==='ending-choice'?summary.ending!:summary.approach]!;
  }
  if (nodes[nodes.length - 1]?.id !== 'curtain') throw new RangeError('重演剧本缺少本场谢幕。');

  const scenes = nodes.map(node => {
    // These drawing inputs are deliberately not story checkpoints or reducer candidates. Calling
    // storyEntry on a historical node of a completed run would incorrectly validate completedAt.
    const transient = copy(captured);
    transient.story!.nodeId = node.id;
    transient.story!.completedAt = node.id === 'curtain' ? summary.completedAt : null;
    const entry = { token: `replay:${summary.runId}:${node.id}`, guard: storyGuard(transient.story!),
      paused: true as const, elapsedMs: 0, node: copy(node) };
    const director = createSceneDirector(transient, entry);
    const first = director.sample(0).frame;
    const goal = node.kind === 'interaction' && node.completion.kind !== 'craft' ? interactionGoal(node, first) : null;
    if (['guardian', 'call-light', 'split-search'].includes(node.id) && !goal) {
      throw new RangeError('当前片段缺少可绘制的编排目标。');
    }
    const holding = node.id === 'reunion-reach' ? holdingFrame(first) : null;
    return { node, director, goal, holding, allCues: subtitlesForMode(node, story.mode) };
  });
  const metadata = scenes.map(({ node, director }): ReunionReplaySegment => ({
    id: node.id, title: node.title, durationMs: director.durationMs,
  }));

  return {
    segments: copy(metadata),
    durationMs: metadata.reduce((total, item) => total + item.durationMs, 0),
    sample(segmentIndex: number, elapsedMs: number, reducedMotion = false): ReunionReplaySample {
      if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= scenes.length) {
        throw new RangeError('请选择有效的重演片段。');
      }
      const scene = scenes[segmentIndex]!, { node, director } = scene;
      const elapsed = elapsedMs === Infinity ? director.durationMs : Number.isFinite(elapsedMs)
        ? Math.max(0, Math.min(director.durationMs, elapsedMs)) : 0;
      const progress = director.durationMs > 0 ? elapsed / director.durationMs : 1;
      // Reduced motion uses five explicit stills for programmed operations; captions keep real time.
      const beat = reducedMotion && progress < 1 ? Math.floor(progress * 4) / 4 : progress;
      let chenxiangPose: Pose | undefined;
      let stage: { lampX: number; puppetDistance: number } | undefined;
      let shotLabel: string | undefined;
      const effects = { opening: 0, reveal: 0, reaction: 0, guardianExit: 0 };
      switch (node.id) {
        case 'craft':
          shotLabel = '制偶回看 · 本场冻结造型';
          break;
        case 'memory-wave':
          chenxiangPose = actionPose('wave-v1', node, beat);
          effects.reaction = between(beat, .35, .7);
          shotLabel = '灯下记得 · 招手与回应';
          break;
        case 'road':
          chenxiangPose = actionPose('walk-v1', node, beat);
          shotLabel = '上路 · 一步一步走向远山';
          break;
        case 'guardian':
          chenxiangPose = blendPose(node.entryPoses.chenxiang!, scene.goal!.pose, between(beat, .05, .5));
          effects.guardianExit = between(beat, .65, 1);
          shotLabel = '山门架挡 · 稳住再向前';
          break;
        case 'approach-choice':
          shotLabel = summary.approach === 'call-first' ? '本场路线 · 先呼唤母亲' : '本场路线 · 先劈开山石';
          break;
        case 'call-light': case 'split-search': {
          const amount = between(beat, .05, .65), target = scene.goal!;
          chenxiangPose = blendPose(node.entryPoses.chenxiang!, target.pose, amount);
          stage = { lampX: node.entryStage.lampX + .18 * Math.sin(Math.PI * beat),
            puppetDistance: node.entryStage.puppetDistance + (target.stage.puppetDistance - node.entryStage.puppetDistance) * amount };
          effects.reveal = between(beat, .45, .9);
          shotLabel = node.id === 'call-light' ? '灯影寻母 · 共纹渐显' : '尘幕后寻光 · 母亲渐显';
          break;
        }
        case 'call-split': case 'split-axe': case 'ending-sacrifice-axe':
          chenxiangPose = actionPose('raise-axe-v1', node, beat / .8);
          effects.opening = between(beat, .5, .9);
          shotLabel = beat < .5 ? '稳身举斧' : '落手开山 · 山片分开';
          break;
        case 'ending-light-place': case 'ending-waiting-light': {const goal=scene.goal!;chenxiangPose=blendPose(node.entryPoses.chenxiang!,goal.pose,between(beat,.1,.8));stage=goal.stage;break;}
        case 'ending-road-walk': {const goal=scene.goal!;chenxiangPose=blendPose(node.entryPoses.chenxiang!,goal.pose,between(beat,.1,.85));break;}
        case 'reunion-reach':
          chenxiangPose = actionPose('reach-v1', node, beat / .6);
          shotLabel = '最后伸手 · 母子相见';
          break;
      }
      const sampled: SceneSample = director.sample(elapsed, { chenxiangPose, stage }, reducedMotion);
      if (scene.holding) {
        sampled.frame.actors = sampled.frame.actors.map(actor => {
          const target = scene.holding!.actors.find(item => item.actorId === actor.actorId)!;
          return { ...actor, pose: blendPose(actor.pose, target.pose, between(beat, .2, 1)) };
        });
      }
      return { frame: stagePlayFrame(node, sampled.frame, effects), cues: copy(sampled.cues),
        allCues: copy(scene.allCues), lightLevel: sampled.lightLevel,
        shotLabel: shotLabel ?? sampled.shotLabel, ended: elapsed >= director.durationMs };
    },
  };
}
