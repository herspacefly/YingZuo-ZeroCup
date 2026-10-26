import { append, element } from '../shared/dom';
import { heading, pageLinks } from '../shared/pieces';
import { mountStoryController } from './controller';
import type { PageFactory } from '../../app/view';

export const mountStory: PageFactory = (host, ctx) => {
  append(host, heading('幕前', '这一场，从此刻接续。', '每次回来，幕面准备好便从当前这一小段的起点自动开演。你可随时暂停，造型和已确认的选择会被保留。'), pageLinks());
  const layout=element('section','workspace story-workspace'),stageSlot=element('div','story-stage-slot'),panel=element('div','control-panel');
  append(layout,stageSlot,panel);host.appendChild(layout);
  return mountStoryController(stageSlot,panel,ctx);
};
