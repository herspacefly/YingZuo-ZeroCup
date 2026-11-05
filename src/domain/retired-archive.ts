import { MAX_PROJECT_BYTES, utf8Bytes } from './limits';
import { validateProject } from './validation';

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.getOwnPropertySymbols(value).length) return null;
  for (const key of Object.getOwnPropertyNames(value)) {
    const property = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in property) || !property.enumerable) return null;
  }
  return value as Record<string, unknown>;
}

/** Identifies an archive that may be discarded after confirmation; never loads or migrates its story. */
export function isRetiredProjectArchive(raw: unknown): boolean {
  try {
    if (typeof raw === 'string') {
      if (utf8Bytes(raw) > MAX_PROJECT_BYTES) return false;
      raw = JSON.parse(raw) as unknown;
    }
    const project = plainRecord(raw), story = plainRecord(project?.story);
    if (!project || !story || project.schemaVersion !== 1 || project.assetVersion !== 1 ||
        story.storyId !== 'reunion' || ![1, 2, 3, 4].includes(story.definitionVersion as number)) return false;
    const keys = ['storyId', 'definitionVersion', 'runId', 'revision', 'mode', 'nodeId', 'approach',
      'approachSource', 'castSnapshot', 'assistedNodeIds', 'presetAppearanceUsed', 'completedAt',
      ...(story.definitionVersion === 1 ? [] : ['ending', 'endingSource']),
      ...(Object.prototype.hasOwnProperty.call(story, 'skippedNodeIds') ? ['skippedNodeIds'] : [])];
    if (Object.keys(story).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(story, key))) return false;
    if (typeof story.nodeId !== 'string' || ![null, 'call-first', 'split-first'].includes(story.approach as null) ||
        ![null, 'user'].includes(story.approachSource as null) ||
        !(story.completedAt === null || typeof story.completedAt === 'string') ||
        (story.definitionVersion !== 1 && (![null, 'home', 'light', 'road', 'waiting', 'sacrifice'].includes(story.ending as null) ||
          ![null, 'user'].includes(story.endingSource as null)))) return false;
    for (const key of ['assistedNodeIds', ...(story.skippedNodeIds !== undefined ? ['skippedNodeIds'] : [])]) {
      const nodes = story[key];
      if (!Array.isArray(nodes) || nodes.some(node => typeof node !== 'string') ||
          Object.keys(nodes).length !== nodes.length) return false;
    }
    // A current-format probe validates every non-story field and the original frozen cast,
    // including nested asset/lamp versions. Its synthetic checkpoint is never returned or saved.
    const recording = project.performance !== null || project.partialRecording !== null;
    validateProject({ ...project, story: {
      storyId: 'reunion', definitionVersion: 5, runId: story.runId, revision: story.revision, mode: story.mode,
      nodeId: recording ? 'completed' : 'intro', approach: recording ? 'call-first' : null,
      approachSource: recording ? 'user' : null, castSnapshot: story.castSnapshot, assistedNodeIds: [],
      presetAppearanceUsed: story.presetAppearanceUsed, completedAt: recording ? project.savedAt : null,
      ending: recording ? 'home' : null, endingSource: recording ? 'choices' : null,
      choices: { journeyIntent: recording ? 'home' : null, mountainPact: recording ? 'shared' : null,
        finalAction: recording ? 'fulfill' : null },
    } });
    return utf8Bytes(JSON.stringify(project)) <= MAX_PROJECT_BYTES;
  } catch { return false; }
}
