import json from './stories/reunion.json' with {type:'json'};
import type { StoryDefinition } from '../domain/story-types';
import type { StoryProgress } from '../domain/types';

/** One authored story. Its persisted identity is a data contract, not a product edition. */
export const reunionDefinition = json as unknown as StoryDefinition;
export const choiceDefinition = reunionDefinition;
export const CURRENT_STORY_VERSION = reunionDefinition.definitionVersion;
export function definitionFor(story:Pick<StoryProgress,'definitionVersion'>|null|undefined):StoryDefinition{
  if(story&&story.definitionVersion!==CURRENT_STORY_VERSION)throw new Error('这份演出记录已不再支持，请先导出原始数据，再重新开始。');
  return reunionDefinition;
}
export function endingFor(story:Pick<StoryProgress,'definitionVersion'|'ending'>|null|undefined){
  return story?definitionFor(story).endings!.find(item=>item.id===story.ending)??null:null;
}
