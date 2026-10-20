import type { AssetManifest } from '../../content/asset-types';
import { safeAssetPath } from '../../content/asset-contract';
import { deliveryPath } from '../../content/asset-delivery';
import delivery from '../../content/delivery.json';
import type { DeliveryManifest } from '../../content/asset-delivery';

type TextureImage = HTMLImageElement;
let deliverySupport: Promise<boolean> | undefined;
/** Test both WebP decoding and the non-premultiplied alpha path, once per document. */
function supportsDelivery(): Promise<boolean> {
  if (import.meta.env.LEGACY || typeof createImageBitmap !== 'function' || typeof fetch !== 'function' || typeof AbortController !== 'function') return Promise.resolve(false);
  if (!deliverySupport) deliverySupport = (async () => {
    let bitmap: ImageBitmap | undefined;
    try {
      const response = await fetch(delivery.probe.dataUrl);
      bitmap = await createImageBitmap(await response.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      if (bitmap.width !== 2 || bitmap.height !== 2) return false;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
      const ctx = canvas.getContext('2d'); if (!ctx) return false;
      ctx.drawImage(bitmap, 0, 0);
      const rgba = ctx.getImageData(0, 0, 2, 2).data;
      return delivery.probe.renderedRgba.every((value, index) => rgba[index] === value);
    } catch { return false; }
    finally { bitmap?.close(); }
  })();
  return deliverySupport;
}
function release(image: TextureImage) { image.src = ''; }
interface Pending { promise: Promise<TextureImage>; cancel(): void }

/** Page-owned images; modern lossless decoding is optional, with canonical PNG compatibility. */
export class TextureCache {
  private images = new Map<string, TextureImage>();
  private pending = new Map<string, Pending>();
  private disposed = false;
  private revision = 0;
  constructor(private readonly manifest: AssetManifest) {}
  get(id: string): TextureImage {
    const image = this.images.get(id); if (!image) throw new Error(`资源尚未就绪：${id}`); return image;
  }
  hasAll(ids: readonly string[]) { return ids.every(id => this.images.has(id)); }
  private loadOne(id: string): Promise<TextureImage> {
    if (this.disposed) return Promise.reject(new Error('画布已离开，未再加载资源。'));
    const ready = this.images.get(id); if (ready) return Promise.resolve(ready);
    const existing = this.pending.get(id); if (existing) return existing.promise;
    const asset = this.manifest.assets.find(item => item.id === id);
    if (!asset || !safeAssetPath(asset.path)) return Promise.reject(new Error(`资源不在本地清单中：${id}`));
    let resolve!: (image: TextureImage) => void, reject!: (error: Error) => void;
    const promise = new Promise<TextureImage>((yes, no) => { resolve = yes; reject = no; });
    let cancelled = false, controller: AbortController | undefined, cancelImage: (() => void) | undefined;
    const forget = () => { if (this.pending.get(id) === entry) this.pending.delete(id); };
    const entry: Pending = { promise, cancel: () => {
      if (cancelled) return; cancelled = true; controller?.abort(); cancelImage?.(); forget(); reject(new Error(`已取消加载 ${id}`));
    } };
    this.pending.set(id, entry);
    const revision = this.revision;
    const nativeImage = (url: string) => new Promise<HTMLImageElement>((yes, no) => {
      const native = new Image();
      const finish = () => { native.onload = native.onerror = null; cancelImage = undefined; };
      cancelImage = () => { finish(); native.src = ''; no(new Error('cancelled')); };
      native.onload = () => { finish(); yes(native); };
      native.onerror = () => { finish(); native.src = ''; no(new Error('image load')); };
      native.src = url;
    });
    void (async () => {
      let image: TextureImage | undefined;
      try {
        const supported = await supportsDelivery(); if (cancelled || this.disposed) return;
        const selected = deliveryPath(asset, delivery as DeliveryManifest, supported, !!import.meta.env.LEGACY);
        const url = `${import.meta.env.BASE_URL}${selected}${revision ? `?retry=${revision}` : ''}`;
        if (selected !== asset.path) {
          controller = new AbortController();
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bitmap = await createImageBitmap(await response.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
          let png: string;
          try {
            if (cancelled || this.disposed) return;
            if (bitmap.width !== asset.width || bitmap.height !== asset.height) throw new Error(`资源尺寸不符：${id}`);
            const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
            try {
              const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas 2D unavailable');
              // The transport codec must not select a different sampling/upload path.
              // Re-enter native PNG decoding at original size; no extra HTTP request.
              ctx.drawImage(bitmap, 0, 0); png = canvas.toDataURL('image/png');
            } finally { canvas.width = canvas.height = 0; }
          } finally { bitmap.close(); }
          if (cancelled || this.disposed) return;
          image = await nativeImage(png);
        } else {
          image = await nativeImage(url);
        }
        if (cancelled || this.disposed) { release(image); return; }
        const width = image.naturalWidth, height = image.naturalHeight;
        if (width !== asset.width || height !== asset.height) throw new Error(`资源尺寸不符：${id}`);
        this.images.set(id, image); forget(); resolve(image);
      } catch (error) {
        if (image) release(image);
        if (!cancelled) { forget(); reject(new Error(`无法加载 ${id}，请重试。${error instanceof Error ? error.message : ''}`)); }
      }
    })();
    return promise;
  }
  async load(ids: readonly string[]) { await Promise.all(ids.map(id => this.loadOne(id))); }
  retain(ids: readonly string[]) {
    const keep = new Set(ids);
    for (const [id, image] of this.images) if (!keep.has(id)) { release(image); this.images.delete(id); }
    for (const [id, entry] of Array.from(this.pending)) if (!keep.has(id)) entry.cancel();
  }
  clear() {
    this.revision++;
    for (const entry of Array.from(this.pending.values())) entry.cancel();
    for (const image of this.images.values()) release(image);
    this.images.clear();
  }
  dispose() { this.disposed = true; this.clear(); }
}
