import type { AssetEntry, AssetManifest } from './asset-types';

export interface DeliveryAsset { id: string; path: string; sourceSha256: string; sha256: string; width: number; height: number; bytes: number }
export interface DeliveryManifest {
  schemaVersion: 1; assetVersion: 1; codec: 'webp-lossless';
  probe: { dataUrl: string; width: number; height: number; renderedRgba: number[] }; records: DeliveryAsset[];
}
const hash = (value: string) => /^[a-f0-9]{64}$/.test(value);
export const safeDeliveryPath = (value: string) => typeof value === 'string' && /^assets\/delivery\/[a-z0-9-]+\.webp$/.test(value);
function matching(asset: AssetEntry, record: DeliveryAsset) {
  return record.id === asset.id && record.sourceSha256 === asset.sha256 && hash(record.sha256) && safeDeliveryPath(record.path)
    && record.width === asset.width && record.height === asset.height && Number.isInteger(record.bytes) && record.bytes > 0 && asset.type !== 'alpha-mask';
}
export function deliveryPath(asset: AssetEntry, delivery: DeliveryManifest, supported: boolean, legacy = false): string {
  if (!supported || legacy || delivery.schemaVersion !== 1 || delivery.assetVersion !== 1 || delivery.codec !== 'webp-lossless' || !Array.isArray(delivery.records)) return asset.path;
  const record = delivery.records.find(item => item.id === asset.id);
  return record && matching(asset, record) ? record.path : asset.path;
}
export function validateDeliveryManifest(delivery: DeliveryManifest, source: AssetManifest): string[] {
  const errors: string[] = [], ids = new Set<string>(), paths = new Set<string>();
  try {
    if (delivery.schemaVersion !== 1 || delivery.assetVersion !== source.assetVersion || delivery.codec !== 'webp-lossless') errors.push('delivery schema/version/codec');
    if (delivery.probe.width !== 2 || delivery.probe.height !== 2 || !/^data:image\/webp;base64,[a-zA-Z0-9+/=]+$/.test(delivery.probe.dataUrl) || delivery.probe.dataUrl.length > 512 || !Array.isArray(delivery.probe.renderedRgba) || delivery.probe.renderedRgba.length !== 16 || delivery.probe.renderedRgba.some(v => !Number.isInteger(v) || v < 0 || v > 255)) errors.push('delivery decode probe');
    if (!Array.isArray(delivery.records) || !delivery.records.length) errors.push('delivery records');
    for (const record of delivery.records) {
      const asset = source.assets.find(item => item.id === record.id);
      if (!asset || !matching(asset, record)) errors.push(`delivery source/path/dimensions: ${record.id}`);
      if (ids.has(record.id) || paths.has(record.path)) errors.push(`duplicate delivery: ${record.id}`);
      ids.add(record.id); paths.add(record.path);
    }
  } catch { errors.push('invalid delivery shape'); }
  return errors;
}
