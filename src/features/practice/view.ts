import { append, element, link } from '../shared/dom';
import { heading, pageLinks, pendingNote } from '../shared/pieces';
import { canvasStage, editorFrame } from '../shared/canvas-stage';
import type { PageFactory } from '../../app/view';
export const mountPractice: PageFactory = (host,ctx) => {
  append(host, heading('幕后一双手', '把手放慢，等影偶回应。', '身杆带着身体，手杆牵动手臂。练习台将从这里开始。'), pageLinks());
  const layout = element('section', 'workspace'), panel = element('div', 'control-panel');
  append(panel, element('h2', '', '操偶台正在排演'), pendingNote('三杆控制与基础动作尚未开放。现在可以先认识关节与操纵杆，之后再回来试一试。'), link('一只影偶怎样动起来 →', '#/museum/E03', 'button secondary'));
  const stage=canvasStage('沉香与三杆连接 · 当前显示已保存姿态，尚无拖杆或录制。');
  append(layout, stage.figure, panel); host.appendChild(layout);
  return { update(state) { const project=ctx.store.getExportProject()??state.project;stage.update(()=>project?editorFrame(project,false,true):null); }, dispose() {stage.dispose();} };
};
