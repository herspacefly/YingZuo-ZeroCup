// Reproducible source-image segmentation. No network and no generated placeholders.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {referencePuppets,referenceGeometry,bindReferencePuppets,drawReferencePart} from './art/reference-puppets.mjs';
import {drawDesignedMotif,drawDesignedProp} from './art/scenery.mjs';
import {drawReferenceScenery} from './art/reference-scenery.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const json=file=>JSON.parse(readFileSync(path.join(root,file),'utf8'));
const save=(file,value)=>writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n');
const source=readFileSync(path.join(root,'docs/art/t10-art-direction.png'));
const sourceSha=createHash('sha256').update(source).digest('hex');
const manifest=json('src/content/manifest.json');
const puppets=bindReferencePuppets(['chenxiang-v1','mother-v1','guardian-v1'].map(role=>json(`src/content/puppets/${role}.json`)));
const tasks=[];
for(const puppet of puppets)for(const part of puppet.parts){
  // The source figure is about 650px high. Avoid 2-3x upscales that add no
  // detail and make every color/mask/region triple expensive to decode.
  const width=Math.ceil((part.bounds.maxX-part.bounds.minX)*800),height=Math.ceil((part.bounds.maxY-part.bounds.minY)*800);
  const piece=referencePuppets[puppet.id].pieces[part.partId];
  tasks.push({kind:'part',role:puppet.id,partId:part.partId,bounds:part.bounds,piece,geometry:referenceGeometry(piece),factor:referencePuppets[puppet.id].factor,
    width,height,ids:[part.colorAssetId,part.maskAssetId,part.colorMapAssetId]});
}
for(const asset of manifest.assets)if(asset.type==='prop')tasks.push({kind:'prop',id:asset.id,width:244,height:436,ids:[asset.id]});
else if(asset.type==='carving-mask')tasks.push({kind:'motif',id:asset.id,pattern:asset.id.replace(/-cut-\d$/,''),segment:Number(asset.id.slice(-1))-1,width:256,height:512,ids:[asset.id]});
else if(asset.type==='scene-layer')tasks.push({kind:'scene',id:asset.id.replace(/^scene-/,''),width:1024,height:768,ids:[asset.id]});
const browser=await chromium.launch();let outputs;
try{
  const page=await browser.newPage();
  outputs=await page.evaluate(async({tasks,functions,source})=>{
    const [part,scenery,motif,prop]=functions.map(fn=>(0,eval)('('+fn+')'));
    const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Reference plate failed to decode'));image.src=source;});
    if(image.naturalWidth!==1536||image.naturalHeight!==1024)throw new Error('Reference plate dimensions changed');
    const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
    const result=[],labels=[[255,0,0],[0,255,0],[0,0,255],[255,255,0]];
    for(const spec of tasks){
      const color=canvas(spec.width,spec.height),ctx=color.getContext('2d');if(!ctx)throw new Error('Canvas2D unavailable');
      if(spec.kind==='part'){
        part(ctx,{...spec,mode:'color'},image);const pixels=ctx.getImageData(0,0,spec.width,spec.height);
        const regions=canvas(spec.width,spec.height),rc=regions.getContext('2d');part(rc,{...spec,mode:'regions'},image);
        const codes=rc.getImageData(0,0,spec.width,spec.height),mask=canvas(spec.width,spec.height),mc=mask.getContext('2d'),white=mc.createImageData(spec.width,spec.height);
        for(let i=0;i<pixels.data.length;i+=4){
          const alpha=pixels.data[i+3],covered=codes.data[i+3]>0;white.data[i]=white.data[i+1]=white.data[i+2]=255;white.data[i+3]=alpha;codes.data[i+3]=alpha;
          if(alpha){let best=labels[3],score=Infinity;if(covered&&spec.partId!=='head')for(const label of labels){const distance=label.reduce((sum,v,c)=>sum+(v-codes.data[i+c])**2,0);if(distance<score){score=distance;best=label;}}for(let c=0;c<3;c++)codes.data[i+c]=best[c];}
          else codes.data[i]=codes.data[i+1]=codes.data[i+2]=0;
        }
        rc.putImageData(codes,0,0);mc.putImageData(white,0,0);
        for(const [index,c]of [color,mask,regions].entries())result.push({id:spec.ids[index],width:spec.width,height:spec.height,png:c.toDataURL('image/png').split(',')[1]});
      }else{
        if(spec.kind==='scene')scenery(ctx,spec,image);else(spec.kind==='motif'?motif:prop)(ctx,spec);
        if(spec.kind==='motif'){const pixels=ctx.getImageData(0,0,spec.width,spec.height);for(let i=0;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;ctx.putImageData(pixels,0,0);}
        result.push({id:spec.ids[0],width:spec.width,height:spec.height,png:color.toDataURL('image/png').split(',')[1]});
      }
    }return result;
  },{tasks,functions:[drawReferencePart,drawReferenceScenery,drawDesignedMotif,drawDesignedProp].map(fn=>fn.toString()),source:'data:image/png;base64,'+source.toString('base64')});
}finally{await browser.close();}
if(outputs.length!==80||new Set(outputs.map(x=>x.id)).size!==80)throw new Error('Expected exactly 80 assets');
for(const output of outputs){
  const entry=manifest.assets.find(a=>a.id===output.id);if(!entry)throw new Error('Unknown asset '+output.id);
  const bytes=Buffer.from(output.png,'base64'),target=path.join(root,'public',entry.path);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);
  Object.assign(entry,{width:output.width,height:output.height,creator:entry.type==='prop'||entry.type==='carving-mask'?'Codex / original Canvas2D prop and motif paths':'Codex / project-owned AI direction plate and measured segmentation',sourceUrl:'',license:'unknown',
    credit:output.id.startsWith('scene-')||entry.type==='part-color'||entry.type==='alpha-mask'||entry.type==='color-map'?'影作AI方向图分件贴图设计稿':'影作原创附件与可刻纹样设计稿',reviewStatus:'draft',sha256:createHash('sha256').update(bytes).digest('hex')});
}
manifest.provenance={kind:'original-ai-reference-cutout',generator:'scripts/generate-reference-assets.mjs',tool:`Canvas2D / Chromium ${browser.version()}`,
  intent:`按作者要求拆分本项目内置image_gen方向图docs/art/t10-art-direction.png（SHA256 ${sourceSha}）；保留服饰、手型、笔触与背景，测量关节后绑定；背景亮度84%/饱和度76%，角色保留参考原色或用户配色，不作传统实物或特定流派复原。`,
  externalMedia:false,manualEdits:'Measured polygons, paper removal, source-image fragments and rig bindings in scripts/art/reference-*.mjs; props and user motifs remain original paths',licenseNote:'设计稿；文化、设计及使用许可仍待实际作者审看，不代作者授予许可。'};
manifest.colorMapEncoding.recolor='source-relative-rgb';
save('src/content/manifest.json',manifest);
for(const puppet of puppets)save(`src/content/puppets/${puppet.id}.json`,puppet);
const scenes=json('src/content/scenes.json');for(const scene of scenes.scenes)if(scene.id!=='plain-v1')scene.background='#C9C0AE';save('src/content/scenes.json',scenes);
const columns=['id','type','path','creator','sourceUrl','license','credit','usage','reviewStatus','sha256'];const csv=v=>'"'+String(v).replaceAll('"','""')+'"';
writeFileSync(path.join(root,'docs/assets.csv'),columns.join(',')+'\n'+manifest.assets.map(a=>columns.map(k=>csv(a[k])).join(',')).join('\n')+'\n');
console.log('Generated 80 reference-cutout assets with measured rig bindings; source SHA256 '+sourceSha);
