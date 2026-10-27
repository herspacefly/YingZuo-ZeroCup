import catalogJson from './voice-v5.json' with {type:'json'};
import authoredJson from './stories/reunion-v5.json' with {type:'json'};
import type { StoryDefinition, StoryNode } from '../domain/story-types';
import type { StoryVersion } from '../domain/types';

export interface VoiceClip { id:string; src:string; durationMs:number }
export interface VoiceCue { startMs:number; endMs:number; clip:VoiceClip }
interface VoiceLine extends VoiceClip { speaker:string; text:string }
interface VoiceCatalog { lines:VoiceLine[]; timings:Record<string,{full:number[];guided:number[]}> }
type Mode='full'|'guided';
const catalog=catalogJson as unknown as VoiceCatalog;
const authored=authoredJson as unknown as StoryDefinition;
const originalNodes=new Map(authored.nodes.map(node=>[node.id,node]));
const clips=new Map(catalog.lines.map(line=>[`${line.speaker}\u0000${line.text}`,line]));
const quietStart=(id:string)=>id==='reunion-reach'||id.endsWith('-hold')?2000:0;
// Same explicit full-target-ms conversion as story-contract. Keeping this pure
// module free of runtime TS imports also permits Node 24 asset verification.
function modeCues(node:StoryNode,mode:Mode):StoryNode['subtitles']{
  const ratio=mode==='full'?1:node.fullTiming.targetMs>0?node.guidedTiming.targetMs/node.fullTiming.targetMs:0;
  return (mode==='guided'?node.guidedSubtitles??node.subtitles:node.subtitles).map(cue=>({...cue,startMs:cue.startMs*ratio,endMs:cue.endMs*ratio}));
}

function schedule(id:StoryNode['id'],mode:Mode){
  const original=originalNodes.get(id),timings=catalog.timings[id];
  if(!original||!timings)throw new RangeError(`片段缺少配音编排：${id}`);
  if(original.kind==='terminal')return {slots:[] as {startMs:number;endMs:number}[],durationMs:0};
  const delay=quietStart(id),slots:{startMs:number;endMs:number}[]=[];
  let cursor=delay;
  for(const length of timings[mode]){
    if(!Number.isFinite(length)||length<=0)throw new RangeError(`配音时段无效：${id}/${mode}`);
    slots.push({startMs:cursor,endMs:cursor+length});cursor+=length;
  }
  // Keep the authored reading budget when it is longer than the measured takes.
  const originalDuration=(mode==='full'?original.fullTiming:original.guidedTiming).targetMs;
  const narrationEnd=Math.max(originalDuration,cursor);
  if(slots.length)slots[slots.length-1]!.endMs=narrationEnd;
  return {slots,durationMs:narrationEnd+(id==='curtain'?40000:0)};
}

/** Transient performance copy. The persisted story and all authored JSON remain unchanged.
 * Rebuild from fixed measured slots every time, making JSON-cloned adapted nodes idempotent. */
export function arrangeVoiceNode(node:StoryNode,version:StoryVersion):StoryNode {
  if(version!==5||node.kind==='terminal')return node;
  const full=schedule(node.id,'full'),guided=schedule(node.id,'guided');
  const fullDuration=Math.max(full.durationMs,guided.durationMs);
  if(fullDuration>full.durationMs&&full.slots.length&&node.id!=='curtain')full.slots[full.slots.length-1]!.endMs=fullDuration;
  const guideCues=node.guidedSubtitles??node.subtitles;
  if(full.slots.length!==node.subtitles.length||guided.slots.length!==guideCues.length)throw new RangeError(`台词与配音编排不一致：${node.id}`);
  const scale=guided.durationMs>0?fullDuration/guided.durationMs:0;
  return {...node,
    subtitles:node.subtitles.map((cue,index)=>({...cue,...full.slots[index]!})),
    guidedSubtitles:guideCues.map((cue,index)=>({...cue,startMs:guided.slots[index]!.startMs*scale,endMs:guided.slots[index]!.endMs*scale})),
    fullTiming:{targetMs:fullDuration,minDurationMs:node.id==='craft'?0:fullDuration},
    guidedTiming:{targetMs:guided.durationMs,minDurationMs:node.id==='craft'?0:guided.durationMs},
  };
}

/** The voice lookup uses the actual presented text, including choice-derived variants. */
export function voiceCuesForNode(node:StoryNode,mode:Mode,version:StoryVersion):VoiceCue[]{
  if(version!==5)return [];
  return modeCues(arrangeVoiceNode(node,version),mode).map(cue=>{
    const clip=clips.get(`${cue.speaker}\u0000${cue.text}`);
    if(!clip)throw new RangeError(`台词缺少配音：${node.id}/${cue.speaker}`);
    if(clip.durationMs>cue.endMs-cue.startMs+1)throw new RangeError(`配音超出台词时段：${node.id}/${clip.id}`);
    // Catalog paths identify public files; playback follows the document's
    // directory, matching Vite's relative base on subdirectory deployments.
    return {startMs:cue.startMs,endMs:cue.endMs,clip:{id:clip.id,src:`.${clip.src}`,durationMs:clip.durationMs}};
  });
}

/** Map measured narration time into the original full-target-ms visual choreography.
 * During the added curtain song the final authored pose stays on the screen. */
export function voiceVisualTime(id:StoryNode['id'],mode:Mode,elapsedMs:number):number {
  const original=originalNodes.get(id);
  if(!original)throw new RangeError(`未知配音片段：${id}`);
  const slots=schedule(id,mode).slots,source=mode==='guided'?original.guidedSubtitles??original.subtitles:original.subtitles;
  if(!slots.length||elapsedMs<=slots[0]!.startMs)return 0;
  for(let i=0;i<slots.length;i++){
    const slot=slots[i]!,cue=source[i]!;
    if(elapsedMs<slot.endMs){
      const fraction=Math.max(0,Math.min(1,(elapsedMs-slot.startMs)/(slot.endMs-slot.startMs)));
      return cue.startMs+(cue.endMs-cue.startMs)*fraction;
    }
  }
  return original.fullTiming.targetMs;
}

export function authoredVoiceNode(id:StoryNode['id']):StoryNode {
  const node=originalNodes.get(id);if(!node)throw new RangeError(`未知配音片段：${id}`);return node;
}
