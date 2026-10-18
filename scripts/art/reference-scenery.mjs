/**
 * Reference-board scenery, cut from docs/art/t10-art-direction.png (1536 × 1024).
 * Deliberately self-contained: the asset generator serializes this function into
 * a browser. Every painted mark below is sampled from the project direction
 * board; paths only isolate its layers and never replace the original brushwork.
 */
export function drawReferenceScenery(ctx, spec, image) {
  const { width, height, id } = spec;
  if (!image || image.width !== 1536 || image.height !== 1024) {
    throw new Error('Reference scenery requires the 1536 × 1024 direction board');
  }
  const canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };
  // A deterministic warm-paper key removes the actual board background around
  // isolated trees/cliffs, including the paper in their small cut-out openings.
  // Gold contours remain opaque. No generative fill or external image is used.
  function fragment(sx, sy, sw, sh, keyPaper = false) {
    const c = canvas(sw, sh), z = c.getContext('2d');
    if (!z) throw new Error('Canvas2D unavailable for reference segmentation');
    z.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    if (keyPaper) {
      const pixels = z.getImageData(0, 0, sw, sh), a = pixels.data;
      for (let n = 0; n < a.length; n += 4) {
        const r = a[n], g = a[n + 1], b = a[n + 2];
        // Paper is both light and relatively unsaturated; amber clouds and
        // cliff contours are darker/more saturated and survive this matte.
        const coverage = Math.max((r - g - 24) / 12, (g - b - 41) / 15,
          (180 - r) / 18, (155 - g) / 18, (115 - b) / 18);
        a[n + 3] = Math.round(a[n + 3] * Math.min(1, Math.max(0, coverage)));
      }
      z.putImageData(pixels, 0, 0);
    }
    return c;
  }
  const patch = (sx, sy, sw, sh, x, y, w, h, key = false) =>
    ctx.drawImage(fragment(sx, sy, sw, sh, key), x, y, w, h);
  function cut(source, d, x, y, w, h) {
    ctx.save(); ctx.translate(x, y); ctx.scale(w / source.width, h / source.height);
    ctx.clip(new Path2D(d)); ctx.drawImage(source, 0, 0); ctx.restore();
  }
  function fadeInner(source, right) {
    const z = source.getContext('2d');
    const g = z.createLinearGradient(right ? source.width - 11 : 0, 0,
      right ? source.width : 11, 0);
    g.addColorStop(0, right ? '#fff' : '#fff0');
    g.addColorStop(1, right ? '#fff0' : '#fff');
    z.save(); z.globalCompositeOperation = 'destination-in'; z.fillStyle = g;
    z.fillRect(0, 0, source.width, source.height); z.restore(); return source;
  }
  function road() {
    // Preserve both the left pine and the whole curved bridge rather than
    // centre-cropping a wide painting to 4:3. Extra sky comes from blank paper;
    // only the remaining height is adapted (a modest ~1.25 vertical ratio).
    const skyPaper=canvas(1024,120),paperContext=skyPaper.getContext('2d');
    paperContext.drawImage(image,884,8,120,140,0,0,1024,120);
    const feather=paperContext.createLinearGradient(0,0,0,7);feather.addColorStop(0,'#fff0');feather.addColorStop(.15,'#fff0');feather.addColorStop(1,'#fff');
    paperContext.globalCompositeOperation='destination-in';paperContext.fillStyle=feather;paperContext.fillRect(0,0,1024,120);
    ctx.drawImage(skyPaper,0,0);
    const source = fragment(497, 709, 507, 259);
    const z = source.getContext('2d');
    const sky = z.createLinearGradient(0, 0, 0, 8);
    sky.addColorStop(0, '#fff0'); sky.addColorStop(1, '#fff');
    z.globalCompositeOperation = 'destination-in'; z.fillStyle = sky;
    z.fillRect(0, 0, source.width, source.height);
    ctx.drawImage(source, 0, 100, 1024, 668);
  }
  ctx.save(); ctx.scale(width / 1024, height / 768);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  switch (id) {
    case 'home-window': {
      // The interior itself is adapted to the existing 4:3 backdrop. Keeping
      // it in one piece avoids duplicate lanterns or mismatched lattice seams.
      patch(20, 731, 447, 216, 0, 0, 1024, 737);
      break;
    }
    case 'home-floor':
      // Interior floor/threshold, strictly above the board's heavy outside rail.
      patch(20, 946, 447, 8, 0, 737, 1024, 31);
      break;
    case 'mountain-far': {
      // Distant canyon spires from the third reference panel are placed at the
      // sides. The pale central opening remains broad enough for the reunion.
      ctx.save(); ctx.globalAlpha = .64;
      ctx.drawImage(fadeInner(fragment(1206, 710, 72, 244, true), true), 0, 85, 295, 683);
      ctx.drawImage(fadeInner(fragment(1313, 710, 100, 244, true), false), 744, 65, 280, 703);
      ctx.restore();
      break;
    }
    case 'road-near':
      road();
      break;
    case 'road-path': {
      // The original bridge has an inseparable painted ground shadow. Keep it
      // as a matched overlay at the same transform, without an invented path.
      const source = fragment(497, 709, 507, 259);
      cut(source, 'M69 109 L96 127 L147 168 L204 194 L264 216 L327 228 L334 259 H246 L204 229 L157 217 L110 186 L72 151 Z', 0, 100, 1024, 668);
      break;
    }
    case 'road-ledge': {
      // The foreground bridge foot/rock is already part of the same painting.
      // Its own layer stays pixel-aligned with road-near and road-path.
      const source = fragment(497, 709, 507, 259);
      cut(source, 'M317 230 L349 243 L368 251 L375 259 H306 L309 246 Z', 0, 100, 1024, 668);
      break;
    }
    case 'mountain-left': {
      const source = fragment(1031, 710, 249, 244, true);
      // Outer silhouette follows the reference peaks and pine crowns. The
      // natural inner rock extends past centre, overlapping the right half by
      // 76 pixels at rest; the existing ±.47 stage translations still open it.
      ctx.drawImage(source, -8, 0, 558, 768);
      break;
    }
    case 'mountain-right': {
      const source = fragment(1311, 710, 211, 244, true);
      ctx.drawImage(source, 474, 0, 558, 768);
      break;
    }
    case 'mountain-dust': {
      // Existing dust opacity remains the only animation control. Original
      // ochre cloud strokes are isolated from the reference rather than redrawn.
      const mist = fragment(1172, 907, 106, 47, true);
      ctx.save(); ctx.globalAlpha = .76;
      ctx.drawImage(mist, 0, 0, 106, 44, 172, 584, 438, 181);
      ctx.save(); ctx.translate(1024, 0); ctx.scale(-1, 1);
      ctx.drawImage(mist, 0, 0, 106, 44, 172, 584, 438, 181); ctx.restore();
      ctx.restore();
      break;
    }
    default:
      ctx.restore();
      throw new Error('Unknown reference scene layer ' + id);
  }
  ctx.restore();
  // The reference painting stays intact; only the backdrop is gently muted.
  // Actor textures never pass through this grade. Preserve all alpha exactly.
  const graded=ctx.getImageData(0,0,width,height),channels=graded.data;
  for(let n=0;n<channels.length;n+=4)if(channels[n+3]){
    const luminance=.2126*channels[n]+.7152*channels[n+1]+.0722*channels[n+2];
    for(let c=0;c<3;c++)channels[n+c]=Math.round((luminance+(channels[n+c]-luminance)*.76)*.84);
  }
  ctx.putImageData(graded,0,0);
}
