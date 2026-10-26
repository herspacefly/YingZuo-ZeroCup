import { ASSISTABLE_NODES, BACKGROUND_IDS, EXHIBIT_IDS, EXPANDED_STORY_NODE_IDS, CHOICE_STORY_NODE_IDS, JOINT_IDS, MAX_JOINT_ANGLE, MAX_PROJECT_BYTES,
  MAX_TITLE_CODEPOINTS, PALETTE_IDS, PATTERN_IDS, PRESET_IDS, PROJECT_ROUTES, STORY_NODE_IDS, utf8Bytes } from './limits';
import type { EndingId, ProjectV1, StoryVersion, StoryChoices, Approach } from './types';
import { resolveEnding } from './story-choices';
import { ENDING_IDS, storyPath, storyPrefix } from './story-path';

export class ProjectValidationError extends Error {
  constructor(readonly code: 'invalid' | 'unsupported-version' | 'too-large', message: string) {
    super(message); this.name = 'ProjectValidationError';
  }
}
function invalid(path: string, reason: string): never { throw new ProjectValidationError('invalid', `${path}：${reason}`); }
function record(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid(path, '必须是普通对象');
  const object = value as Record<string, unknown>;
  if (Object.keys(object).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(object, key)) ||
      Object.keys(object).some(key => !keys.includes(key))) invalid(path, '字段缺失或包含未知字段');
  return object;
}
function version(value: unknown, expected: number, path: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) invalid(path, '版本字段损坏');
  if (value !== expected) throw new ProjectValidationError('unsupported-version', `${path} 版本不受支持，原始数据必须保留。`);
}
function choice(value: unknown, choices: readonly unknown[], path: string) {
  if (!choices.includes(value)) invalid(path, '不在允许的资源或枚举范围内');
}
function number(value: unknown, min: number, max: number, path: string, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
    (integer && !Number.isSafeInteger(value))) invalid(path, '数值越界或无效');
}
function text(value: unknown, min: number, max: number, path: string) {
  if (typeof value !== 'string' || Array.from(value).length < min || Array.from(value).length > max) invalid(path, '文字长度无效');
}
function id(value: unknown, path: string) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) invalid(path, '标识格式无效');
}
function date(value: unknown, path: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) invalid(path, '必须是有效的 UTC ISO 时间');
}
function bool(value: unknown, path: string) { if (typeof value !== 'boolean') invalid(path, '必须是布尔值'); }
function list(value: unknown, max: number, path: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid(path, '列表长度无效');
  for (let i = 0; i < value.length; i++) if (!(i in value)) invalid(path, '列表不能有空位');
  return value;
}
function appearance(value: unknown, path: string) {
  const a = record(value, ['templateId', 'patternId', 'paletteId', 'colorSlots', 'carvedSegments'], path);
  choice(a.templateId, ['chenxiang-v1'], `${path}.templateId`);
  choice(a.patternId, PATTERN_IDS, `${path}.patternId`);
  choice(a.paletteId, PALETTE_IDS, `${path}.paletteId`);
  const slots = record(a.colorSlots, ['body', 'sleeve', 'hem'], `${path}.colorSlots`);
  for (const key of ['body', 'sleeve', 'hem']) number(slots[key], 0, 4, `${path}.${key}`, true);
  const segments = list(a.carvedSegments, 3, `${path}.carvedSegments`);
  if (segments.length !== 3) invalid(path, '雕刻段必须恰好三段');
  segments.forEach(segment => bool(segment, `${path}.carvedSegments`));
}
function stage(value: unknown, path: string) {
  const optional = !!value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'lampGeometry');
  const s = record(value, ['backgroundId', 'lampX', 'puppetDistance', ...(optional ? ['lampGeometry'] : [])], path);
  choice(s.backgroundId, BACKGROUND_IDS, `${path}.backgroundId`);
  number(s.lampX, -0.8, 0.8, `${path}.lampX`);
  number(s.puppetDistance, 0.05, 0.4, `${path}.puppetDistance`);
  if (optional) {
    const lamp = record(s.lampGeometry, ['version', 'depth'], `${path}.lampGeometry`);
    version(lamp.version, 1, `${path}.lampGeometry.version`);
    number(lamp.depth, Math.max(.6, Math.round(3 * (s.puppetDistance as number) * 1e6) / 1e6), 2.4, `${path}.lampGeometry.depth`);
  }
}
function pose(value: unknown, path: string) {
  const p = record(value, ['x', 'y', 'scale', 'facing', 'joints'], path);
  number(p.x, 0, 1, `${path}.x`); number(p.y, 0, 1, `${path}.y`);
  number(p.scale, 0.6, 1, `${path}.scale`); choice(p.facing, [1, -1], `${path}.facing`);
  const joints = record(p.joints, JOINT_IDS, `${path}.joints`);
  JOINT_IDS.forEach(key => number(joints[key], -MAX_JOINT_ANGLE, MAX_JOINT_ANGLE, `${path}.joints.${key}`));
}
function story(value: unknown) {
  const choiceDriven=ownValue(value,'definitionVersion')===5;
  const expanded=[2,3,4,5].includes(ownValue(value,'definitionVersion') as number);
  const s = record(value, ['storyId', 'definitionVersion', 'runId', 'revision', 'mode', 'nodeId', 'approach',
    'approachSource', 'castSnapshot', 'assistedNodeIds', 'presetAppearanceUsed', 'completedAt',...(expanded?['ending','endingSource']:[]),...(choiceDriven?['choices']:[]),...(ownValue(value,'skippedNodeIds')!==undefined?['skippedNodeIds']:[])], 'story');
  if(!expanded)version(s.definitionVersion, 1, 'story.definitionVersion');
  choice(s.storyId, ['reunion'], 'story.storyId'); id(s.runId, 'story.runId');
  number(s.revision, 0, Number.MAX_SAFE_INTEGER, 'story.revision', true);
  choice(s.mode, ['full', 'guided'], 'story.mode'); choice(s.nodeId, choiceDriven?CHOICE_STORY_NODE_IDS:expanded?EXPANDED_STORY_NODE_IDS:STORY_NODE_IDS, 'story.nodeId');
  choice(s.approach, [null, 'call-first', 'split-first'], 'story.approach');
  choice(s.approachSource, [null, 'user'], 'story.approachSource'); bool(s.presetAppearanceUsed, 'story.presetAppearanceUsed');
  if (s.castSnapshot !== null) {
    const cast = record(s.castSnapshot, ['appearance', 'sharedMotif', 'motherPaletteId', 'guardianPaletteId', 'assetVersion'], 'castSnapshot');
    version(cast.assetVersion, 1, 'castSnapshot.assetVersion'); appearance(cast.appearance, 'castSnapshot.appearance');
    choice(cast.motherPaletteId, ['mother-v1'], 'castSnapshot.motherPaletteId');
    choice(cast.guardianPaletteId, ['guardian-v1'], 'castSnapshot.guardianPaletteId');
    if (cast.sharedMotif !== (cast.appearance as Record<string, unknown>).patternId) invalid('castSnapshot.sharedMotif', '必须与冻结纹样一致');
  } else if (s.nodeId !== 'intro' && s.nodeId !== 'craft') invalid('story.castSnapshot', '开演后必须有冻结角色');
  if(expanded){choice(s.ending,[null,...ENDING_IDS],'story.ending');choice(s.endingSource,[null,choiceDriven?'choices':'user'],'story.endingSource');}
  const prefix=storyPrefix(s.definitionVersion as StoryVersion),path=storyPath(s.definitionVersion as StoryVersion,s.approach as Approach|null,expanded?s.ending as EndingId|null:null);
  const index = path.indexOf(s.nodeId as typeof path[number]);
  if (index < 0) invalid('story.nodeId', '节点与所选路径不一致');
  if (index < prefix.length) {
    if (s.approach !== null || s.approachSource !== null) invalid('story.approach', '选择前不能已有路线');
  } else if (s.approach === null || s.approachSource !== 'user') invalid('story.approach', '分支及团圆必须保留用户确认');
  if(expanded){
    const choiceIndex=path.indexOf('ending-choice');
    if(index<=choiceIndex){if(s.ending!==null||s.endingSource!==null)invalid('story.ending','终章抉择前不能已有结局');}
    else if(s.ending===null||s.endingSource!==(choiceDriven?'choices':'user'))invalid('story.ending','终章必须保留本场决定的来源');
  }
  if(choiceDriven){
    const decisions=record(s.choices,['journeyIntent','mountainPact','finalAction'],'story.choices');
    choice(decisions.journeyIntent,[null,'home','open-road'],'story.choices.journeyIntent');
    choice(decisions.mountainPact,[null,'shared','self'],'story.choices.mountainPact');
    choice(decisions.finalAction,[null,'wait','fulfill'],'story.choices.finalAction');
    for(const [key,nodeId]of [['journeyIntent','journey-choice'],['mountainPact','mountain-pact-choice'],['finalAction','ending-choice']] as const){
      const passed=index>path.indexOf(nodeId);
      if(passed?decisions[key]===null:decisions[key]!==null)invalid('story.choices.'+key,'选择必须与当前检查点一致');
    }
    const chosen=decisions as unknown as StoryChoices;
    if(s.ending!==null&&s.ending!==resolveEnding(chosen.journeyIntent!,chosen.mountainPact!,s.approach as Approach,chosen.finalAction!))invalid('story.ending','终章与本场四次决定不一致');
  }
  const assisted = list(s.assistedNodeIds, expanded?EXPANDED_STORY_NODE_IDS.length:STORY_NODE_IDS.length, 'story.assistedNodeIds');
  for (const node of assisted) {
    choice(node, ASSISTABLE_NODES, 'story.assistedNodeIds');
    const assistedIndex = path.indexOf(node as typeof path[number]);
    if (assistedIndex < 0 || assistedIndex >= index) invalid('story.assistedNodeIds', '只能包含本路径已完成且可协助的节点');
  }
  if(s.skippedNodeIds!==undefined){for(const skipped of list(s.skippedNodeIds,CHOICE_STORY_NODE_IDS.length,'story.skippedNodeIds')){const i=path.indexOf(skipped as typeof path[number]);if(i<0||i>=index||['craft','journey-choice','mountain-pact-choice','approach-choice','ending-choice','completed'].includes(String(skipped))||assisted.includes(skipped))invalid('story.skippedNodeIds','只能记录本路径已明确跳过的普通片段');}}
  if (s.nodeId === 'curtain' || s.nodeId === 'completed') date(s.completedAt, 'story.completedAt');
  else if (s.completedAt !== null) invalid('story.completedAt', '只在进入谢幕时生成完成时间');
}
function recording(value: unknown, partial: boolean) {
  const path = partial ? 'partialRecording' : 'performance';
  const r = record(value, ['sampleRate', 'frames', 'appearance', 'stage', 'presetId', partial ? 'paused' : 'durationMs'], path);
  choice(r.sampleRate, [30], `${path}.sampleRate`); appearance(r.appearance, `${path}.appearance`); stage(r.stage, `${path}.stage`);
  if (r.presetId !== null) choice(r.presetId, PRESET_IDS, `${path}.presetId`);
  const frames = list(r.frames, 450, `${path}.frames`);
  if (!partial && frames.length < 60) invalid(path, '完整片段至少 60 帧');
  frames.forEach((frame, index) => pose(frame, `${path}.frames[${index}]`));
  if (partial) choice(r.paused, [true], `${path}.paused`);
  else if (typeof r.durationMs !== 'number' || !Number.isFinite(r.durationMs) || Math.abs(r.durationMs - frames.length / 30 * 1000) > 0.000001) {
    invalid(`${path}.durationMs`, '时长必须与 30 Hz 帧数一致');
  }
}

/** Validates every field before cloning; NaN/functions/unknown objects cannot disappear through stringify. */
function assertPlainData(value: unknown, ancestors = new Set<object>(), depth = 0): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object' || depth > 24 || ancestors.has(value)) invalid('project', '只允许无循环的有限 JSON 数据');
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) invalid('project', '不能包含运行时对象');
  if (Object.getOwnPropertySymbols(value).length) invalid('project', '不能包含 Symbol 字段');
  ancestors.add(value);
  const names = Object.getOwnPropertyNames(value);
  for (const name of names) {
    if (array && name === 'length') continue;
    const property = Object.getOwnPropertyDescriptor(value, name)!;
    if (!('value' in property) || !property.enumerable) invalid('project', '不能包含访问器或隐藏字段');
    if (array && (!/^(0|[1-9]\d*)$/.test(name) || Number(name) >= value.length)) invalid('project', '列表不能附带额外属性或序列化钩子');
    assertPlainData(property.value, ancestors, depth + 1);
  }
  ancestors.delete(value);
}
function ownValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}
function detectFutureVersion(value: unknown, path: string) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value !== 1) version(value, 1, path);
}

export function validateProject(input: unknown): ProjectV1 {
  // Detect future version signals before ordinary corruption so recovery never downgrades unknown data.
  if (input && typeof input === 'object') {
    for (const key of ['schemaVersion', 'assetVersion']) detectFutureVersion(ownValue(input, key), key);
    const s = ownValue(input, 'story');
    const storyVersion=ownValue(s,'definitionVersion');
    if(storyVersion!==2&&storyVersion!==3&&storyVersion!==4&&storyVersion!==5)detectFutureVersion(storyVersion, 'story.definitionVersion');
    detectFutureVersion(ownValue(ownValue(s, 'castSnapshot'), 'assetVersion'), 'castSnapshot.assetVersion');
  }
  assertPlainData(input);
  const p = record(input, ['schemaVersion', 'assetVersion', 'appVersion', 'projectId', 'title', 'savedAt', 'saveRevision',
    'writerId', 'appearance', 'stage', 'pose', 'story', 'museum', 'performance', 'partialRecording', 'lastRoute'], 'project');
  version(p.schemaVersion, 1, 'schemaVersion'); version(p.assetVersion, 1, 'assetVersion');
  if (typeof p.appVersion !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(p.appVersion) || p.appVersion.length > 32) invalid('appVersion', '应用版本格式无效');
  id(p.projectId, 'projectId'); id(p.writerId, 'writerId'); text(p.title, 0, MAX_TITLE_CODEPOINTS, 'title'); date(p.savedAt, 'savedAt');
  number(p.saveRevision, 0, Number.MAX_SAFE_INTEGER, 'saveRevision', true);
  appearance(p.appearance, 'appearance'); stage(p.stage, 'stage'); pose(p.pose, 'pose');
  if (p.story !== null) story(p.story);
  const museum = record(p.museum, ['visitedExhibitIds'], 'museum');
  const exhibits = list(museum.visitedExhibitIds, 64, 'museum.visitedExhibitIds');
  exhibits.forEach(exhibit => choice(exhibit, EXHIBIT_IDS, 'museum.visitedExhibitIds'));
  choice(p.lastRoute, PROJECT_ROUTES, 'lastRoute');
  if (p.performance !== null) recording(p.performance, false);
  if (p.partialRecording !== null) recording(p.partialRecording, true);
  if ((p.performance !== null || p.partialRecording !== null) && (p.story as Record<string, unknown> | null)?.nodeId !== 'completed') {
    invalid('performance', '独立单偶短片只属于已谢幕项目');
  }
  const json = JSON.stringify(p);
  if (utf8Bytes(json) > MAX_PROJECT_BYTES) throw new ProjectValidationError('too-large', '项目超过 512 KiB，未写入。');
  const result = JSON.parse(json) as ProjectV1;
  result.museum.visitedExhibitIds = [...new Set(result.museum.visitedExhibitIds)];
  if (result.story) {result.story.assistedNodeIds = [...new Set(result.story.assistedNodeIds)];if(result.story.skippedNodeIds)result.story.skippedNodeIds=[...new Set(result.story.skippedNodeIds)];}
  return result;
}
