import { append, element } from '../shared/dom';
import { heading, pageLinks } from '../shared/pieces';
import { mountStoryController } from './controller';
import type { PageFactory } from '../../app/view';

export const mountStory: PageFactory = (host, ctx) => {
  if (!ctx.guide) ctx.audio?.enterStory();
  append(host, heading('幕前', '这一场，从此刻接续。', '每次回来，幕面准备好便从当前这一小段的起点自动开演。你可随时暂停，造型和已确认的选择会被保留。'), pageLinks());
  const layout=element('section','workspace story-workspace'),stageSlot=element('div','story-stage-slot'),panel=element('div','control-panel');
  append(layout,stageSlot,panel);host.appendChild(layout);
  const controller=mountStoryController(stageSlot,panel,ctx);
  let disposed=false,redirectQueued=false;
  const completedKey=(state:Parameters<typeof controller.update>[0])=>{
    const project=state.project,story=project?.story;
    return !ctx.guide&&!disposed&&!ctx.isBusy()&&!state.hasPending&&['saved','memory'].includes(state.status)&&story?.nodeId==='completed'&&story.completedAt
      ?JSON.stringify([project!.projectId,story.runId,story.revision]):null;
  };
  return {
    suspendForGuide:()=>controller.suspendForGuide(),
    update(state){
      controller.update(state);const key=completedKey(state);
      if(!key||redirectQueued)return;redirectQueued=true;
      // A route may still be mounting, or a transaction still unlocking. Never
      // navigate reentrantly from a Store subscriber or a retired page.
      void Promise.resolve().then(()=>{redirectQueued=false;if(!disposed&&completedKey(ctx.store.getState())===key)ctx.navigate({path:'/result',exhibitId:null},{replace:true});});
    },
    dispose(){disposed=true;controller.dispose();},
  };
};
