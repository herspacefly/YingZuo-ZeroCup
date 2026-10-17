import { append, element, link } from '../shared/dom';
import { heading, pageLinks, pendingNote } from '../shared/pieces';
import { canvasStage, editorFrame } from '../shared/canvas-stage';
import type { PageFactory } from '../../app/view';
export const mountLight: PageFactory = (host,ctx) => {
  append(host, heading('一束光', '灯近一点，影子远一点。', '灯、影偶和幕之间的距离，组成这场戏的另一层语言。'), pageLinks());
  const layout = element('section', 'workspace'), panel = element('div', 'control-panel');
  append(panel, element('h2', '', '光已经落在幕上'), pendingNote('当前按作品中保存的灯位和偶幕距离投影。灯位操作尚在排演，暂时只能观察这一刻。'), link('去看“一盏灯，两种尺度” →', '#/museum/E04'));
  const study = link('看看独立灯影示意（新窗口） ↗', './study.html#light-study', 'button secondary'); study.target = '_blank'; study.rel = 'noopener noreferrer';
  append(panel, study, element('p', 'quiet-note', '独立示意用于观察灯影，不写入本场作品。'));
  const stage=canvasStage('沉香 · 彩色成影与几何投影示意，灯控随后开放。');
  append(layout, stage.figure, panel); host.appendChild(layout);
  return { update(state) { const project=ctx.store.getExportProject()??state.project;stage.update(()=>project?editorFrame(project):null); }, dispose() {stage.dispose();} };
};
