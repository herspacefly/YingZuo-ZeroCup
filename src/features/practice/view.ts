import { append, element, link, scope } from '../shared/dom';
import { heading, pageLinks, pendingNote } from '../shared/pieces';
import { canvasStage } from '../shared/canvas-stage';
import { mountPracticeController } from './controller';
import type { PageFactory } from '../../app/view';
export const mountPractice: PageFactory = (host,ctx) => {
  append(host, heading('幕后一双手', '把手放慢，等影偶回应。', '身杆带着身体，手杆牵动手臂。这里只练沉香，本场剧情会留在原处。'), pageLinks());
  const layout = element('section', 'workspace practice-workspace'), panel = element('div', 'control-panel');
  const stage=canvasStage('拖动手脚，或点一下幕面，用方向键移动身躯。');
  const column=element('div','stage-column'),posePanel=element('section','surface-card pose-panel');posePanel.setAttribute('aria-label','调整影偶姿态');append(column,stage.figure,posePanel);append(layout,column,panel); host.appendChild(layout);
  const controller=mountPracticeController(panel,stage,ctx,posePanel),life=scope();const next=element('button','button primary journey-recommended','准备好了，正式开演 →');next.id='journey-to-story';const nextBox=element('section','journey-next');append(nextBox,element('p','','第4步 / 练习：拖一拖手脚，点一下幕面再用方向键移身。你随时可以请协助演过，故事的选择仍由你决定。'),next);panel.appendChild(nextBox);life.on(next,'click',()=>ctx.start('full'));
  append(panel,pendingNote('练习姿态自动保存，回来时从暂停接续。准备好后，可以正式开演。'),link('一只影偶怎样动起来 →','#/museum/E03','button secondary'));
  return { suspendForGuide:controller.suspendForGuide,update(state){controller.update(state);next.textContent=state.project?.story?'回到这一场演出 →':'准备好了，正式开演 →';next.disabled=!state.project||state.hasPending||ctx.isBusy()||['loading','saving','closed','conflict','recovery','unsupported'].includes(state.status);}, dispose() {life.dispose();controller.dispose();stage.dispose();} };
};
