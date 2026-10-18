// T10 original design sources; preserves all resource IDs and the complete T01 skeleton contract.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {drawDesignedPart} from './art/puppets.mjs';
import {drawDesignedScenery,drawDesignedMotif,drawDesignedProp} from './art/scenery.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const json=file=>JSON.parse(readFileSync(path.join(root,file),'utf8'));
const save=(file,value)=>writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n');
const manifest=json('src/content/manifest.json'),palettes=json('src/content/palettes.json');
if(!['original-procedural-placeholder','original-vector-design'].includes(manifest.provenance.kind))throw new Error('Current assets use reference cutouts; use generate-reference-assets.mjs instead of overwriting the new art.');
const puppets=['chenxiang-v1','mother-v1','guardian-v1'].map(role=>json(`src/content/puppets/${role}.json`));
const tasks=[];
for(const puppet of puppets)for(const part of puppet.parts){
  const width=Math.ceil((part.bounds.maxX-part.bounds.minX)*640)*2,height=Math.ceil((part.bounds.maxY-part.bounds.minY)*640)*2;
  tasks.push({kind:'part',role:puppet.id,partId:part.partId,width,height,palette:palettes.palettes.find(p=>p.id===puppet.defaultPaletteId).colors,
    ids:[part.colorAssetId,part.maskAssetId,part.colorMapAssetId]});
}
for(const asset of manifest.assets)if(asset.type==='prop')tasks.push({kind:'prop',id:asset.id,width:244,height:436,ids:[asset.id]});
else if(asset.type==='carving-mask')tasks.push({kind:'motif',id:asset.id,pattern:asset.id.replace(/-cut-\d$/,''),segment:Number(asset.id.slice(-1))-1,width:256,height:512,ids:[asset.id]});
else if(asset.type==='scene-layer')tasks.push({kind:'scene',id:asset.id.replace(/^scene-/,''),width:1536,height:1152,ids:[asset.id]});
const browser=await chromium.launch();let outputs;
try{
  const page=await browser.newPage();
  outputs=await page.evaluate(({tasks,functions})=>{
    const [part,scenery,motif,prop]=functions.map(source=>(0,eval)('('+source+')'));
    const canvas=(width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
    const result=[];const labels=[[255,0,0],[0,255,0],[0,0,255],[255,255,0]];
    for(const spec of tasks){
      const color=canvas(spec.width,spec.height),ctx=color.getContext('2d');if(!ctx)throw new Error('Canvas2D unavailable');
      if(spec.kind==='part'){
        part(ctx,{...spec,mode:'color'});const pixels=ctx.getImageData(0,0,spec.width,spec.height);
        const regions=canvas(spec.width,spec.height),rc=regions.getContext('2d');part(rc,{...spec,mode:'regions'});
        const codes=rc.getImageData(0,0,spec.width,spec.height),mask=canvas(spec.width,spec.height),mc=mask.getContext('2d'),white=mc.createImageData(spec.width,spec.height);
        for(let i=0;i<pixels.data.length;i+=4){
          const alpha=pixels.data[i+3];white.data[i]=white.data[i+1]=white.data[i+2]=255;white.data[i+3]=alpha;codes.data[i+3]=alpha;
          if(alpha){let best=labels[0],score=Infinity;for(const label of labels){const distance=label.reduce((sum,value,c)=>sum+(value-codes.data[i+c])**2,0);if(distance<score){score=distance;best=label;}}for(let c=0;c<3;c++)codes.data[i+c]=best[c];}
          else codes.data[i]=codes.data[i+1]=codes.data[i+2]=0;
        }
        rc.putImageData(codes,0,0);mc.putImageData(white,0,0);
        for(const [index,c]of [color,mask,regions].entries())result.push({id:spec.ids[index],width:spec.width,height:spec.height,png:c.toDataURL('image/png').split(',')[1]});
      }else{
        (spec.kind==='scene'?scenery:spec.kind==='motif'?motif:prop)(ctx,spec);
        if(spec.kind==='motif'){const image=ctx.getImageData(0,0,spec.width,spec.height);for(let i=0;i<image.data.length;i+=4)image.data[i]=image.data[i+1]=image.data[i+2]=255;ctx.putImageData(image,0,0);}
        result.push({id:spec.ids[0],width:spec.width,height:spec.height,png:color.toDataURL('image/png').split(',')[1]});
      }
    }return result;
  },{tasks,functions:[drawDesignedPart,drawDesignedScenery,drawDesignedMotif,drawDesignedProp].map(fn=>fn.toString())});
}finally{await browser.close();}
if(outputs.length!==80||new Set(outputs.map(x=>x.id)).size!==80)throw new Error('Expected exactly 80 design assets');
for(const output of outputs){
  const entry=manifest.assets.find(asset=>asset.id===output.id);if(!entry)throw new Error('Unknown asset '+output.id);
  const bytes=Buffer.from(output.png,'base64'),target=path.join(root,'public',entry.path);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);
  Object.assign(entry,{width:output.width,height:output.height,creator:'Codex / scripts/art/ original Canvas2D design',sourceUrl:'',license:'unknown',credit:'影作原创皮影风格设计稿（AI辅助矢量绘制）',reviewStatus:'draft',sha256:createHash('sha256').update(bytes).digest('hex')});
}
manifest.provenance={kind:'original-vector-design',generator:'scripts/generate-designed-assets.mjs',tool:`Playwright 1.64.1 / Chromium ${browser.version()} / Canvas2D`,
  intent:'原创侧脸、服饰、镂空装饰与三套分层舞台；艺术方向参考docs/art/t10-art-direction.png（内置image_gen生成），实际PNG由可读路径绘制，不是传统流派复原。',
  externalMedia:false,manualEdits:'AI-assisted path design in scripts/art/; no downloaded media',licenseNote:'设计稿和文化/许可仍待张宇翔（SpaceFly）审看确认；不代作者授予许可。'};
save('src/content/manifest.json',manifest);
const columns=['id','type','path','creator','sourceUrl','license','credit','usage','reviewStatus','sha256'];
const csv=value=>'"'+String(value).replaceAll('"','""')+'"';writeFileSync(path.join(root,'docs/assets.csv'),columns.join(',')+'\n'+manifest.assets.map(asset=>columns.map(key=>csv(asset[key])).join(',')).join('\n')+'\n');
for(const puppet of puppets){puppet.note='本作原创皮影风格设计稿；十/六/四部件为数字简化，不是传统影偶标准。原关节、bounds、杆与附件锚点保留，未使用的九关节Pose字段恒0。';save(`src/content/puppets/${puppet.id}.json`,puppet);}
const patterns=json('src/content/patterns.json');for(const pattern of patterns.patterns)pattern.note='本作原创云/水/花分段刻纹设计，不作传统纹样复原或寓意考证。';save('src/content/patterns.json',patterns);
console.log('Generated 80 original design PNGs; IDs/skeleton/ProjectV1 unchanged; cultural, art and license review remain pending.');
