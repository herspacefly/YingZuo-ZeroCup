import { assetCatalog } from '../content/catalog';
import { constrainPoseToStage,solveArm } from '../domain/pose';
import { screenToLocalPoint } from '../domain/projection';
import type { StoryNode } from '../domain/story-types';
import type { CanvasFrame } from '../renderers/canvas/types';
import { prepareFrame } from '../renderers/canvas/frame';

export interface PlayEffects {opening:number;reveal:number;reaction:number;guardianExit:number;holding?:CanvasFrame|null}
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;

/** A restored stable embrace uses a deterministic staged pose, never a saved mouse trajectory. */
export function holdingFrame(input:CanvasFrame):CanvasFrame{
  const frame=copy(input),center={x:0,y:-.06};
  for(const actor of frame.actors){
    const template=assetCatalog.puppets.find(item=>item.id===actor.templateId)!;
    actor.pose=solveArm(template,actor.pose,'right',screenToLocalPoint(center,actor.pose,frame.stage));
  }
  return prepareFrame(frame,assetCatalog);
}

/** Runtime fades keep geometry/assets loaded; they do not fabricate interaction evidence or progress. */
export function stagePlayFrame(node:StoryNode,input:CanvasFrame,effects:PlayEffects):CanvasFrame{
  const frame=copy(input),mother=frame.actors.find(actor=>actor.actorId==='mother');
  if(node.id==='memory-wave'&&mother){
    const pose=copy(node.entryPoses.mother!);pose.joints.rightShoulder+=1.05*clamp(effects.reaction);pose.joints.rightElbow+=.5*clamp(effects.reaction);mother.pose=pose;
  }
  if(frame.stage.backgroundId==='mountain-v1'){
    frame.showRods=node.kind==='interaction'||!!frame.showRods;
    // The puppeteer stands in front of the closed mountain; only the mother is behind it.
    frame.actorSceneOrder={chenxiang:30};
    if(['call-light','call-response'].includes(node.id)&&mother)frame.actorSceneOrder.mother=25;
    for(const layer of frame.sceneLayers??[]){
      if(layer.id==='mountain-far')layer.opacity=.55;
      if(['mountain-left','mountain-right'].includes(layer.id)){
        layer.opacity=1;
        if(['call-split','split-axe','ending-sacrifice-axe'].includes(node.id)){const opened=layer.id==='mountain-left'?-.55:.55;layer.x+=(opened-layer.x)*clamp(effects.opening);}
      }
      // This bitmap is a rectangular floor trim, not translucent dust in front of people.
      if(layer.id==='mountain-dust')layer.opacity=0;
    }
    if(['call-light','split-search'].includes(node.id))frame.actorOpacity={mother:.05+.95*clamp(effects.reveal)};
  }
  if(node.id==='guardian')frame.actorOpacity={guardian:1-clamp(effects.guardianExit)};
  if(node.prerequisites.ending==='waiting'){
    frame.actorOpacity={...frame.actorOpacity,mother:.6};
    for(const layer of frame.sceneLayers??[]){
      if(layer.id==='mountain-left'||layer.id==='mountain-right'){layer.x=layer.id==='mountain-left'?-.35:.35;layer.opacity=.45;}
      // The existing dust bitmap is a rectangular floor fragment. Use the parted sheets for the final seal.
      if(layer.id==='mountain-dust')layer.opacity=0;
    }
  }
  if(node.prerequisites.ending==='sacrifice'){const dust=frame.sceneLayers?.find(l=>l.id==='mountain-dust');if(dust)dust.opacity=0;}
  if(['reunion-hold','ending-home-epilogue','curtain','completed'].includes(node.id)&&(!node.prerequisites.ending||node.prerequisites.ending==='home')){
    const holding=effects.holding??holdingFrame({...frame,actors:frame.actors.map(actor=>({...actor,pose:copy(node.entryPoses[actor.actorId]!)}))});
    for(const actor of frame.actors){
      const base=holding.actors.find(item=>item.actorId===actor.actorId)?.pose;
      if(!base)continue;
      const entry=node.entryPoses[actor.actorId]!,animated=actor.pose;actor.pose=copy(base);
      for(const joint of Object.keys(actor.pose.joints) as (keyof typeof actor.pose.joints)[])actor.pose.joints[joint]+=animated.joints[joint]-entry.joints[joint];
    }
  }
  for(const actor of frame.actors){
    const template=assetCatalog.puppets.find(item=>item.id===actor.templateId)!;
    const fit=constrainPoseToStage(actor.pose,template,frame.stage,frame.attachments?.filter(item=>item.actorId===actor.actorId).map(item=>item.attachmentId));
    if(!fit.fits)throw new Error('当前场面的角色和附件无法完整放入幕面。');actor.pose=fit.pose;
  }
  return prepareFrame(frame,assetCatalog);
}
