import { assetCatalog } from '../../content/catalog';
import { defaultAppearance, defaultPose } from '../../domain/defaults';
import { constrainPoseToStage } from '../../domain/pose';
import type { Appearance, ProjectV1 } from '../../domain/types';
import type { CanvasFrame } from '../../renderers/canvas/types';

export const cloneMuseumAppearance = (appearance: Appearance): Appearance => ({ ...appearance,
  colorSlots: { ...appearance.colorSlots }, carvedSegments: [...appearance.carvedSegments] });

/** A neutral display of the frozen cast, or a default example before freezing. Never reads the edit draft. */
export function museumPreviewFrame(project: ProjectV1 | null): CanvasFrame {
  const appearance = cloneMuseumAppearance(project?.story?.castSnapshot?.appearance ?? defaultAppearance());
  const stage = { backgroundId: 'plain-v1' as const, lampX: 0, puppetDistance: .2 };
  const template = assetCatalog.puppets.find(item => item.id === 'chenxiang-v1')!;
  const fit = constrainPoseToStage(defaultPose(), template, stage);
  if (!fit.fits) throw new Error('示例影偶暂时无法放入幕面，请重试。');
  return { actors: [{ actorId: 'chenxiang', templateId: 'chenxiang-v1', costumeTreatment:'original-texture', appearance, pose: fit.pose }], stage, attachments: [] };
}
