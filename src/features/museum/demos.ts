import { assetCatalog } from '../../content/catalog';
import { constrainPoseToStage } from '../../domain/pose';
import type { ProjectV1 } from '../../domain/types';
import { canvasStage } from '../shared/canvas-stage';
import { append, element, scope } from '../shared/dom';
import { museumPreviewFrame } from './demo-geometry';
import { mountMuseumLamp } from './lamp-demo';
import { mountMuseumCarving } from './carving';
export { museumPreviewFrame } from './demo-geometry';
export type MuseumCanvasDemo='layers'|'carving'|'joints'|'light';

export function mountMuseumDemo(host:HTMLElement,kind:MuseumCanvasDemo){
  if(kind==='layers'||kind==='light')return mountMuseumLamp(host);
  if(kind==='carving')return mountMuseumCarving(host);
  const life=scope(),root=element('section','museum-demo museum-demo-joints');root.id='museum-demo-root';root.dataset.kind='joints';
  const layout=element('div','workspace museum-demo-workspace'),panel=element('div','control-panel'),stage=canvasStage('拖动右肩、右肘的滑块，沿着金色关节看部件怎样一起转动。');
  const field=element('fieldset');field.appendChild(element('legend','','抬肩，再弯肘'));
  const reading=element('p','selection-summary');reading.id='museum-demo-reading';reading.setAttribute('role','status');const reset=element('button','button secondary','重置演示');reset.id='museum-demo-reset';
  append(panel,field,reading,reset);append(layout,stage.figure,panel);root.appendChild(layout);
  const details=element('div','museum-joint-details'),connections=element('section','surface-card'),dl=element('dl','museum-demo-connections');connections.appendChild(element('h3','','三根杆，各牵一处'));
  for(const [label,detail]of [['身杆','连接衣身，带动整只影偶的位置。'],['左手杆','牵动左肩与左肘。'],['右手杆','牵动右肩与右肘。'],['金色圆点','标出这只数字影偶的九处关节。']])append(dl,element('dt','',label),element('dd','',detail));connections.appendChild(dl);
  const partsCard=element('section','surface-card museum-parts-card'),parts=element('ul','museum-demo-parts');partsCard.appendChild(element('h3','','拆开看：十个部件怎样相接'));parts.setAttribute('aria-label','沉香的十个数字部件');
  const template=assetCatalog.puppets.find(item=>item.id==='chenxiang-v1')!,images:HTMLImageElement[]=[];
  const names:Record<string,string>={torso:'衣身',head:'头',leftUpperArm:'左上臂',leftForearm:'左前臂',rightUpperArm:'右上臂',rightForearm:'右前臂',leftThigh:'左大腿',leftShin:'左小腿',rightThigh:'右大腿',rightShin:'右小腿'};
  for(const part of template.parts){const item=element('li'),image=element('img'),note=element('span','quiet-note');image.alt=names[part.partId]??part.partId;image.width=image.height=72;image.loading='lazy';image.src=assetCatalog.manifest.assets.find(a=>a.id===part.colorAssetId)!.path;life.on(image,'error',()=>{image.hidden=true;note.textContent='底图暂未载入，请重新打开展签。';});images.push(image);append(item,image,element('span','',image.alt),note);parts.appendChild(item);}
  append(partsCard,parts,element('p','quiet-note','右肩带动整条右臂，右肘只转动前臂。十部件、九关节与三根杆是本作的简化结构，不是各地影偶的统一制式。'));append(details,connections,partsCard);root.appendChild(details);host.appendChild(root);
  let disposed=false,identity='',base=museumPreviewFrame(null),local=museumPreviewFrame(null);const ranges=new Map<string,HTMLInputElement>(),outputs=new Map<string,HTMLOutputElement>();
  for(const [joint,label,id]of [['rightShoulder','右肩转动','museum-shoulder'],['rightElbow','右肘弯曲','museum-elbow']]as const){const bounds=template.joints.find(j=>j.jointId===joint)!,group=element('label','range-control',label),input=element('input'),output=element('output');input.type='range';input.id=id;input.min=String(bounds.minRad);input.max=String(bounds.maxRad);input.step='.01';input.setAttribute('aria-label',label);output.setAttribute('for',id);append(group,output,input);field.appendChild(group);ranges.set(joint,input);outputs.set(joint,output);life.on(input,'input',()=>{local.actors[0]!.pose.joints[joint]=Number(input.value);render();});}
  function render(){if(disposed)return;stage.update(()=>{const actor=local.actors[0]!,fit=constrainPoseToStage(actor.pose,template,local.stage);if(!fit.fits)throw new Error('姿态暂未放入幕面，请重置重试。');return {...local,actors:[{...actor,pose:fit.pose}],showRods:true};});for(const [joint,input]of ranges){const value=local.actors[0]!.pose.joints[joint as 'rightShoulder'|'rightElbow'];input.value=String(value);outputs.get(joint)!.textContent=`${Math.round(value*180/Math.PI)}°`;}reading.textContent='先只转右肩，再只弯右肘：看哪一段跟着动，哪一段留在原处。';}
  function resetLocal(){local=JSON.parse(JSON.stringify(base)) as typeof base;render();}life.on(reset,'click',resetLocal);render();
  return {update(project:ProjectV1|null){const key=JSON.stringify([project?.projectId,project?.story?.castSnapshot?.appearance]);if(key===identity)return;identity=key;base=museumPreviewFrame(project);resetLocal();},dispose(){if(disposed)return;disposed=true;life.dispose();for(const image of images)image.removeAttribute('src');stage.dispose();if(root.parentNode)root.parentNode.removeChild(root);}};
}
