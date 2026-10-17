import { append, clear, element, link, scope } from '../shared/dom';
import { continueHash, heading, paletteLabel, patternLabel } from '../shared/pieces';
import { canvasStage } from '../shared/canvas-stage';
import { museumExhibits, museumFacts, museumSections } from '../../content/museum';
import type { MuseumExhibit } from '../../content/museum';
import sources from '../../content/sources.json';
import { reunionDefinition } from '../../content/reunion';
import { reunionSummary } from '../../domain/story';
import type { PageFactory } from '../../app/view';
import type { ProjectV1 } from '../../domain/types';
import { mountMuseumDemo, museumPreviewFrame } from './demos';
import { mountMuseumEnsemble } from './ensemble';

const factLabels={culture:'工艺与剧目资料',model:'交互示意',original:'本作原创'};
function sourceLink(id:string){
  const source=sources.sources.find(item=>item.id===id)!;
  const a=link(`${source.publisher} · ${source.title}`,source.url);a.target='_blank';a.rel='noopener noreferrer';return a;
}
export const mountMuseum:PageFactory=(host,ctx)=>{
  const life=scope(),selected=museumExhibits.find(item=>item.id===ctx.route.exhibitId);
  append(host,heading('同台成馆 / 五区八件',selected?.title??'把刚才的光影，翻到背面看。',
    selected?.summary??'不必演完，也不必集齐。从一张皮、一道刻、一束光，走进同一张幕的背面。'));
  const returnLink=link('回到这一场 →','#/story','button secondary'),visit=element('p','quiet-note'),context=element('p','museum-personal');
  visit.id='museum-visit';visit.setAttribute('role','status');context.id='museum-personal';
  const path=element('nav','museum-path');path.setAttribute('aria-label','展馆导览');
  if(selected){
    const index=museumExhibits.findIndex(item=>item.id===selected.id);
    path.appendChild(link('五个展区 ←','#/museum','button secondary'));
    if(index>0)path.appendChild(link(`上一件 · ${museumExhibits[index-1]!.id}`,`#/museum/${museumExhibits[index-1]!.id}`,'button secondary'));
    if(index<museumExhibits.length-1)path.appendChild(link(`下一件 · ${museumExhibits[index+1]!.id}`,`#/museum/${museumExhibits[index+1]!.id}`,'button secondary'));
    append(path,returnLink);append(host,path,element('p','exhibit-code',`${selected.section} / ${selected.id}`),context,visit);
  }else{
    for(const [index,label]of museumSections.entries()){
      const button=element('button','museum-section-tab',label);button.type='button';
      life.on(button,'click',()=>{const title=host.querySelector<HTMLElement>(`#museum-section-${index}`);title?.focus();title?.scrollIntoView({block:'start'});});path.appendChild(button);
    }
    append(path,returnLink);append(host,path,context);
  }
  let demo:ReturnType<typeof mountMuseumDemo>|null=null,portrait:ReturnType<typeof canvasStage>|null=null,ensemble:ReturnType<typeof mountMuseumEnsemble>|null=null;
  const programme=element('section','programme museum-programme'),programmeTitle=element('h2'),programmeRows=element('dl','programme-list'),programmeLink=link('查看本场节目单 →','#/result');
  function mountReading(exhibit:MuseumExhibit){
    const toggle=element('button','button secondary','展开说明与资料来源'),reading=element('section','museum-reading');
    toggle.id='exhibit-reading-toggle';toggle.type='button';reading.id='exhibit-reading';reading.hidden=true;
    toggle.setAttribute('aria-controls',reading.id);toggle.setAttribute('aria-expanded','false');
    life.on(toggle,'click',()=>{reading.hidden=!reading.hidden;toggle.setAttribute('aria-expanded',String(!reading.hidden));toggle.textContent=reading.hidden?'展开说明与资料来源':'收起说明与资料来源';});
    append(reading,element('h2','','再走近一点'),element('p','exhibit-detail-copy',exhibit.detail));
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
      append(reading,list,element('p','quiet-note','以上链接用于查阅资料。展签中的几何图示与互动为本作设计，链接不代表外部图片或录音的复用授权。'));
    }
    append(host,toggle,reading);
  }
  if(selected){
    mountReading(selected);
    const display=element('section','museum-display');display.id='museum-display';display.setAttribute('aria-label',selected.alt);host.appendChild(display);
    if(['layers','carving','joints','light'].includes(selected.demo))demo=mountMuseumDemo(display,selected.demo as 'layers'|'carving'|'joints'|'light');
    else if(selected.demo==='ensemble')ensemble=mountMuseumEnsemble(display);
    else if(selected.demo==='credits'){
      const layout=element('div','workspace museum-credits'),panel=element('div','control-panel');portrait=canvasStage('本场影偶或未开演示例 · 原创几何排演。');
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
      append(copy,element('span','exhibit-title',exhibit.title),element('span','exhibit-question',exhibit.question));seenLabels.set(exhibit.id,seen);
      append(a,element('span','exhibit-id',exhibit.id),copy,seen,element('span','exhibit-arrow','↗'));list.appendChild(a);
    }
    section.appendChild(list);sectionHost.appendChild(section);
  }
  catalogue.appendChild(sectionHost);host.appendChild(catalogue);
  let disposed=false,visitRequested='';
  function programmeUpdate(project:ProjectV1|null){
    const result=project?reunionSummary(project):null,story=project?.story;clear(programmeRows);
    programmeTitle.textContent=result?'这一场，已经相见。':'这一场的参与记录';programmeLink.hidden=!result;const rows:[string,string][]=[];
    if(story?.castSnapshot)rows.push(['本场纹样',patternLabel(story.castSnapshot.appearance.patternId)],['本场配色',paletteLabel(story.castSnapshot.appearance.paletteId)],['造型来源',story.presetAppearanceUsed?'采用默认影偶':'采用你确认的造型']);
    rows.push(['演出进度',story?reunionDefinition.nodes.find(node=>node.id===story.nodeId)!.title:'尚未开演，示例不代表个人成果']);
    if(story?.approach)rows.push(['你的选择',story.approach==='call-first'?'先举灯呼唤':'先挥斧开山']);
    if(story)rows.push(['已记录的协助',story.assistedNodeIds.length?story.assistedNodeIds.map(id=>reunionDefinition.nodes.find(node=>node.id===id)!.title).join('、'):'未记录协助']);
    if(result)rows.push(['团圆时间',new Date(result.completedAt).toLocaleString()],['谢幕',story!.nodeId==='completed'?'已经看完':'团圆已保存，谢幕尚未结束']);
    for(const [label,value]of rows)append(programmeRows,element('dt','',label),element('dd','',value));
  }
  return {
    update(state){
      if(disposed)return;const project=state.project,cast=project?.story?.castSnapshot;
      returnLink.href=continueHash(project);returnLink.textContent=project?.story?'回到这一场 →':'从这里去看一场 →';
      context.textContent=cast?`本场影偶 · ${patternLabel(cast.appearance.patternId)} / ${paletteLabel(cast.appearance.paletteId)}。展品试验只在此处生效，回去仍从原段暂停接续。`:
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
    dispose(){if(disposed)return;disposed=true;life.dispose();demo?.dispose();ensemble?.dispose();portrait?.dispose();},
  };
};
