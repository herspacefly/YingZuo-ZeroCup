import './cables.css';
import { createCableMotion } from '../../domain/cables';
import { assetCatalog } from '../../content/catalog';
import type { RenderActor } from '../../content/asset-types';
import { defaultPose } from '../../domain/defaults';
import { constrainPoseToStage } from '../../domain/pose';
import { currentStoryNode } from '../../domain/story';
import { definitionFor } from '../../content/reunion';
import type { ProjectV1 } from '../../domain/types';
import { mountCanvasRenderer } from '../../renderers/canvas/renderer';
import type { CanvasFrame, CanvasStatus } from '../../renderers/canvas/types';
import { append, element, scope } from './dom';
import { mountSpatialStage } from './spatial-stage';
import { mountStagePerformance } from './stage-performance';

export function editorFrame(project: ProjectV1, duet = false, showRods = false): CanvasFrame {
  const stage={...project.stage}, pose={...project.pose,joints:{...project.pose.joints}};
  if(duet) { pose.x=.32; pose.y=.62; }
  const template=assetCatalog.puppets.find(item=>item.id==='chenxiang-v1')!;
  const fitted=constrainPoseToStage(pose,template,stage);
  if(!fitted.fits) throw new Error('当前姿态超出幕面，请先调整姿态或灯位。');
  const actors:RenderActor[]=[{actorId:'chenxiang',templateId:'chenxiang-v1',costumeTreatment:'original-texture',appearance:project.appearance,pose:fitted.pose}];
  if(duet) {
    const mother={...defaultPose(),x:.72,y:.62,facing:-1 as const};
    const fit=constrainPoseToStage(mother,assetCatalog.puppets.find(item=>item.id==='mother-v1')!,stage);
    if(!fit.fits) throw new Error('母亲的预览姿态暂时无法放入幕面。');
    actors.push({actorId:'mother',templateId:'mother-v1',costumeTreatment:'original-texture',paletteId:'mother-v1',sharedMotif:project.story?.castSnapshot?.sharedMotif??project.appearance.patternId,pose:fit.pose});
  }
  return {actors,stage,showRods};
}
/** A paused entry still, not a director or an interaction-completion signal. */
export function storyFrame(project: ProjectV1): CanvasFrame | null {
  if(!project.story)return null;
  const story=project.story,node=currentStoryNode(definitionFor(story),story),cast=story.castSnapshot;
  const costumeTreatment=story.definitionVersion>=4?'original-texture' as const:'legacy-motif' as const;
  const actors=node.actors.map((id):RenderActor=>{
    const pose=node.entryPoses[id]!;
    if(id==='chenxiang')return {costumeTreatment,actorId:id,templateId:'chenxiang-v1',appearance:cast?.appearance??project.appearance,pose};
    if(id==='mother')return {costumeTreatment,actorId:id,templateId:'mother-v1',paletteId:'mother-v1',sharedMotif:cast?.sharedMotif??project.appearance.patternId,pose};
    return {costumeTreatment,actorId:id,templateId:'guardian-v1',paletteId:'guardian-v1',pose};
  });
  return {actors,stage:node.entryStage,sceneLayers:node.entrySceneLayers,attachments:node.entryAttachments};
}

export function canvasStage(caption: string,options:{spatial?:boolean;backgroundFit?:'stretch'}={}) {
  const figure=element('figure','stage-figure'),screen=element('div','canvas-stage-screen'),status=element('p','canvas-stage-status'),retry=element('button','button secondary','重试幕面');
  status.setAttribute('role','status'); retry.hidden=true;
  const foot=element('figcaption','stage-caption'); append(foot,element('p','',caption),status,retry); append(figure,screen,foot);
  const life=scope(),motion=createCableMotion(); let last:CanvasFrame|null=null,signature='',disposed=false;
  function refreshCable(){if(disposed||!last)return;last={...last,cableMotion:motion.sample()};void renderer.update(last);}
  const cables={pull(id:import('../../domain/cables').CableSource,velocity=0){motion.pull(id,velocity);refreshCable();},release(){motion.release();refreshCable();},clear(){if(!motion.active)return;motion.clear();refreshCable();},tick(delta:number){if(!motion.active)return false;const before=JSON.stringify(motion.sample());motion.tick(delta);if(before!==JSON.stringify(motion.sample()))refreshCable();return motion.active;},get active(){return motion.active;},sample:()=>motion.sample()};
  let currentStatus:CanvasStatus={state:'loading',message:'正在准备影偶与幕面…'};
  status.textContent=currentStatus.message;status.setAttribute('data-state',currentStatus.state);
  let spatial:ReturnType<typeof mountSpatialStage>|null=null;
  const listeners=new Set<(status:CanvasStatus)=>void>();
  const renderer=mountCanvasRenderer(screen,assetCatalog,update=>{
    const changed=currentStatus.state!==update.state||currentStatus.message!==update.message;
    if(changed){
      if(status.textContent!==update.message)status.textContent=update.message;
      status.setAttribute('data-state',update.state);retry.hidden=update.state!=='error';
    }
    const hidden=update.state!=='ready';if(renderer.canvas.hidden!==hidden)renderer.canvas.hidden=hidden;
    currentStatus=update;
    // Spatial content follows every drawn pose; status subscribers follow transitions.
    spatial?.update(last,update.state);
    if(changed)listeners.forEach(listener=>listener(update));
  },options);
  if(options.spatial!==false)spatial=mountSpatialStage(figure,renderer.canvas);
  // A wrapped caption changes the desktop height cap even while paused.
  // Resize both the backing canvas and the subscribers' input overlays together.
  const screenResize=options.backgroundFit==='stretch'&&typeof ResizeObserver==='function'?new ResizeObserver(()=>{
    if(disposed)return;renderer.resize();listeners.forEach(listener=>listener({...currentStatus}));
  }):null;
  screenResize?.observe(screen);
  const performance=mountStagePerformance(foot,enabled=>{spatial?.setLightweight(enabled);renderer.setLightweight(enabled);});
  life.on(retry,'click',()=>{if(last)void renderer.update(last);});
  return {
    figure,canvas:renderer.canvas,screen,cables,frameObserver:performance.observer,
    spatialPreference:()=>spatial?.preference(),
    restoreSpatial:(preference:import('./spatial-stage').SpatialPreference|undefined)=>spatial?.restorePreference(preference),
    resize:()=>renderer.resize(),
    retry(){if(!disposed&&last)void renderer.update(last);},
    getStatus:()=>({...currentStatus}),
    subscribe(listener:(status:CanvasStatus)=>void) {listeners.add(listener);listener({...currentStatus});return()=>listeners.delete(listener);},
    update(input:CanvasFrame|null|(()=>CanvasFrame|null)) {
      if(disposed)return;
      let frame:CanvasFrame|null;
      try {frame=typeof input==='function'?input():input;}
      catch(error) {signature='';last=null;renderer.reset();spatial?.update(null,'error');figure.hidden=false;renderer.canvas.hidden=true;status.setAttribute('data-state','error');status.textContent=error instanceof Error?error.message:String(error);retry.hidden=true;currentStatus={state:'error',message:status.textContent};listeners.forEach(listener=>listener(currentStatus));return;}
      if(frame)frame={...frame,cableMotion:motion.sample()};
      const next=JSON.stringify(frame); if(signature===next)return; signature=next;last=frame;
      figure.hidden=!frame;
      if(frame)void renderer.update(frame);else {renderer.reset();spatial?.update(null,'loading');currentStatus={state:'loading',message:'幕面已清空。'};listeners.forEach(listener=>listener(currentStatus));}
    },
    dispose() { disposed=true;screenResize?.disconnect();motion.clear();last=null;signature='';listeners.clear();life.dispose();performance.dispose();spatial?.dispose();renderer.pause();renderer.dispose(); },
  };
}
