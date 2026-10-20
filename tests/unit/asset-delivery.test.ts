import { describe, expect, it } from 'vitest';
import source from '../../src/content/manifest.json';
import catalog from '../../src/content/delivery.json';
import type { AssetManifest } from '../../src/content/asset-types';
import type { DeliveryManifest } from '../../src/content/asset-delivery';
import { deliveryPath, validateDeliveryManifest, safeDeliveryPath } from '../../src/content/asset-delivery';
const manifest=source as AssetManifest,delivery=catalog as DeliveryManifest;
const asset=manifest.assets.find(a=>a.id==='chenxiang-v1-torso-color')!;
describe('optional lossless delivery contract',()=>{
  it('binds a smaller derivative to exactly the canonical source, with explicit PNG compatibility',()=>{
    expect(validateDeliveryManifest(delivery,manifest)).toEqual([]);
    expect(deliveryPath(asset,delivery,true)).toBe('assets/delivery/chenxiang-v1-torso-color.webp');
    expect(deliveryPath(asset,delivery,false)).toBe(asset.path);expect(deliveryPath(asset,delivery,true,true)).toBe(asset.path);
    const mask=manifest.assets.find(a=>a.type==='alpha-mask')!;expect(deliveryPath(mask,delivery,true)).toBe(mask.path);
  });
  it.each(['sourceSha256','width','height','sha256','path','bytes'] as const)('refuses a stale or unsafe %s binding',field=>{
    const copy=structuredClone(delivery),record=copy.records.find(a=>a.id===asset.id)!;
    Object.assign(record,{[field]:field==='sourceSha256'?'0'.repeat(64):field==='sha256'?'invalid':field==='path'?'https://example.invalid/a.webp':0});
    expect(deliveryPath(asset,copy,true)).toBe(asset.path);expect(validateDeliveryManifest(copy,manifest).length).toBeGreaterThan(0);
  });
  it('rejects duplicates, unsupported version, malformed capability pixels and traversal',()=>{
    const copy=structuredClone(delivery);copy.records.push({...copy.records[0]!});expect(validateDeliveryManifest(copy,manifest)).toContainEqual(expect.stringContaining('duplicate'));
    Object.assign(copy,{assetVersion:2});expect(deliveryPath(asset,copy,true)).toBe(asset.path);
    copy.probe.renderedRgba=[];expect(validateDeliveryManifest(copy,manifest)).toContain('delivery decode probe');
    for(const value of ['../x.webp','assets/delivery/../x.webp','assets/delivery/a.webp?x','//remote/a.webp'])expect(safeDeliveryPath(value)).toBe(false);
  });
});
