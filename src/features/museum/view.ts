import { append, clear, element, link, scope } from '../shared/dom';
import { continueHash, heading, paletteLabel, patternLabel } from '../shared/pieces';
import { canvasStage } from '../shared/canvas-stage';
import { museumExhibits, museumFacts, museumSections } from '../../content/museum';
import type { MuseumExhibit } from '../../content/museum';
import sources from '../../content/sources.json';
import { definitionFor,endingFor } from '../../content/reunion';
import { reunionSummary } from '../../domain/story';
import type { PageFactory } from '../../app/view';
import type { ProjectV1 } from '../../domain/types';
import { mountMuseumDemo, museumPreviewFrame } from './demos';
import { mountMuseumEnsemble } from './ensemble';
import { mountMuseumGallery, museumCover, museumMedia } from './gallery';
import '../../styles/museum-gallery.css';

const factLabels={culture:'工艺与剧目资料',model:'交互示意',original:'本作原创'};
function sourceLink(id:string){
  const source=sources.sources.find(item=>item.id===id)!;
  const a=link(`${source.publisher} · ${source.title}`,source.url);a.target='_blank';a.rel='noopener noreferrer';return a;
}
export const mountMuseum:PageFactory=(host,ctx)=>{
  const life=scope(),selected=museumExhibits.find(item=>item.id===ctx.route.exhibitId);
  host.classList.add('digital-museum');
  append(host,heading('影作数字展馆 / 皮影艺术',selected?.title??'一张皮，一束光，千年戏。',
    selected?.summary??'循着实物与工艺照片，认识皮影的材料、刻制、操演和地方风貌。五个展区，八件展签，随时入馆。'));
  const returnLink=link('回到这一场 →','#/story','button secondary'),visit=element('p','quiet-note'),context=element('p','museum-personal');
  visit.id='museum-visit';visit.setAttribute('role','status');context.id='museum-personal';
  const path=element('nav','museum-path');path.setAttribute('aria-label','展馆导览');
  if(selected){
    const index=museumExhibits.findIndex(item=>item.id===selected.id);
    path.appendChild(link('五个展区 ←','#/museum','button secondary'));
    if(index>0)path.appendChild(link(`上一件 · ${museumExhibits[index-1]!.id}`,`#/museum/${museumExhibits[index-1]!.id}`,'button secondary'));
    if(index<museumExhibits.length-1)path.appendChild(link(`下一件 · ${museumExhibits[index+1]!.id}`,`#/museum/${museumExhibits[index+1]!.id}`,'button secondary'));
    append(host,path,element('p','exhibit-code',`${selected.section} / ${selected.id}`));
  }else{
    for(const [index,label]of museumSections.entries()){
      const button=element('button','museum-section-tab',label);button.type='button';
      life.on(button,'click',()=>{const title=host.querySelector<HTMLElement>(`#museum-section-${index}`);title?.focus();title?.scrollIntoView({block:'start'});});path.appendChild(button);
    }
    append(host,path);
    const hero=element('section','museum-hero'),copy=element('div','museum-hero-copy'),photo=element('figure','museum-hero-photo');
    const cover=museumMedia.media.find(item=>item.kind==='external'&&item.region.includes('唐山'))??museumMedia.media.find(item=>item.kind==='external')!;
    const image=element('img');image.src=cover.localPath;image.alt=cover.alt;image.width=cover.width;image.height=cover.height;image.decoding='async';
    const fallback=element('p','museum-hero-fallback','照片暂未载入，可从下方展区继续阅读。');fallback.hidden=true;life.on(image,'error',()=>{image.hidden=true;fallback.hidden=false;});
    const caption=element('figcaption');append(caption,element('span','',`${cover.region} · ${cover.originalCaption}`));
    if(cover.sourcePage){const source=link('资料出处 ↗',cover.sourcePage);source.target='_blank';source.rel='noopener noreferrer';caption.appendChild(source);}
    append(photo,image,fallback,caption);
    append(copy,element('span','eyebrow','光影之间 / 手艺长存'),element('h2','','从一刀一线，读懂一出戏。'),element('p','','影窗前，是人物的聚散；影窗后，是皮料、刻刀、色彩、灯与操演者的手。先看真实的手工痕迹，再走近它们怎样共同成就一场演出。'),link('从材料与颜色开始 →','#/museum/E01','button journey-recommended'),element('p','quiet-note','先看实物，认识一刀一线；再亲手试一试。'));
    append(hero,copy,photo);host.appendChild(hero);
  }
  let demo:ReturnType<typeof mountMuseumDemo>|null=null,portrait:ReturnType<typeof canvasStage>|null=null,ensemble:ReturnType<typeof mountMuseumEnsemble>|null=null,gallery:ReturnType<typeof mountMuseumGallery>|null=null;
  const programme=element('section','programme museum-programme'),programmeTitle=element('h2'),programmeRows=element('dl','programme-list'),programmeLink=link('查看本场节目单 →','#/result');
  function mountReading(exhibit:MuseumExhibit){
    const toggle=element('button','button secondary museum-model-reading','展开数字示意说明与资料来源'),reading=element('section','museum-reading');
    toggle.id='exhibit-reading-toggle';toggle.type='button';reading.id='exhibit-reading';reading.hidden=true;
    toggle.setAttribute('aria-controls',reading.id);toggle.setAttribute('aria-expanded','false');
    life.on(toggle,'click',()=>{reading.hidden=!reading.hidden;toggle.setAttribute('aria-expanded',String(!reading.hidden));toggle.textContent=reading.hidden?'展开数字示意说明与资料来源':'收起说明与资料来源';});
    append(reading,element('h2','','资料索引与数字示意'),element('p','exhibit-detail-copy',exhibit.detail));
    const facts=element('ul','museum-facts');
    for(const id of exhibit.factIds){
      const fact=museumFacts.find(item=>item.id===id)!,row=element('li');
      append(row,element('span',`museum-fact-kind ${fact.kind}`,factLabels[fact.kind]),element('p','',fact.text));
      if(fact.sourceIds.length)row.appendChild(element('p','quiet-note',`资料对应：${fact.sourceIds.join(' / ')}`));facts.appendChild(row);
    }
    reading.appendChild(facts);
    if(exhibit.sourceIds.length){
      reading.appendChild(element('h3','','资料从这里来'));const list=element('ul','source-list');
      for(const id of exhibit.sourceIds){const source=sources.sources.find(item=>item.id===id)!,item=element('li');
        append(item,element('span','exhibit-code',`${id} / `),sourceLink(id));
        if(source.accessStatus!=='readable')item.appendChild(element('p','quiet-note',source.verificationNote));list.appendChild(item);
      }
      append(reading,list,element('p','quiet-note','可以从这些资料继续了解工艺与地方风貌。'));
    }
    append(host,toggle,reading);
  }
  if(selected){
    gallery=mountMuseumGallery(host,selected.id);
    const divider=element('header','museum-demo-heading');append(divider,element('span','eyebrow','延伸体验 / 数字示意'),element('h2','','把刚才的知识，放到幕上试一试。'),element('p','quiet-note','下方为本作的简化模型与剧场设计，帮助理解关系；不作为传统工艺的统一标准。'));host.appendChild(divider);
    mountReading(selected);
    const display=element('section','museum-display');display.id='museum-display';display.setAttribute('aria-label',selected.alt);host.appendChild(display);
    if(['layers','carving','joints','light'].includes(selected.demo))demo=mountMuseumDemo(display,selected.demo as 'layers'|'carving'|'joints'|'light');
    else if(selected.demo==='ensemble')ensemble=mountMuseumEnsemble(display);
    else if(selected.demo==='credits'){
      const layout=element('div','workspace museum-credits'),panel=element('div','control-panel');portrait=canvasStage('回看这一场的影偶与节目单。');
      append(programme,programmeTitle,programmeRows,programmeLink);panel.appendChild(programme);append(layout,portrait.figure,panel);display.appendChild(layout);
    }
    if(selected.panels.length){
      const diagram=element('figure',`museum-diagram museum-diagram-${selected.demo}`),panels=element('div','museum-panel-list');
      for(const [index,panel]of selected.panels.entries()){
        const item=element('section','museum-panel');append(item,element('span','museum-panel-number',`0${index+1}`),element('h3','',panel.title),element('p','',panel.text));
        for(const id of panel.sourceIds)item.appendChild(sourceLink(id));panels.appendChild(item);
      }
      append(diagram,panels,element('figcaption','stage-caption',selected.alt));display.appendChild(diagram);
    }
    const exit=element('aside','museum-theatre-return');append(exit,context,visit,returnLink);host.appendChild(exit);
  }
  const catalogue=element('section',selected?'museum-catalogue compact':'museum-catalogue');
  if(selected)catalogue.appendChild(element('h2','','沿展签，再看一件。'));
  const sectionHost=element('div','museum-sections'),seenLabels=new Map<string,HTMLElement>();
  for(const [index,label]of museumSections.entries()){
    const section=element('section','museum-section'),title=element('h2','',label),list=element('div','exhibit-list');
    title.id=`museum-section-${index}`;title.tabIndex=-1;append(section,element('span','section-number',`0${index+1}`),title);
    for(const exhibit of museumExhibits.filter(item=>item.section===label)){
      const a=link('',`#/museum/${exhibit.id}`,'exhibit-link'),copy=element('span','exhibit-copy'),seen=element('span','museum-seen');
      a.setAttribute('data-exhibit',exhibit.id);if(selected?.id===exhibit.id)a.setAttribute('aria-current','page');
      const cover=museumCover(exhibit.id);
      if(cover){const image=element('img','exhibit-thumbnail');image.alt='';image.loading='lazy';image.decoding='async';image.width=66;image.height=82;image.src=cover.localPath;life.on(image,'error',()=>{image.hidden=true;});a.appendChild(image);}
      append(copy,element('span','exhibit-title',exhibit.title),element('span','exhibit-question',exhibit.question));seenLabels.set(exhibit.id,seen);
      append(a,element('span','exhibit-id',exhibit.id),copy,seen,element('span','exhibit-arrow','↗'));list.appendChild(a);
    }
    section.appendChild(list);sectionHost.appendChild(section);
  }
  catalogue.appendChild(sectionHost);host.appendChild(catalogue);
  let disposed=false,visitRequested='';
  function programmeUpdate(project:ProjectV1|null){
    const result=project?reunionSummary(project):null,story=project?.story;clear(programmeRows);
    const ending=endingFor(story);programmeTitle.textContent=result?(ending?'本场终章 · '+ending.title:'这一场，已经相见。'):'这一场的参与记录';programmeLink.hidden=!result;const rows:[string,string][]=[];
    if(story?.castSnapshot){if(story.definitionVersion!==4)rows.push(['本场纹样',patternLabel(story.castSnapshot.appearance.patternId)]);rows.push(['本场配色',paletteLabel(story.castSnapshot.appearance.paletteId)],['造型来源',story.presetAppearanceUsed?'采用默认影偶':'采用你确认的造型']);}
    rows.push(['演出进度',story?definitionFor(story).nodes.find(node=>node.id===story.nodeId)!.title:'尚未开演，示例不代表个人成果']);
    if(story?.approach)rows.push(['你的选择',story.approach==='call-first'?'先举灯呼唤':'先挥斧开山']);
    if(story?.skippedNodeIds?.length)rows.push(['主动跳过的片段',story.skippedNodeIds.map(id=>definitionFor(story).nodes.find(node=>node.id===id)!.title).join('、')]);
    if(ending)rows.push(['你的终章',ending.title],['终章去向',ending.summary]);
    if(story)rows.push(['已记录的协助',story.assistedNodeIds.length?story.assistedNodeIds.map(id=>definitionFor(story).nodes.find(node=>node.id===id)!.title).join('、'):'未记录协助']);
    if(result)rows.push(['终章完成时间',new Date(result.completedAt).toLocaleString()],['谢幕',story!.nodeId==='completed'?'已经看完':'终章已保存，谢幕尚未结束']);
    for(const [label,value]of rows)append(programmeRows,element('dt','',label),element('dd','',value));
  }
  return {
    update(state){
      if(disposed)return;const project=state.project,cast=project?.story?.castSnapshot;
      returnLink.href=continueHash(project);returnLink.textContent=project?.story?'回到这一场 →':'从这里去看一场 →';
      context.textContent=cast?`本场影偶 · ${paletteLabel(cast.appearance.paletteId)}。数字示意只在此处生效，回去仍从原段暂停接续。`:
        '展品使用示例影偶，随时可以试一试。无需开演或集齐展签，试验不会替你开始或完成故事。';
      for(const [id,label]of seenLabels)label.textContent=project?.museum.visitedExhibitIds.includes(id as MuseumExhibit['id'])?'来过':'';
      if(selected){
        const visited=project?.museum.visitedExhibitIds.includes(selected.id),writable=!!project&&!state.hasPending&&!ctx.isBusy()&&!['loading','closed','unsupported','recovery','conflict'].includes(state.status);
        visit.textContent=!project?'知识照常开放；当前没有可记录参观的作品。':visited?
          ['memory','error'].includes(state.status)?'来过这一件 · 当前更改未保存，可从“我的作品”导出。':state.status==='saved'?'来过这一件 · 已随作品保存。':'来过这一件 · 参观记录等待随作品保存。':
          '打开展签只记录“来过”，不代表读完或演出通关。';
        if(writable&&!visited&&visitRequested!==project.projectId){visitRequested=project.projectId;ctx.edit({type:'VISIT',exhibitId:selected.id});}
      }
      demo?.update(project);ensemble?.update(project);portrait?.update(()=>museumPreviewFrame(project));if(selected?.demo==='credits')programmeUpdate(project);
    },
    dispose(){if(disposed)return;disposed=true;life.dispose();demo?.dispose();ensemble?.dispose();portrait?.dispose();gallery?.dispose();host.classList.remove('digital-museum');},
  };
};
