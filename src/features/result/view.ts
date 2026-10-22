import { append,clear,element,link,scope } from '../shared/dom';
import { continueHash,heading,paletteLabel,patternLabel } from '../shared/pieces';
import { reunionSummary } from '../../domain/story';
import { definitionFor, endingFor } from '../../content/reunion';
import type { PageFactory } from '../../app/view';
import type { ProjectV1 } from '../../domain/types';
import { downloadJSON,exportProjectJSON } from '../../persistence/project-file';
import { createReunionArtifact } from './artifact';
import { mountReunionExporter } from './exporter';
import { downloadResultBlob } from './download';
import { mountReunionReplay } from './replay-view';

export const mountResult:PageFactory=(host,ctx)=>{
  const life=scope(),head=heading('一幕团圆 / 本场节目单','这一场，还在路上。','终章之后，属于这一场的造型、选择与协作会在这里留下。');host.appendChild(head);
  const layout=element('section','result-layout'),figure=element('figure','result-portrait'),capture=element('div','result-capture'),caption=element('figcaption','stage-caption','1600 × 1200 · 依本场冻结构图生成的终章留影，当前为原创皮影风格设计稿。');
  capture.id='result-capture';append(figure,capture,caption);
  const programme=element('section','programme result-programme'),title=element('h2'),details=element('dl','programme-list'),resume=link('回到这一场 →','#/story','button secondary');
  const id=element('p','result-identity'),saveState=element('p','quiet-note'),operation=element('p','selection-summary');id.id='result-id';saveState.id='result-save-note';operation.id='result-operation';operation.setAttribute('role','status');
  const actions=element('div','result-actions'),png=element('button','button primary','下载团圆留影 PNG'),json=element('button','button secondary','导出本场 JSON'),retry=element('button','button secondary','重新准备留影'),replayButton=element('button','button secondary','按本场编排再演');
  for(const [button,name]of [[png,'png'],[json,'json'],[retry,'retry'],[replayButton,'replay']] as const){button.type='button';button.id='result-'+name;actions.appendChild(button);}
  replayButton.setAttribute('aria-expanded','false');replayButton.setAttribute('aria-controls','result-replay-slot');
  append(programme,title,id,details,saveState,actions,operation,resume,link('下一步，去展馆看这场戏的幕后 →','#/museum','button secondary journey-recommended'));append(layout,figure,programme);host.appendChild(layout);
  const replaySlot=element('div');replaySlot.id='result-replay-slot';host.appendChild(replaySlot);
  let disposed=false,identity='',project:ProjectV1|null=null,exporter:ReturnType<typeof mountReunionExporter>|null=null,replay:ReturnType<typeof mountReunionReplay>|null=null;
  let generation=0,ready=false,encoding=false,blocked=true,failed=false;const downloads=new Set<()=>void>();
  const message=(error:unknown)=>error instanceof Error?error.message:String(error);
  function controls(){png.disabled=blocked||!ready||encoding;json.disabled=blocked||!project;retry.hidden=!failed;retry.disabled=blocked;replayButton.disabled=blocked||!project;}
  function closeReplay(){replay?.dispose();replay=null;clear(replaySlot);replayButton.textContent='按本场编排再演';replayButton.setAttribute('aria-expanded','false');}
  function disposeArtifact(){generation++;ready=false;encoding=false;failed=false;exporter?.dispose();exporter=null;clear(capture);closeReplay();for(const cleanup of downloads)cleanup();downloads.clear();}
  function prepare(){
    if(!project||disposed)return;generation++;const token=generation;ready=false;encoding=false;failed=false;exporter?.dispose();exporter=null;clear(capture);operation.textContent='正在准备这场团圆留影…';controls();
    try{
      const next=mountReunionExporter(capture,createReunionArtifact(project));exporter=next;
      void next.ready.then(()=>{if(disposed||token!==generation)return;ready=true;operation.textContent='留影已就绪，可以带走这一场。';controls();},error=>{if(disposed||token!==generation)return;failed=true;ready=false;operation.textContent='留影暂未就绪：'+message(error);controls();});
    }catch(error){failed=true;operation.textContent='留影准备失败：'+message(error);controls();}
  }
  life.on(retry,'click',()=>{if(!blocked)prepare();});
  life.on(png,'click',()=>{
    if(png.disabled||!exporter||!project)return;const token=generation,source=exporter,summary=reunionSummary(project)!;encoding=true;operation.textContent='正在生成 PNG…';controls();
    void source.toBlob().then(blob=>{
      if(disposed||token!==generation)return;
      if(blocked)throw new Error('作品正在导入或处理，请完成后重新下载留影。');
      downloads.add(downloadResultBlob(blob,'yingzuo-'+summary.runId.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,70)+'-'+(summary.ending??'reunion')+'.png'));operation.textContent='已向浏览器请求下载 PNG，请核对下载列表。';
    }).catch(error=>{if(!disposed&&token===generation)operation.textContent='PNG 下载未完成：'+message(error);}).finally(()=>{if(!disposed&&token===generation){encoding=false;controls();}});
  });
  life.on(json,'click',()=>{
    if(json.disabled||!project)return;
    try{downloads.add(downloadJSON(exportProjectJSON(project),'yingzuo-reunion-project.json'));operation.textContent='已向浏览器请求下载本场 JSON，请核对下载列表。';}
    catch(error){operation.textContent='JSON 下载未完成：'+message(error);}
  });
  life.on(replayButton,'click',()=>{
    if(replayButton.disabled||!project)return;
    if(replay){closeReplay();return;}
    try{replay=mountReunionReplay(replaySlot,project);replay.setBlocked(blocked);replayButton.textContent='收起编排重演';replayButton.setAttribute('aria-expanded','true');}
    catch(error){clear(replaySlot);operation.textContent='重演未启动：'+message(error);}
  });
  return {
    update(state){
      if(disposed)return;const result=state.project?reunionSummary(state.project):null;
      blocked=ctx.isBusy()||state.hasPending||!result||['loading','closed','unsupported','recovery','conflict'].includes(state.status);
      const key=result?JSON.stringify([state.project!.projectId,state.project!.title,state.project!.story!.mode,result]):'';
      if(identity!==key){disposeArtifact();identity=key;project=result?state.project:null;if(project)prepare();else operation.textContent='';}
      project=result?state.project:null;figure.hidden=!result;actions.hidden=!result;id.hidden=!result;saveState.hidden=!result;
      head.querySelector('h1')!.textContent=result?'这一回，终于相见。':'这一场，还在路上。';title.textContent=result?'一幕团圆 · 本场已团圆':'先把这一场，慢慢演完。';
      head.querySelector('.page-lead')!.textContent=result?'把母子相见的这一刻，留在同一张幕上。':'团圆之后，属于这一场的造型、选择与协作会在这里留下。';
      resume.href=continueHash(state.project);clear(details);
      const ending=endingFor(state.project?.story);
      if(ending){head.querySelector('h1')!.textContent=ending.title;title.textContent='本场终章 · '+ending.title;head.querySelector('.page-lead')!.textContent=ending.summary;caption.textContent='1600 × 1200 · 本场终章留影';png.textContent='下载终章留影 PNG';}
      const path=result?definitionFor(state.project?.story).nodes.filter(node=>node.actors.includes('chenxiang')&&node.kind==='interaction'&&node.id!=='craft'&&(node.prerequisites.approach===null||node.prerequisites.approach===result.approach)&&(!node.prerequisites.ending||node.prerequisites.ending===result.ending)):[];
      const rows:[string,string][]=result?[
        ['角色','沉香、母亲（三圣母）；沉香由你操作或明确选择协助，母亲由程序编排'],
        ['纹样',patternLabel(result.castSnapshot.appearance.patternId)],['配色',paletteLabel(result.castSnapshot.appearance.paletteId)],
        ['本场终章',ending?.title??'一幕团圆'],['这一次的选择',result.approach==='call-first'?'先举灯呼唤':'先挥斧开山'],['造型来源',result.presetAppearanceUsed?'采用默认影偶':'使用已编辑的造型'],
        ['亲手完成的片段',path.filter(node=>!result.assistedNodeIds.includes(node.id)).map(node=>node.title).join('、')||'本场操作片段均采用明确协助'],
        ['使用协助的片段',result.assistedNodeIds.length?result.assistedNodeIds.map(nodeId=>definitionFor(state.project?.story).nodes.find(node=>node.id===nodeId)!.title).join('、'):'未记录协助'],
        ['终章完成时间',new Date(result.completedAt).toLocaleString()],['谢幕',state.project?.story?.nodeId==='completed'?'已经看完':'团圆已保存，谢幕尚未结束'],['创作署名','零组 · 张宇翔（SpaceFly）'],
      ]:[['当前进度',state.project?.story?definitionFor(state.project?.story).nodes.find(node=>node.id===state.project!.story!.nodeId)!.title:'尚未开演']];
      for(const [label,value]of rows)append(details,element('dt','',label),element('dd','',value));
      id.textContent=result?'本场成果 · '+result.id:'';
      saveState.textContent=['error','memory','unsaved','saving'].includes(state.status)?'当前作品仍有未保存更改；PNG 与本场 JSON 可带走当前已应用的演出记录。':'本场演出记录已保存，留影与只读重演沿用冻结造型。';
      replay?.setBlocked(blocked);controls();
    },
    dispose(){if(disposed)return;disposed=true;life.dispose();disposeArtifact();project=null;},
  };
};
