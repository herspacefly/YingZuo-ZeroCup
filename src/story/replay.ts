import { definitionFor } from '../content/reunion';
import { subtitlesForMode } from '../content/story-contract';
import { reunionSummary, storyGuard } from '../domain/story';
import type { StoryNode } from '../domain/story-types';
import type { ProjectV1, StoryNodeId } from '../domain/types';
import { validateProject } from '../domain/validation';
import type { CanvasFrame } from '../renderers/canvas/types';
import { createSceneDirector } from './director';
import { createInteractionClip } from './interaction-clip';

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
    if(node && id==='curtain' && story.definitionVersion!==1){const end=definition.endings!.find(e=>e.id===story.ending)!;const pose=definition.nodes.find(n=>n.id===end.epilogueNodeId)!;node={...node,entryPoses:copy(pose.entryPoses),entryStage:copy(pose.entryStage),entrySceneLayers:copy(pose.entrySceneLayers),entryAttachments:copy(pose.entryAttachments),assetIds:[...new Set([...node.assetIds,...pose.assetIds])],prerequisites:{...node.prerequisites,ending:story.ending}};}
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
    return { node, director, clip: createInteractionClip(node, director), allCues: story.definitionVersion>=3?node.subtitles:subtitlesForMode(node, story.mode) };
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
      const sampled = scene.clip.sample(progress, elapsed, reducedMotion);
      const label = node.id === 'craft' ? '制偶回看 · 本场冻结造型' : node.id === 'approach-choice'
        ? summary.approach === 'call-first' ? '本场路线 · 先呼唤母亲' : '本场路线 · 先劈开山石' : sampled.shotLabel;
      return { frame: sampled.frame, cues: copy(sampled.cues), allCues: copy(scene.allCues), lightLevel: sampled.lightLevel,
        shotLabel: label, ended: elapsed >= director.durationMs };
    },
  };
}
