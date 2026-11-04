import type { Approach, EndingId, StoryNodeId, StoryVersion } from './types';

export const ENDING_IDS:readonly EndingId[]=['home','light','road','waiting','sacrifice'];
export const endingHoldNode:Record<EndingId,StoryNodeId>={home:'reunion-hold',light:'ending-light-hold',road:'ending-road-hold',waiting:'ending-waiting-hold',sacrifice:'ending-sacrifice-hold'};
export function storyPrefix(_version:StoryVersion):StoryNodeId[]{
  return ['intro','craft','memory-wave','memory-words','memory-separate','road','road-rest','journey-choice','training','guardian','guardian-parley','mountain-pact-choice','approach-choice'];
}
/** Stable persisted path; no renderer, clock or runtime input is part of it. */
export function storyPath(version:StoryVersion,approach:Approach|null,ending:EndingId|null=null):StoryNodeId[]{
  const branch:StoryNodeId[]=approach==='split-first'?['split-axe','split-search','split-response']:['call-light','call-response','call-split'];
  const prefix:StoryNodeId[]=[...storyPrefix(version),...branch,'mountain-listen','ending-choice'];
  if(!ending)return prefix;
  const final:Record<EndingId,StoryNodeId[]>={home:['reunion-reach','reunion-hold','ending-home-epilogue'],
    light:['ending-light-place','ending-light-hold','ending-light-epilogue'],road:['ending-road-walk','ending-road-hold','ending-road-epilogue'],waiting:['ending-waiting-light','ending-waiting-hold','ending-waiting-epilogue'],sacrifice:['ending-sacrifice-axe','ending-sacrifice-hold','ending-sacrifice-epilogue']};
  return [...prefix,...final[ending],'curtain','completed'];
}
