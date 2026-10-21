import { spatialPresentation } from './spatial-presentation';
import { assetCatalog } from '../content/catalog';
import type { PuppetTemplate, RenderActor } from '../content/asset-types';
import { subtitlesForMode } from '../content/story-contract';
import { actionDefinitions, sampleAction } from '../domain/actions';
import { constrainPoseToStage } from '../domain/pose';
import type { storyEntry } from '../domain/story';
import type { ActorId, StoryNode } from '../domain/story-types';
import type { Pose, ProjectV1, StageConfig, StoryNodeId } from '../domain/types';
import { prepareFrame } from '../renderers/canvas/frame';
import type { CanvasFrame } from '../renderers/canvas/types';

export interface SceneInput {
  chenxiangPose?: Pose;
  stage?: Pick<StageConfig, 'lampX' | 'puppetDistance'>;
}
export interface SceneSample {
  frame: CanvasFrame;
  elapsedMs: number;
  durationMs: number;
  ended: boolean;
  automatic: boolean;
  cues: StoryNode['subtitles'];
  lightLevel: number;
  /** A 2D staging cue; this does not assert that a Three.js camera exists. */
  shotLabel: string;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smooth = (value: number) => { const v = clamp(value, 0, 1); return v * v * (3 - 2 * v); };
const between = (time: number, start: number, end: number) => smooth((time - start) / (end - start));
const templateFor = (id: ActorId): PuppetTemplate => assetCatalog.puppets.find(item => item.id === `${id}-v1`)!;

function actionTime(id: 'walk-v1' | 'raise-axe-v1' | 'bow-v1', fraction: number): number {
  return clamp(fraction, 0, 1) * actionDefinitions.find(item => item.id === id)!.durationMs;
}

/**
 * Captures one stable node. Sampling only produces drawing data, never a story command or completion
 * observation. The caller owns pause, clock, mount generation, readiness and guarded progression.
 * Both the frozen cast and the pre-craft draft appearance are copied once; editor stage/pose are not read.
 */
export function createSceneDirector(project: ProjectV1, entry: ReturnType<typeof storyEntry>) {
  const story = project.story;
  if (!story || entry.guard.runId !== story.runId || entry.guard.expectedRevision !== story.revision ||
    entry.guard.expectedNodeId !== story.nodeId || entry.node.id !== story.nodeId) {
    throw new RangeError('导演入口与当前剧情检查点不一致。');
  }
  const node = clone(entry.node), mode = story.mode;
  const appearance = clone(story.castSnapshot?.appearance ?? project.appearance);
  const sharedMotif = story.castSnapshot?.sharedMotif ?? appearance.patternId;
  const durationMs = (mode === 'full' ? node.fullTiming : node.guidedTiming).targetMs;
  const allCues = subtitlesForMode(node, mode);
  // Visual beats are independent of subtitle count; a one-line scene still reveals its action.
  const visualBeats:Partial<Record<StoryNodeId,number[]>>={
    intro:[0,4000,8000,13000], 'memory-separate':[0,2000,4000,6000],
    training:[0,2400,4200,7200,10200], 'call-response':[0,1800,3000,4500],
    'split-response':[0,1800,3000,4500],curtain:[0,6000,9750,12750],
  };
  const automatic = (node.kind === 'cinematic' || node.kind === 'curtain') &&
    node.completion.kind === 'scene' && node.completion.activation === 'automatic';
  if (!Number.isFinite(durationMs) || durationMs < 0) throw new RangeError('片段时长无效。');

  return {
    durationMs,
    sample(elapsedMs: number, input: SceneInput = {}, reducedMotion = false): SceneSample {
      const elapsed = elapsedMs === Infinity ? durationMs : Number.isFinite(elapsedMs)
        ? clamp(elapsedMs, 0, durationMs) : 0;
      // Subtitles use the real mode time, even when motion is sampled as still storyboards.
      const cues = allCues.filter(cue => cue.startMs <= elapsed &&
        (elapsed < cue.endMs || elapsed === durationMs && cue.endMs === durationMs));
      const beats=(visualBeats[node.id]??node.subtitles.map(cue=>cue.startMs)).map(time=>node.fullTiming.targetMs?time/node.fullTiming.targetMs*durationMs:0);
      const stillTime = reducedMotion && elapsed < durationMs
        ? beats.filter(time=>time<=elapsed).reduce((time,beat)=>Math.max(time,beat),0)
        : elapsed;
      const fullTime = durationMs > 0 ? stillTime / durationMs * node.fullTiming.targetMs : 0;
      const progress = durationMs > 0 ? stillTime / durationMs : 0;
      const stage = clone(node.entryStage);
      const layers = clone(node.entrySceneLayers);
      let lightLevel = 1, showRods = false, shotLabel = node.title;
      const poses = clone(node.entryPoses);
      const chenxiang = poses.chenxiang, mother = poses.mother, guardian = poses.guardian;
      const setLayer = (id: string, values: Partial<{ x: number; opacity: number }>) => {
        const layer = layers.find(item => item.id === id);
        if (layer) Object.assign(layer, values);
      };
      const respond = (amount: number) => {
        if (!mother) return;
        mother.joints.rightShoulder += 1.05 * amount;
        mother.joints.rightElbow += .5 * amount;
        mother.joints.head += .1 * amount;
      };

      switch (node.id) {
        case 'intro': {
          const separation = between(fullTime, 4000, 8000);
          lightLevel = reducedMotion ? 1 : .05 + .95 * between(fullTime, 0, 4000);
          if (chenxiang) chenxiang.x -= .035 * separation;
          if (mother) { mother.x += .035 * separation; mother.joints.head -= .14 * separation; }
          // A 2D backstage cut reveals the rods behind the foreground mountain pieces.
          const mountainOpacity=separation*(fullTime>=8000?.12:1);
          setLayer('mountain-left', { opacity: mountainOpacity });
          setLayer('mountain-right', { opacity: mountainOpacity });
          stage.lampX += .08 * between(fullTime, 8000, 13000);
          showRods = fullTime >= 8000 && fullTime < 13000;
          shotLabel = fullTime < 4000 ? '点灯 · 素幕渐亮' : fullTime < 8000 ? '母子分离 · 山片入幕'
            : fullTime < 13000 ? '幕后示意 · 看见操偶杆' : '制偶引入 · 备好行装';
          break;
        }
        case 'memory-words':
          respond(.45*progress);if(chenxiang)chenxiang.joints.head=.1*Math.sin(Math.PI*progress);break;
        case 'road-rest':
          if(chenxiang){chenxiang.joints.head=-.12*Math.sin(Math.PI*progress);chenxiang.joints.rightElbow=.25*progress;}break;
        case 'guardian-parley':
          if(guardian){guardian.joints.head=-.1*progress;guardian.joints.rightShoulder=.3*(1-progress);}break;
        case 'mountain-listen':
          respond(.35*progress);stage.lampX=.12*progress;break;
        case 'memory-separate': {
          const separation = smooth(progress);
          if (chenxiang) chenxiang.x -= .035 * separation;
          if (mother) { mother.x += .035 * separation; mother.joints.head -= .14 * separation; }
          setLayer('mountain-left', { opacity: separation });
          setLayer('mountain-right', { opacity: separation });
          stage.lampX += .08 * separation;
          shotLabel = '山片合拢 · 踏上寻母路';
          break;
        }
        case 'training': {
          if (chenxiang) {
            const template = templateFor('chenxiang');
            const walk = sampleAction('walk-v1', chenxiang, actionTime('walk-v1', progress / .35), template, stage);
            if (!walk.fits) throw new RangeError('学艺行走姿态无法放入幕面。');
            if (progress < .35) poses.chenxiang = walk.pose;
            else {
              const axe = sampleAction('raise-axe-v1', walk.pose,
                actionTime('raise-axe-v1', (progress - .35) / .65), template, stage);
              if (!axe.fits) throw new RangeError('学艺举斧姿态无法放入幕面。');
              poses.chenxiang = axe.pose;
            }
          }
          stage.lampX += .08 * Math.sin(Math.PI * progress);
          shotLabel = progress < .35 ? '学艺蒙太奇 · 上路' : '学艺蒙太奇 · 得斧';
          break;
        }
        case 'call-response':
          respond(between(fullTime, 0, 3000));
          stage.lampX += .1 * Math.sin(Math.PI * progress);
          shotLabel = '山中回应 · 袖口共纹';
          break;
        case 'split-response':
          respond(between(fullTime, 0, 3000));
          stage.lampX += .08 * Math.sin(Math.PI * progress);
          shotLabel = '尘幕后回应 · 我在这里';
          break;
        case 'curtain':
          if (chenxiang) {
            const bow = sampleAction('bow-v1', chenxiang, actionTime('bow-v1', progress), templateFor('chenxiang'), stage);
            if (!bow.fits) throw new RangeError('谢幕姿态无法放入幕面。');
            poses.chenxiang = bow.pose;
          }
          if (mother) mother.joints.head -= .24 * Math.sin(Math.PI * progress);
          showRods = progress >= .4;
          stage.lampX += .08 * between(progress, .4, .8);
          shotLabel = progress < .4 ? '谢幕 · 母子同台' : '幕后示意 · 看见操偶者';
          break;
        case 'memory-wave':
          respond(between(fullTime, 0, 1800) * (.75 + .15 * Math.sin(fullTime / 500)));
          break;
        case 'guardian':
          if (guardian) {
            const amount = between(fullTime, 0, 1200) * (.75 + .1 * Math.sin(fullTime / 1200));
            guardian.joints.rightShoulder += .55 * amount;
            guardian.joints.rightElbow += .3 * amount;
          }
          break;
        case 'call-light': case 'split-search': case 'reunion-reach':
          respond(between(fullTime, 0, 1800));
          break;
      }

      const ending=node.prerequisites.ending;
      if(node.id==='ending-road-hold'||node.id==='ending-road-epilogue'){
        if(poses.chenxiang)poses.chenxiang.x+=.08*progress;
        if(poses.mother)poses.mother.x+=.08*progress;
      }
      if(ending==='waiting'){stage.lampX=.12;respond(.25+.15*progress);}

      // Manual input owns only Chenxiang and the two legal light controls. It never scripts a fixed role.
      if (input.stage) {
        if (!Number.isFinite(input.stage.lampX) || !Number.isFinite(input.stage.puppetDistance)) {
          throw new RangeError('节点灯位输入必须是有限数值。');
        }
        stage.lampX = clamp(input.stage.lampX, -.8, .8);
        stage.puppetDistance = clamp(input.stage.puppetDistance, .05, .4);
      }
      if (input.chenxiangPose && poses.chenxiang) poses.chenxiang = clone(input.chenxiangPose);
      const actors = node.actors.map((id): RenderActor => {
        const pose = poses[id];
        if (!pose) throw new RangeError(`节点缺少 ${id} 的入口姿态。`);
        const attachments = node.entryAttachments.filter(item => item.actorId === id).map(item => item.attachmentId);
        const fit = constrainPoseToStage(pose, templateFor(id), stage, attachments);
        if (!fit.fits) throw new RangeError(`${id} 当前姿态与附件无法放入幕面。`);
        if (id === 'chenxiang') return { actorId: id, templateId: 'chenxiang-v1', appearance: clone(appearance), pose: fit.pose };
        if (id === 'mother') return { actorId: id, templateId: 'mother-v1', paletteId: 'mother-v1', sharedMotif, pose: fit.pose };
        return { actorId: id, templateId: 'guardian-v1', paletteId: 'guardian-v1', pose: fit.pose };
      });
      let actorOpacity:CanvasFrame['actorOpacity'];
      if(ending==='sacrifice'&&node.id!=='ending-sacrifice-axe'){actorOpacity={chenxiang:node.id==='ending-sacrifice-hold'?1-.84*progress:.16,mother:1};lightLevel=.8+.2*progress;}
      const frame = prepareFrame({ actors, stage, sceneLayers: layers,
        attachments: clone(node.entryAttachments), showRods,actorOpacity }, assetCatalog);
      frame.spatial=spatialPresentation(node,progress,lightLevel,reducedMotion);
      return { frame, elapsedMs: elapsed, durationMs, ended: elapsed >= durationMs, automatic,
        cues: clone(cues), lightLevel, shotLabel };
    },
  };
}
