import background from '../../content/story-background.json';
import { append, element, link, scope } from '../shared/dom';
import { advancing, continueHash, stageFrame } from '../shared/pieces';
import type { PageFactory } from '../../app/view';

export const mountIntro: PageFactory = (host, ctx) => {
  const life = scope(), hero = element('section', 'opening page-enter'), copy = element('div', 'opening-copy');
  const title = element('h1', 'hero-title', '隔着一张幕，\n让思念有了形。'); title.id = 'title';
  const primary = element('button', 'button primary journey-recommended', '从故事缘起开始'), guided = element('button', 'button secondary', '节选导览');
  const resume = link('继续这一场 ↗', '#/story', 'button primary journey-recommended'), progress = element('p', 'quiet-note');
  const actions = element('div', 'opening-actions'); append(actions, primary, resume, guided);
  append(copy, element('p', 'eyebrow', '匠心传成，非遗焕新 / 影作'), title, element('p', 'hero-lead', '沉香要越过山，找到母亲。\n这一次，你将成为幕后的操偶者。'), actions, link('不急着开演，先逛展馆 →', '#/museum'), progress);
  const art = stageFrame('一幕\n团圆', '一盏灯 · 一张幕 · 等一个人归来'); art.className += ' hero-stage';
  append(hero, copy, art); host.appendChild(hero);
  const story = element('section', 'story-strip');
  append(story, element('p', 'eyebrow', '这一出戏'), element('h2', '', '从灯下的回应，到山后的相见。'), element('p', 'section-lead', '为沉香留一道纹样，陪他上路，替他举灯或开山，再决定山开以后的去向。'));
  const acts = element('ol', 'act-list');
  ['灯下记得', '带着灯上路', '山前一线光', '山开以后'].forEach((label, i) => { const li = element('li'); append(li, element('span', 'act-number', ['一', '二', '三', '四'][i]!), element('span', '', label)); acts.appendChild(li); });
  append(story, acts, element('p', 'adaptation', '据传统故事《劈山救母》原创交互改编。三位影偶与分层场景采用本作原创皮影风格设计稿。')); host.appendChild(story);
  const steps=element('section','intro-steps');append(steps,element('h2','','初来这张幕，先试三件事'));const list=element('ol');for(const text of ['为沉香选纹样与配色，也可用默认影偶开演。','点继续操偶，直接拖动手脚；点击幕面后用方向键移身。','在故事里选择路线和终章，再带走本场节目单。'])list.appendChild(element('li','',text));append(steps,list,element('p','quiet-note','每页顶部都有“操作说明”。声音可选，遇到难处可请协助演过；二维可完成全部体验。'));host.appendChild(steps);
  const origin=element('section','story-background');origin.id='story-background';origin.setAttribute('aria-labelledby','background-title');const originTitle=element('h2','',background.title);originTitle.id='background-title';const originGrid=element('div','story-background-grid');
  append(origin,element('p','eyebrow','先认识这一家人'),originTitle,element('p','',background.intro));for(const section of background.sections){const part=element('article');append(part,element('h3','',section.title),element('p','',section.text));originGrid.appendChild(part);}
  const prepare=link('明白了，为沉香备行装 →','#/craft','button primary journey-recommended');prepare.id='journey-to-craft';append(origin,originGrid,element('p','adaptation',background.adaptationNote),link('传统故事背景参考：文化和旅游部《宝莲灯》剧情介绍 ↗','https://www.mct.gov.cn/ggfw/zyjzzt/yanchu/yanchuwqhg/201909/t20190923_846995.html'),prepare);host.appendChild(origin);
  const museum = element('section', 'museum-invitation');
  append(museum, element('p', 'eyebrow', '同台成馆'), element('h2', '', '看一出戏，\n也看看幕后的双手。'), element('p', '', '一张皮、一道刻、一束光、一双手、一出戏。五个入口，随时可以走进去。'), link('翻开八件展品的目录 ↗', '#/museum', 'button secondary')); host.appendChild(museum);
  life.on(primary, 'click', () => {origin.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});originTitle.setAttribute('tabindex','-1');originTitle.focus({preventScroll:true});}); life.on(guided, 'click', () => ctx.start('guided'));
  return { update(state) {
    const hasStory = !!state.project?.story; primary.hidden = hasStory; guided.hidden = hasStory; resume.hidden = !hasStory;
    primary.disabled = guided.disabled = !advancing(state); resume.href = continueHash(state.project);
    progress.textContent = state.project?.story&&state.project.story.definitionVersion<3?'已保留先前的团圆演出。继续仍按原剧本；想体验五终章，可到制偶页归档重开。':hasStory ? '已为你保留这一场。继续时，从当前小段的起点暂停接续。' : '先读缘起，再制偶、调灯和练习；准备好以后再正式开演。也可直接选择节选导览。';
  }, dispose: () => life.dispose() };
};
