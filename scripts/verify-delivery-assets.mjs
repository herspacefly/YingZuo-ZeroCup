import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { deliveryFiles } from './art/delivery-files.mjs';
import { compareImagePixels } from './art/image-pixel-proof.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),json=file=>JSON.parse(readFileSync(path.join(root,file),'utf8'));
const {errors,records}=deliveryFiles(root,json('src/content/delivery.json'),json('src/content/manifest.json'));
if(errors.length) throw new Error(errors.join('\n'));
if(process.argv.includes('--pixels')) {
  const browser=await chromium.launch(),proof=[];
  try {
    const page=await browser.newPage();
    for(const {item,bytes,png} of records){
      const result=await compareImagePixels(page,'data:image/png;base64,'+png.toString('base64'),'data:image/webp;base64,'+bytes.toString('base64'),item.width,item.height,'bitmap-none-native-png');
      if(result.differingBytes) throw new Error('Decoded pixels differ: '+item.id);
      proof.push({...item,...result});
    }
    writeFileSync(path.join(root,'docs/evidence/delivery-pixel-proof.json'),JSON.stringify({kind:'browser-decoded-rgba-equality',browserVersion:browser.version(),codec:'webp-lossless',ffmpeg:json('src/content/delivery.json').ffmpeg,records:proof},null,2)+'\n');
  } finally {await browser.close();}
}
console.log(`PASS: ${records.length} lossless delivery files, canonical bindings, hashes, smaller bytes and dimensions${process.argv.includes('--pixels')?'; all rendered RGBA bytes equal PNG':''}.`);
