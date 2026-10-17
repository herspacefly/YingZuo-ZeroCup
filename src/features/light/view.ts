import { append, element, link } from '../shared/dom';
import { heading, pageLinks, pendingNote, stageFrame } from '../shared/pieces';
import type { PageFactory } from '../../app/view';
export const mountLight: PageFactory = host => {
  append(host, heading('一束光', '灯近一点，影子远一点。', '灯、影偶和幕之间的距离，组成这场戏的另一层语言。'), pageLinks());
  const layout = element('section', 'workspace'), panel = element('div', 'control-panel');
  append(panel, element('h2', '', '等幕面亮起来'), pendingNote('本场的灯影控制正在排演。灯位与偶幕距离会在这里进入真实预览。'), link('去看“一盏灯，两种尺度” →', '#/museum/E04'));
  const study = link('看看独立灯影示意（新窗口） ↗', './study.html#light-study', 'button secondary'); study.target = '_blank'; study.rel = 'noopener noreferrer';
  append(panel, study, element('p', 'quiet-note', '独立示意用于观察灯影，不写入本场作品。'));
  append(layout, stageFrame('光落幕上', '本场灯影实验尚未开放；可先阅读展品目录或查看独立示意。'), panel); host.appendChild(layout);
  return { update() {}, dispose() {} };
};
