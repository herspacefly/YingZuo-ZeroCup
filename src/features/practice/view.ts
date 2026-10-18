import { append, element, link } from '../shared/dom';
import { heading, pageLinks, pendingNote } from '../shared/pieces';
import { canvasStage } from '../shared/canvas-stage';
import { mountPracticeController } from './controller';
import type { PageFactory } from '../../app/view';
export const mountPractice: PageFactory = (host,ctx) => {
  append(host, heading('幕后一双手', '把手放慢，等影偶回应。', '身杆带着身体，手杆牵动手臂。这里只练沉香，本场剧情会留在原处。'), pageLinks());
  const layout = element('section', 'workspace practice-workspace'), panel = element('div', 'control-panel');
  const stage=canvasStage('沉香独立练习 · 握柄沿真实手杆连接布置。影偶采用本作原创皮影风格设计稿。');
  append(layout, stage.figure, panel); host.appendChild(layout);
  const controller=mountPracticeController(panel,stage,ctx);
  append(panel,pendingNote('练习姿态自动保存，回到这里默认暂停。当前没有录制或分享；练习不会替你完成故事。'),link('一只影偶怎样动起来 →','#/museum/E03','button secondary'));
  return { update:state=>controller.update(state), dispose() {controller.dispose();stage.dispose();} };
};
