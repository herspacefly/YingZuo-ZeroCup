import { append, element, link } from '../shared/dom';
import { continueHash, heading, paletteLabel, patternLabel, pendingNote } from '../shared/pieces';
import { reunionSummary } from '../../domain/story';
import { reunionDefinition } from '../../content/reunion';
import type { PageFactory } from '../../app/view';
export const mountResult: PageFactory = host => {
  const head = heading('本场节目单', '这一场，还在路上。', '团圆之后，属于这一场的造型、选择与协作会在这里留下。'); host.appendChild(head);
  const programme = element('section', 'programme'), title = element('h2'), details = element('dl', 'programme-list'), resume = link('回到这一场 →', '#/story', 'button primary');
  append(programme, title, details, resume, pendingNote('团圆留影与按编排重演正在排演；这里不会把未完成的演出写成已团圆。')); host.appendChild(programme);
  return { update(state) {
    const result = state.project ? reunionSummary(state.project) : null; title.textContent = result ? '一幕团圆 · 本场已团圆' : '先把这一场，慢慢演完。';
    resume.href = continueHash(state.project); while (details.firstChild) details.removeChild(details.firstChild);
    const rows = result ? [
      ['纹样', patternLabel(result.castSnapshot.appearance.patternId)], ['配色', paletteLabel(result.castSnapshot.appearance.paletteId)],
      ['这一次的选择', result.approach === 'call-first' ? '先举灯呼唤' : '先挥斧开山'], ['造型来源', result.presetAppearanceUsed ? '采用默认影偶' : '使用已编辑的造型'],
      ['使用协助的片段', result.assistedNodeIds.length ? result.assistedNodeIds.map(id => reunionDefinition.nodes.find(n => n.id === id)!.title).join('、') : '未记录协助'],
      ['谢幕', state.project?.story?.nodeId === 'completed' ? '已经看完' : '团圆已保存，谢幕尚未结束'],
    ] : [['当前进度', state.project?.story ? reunionDefinition.nodes.find(n => n.id === state.project!.story!.nodeId)!.title : '尚未开演']];
    for (const [label, value] of rows) append(details, element('dt', '', label), element('dd', '', value));
    const h1 = head.querySelector('h1')!; h1.textContent = result ? '这一回，终于相见。' : '这一场，还在路上。';
  }, dispose() {} };
};
