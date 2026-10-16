import { beginStory, reduceStory } from '../domain/story';
import type { StoryCommand, StoryContext } from '../domain/story-types';
import { reunionDefinition } from '../content/reunion';
import type { ProjectStore } from './store';

export function startStory(store: ProjectStore,runId: string,mode: 'full'|'guided') {
  return store.commit(project=>beginStory(project,runId,mode));
}
export function submitStoryCommand(store: ProjectStore,command: StoryCommand,context: StoryContext) {
  // Snapshot the external command/context once. Retries use Store.pending, not this reducer.
  const action=JSON.parse(JSON.stringify(command)) as StoryCommand;
  const observation={...context};
  return store.commit(project=>reduceStory(project,action,observation,reunionDefinition));
}
