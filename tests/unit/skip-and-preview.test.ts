import {describe,it,expect} from 'vitest';
import {createProject} from '../../src/domain/defaults';
import {beginStory,currentStoryNode,reduceStory,storyGuard,reunionSummary} from '../../src/domain/story';
import {validateProject} from '../../src/domain/validation';
import {definitionFor} from '../../src/content/reunion';
import {ProjectStore} from '../../src/app/store';
import {CHOICE_RUNS,choicePayload} from '../helpers/choice-story';
const now='2026-10-25T01:00:00.000Z';
const make=()=>createProject('test-project','test-writer',now);
describe('explicit skip keeps choices and provenance on every supported path',()=>{
 for(const run of CHOICE_RUNS)it(`${run.journeyIntent}/${run.mountainPact}/${run.approach}/${run.finalAction}`,()=>{
  let p=beginStory(make(),'skip-run','full')!;const definition=definitionFor(p.story);let count=0;
  while(p.story!.nodeId!=='completed'){
   const node=currentStoryNode(definition,p.story!),guard=storyGuard(p.story!),context={paused:true,elapsedMs:999999,now};
   const payload=node.kind==='choice'||node.id==='craft'?choicePayload(p,run):{action:'SKIP_NODE' as const,source:'user' as const};
   const next=reduceStory(p,{...guard,...payload},context,definition)!;expect(reduceStory(next,{...guard,...payload},context,definition)).toBeNull();p=next;if(++count>38)throw new Error('cycle');
  }
  expect(p.story!.assistedNodeIds).toEqual([]);expect(reunionSummary(p)?.completedAt).toBe(now);expect(validateProject(p)).toEqual(p);
  for(const id of ['craft','journey-choice','mountain-pact-choice','approach-choice','ending-choice'])expect(p.story!.skippedNodeIds).not.toContain(id);
  expect(()=>validateProject({...p,story:{...p.story!,skippedNodeIds:['approach-choice']}})).toThrow();
  const other=run.ending==='home'?'ending-sacrifice-hold':'reunion-hold';expect(()=>validateProject({...p,story:{...p.story!,skippedNodeIds:[other]}})).toThrow();
 });
 it('keeps absent optional skip metadata absent and cannot skip craft',()=>{
  let p=beginStory(make(),'skip','full')!;expect(validateProject(p).story).not.toHaveProperty('skippedNodeIds');p=reduceStory(p,{...storyGuard(p.story!),action:'SKIP_NODE',source:'user'},{paused:true,elapsedMs:0,now},definitionFor(p.story))!;
  expect(()=>reduceStory(p,{...storyGuard(p.story!),action:'SKIP_NODE',source:'user'},{paused:true,elapsedMs:0,now},definitionFor(p.story))).toThrow();
 });
});
it('preview commands, flush and story commits never mutate their source snapshot',async()=>{
 const source=make(),before=JSON.stringify(source),preview=ProjectStore.preview(source);
 await preview.edit({type:'LAMP_POSITION',lampX:.2,lampDepth:1.7});await preview.edit({type:'POSE',pose:{...source.pose,x:.65}});await preview.flush();
 expect(preview.getState().project!.stage.lampX).toBe(.2);expect(preview.getState().project!.pose.x).toBe(.65);expect(JSON.stringify(source)).toBe(before);preview.dispose();
});
