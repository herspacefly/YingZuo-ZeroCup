// Source pixels and real grip points. Background glow is removed from alpha,
// while engraved leather, brass edges and tiny pierced holes stay in the art.
export const referenceProps={
  'chenxiang-axe':{source:'t10-prop-direction-v2.png',rect:[76,8,595,1008],grip:[319,355],bounds:{minX:-.05,minY:-.22,maxX:.14,maxY:.12},width:304,height:544},
  'guardian-staff':{source:'t10-staff-direction-v2.png',rect:[348,13,330,1494],grip:[512,545],bounds:{minX:-.05,minY:-.22,maxX:.14,maxY:.12},width:304,height:544},
  'chenxiang-lantern':{source:'t10-prop-direction-v2.png',rect:[995,41,381,979],grip:[1185,76],bounds:{minX:-.06,minY:-.28,maxX:.06,maxY:.02},width:244,height:610},
};
export function drawReferenceProp(ctx,spec,image){
  const {rect,grip,bounds}=spec.design,[x,y,w,h]=rect;
  const cut=document.createElement('canvas');cut.width=w;cut.height=h;const c=cut.getContext('2d');if(!c)throw new Error('Canvas2D unavailable');
  c.drawImage(image,x,y,w,h,0,0,w,h);const pixels=c.getImageData(0,0,w,h);
  for(let n=3;n<pixels.data.length;n+=4){const a=pixels.data[n];pixels.data[n]=a<=24?0:a<64?Math.round(a*(a-24)/40):a===254?255:a;}
  c.putImageData(pixels,0,0);
  const px=grip[0]-x,py=grip[1]-y;
  const scale=Math.min(-bounds.minX/px,bounds.maxX/(w-px),bounds.maxY/py,-bounds.minY/(h-py))*.985;
  ctx.save();ctx.scale(spec.width/(bounds.maxX-bounds.minX),spec.height/(bounds.maxY-bounds.minY));ctx.translate(-bounds.minX,bounds.maxY);ctx.scale(scale,scale);ctx.drawImage(cut,-px,-py);ctx.restore();
}
