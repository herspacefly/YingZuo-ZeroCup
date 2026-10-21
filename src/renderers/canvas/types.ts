import type { RenderActor } from '../../content/asset-types';
import type { StageConfig } from '../../domain/types';

/** Transient, serializable drawing input; never an alternative story state. */
export interface CanvasFrame {
  spatial?: import('../../story/spatial-presentation').SpatialPresentation;
  actors: RenderActor[];
  stage: StageConfig;
  sceneLayers?: { id: string; x: number; y: number; opacity: number }[];
  attachments?: { actorId: RenderActor['actorId']; attachmentId: string }[];
  showRods?: boolean;
  /** Transient staging fade; actor geometry/assets remain present and preloaded. */
  actorOpacity?: Partial<Record<RenderActor['actorId'],number>>;
}
export type CanvasStatus = { state: 'loading' | 'ready' | 'error'; message: string };
