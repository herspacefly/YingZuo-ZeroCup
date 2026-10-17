import { append, element, link } from '../shared/dom';
import { heading, pageLinks, pendingNote, stageFrame } from '../shared/pieces';
import type { PageFactory } from '../../app/view';
export const mountPractice: PageFactory = host => {
  append(host, heading('幕后一双手', '把手放慢，等影偶回应。', '身杆带着身体，手杆牵动手臂。练习台将从这里开始。'), pageLinks());
  const layout = element('section', 'workspace'), panel = element('div', 'control-panel');
  append(panel, element('h2', '', '操偶台正在排演'), pendingNote('三杆控制与基础动作尚未开放。现在可以先认识关节与操纵杆，之后再回来试一试。'), link('一只影偶怎样动起来 →', '#/museum/E03', 'button secondary'));
  append(layout, stageFrame('手 · 影', '练习台尚未启动，不会生成动作或录制。'), panel); host.appendChild(layout);
  return { update() {}, dispose() {} };
};
