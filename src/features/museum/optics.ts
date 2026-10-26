import {assetCatalog} from '../../content/catalog';
import {constrainPoseToStage} from '../../domain/pose';
import {projectionParameters} from '../../domain/projection';
import type {ProjectV1} from '../../domain/types';
import {canvasStage} from '../shared/canvas-stage';
import {append,element,scope} from '../shared/dom';
import {museumPreviewFrame} from './demo-geometry';
import {mountLightDiagram} from './light-diagram';

/** The optical experiment differs from E01: vary one condition beside the ray diagram. */
export function mountMuseumOptics(host:HTMLElement){
 const life=scope(),root=element('section','museum-demo museum-optics');root.id='museum-demo-root';root.dataset.kind='light';
 const diagram=mountLightDiagram(),stage=canvasStage('用上方几何图，对照二维幕影的偏移与放大。',{spatial:false}),layout=element('div','museum-optics-layout'),card=element('section','surface-card'),field=element('fieldset'),reading=element('p','selection-summary'),reset=element('button','button secondary','重置演示');reading.id='museum-demo-reading';reading.setAttribute('role','status');reset.id='museum-demo-reset';field.appendChild(element('legend','','只改一个条件，看两条光线'));
 const ranges=new Map<string,HTMLInputElement>(),outputs=new Map<string,HTMLOutputElement>();let frame=museumPreviewFrame(null),identity='',disposed=false;
 for(const [id,label,min,max,initial]of [['museum-lamp','灯的左右位置',-.8,.8,0],['museum-distance','影偶离幕的距离',.05,.4,.2],['museum-lamp-depth','灯离幕的距离',1.2,2.4,1.2]]as const){const row=element('label','range-control',label),input=element('input'),output=element('output');input.id=id;input.type='range';input.min=String(min);input.max=String(max);input.step='.01';input.value=String(initial);input.setAttribute('aria-label',label);output.setAttribute('for',id);ranges.set(id,input);outputs.set(id,output);append(row,output,input);field.appendChild(row);life.on(input,'input',render);}
 function render(){if(disposed)return;const stageConfig={...frame.stage,lampX:Number(ranges.get('museum-lamp')!.value),puppetDistance:Number(ranges.get('museum-distance')!.value),lampGeometry:{version:1 as const,depth:Number(ranges.get('museum-lamp-depth')!.value)}};diagram.update(stageConfig);stage.update(()=>{const actor=frame.actors[0]!,template=assetCatalog.puppets.find(t=>t.id===actor.templateId)!,fit=constrainPoseToStage(actor.pose,template,stageConfig);if(!fit.fits)throw new Error('几何实验尚未就绪，请重置后重试。');return {...frame,stage:stageConfig,actors:[{...actor,pose:fit.pose}]};});for(const [id,input]of ranges)outputs.get(id)!.textContent=Number(input.value).toFixed(2);reading.textContent=`参考截面保持等宽 · 投影倍率 ${projectionParameters(stageConfig).magnification.toFixed(2)}×。蓝线是偶，红线是影，两条光线说明它们的关系。`;}
 life.on(reset,'click',()=>{ranges.get('museum-lamp')!.value='0';ranges.get('museum-distance')!.value='.2';ranges.get('museum-lamp-depth')!.value='1.2';render();});append(card,field,reading,reset);append(layout,diagram.figure,card);append(root,element('h3','','从光线读懂影子的变化'),layout,stage.figure);host.appendChild(root);render();
 return {update(project:ProjectV1|null){const key=JSON.stringify(project?.story?.castSnapshot?.appearance??null);if(key===identity)return;identity=key;frame=museumPreviewFrame(project);render();},dispose(){if(disposed)return;disposed=true;life.dispose();diagram.dispose();stage.dispose();if(root.parentNode)root.parentNode.removeChild(root);}};
}
