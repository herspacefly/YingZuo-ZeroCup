import { beginStory, reduceStory, storyGuard } from '../domain/story';
import type { StoryGuard } from '../domain/story-types';
import { definitionFor } from '../content/reunion';
import type { ProjectStore, SaveResult } from './store';

export interface CraftConfirmation {
  runId:string; mode:'full'|'guided'; presetAppearanceUsed:boolean; guard:StoryGuard|null; now:string;
}
/** A direct craft visit explicitly skips the intro. Only the final frozen candidate is committed. */
export function confirmCraft(store:ProjectStore,options:CraftConfirmation) {
  const request={...options,guard:options.guard?{...options.guard}:null};
  return store.commit(project=>{
    const current=project.story;
    if(request.guard ? !current||current.runId!==request.guard.runId||current.revision!==request.guard.expectedRevision||current.nodeId!==request.guard.expectedNodeId : !!current)return null;
    let candidate=current?project:beginStory(project,request.runId,request.mode,4)!;
    const definition=definitionFor(candidate.story);
    const context={paused:true,elapsedMs:0,now:request.now};
    if(candidate.story!.nodeId==='intro')candidate=reduceStory(candidate,{...storyGuard(candidate.story!),action:'COMPLETE_SCENE',source:'user',skipped:true},context,definition)!;
    if(candidate.story!.nodeId!=='craft')return null;
    return reduceStory(candidate,{...storyGuard(candidate.story!),action:'COMPLETE_INTERACTION',source:'user',
      evidence:{kind:'craft',presetAppearanceUsed:request.presetAppearanceUsed}},context,definition);
  });
}
/** Archive the whole old performance, keeping the latest editor as a new, unstarted project. */
export async function archiveForRehearsal(store:ProjectStore,acknowledgePrevious=false):Promise<SaveResult> {
  if(store.getState().hasPending)return {ok:false,error:new Error('先处理待保存动作，再归档重开。')};
  const saved=await store.flush();if(!saved.ok)return saved;
  const project=store.getState().project;if(!project)return {ok:false,error:new Error('没有可归档的作品。')};
  return store.newProject({...project,story:null,museum:{visitedExhibitIds:[]},performance:null,partialRecording:null,lastRoute:'/craft'},acknowledgePrevious);
}
