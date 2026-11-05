import { definitionFor } from '../../content/reunion';
import { assetCatalog } from '../../content/catalog';
import { mountCanvasRenderer } from '../../renderers/canvas/renderer';
import type { ReunionArtifact } from './artifact';
import { KAI_FONT_FAMILY,loadKaiFont } from '../shared/typography';
import { createResultPresentation, wrapProgrammeText } from './presentation';

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
  const font=loadKaiFont();
  let disposed = false, settled = false, composing = false;
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
    font.dispose();
    settled = true; canvas.setAttribute('data-state', 'error'); releaseSource(); rejectReady(errorFor(value));
  }
  function compose(image: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('此浏览器无法绘制团圆留影，仍可保存可恢复的作品文件。');
    const summary = snapshot.summary, appearance = summary.castSnapshot.appearance;
    const pattern = '精细原画';
    const palette = assetCatalog.palettes.palettes.find(item => item.id === appearance.paletteId)!.label;
    const presentation=createResultPresentation(summary);
    const wrapped=(text:string,x:number,y:number,maxWidth:number,size:number,lineHeight:number,maxLines:number)=>{
      let lines:string[]=[];
      do{ctx.font=`${size}px `+KAI_FONT_FAMILY;lines=wrapProgrammeText(text,maxWidth,value=>ctx.measureText(value).width);if(lines.length<=maxLines||size<=14)break;size--; }while(size>=14);
      lines.forEach((line,index)=>ctx.fillText(line,x,y+index*lineHeight));
    };
    ctx.fillStyle='#f2e5c9';ctx.fillRect(0,0,1600,1200);
    ctx.strokeStyle=presentation.accent;ctx.lineWidth=3;ctx.strokeRect(28,28,1544,1144);ctx.lineWidth=1;ctx.strokeRect(42,42,1516,1116);
    ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle=presentation.accent;
    wrapped('影作 · '+presentation.title,800,88,1120,50,54,1);
    ctx.fillStyle='#3b281b';wrapped(presentation.summary,800,126,1120,23,27,2);
    wrapped(`${pattern} / ${palette}　·　${summary.presetAppearanceUsed?'默认造型':'本场制偶造型'}`,800,174,1200,18,22,1);
    // The scene stays exactly 4:3. Text has its own bands, never over the actors.
    ctx.strokeStyle=presentation.accent;ctx.strokeRect(278,190,1044,788);ctx.drawImage(image,288,200,1024,768);
    ctx.fillStyle='#3b281b';wrapped(presentation.explanation,800,1004,1400,21,25,2);
    ctx.textAlign='left';
    for(const [index,item]of presentation.decisions.entries()){
      const x=index%2===0?90:810,y=1044+Math.floor(index/2)*58;
      ctx.strokeStyle=item.decisive?presentation.accent:'#bba17a';ctx.strokeRect(x,y,700,50);
      ctx.fillStyle=presentation.accent;ctx.font='16px '+KAI_FONT_FAMILY;ctx.fillText(`${index+1} · ${item.label}${item.decisive?'　· 决定因素':''}`,x+12,y+19);
      ctx.fillStyle='#3b281b';wrapped(item.value,x+12,y+41,676,20,22,1);
    }
    ctx.save();ctx.translate(1430,108);ctx.rotate(-Math.PI/22);ctx.strokeStyle=presentation.accent;ctx.lineWidth=3;
    ctx.strokeRect(-54,-54,108,108);ctx.lineWidth=1;ctx.strokeRect(-47,-47,94,94);ctx.fillStyle=presentation.accent;ctx.textAlign='center';ctx.font='39px '+KAI_FONT_FAMILY;ctx.fillText(presentation.stamp,0,14);ctx.restore();
    const marker=summary.runId.length>20?`…${summary.runId.slice(-20)}`:summary.runId;
    ctx.fillStyle='#5f4934';ctx.textAlign='center';wrapped(`影作 · 成果 ${marker}:${summary.ending}　·　完成（UTC）${summary.completedAt}`,800,1190,1460,16,20,1);
  }

  try {
    source = mountCanvasRenderer(sourceHost, assetCatalog, status => {
      if (settled || disposed) return;
      if (status.state === 'error') { fail(new Error(status.message)); return; }
      if (status.state !== 'ready' || !source) return;
      if(composing)return;composing=true;
      void font.ready.then(()=>{
        if(disposed||settled||!source)return;
        try {
          compose(source.canvas);
          // The renderer can report ready again after a resize; compose once after fonts settle.
          settled = true; canvas.setAttribute('data-state', 'ready'); releaseSource(); resolveReady();
        } catch (error) { fail(error); }
      });
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
      font.dispose();
      if (!settled) { settled = true; rejectReady(closedError()); }
      for (const reject of Array.from(pending)) reject(closedError());
      releaseSource(); canvas.width = canvas.height = 0;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
