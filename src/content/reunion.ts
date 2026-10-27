import json from './stories/reunion-v1.json';
import expanded from './stories/reunion-v2.json';
import literary from './stories/reunion-v3.json';
import lamplit from './stories/reunion-v4.json';
import choices from './stories/reunion-v5.json' with {type:'json'};
import type { StoryDefinition } from '../domain/story-types';
import type { StoryProgress } from '../domain/types';
export const reunionDefinition = json as unknown as StoryDefinition;
export const expandedDefinition=expanded as unknown as StoryDefinition;
export const literaryDefinition=literary as unknown as StoryDefinition;
export const lamplitDefinition=lamplit as unknown as StoryDefinition;
export const choiceDefinition=choices as unknown as StoryDefinition;
export function definitionFor(story:Pick<StoryProgress,'definitionVersion'>|null|undefined):StoryDefinition{
  if(!story||story.definitionVersion===5)return choiceDefinition;
  if(story.definitionVersion===4)return lamplitDefinition;
  if(story.definitionVersion===3)return literaryDefinition;
  if(story.definitionVersion===2)return expandedDefinition;
  if(story.definitionVersion===1)return reunionDefinition;
  throw new Error('剧本版本不受支持，未替换原演出。');
}
export function endingFor(story:Pick<StoryProgress,'definitionVersion'|'ending'>|null|undefined){
  return story&&story.definitionVersion!==1?definitionFor(story).endings!.find(item=>item.id===story.ending)??null:null;
}
