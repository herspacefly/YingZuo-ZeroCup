// Independent browser decoding, not the PNG optimizer's own decoder.
export async function compareImagePixels(page, source, candidate, width, height, candidateDecode = 'image') {
  return page.evaluate(async ({ source, candidate, width, height, candidateDecode }) => {
    async function read(src, decoder) {
      let image;
      if (decoder.startsWith('bitmap-none')) image = await createImageBitmap(await (await fetch(src)).blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      else { image = new Image(); await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Pixel proof image failed to decode')); image.src = src; }); }
      if(decoder === 'bitmap-none-native-png') {
        const temp=document.createElement('canvas');temp.width=image.width;temp.height=image.height;
        try {
          temp.getContext('2d').drawImage(image,0,0);const png=temp.toDataURL('image/png');image.close();
          image=new Image();await new Promise((yes,no)=>{image.onload=yes;image.onerror=()=>no(new Error('Transport PNG failed'));image.src=png;});
        } finally {temp.width=temp.height=0;}
      }
      const actualWidth = 'naturalWidth' in image ? image.naturalWidth : image.width, actualHeight = 'naturalHeight' in image ? image.naturalHeight : image.height;
      if (actualWidth !== width || actualHeight !== height) throw new Error('Pixel proof dimensions differ');
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('Pixel proof requires Canvas2D');
      ctx.drawImage(image, 0, 0); const data = ctx.getImageData(0, 0, width, height).data;
      canvas.width = canvas.height = 0; if ('close' in image) image.close(); return data;
    }
    const a = await read(source, 'image'), b = await read(candidate, candidateDecode); let differences = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differences++;
    return { width, height, comparedRgbaBytes: a.length, differingBytes: differences, candidateDecode };
  }, { source, candidate, width, height, candidateDecode });
}
