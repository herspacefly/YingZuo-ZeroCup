import type { Approach, EndingId, StoryNodeId } from './types';

export const ENDING_IDS:readonly EndingId[]=['home','light','road','waiting','sacrifice'];
export const endingHoldNode:Record<EndingId,StoryNodeId>={home:'reunion-hold',light:'ending-light-hold',road:'ending-road-hold',waiting:'ending-waiting-hold',sacrifice:'ending-sacrifice-hold'};
export function storyPrefix(version:1|2|3|4):StoryNodeId[]{
  return version===1?['intro','craft','memory-wave','memory-separate','road','training','guardian','approach-choice']:
    ['intro','craft','memory-wave','memory-words','memory-separate','road','road-rest','training','guardian','guardian-parley','approach-choice'];
}
/** Stable persisted path; no renderer, clock or runtime input is part of it. */
export function storyPath(version:1|2|3|4,approach:Approach|null,ending:EndingId|null=null):StoryNodeId[]{
  const branch:StoryNodeId[]=approach==='split-first'?['split-axe','split-search','split-response']:['call-light','call-response','call-split'];
  if(version===1)return [...storyPrefix(1),...branch,'reunion-reach','reunion-hold','curtain','completed'];
  const prefix:StoryNodeId[]=[...storyPrefix(2),...branch,'mountain-listen','ending-choice'];
  if(!ending)return prefix;
  const final:Record<EndingId,StoryNodeId[]>={home:['reunion-reach','reunion-hold','ending-home-epilogue'],
    light:['ending-light-place','ending-light-hold','ending-light-epilogue'],road:['ending-road-walk','ending-road-hold','ending-road-epilogue'],waiting:['ending-waiting-light','ending-waiting-hold','ending-waiting-epilogue'],sacrifice:['ending-sacrifice-axe','ending-sacrifice-hold','ending-sacrifice-epilogue']};
  return [...prefix,...final[ending],'curtain','completed'];
}
