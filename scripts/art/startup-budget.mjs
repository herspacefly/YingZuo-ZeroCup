import {readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {deliveryPath} from '../../src/content/asset-delivery.ts';
export function startupAssetBudget(root) {
  const json=file=>JSON.parse(readFileSync(path.join(root,file),'utf8'));
  const manifest=json('src/content/manifest.json'),delivery=json('src/content/delivery.json'),intro=json('src/content/stories/reunion-v1.json').nodes.find(n=>n.id==='intro');
  const rows=[];
  for(const pattern of ['cloud-v1','wave-v1','flower-v1']){
    const assets=intro.assetIds.map(id=>manifest.assets.find(a=>a.id===id)).filter(a=>a&&a.type!=='alpha-mask'&&(a.type!=='carving-mask'||a.id.startsWith(pattern+'-')));
    const size=supported=>assets.map(asset=>{const file=deliveryPath(asset,delivery,supported);return {id:asset.id,path:file,bytes:statSync(path.join(root,'public',file)).size};});
    const modern=size(true),png=size(false),sum=items=>items.reduce((s,a)=>s+a.bytes,0);
    rows.push({pattern,resources:assets.length,modernBytes:sum(modern),pngCompatibilityBytes:sum(png),modernWithinBudget:sum(modern)<=2*1024*1024,pngWithinBudget:sum(png)<=2*1024*1024,modern,png});
  }
  return {scope:'Conservative intro assetIds excluding verified duplicate masks and other two motifs; static images only, not timing/HTTP/fonts. Real browser probe separately verifies runtime requests.',budgetBytes:2*1024*1024,rows};
}
