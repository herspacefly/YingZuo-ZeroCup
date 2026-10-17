import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/project-v1.json';
import { applyEditorCommand } from '../../src/app/commands';
import type { EditorCommand } from '../../src/app/commands';
import { ProjectStore } from '../../src/app/store';
import type { ProjectV1 } from '../../src/domain/types';
import { ProjectValidationError, validateProject } from '../../src/domain/validation';
import { serializeProject } from '../../src/domain/migrations';
import type { LoadResult, ProjectStorage, RawRecords } from '../../src/persistence/storage';

const fresh = () => validateProject(fixture);
const applyAll = (project: ProjectV1, commands: readonly EditorCommand[]) => commands.reduce(applyEditorCommand, project);
const fieldCommands: EditorCommand[] = [
  { type: 'CARVE_SEGMENT', index: 2, carved: true },
  { type: 'COLOR_SLOT', slot: 'body', colorIndex: 4 },
  { type: 'COLOR_SLOT', slot: 'sleeve', colorIndex: 3 },
  { type: 'COLOR_SLOT', slot: 'hem', colorIndex: 0 },
  { type: 'LAMP_X', lampX: -0.65 },
  { type: 'PUPPET_DISTANCE', puppetDistance: 0.35 },
  { type: 'PATTERN', patternId: 'flower-v1' },
];

describe('T05 field editor commands', () => {
  it('combines independent fields against the latest complete project and leaves the frozen story intact', () => {
    const original = fresh();
    const next = applyAll(original, fieldCommands);
    expect(next.appearance).toEqual({ templateId: 'chenxiang-v1', patternId: 'flower-v1', paletteId: 'indigo-v1',
      colorSlots: { body: 4, sleeve: 3, hem: 0 }, carvedSegments: [true, true, true] });
    expect(next.stage).toEqual({ backgroundId: 'plain-v1', lampX: -0.65, puppetDistance: 0.35 });
    expect(next.story).toEqual(original.story);
    expect(next.performance).toBeNull(); expect(next.partialRecording).toBeNull();
    expect(original).toEqual(fresh());
  });

  it('selects the next unfinished segment at execution time and preserves a completed carve', () => {
    const original = fresh(); original.appearance.carvedSegments = [false, false, false];
    const first = applyEditorCommand(original, { type: 'CARVE_NEXT' });
    const second = applyEditorCommand(first, { type: 'CARVE_NEXT' });
    const third = applyEditorCommand(second, { type: 'CARVE_NEXT' });
    expect(first.appearance.carvedSegments).toEqual([true, false, false]);
    expect(second.appearance.carvedSegments).toEqual([true, true, false]);
    expect(third.appearance.carvedSegments).toEqual([true, true, true]);
    expect(applyEditorCommand(third, { type: 'CARVE_NEXT' })).toEqual(third);
    expect(third.story).toEqual(original.story);
  });

  it('can reopen only the selected segment without reverting other craft fields', () => {
    const original = applyAll(fresh(), fieldCommands);
    const next = applyEditorCommand(original, { type: 'CARVE_SEGMENT', index: 1, carved: false });
    expect(next.appearance.carvedSegments).toEqual([true, false, true]);
    expect(next.appearance.colorSlots).toEqual(original.appearance.colorSlots);
    expect(next.stage).toEqual(original.stage);
  });

  it('applies a palette with default slots while the existing PALETTE command preserves custom slots', () => {
    const original = applyAll(fresh(), fieldCommands);
    const selected = applyEditorCommand(original, { type: 'PALETTE', paletteId: 'woodland-v1' });
    expect(selected.appearance.colorSlots).toEqual({ body: 4, sleeve: 3, hem: 0 });
    const applied = applyEditorCommand(original, { type: 'APPLY_PALETTE', paletteId: 'woodland-v1' });
    expect(applied.appearance.colorSlots).toEqual({ body: 0, sleeve: 1, hem: 2 });
    expect(applied.appearance.paletteId).toBe('woodland-v1');
    expect(applied.appearance.patternId).toBe(original.appearance.patternId);
    expect(applied.appearance.carvedSegments).toEqual(original.appearance.carvedSegments);
    expect(applied.story).toEqual(original.story);
  });

  it('clones the entire result and nested command inputs without sharing mutable references', () => {
    const original = fresh(); const replacement = fresh().appearance;
    const next = applyEditorCommand(original, { type: 'APPEARANCE', appearance: replacement });
    replacement.colorSlots.body = 4;
    next.appearance.carvedSegments[0] = false;
    next.story!.castSnapshot!.appearance.colorSlots.hem = 4;
    expect(original).toEqual(fresh());
    expect(next.appearance.colorSlots.body).toBe(0);
    expect(next.story).not.toBe(original.story);
  });

  it('accepts the validated numerical endpoints', () => {
    const next = applyAll(fresh(), [
      { type: 'LAMP_X', lampX: -0.8 }, { type: 'LAMP_X', lampX: 0.8 },
      { type: 'PUPPET_DISTANCE', puppetDistance: 0.05 }, { type: 'PUPPET_DISTANCE', puppetDistance: 0.4 },
      { type: 'COLOR_SLOT', slot: 'body', colorIndex: 0 }, { type: 'COLOR_SLOT', slot: 'hem', colorIndex: 4 },
    ]);
    expect(next.stage).toMatchObject({ lampX: 0.8, puppetDistance: 0.4 });
    expect(next.appearance.colorSlots).toEqual({ body: 0, sleeve: 1, hem: 4 });
  });

  it('rejects invalid segment indices and values before array assignment can silently drop them', () => {
    const original = fresh();
    for (const index of [-1, 3, 0.5, NaN, '0', 'length', '__proto__', null]) {
      expect(() => applyEditorCommand(original, { type: 'CARVE_SEGMENT', index, carved: true } as unknown as EditorCommand))
        .toThrow(ProjectValidationError);
    }
    for (const carved of [0, 1, 'false', null, undefined]) {
      expect(() => applyEditorCommand(original, { type: 'CARVE_SEGMENT', index: 0, carved } as unknown as EditorCommand))
        .toThrow(ProjectValidationError);
    }
    expect(original).toEqual(fresh());
  });

  it('rejects invalid color slots and non-integer or out-of-range colors', () => {
    const original = fresh();
    for (const slot of ['head', '', '__proto__', 'constructor', 0, null]) {
      expect(() => applyEditorCommand(original, { type: 'COLOR_SLOT', slot, colorIndex: 1 } as unknown as EditorCommand))
        .toThrow(ProjectValidationError);
    }
    for (const colorIndex of [-1, 5, 0.5, NaN, Infinity, '1', null, undefined]) {
      expect(() => applyEditorCommand(original, { type: 'COLOR_SLOT', slot: 'body', colorIndex } as unknown as EditorCommand))
        .toThrow(ProjectValidationError);
    }
    expect(original).toEqual(fresh());
  });

  it('rejects invalid light values and palette identifiers instead of clamping or coercing', () => {
    const original = fresh();
    const invalid: unknown[] = [
      ...[-0.81, 0.81, NaN, Infinity, '0', null, undefined].map(lampX => ({ type: 'LAMP_X', lampX })),
      ...[0.04, 0.41, NaN, Infinity, '0.2', null, undefined].map(puppetDistance => ({ type: 'PUPPET_DISTANCE', puppetDistance })),
      { type: 'APPLY_PALETTE', paletteId: 'missing-v1' },
    ];
    for (const command of invalid) {
      expect(() => applyEditorCommand(original, command as EditorCommand)).toThrow(ProjectValidationError);
    }
    expect(original).toEqual(fresh());
  });

  it('serializes rapidly queued field edits and CARVE_NEXT against the latest saved draft', async () => {
    let saved = fresh(); saved.appearance.carvedSegments = [false, false, false];
    const raw = async (): Promise<RawRecords> => ({ draft: serializeProject(saved), backup: undefined,
      previousProject: undefined, rawInvalid: undefined });
    const unused = async (): Promise<never> => { throw new Error('Unused storage method'); };
    const storage: Pick<ProjectStorage, 'load' | 'save' | 'replace' | 'promoteBackup' | 'startAfterCorruption' | 'readRaw' | 'close'> = {
      load: async (): Promise<LoadResult> => ({ kind: 'ready', project: validateProject(saved), backup: null, problem: null,
        records: await raw(), observation: { draftToken: 'test', backupToken: 'absent', rawInvalidToken: 'absent' } }),
      save: async project => { saved = validateProject({ ...project, saveRevision: saved.saveRevision + 1 }); return saved; },
      replace: unused, promoteBackup: unused, startAfterCorruption: unused, readRaw: raw, close: () => {},
    };
    const store = await ProjectStore.open(storage, { writerId: 'editor-test', createId: () => 'editor-test-project',
      now: () => '2026-10-17T00:00:00.000Z' });
    try {
      const commands: EditorCommand[] = [
        { type: 'CARVE_NEXT' }, ...fieldCommands.filter(command => command.type !== 'CARVE_SEGMENT'),
        { type: 'CARVE_NEXT' }, { type: 'CARVE_NEXT' }, { type: 'CARVE_NEXT' },
      ];
      await Promise.all(commands.map(command => store.edit(command)));
      await store.flush();
      expect(saved.appearance).toMatchObject({ carvedSegments: [true, true, true],
        colorSlots: { body: 4, sleeve: 3, hem: 0 }, patternId: 'flower-v1' });
      expect(saved.stage).toMatchObject({ lampX: -0.65, puppetDistance: 0.35 });
      expect(saved.story).toEqual(fresh().story);
      expect(store.getState().status).toBe('saved');
    } finally { store.dispose(); }
  });
});
