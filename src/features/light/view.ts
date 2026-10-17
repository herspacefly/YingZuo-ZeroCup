import { append, element, link, scope } from '../shared/dom';
import { editable, heading, pageLinks } from '../shared/pieces';
import { canvasStage, editorFrame } from '../shared/canvas-stage';
import { projectionParameters } from '../../domain/projection';
import type { PageFactory } from '../../app/view';
import type { StoreState } from '../../app/store';

export const mountLight:PageFactory=(host,ctx)=>{
  const life=scope();append(host,heading('一束光','移一盏灯，看影子回应。','左右移灯，影子会向另一侧偏移；让影偶离幕远一点，影子会更大。这是本作的几何灯影示意。'),pageLinks());
  const layout=element('section','workspace light-workspace'),panel=element('div','control-panel'),field=element('fieldset');field.appendChild(element('legend','','灯与幕之间'));
  let state:StoreState|null=null;
  const allowed=()=>!!state&&editable(state)&&!ctx.isBusy();
  const lamp=element('input'),distance=element('input'),lampOutput=element('output'),distanceOutput=element('output');
  function range(label:string,input:HTMLInputElement,output:HTMLOutputElement,id:string,min:number,max:number,step:number,change:(value:number)=>void){
    const group=element('label','range-control',label);input.type='range';input.id=id;input.min=String(min);input.max=String(max);input.step=String(step);input.setAttribute('aria-label',label);output.setAttribute('for',id);append(group,output,input);field.appendChild(group);
    const update=()=>{if(allowed())change(Number(input.value));};life.on(input,'input',update);life.on(input,'change',update);
  }
  range('灯的左右位置',lamp,lampOutput,'light-lamp',-.8,.8,.01,value=>ctx.edit({type:'LAMP_X',lampX:value}));
  const lampPad=element('div','direction-pad');lampPad.setAttribute('role','group');lampPad.setAttribute('aria-label','逐步移动灯位');
  range('影偶离幕的距离',distance,distanceOutput,'light-distance',.05,.4,.01,value=>ctx.edit({type:'PUPPET_DISTANCE',puppetDistance:value}));
  const distancePad=element('div','direction-pad');distancePad.setAttribute('role','group');distancePad.setAttribute('aria-label','逐步改变偶幕距离');
  for(const [label,kind,delta]of [['灯向左','lamp',-.05],['灯向右','lamp',.05],['影偶贴近幕','distance',-.01],['影偶远离幕','distance',.01]] as const){
    const button=element('button','',label);(kind==='lamp'?lampPad:distancePad).appendChild(button);life.on(button,'click',()=>{
      if(!allowed())return;const current=ctx.store.getExportProject()!.stage;
      if(kind==='lamp')ctx.edit({type:'LAMP_X',lampX:Math.max(-.8,Math.min(.8,Math.round((current.lampX+delta)*100)/100))});
      else ctx.edit({type:'PUPPET_DISTANCE',puppetDistance:Math.max(.05,Math.min(.4,Math.round((current.puppetDistance+delta)*100)/100))});
    });
  }
  field.insertBefore(lampPad,distance.parentElement);field.appendChild(distancePad);
  const reset=element('button','button secondary','重置灯位与距离'),save=element('button','button secondary','保存灯影设置'),summary=element('p','selection-summary');summary.id='light-summary';
  append(field,reset);append(panel,field,summary,save,element('p','quiet-note','这些设置只编辑灯影实验，不改本场节点的灯位。边缘处预览会临时适配幕面，不回写练习姿态。'),link('去看“一盏灯，两种尺度” →','#/museum/E04'));
  const stage=canvasStage('沉香 · 同一影偶、遮罩与投影。倍率按灯、影偶和幕的相对距离计算。');append(layout,stage.figure,panel);host.appendChild(layout);
  life.on(reset,'click',()=>{if(allowed())void ctx.run(async()=>{await ctx.store.edit({type:'LAMP_X',lampX:0});await ctx.store.edit({type:'PUPPET_DISTANCE',puppetDistance:.2});});});
  life.on(save,'click',()=>{if(allowed()&&!state!.hasPending)void ctx.run(()=>ctx.store.flush());});
  return {update(next){state=next;field.disabled=!allowed();save.disabled=!allowed()||next.hasPending||next.status==='saving';
    const project=ctx.store.getExportProject()??next.project;stage.update(()=>project?editorFrame(project):null);if(!project){summary.textContent='先处理作品存档，再继续灯影实验。';return;}
    lamp.value=String(project.stage.lampX);distance.value=String(project.stage.puppetDistance);
    lampOutput.textContent=project.stage.lampX===0?'居中':`${project.stage.lampX<0?'左':'右'} ${Math.round(Math.abs(project.stage.lampX)/.8*100)}%`;
    distanceOutput.textContent=`${Math.round((project.stage.puppetDistance-.05)/.35*100)}%（近 → 远）`;
    summary.textContent=`几何倍率 ${projectionParameters(project.stage).magnification.toFixed(2)}×。保存状态见顶部；${next.status==='memory'||next.status==='error'?'当前稿可导出，明确保存才尝试写入。':'调整会自动保存到编辑稿。'}`;
  },dispose(){life.dispose();stage.dispose();}};
};
