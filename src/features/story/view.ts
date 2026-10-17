import { append, element, link, scope } from '../shared/dom';
import { advancing, heading, pageLinks, pendingNote, stageFrame } from '../shared/pieces';
import { currentStoryNode } from '../../domain/story';
import { reunionDefinition } from '../../content/reunion';
import type { PageFactory } from '../../app/view';

export const mountStory: PageFactory = (host, ctx) => {
  const life = scope(); append(host, heading('幕前', '这一场，从此刻接续。', '每次回来，都从当前这一小段的起点暂停开始。你的造型和已确认的选择会被保留。'), pageLinks());
  const layout = element('section', 'workspace'), panel = element('div', 'control-panel');
  const title = element('h2'), lead = element('p'), stateText = element('p', 'eyebrow', '当前暂停'), cues = element('div', 'subtitles');
  const start = element('button', 'button primary', '确认开始这一场'), skip = element('button', 'button primary', '先为他备好行装');
  const pause = element('button', 'button secondary', '暂停'), play = element('button', 'button secondary', '继续片段'); pause.disabled = play.disabled = true;
  const transport = element('div', 'transport'); append(transport, pause, play);
  const craft = link('去备行装 →', '#/craft'), note = pendingNote('影偶场面与操偶正在排演。本页先保留文字与检查点，暂不启动自动演出。');
  append(panel, stateText, title, lead, cues, start, skip, craft, transport, note, link('先去展馆走走 →', '#/museum')); append(layout, stageFrame('幕前 · 暂停', '画面尚在排演，字幕与当前进度可阅读。'), panel); host.appendChild(layout);
  life.on(start, 'click', () => ctx.start('full')); life.on(skip, 'click', () => ctx.skipIntro());
  return { update(state) {
    const story = state.project?.story, node = story ? currentStoryNode(reunionDefinition, story) : null;
    title.textContent = node?.title ?? '还没有开始这一场'; lead.textContent = node?.lead ?? '确认开演后，才会为本场留下独立的演出身份；直接打开页面不会替你开始。';
    start.hidden = !!story; start.disabled = !advancing(state); skip.hidden = node?.id !== 'intro'; skip.disabled = !advancing(state); craft.hidden = node?.id !== 'craft';
    stateText.textContent = node ? `${node.act ? `第${node.act}幕` : '序与制偶'} · 暂停接续` : '等待你的确认';
    while (cues.firstChild) cues.removeChild(cues.firstChild);
    for (const cue of node?.subtitles ?? []) cues.appendChild(element('p', '', cue.text));
  }, dispose: () => life.dispose() };
};
