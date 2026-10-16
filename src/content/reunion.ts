import json from './stories/reunion-v1.json';
import type { StoryDefinition } from '../domain/story-types';
export const reunionDefinition = json as unknown as StoryDefinition;
