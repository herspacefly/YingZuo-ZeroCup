import json from './stories/reunion-v1.json';
import expanded from './stories/reunion-v2.json';
import type { StoryDefinition } from '../domain/story-types';
import type { StoryProgress } from '../domain/types';
export const reunionDefinition = json as unknown as StoryDefinition;
export const expandedDefinition=expanded as unknown as StoryDefinition;
export function definitionFor(story:Pick<StoryProgress,'definitionVersion'>|null|undefined):StoryDefinition{
  if(!story||story.definitionVersion===2)return expandedDefinition;
  if(story.definitionVersion===1)return reunionDefinition;
  throw new Error('剧本版本不受支持，未替换原演出。');
}
export function endingFor(story:Pick<StoryProgress,'definitionVersion'|'ending'>|null|undefined){
  return story?.definitionVersion===2?expandedDefinition.endings!.find(item=>item.id===story.ending)??null:null;
}
