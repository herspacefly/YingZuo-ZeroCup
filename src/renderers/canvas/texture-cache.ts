import type { AssetManifest } from '../../content/asset-types';
import { safeAssetPath } from '../../content/asset-contract';

/** Page-owned resources. No global image pool, decode API, object URLs or untracked callbacks. */
export class TextureCache {
  private images = new Map<string, HTMLImageElement>();
  private pending = new Map<string, { promise: Promise<HTMLImageElement>; cancel(): void }>();
  private disposed = false;
  private revision = 0;
  constructor(private readonly manifest: AssetManifest) {}
  get(id: string): HTMLImageElement {
    const image = this.images.get(id); if (!image) throw new Error(`资源尚未就绪：${id}`); return image;
  }
  private loadOne(id: string): Promise<HTMLImageElement> {
    if (this.disposed) return Promise.reject(new Error('画布已离开，未再加载资源。'));
    if (this.images.has(id)) return Promise.resolve(this.images.get(id)!);
    const pending = this.pending.get(id); if (pending) return pending.promise;
    const asset = this.manifest.assets.find(item => item.id === id);
    if (!asset || !safeAssetPath(asset.path)) return Promise.reject(new Error(`资源不在本地清单中：${id}`));
    const image = new Image(); let cancel = () => {};
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const finish = () => { image.onload = image.onerror = null; this.pending.delete(id); };
      cancel = () => { finish(); image.src = ''; reject(new Error(`已取消加载 ${id}`)); };
      image.onload = () => {
        finish();
        if (this.disposed) { image.src = ''; reject(new Error(`画布已离开：${id}`)); return; }
        if (image.naturalWidth !== asset.width || image.naturalHeight !== asset.height) { image.src = ''; reject(new Error(`资源尺寸不符：${id}`)); return; }
        this.images.set(id, image); resolve(image);
      };
      image.onerror = () => { finish(); image.src = ''; reject(new Error(`无法加载 ${id}，请重试。`)); };
    });
    this.pending.set(id, { promise, cancel });
    // A repaired source must not be served again from the document's decoded-image cache.
    image.src = `${import.meta.env.BASE_URL}${asset.path}${this.revision ? `?retry=${this.revision}` : ''}`;
    return promise;
  }
  async load(ids: readonly string[]) { await Promise.all(ids.map(id => this.loadOne(id))); }
  retain(ids: readonly string[]) {
    const keep = new Set(ids);
    for (const [id, image] of this.images) if (!keep.has(id)) { image.src = ''; this.images.delete(id); }
    for (const [id, entry] of Array.from(this.pending)) if (!keep.has(id)) entry.cancel();
  }
  clear() {
    this.revision++;
    for (const entry of Array.from(this.pending.values())) entry.cancel();
    for (const image of this.images.values()) image.src = '';
    this.images.clear();
  }
  dispose() { this.disposed = true; this.clear(); }
}
