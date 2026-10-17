import type { AssetCatalog, PuppetPart, PuppetTemplate, RenderActor } from '../../content/asset-types';
import type { TextureCache } from './texture-cache';

export function canvas2D(width: number, height: number) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('此浏览器无法启动 Canvas 2D，文字内容仍可阅读。');
  return { canvas, context };
}
const rgb = (hex: string) => [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];

/** Recolor exact labels, then carve an isolated part. No destination-out on the stage. */
export class PartCompositor {
  private parts = new Map<string, { signature: string; canvas: HTMLCanvasElement }>();
  constructor(private readonly assets: TextureCache, private readonly catalog: AssetCatalog) {}
  part(actor: RenderActor, template: PuppetTemplate, part: PuppetPart): HTMLCanvasElement {
    const paletteId = actor.actorId === 'chenxiang' ? actor.appearance.paletteId : actor.paletteId;
    const slots = actor.actorId === 'chenxiang' ? actor.appearance.colorSlots : { body:0, sleeve:1, hem:2 };
    const motif = template.motifPlacement;
    const patternId = actor.actorId === 'chenxiang' ? actor.appearance.patternId : actor.actorId === 'mother' ? actor.sharedMotif : null;
    const segments = actor.actorId === 'chenxiang' ? actor.appearance.carvedSegments : [true,true,true];
    const signature = JSON.stringify([paletteId, slots, motif?.partId === part.partId ? [patternId,segments] : null]);
    const key = `${actor.actorId}/${part.partId}`, cached = this.parts.get(key);
    if (cached?.signature === signature) return cached.canvas;
    if (cached) { cached.canvas.width = cached.canvas.height = 0; this.parts.delete(key); }
    const source = this.assets.get(part.colorAssetId), mask = this.assets.get(part.maskAssetId), map = this.assets.get(part.colorMapAssetId);
    const { canvas, context } = canvas2D(source.naturalWidth, source.naturalHeight);
    try {
      context.drawImage(source,0,0); const color = context.getImageData(0,0,canvas.width,canvas.height);
      context.clearRect(0,0,canvas.width,canvas.height); context.drawImage(map,0,0);
      const regions = context.getImageData(0,0,canvas.width,canvas.height).data;
      context.clearRect(0,0,canvas.width,canvas.height); context.drawImage(mask,0,0);
      const alpha = context.getImageData(0,0,canvas.width,canvas.height).data;
      const palette = this.catalog.palettes.palettes.find(item => item.id === paletteId);
      if (!palette) throw new Error(`没有这套配色：${paletteId}`);
      const colors = palette.colors.map(rgb), codes = new Map([['255,0,0',slots.body],['0,255,0',slots.sleeve],['0,0,255',slots.hem]]);
      for (let i=0;i<color.data.length;i+=4) {
        color.data[i+3] = alpha[i+3]!;
        if (!alpha[i+3]) continue;
        const code = `${regions[i]},${regions[i+1]},${regions[i+2]}`;
        if (code === '255,255,0') continue; // fixed source pixels, including outlines.
        const index = codes.get(code), replacement = index === undefined ? undefined : colors[index];
        if (!replacement) throw new Error(`部件颜色区无法识别：${part.partId}`);
        color.data[i]=replacement[0]!; color.data[i+1]=replacement[1]!; color.data[i+2]=replacement[2]!;
      }
      context.putImageData(color,0,0);
      if (motif?.partId === part.partId && patternId) {
        const pattern = this.catalog.patterns.patterns.find(item => item.id === patternId);
        if (!pattern) throw new Error(`没有这个纹样：${patternId}`);
        const b=part.bounds,m=motif.bounds;
        context.globalCompositeOperation='destination-out';
        for (let i=0;i<3;i++) if (segments[i]) context.drawImage(this.assets.get(pattern.segments[i]!),
          (m.minX-b.minX)/(b.maxX-b.minX)*canvas.width,(b.maxY-m.maxY)/(b.maxY-b.minY)*canvas.height,
          (m.maxX-m.minX)/(b.maxX-b.minX)*canvas.width,(m.maxY-m.minY)/(b.maxY-b.minY)*canvas.height);
        context.globalCompositeOperation='source-over';
      }
      this.parts.set(key,{signature,canvas}); return canvas;
    } catch (error) { canvas.width=canvas.height=0; throw error; }
  }
  retain(actorIds: readonly string[]) {
    for (const [key, entry] of this.parts) if (!actorIds.includes(key.split('/')[0]!)) { entry.canvas.width=entry.canvas.height=0; this.parts.delete(key); }
  }
  dispose() { for (const entry of this.parts.values()) entry.canvas.width=entry.canvas.height=0; this.parts.clear(); }
}
