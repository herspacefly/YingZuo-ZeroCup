import { assetCatalog } from '../../content/catalog';
import type { RenderActor } from '../../content/asset-types';
import { defaultPose } from '../../domain/defaults';
import { constrainPoseToStage } from '../../domain/pose';
import { currentStoryNode } from '../../domain/story';
import { reunionDefinition } from '../../content/reunion';
import type { ProjectV1 } from '../../domain/types';
import { mountCanvasRenderer } from '../../renderers/canvas/renderer';
import type { CanvasFrame, CanvasStatus } from '../../renderers/canvas/types';
import { append, element, scope } from './dom';

export function editorFrame(project: ProjectV1, duet = false, showRods = false): CanvasFrame {
  const stage={...project.stage}, pose={...project.pose,joints:{...project.pose.joints}};
  if(duet) { pose.x=.32; pose.y=.62; }
  const template=assetCatalog.puppets.find(item=>item.id==='chenxiang-v1')!;
  const fitted=constrainPoseToStage(pose,template,stage);
  if(!fitted.fits) throw new Error('当前姿态超出幕面，请先调整姿态或灯位。');
  const actors:RenderActor[]=[{actorId:'chenxiang',templateId:'chenxiang-v1',appearance:project.appearance,pose:fitted.pose}];
  if(duet) {
    const mother={...defaultPose(),x:.72,y:.62,facing:-1 as const};
    const fit=constrainPoseToStage(mother,assetCatalog.puppets.find(item=>item.id==='mother-v1')!,stage);
    if(!fit.fits) throw new Error('母亲的预览姿态暂时无法放入幕面。');
    actors.push({actorId:'mother',templateId:'mother-v1',paletteId:'mother-v1',sharedMotif:project.story?.castSnapshot?.sharedMotif??project.appearance.patternId,pose:fit.pose});
  }
  return {actors,stage,showRods};
}
/** A paused entry still, not a director or an interaction-completion signal. */
export function storyFrame(project: ProjectV1): CanvasFrame | null {
  if(!project.story)return null;
  const story=project.story,node=currentStoryNode(reunionDefinition,story),cast=story.castSnapshot;
  const actors=node.actors.map((id):RenderActor=>{
    const pose=node.entryPoses[id]!;
    if(id==='chenxiang')return {actorId:id,templateId:'chenxiang-v1',appearance:cast?.appearance??project.appearance,pose};
    if(id==='mother')return {actorId:id,templateId:'mother-v1',paletteId:'mother-v1',sharedMotif:cast?.sharedMotif??project.appearance.patternId,pose};
    return {actorId:id,templateId:'guardian-v1',paletteId:'guardian-v1',pose};
  });
  return {actors,stage:node.entryStage,sceneLayers:node.entrySceneLayers,attachments:node.entryAttachments};
}

export function canvasStage(caption: string) {
  const figure=element('figure','stage-figure'),screen=element('div','canvas-stage-screen'),status=element('p','canvas-stage-status'),retry=element('button','button secondary','重试幕面');
  status.setAttribute('role','status'); retry.hidden=true;
  const foot=element('figcaption','stage-caption'); append(foot,element('p','',caption),status,retry); append(figure,screen,foot);
  const life=scope(); let last:CanvasFrame|null=null,signature='',disposed=false;
  let currentStatus:CanvasStatus={state:'loading',message:'正在准备影偶与幕面…'};
  const listeners=new Set<(status:CanvasStatus)=>void>();
  const renderer=mountCanvasRenderer(screen,assetCatalog,update=>{
    if(status.textContent!==update.message)status.textContent=update.message; status.setAttribute('data-state',update.state); retry.hidden=update.state!=='error'; renderer.canvas.hidden=update.state!=='ready';
    currentStatus=update;listeners.forEach(listener=>listener(update));
  });
  life.on(retry,'click',()=>{if(last)void renderer.update(last);});
  return {
    figure,canvas:renderer.canvas,screen,
    getStatus:()=>({...currentStatus}),
    subscribe(listener:(status:CanvasStatus)=>void) {listeners.add(listener);listener({...currentStatus});return()=>listeners.delete(listener);},
    update(input:CanvasFrame|null|(()=>CanvasFrame|null)) {
      if(disposed)return;
      let frame:CanvasFrame|null;
      try {frame=typeof input==='function'?input():input;}
      catch(error) {signature='';last=null;renderer.reset();figure.hidden=false;renderer.canvas.hidden=true;status.setAttribute('data-state','error');status.textContent=error instanceof Error?error.message:String(error);retry.hidden=true;currentStatus={state:'error',message:status.textContent};listeners.forEach(listener=>listener(currentStatus));return;}
      const next=JSON.stringify(frame); if(signature===next)return; signature=next;last=frame;
      figure.hidden=!frame;
      if(frame)void renderer.update(frame);else {renderer.reset();currentStatus={state:'loading',message:'幕面已清空。'};listeners.forEach(listener=>listener(currentStatus));}
    },
    dispose() { disposed=true;last=null;signature='';listeners.clear();life.dispose();renderer.pause();renderer.dispose(); },
  };
}
