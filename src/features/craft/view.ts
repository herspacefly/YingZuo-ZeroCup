import { append, element, link, scope } from '../shared/dom';
import { editable, heading, pageLinks, paletteLabel, patternLabel, pendingNote } from '../shared/pieces';
import { canvasStage, editorFrame } from '../shared/canvas-stage';
import type { PageFactory } from '../../app/view';
import type { PaletteId, PatternId } from '../../domain/types';
import palettes from '../../content/palettes.json';
import patterns from '../../content/patterns.json';

export const mountCraft: PageFactory = (host, ctx) => {
  const life = scope(); append(host, heading('先备行装', '把你的选择，留在衣角。', '云、水、花，三种纹样都能走到团圆。颜色与纹样先保存在编辑稿里。'), pageLinks());
  const layout = element('section', 'workspace'), stage = canvasStage('沉香与母亲 · 分件、颜色与袖口共纹的几何排演。母亲使用固定配色；已有演出时保留本场共纹。');
  const panel = element('div', 'control-panel'), fieldset = element('fieldset'), legend = element('legend', '', '沉香的行装'); fieldset.appendChild(legend);
  const pattern = element('select'), palette = element('select'); pattern.id = 'craft-pattern'; palette.id = 'craft-palette';
  for (const p of patterns.patterns) { const option = element('option', '', p.label); option.value = p.id; pattern.appendChild(option); }
  for (const p of palettes.palettes.filter(p => p.editable)) { const option = element('option', '', p.label); option.value = p.id; palette.appendChild(option); }
  const patternLabelNode = element('label', '', '衣上的纹样'), paletteLabelNode = element('label', '', '这一套颜色'); append(patternLabelNode, pattern); append(paletteLabelNode, palette); append(fieldset, patternLabelNode, paletteLabelNode);
  const summary = element('p', 'selection-summary'), swatches = element('div', 'palette-swatches'); swatches.setAttribute('aria-hidden', 'true');
  const save = element('button', 'button secondary', '保存这身行装');
  append(panel, fieldset, swatches, summary, save, pendingNote('颜色和纹样已进入同一张真实幕面。分段刻纹与操偶尚未开放，当前不会替你完成制偶节点。'), link('回到这一场 →', '#/story')); append(layout, stage.figure, panel); host.appendChild(layout);
  life.on(pattern, 'change', () => ctx.edit({ type: 'PATTERN', patternId: pattern.value as PatternId }));
  life.on(palette, 'change', () => ctx.edit({ type: 'PALETTE', paletteId: palette.value as PaletteId }));
  life.on(save, 'click', () => { void ctx.run(() => ctx.store.flush()); });
  return { update(state) {
    const draft = ctx.store.getExportProject() ?? state.project; fieldset.disabled = !editable(state); save.disabled = !editable(state) || state.hasPending || state.status === 'saving';
    if (!draft) { stage.update(null); summary.textContent = '请先处理作品存档，再继续制作。'; return; }
    stage.update(()=>editorFrame(draft,true,true));
    pattern.value = draft.appearance.patternId; palette.value = draft.appearance.paletteId;
    summary.textContent = `${patternLabel(pattern.value)} · ${paletteLabel(palette.value)}${state.project?.story?.castSnapshot ? '。这是编辑稿；本场已经冻结的造型保持不变。' : '。确认开演前，还可以继续修改。'}`;
    while (swatches.firstChild) swatches.removeChild(swatches.firstChild);
    for (const color of palettes.palettes.find(p => p.id === palette.value)!.colors) { const span = element('span', 'swatch'); span.style.backgroundColor = color; swatches.appendChild(span); }
  }, dispose() { life.dispose(); stage.dispose(); } };
};
