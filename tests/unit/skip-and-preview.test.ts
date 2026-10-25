import {describe,it,expect} from 'vitest';
import {createProject} from '../../src/domain/defaults';
import {beginStory,reduceStory,storyGuard,reunionSummary} from '../../src/domain/story';
import {validateProject} from '../../src/domain/validation';
import {definitionFor} from '../../src/content/reunion';
import {ProjectStore} from '../../src/app/store';
import type {Approach,EndingId} from '../../src/domain/types';
const now='2026-10-25T01:00:00.000Z';
const make=()=>createProject('test-project','test-writer',now);
describe('explicit skip keeps choices, provenance and version paths',()=>{
 for(const version of [1,2,3,4] as const)for(const approach of ['call-first','split-first'] as Approach[])for(const ending of (version===1?['home']:['home','light','road','waiting','sacrifice']) as EndingId[]){
  it(`v${version} ${approach}/${ending}`,()=>{
   let p=beginStory(make(),'skip-run','full',version)!;const definition=definitionFor(p.story);let count=0;
   while(p.story!.nodeId!=='completed'){
    const node=definition.nodes.find(n=>n.id===p.story!.nodeId)!,guard=storyGuard(p.story!),context={paused:true,elapsedMs:999999,now};
    const payload=node.id==='craft'?{action:'COMPLETE_INTERACTION' as const,source:'user' as const,evidence:{kind:'craft' as const,presetAppearanceUsed:false}}:node.id==='approach-choice'?{action:'CHOOSE' as const,approach}:node.id==='ending-choice'?{action:'CHOOSE_ENDING' as const,ending}:{action:'SKIP_NODE' as const,source:'user' as const};
    const next=reduceStory(p,{...guard,...payload},context,definition)!;expect(reduceStory(next,{...guard,...payload},context,definition)).toBeNull();p=next;if(++count>40)throw new Error('cycle');
   }
   expect(p.story!.assistedNodeIds).toEqual([]);expect(p.story!.skippedNodeIds).not.toContain('craft');expect(p.story!.skippedNodeIds).not.toContain('ending-choice');expect(reunionSummary(p)?.completedAt).toBe(now);expect(validateProject(p)).toEqual(p);
   expect(()=>validateProject({...p,story:{...p.story!,skippedNodeIds:['approach-choice']}})).toThrow();
   if(version!==1){const other=ending==='home'?'ending-sacrifice-hold':'reunion-hold';expect(()=>validateProject({...p,story:{...p.story!,skippedNodeIds:[other]}})).toThrow();}
  });
 }
 it('does not skip craft or invent a choice, and old absent skip metadata remains absent',()=>{
  let p=beginStory(make(),'old','full',4)!;expect(validateProject(p).story).not.toHaveProperty('skippedNodeIds');p=reduceStory(p,{...storyGuard(p.story!),action:'SKIP_NODE',source:'user'},{paused:true,elapsedMs:0,now},definitionFor(p.story))!;
  expect(()=>reduceStory(p,{...storyGuard(p.story!),action:'SKIP_NODE',source:'user'},{paused:true,elapsedMs:0,now},definitionFor(p.story))).toThrow();
 });
});
it('preview commands, flush and story commits never mutate their source snapshot',async()=>{
 const source=make(),before=JSON.stringify(source),preview=ProjectStore.preview(source);
 await preview.edit({type:'LAMP_POSITION',lampX:.2,lampDepth:1.7});await preview.edit({type:'POSE',pose:{...source.pose,x:.65}});await preview.flush();
 expect(preview.getState().project!.stage.lampX).toBe(.2);expect(preview.getState().project!.pose.x).toBe(.65);expect(JSON.stringify(source)).toBe(before);preview.dispose();
});
