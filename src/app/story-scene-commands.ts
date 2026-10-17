import { currentStoryNode, reduceStory, StoryCommandError } from '../domain/story';
import type { StoryGuard } from '../domain/story-types';
import { reunionDefinition } from '../content/reunion';
import type { ProjectStore } from './store';

export type SceneCommand=StoryGuard&({action:'COMPLETE_SCENE';source:'script'}|
  {action:'COMPLETE_SCENE';source:'user';skipped:true}|{action:'SET_MODE';mode:'full'|'guided'});
export interface SceneObservation {token:string;paused:boolean;elapsedMs:number;now:string}
/** Scope and persisted guard are checked inside the same serial operation, not only before enqueue. */
export function submitScopedSceneCommand(store:ProjectStore,scope:{isCurrent(token:string):boolean},command:SceneCommand,observation:SceneObservation){
  const action={...command},context={...observation};
  return store.commit(project=>{
    if(!scope.isCurrent(context.token))return null;
    const story=project.story;if(!story||story.runId!==action.runId||story.revision!==action.expectedRevision||story.nodeId!==action.expectedNodeId)return null;
    const node=currentStoryNode(reunionDefinition,story);
    if(action.action==='COMPLETE_SCENE'&&action.source==='script'){
      if(!['cinematic','curtain'].includes(node.kind)||node.completion.kind!=='scene'||node.completion.activation!=='automatic')throw new StoryCommandError('当前节点不能由脚本自动完成。');
      const duration=story.mode==='full'?node.fullTiming.targetMs:node.guidedTiming.targetMs;
      if(context.paused||!Number.isFinite(context.elapsedMs)||context.elapsedMs<duration)throw new StoryCommandError('片段还没有播放到结束。');
    }
    return reduceStory(project,action,context,reunionDefinition);
  });
}
