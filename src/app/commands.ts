import type { Appearance, ExhibitId, PaletteId, PatternId, Pose, ProjectRoute, ProjectV1, StageConfig } from '../domain/types';
import { validateProject } from '../domain/validation';

export type EditorCommand = { type: 'RENAME'; title: string } | { type: 'APPEARANCE'; appearance: Appearance } |
  { type: 'STAGE'; stage: StageConfig } | { type: 'POSE'; pose: Pose } |
  { type: 'PALETTE'; paletteId: PaletteId } | { type: 'PATTERN'; patternId: PatternId } |
  { type: 'VISIT'; exhibitId: ExhibitId } | { type: 'ROUTE'; route: ProjectRoute };

/** Editing never mutates the frozen cast or advances a story node. T15 adds guarded story commands. */
export function applyEditorCommand(project: ProjectV1, command: EditorCommand): ProjectV1 {
  const next = validateProject(project);
  switch (command.type) {
    case 'RENAME': next.title = command.title; break;
    case 'APPEARANCE': next.appearance = command.appearance; break;
    case 'PALETTE': next.appearance.paletteId = command.paletteId; break;
    case 'PATTERN': next.appearance.patternId = command.patternId; break;
    case 'STAGE': next.stage = command.stage; break;
    case 'POSE': next.pose = command.pose; break;
    case 'VISIT': next.museum.visitedExhibitIds.push(command.exhibitId); break;
    case 'ROUTE': next.lastRoute = command.route; break;
  }
  return validateProject(next);
}
