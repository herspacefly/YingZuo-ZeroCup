import type { Appearance, ExhibitId, PaletteId, PatternId, Pose, ProjectRoute, ProjectV1, StageConfig } from '../domain/types';
import { ProjectValidationError, validateProject } from '../domain/validation';

export type EditorCommand = { type: 'RENAME'; title: string } | { type: 'APPEARANCE'; appearance: Appearance } |
  { type: 'STAGE'; stage: StageConfig } | { type: 'POSE'; pose: Pose } |
  { type: 'PALETTE'; paletteId: PaletteId } | { type: 'PATTERN'; patternId: PatternId } |
  { type: 'CARVE_SEGMENT'; index: 0 | 1 | 2; carved: boolean } | { type: 'CARVE_NEXT' } |
  { type: 'COLOR_SLOT'; slot: 'body' | 'sleeve' | 'hem'; colorIndex: number } |
  { type: 'APPLY_PALETTE'; paletteId: PaletteId } |
  { type: 'LAMP_POSITION'; lampX: number; lampDepth: number } |
  { type: 'LAMP_X'; lampX: number } | { type: 'PUPPET_DISTANCE'; puppetDistance: number } |
  { type: 'VISIT'; exhibitId: ExhibitId } | { type: 'ROUTE'; route: ProjectRoute };

/** Editing never mutates the frozen cast or advances a story node. T15 adds guarded story commands. */
export function applyEditorCommand(project: ProjectV1, command: EditorCommand): ProjectV1 {
  const next = validateProject(project);
  switch (command.type) {
    case 'RENAME': next.title = command.title; break;
    case 'APPEARANCE': next.appearance = command.appearance; break;
    case 'PALETTE': next.appearance.paletteId = command.paletteId; break;
    case 'APPLY_PALETTE':
      next.appearance.paletteId = command.paletteId;
      next.appearance.colorSlots = { body: 0, sleeve: 1, hem: 2 }; break;
    case 'CARVE_SEGMENT':
      if (![0, 1, 2].includes(command.index) || typeof command.carved !== 'boolean') {
        throw new ProjectValidationError('invalid', 'carvedSegments：段索引或布尔值无效');
      }
      next.appearance.carvedSegments[command.index] = command.carved; break;
    case 'CARVE_NEXT': {
      const index = next.appearance.carvedSegments.indexOf(false);
      if (index !== -1) next.appearance.carvedSegments[index] = true;
      break;
    }
    case 'COLOR_SLOT':
      if (!['body', 'sleeve', 'hem'].includes(command.slot)) {
        throw new ProjectValidationError('invalid', 'colorSlots：部位无效');
      }
      next.appearance.colorSlots[command.slot] = command.colorIndex; break;
    case 'PATTERN': next.appearance.patternId = command.patternId; break;
    case 'STAGE': next.stage = command.stage; break;
    case 'LAMP_POSITION': next.stage.lampX = command.lampX; next.stage.lampGeometry = {version:1,depth:command.lampDepth}; break;
    case 'LAMP_X': next.stage.lampX = command.lampX; break;
    case 'PUPPET_DISTANCE': next.stage.puppetDistance = command.puppetDistance; break;
    case 'POSE': next.pose = command.pose; break;
    case 'VISIT': next.museum.visitedExhibitIds.push(command.exhibitId); break;
    case 'ROUTE': next.lastRoute = command.route; break;
  }
  return validateProject(next);
}
