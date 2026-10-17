import type { StoryGuard } from '../../domain/story-types';
/** The explicit skip button has exactly one possible destination, enforced again by the reducer. */
export function introSkipCommand(guard:StoryGuard) {
  if(guard.expectedNodeId!=='intro')throw new Error('只有序幕可以跳过。');
  return {...guard,action:'COMPLETE_SCENE' as const,source:'user' as const,skipped:true as const};
}
