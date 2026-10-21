import { validateProject } from './validation';
import { defaultAppearance } from './defaults';
import type { ProjectV1, StoryProgress } from './types';
import type { Completion, InteractionEvidence, StoryCommand, StoryContext, StoryDefinition, StoryGuard, StoryNode } from './story-types';
import { ENDING_IDS } from './story-path';

export class StoryCommandError extends Error {
  constructor(message: string) { super(message);this.name='StoryCommandError'; }
}
const requireFact = (ok: unknown,message: string): void => {if(!ok)throw new StoryCommandError(message);};
const finiteRange=(v: number,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number' && Number.isFinite(v) && v>=min && v<=max;
export function storyGuard(story: StoryProgress): StoryGuard {
  return {runId:story.runId,expectedRevision:story.revision,expectedNodeId:story.nodeId};
}
export function beginStory(project: ProjectV1,runId: string,mode: StoryProgress['mode'],definitionVersion:1|2=1): ProjectV1 | null {
  const next=validateProject(project);if(next.story)return null;
  next.story={storyId:'reunion',definitionVersion,runId,revision:0,mode,nodeId:'intro',approach:null,approachSource:null,castSnapshot:null,assistedNodeIds:[],presetAppearanceUsed:false,completedAt:null,
    ...(definitionVersion===2?{ending:null,endingSource:null}:{})};
  next.lastRoute='/story';return validateProject(next);
}
export function currentStoryNode(definition: StoryDefinition,story: StoryProgress): StoryNode {
  requireFact(definition.storyId===story.storyId && definition.definitionVersion===story.definitionVersion,'剧本版本不匹配，未替换当前检查点。');
  const node=definition.nodes.find(n=>n.id===story.nodeId);requireFact(node,'剧本缺少当前节点。');
  if(story.definitionVersion===2&&story.ending&&['curtain','completed'].includes(story.nodeId)){
    const ending=definition.endings?.find(item=>item.id===story.ending),presentation=definition.nodes.find(n=>n.id===ending?.epilogueNodeId);
    requireFact(presentation,'剧本缺少本场终章构图。');
    return {...node!,prerequisites:{...node!.prerequisites,ending:story.ending},actors:presentation!.actors,entryPoses:presentation!.entryPoses,entryStage:presentation!.entryStage,
      entrySceneLayers:presentation!.entrySceneLayers,entryAttachments:presentation!.entryAttachments,
      assetIds:[...new Set([...node!.assetIds,...presentation!.assetIds])]};
  }
  return node!;
}
function evidencePasses(completion: Completion,evidence: InteractionEvidence): boolean {
  if(completion.kind!==evidence.kind)return false;
  switch(evidence.kind) {
    case 'craft':return typeof evidence.presetAppearanceUsed==='boolean';
    case 'wave':case 'road':case 'block':case 'light':
      return 'overlapRatio' in completion && finiteRange(evidence.overlapRatio,0,1) && evidence.overlapRatio>=completion.overlapRatio && finiteRange(evidence.heldMs) && evidence.heldMs>=completion.holdMs;
    case 'axe':return completion.kind==='axe' && evidence.stableBody===true && evidence.lowered===true && finiteRange(evidence.raisedAngleRad,...completion.raisedAngleRange) && finiteRange(evidence.landedAngleRad,...completion.landedAngleRange) && finiteRange(evidence.raisedHoldMs) && evidence.raisedHoldMs>=completion.holdMs;
    case 'reach':return completion.kind==='reach' && finiteRange(evidence.handDistanceRatio,0,completion.maxDistanceRatio);
  }
}
/** Pure reducer. No clocks, identities, storage, DOM or animation side effects. */
export function reduceStory(project: ProjectV1,command: StoryCommand,context: StoryContext,definition: StoryDefinition): ProjectV1 | null {
  const next=validateProject(project),story=next.story;
  if(!story || story.runId!==command.runId || story.revision!==command.expectedRevision || story.nodeId!==command.expectedNodeId)return null;
  const node=currentStoryNode(definition,story);
  requireFact(definition.assetVersion===next.assetVersion,'资源版本不匹配。');
  requireFact(story.revision<Number.MAX_SAFE_INTEGER,'剧情版本已达上限，未覆盖存档。');
  requireFact(node.allowedActions.includes(command.action),'当前节点不接受这个动作。');
  requireFact(typeof context.paused==='boolean' && finiteRange(context.elapsedMs),'当前节点时钟无效。');
  requireFact(!node.prerequisites.frozenCast || !!story.castSnapshot,'当前节点缺少冻结角色。');
  requireFact(node.prerequisites.approach===null || node.prerequisites.approach===story.approach,'当前节点与已选路径不符。');
  requireFact(!node.prerequisites.ending||node.prerequisites.ending===story.ending,'当前节点与已选终章不符。');
  if(command.action==='SET_MODE') {
    requireFact(context.paused,'请先暂停，再切换演出节奏。');
    requireFact(command.mode==='full' || command.mode==='guided','未知演出模式。');
    if(command.mode===story.mode)return null;
    story.mode=command.mode;story.revision++;return validateProject(next);
  }
  let destination: string | undefined;
  if(command.action==='CHOOSE') {
    requireFact(node.id==='approach-choice' && node.kind==='choice' && node.completion.kind==='choice' && node.next && !('default' in node.next),'当前没有可选路线。');
    requireFact(command.approach==='call-first' || command.approach==='split-first','请明确选择路线。');
    requireFact(story.approach===null && story.approachSource===null,'路线已确认，未重新选择。');
    story.approach=command.approach;story.approachSource='user';
    destination=(node.next as {'call-first':string;'split-first':string})[command.approach];
  } else if(command.action==='CHOOSE_ENDING'){
    requireFact(story.definitionVersion===2&&node.id==='ending-choice'&&node.kind==='choice'&&node.completion.kind==='choice'&&node.next&&!('default' in node.next),'当前没有可选终章。');
    requireFact(ENDING_IDS.includes(command.ending),'请明确选择终章。');
    requireFact(story.ending===null&&story.endingSource===null,'终章已确认，未重新选择。');
    story.ending=command.ending;story.endingSource='user';
    destination=(node.next as Record<typeof command.ending,string>)[command.ending];
  } else {
    requireFact(node.next && 'default' in node.next,'当前节点没有顺序出口。');
    if(command.action==='COMPLETE_INTERACTION') {
      requireFact(node.kind==='interaction','当前不是操作节点。');
      if(command.source==='assistance') {
        requireFact(node.completion.kind!=='craft','制作确认不能冒充协助操作。');
        requireFact(!context.paused,'请继续当前节点后再代演。');
        story.assistedNodeIds.push(story.nodeId);
      } else {
        requireFact(command.source==='user' && evidencePasses(node.completion,command.evidence),'操作尚未满足本节点条件。');
        requireFact(!context.paused || node.completion.kind==='craft','暂停期间不能完成操作。');
        if(command.evidence.kind==='craft') {
          requireFact(node.id==='craft' && story.castSnapshot===null,'当前不能重新冻结角色。');
          const appearance=command.evidence.presetAppearanceUsed?defaultAppearance():next.appearance;
          story.castSnapshot={appearance:JSON.parse(JSON.stringify(appearance)),sharedMotif:appearance.patternId,motherPaletteId:'mother-v1',guardianPaletteId:'guardian-v1',assetVersion:1};
          story.presetAppearanceUsed=command.evidence.presetAppearanceUsed;
        }
      }
    } else {
      requireFact(command.action==='COMPLETE_SCENE' && node.completion.kind==='scene','当前不是过场完成命令。');
      if(node.completion.kind!=='scene')throw new StoryCommandError('缺少场景完成配置。');
      if(command.skipped===true)requireFact(node.id==='intro' && node.completion.skippable && command.source==='user','仅序幕可由用户明确跳过。');
      else {
        requireFact(!context.paused,'暂停期间不能完成片段。');
        const timing=story.mode==='full'?node.fullTiming:node.guidedTiming;
        requireFact(context.elapsedMs>=timing.minDurationMs,'请让当前短片段播放完成。');
        requireFact(node.completion.activation==='user' ? command.source==='user' : command.source==='script' || (node.id==='curtain' && command.source==='assistance'),'当前片段需要对应的完成来源。');
        if(command.source==='assistance')story.assistedNodeIds.push(story.nodeId);
      }
    }
    destination=(node.next as {default:string}).default;
  }
  requireFact(definition.nodes.some(n=>n.id===destination),'下一节点不在当前剧本中。');
  story.nodeId=destination as StoryProgress['nodeId'];story.revision++;
  if(destination==='curtain') {
    requireFact(story.completedAt===null,'团圆完成时间已经存在。');
    requireFact(typeof context.now==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(context.now) && !Number.isNaN(Date.parse(context.now)) && new Date(context.now).toISOString()===context.now,'完成时间无效。');
    story.completedAt=context.now;
  }
  next.lastRoute='/story';return validateProject(next);
}
export function reunionSummary(project: ProjectV1) {
  const p=validateProject(project),s=p.story;
  if(!s || !['curtain','completed'].includes(s.nodeId) || !s.completedAt || !s.castSnapshot || !s.approach)return null;
  return {id:s.definitionVersion===1?`${s.runId}:reunion`:`${s.runId}:ending:${s.ending}`,runId:s.runId,definitionVersion:s.definitionVersion,
    ending:s.definitionVersion===2?s.ending!:null,completedAt:s.completedAt,approach:s.approach,castSnapshot:s.castSnapshot,assistedNodeIds:s.assistedNodeIds,presetAppearanceUsed:s.presetAppearanceUsed};
}
/** Rebuild only the current short node; caller owns a fresh transient mount generation. */
export function storyEntry(project: ProjectV1,definition: StoryDefinition,generation: number) {
  const p=validateProject(project);requireFact(p.story,'尚未开始演出。');
  requireFact(Number.isSafeInteger(generation) && generation>=0,'挂载代数无效。');
  const s=p.story!,node=currentStoryNode(definition,s);
  return {token:`${s.runId}:${s.revision}:${s.nodeId}:${generation}`,guard:storyGuard(s),paused:true as const,elapsedMs:0,node:JSON.parse(JSON.stringify(node)) as StoryNode};
}
