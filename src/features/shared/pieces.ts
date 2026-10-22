import { append, element, link } from './dom';
import type { StoreState } from '../../app/store';
import type { ProjectV1 } from '../../domain/types';
import palettes from '../../content/palettes.json';
import patterns from '../../content/patterns.json';

export const paletteLabel = (id: string) => palettes.palettes.find(p => p.id === id)?.label ?? '未识别配色';
export const patternLabel = (id: string) => patterns.patterns.find(p => p.id === id)?.label ?? '未识别纹样';
export const editable = (state: StoreState) => !!state.project && !['loading', 'closed', 'unsupported', 'recovery', 'conflict'].includes(state.status);
export const advancing = (state: StoreState) => editable(state) && !state.hasPending && state.status !== 'saving';
export const continueHash = (project: ProjectV1 | null) => project?.story?.nodeId === 'craft' && project.story.definitionVersion!==3 ? '#/craft' : '#/story';
export function heading(eyebrow: string, title: string, lead: string) {
  const head = element('div', 'page-heading'); append(head, element('p', 'eyebrow', eyebrow), element('h1', '', title), element('p', 'page-lead', lead)); return head;
}
/** A shared scenic shell, not a puppet renderer; T04 replaces its inner mount. */
export function stageFrame(label = '灯已备好，静候开场。', caption = '幕面与角色正在排演，可先阅读故事。') {
  const figure = element('figure', 'stage-figure');
  const frame = element('div', 'stage-frame'); frame.setAttribute('aria-hidden', 'true');
  append(frame, element('span', 'stage-rail top'), element('span', 'stage-light'), element('span', 'mountain mountain-back'), element('span', 'mountain mountain-front'), element('span', 'stage-poem', label), element('span', 'stage-rail bottom'));
  append(figure, frame, element('figcaption', 'stage-caption', caption)); return figure;
}
export function pageLinks() {
  const nav = element('nav', 'page-trail'); nav.setAttribute('aria-label', '这一场的去处');
  append(nav, link('制偶', '#/craft'), link('灯影', '#/light'), link('剧场', '#/story'), link('练习', '#/practice')); return nav;
}
export function pendingNote(text: string) { const p = element('p', 'pending-note', text); return p; }
