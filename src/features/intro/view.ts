import background from '../../content/story-background.json';
import { append, element, link, scope } from '../shared/dom';
import { advancing, continueHash, stageFrame } from '../shared/pieces';
import type { PageFactory } from '../../app/view';

export const mountIntro: PageFactory = (host, ctx) => {
  const life = scope(), hero = element('section', 'opening page-enter'), copy = element('div', 'opening-copy');
  const title = element('h1', 'hero-title', '隔着一张幕，\n让思念有了形。'); title.id = 'title';
  const primary = element('button', 'button secondary', '完整体验'), guided = element('button', 'button secondary', '节选导览');
  primary.id='intro-full-experience';
  append(primary,element('small','','从故事缘起开始 · 约23分钟，准备与操作另计'));
  const quick=element('button','button primary journey-recommended','快速试演');quick.id='intro-quick-trial';append(quick,element('small','','约90秒编排，操作时间另计'));
  const visit=link('自由逛馆','#/museum','button secondary');append(visit,element('small','','五区七展签 · 随时进入'));
  const trialSlot=element('div','intro-trial-slot'),trialNotice=element('p','quiet-note');trialNotice.setAttribute('role','status');
  let trial:ReturnType<typeof import('../quick-trial/view').mountQuickTrial>|null=null,trialGeneration=0,disposed=false,hasCurrentStory=false,currentLegacyCraft=false,trialBlocked=false;
  const resume = link('继续这一场 ↗', '#/story', 'button primary journey-recommended'), progress = element('p', 'quiet-note');
  const actions = element('div', 'opening-actions'); append(actions, resume, quick, primary, visit);
  append(copy, element('p', 'eyebrow', '匠心传成，非遗焕新 / 影作'), title, element('p', 'hero-lead', '沉香要越过山，找到母亲。\n这一次，你将成为幕后的操偶者。'), actions, guided, element('p','quiet-note','节选导览约8—10分钟，操作另计。'), progress, trialNotice);
  const art = stageFrame('一幕\n团圆', '一盏灯 · 一张幕 · 等一个人归来'); art.className += ' hero-stage';
  append(hero, copy, art); host.appendChild(hero);host.appendChild(trialSlot);
  const story = element('section', 'story-strip');
  append(story, element('p', 'eyebrow', '这一出戏'), element('h2', '', '从灯下的回应，到山后的相见。'), element('p', 'section-lead', '为沉香备一身行装，陪他上路，替他举灯或开山，再决定山开以后的去向。'));
  const acts = element('ol', 'act-list');
  ['灯下记得', '带着灯上路', '山前一线光', '山开以后'].forEach((label, i) => { const li = element('li'); append(li, element('span', 'act-number', ['一', '二', '三', '四'][i]!), element('span', '', label)); acts.appendChild(li); });
  append(story, acts, element('p', 'adaptation', '据传统故事《劈山救母》改编。')); const features=element('div','home-features');features.appendChild(story);host.appendChild(features);
  const steps=element('section','intro-steps');append(steps,element('h2','','初来这张幕，先试三件事'));const list=element('ol');for(const text of ['为沉香挑选配色，也可用默认影偶开演。','点继续操偶，直接拖动手脚；点击幕面后用方向键移身。','在故事里作出四次选择，再带走本场节目单。'])list.appendChild(element('li','',text));append(steps,list,element('p','quiet-note','本次打开网站，每个工序首次陪你试一遍。遇到难处，可以请协助演过。'));hero.appendChild(steps);
  const origin=element('section','story-background');origin.id='story-background';origin.setAttribute('aria-labelledby','background-title');const originTitle=element('h2','',background.title);originTitle.id='background-title';const originGrid=element('div','story-background-grid');
  append(origin,element('p','eyebrow','先认识这一家人'),originTitle,element('p','',background.intro));for(const section of background.sections){const part=element('article');append(part,element('h3','',section.title),element('p','',section.text));originGrid.appendChild(part);}
  const prepare=link('明白了，为沉香备行装 →','#/craft','button primary journey-recommended');prepare.id='journey-to-craft';append(origin,originGrid,element('p','adaptation',background.adaptationNote),link('传统故事背景参考：文化和旅游部《宝莲灯》剧情介绍 ↗','https://www.mct.gov.cn/ggfw/zyjzzt/yanchu/yanchuwqhg/201909/t20190923_846995.html'),prepare);host.appendChild(origin);
  const museum = element('section', 'museum-invitation');
  append(museum, element('p', 'eyebrow', '同台成馆'), element('h2', '', '看一出戏，\n也看看幕后的双手。'), element('p', '', '一张皮、一道刻、一束光、一双手、一出戏。五个入口，随时可以走进去。'), link('翻开展馆目录 ↗', '#/museum', 'button secondary')); features.appendChild(museum);
  function closeTrial(restoreFocus=true){trialGeneration++;trial?.dispose();trial=null;quick.disabled=false;trialNotice.textContent='';if(restoreFocus)quick.focus();}
  life.on(quick,'click',()=>{
    if(trial){trialSlot.scrollIntoView({block:'start'});return;}
    const token=++trialGeneration;quick.disabled=true;trialNotice.textContent='正在准备快速试演…';
    void import('../quick-trial/view').then(module=>{
      if(disposed||token!==trialGeneration)return;
      trial=module.mountQuickTrial(trialSlot,{audio:ctx.audio,onClose:()=>closeTrial(),onFullExperience(){closeTrial(false);if(hasCurrentStory)ctx.navigate({path:currentLegacyCraft?'/craft':'/story',exhibitId:null});else primary.click();},onMuseum(){closeTrial(false);ctx.navigate({path:'/museum',exhibitId:null});}});
      trial.setBlocked(trialBlocked);quick.disabled=false;trialNotice.textContent='';trialSlot.scrollIntoView({block:'start',behavior:'auto'});
    }).catch(error=>{if(disposed||token!==trialGeneration)return;quick.disabled=false;trialNotice.textContent='快速试演暂未载入，请重试：'+String(error);});
  });
  life.on(primary, 'click', () => {origin.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});originTitle.setAttribute('tabindex','-1');originTitle.focus({preventScroll:true});}); life.on(guided, 'click', () => ctx.start('guided'));
  return { update(state) {
    const hasStory = !!state.project?.story;hasCurrentStory=hasStory;currentLegacyCraft=state.project?.story?.nodeId==='craft'&&state.project.story.definitionVersion<3; primary.hidden = hasStory; guided.hidden = hasStory; resume.hidden = !hasStory;
    primary.disabled = guided.disabled = !advancing(state);trialBlocked=ctx.isBusy()||state.hasPending||['saving','closed','conflict','recovery','unsupported'].includes(state.status);trial?.setBlocked(trialBlocked);
    quick.className=hasStory?'button secondary':'button primary journey-recommended'; resume.href = continueHash(state.project);
    progress.textContent = state.project?.story&&state.project.story.definitionVersion<3?'已保留先前的团圆演出。继续仍按原剧本；想体验五终章，可到制偶页归档重开。':hasStory ? '已为你保留这一场。继续时，幕面就绪后从当前小段的起点自动接续。' : '先读缘起，再制偶、调灯和练习；准备好以后再正式开演。也可直接选择节选导览。';
  }, dispose(){disposed=true;closeTrial(false);life.dispose();} };
};
