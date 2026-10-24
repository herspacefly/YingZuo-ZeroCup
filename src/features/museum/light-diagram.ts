import { projectPoint, projectionParameters } from '../../domain/projection';
import type { StageConfig } from '../../domain/types';
import { append, element } from '../shared/dom';

const NS = 'http://www.w3.org/2000/svg';

/** A top view of a fixed reference section. Its screen endpoints share the stage's projection. */
export function mountLightDiagram() {
  const figure = element('figure', 'museum-demo-section museum-light-diagram');
  const heading = element('h3', '', '从上方看：灯—偶—幕');
  const svg = document.createElementNS(NS, 'svg'); svg.id = 'museum-light-diagram';
  svg.setAttribute('viewBox', '0 0 400 300'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', 'museum-light-diagram-title museum-light-diagram-description');
  svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.display = 'block';
  svg.setAttribute('font-size', '14'); svg.setAttribute('font-family', 'inherit'); svg.setAttribute('fill', 'currentColor');
  const title = document.createElementNS(NS, 'title'), description = document.createElementNS(NS, 'desc');
  title.id = 'museum-light-diagram-title'; title.textContent = '灯、影偶参考截面与幕的俯视几何关系';
  description.id = 'museum-light-diagram-description'; svg.appendChild(title); svg.appendChild(description);
  function line(color: string, width: number) {
    const node = document.createElementNS(NS, 'line'); node.setAttribute('stroke', color); node.setAttribute('stroke-width', String(width)); svg.appendChild(node); return node;
  }
  function label(text: string, x: number, y: number) {
    const node = document.createElementNS(NS, 'text'); node.textContent = text; node.setAttribute('x', String(x)); node.setAttribute('y', String(y)); svg.appendChild(node); return node;
  }
  const rays = [line('#a26a42', 1.5), line('#a26a42', 1.5)]; rays.forEach(ray => ray.setAttribute('data-light-ray', ''));
  const curtain = line('currentColor', 2), shadow = line('#b83b30', 7), section = line('#314c58', 7);
  shadow.setAttribute('data-reference-shadow', ''); section.setAttribute('data-reference-section', '');
  curtain.setAttribute('x1', '335'); curtain.setAttribute('x2', '335'); curtain.setAttribute('y1', '35'); curtain.setAttribute('y2', '255');
  const lamp = document.createElementNS(NS, 'circle'); lamp.setAttribute('r', '6'); lamp.setAttribute('fill', '#d7a253'); lamp.setAttribute('stroke', 'currentColor'); svg.appendChild(lamp);
  const lampLabel = label('灯', 45, 40), sectionLabel = label('偶', 0, 70); label('幕', 345, 40);
  label('深度 1.20', 16, 285); label('幕深度 0', 300, 285);
  const depth = line('currentColor', 1); depth.setAttribute('x1', '45'); depth.setAttribute('x2', '335'); depth.setAttribute('y1', '267'); depth.setAttribute('y2', '267');
  const caption = element('figcaption'), width = element('p', 'quiet-note'), note = element('p', 'quiet-note', '几何示意：蓝线是固定宽 0.40 示意单位的参考截面，红线是它的影宽；实际影偶轮廓见幕面。');
  width.id = 'museum-reference-shadow-width'; append(caption, width, note); append(figure, heading); figure.appendChild(svg); figure.appendChild(caption);
  let disposed = false;
  return {
    figure,
    update(stage: StageConfig) {
      if (disposed) return;
      const { lampX, lampDepth } = projectionParameters(stage);
      const distance = Number.isFinite(stage.puppetDistance) ? Math.max(.05, Math.min(.4, stage.puppetDistance)) : .2;
      const sectionX = 335 - distance / lampDepth * 290, lampY = 145 - lampX * 105;
      const endpoints = [-.2, .2].map(x => projectPoint({ x, y: 0 }, stage));
      rays.forEach((ray, index) => {
        ray.setAttribute('x1', '45'); ray.setAttribute('y1', String(lampY)); ray.setAttribute('x2', '335'); ray.setAttribute('y2', String(145 - endpoints[index]!.x * 105));
      });
      lamp.setAttribute('cx', '45'); lamp.setAttribute('cy', String(lampY)); lampLabel.setAttribute('y', String(lampY - 12));
      section.setAttribute('x1', String(sectionX)); section.setAttribute('x2', String(sectionX)); section.setAttribute('y1', '166'); section.setAttribute('y2', '124');
      sectionLabel.setAttribute('x', String(sectionX - 7));
      shadow.setAttribute('x1', '335'); shadow.setAttribute('x2', '335'); shadow.setAttribute('y1', String(145 - endpoints[0]!.x * 105)); shadow.setAttribute('y2', String(145 - endpoints[1]!.x * 105));
      const shadowWidth = endpoints[1]!.x - endpoints[0]!.x;
      width.textContent = `偶幕距离 ${distance.toFixed(2)}；幕前参考影宽 ${shadowWidth.toFixed(2)} 示意单位。`;
      description.textContent = `横轴为深度。灯距幕 ${lampDepth.toFixed(2)}，灯的横向位置 ${lampX.toFixed(2)}；影偶参考截面距幕 ${distance.toFixed(2)}，固定宽 0.40；两条光线在幕上的端点为 ${endpoints[0]!.x.toFixed(2)} 和 ${endpoints[1]!.x.toFixed(2)}，影宽 ${shadowWidth.toFixed(2)}。`;
    },
    dispose() { disposed = true; if (figure.parentNode) figure.parentNode.removeChild(figure); },
  };
}
