import type { StoryNode } from '../domain/story-types';
/** Serializable transient drawing cues; never part of a saved project. */
export interface SpatialPresentation {nodeId:string;progress:number;light:number;reducedMotion:boolean;ending:string|null;backstage:boolean}
export function spatialPresentation(node:StoryNode,progress:number,light:number,reducedMotion:boolean):SpatialPresentation{
  const p=Math.max(0,Math.min(1,progress));
  return {nodeId:node.id,progress:reducedMotion?Math.floor(p*4)/4:p,light:Math.max(0,Math.min(1,light)),reducedMotion,ending:node.prerequisites.ending??null,backstage:node.id==='curtain'&&p>=.4};
}
