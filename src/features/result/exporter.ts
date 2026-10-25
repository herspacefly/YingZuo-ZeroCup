import { definitionFor } from '../../content/reunion';
import { assetCatalog } from '../../content/catalog';
import { mountCanvasRenderer } from '../../renderers/canvas/renderer';
import type { ReunionArtifact } from './artifact';

export interface ReunionExporter {
  canvas: HTMLCanvasElement;
  ready: Promise<void>;
  toBlob(): Promise<Blob>;
  dispose(): void;
}

type LegacyCanvas = HTMLCanvasElement & { msToBlob?: () => Blob };
const errorFor = (value: unknown) => value instanceof Error ? value : new Error(String(value));
const closedError = () => new Error('留影页面已离开，已取消准备或编码。');

/** Uses the same scene renderer once, then adds a programme border to a fixed-size PNG canvas. */
export function mountReunionExporter(host: HTMLElement, artifact: ReunionArtifact): ReunionExporter {
  const snapshot = JSON.parse(JSON.stringify(artifact)) as ReunionArtifact;
  const canvas = document.createElement('canvas');
  canvas.width = 1600; canvas.height = 1200; canvas.className = 'reunion-artifact';
  canvas.setAttribute('role', 'img');
  const ending=snapshot.summary.ending?definitionFor(snapshot.summary).endings!.find(e=>e.id===snapshot.summary.ending):null;
  canvas.setAttribute('aria-label',ending?ending.title+'：'+ending.summary:'一幕团圆留影：沉香与母亲伸手相见，使用本场冻结造型。');
  canvas.setAttribute('data-state', 'loading');
  host.appendChild(canvas);
  // Hidden source dimensions fall back to the renderer's normal 1024×768 backing canvas.
  // Composition scales this complete 4:3 image without a second puppet drawing implementation.
  const sourceHost = document.createElement('div'); sourceHost.hidden = true; sourceHost.setAttribute('aria-hidden', 'true');
  host.appendChild(sourceHost);
  let source: ReturnType<typeof mountCanvasRenderer> | null = null;
  let disposed = false, settled = false;
  let resolveReady!: () => void, rejectReady!: (error: Error) => void;
  const pending = new Set<(error: Error) => void>();
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // Disposal during loading must not create an unhandled rejection before the UI attaches its handler.
  void ready.catch(() => {});

  function releaseSource() {
    if (source) { source.dispose(); source = null; }
    if (sourceHost.parentNode) sourceHost.parentNode.removeChild(sourceHost);
  }
  function fail(value: unknown) {
    if (settled || disposed) return;
    settled = true; canvas.setAttribute('data-state', 'error'); releaseSource(); rejectReady(errorFor(value));
  }
  function compose(image: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('此浏览器无法绘制团圆留影，仍可保存可恢复的作品文件。');
    const summary = snapshot.summary, appearance = summary.castSnapshot.appearance;
    const pattern = summary.definitionVersion===4?'精细原画':assetCatalog.patterns.patterns.find(item => item.id === appearance.patternId)!.label;
    const palette = assetCatalog.palettes.palettes.find(item => item.id === appearance.paletteId)!.label;
    const route = summary.approach === 'call-first' ? '先呼唤，再开山' : '先开山，再寻光';
    ctx.fillStyle = '#f2e5c9'; ctx.fillRect(0, 0, 1600, 1200);
    ctx.strokeStyle = '#a26a42'; ctx.lineWidth = 2; ctx.strokeRect(28, 28, 1544, 1144);
    ctx.fillStyle = '#3b281b'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '52px SimSun, "Songti SC", serif'; ctx.fillText(ending?'影作 · '+ending.title:'影作 · 一幕团圆', 800, 88);
    ctx.font = '26px SimSun, "Songti SC", serif';
    ctx.fillText(`${route}　·　${pattern} / ${palette}　·　${summary.presetAppearanceUsed ? '默认造型' : '本场制偶造型'}`, 800, 136);
    ctx.drawImage(image, 200, 180, 1200, 900);
    ctx.font = '22px SimSun, "Songti SC", serif';
    const marker = summary.runId.length > 20 ? `…${summary.runId.slice(-20)}` : summary.runId;
    ctx.fillText(`成果 ${marker}:${summary.ending??'reunion'}　·　完成（UTC）${summary.completedAt}`, 800, 1120);
    ctx.font = '21px SimSun, "Songti SC", serif';
    ctx.fillText('零组 · 张宇翔（SpaceFly）　｜　影作 · 一幕团圆', 800, 1158);
  }

  try {
    source = mountCanvasRenderer(sourceHost, assetCatalog, status => {
      if (settled || disposed) return;
      if (status.state === 'error') { fail(new Error(status.message)); return; }
      if (status.state !== 'ready' || !source) return;
      try {
        compose(source.canvas);
        // The renderer can report ready again after a resize; the still is composed only once.
        settled = true; canvas.setAttribute('data-state', 'ready'); releaseSource(); resolveReady();
      } catch (error) { fail(error); }
    });
    void source.update(snapshot.frame).catch(fail);
  } catch (error) { fail(error); }

  return {
    canvas, ready,
    async toBlob() {
      if (disposed) throw closedError();
      await ready;
      if (disposed) throw closedError();
      return new Promise<Blob>((resolve, reject) => {
        const rejectEncoding = (error: Error) => {
          if (!pending.delete(rejectEncoding)) return;
          reject(error);
        };
        const finish = (blob: Blob | null) => {
          if (!pending.has(rejectEncoding)) return;
          if (disposed) { rejectEncoding(closedError()); return; }
          if (!blob || blob.size === 0 || blob.type !== 'image/png') {
            rejectEncoding(new Error('未能生成 PNG 留影，请重试或保存可恢复的作品文件。')); return;
          }
          pending.delete(rejectEncoding); resolve(blob);
        };
        pending.add(rejectEncoding);
        try {
          if (typeof canvas.toBlob === 'function') canvas.toBlob(finish, 'image/png');
          else if (typeof (canvas as LegacyCanvas).msToBlob === 'function') finish((canvas as LegacyCanvas).msToBlob!());
          else rejectEncoding(new Error('此浏览器不支持 PNG 编码，请保存可恢复的作品文件。'));
        } catch (error) { rejectEncoding(errorFor(error)); }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!settled) { settled = true; rejectReady(closedError()); }
      for (const reject of Array.from(pending)) reject(closedError());
      releaseSource(); canvas.width = canvas.height = 0;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
