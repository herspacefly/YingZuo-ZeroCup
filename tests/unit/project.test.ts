import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/project-v1.json';
import { defaultAppearance, defaultPose } from '../../src/domain/defaults';
import { MAX_PROJECT_BYTES, utf8Bytes } from '../../src/domain/limits';
import { parseProjectJSON, serializeProject } from '../../src/domain/migrations';
import { validateProject } from '../../src/domain/validation';
import { importProjectJSON, importedAsNew } from '../../src/persistence/project-file';

const project = () => validateProject(fixture);

describe('DATA-01/02/05 ProjectV1 serialization', () => {
  it('round-trips actual fixture and separates editor, frozen cast and input references', () => {
    const original = project();
    const restored = importProjectJSON(serializeProject(original));
    expect(restored).toEqual(original);
    restored.appearance.carvedSegments[0] = false;
    restored.appearance.colorSlots.body = 4;
    expect(restored.story!.castSnapshot!.appearance.carvedSegments).toEqual([true, true, true]);
    expect(original.appearance.colorSlots.body).toBe(0);
    expect(fixture.appearance.carvedSegments).toEqual([true, true, false]);
    expect(restored.performance).toBeNull(); expect(restored.partialRecording).toBeNull();
  });
  it('keeps project/run/choice IDs while importing a new editor project and rounds only saved poses', () => {
    const p = project(); p.pose.x = 0.123456789;
    const copy = importedAsNew(p, 'new-project', 'new-writer', p.savedAt);
    expect(copy.saveRevision).toBe(0); expect(copy.projectId).toBe('new-project');
    expect(copy.story).toEqual(p.story);
    expect(parseProjectJSON(serializeProject(copy)).pose.x).toBe(0.123457);
    expect(p.pose.x).toBe(0.123456789);
  });
  it.each([
    ['schema', (p: any) => { p.schemaVersion = 2; }],
    ['assets', (p: any) => { p.assetVersion = 2; }],
    ['definition', (p: any) => { p.story.definitionVersion = 4; }],
    ['cast assets', (p: any) => { p.story.castSnapshot.assetVersion = 2; }],
  ])('distinguishes unknown %s versions from corrupt data', (_, mutate) => {
    const p = project(); mutate(p);
    expect(() => validateProject(p)).toThrowError(expect.objectContaining({ code: 'unsupported-version' }));
  });
  it.each([null, 'damaged', {}, -1])('treats malformed version %j as corruption, not a future version', version => {
    expect(() => validateProject({ ...project(), schemaVersion: version })).toThrowError(expect.objectContaining({ code: 'invalid' }));
  });
  it.each([
    ['NaN', (p: any) => { p.pose.x = NaN; }],
    ['Infinity', (p: any) => { p.stage.lampX = Infinity; }],
    ['scale', (p: any) => { p.pose.scale = 0.59; }],
    ['joint', (p: any) => { p.pose.joints.head = 9; }],
    ['color index', (p: any) => { p.appearance.colorSlots.body = 1.5; }],
    ['distance', (p: any) => { p.stage.puppetDistance = 0.41; }],
    ['resource', (p: any) => { p.appearance.patternId = 'https://example.test/evil.svg'; }],
    ['node', (p: any) => { p.story.nodeId = 'unknown'; }],
    ['exhibit', (p: any) => { p.museum.visitedExhibitIds = ['E99']; }],
    ['route', (p: any) => { p.lastRoute = '/play/unsupported'; }],
    ['extra script', (p: any) => { p.script = 'alert(1)'; }],
    ['carving length', (p: any) => { p.appearance.carvedSegments.push(false); }],
    ['timestamp', (p: any) => { p.savedAt = '2026-02-31T00:00:00.000Z'; }],
  ])('rejects invalid %s without normalizing it away', (_, mutate) => {
    const p = project(); mutate(p);
    expect(() => validateProject(p)).toThrow();
  });
  it('rejects executable/hidden properties without invoking accessors or toJSON', () => {
    const p = project(); let called = false;
    Object.defineProperty(p.appearance.carvedSegments, 'toJSON', { value: () => { called = true; return [true]; } });
    expect(() => validateProject(p)).toThrow(); expect(called).toBe(false);
    const getter = project();
    Object.defineProperty(getter, 'title', { enumerable: true, get() { called = true; return 'x'; } });
    expect(() => validateProject(getter)).toThrow(); expect(called).toBe(false);
    const callback = project(); Object.assign(callback.pose.joints, { callback: () => 1 });
    expect(() => validateProject(callback)).toThrow();
  });
  it('enforces Unicode codepoint and actual UTF8 byte limits including boundary padding', () => {
    const p = project(); p.title = '影'.repeat(23) + '🏮';
    expect(validateProject(p).title).toBe(p.title);
    p.title += '灯'; expect(() => validateProject(p)).toThrow();
    const json = serializeProject(project());
    expect(utf8Bytes('影🏮')).toBe(7);
    const exact = json + ' '.repeat(MAX_PROJECT_BYTES - utf8Bytes(json));
    expect(parseProjectJSON(exact)).toEqual(project());
    expect(() => parseProjectJSON(exact + ' ')).toThrowError(expect.objectContaining({ code: 'too-large' }));
    expect(() => parseProjectJSON(json.replace('"x":0.5', '"x":1e999'))).toThrow();
  });
  it('deduplicates known exhibit and assistance lists without accepting unknown entries', () => {
    const p = project(); p.museum.visitedExhibitIds.push('E01'); p.story!.assistedNodeIds.push('road');
    const parsed = validateProject(p);
    expect(parsed.museum.visitedExhibitIds).toEqual(['E01', 'E04']);
    expect(parsed.story!.assistedNodeIds).toEqual(['memory-wave', 'road']);
  });
  it.each([
    ['missing cast', (p: any) => { p.story.castSnapshot = null; }],
    ['motif mismatch', (p: any) => { p.story.castSnapshot.sharedMotif = 'wave-v1'; }],
    ['wrong branch', (p: any) => { p.story.nodeId = 'split-axe'; }],
    ['silent decision', (p: any) => { p.story.approachSource = null; }],
    ['premature decision', (p: any) => { p.story.nodeId = 'approach-choice'; }],
    ['premature completion', (p: any) => { p.story.completedAt = p.savedAt; }],
    ['future assistance', (p: any) => { p.story.assistedNodeIds.push('reunion-reach'); }],
    ['cinematic assistance', (p: any) => { p.story.assistedNodeIds.push('training'); }],
  ])('rejects inconsistent story %s', (_, mutate) => {
    const p = project(); mutate(p); expect(() => validateProject(p)).toThrow();
  });
  it('accepts both routes, completed time at curtain and road assistance before training', () => {
    const p = project(); p.story!.nodeId = 'training'; p.story!.approach = null; p.story!.approachSource = null;
    expect(validateProject(p).story!.assistedNodeIds).toContain('road');
    p.story!.nodeId = 'split-search'; p.story!.approach = 'split-first'; p.story!.approachSource = 'user';
    expect(validateProject(p).story!.nodeId).toBe('split-search');
    p.story!.nodeId = 'curtain'; p.story!.completedAt = p.savedAt;
    expect(validateProject(p).story!.completedAt).toBe(p.savedAt);
    p.story!.nodeId = 'completed'; p.story!.assistedNodeIds.push('curtain');
    expect(validateProject(p).story!.assistedNodeIds).toContain('curtain');
  });
  it('round-trips optional frozen recording data without implementing a recorder', () => {
    const p = project(); p.story!.nodeId = 'completed'; p.story!.completedAt = p.savedAt;
    const recording = { sampleRate: 30 as const, frames: Array.from({ length: 60 }, () => defaultPose()),
      appearance: defaultAppearance(), stage: p.stage, presetId: null };
    p.performance = { ...recording, durationMs: 2000 };
    p.partialRecording = { ...recording, frames: [], paused: true };
    const restored = parseProjectJSON(serializeProject(p));
    expect(restored).toEqual(p);
    restored.appearance.colorSlots.body = 4;
    expect(restored.performance!.appearance.colorSlots.body).toBe(0);
    restored.performance!.durationMs = 1999;
    expect(() => validateProject(restored)).toThrow();
    p.performance.frames = Array.from({ length: 450 }, () => defaultPose()); p.performance.durationMs = 15000;
    expect(validateProject(p).performance!.frames).toHaveLength(450);
    p.partialRecording.frames = Array.from({ length: 450 }, () => defaultPose());
    expect(parseProjectJSON(serializeProject(p)).partialRecording).toMatchObject({ paused: true, sampleRate: 30 });
    const notPaused = validateProject(p); Object.assign(notPaused.partialRecording!, { paused: false });
    expect(() => validateProject(notPaused)).toThrow();
    p.partialRecording.frames = Array.from({ length: 451 }, () => defaultPose());
    expect(() => validateProject(p)).toThrow();
  });
});
