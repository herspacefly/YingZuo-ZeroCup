import { describe,expect,it } from 'vitest';
import { beginStory,currentStoryNode,reduceStory,reunionSummary,storyEntry,storyGuard } from '../../src/domain/story';
import { validateProject } from '../../src/domain/validation';
import { reunionDefinition as definition } from '../../src/content/reunion';
import { assetCatalog } from '../../src/content/catalog';
import sources from '../../src/content/sources.json';
import { subtitlesForMode,validateStoryDefinition } from '../../src/content/story-contract';
import { JOINT_IDS,STORY_NODE_IDS } from '../../src/domain/limits';
import type { StoryCommand,StoryDefinition } from '../../src/domain/story-types';
import { NOW,at,commandFor,first,step } from '../helpers/story';

const refs={nodeIds:STORY_NODE_IDS,jointIds:JOINT_IDS,sourceIds:sources.sources.map(s=>s.id),assetIds:assetCatalog.manifest.assets.map(a=>a.id),puppets:assetCatalog.puppets,scenes:assetCatalog.scenes.scenes};
const context={paused:false,elapsedMs:20000,now:NOW};
describe('STORY-01/02 pure story command contract',()=>{
  for(const mode of ['full','guided'] as const)for(const approach of ['call-first','split-first'] as const)for(const assisted of [false,true]) {
    it(`${mode}/${approach}/${assisted?'explicit help':'manual evidence'} reaches the same reunion and curtain in the required order`,()=>{
      let p=first(mode);const seen:string[]=[];
      while(p.story!.nodeId!=='completed'){seen.push(p.story!.nodeId);p=step(p,approach,assisted);validateProject(p);}
      seen.push('completed');expect(seen).toHaveLength(15);expect(p.story!.revision).toBe(14);
      expect(seen.slice(8,11)).toEqual(approach==='call-first'?['call-light','call-response','call-split']:['split-axe','split-search','split-response']);
      expect(p.story).toMatchObject({mode,approach,approachSource:'user',completedAt:NOW});
      expect(reunionSummary(p)!.id).toBe('run-test:reunion');
      expect(p.story!.assistedNodeIds.includes('curtain')).toBe(assisted);expect(p.story!.assistedNodeIds).not.toContain('training');
    });
  }
  it.each(['run','revision','node','repeat'])('makes %s mismatches a no-op before examining a stale payload',kind=>{
    const p=at('approach-choice'),cmd=commandFor(p);
    if(kind==='run')cmd.runId='old-run';if(kind==='revision')cmd.expectedRevision--;if(kind==='node')cmd.expectedNodeId='guardian';
    const current=kind==='repeat'?step(p):p;
    expect(reduceStory(current,cmd,{paused:true,elapsedMs:0,now:'not-used'},definition)).toBeNull();
    expect(current.story!.nodeId).toBe(kind==='repeat'?'call-light':'approach-choice');
  });
  it('initializes only once, never changes run identity through a remount',()=>{
    const p=first();expect(beginStory(p,'another-run','guided')).toBeNull();
    expect(storyEntry(p,definition,3)).toMatchObject({paused:true,elapsedMs:0,guard:storyGuard(p.story!)});
    expect(storyEntry(p,definition,3).token).not.toBe(storyEntry(p,definition,4).token);
  });
  it('freezes the latest appearance independently of the draft at craft confirmation',()=>{
    const p=at('craft');p.appearance.patternId='flower-v1';p.appearance.paletteId='indigo-v1';const after=step(p);
    expect(after.story!.castSnapshot).toMatchObject({appearance:p.appearance,sharedMotif:'flower-v1',motherPaletteId:'mother-v1',guardianPaletteId:'guardian-v1'});
    p.appearance.patternId='wave-v1';after.appearance.paletteId='woodland-v1';
    expect(after.story!.castSnapshot!.appearance).toMatchObject({patternId:'flower-v1',paletteId:'indigo-v1'});
  });
  it('records explicit preset use, never guesses it from equality with defaults',()=>{
    const p=at('craft'),cmd=commandFor(p);
    expect(step(p).story!.presetAppearanceUsed).toBe(false);
    if(cmd.action!=='COMPLETE_INTERACTION'||cmd.source!=='user'||cmd.evidence.kind!=='craft')throw new Error('fixture');
    cmd.evidence.presetAppearanceUsed=true;expect(reduceStory(p,cmd,context,definition)!.story!.presetAppearanceUsed).toBe(true);
    p.appearance.patternId='flower-v1';p.appearance.paletteId='indigo-v1';
    const preset=reduceStory(p,cmd,context,definition)!;
    expect(preset.story!.castSnapshot!.appearance).toMatchObject({patternId:'cloud-v1',paletteId:'vermilion-v1'});
    expect(preset.appearance).toEqual(p.appearance);
  });
  it('cannot choose or skip outside its permitted node or turn a montage into assisted input',()=>{
    const p=at('guardian'),guard=storyGuard(p.story!);
    expect(()=>reduceStory(p,{...guard,action:'CHOOSE',approach:'split-first'},context,definition)).toThrow('不接受');
    const montage=at('training');expect(()=>reduceStory(montage,{...storyGuard(montage.story!),action:'COMPLETE_INTERACTION',source:'assistance'},context,definition)).toThrow();
    expect(()=>reduceStory(montage,{...storyGuard(montage.story!),action:'COMPLETE_SCENE',source:'user',skipped:true},context,definition)).toThrow('仅序幕');
    expect(()=>reduceStory(montage,{...storyGuard(montage.story!),action:'COMPLETE_SCENE',source:'assistance'},context,definition)).toThrow('来源');
  });
  it('skips only intro, while craft and branch confirmation remain necessary',()=>{
    const p=first();const next=reduceStory(p,{...storyGuard(p.story!),action:'COMPLETE_SCENE',source:'user',skipped:true},{...context,paused:true,elapsedMs:0},definition)!;
    expect(next.story).toMatchObject({nodeId:'craft',castSnapshot:null,approach:null,completedAt:null});
  });
  it('mode changes require pause, invalidate old callbacks and preserve all stable choices',()=>{
    const p=at('call-light'),before=JSON.parse(JSON.stringify(p.story)),old=commandFor(p);
    const cmd:StoryCommand={...storyGuard(p.story!),action:'SET_MODE',mode:'guided'};
    expect(()=>reduceStory(p,cmd,context,definition)).toThrow('暂停');
    const next=reduceStory(p,cmd,{...context,paused:true},definition)!;
    expect(next.story).toEqual({...before,mode:'guided',revision:before.revision+1});
    expect(reduceStory(next,old,context,definition)).toBeNull();expect(step(next).story!.nodeId).toBe('call-response');
    expect(storyEntry(next,definition,5)).toMatchObject({paused:true,elapsedMs:0});
    expect(reduceStory(next,{...storyGuard(next.story!),action:'SET_MODE',mode:'guided'},{...context,paused:true},definition)).toBeNull();
  });
  it('enforces four quiet seconds and a user click before creating the one reunion',()=>{
    const p=at('reunion-hold'),cmd=commandFor(p);
    expect(()=>reduceStory(p,cmd,{...context,elapsedMs:3999},definition)).toThrow('播放完成');
    expect(()=>reduceStory(p,{...cmd,source:'script'} as StoryCommand,context,definition)).toThrow('来源');
    const curtain=step(p);expect(curtain.story).toMatchObject({nodeId:'curtain',completedAt:NOW});
    const changed=reduceStory(curtain,{...storyGuard(curtain.story!),action:'SET_MODE',mode:'guided'},{...context,paused:true,now:'2026-10-17T14:00:00.000Z'},definition)!;
    const completed=step(changed);expect(reunionSummary(completed)!.completedAt).toBe(NOW);expect(reunionSummary(completed)!.id).toBe(reunionSummary(curtain)!.id);
    expect(()=>reduceStory(completed,{...storyGuard(completed.story!),action:'COMPLETE_SCENE',source:'script'},context,definition)).toThrow('不接受');
  });
  it.each(['call-light','split-axe','reunion-reach','memory-wave'] as const)('rejects insufficient or paused evidence for %s',id=>{
    const p=at(id,id==='split-axe'?'split-first':'call-first'),cmd=commandFor(p);
    expect(()=>reduceStory(p,cmd,{...context,paused:true},definition)).toThrow('暂停');
    if(cmd.action!=='COMPLETE_INTERACTION'||cmd.source!=='user')throw new Error('fixture');
    const e=cmd.evidence;
    if(e.kind==='light'||e.kind==='wave')e.heldMs=0;
    if(e.kind==='axe')e.raisedHoldMs=499;
    if(e.kind==='reach')e.handDistanceRatio=.041;
    expect(()=>reduceStory(p,cmd,context,definition)).toThrow('尚未满足');
  });
  it('does not turn a future script version or exhausted revision into new progress',()=>{
    const p=at('call-light'),future={...definition,definitionVersion:2} as unknown as StoryDefinition;
    expect(()=>reduceStory(p,commandFor(p),context,future)).toThrow('版本');
    p.story!.revision=Number.MAX_SAFE_INTEGER;expect(()=>reduceStory(p,commandFor(p),context,definition)).toThrow('上限');
  });
});
describe('T15 content graph and consumer references',()=>{
  it('accepts the full graph and independent paused entry config',()=>{
    expect(validateStoryDefinition(definition,refs)).toEqual([]);
    const p=at('split-search','split-first');p.stage.lampX=.8;p.stage.backgroundId='home-v1';
    const entry=storyEntry(p,definition,1);expect(entry.node.entryStage).toEqual({backgroundId:'mountain-v1',lampX:0,puppetDistance:.2});
    entry.node.entryStage.lampX=.4;expect(currentStoryNode(definition,p.story!).entryStage.lampX).toBe(0);
  });
  it('maps every full subtitle into the guided duration without dropping the final line',()=>{
    for(const node of definition.nodes){
      const mapped=subtitlesForMode(node,'guided');expect(mapped).toHaveLength(node.subtitles.length);
      for(const cue of mapped){expect(cue.startMs).toBeGreaterThanOrEqual(0);expect(cue.endMs).toBeLessThanOrEqual(node.guidedTiming.targetMs);}
    }
    const intro=definition.nodes.find(n=>n.id==='intro')!;
    expect(subtitlesForMode(intro,'guided').at(-1)!.endMs).toBe(10000);
    expect(subtitlesForMode(intro,'full').at(-1)!.startMs).toBe(13000);
  });
  it.each(['edge','actor','pose','source','asset','layer','threshold','quiet','attachment','timebase'] as const)('rejects broken %s contracts',kind=>{
    const d=JSON.parse(JSON.stringify(definition)) as StoryDefinition;
    if(kind==='edge')d.nodes.find(n=>n.id==='call-response')!.next={default:'split-search'};
    if(kind==='actor')d.nodes.find(n=>n.id==='guardian')!.actors=['chenxiang','mother'];
    if(kind==='pose')d.nodes.find(n=>n.id==='reunion-reach')!.entryPoses.mother!.joints.leftHip=.1;
    if(kind==='source')d.nodes[0]!.sourceIds=['C404'];
    if(kind==='asset')d.nodes[0]!.assetIds.push('https://remote.invalid/image.png');
    if(kind==='layer')d.nodes.find(n=>n.id==='split-search')!.entrySceneLayers.find(l=>l.id==='mountain-left')!.x=0;
    if(kind==='threshold'){const c=d.nodes.find(n=>n.id==='call-light')!.completion;if(c.kind==='light')c.holdMs=200;}
    if(kind==='quiet')d.nodes.find(n=>n.id==='reunion-hold')!.guidedTiming.minDurationMs=100;
    if(kind==='attachment'){const n=d.nodes.find(n=>n.id==='guardian')!;n.assetIds=n.assetIds.filter(id=>id!=='guardian-staff');}
    if(kind==='timebase')d.subtitleTimebase='guided-ms' as StoryDefinition['subtitleTimebase'];
    expect(validateStoryDefinition(d,refs).length).toBeGreaterThan(0);
  });
});
