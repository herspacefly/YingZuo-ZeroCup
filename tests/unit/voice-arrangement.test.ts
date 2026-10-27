import {describe,expect,it} from 'vitest';
import {arrangeVoiceNode,authoredVoiceNode,voiceCuesForNode,voiceVisualTime} from '../../src/content/voice-arrangement';
import {choiceDefinition,lamplitDefinition} from '../../src/content/reunion';
import {presentChoiceDialogue} from '../../src/content/choice-dialogue';
import {subtitlesForMode} from '../../src/content/story-contract';
import {currentStoryNode,reduceStory,storyEntry,storyGuard} from '../../src/domain/story';
import {createSceneDirector} from '../../src/story/director';
import {createReunionReplay} from '../../src/story/replay';
import {CHOICE_NOW,CHOICE_RUNS,choiceAt,choicePayload} from '../helpers/choice-story';
import type {StoryNode} from '../../src/domain/story-types';
import type {ProjectV1} from '../../src/domain/types';

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
// Timeline conversion can differ by a few IEEE-754 ulps after guided scaling.
const rounded=<T>(value:T):T=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='number'?Number(item.toFixed(9)):item)) as T;
function variants(node:StoryNode){
  if(!['mountain-listen','ending-choice'].includes(node.id))return [node];
  return CHOICE_RUNS.map(run=>presentChoiceDialogue(node,{...choiceAt(node.id,run).story!,choices:{journeyIntent:run.journeyIntent,mountainPact:run.mountainPact,finalAction:null}}));
}

describe('v5 measured voice arrangement',()=>{
  it('covers the actual full/guide choice variants without altering source text or JSON and is clone-idempotent',()=>{
    const before=clone(choiceDefinition);
    for(const raw of choiceDefinition.nodes)for(const node of variants(raw)){
      const arranged=arrangeVoiceNode(node,5);
      expect(arrangeVoiceNode(clone(arranged),5)).toEqual(arranged);
      expect(arranged.subtitles.map(c=>[c.speaker,c.text])).toEqual(node.subtitles.map(c=>[c.speaker,c.text]));
      for(const mode of ['full','guided'] as const){
        const cues=subtitlesForMode(arranged,mode),voice=voiceCuesForNode(arranged,mode,5);
        expect(voice).toHaveLength(cues.length);
        for(let i=0;i<cues.length;i++){
          expect(voice[i]!.startMs).toBe(cues[i]!.startMs);
          expect(voice[i]!.endMs).toBe(cues[i]!.endMs);
          expect(voice[i]!.clip.src).toMatch(/^\/audio\/voice-v5\/[a-f0-9]+\.mp3$/);
          expect(cues[i]!.endMs-cues[i]!.startMs).toBeGreaterThanOrEqual(voice[i]!.clip.durationMs+399);
          if(i)expect(cues[i]!.startMs).toBeCloseTo(cues[i-1]!.endMs,5);
        }
      }
    }
    expect(choiceDefinition).toEqual(before);
  });
  it('keeps old editions unchanged and no old voice requests are returned',()=>{
    for(const version of [1,2,3,4] as const)for(const node of lamplitDefinition.nodes){
      expect(arrangeVoiceNode(node,version)).toBe(node);
      expect(voiceCuesForNode(node,'full',version)).toEqual([]);
    }
  });
  it('preserves two seconds of quiet and reserves the original forty-second curtain song after narration',()=>{
    for(const mode of ['full','guided'] as const){
      for(const id of ['reunion-reach','reunion-hold','ending-light-hold','ending-road-hold','ending-waiting-hold','ending-sacrifice-hold'] as const){
        const node=arrangeVoiceNode(authoredVoiceNode(id),5);
        expect(subtitlesForMode(node,mode)[0]!.startMs).toBeCloseTo(2000,5);
        expect(voiceVisualTime(id,mode,1500)).toBe(0);
      }
      const curtain=arrangeVoiceNode(authoredVoiceNode('curtain'),5),cues=subtitlesForMode(curtain,mode);
      expect((mode==='full'?curtain.fullTiming:curtain.guidedTiming).targetMs-cues.at(-1)!.endMs).toBeCloseTo(40000,5);
      expect(voiceVisualTime('curtain',mode,cues.at(-1)!.endMs+15000)).toBe(authoredVoiceNode('curtain').fullTiming.targetMs);
    }
  });
  it('gates decisions at the measured duration and preserves the craft early confirmation',()=>{
    for(const mode of ['full','guided'] as const)for(const id of ['journey-choice','mountain-pact-choice','approach-choice','ending-choice'] as const){
      const project=choiceAt(id,CHOICE_RUNS[1]!,mode),node=currentStoryNode(choiceDefinition,project.story!);
      const duration=(mode==='full'?node.fullTiming:node.guidedTiming).targetMs,command={...storyGuard(project.story!),...choicePayload(project,CHOICE_RUNS[1]!)};
      expect(()=>reduceStory(project,command,{paused:false,elapsedMs:duration-1,now:CHOICE_NOW},choiceDefinition)).toThrow('对白');
      expect(reduceStory(project,command,{paused:false,elapsedMs:duration,now:CHOICE_NOW},choiceDefinition)?.story?.nodeId).not.toBe(id);
    }
    const craft=choiceAt('craft');expect(currentStoryNode(choiceDefinition,craft.story!).fullTiming.minDurationMs).toBe(0);
  });
  it('uses the original visual choreography at mapped narration instants while subtitles follow voice time',()=>{
    for(const id of ['intro','training','call-response'] as const)for(const mode of ['full','guided'] as const){
      const project=choiceAt(id,CHOICE_RUNS[1]!,mode),entry=storyEntry(project,choiceDefinition,1),director=createSceneDirector(project,entry);
      const raw=authoredVoiceNode(id),comparison=clone(project) as ProjectV1;comparison.story!.definitionVersion=4;
      const rawEntry={...entry,node:clone(raw)},old=createSceneDirector(comparison,rawEntry);
      for(const cue of subtitlesForMode(entry.node,mode)){
        const elapsed=(cue.startMs+cue.endMs)/2,visual=voiceVisualTime(id,mode,elapsed);
        const oldTime=mode==='full'?visual:visual/raw.fullTiming.targetMs*raw.guidedTiming.targetMs;
        expect(rounded(director.sample(elapsed).frame)).toEqual(rounded(old.sample(oldTime).frame));
        expect(director.sample(elapsed).cues[0]?.text).toBe(cue.text);
      }
    }
  });
  it('shares measured gates and choice text with read-only replay and does not alter the completed project',()=>{
    for(const mode of ['full','guided'] as const)for(const run of CHOICE_RUNS){
      const project=choiceAt('completed',run,mode),before=clone(project),replay=createReunionReplay(project);
      for(const segment of replay.segments){
        const index=replay.segments.findIndex(item=>item.id===segment.id),sample=replay.sample(index,0);
        expect(sample.voiceCues).toEqual(voiceCuesForNode(currentStoryNode(choiceDefinition,{...project.story!,nodeId:segment.id}),mode,5));
      }
      expect(project).toEqual(before);
    }
  });
});
