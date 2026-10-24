import { assetCatalog } from '../../content/catalog';
import { definitionFor } from '../../content/reunion';
import { reunionSummary } from '../../domain/story';
import type { ProjectV1 } from '../../domain/types';
import { prepareFrame } from '../../renderers/canvas/frame';
import type { CanvasFrame } from '../../renderers/canvas/types';
import { stagePlayFrame } from '../../story/play-staging';

export interface ReunionArtifact {
  summary: NonNullable<ReturnType<typeof reunionSummary>>;
  frame: CanvasFrame;
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A deterministic still of the completed run, never the current editor draft or a recorded gesture. */
export function createReunionArtifact(project: ProjectV1): ReunionArtifact {
  // reunionSummary validates and copies the project before accepting a genuine curtain/completed node.
  const summary = reunionSummary(project);
  if (!summary) throw new Error(project.story?.definitionVersion!==1?'这一场尚未到终章，完成本场演出后才能留影。':'这一场尚未团圆，完成最后伸手并谢幕后才能留影。');
  const definition=definitionFor(project.story);
  const hold=summary.definitionVersion!==1?definition.endings!.find(e=>e.id===summary.ending)!.epilogueNodeId:'reunion-hold';
  const node = definition.nodes.find(item => item.id === hold)!;
  const cast = summary.castSnapshot;
  const costumeTreatment=summary.definitionVersion===4?'original-texture' as const:'legacy-motif' as const;
  const frame = stagePlayFrame(node, prepareFrame({
    actors: [
      { costumeTreatment,actorId: 'chenxiang', templateId: 'chenxiang-v1', appearance: copy(cast.appearance), pose: copy(node.entryPoses.chenxiang!) },
      { costumeTreatment,actorId: 'mother', templateId: 'mother-v1', paletteId: 'mother-v1', sharedMotif: cast.sharedMotif, pose: copy(node.entryPoses.mother!) },
    ],
    stage: copy(node.entryStage),
    sceneLayers: copy(node.entrySceneLayers),
    attachments: copy(node.entryAttachments),
    showRods: false,
  }, assetCatalog), { opening: 1, reveal: 1, reaction: 1, guardianExit: 1 });
  // The returned frame and summary are independent even of one another's mutable appearance arrays.
  if(summary.ending==='sacrifice')frame.actorOpacity={chenxiang:.16,mother:1};
  if(summary.ending==='waiting')frame.actorOpacity={chenxiang:1,mother:.6};
  return { summary: copy(summary), frame };
}
