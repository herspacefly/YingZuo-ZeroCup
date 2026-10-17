import { append, element, link, scope } from '../shared/dom';
import { advancing, continueHash, stageFrame } from '../shared/pieces';
import type { PageFactory } from '../../app/view';

export const mountIntro: PageFactory = (host, ctx) => {
  const life = scope(), hero = element('section', 'opening page-enter'), copy = element('div', 'opening-copy');
  const title = element('h1', 'hero-title', '隔着一张幕，\n让思念有了形。'); title.id = 'title';
  const primary = element('button', 'button primary', '开始演一出戏'), guided = element('button', 'button secondary', '三分钟导览');
  const resume = link('继续这一场 ↗', '#/story', 'button primary'), progress = element('p', 'quiet-note');
  const actions = element('div', 'opening-actions'); append(actions, primary, resume, guided);
  append(copy, element('p', 'eyebrow', '匠心传成，非遗焕新 / 影作'), title, element('p', 'hero-lead', '沉香要越过山，找到母亲。\n这一次，你将成为幕后的操偶者。'), actions, link('不急着开演，先逛展馆 →', '#/museum'), progress);
  const art = stageFrame('一幕\n团圆', '一盏灯 · 一张幕 · 等一个人归来'); art.className += ' hero-stage';
  append(hero, copy, art); host.appendChild(hero);
  const story = element('section', 'story-strip');
  append(story, element('p', 'eyebrow', '这一出戏'), element('h2', '', '从灯下的回应，到山后的相见。'), element('p', 'section-lead', '为沉香留一道纹样，陪他上路，替他举灯或开山，最后让母子伸手相见。'));
  const acts = element('ol', 'act-list');
  ['灯下记得', '带着灯上路', '山前一线光', '这一回，握住'].forEach((label, i) => { const li = element('li'); append(li, element('span', 'act-number', ['一', '二', '三', '四'][i]!), element('span', '', label)); acts.appendChild(li); });
  append(story, acts, element('p', 'adaptation', '据传统故事《劈山救母》原创交互改编。当前为排演版，影偶场面正在制作。')); host.appendChild(story);
  const museum = element('section', 'museum-invitation');
  append(museum, element('p', 'eyebrow', '同台成馆'), element('h2', '', '看一出戏，\n也看看幕后的双手。'), element('p', '', '一张皮、一道刻、一束光、一双手、一出戏。五个入口，随时可以走进去。'), link('翻开八件展品的目录 ↗', '#/museum', 'button secondary')); host.appendChild(museum);
  life.on(primary, 'click', () => ctx.start('full')); life.on(guided, 'click', () => ctx.start('guided'));
  return { update(state) {
    const hasStory = !!state.project?.story; primary.hidden = hasStory; guided.hidden = hasStory; resume.hidden = !hasStory;
    primary.disabled = guided.disabled = !advancing(state); resume.href = continueHash(state.project);
    progress.textContent = hasStory ? '已为你保留这一场。继续时，从当前小段的起点暂停接续。' : '完整版与导览共享同一个故事；展馆始终开放。';
  }, dispose: () => life.dispose() };
};
