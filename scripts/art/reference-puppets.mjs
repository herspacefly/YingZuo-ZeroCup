/** Measured segmentation of the project-owned 1536x1024 direction plate.
 * Polygon coordinates stay in source pixels; a/b are rivet/wrist positions.
 * The renderer receives independent transparent pieces, never the whole plate.
 */
const piece=(polygon,a,b,length,scale)=>({polygons:[polygon],a,b,length,scale});
export const referencePuppets={
  'chenxiang-v1':{
    joints:{head:[.052,.40],leftShoulder:[-.035,.365],rightShoulder:[.015,.365],leftHip:[-.07,-.03],rightHip:[.07,-.03]},
    pieces:{
      torso:piece([[273,208],[309,209],[320,201],[334,207],[332,233],[338,267],[340,305],[336,327],[353,363],[341,395],[367,431],[357,464],[379,510],[348,535],[319,516],[298,482],[289,443],[264,479],[234,518],[195,480],[218,443],[242,399],[253,372],[237,353],[245,336],[273,328],[271,297],[267,268],[264,239]],[290,480],null,null,.00148),
      head:piece([[236,84],[259,83],[278,92],[313,83],[337,91],[347,107],[351,124],[354,141],[363,158],[365,166],[359,173],[361,182],[354,190],[345,191],[337,204],[325,214],[311,208],[300,199],[292,183],[281,173],[267,169],[257,192],[245,213],[235,210],[231,195],[232,171],[211,190],[195,198],[174,188],[190,176],[210,159],[235,142],[234,119]],[325,209],null,null,.00148),
      leftUpperArm:piece([[281,217],[298,244],[278,275],[254,310],[235,337],[184,281],[245,238]],[282,230],[197,305],.17),
      rightUpperArm:piece([[282,217],[311,239],[340,252],[391,284],[399,306],[381,320],[348,337],[306,306],[285,276],[267,247]],[282,230],[398,312],.21),
      leftForearm:piece([[184,295],[208,302],[210,318],[183,339],[151,370],[127,386],[119,405],[105,419],[101,433],[96,433],[96,416],[91,428],[87,427],[93,397],[96,387],[111,368],[141,338],[170,310]],[197,305],[119,376],.15),
      rightForearm:piece([[389,299],[409,303],[453,293],[486,287],[495,284],[512,271],[540,259],[547,260],[525,276],[548,268],[551,272],[531,282],[535,286],[519,284],[514,294],[506,305],[496,308],[474,322],[443,334],[421,337],[399,330],[387,322]],[398,312],[496,298],.15),
      leftThigh:piece([[215,522],[241,536],[223,563],[202,589],[180,622],[158,630],[143,617],[158,590],[181,554],[199,535]],[225,535],[165,608],.14),
      rightThigh:piece([[338,522],[369,521],[381,548],[373,581],[376,614],[365,631],[345,619],[334,576],[331,548]],[354,537],[365,620],.14),
      leftShin:piece([[151,595],[176,605],[166,630],[149,649],[161,660],[184,670],[184,680],[173,689],[149,686],[111,664],[116,647],[128,623],[141,610]],[165,608],[140,650],.073),
      rightShin:piece([[349,611],[375,613],[380,645],[392,663],[417,668],[434,659],[434,681],[417,691],[355,695],[353,669]],[365,620],[380,670],.085),
    },
  },
  'mother-v1':{
    joints:{head:[.047,.35],leftShoulder:[.012,.333],rightShoulder:[.012,.333]},
    pieces:{
      torso:piece([[735,212],[753,203],[777,211],[782,231],[786,256],[802,290],[815,321],[811,350],[821,398],[823,445],[841,500],[847,554],[868,608],[891,668],[909,680],[902,695],[858,696],[807,690],[769,699],[725,691],[680,695],[629,694],[590,699],[527,689],[534,672],[587,648],[607,615],[644,582],[668,527],[684,480],[707,437],[724,389],[736,350],[730,308],[719,266]],[735,485],null,null,.00130),
      head:piece([[724,18],[748,17],[775,30],[785,67],[806,68],[812,80],[808,99],[798,117],[812,142],[811,170],[789,181],[780,205],[783,231],[762,243],[746,225],[731,206],[718,188],[713,157],[715,130],[699,103],[681,89],[680,65],[677,43],[693,22]],[771,214],null,null,.00126),
      leftUpperArm:piece([[735,216],[756,233],[748,265],[729,303],[715,342],[694,361],[668,347],[662,304],[679,280],[699,260],[713,231]],[744,229],[699,313],.125),
      rightUpperArm:piece([[741,217],[768,233],[792,254],[839,278],[871,282],[888,294],[875,312],[861,334],[847,371],[830,399],[813,415],[797,397],[791,360],[777,322],[758,279],[731,245]],[744,229],[870,295],.185),
      leftForearm:piece([[692,300],[717,316],[716,341],[696,374],[678,419],[657,468],[639,509],[616,540],[603,542],[593,512],[586,471],[579,436],[568,428],[557,436],[549,436],[556,424],[566,413],[574,408],[589,390],[621,366],[650,340],[675,316]],[699,313],[591,393],.175),
      rightForearm:piece([[862,285],[884,283],[913,276],[943,267],[960,259],[980,250],[1007,247],[1022,250],[1022,253],[1004,254],[1015,259],[1020,267],[1015,269],[1002,261],[995,262],[1007,274],[1004,279],[994,269],[985,267],[982,281],[971,287],[957,282],[947,302],[939,344],[930,391],[916,429],[901,453],[878,469],[858,465],[846,438],[848,399],[855,351]],[870,295],[963,271],.125),
    },
  },
  'guardian-v1':{
    joints:{head:[.035,.33],rightShoulder:[-.035,.33]},
    pieces:{
      torso:piece([[1214,218],[1257,217],[1286,206],[1300,227],[1300,260],[1313,276],[1313,306],[1335,331],[1340,364],[1337,400],[1355,436],[1396,487],[1420,545],[1431,603],[1467,646],[1501,673],[1502,692],[1464,695],[1425,695],[1413,680],[1387,630],[1369,610],[1353,613],[1338,655],[1312,680],[1299,694],[1220,698],[1174,693],[1155,667],[1167,631],[1184,599],[1139,625],[1098,673],[1060,692],[1003,681],[1037,662],[1064,620],[1093,590],[1115,550],[1130,502],[1161,460],[1189,409],[1180,370],[1160,336],[1132,364],[1104,380],[1085,406],[1081,425],[1091,438],[1103,412],[1118,396],[1137,402],[1155,368],[1163,307],[1178,260]],[1260,485],null,null,.00130),
      head:piece([[1247,5],[1267,23],[1277,53],[1300,47],[1314,73],[1320,99],[1329,129],[1329,157],[1333,180],[1327,190],[1310,187],[1304,180],[1313,212],[1326,260],[1316,277],[1285,277],[1262,231],[1242,210],[1219,201],[1207,184],[1194,178],[1186,202],[1160,220],[1130,236],[1096,231],[1092,215],[1103,206],[1132,198],[1170,165],[1174,154],[1139,161],[1109,178],[1084,173],[1069,159],[1070,149],[1087,146],[1097,157],[1112,151],[1136,139],[1166,134],[1196,121],[1198,85],[1200,57],[1207,31],[1218,51],[1224,60],[1233,51],[1243,60]],[1287,227],null,null,.00120),
      rightUpperArm:piece([[1222,220],[1251,232],[1300,240],[1343,244],[1391,242],[1407,253],[1393,267],[1375,284],[1367,309],[1329,319],[1303,299],[1272,284],[1239,266]],[1232,230],[1396,253],.21),
      rightForearm:piece([[1383,256],[1395,267],[1423,271],[1459,251],[1464,238],[1477,222],[1498,205],[1500,159],[1496,156],[1485,185],[1494,157],[1490,156],[1477,182],[1476,158],[1472,159],[1460,190],[1455,194],[1454,234],[1422,248],[1401,244]],[1396,253],[1467,232],.11),
    },
  },
};

referencePuppets['chenxiang-v1'].pieces.torso.polygons.push(
  [[282,348],[266,371],[241,395],[223,410],[185,425],[140,446],[110,455],[84,467],[46,484],[41,497],[72,499],[97,513],[118,519],[139,500],[150,481],[165,468],[181,467],[224,458],[249,438],[271,413],[281,389]],
  [[306,371],[324,385],[337,433],[335,469],[327,503],[328,540],[337,567],[326,590],[315,581],[311,548],[310,509],[316,478],[317,447],[306,420]],
);
referencePuppets['chenxiang-v1'].pieces.head.protectPolygons=[[[313,124],[338,128],[350,143],[354,151],[363,158],[365,166],[359,173],[361,182],[354,190],[345,191],[337,204],[325,214],[313,208],[308,191],[299,185],[292,177],[291,163],[297,151]]];
referencePuppets['mother-v1'].pieces.head.protectPolygons=[[[761,126],[785,128],[798,139],[807,150],[812,158],[810,170],[800,174],[789,181],[780,204],[777,221],[764,227],[755,214],[754,195],[747,181],[742,169],[746,150]]];
referencePuppets['guardian-v1'].pieces.head.protectPolygons=[[[1286,121],[1307,124],[1322,137],[1329,151],[1329,157],[1333,180],[1327,190],[1310,187],[1304,180],[1297,175],[1287,179],[1282,164],[1277,154],[1274,139]]];
// These small source-paper wedges were accidentally inside the face protection.
// Only release ivory pixels from protection: collar, beard and real amber skin
// still survive the normal paper test. Do not change the rig/image bounds.
referencePuppets['chenxiang-v1'].pieces.head.neckPaper=[325,190,345,214];
referencePuppets['mother-v1'].pieces.head.neckPaper=[770,180,789,221];
referencePuppets['guardian-v1'].pieces.head.neckPaper=[1307,172,1333,190];

export function referenceGeometry(spec){
  const [ax,ay]=spec.a,dx=spec.b?spec.b[0]-ax:0,dy=spec.b?spec.b[1]-ay:1;
  const len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,s=spec.scale??spec.length/len;
  const local=([x,y])=>[s*((x-ax)*uy-(y-ay)*ux),-s*((x-ax)*ux+(y-ay)*uy)];
  const all=spec.polygons.flat().map(local),pad=.002;
  return {s,ux,uy,bounds:{minX:Math.min(...all.map(p=>p[0]))-pad,minY:Math.min(...all.map(p=>p[1]))-pad,maxX:Math.max(...all.map(p=>p[0]))+pad,maxY:Math.max(...all.map(p=>p[1]))+pad}};
}

// Measured palm/finger grips in the direction plate, distinct from the wrist
// endpoints used by rods and IK. Props sit behind the hand, not over the sleeve.
export const referencePropGrips={
  'chenxiang-v1':{
    // Pixel (80,330) on the 304x544 axe is the lower shaft, not the image center.
    axe:{sourcePoint:[522,284],pivot:[0,-.08625],bindAngleRad:-1.2,orientation:'follow-host'},
    // The finger hooks the ring's left rim; its body hangs just outside the sleeve.
    lantern:{sourcePoint:[522,284],pivot:[-.01,0],bindAngleRad:0,orientation:'upright'},
  },
  'guardian-v1':{staff:{sourcePoint:[1481,201],bindAngleRad:-1.05,orientation:'follow-host'}},
};
export function bindReferencePropGrips(template){
  for(const attachment of template.attachments){
    const grip=referencePropGrips[template.id]?.[attachment.id];if(!grip)continue;
    const piece=referencePuppets[template.id].pieces[attachment.partId],g=referenceGeometry(piece);
    const arm=template.arms.find(a=>attachment.partId===`${a.side}Forearm`);
    if(!arm||!piece.b)throw new Error('A prop grip requires its measured forearm');
    const factor=arm.lowerLength/piece.length,dx=grip.sourcePoint[0]-piece.a[0],dy=grip.sourcePoint[1]-piece.a[1];
    attachment.anchor=[g.s*(dx*g.uy-dy*g.ux)*factor,-g.s*(dx*g.ux+dy*g.uy)*factor];
    attachment.pivot=[...(grip.pivot??[0,0])];
    attachment.bindAngleRad=grip.bindAngleRad;attachment.orientation=grip.orientation;attachment.drawOrder=30.5;
  }
  if(template.id==='mother-v1')for(const prop of template.attachments){const arm=template.arms.find(a=>a.side==='right'),part=template.parts.find(p=>p.partId==='rightForearm');if(prop.id==='lantern'&&arm&&part){prop.anchor=[arm.handLocal[0]+.015,arm.handLocal[1]-.012];prop.orientation='upright';prop.bindAngleRad=0;prop.drawOrder=part.drawOrder-.5;}}
  return template;
}

export function bindReferencePuppets(templates){
  for(const t of templates){
    const config=referencePuppets[t.id];
    const baseAnchors={head:[0,.3],leftShoulder:[-.085,.24],rightShoulder:[.085,.24],leftElbow:[0,-.17],rightElbow:[0,-.17],leftHip:[-.05,-.03],rightHip:[.05,-.03],leftKnee:[0,-.14],rightKnee:[0,-.14]};
    for(const j of t.joints)j.anchor=[...baseAnchors[j.jointId]];
    t.rods.find(r=>r.id==='body').point=[0,.14];
    for(const j of t.joints){if(config.joints[j.jointId])j.anchor=[...config.joints[j.jointId]];}
    for(const side of ['left','right']){
      const upper=config.pieces[`${side}UpperArm`],fore=config.pieces[`${side}Forearm`];if(!upper||!fore)continue;
      t.joints.find(j=>j.jointId===`${side}Elbow`).anchor=[0,-upper.length];
      const arm=t.arms.find(a=>a.side===side);arm.upperLength=upper.length;arm.lowerLength=fore.length;arm.handLocal=[0,-fore.length];
      t.rods.find(r=>r.id===`${side}Hand`).point=[...arm.handLocal];
      for(const a of t.attachments.filter(a=>a.partId===`${side}Forearm`))a.anchor=[...arm.handLocal];
    }
    for(const p of t.parts){p.bounds=referenceGeometry(config.pieces[p.partId]).bounds;p.pivot=[0,0];p.bindAngleRad=0;}
    // Template height remains exactly .9 world units; rigid bindings and IK lengths
    // are scaled together. This is a visual rig revision, not saved pose conversion.
    const joint=(id)=>{if(!id)return [0,0];const j=t.joints.find(j=>j.jointId===id),a=joint(j.parentJoint);return[a[0]+j.anchor[0],a[1]+j.anchor[1]];};
    const xs=[],ys=[];for(const p of t.parts){const a=joint(p.parentJoint);xs.push(a[0]+p.bounds.minX,a[0]+p.bounds.maxX);ys.push(a[1]+p.bounds.minY,a[1]+p.bounds.maxY);}
    const factor=.9/(Math.max(...ys)-Math.min(...ys));
    for(const p of t.parts)for(const k of Object.keys(p.bounds))p.bounds[k]*=factor;
    for(const j of t.joints)j.anchor=j.anchor.map(n=>n*factor);
    for(const a of t.arms){a.upperLength*=factor;a.lowerLength*=factor;a.handLocal=a.handLocal.map(n=>n*factor);}
    for(const r of t.rods)r.point=r.point.map(n=>n*factor);
    for(const a of t.attachments)a.anchor=a.anchor.map(n=>n*factor);
    t.bounds={minX:Math.min(...xs)*factor,minY:Math.min(...ys)*factor,maxX:Math.max(...xs)*factor,maxY:Math.max(...ys)*factor};
    t.motionEnvelope={minX:-.85,minY:-.8,maxX:.85,maxY:.85};
    if(t.motifPlacement)t.motifPlacement.bounds=t.id==='chenxiang-v1'?{minX:-.1*factor,minY:-.035*factor,maxX:.03*factor,maxY:.23*factor}:{minX:-.09*factor,minY:-.15*factor,maxX:-.035*factor,maxY:-.055*factor};
    t.note='由本项目AI方向图按作者要求裁切的皮影设计稿；原图关节点测量绑定，头身比例/袖形/手型/衣饰直接取图，Pose仍为既有世界坐标与关节弧度偏移。';
    config.factor=factor;bindReferencePropGrips(t);
  }
  return templates;
}

/** Self-contained browser function, serialized by the reproducible generator. */
export function drawReferencePart(ctx,spec,image){
  const {piece,geometry,bounds,width,height,mode}=spec;
  const xs=piece.polygons.flat().map(p=>p[0]),ys=piece.polygons.flat().map(p=>p[1]);
  const x=Math.floor(Math.min(...xs))-2,y=Math.floor(Math.min(...ys))-2,w=Math.ceil(Math.max(...xs))-x+3,h=Math.ceil(Math.max(...ys))-y+3;
  const cut=document.createElement('canvas');cut.width=w;cut.height=h;const c=cut.getContext('2d');if(!c)throw new Error('Canvas2D unavailable');
  c.save();c.beginPath();for(const polygon of piece.polygons){polygon.forEach(([px,py],i)=>i?c.lineTo(px-x,py-y):c.moveTo(px-x,py-y));c.closePath();}c.clip();c.drawImage(image,-x,-y);c.restore();
  const pixels=c.getImageData(0,0,w,h);
  const protect=new Path2D();for(const polygon of piece.protectPolygons??[]){polygon.forEach(([px,py],i)=>i?protect.lineTo(px-x,py-y):protect.moveTo(px-x,py-y));protect.closePath();}
  for(let i=0;i<pixels.data.length;i+=4){
    const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
    // The ivory paper is removed inside the measured silhouette too, retaining
    // actual pierced flowers. Amber skin, ochre leather and dark ink survive.
    const sx=x+(i/4)%w,sy=y+Math.floor(i/4/w),neck=piece.neckPaper;
    const neckPaper=neck&&sx>=neck[0]&&sx<=neck[2]&&sy>=neck[1]&&sy<=neck[3];
    const protectedSkin=!neckPaper&&((piece.protectPolygons&&c.isPointInPath(protect,(i/4)%w,Math.floor(i/4/w)))||(spec.partId.endsWith('Forearm')&&r>g*1.12&&g>b*1.20));
    if(!protectedSkin&&r>208&&g>180&&b>142&&r-g<48&&g-b<66){const keep=1-Math.min(1,Math.max(0,Math.min((r-208)/22,(g-180)/25,(b-142)/30)));pixels.data[i+3]=Math.round(pixels.data[i+3]*keep);}
    if(mode==='regions'&&pixels.data[i+3]){
      let code=[255,255,0];
      if(spec.partId!=='head'){
        const sx=x+(i/4)%w,sy=y+Math.floor(i/4/w),isArm=/UpperArm|Forearm/.test(spec.partId);
        const spread=Math.max(r,g,b)-Math.min(r,g,b),ink=Math.max(r,g,b)<80&&spread<24;
        const gold=r>105&&g>75&&r>g*1.1&&r<g*1.65&&g>b*1.18;
        const palePrint=r>175&&g>170&&b>130;
        const dx=piece.b?piece.b[0]-piece.a[0]:0,dy=piece.b?piece.b[1]-piece.a[1]:1;
        const length=Math.hypot(dx,dy),along=((sx-piece.a[0])*dx+(sy-piece.a[1])*dy)/length;
        const hand=spec.partId.endsWith('Forearm')&&(protectedSkin||along>length*.82);
        if(!ink&&!gold&&!palePrint&&!hand){
          if(isArm)code=[0,255,0];
          else if(spec.partId==='torso'&&sy<340)code=[255,0,0];
          else code=[0,0,255];
        }
      }
      pixels.data[i]=code[0];pixels.data[i+1]=code[1];pixels.data[i+2]=code[2];
    }
  }
  c.putImageData(pixels,0,0);
  const s=geometry.s*spec.factor,ux=geometry.ux,uy=geometry.uy,[ax,ay]=piece.a;
  const kx=width/(bounds.maxX-bounds.minX),ky=height/(bounds.maxY-bounds.minY);
  ctx.save();ctx.setTransform(kx*s*uy,ky*s*ux,-kx*s*ux,ky*s*uy,
    kx*(s*((x-ax)*uy-(y-ay)*ux)-bounds.minX),ky*(bounds.maxY+s*((x-ax)*ux+(y-ay)*uy)));
  ctx.imageSmoothingEnabled=mode!=='regions';ctx.drawImage(cut,0,0);ctx.restore();
}
