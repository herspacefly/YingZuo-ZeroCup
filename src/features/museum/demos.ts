import { assetCatalog } from '../../content/catalog';
import { constrainPoseToStage } from '../../domain/pose';
import { projectionParameters } from '../../domain/projection';
import type { ProjectV1 } from '../../domain/types';
import { canvasStage } from '../shared/canvas-stage';
import { append, element, scope } from '../shared/dom';
import { cloneMuseumAppearance as cloneAppearance, museumPreviewFrame } from './demo-geometry';
import { mountLightDiagram } from './light-diagram';

export { museumPreviewFrame } from './demo-geometry';

export type MuseumCanvasDemo = 'layers' | 'carving' | 'joints' | 'light';

const template = assetCatalog.puppets.find(item => item.id === 'chenxiang-v1')!;

/** Temporary exhibit experiments; no Store, saved pose, clock or animation callback. */
export function mountMuseumDemo(host: HTMLElement, kind: MuseumCanvasDemo) {
  const life = scope(), root = element('section', `museum-demo museum-demo-${kind}`);
  root.id = 'museum-demo-root'; root.setAttribute('data-kind', kind);
  root.setAttribute('aria-label', { layers: '色影分层示意', carving: '镂空前后对比', joints: '关节与三杆演示', light: '灯影几何实验' }[kind]);
  const layout = element('div', 'workspace museum-demo-workspace'), panel = element('div', 'control-panel');
  const stage = canvasStage('沉香 · 复用剧场的影偶、刻纹遮罩与灯影投影。当前为原创皮影风格设计稿。');
  const field = element('fieldset'), legend = element('legend', '', { layers: '把色影翻到背面', carving: '同一纹样，刻前与刻后', joints: '抬肩，再弯肘', light: '挪灯，或改变偶幕距离' }[kind]);
  field.appendChild(legend);
  const reading = element('p', 'selection-summary'); reading.id = 'museum-demo-reading'; reading.setAttribute('role', 'status');
  const note = element('p', 'quiet-note', '这里只临时试一试，不修改行装、练习姿态、灯影编辑稿或剧情进度。');
  const reset = element('button', 'button secondary', '重置演示'); reset.type = 'button'; reset.id = 'museum-demo-reset';
  append(panel, field, reading, reset, note); append(layout, stage.figure, panel); root.appendChild(layout); host.appendChild(root);
  let disposed = false, identity = '', base = museumPreviewFrame(null), local = museumPreviewFrame(null);
  let carved = false, layersOpen = false;
  const ranges = new Map<string, { input: HTMLInputElement; output: HTMLOutputElement }>();
  const partImages:HTMLImageElement[]=[];
  let layerDiagram: HTMLOListElement | null = null, layerToggle: HTMLButtonElement | null = null, carveToggle: HTMLButtonElement | null = null;
  const lightDiagram = kind === 'light' ? mountLightDiagram() : null;

  function range(label: string, id: string, min: number, max: number, step: number, change: (value: number) => void) {
    const group = element('label', 'range-control', label), input = element('input'), output = element('output');
    input.type = 'range'; input.id = id; input.min = String(min); input.max = String(max); input.step = String(step); input.setAttribute('aria-label', label); output.setAttribute('for', id);
    append(group, output, input); field.appendChild(group); ranges.set(id, { input, output });
    const handle = () => { if (!disposed) { change(Number(input.value)); render(); } };
    life.on(input, 'input', handle); life.on(input, 'change', handle);
  }
  if (kind === 'layers') {
    layerToggle = element('button', 'button secondary', '展开横截面'); layerToggle.type = 'button'; layerToggle.id = 'museum-layer-toggle';
    layerToggle.setAttribute('aria-expanded', 'false'); layerToggle.setAttribute('aria-controls', 'museum-layer-diagram');
    const diagram = element('figure', 'museum-demo-section'), caption = element('figcaption', '', '从灯到幕的顺序示意；各层间距不代表实际比例。');
    layerDiagram = element('ol', 'museum-demo-layers'); layerDiagram.id = 'museum-layer-diagram';
    for (const [label, detail] of [['光', '灯照向影偶，再到幕前。'], ['皮料', '轮廓和镂空一起留下明暗。'], ['颜色', '本作以颜色区与遮罩表现彩色影像。'], ['幕', '观众在幕上看见色影。']]) {
      const layer = element('li', 'museum-demo-layer'); append(layer, element('strong', '', label), element('span', '', detail)); layerDiagram.appendChild(layer);
    }
    append(diagram, layerDiagram, caption); append(field, layerToggle, diagram);
    life.on(layerToggle, 'click', () => { if (!disposed) { layersOpen = !layersOpen; render(); } });
  } else if (kind === 'carving') {
    carveToggle = element('button', 'button secondary', '看已刻成影'); carveToggle.type = 'button'; carveToggle.id = 'museum-carve-toggle'; carveToggle.setAttribute('aria-pressed', 'false'); field.appendChild(carveToggle);
    field.appendChild(element('p', 'quiet-note', '“未刻”关闭三段镂空；“已刻”揭开同一原创纹样的全部三段。颜色、灯位与姿态保持相同。'));
    life.on(carveToggle, 'click', () => { if (!disposed) { carved = !carved; render(); } });
  } else if (kind === 'joints') {
    const shoulder = template.joints.find(joint => joint.jointId === 'rightShoulder')!, elbow = template.joints.find(joint => joint.jointId === 'rightElbow')!;
    range('右肩转动', 'museum-shoulder', shoulder.minRad, shoulder.maxRad, .01, value => { local.actors[0]!.pose.joints.rightShoulder = value; });
    range('右肘弯曲', 'museum-elbow', elbow.minRad, elbow.maxRad, .01, value => { local.actors[0]!.pose.joints.rightElbow = value; });
    const connections = element('dl', 'museum-demo-connections');
    for (const [label, detail] of [['身杆', '连接衣身，带动整只影偶的位置。'], ['左手杆', '连接左前臂，牵动左肩与左肘。'], ['右手杆', '连接右前臂，牵动右肩与右肘。'], ['金色圆点', '幕上标出这只数字影偶的九处关节。']]) append(connections, element('dt', '', label), element('dd', '', detail));
    const parts = element('ul', 'museum-demo-parts'); parts.setAttribute('aria-label', '本作沉香的十个数字部件');
    const labels: Record<string, string> = { torso: '衣身', head: '头', leftUpperArm: '左上臂', leftForearm: '左前臂', rightUpperArm: '右上臂', rightForearm: '右前臂', leftThigh: '左大腿', leftShin: '左小腿', rightThigh: '右大腿', rightShin: '右小腿' };
    for(const part of template.parts){
      const name=labels[part.partId]??part.partId,item=element('li'),image=element('img'),label=element('span','',name),status=element('span','quiet-note');
      item.setAttribute('data-part',part.partId);image.alt=`${name} · 本作数字影偶部件底图`;image.width=72;image.height=72;
      const asset=assetCatalog.manifest.assets.find(asset=>asset.id===part.colorAssetId)!;
      life.on(image,'error',()=>{image.hidden=true;status.textContent=`${name}底图暂未载入，可重新打开本展签。`;});
      image.src=asset.path;partImages.push(image);append(item,image,label,status);parts.appendChild(item);
    }
    append(field, connections, parts, element('p','quiet-note','上方分列本作十个部件的底图；本场配色以幕面为准。'),element('p', 'quiet-note', '右肩带动整条右臂；右肘只转动前臂。十部件、九关节与三根杆是本作的数字简化，并非各地影偶的统一制式。'));
  } else {
    range('灯的左右位置', 'museum-lamp', -.8, .8, .01, value => { local.stage.lampX = value; });
    range('影偶离幕的距离', 'museum-distance', .05, .4, .01, value => { local.stage.puppetDistance = value; });
    field.appendChild(lightDiagram!.figure);
    field.appendChild(element('p', 'quiet-note', '向左移灯，影子向右偏；让影偶远离幕，影子变大。边缘会临时适配幕面。这是本作的几何示意，不模拟皮料的完整光学性质。'));
  }

  function setRange(id: string, value: number, label: string) {
    const control = ranges.get(id); if (control) { control.input.value = String(value); control.output.textContent = label; }
  }
  function render() {
    if (disposed) return;
    stage.update(() => {
      const pose = local.actors[0]!.pose, fit = constrainPoseToStage(pose, template, local.stage);
      if (!fit.fits) throw new Error('当前姿态无法完整放入幕面，请调整关节、灯位，或重置演示后重试。');
      const actor = local.actors[0]!;
      if (actor.actorId !== 'chenxiang') throw new Error('展品示例角色不匹配，请重置演示。');
      const appearance = cloneAppearance(actor.appearance);
      if (kind === 'carving') appearance.carvedSegments = [carved, carved, carved];
      return { actors: [{ ...actor, costumeTreatment:kind==='carving'?'legacy-motif':'original-texture', appearance, pose: fit.pose }], stage: { ...local.stage }, attachments: [], showRods: kind === 'joints' };
    });
    if (layerDiagram && layerToggle) {
      layerDiagram.setAttribute('data-expanded', String(layersOpen)); layerToggle.setAttribute('aria-expanded', String(layersOpen)); layerToggle.textContent = layersOpen ? '合上横截面' : '展开横截面';
      reading.textContent = layersOpen ? '已展开：光经过影偶到达幕面。皮料与颜色在影偶上，幕上色影由同一数字影偶生成。' : '横截面已合上。点“展开”可分开查看光、皮料、颜色与幕。';
    } else if (carveToggle) {
      carveToggle.setAttribute('aria-pressed', String(carved)); carveToggle.textContent = carved ? '看未刻成影' : '看已刻成影';
      reading.textContent = carved ? '已刻 · 三段镂空透出幕光。切回未刻，可比较衣身同一位置。' : '未刻 · 衣身暂时保留完整色块。点击看同一道纹样刻开后的成影。';
    } else if (kind === 'joints') {
      const joints = local.actors[0]!.pose.joints, shoulder = Math.round(joints.rightShoulder * 180 / Math.PI), elbow = Math.round(joints.rightElbow * 180 / Math.PI);
      setRange('museum-shoulder', joints.rightShoulder, `${shoulder}°`); setRange('museum-elbow', joints.rightElbow, `${elbow}°`);
      reading.textContent = `右肩 ${shoulder}°，右肘 ${elbow}°。幕上细杆连接衣身和两只手，金色圆点显示真实关节位置。`;
    } else {
      const { lampX, magnification } = projectionParameters(local.stage);
      lightDiagram!.update(local.stage);
      setRange('museum-lamp', lampX, lampX === 0 ? '居中' : `${lampX < 0 ? '左' : '右'} ${Math.round(Math.abs(lampX) / .8 * 100)}%`);
      setRange('museum-distance', local.stage.puppetDistance, `${Math.round((local.stage.puppetDistance - .05) / .35 * 100)}%（近 → 远）`);
      reading.textContent = `几何倍率 ${magnification.toFixed(2)}×。与剧情寻光使用同一套投影计算。`;
    }
  }
  function resetDemo() { local = { ...base, actors: base.actors.map(actor => actor.actorId === 'chenxiang' ? { ...actor, appearance: cloneAppearance(actor.appearance), pose: { ...actor.pose, joints: { ...actor.pose.joints } } } : actor), stage: { ...base.stage } }; carved = false; layersOpen = false; render(); }
  life.on(reset, 'click', resetDemo);
  render();
  return {
    update(project: ProjectV1 | null) {
      if (disposed) return;
      const next = JSON.stringify([project?.projectId ?? null, project?.story?.runId ?? null, project?.story?.castSnapshot?.appearance ?? null]);
      if (next === identity) return;
      identity = next; base = museumPreviewFrame(project); resetDemo();
    },
    dispose() { if (disposed) return; disposed = true; life.dispose();for(const image of partImages)image.removeAttribute('src');partImages.length=0;lightDiagram?.dispose(); stage.dispose(); if (root.parentNode) root.parentNode.removeChild(root); },
  };
}
