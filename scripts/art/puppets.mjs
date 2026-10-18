/**
 * Original vector drawings for Yingzuo. Authored for this project's existing
 * segmented rigs; the visual reference is a direction study, not traced art.
 * No downloaded media, fonts, random values, or runtime dependencies.
 * The entire function may be serialized into the asset generator's browser.
 */
export function drawDesignedPart(ctx, spec) {
  const { role, partId, width, height, mode, palette } = spec;
  if (!['chenxiang-v1', 'mother-v1', 'guardian-v1'].includes(role)) throw new Error(`Unknown puppet role: ${role}`);
  if (!['color', 'regions'].includes(mode)) throw new Error(`Unknown part rendering mode: ${mode}`);
  const mother = role === 'mother-v1', guardian = role === 'guardian-v1';
  const map = mode === 'regions';
  const ink = '#211A14', gold = '#D7A253', lightGold = '#F3CF88', skin = '#EDCA8A';
  const red = '#A93C2C', ivory = '#F2E5C9';
  const slots = { body: palette[0], sleeve: palette[1], hem: palette[2], fixed: gold };
  const labels = { body: '#FF0000', sleeve: '#00FF00', hem: '#0000FF', fixed: '#FFFF00' };
  const color = (slot, fixed) => map ? labels[slot] : (fixed || slots[slot]);
  const P = value => new Path2D(value);
  const fill = (path, slot = 'fixed', fixed) => { ctx.fillStyle = color(slot, fixed); ctx.fill(P(path)); };
  const line = (path, shade = gold, thickness = 1, slot = 'fixed') => {
    ctx.strokeStyle = color(slot, shade); ctx.lineWidth = thickness; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(P(path));
  };
  const panel = (path, slot, fixed) => {
    const p = P(path); ctx.fillStyle = color(slot, fixed); ctx.fill(p);
    ctx.strokeStyle = color('fixed', ink); ctx.lineWidth = 2.1; ctx.lineJoin = 'round'; ctx.stroke(p);
    ctx.strokeStyle = color('fixed', gold); ctx.lineWidth = .65; ctx.stroke(p);
  };
  const ellipse = (x, y, rx, ry, shade, slot = 'fixed') => {
    ctx.fillStyle = color(slot, shade); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  };
  const hole = path => { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#FFFFFF'; ctx.fill(P(path)); ctx.restore(); };
  const leaf = (x, y, sx = 1, sy = 1, pierced = false, angle = 0) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(sx, sy);
    const p = 'M 0 0 C -7 -2 -8 -9 0 -15 C 8 -9 7 -2 0 0 Z';
    if (pierced) hole(p); else { fill(p, 'fixed', lightGold); line('M 0 -2 L 0 -11', ink, .7); }
    ctx.restore();
  };
  const flower = (x, y, radius = 4, pierced = false) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(radius / 4, radius / 4);
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.rotate(i * Math.PI * 2 / 5);
      const p = 'M 0 -1 C -5 -2 -4 -7 0 -8 C 4 -7 5 -2 0 -1 Z';
      if (pierced) hole(p); else { fill(p, 'fixed', gold); line(p, ink, .45); }
      ctx.restore();
    }
    ellipse(0, 0, 1.7, 1.7, ink); ellipse(0, 0, .8, .8, lightGold); ctx.restore();
  };
  const rivet = (x, y, radius = 4.2) => {
    ellipse(x, y, radius + 1, radius + 1, ink); ellipse(x, y, radius, radius, gold);
    ellipse(x, y, radius * .68, radius * .68, '#9C6B34'); ellipse(x, y, radius * .40, radius * .40, lightGold);
    ellipse(x - radius * .2, y - radius * .2, radius * .12, radius * .12, ivory);
  };
  const beads = (pathPoints, radius = .8) => { for (const [x, y] of pathPoints) ellipse(x, y, radius, radius, lightGold); };
  const curl = (x, y, s = 1, flip = 1) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * flip, s);
    line('M -9 4 C -13 0 -10 -6 -5 -5 C -6 -11 4 -12 5 -5 C 12 -8 16 2 9 5 L -9 5 M -4 1 C -1 -3 3 -2 3 1', gold, .85);
    ctx.restore();
  };
  const lace = (x, y, sx = 1, sy = 1, count = 4, horizontal = false) => {
    for (let i = 0; i < count; i++) {
      const cx = x + (horizontal ? i * 9 * sx : 0), cy = y + (horizontal ? 0 : i * 9 * sy);
      leaf(cx, cy, .35 * sx, .35 * sy, true, horizontal ? Math.PI / 2 : .4);
    }
  };
  const filigree = (x,y,s=1,flip=1,pierced=true) => {
    ctx.save();ctx.translate(x,y);ctx.scale(s*flip,s);
    line('M 0 2 C 8 -4 -7 -13 0 -20 C 8 -27 -6 -35 0 -41',gold,.48);
    line('M 2 -7 C 14 -9 14 -19 7 -19 C 1 -19 2 -11 7 -14 M -1 -25 C -13 -26 -13 -36 -6 -36 C 0 -36 -1 -29 -6 -31',lightGold,.43);
    leaf(7,-9,.24,.31,pierced,.65);leaf(-5,-22,.24,.31,pierced,-.75);
    flower(0,-20,1.35,pierced);flower(1,-40,1.1,pierced);
    beads([[3,-3],[-3,-13],[3,-29],[-3,-36]],.48);ctx.restore();
  };
  ctx.save(); ctx.scale(width / 100, height / 100);

  if (partId === 'head') {
    // Neck remains over the existing head pivot (u=.351, v=.962).
    panel('M 30 72 Q 48 70 59 79 L 57 98 Q 45 100 31 97 Z', 'fixed', skin);
    line('M 34 79 Q 45 82 54 80 M 34 86 L 52 89', '#BA884B', .65);
    if (mother) {
      // An open loop chignon and fine hanging ornaments distinguish the mother.
      panel('M 30 37 C 7 31 10 9 27 4 C 41 -1 56 8 53 22 C 51 33 44 37 30 37 Z', 'fixed', ink);
      hole('M 28 12 C 18 15 20 27 30 28 C 41 29 44 17 35 12 Q 31 10 28 12 Z');
      line('M 21 10 C 9 22 23 35 35 31 M 39 7 C 53 17 42 32 33 34', '#A47338', .7);
      panel('M 26 35 C 33 24 55 25 66 35 L 74 49 L 88 57 Q 90 60 83 61 L 83 66 L 78 67 Q 81 75 71 78 L 58 78 Q 54 87 41 84 C 19 80 13 58 26 35 Z', 'fixed', skin);
      panel('M 22 37 C 30 27 49 27 65 35 Q 58 41 49 42 C 41 45 36 47 34 59 L 35 73 Q 19 68 19 54 Q 18 44 22 37 Z', 'fixed', ink);
      line('M 24 41 Q 39 39 57 34 M 24 46 Q 39 44 48 40 M 25 52 Q 36 50 41 46', '#C28B44', .62);
      panel('M 23 33 Q 44 22 64 34 L 62 39 Q 40 32 25 40 Z', 'fixed', gold);
      for (const [x,y,r] of [[22,32,3.1],[38,29,3.7],[54,31,2.8]]) flower(x,y,r);
      ellipse(67, 38, 2, 2, red); line('M 65 38 L 66 46', gold, .8);
      line('M 28 39 C 21 51 18 64 22 78 M 24 43 C 15 53 15 69 17 83', gold, .9);
      beads([[26,46],[23,52],[22,58],[22,64],[22,70],[22,76],[20,83]], .9);
      fill('M 17 80 L 24 80 L 24 94 L 21 90 L 18 95 Z','fixed',red);
      panel('M 37 59 C 30 56 28 65 35 70 L 39 69', 'fixed', '#D7AA69');
      line('M 36 62 Q 32 62 35 67', ink, .6);
      ellipse(37, 73, 1.6, 2, gold); line('M 37 75 L 37 81', gold, .7); ellipse(37, 83, 1.5, 2, red);
      line('M 58 49 Q 67 48 76 53', ink, 1.1);
      fill('M 59 54 Q 67 50 75 56 Q 68 60 61 56 Z','fixed',ivory);
      fill('M 60 54 Q 68 52 75 56 Q 67 56 60 54 Z','fixed',ink); ellipse(70,55.5,1.5,1.7,ink);
      line('M 77 60 L 79 62 M 76 69 Q 80 69 82 68', red, .75);
    } else if (guardian) {
      // A tall pierced crest, third eye and falling beard form an original guard.
      panel('M 24 42 C 15 26 19 19 29 16 L 28 4 L 42 15 L 51 3 L 59 19 L 71 8 L 74 34 L 81 43 Z','fixed',slots.body);
      panel('M 46 19 Q 35 14 39 7 Q 40 11 44 11 Q 40 4 46 1 Q 44 7 50 10 Q 52 5 55 4 Q 60 12 50 20 Z','fixed',red);
      line('M 46 14 Q 42 10 46 7 M 49 16 L 53 11',gold,.65);
      hole('M 30 21 L 35 29 L 29 30 Z M 53 23 L 58 14 L 62 29 Z M 69 22 L 70 32 L 65 32 Z');
      line('M 24 35 Q 49 25 76 37 M 23 39 Q 51 30 78 41',gold,1.1);
      flower(48,29,3.5); flower(27,32,2.3); flower(71,34,2.3);
      panel('M 27 42 Q 49 35 66 44 L 76 55 L 92 61 L 84 65 L 85 71 L 77 73 Q 76 82 63 83 L 49 87 L 32 77 Z','fixed',skin);
      panel('M 23 43 L 36 43 Q 32 58 34 72 L 44 84 Q 29 83 23 69 Z','fixed',ink);
      line('M 28 47 L 28 68 M 31 46 L 31 63',gold,.65);
      panel('M 33 75 Q 43 77 51 80 Q 59 78 66 77 L 72 84 L 68 98 L 57 94 L 48 99 L 42 89 L 36 92 Z','fixed',ink);
      line('M 43 81 L 49 94 M 49 82 L 54 94 M 57 82 L 59 93 M 64 82 L 63 94',gold,.65);
      fill('M 57 70 Q 68 66 79 73 Q 66 72 60 76 Z','fixed',ink);
      line('M 55 51 Q 66 48 79 55',ink,1.8);
      fill('M 58 56 Q 68 53 78 58 Q 68 63 60 59 Z','fixed',ivory);
      fill('M 60 56 Q 69 55 77 58 L 62 59 Z','fixed',ink); ellipse(73,58,1.8,2,ink);
      panel('M 53 43 Q 58 38 63 44 Q 58 49 53 43 Z','fixed',ivory); ellipse(58,43,1.5,2.2,ink);
      line('M 79 62 L 82 64 M 74 75 L 79 75',red,.8);
      rivet(26,45,3.3);
      panel('M 19 38 Q 11 45 10 62 L 3 75 Q 14 73 20 60 L 24 44 Z','fixed',red);
      hole('M 13 53 Q 14 46 18 47 Q 20 52 13 57 Z');
    } else {
      // Compact tied cap and a clean youthful profile; no modern adaptation cues.
      panel('M 23 38 Q 15 24 24 14 Q 20 6 32 6 Q 43 7 48 16 L 62 21 L 69 35 Z','fixed',ink);
      hole('M 28 16 Q 27 10 33 13 L 37 19 Z M 27 26 L 30 22 L 34 27 L 30 30 Z');
      line('M 27 12 Q 34 12 39 19 M 23 31 Q 41 23 61 27',gold,.75);
      panel('M 24 36 C 33 28 53 29 65 38 L 74 50 L 89 57 L 82 62 L 82 67 L 77 68 Q 77 76 66 79 L 55 78 L 46 84 Q 29 81 24 67 Z','fixed',skin);
      panel('M 23 36 Q 42 26 64 36 L 69 44 Q 58 40 50 42 L 46 55 L 38 62 L 35 74 Q 23 67 22 53 Z','fixed',ink);
      line('M 27 41 Q 36 37 48 36 M 28 46 Q 36 41 45 40 M 29 51 L 36 46 M 38 51 L 34 59',gold,.65);
      panel('M 17 28 Q 37 15 61 21 L 69 31 Q 40 27 22 40 Z','fixed',red);
      panel('M 19 34 Q 42 21 65 26 L 68 31 Q 40 27 22 40 Z','fixed',slots.hem);
      line('M 27 32 Q 43 24 59 27',gold,.8); flower(59,27,2.4); rivet(23,35,2.7);
      panel('M 19 35 Q 12 43 3 48 L 6 56 Q 20 50 25 39 Z','fixed',red);
      hole('M 10 48 Q 15 43 16 47 Q 15 51 10 51 Z');
      panel('M 37 60 C 29 56 27 65 34 70 L 39 69', 'fixed', '#D6A564');
      line('M 35 62 Q 31 62 34 67',ink,.6);
      line('M 57 49 Q 66 48 75 53',ink,1.1);
      fill('M 59 55 Q 66 51 76 57 Q 68 61 61 57 Z','fixed',ivory);
      fill('M 59 54 Q 67 52 76 57 Q 69 56 59 54 Z','fixed',ink); ellipse(71,56.5,1.55,1.8,ink);
      line('M 77 60 L 79 62 M 74 70 Q 79 71 81 69',red,.8);
    }
    rivet(35.1,95.2,2.3);
  } else if (partId === 'torso') {
    if (mother) {
      panel('M 32 3 Q 48 0 66 5 L 78 22 Q 71 41 81 60 Q 88 80 96 96 Q 76 100 53 97 Q 27 101 4 96 L 19 66 Q 28 45 24 26 L 18 16 Z','body');
      // The long blue outer panels frame a quiet green skirt and curved hem.
      panel('M 29 9 Q 42 14 50 22 Q 42 40 44 52 Q 32 75 11 93 L 26 97 Q 53 80 61 55 L 64 24 L 51 9 Z','hem');
      panel('M 65 13 Q 73 24 68 39 Q 73 69 89 94 L 78 96 Q 61 78 55 52 L 58 23 Z','sleeve');
      line('M 25 18 Q 44 18 55 28 M 28 22 Q 39 24 49 28',gold,.7);
      panel('M 27 47 Q 45 45 67 48 L 69 53 Q 48 55 27 52 Z','fixed',ink); flower(57,50,3.4);
      fill('M 57 53 Q 44 68 27 72 Q 36 64 44 56 Z','fixed',red);
      fill('M 60 53 Q 70 66 76 77 Q 66 69 58 58 Z','fixed',red);
      line('M 19 91 Q 50 93 89 92 M 17 94 Q 51 96 90 95',gold,.9);
      for (const x of [22,39,57,75]) flower(x,90,1.4);
      for (const [x,y] of [[26,69],[36,77],[58,68],[68,80],[78,86],[38,87],[19,86]]) leaf(x,y,.28,.32,true,.45);
      for (const [x,y] of [[20,80],[29,60],[31,82],[65,64],[72,76],[82,89]]) flower(x,y,1.5);
      for (const [x,y] of [[23,34],[24,43],[25,53]]) { flower(x,y,1.5); leaf(x+4,y+3,.22,.28,true,.7); }
      line('M 31 59 Q 20 75 17 87 M 64 58 Q 73 78 82 89',gold,.7);
      // Small embroidery on the light skirt; its middle remains an unbroken skin.
      for (const [x,y] of [[46,66],[48,76],[48,86]]) { flower(x,y,1.8); leaf(x+5,y+2,.20,.25,false,.6); }
      line('M 48 57 Q 42 70 43 86 M 53 60 Q 58 76 61 87', '#B37636', .45);
      rivet(13,11.5,3.5); rivet(87,11.5,3.5);
    } else if (guardian) {
      panel('M 28 4 Q 47 0 71 5 L 89 20 L 80 43 Q 87 68 97 94 Q 82 100 54 95 Q 28 101 3 94 Q 18 67 21 45 L 9 22 Z','body');
      panel('M 24 13 Q 42 5 70 14 L 75 40 Q 51 45 25 40 Z','sleeve');
      // Overlapping scale rows, drawn rather than filling the silhouette with dots.
      for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
        const x=29+col*10+(row%2?4:0), y=17+row*4.8;
        line(`M ${x} ${y} Q ${x+4} ${y+6} ${x+8} ${y} M ${x+1} ${y+1} L ${x+2} ${y+3}`,gold,.65);
      }
      panel('M 17 43 Q 48 39 81 43 L 83 49 Q 52 53 17 49 Z','fixed',ink); flower(61,46,3.5);
      panel('M 29 51 L 48 53 Q 48 76 40 94 L 9 94 Q 24 72 29 51 Z','hem');
      panel('M 54 53 L 70 51 Q 79 76 93 94 L 61 95 Q 54 77 54 53 Z','hem');
      panel('M 44 52 L 57 52 L 67 94 L 52 98 L 37 94 Z','sleeve');
      for (let r=0;r<6;r++) { const y=58+r*5.3; line(`M 18 ${y+4} Q 28 ${y+8} 41 ${y+4} M 62 ${y+4} Q 76 ${y+8} 86 ${y+4}`,gold,.75); }
      for (const y of [59,70,81,91]) flower(51,y,1.9);
      lace(23,61,.75,.65,4); lace(76,60,.75,.65,4);
      fill('M 19 50 Q 20 67 6 79 L 12 80 Q 31 67 28 52 Z','fixed',red);
      line('M 10 93 Q 26 96 39 93 M 64 93 Q 77 96 90 93',gold,1);
      // The four-piece rig includes this fixed left arm in its torso image.
      panel('M 7 15 Q 15 11 23 17 L 28 28 L 19 40 L 7 38 L 2 29 Z','sleeve');
      panel('M 8 37 Q 15 35 21 40 L 22 50 L 17 55 L 5 52 Z','body');
      panel('M 6 49 L 21 49 L 21 54 Q 13 57 5 53 Z','hem');
      panel('M 7 54 Q 12 53 17 55 L 17 59 L 21 62 Q 21 64 18 64 L 13 61 L 16 66 L 13 67 L 8 61 L 5 58 Z','fixed',skin);
      line('M 9 58 L 14 62 M 8 29 L 21 35 M 8 34 L 19 38',gold,.7);
      curl(14,25,.36); rivet(13,12,3.6); rivet(13,39.3,2.8);
      rivet(87,11.5,3.6);
    } else {
      panel('M 30 3 Q 48 0 69 5 L 85 21 Q 77 40 82 65 L 96 92 Q 77 99 54 92 Q 27 100 4 92 L 20 66 Q 24 40 15 22 Z','body');
      // A clear central field receives all three existing user carving segments.
      panel('M 32 9 L 45 6 Q 51 14 63 20 L 54 27 L 34 17 Z','hem');
      panel('M 65 7 L 75 12 L 67 31 L 56 24 Z','hem');
      line('M 31 11 L 48 21 M 67 11 L 62 21',gold,.8);
      beads([[34,12],[38,15],[42,18],[46,20],[67,14],[65,18]],.62);
      panel('M 18 65 Q 49 61 81 65 L 82 71 Q 49 76 18 71 Z','fixed',ink);
      flower(62,68,3.6); ellipse(61,67.5,1.3,1.3,red);
      fill('M 55 72 Q 40 81 20 83 L 17 87 Q 43 86 61 74 Z','fixed',red);
      fill('M 64 72 Q 70 84 83 89 L 88 87 Q 77 81 69 72 Z','fixed',red);
      panel('M 19 75 L 48 76 L 44 94 Q 26 98 10 91 Z','hem');
      panel('M 53 76 L 79 74 L 92 91 Q 77 96 55 94 Z','hem');
      line('M 17 89 Q 29 93 41 90 M 58 91 Q 77 93 87 88',gold,1.1);
      flower(30,84,2.4); flower(70,84,2.4); curl(43,91,.24,-1);
      lace(25,31,.45,.75,4); lace(76,31,.45,.75,4);
      line('M 23 31 Q 29 47 22 60 M 78 31 Q 72 47 79 59',gold,.9);
      leaf(18,53,.25,.38,false,-.25); leaf(82,53,.25,.38,false,.25);
      rivet(13,18,4.4); rivet(87,18,4.4);
    }
  } else if (/UpperArm$/.test(partId)) {
    // Both ends overlap their neighbours at the unchanged shoulder/elbow pivots.
    const outline = mother ? 'M 27 5 Q 50 -1 73 6 Q 76 28 91 56 L 98 80 Q 81 96 60 98 Q 34 94 9 80 L 20 48 Z' : guardian ? 'M 25 4 Q 50 -1 74 5 L 84 25 Q 78 47 95 72 L 83 88 Q 65 99 41 96 L 7 80 L 20 46 Z' : 'M 24 5 Q 49 -1 75 6 L 82 30 Q 80 53 96 76 L 85 87 Q 66 98 43 96 L 5 78 Q 23 55 19 33 Z';
    panel(outline,'sleeve');
    panel('M 16 69 Q 49 83 88 71 L 96 80 Q 73 98 43 96 L 8 81 Z','hem');
    line('M 15 74 Q 52 88 90 76 M 18 80 Q 52 93 85 82',gold,.85);
    rivet(50,12,7.1); rivet(50,92,6.5);
    // Keep the broad middle clear: mother sharedMotif occupies u .21-.79 / v .33-.79.
    line('M 25 26 Q 29 47 17 62 M 75 27 Q 71 45 84 62',gold,.8);
    lace(28,43,.42,.7,3); lace(73,43,.42,.7,3);
    flower(30,79,2); flower(71,81,2);
    if (guardian) {
      for (let row=0;row<4;row++) for(let col=0;col<3;col++){const x=31+col*13,y=30+row*9;line(`M ${x} ${y} Q ${x+6} ${y+11} ${x+12} ${y}`,gold,.85);}
    } else if (!mother) { curl(49,32,.62); leaf(48,58,.35,.65,false,.35); }
  } else if (/Forearm$/.test(partId)) {
    // The pale hand ends at v=.895, exactly where the rod and prop anchor sit.
    panel('M 28 3 Q 49 -1 72 4 L 79 24 Q 66 45 76 65 L 65 76 Q 45 80 27 72 Q 37 48 20 25 Z','sleeve');
    panel('M 27 54 Q 50 63 74 55 L 78 67 Q 49 77 25 68 Z','hem');
    line('M 28 58 Q 49 66 73 60 M 28 64 Q 50 72 74 65',gold,.9);
    panel('M 35 70 Q 49 69 62 73 L 63 80 Q 76 82 79 86 L 93 88 Q 97 91 90 92 L 73 90 L 89 95 Q 90 98 84 97 L 66 92 L 76 98 Q 75 100 69 97 L 55 92 Q 46 96 37 92 L 26 83 Q 23 79 27 77 L 38 83 L 40 79 Z','fixed',skin);
    line('M 44 80 Q 52 83 63 84 M 44 87 L 56 91 M 65 86 L 75 88', '#A56E39', .65);
    rivet(50,9.6,7); rivet(50,88.8,3.5);
    line('M 30 28 Q 48 35 68 29 M 32 32 Q 48 40 67 34',gold,.8);
    flower(49,43,mother?4.4:3.8); lace(34,39,.38,.6,2); lace(66,39,.38,.6,2);
    if (guardian) { for (const y of [21,29,37,45]) line(`M 32 ${y} L 66 ${y+9} M 66 ${y} L 32 ${y+9}`,gold,.65); }
  } else if (/Thigh$/.test(partId) && !mother && !guardian) {
    panel('M 27 4 Q 50 0 73 5 Q 78 27 87 48 L 79 84 Q 65 97 42 96 L 14 85 L 17 53 Z','hem');
    panel('M 20 12 Q 50 21 78 13 L 83 30 Q 53 36 20 28 Z','body');
    line('M 21 19 Q 49 28 79 21 M 20 25 Q 50 34 80 27',gold,.85);
    line('M 26 36 Q 19 56 24 75 M 73 37 Q 79 59 73 77',gold,.9);
    flower(51,52,5); leaf(36,67,.42,.7,true,-.35); leaf(66,68,.42,.7,true,.35);
    panel('M 18 78 Q 50 88 79 79 L 78 91 Q 53 101 22 91 Z','body');
    rivet(50,11.4,7.2); rivet(50,91.4,6.5);
  } else if (/Shin$/.test(partId) && !mother && !guardian) {
    // The knee is u=.318, v=.122; the soft boot turns right inside its old box.
    panel('M 16 3 Q 32 0 50 4 L 51 40 Q 46 59 57 69 L 88 73 Q 96 68 98 74 Q 98 86 86 91 Q 66 97 44 93 L 7 91 L 3 81 L 10 63 Z','hem');
    panel('M 12 10 L 48 10 L 49 22 Q 31 26 12 20 Z','body');
    line('M 12 16 Q 31 22 48 16 M 16 31 L 43 39 M 15 39 L 43 47 M 14 47 L 42 55',gold,.9);
    panel('M 8 68 Q 30 74 49 65 L 57 73 Q 36 85 7 77 Z','fixed',ink);
    line('M 9 73 Q 33 80 52 72 M 8 85 Q 49 93 86 86 Q 92 84 95 79',gold,1);
    curl(67,79,.52); flower(24,58,3); lace(19,33,.45,.75,3);
    rivet(31.8,12.2,5.3);
  } else {
    ctx.restore(); throw new Error(`Unknown designed part: ${role}/${partId}`);
  }
  // T10 author direction: denser pierced flower-vines, with a clear central
  // user-carving field and the mother's shared-motif window left intact.
  // source-atop keeps fine gold engraving inside the existing leather shape.
  ctx.save();ctx.globalCompositeOperation='source-atop';
  if(partId==='head'){
    if(mother){for(const [x,y]of [[23,31],[38,29],[53,32]]){flower(x,y,1.1,true);beads([[x-2,y+4],[x,y+5],[x+2,y+4]],.45);}line('M 25 35 Q 44 29 62 36',lightGold,.35);}
    else if(guardian){for(const x of [29,39,61,71]){leaf(x,31,.17,.24,true,.2);ellipse(x,36,.55,.55,lightGold);}line('M 25 38 Q 50 31 76 39',lightGold,.35);}
    else{for(const x of [31,40,49]){flower(x,29-(x-31)*.16,.85,true);beads([[x,33-(x-31)*.16]],.45);}line('M 25 35 Q 42 26 62 30',lightGold,.35);}
  }else if(partId==='torso'){
    if(mother){filigree(27,88,.55,-1);filigree(73,87,.55);filigree(36,73,.38,-1);filigree(64,73,.38);for(const [x,y]of [[20,90],[33,93],[67,93],[81,91]])flower(x,y,1.65,true);line('M 17 89 Q 28 93 37 89 M 66 89 Q 77 93 87 89',lightGold,.35);}
    else if(guardian){for(const x of [24,34,70,80])filigree(x,87,.57,x<50?-1:1);for(const y of [56,66,76,86]){flower(51,y,1.55,true);leaf(47,y+3,.13,.18,true,-.8);leaf(56,y+3,.13,.18,true,.8);}for(let y=18;y<39;y+=4)for(let x=31;x<68;x+=9)ellipse(x+(y%8?3:0),y,.45,.45,lightGold);}
    else{for(const x of [25,73]){filigree(x,91,.32,x<50?-1:1);flower(x,84,1.8,true);}for(const x of [16,22,28,34,40,59,65,71,77,83])leaf(x,93,.14,.19,true,Math.PI/2);line('M 16 87 Q 28 91 41 87 M 58 87 Q 75 91 86 86',lightGold,.35);}
  }else if(/UpperArm$/.test(partId)){
    if(mother){filigree(15,68,.49,-1);filigree(86,68,.49);for(const x of [28,43,59,74])flower(x,84,1.45,true);}
    else{filigree(38,65,.72,-1);filigree(64,65,.72);flower(50,45,2.25,true);for(const x of [25,38,64,78])flower(x,82,1.35,true);}
    line('M 19 72 Q 49 86 87 74 M 23 86 Q 51 95 80 86',lightGold,.4);
  }else if(/Forearm$/.test(partId)){
    filigree(33,52,.48,-1);filigree(65,52,.48);flower(49,43,2.0,true);for(const x of [34,44,55,66])leaf(x,65,.17,.23,true,Math.PI/2);line('M 29 57 Q 51 64 73 58',lightGold,.35);
  }else if(/Thigh$/.test(partId)){
    filigree(32,75,.65,-1);filigree(68,75,.65);flower(51,52,2.2,true);for(const x of [28,40,61,72])flower(x,85,1.1,true);
  }else if(/Shin$/.test(partId)){
    filigree(29,61,.56);for(const x of [22,35,48,61,74,85])leaf(x,87,.13,.20,true,Math.PI/2);flower(67,79,1.4,true);
  }
  ctx.restore();ctx.restore();
}
