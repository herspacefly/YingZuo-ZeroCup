import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { assetCatalog } from '../../content/catalog';
import type { Bounds, PuppetTemplate } from '../../content/asset-types';
import { attachmentTransform, jointTransform, partTransform, rodPoint } from '../../domain/pose';
import { localToWorld, LAMP_DEPTH } from '../../domain/projection';
import { PartCompositor } from '../canvas/compositing';
import { prepareFrame, requiredAssets } from '../canvas/frame';
import { TextureCache } from '../canvas/texture-cache';
import type { CanvasFrame } from '../canvas/types';
import { boundedTextureSize, spatialResourceScope, stageCamera } from './geometry';
import type { StageView } from './geometry';

export type { StageView } from './geometry';
export type SpatialStatus = { state: 'loading' | 'ready' | 'error' | 'lost'; message: string };
export interface SpatialOptions { pixelRatio: number; maxWidth: number; textureSize: number }

interface ActorObjects {
  group: THREE.Group;
  parts: { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; partId: string; attachment: boolean }[];
  rods: { line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>; rodId: string }[];
  joints: { mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>; jointId: PuppetTemplate['joints'][number]['jointId'] }[];
}

/** Optional, event-driven spatial observation of the existing Canvas frame. No clock or input ownership. */
export function mountThreeStage(host: HTMLElement, source: HTMLCanvasElement, options: SpatialOptions,
  onStatus: (status: SpatialStatus) => void) {
  const canvas = document.createElement('canvas'); canvas.className = 'three-stage';
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '同一影偶的空间戏台示意，可切换幕前与幕后观察');
  let renderer: THREE.WebGLRenderer | null = null;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-2, 2, 1.5, -1.5, .01, 30);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const actorObjects = new Map<string, ActorObjects>(), actorTextures = new Set<THREE.Texture>(), actorScratch = new Set<HTMLCanvasElement>();
  const sceneObjects=new THREE.Group();
  const stageObjects = new THREE.Group(), actors = new THREE.Group(), wings: THREE.Group[] = [];
  const sourceScratch = document.createElement('canvas');
  let sourceContext: CanvasRenderingContext2D | null = null;
  let assets: TextureCache | null = null, compositor: PartCompositor | null = null;
  let disposed = false, lost = false, ready = false, view: StageView = 'workshop', currentScope = '', resourceGeneration = 0, frameGeneration = 0;
  const scenery=new Map<string,THREE.Mesh<THREE.PlaneGeometry,THREE.MeshLambertMaterial|THREE.MeshBasicMaterial>>();
  let focusActor='chenxiang',yaw=0,pitch=0,zoom=1;
  let warm:THREE.PointLight;
  let latest: CanvasFrame | null = null, pending: Promise<void> | null = null, sourceTexture: THREE.CanvasTexture;
  let curtain: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>, lamp: THREE.Group;
  let currentHeight = stageCamera(view).height;
  const dpr = Number.isFinite(options.pixelRatio) ? Math.max(.25, Math.min(1.5, options.pixelRatio)) : 1;
  const maxWidth = Number.isFinite(options.maxWidth) ? Math.max(1, Math.min(1024, options.maxWidth)) : 512;
  const textureLimit = Number.isFinite(options.textureSize) ? Math.max(1, Math.min(1024, options.textureSize)) : 512;
  let renderDpr=dpr,renderMaxWidth=maxWidth,softwareBudget=false;

  function status(state: SpatialStatus['state'], message: string) {
    if (disposed) return; canvas.setAttribute('data-state', state); onStatus({ state, message });
  }
  // Diffuse vertex lighting suits matte wood/leather and avoids costly per-pixel PBR on software GPUs.
  function material(color: string) { const value = softwareBudget?new THREE.MeshBasicMaterial({color}):new THREE.MeshLambertMaterial({ color }); materials.add(value); return value; }
  function bakedFaces(geometry:THREE.BufferGeometry){const normals=geometry.getAttribute('normal'),colors=new Float32Array(normals.count*3);for(let i=0;i<normals.count;i++){const light=.62+.38*Math.max(0,-.3*normals.getX(i)+.8*normals.getY(i)+.7*normals.getZ(i));colors[i*3]=light;colors[i*3+1]=light*.96;colors[i*3+2]=light*.88;}geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));}
  function box(parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], color: string) {
    const geometry = new THREE.BoxGeometry(...size); geometries.add(geometry);
    const value=material(color);if(softwareBudget&&value instanceof THREE.MeshBasicMaterial){bakedFaces(geometry);value.vertexColors=true;}
    const mesh = new THREE.Mesh(geometry, value); mesh.position.set(...position); parent.add(mesh); return mesh;
  }
  function batchArchitecture(parent:THREE.Object3D){
    for(const child of [...parent.children])if(child instanceof THREE.Group)batchArchitecture(child);
    const groups=new Map<string,THREE.Mesh<THREE.BoxGeometry,THREE.MeshLambertMaterial|THREE.MeshBasicMaterial>[]>();
    for(const child of parent.children)if(child instanceof THREE.Mesh&&child.geometry instanceof THREE.BoxGeometry&&(child.material instanceof THREE.MeshLambertMaterial||child.material instanceof THREE.MeshBasicMaterial)){const key=child.material.color.getHexString();const group=groups.get(key)??[];group.push(child);groups.set(key,group);}
    for(const [color,meshes]of groups){if(meshes.length<2)continue;const inputs=meshes.map(mesh=>{mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);}),merged=mergeGeometries(inputs);for(const geometry of inputs)geometry.dispose();if(!merged)throw new Error('空间木台合批失败。');for(const mesh of meshes)releaseObject(mesh);geometries.add(merged);const value=material('#'+color);if(value instanceof THREE.MeshBasicMaterial)value.vertexColors=true;parent.add(new THREE.Mesh(merged,value));}
  }
  function releaseObject(object: THREE.Object3D) {
    object.traverse(child => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose(); geometries.delete(child.geometry);
        const list = Array.isArray(child.material) ? child.material : [child.material];
        for (const item of list) { item.dispose(); materials.delete(item); }
      }
    });
    object.removeFromParent();
  }
  function clearActors() {
    for (const item of actorObjects.values()) releaseObject(item.group);
    actorObjects.clear();
    for(const mesh of scenery.values())releaseObject(mesh);scenery.clear();
    for (const texture of actorTextures) { texture.dispose(); textures.delete(texture); }
    actorTextures.clear();
    for (const scratch of actorScratch) scratch.width = scratch.height = 0;
    actorScratch.clear();
    compositor?.dispose(); assets?.dispose(); compositor = null; assets = null;
  }
  function textureFor(image: HTMLCanvasElement | HTMLImageElement) {
    const imageWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    const imageHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
    const size = boundedTextureSize(imageWidth, imageHeight, textureLimit);
    let target: HTMLCanvasElement | HTMLImageElement = image;
    if (size.width !== imageWidth || size.height !== imageHeight) {
      const scratch = document.createElement('canvas'); scratch.width = size.width; scratch.height = size.height;
      actorScratch.add(scratch); const context = scratch.getContext('2d');
      if (!context) throw new Error('无法准备空间展示纹理，二维幕面仍可使用。');
      context.drawImage(image, 0, 0, size.width, size.height); target = scratch;
    }
    const texture = new THREE.Texture(target); texture.needsUpdate = true; texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
    textures.add(texture); actorTextures.add(texture); return texture;
  }
  function plane(image: HTMLCanvasElement | HTMLImageElement, bounds: Bounds, order: number) {
    const geometry = new THREE.PlaneGeometry(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    geometry.translate((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, 0); geometries.add(geometry);
    const value = new THREE.MeshBasicMaterial({ map: textureFor(image), transparent: true, alphaTest: .01, side: THREE.DoubleSide, depthWrite: false });
    materials.add(value); const mesh = new THREE.Mesh(geometry, value); mesh.renderOrder = 10 + order; return mesh;
  }
  function createActors(frame: CanvasFrame) {
    for (const actor of frame.actors) {
      const template = assetCatalog.puppets.find(item => item.id === actor.templateId)!;
      const item: ActorObjects = { group: new THREE.Group(), parts: [], rods: [], joints: [] }; actors.add(item.group); actorObjects.set(actor.actorId, item);
      for (const part of template.parts) {
        const mesh = plane(compositor!.part(actor, template, part), part.bounds, part.drawOrder);
        item.group.add(mesh); item.parts.push({ mesh, partId: part.partId, attachment: false });
      }
      for (const attachment of template.attachments) if (frame.attachments!.some(item => item.actorId === actor.actorId && item.attachmentId === attachment.id)) {
        const mesh = plane(assets!.get(attachment.assetId), attachment.bounds, attachment.drawOrder);
        item.group.add(mesh); item.parts.push({ mesh, partId: attachment.id, attachment: true });
      }
      for (const rod of template.rods) {
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); geometries.add(geometry);
        const value = new THREE.LineBasicMaterial({ color: '#a68153', transparent: true, opacity: .95, depthTest: false }); materials.add(value);
        const line = new THREE.Line(geometry, value); line.renderOrder = 120; item.group.add(line); item.rods.push({ line, rodId: rod.id });
      }
      for (const joint of template.joints.filter(item => item.enabled)) {
        const geometry = new THREE.CircleGeometry(.008, 12); geometries.add(geometry);
        const value = new THREE.MeshBasicMaterial({ color: '#f3bd65', side: THREE.DoubleSide, depthTest: false }); materials.add(value);
        const mesh = new THREE.Mesh(geometry, value); mesh.renderOrder = 130; item.group.add(mesh); item.joints.push({ mesh, jointId: joint.jointId });
      }
    }
  }
  function createScenery(frame:CanvasFrame){
    const scene=assetCatalog.scenes.scenes.find(s=>s.id===frame.stage.backgroundId)!;
    for(const [index,layer]of scene.layers.entries()){
      const geometry=new THREE.PlaneGeometry(2,1.5);geometries.add(geometry);
      const tex=textureFor(assets!.get(layer.assetId));
      const shared={map:tex,transparent:true,alphaTest:.01,depthWrite:false,side:THREE.DoubleSide};
      const material=softwareBudget?new THREE.MeshBasicMaterial(shared):new THREE.MeshLambertMaterial({...shared,emissive:'#ffffff',emissiveMap:tex,emissiveIntensity:.38});materials.add(material);
      const mesh=new THREE.Mesh(geometry,material);mesh.userData.depth=-.78+index*.09;mesh.renderOrder=1+index;sceneObjects.add(mesh);scenery.set(layer.id,mesh);
    }
  }
  function observe(nextYaw:number,nextPitch:number,nextZoom:number,actorId=focusActor){
    yaw=Math.max(-.65,Math.min(.65,nextYaw));pitch=Math.max(-.25,Math.min(.4,nextPitch));zoom=Math.max(.7,Math.min(1.8,nextZoom));focusActor=actorId;canvas.setAttribute('data-observation',JSON.stringify([yaw,pitch,zoom]));render();
  }
  function positionActors(frame: CanvasFrame) {
    const definition=assetCatalog.scenes.scenes.find(s=>s.id===frame.stage.backgroundId)!;
    for(const layer of definition.layers){const mesh=scenery.get(layer.id);if(!mesh)continue;const current=frame.sceneLayers?.find(l=>l.id===layer.id)??layer;mesh.position.set(current.x,current.y,mesh.userData.depth as number);mesh.material.opacity=current.opacity;mesh.visible=view==='story'||view==='character';if(softwareBudget){const level=.15+.85*(frame.spatial?.light??1);mesh.material.color.setRGB(level,level*.97,level*.92);}}
    const cue=frame.spatial;warm.intensity=10*(cue?.light??1);warm.position.x=frame.stage.lampX;curtain.material.color.setScalar(.15+.85*(cue?.light??1));
    if(view==='story'||view==='character'){const actor=frame.actors.find(a=>a.actorId===focusActor)??frame.actors[0],root=actor?localToWorld({x:0,y:0},actor.pose):{x:0,y:0};
      const near=view==='character',p=cue?.progress??0,back=cue?.backstage&&!near;currentHeight=(near?1.2:2.25)/zoom;
      const angle=(back?Math.PI+.3:.22)+yaw+(cue?.reducedMotion?0:Math.sin(p*Math.PI)*.12);
      const targetX=near?root.x:0,targetY=near?root.y+.12:-.05;camera.position.set(targetX+Math.sin(angle)*3.4,.35+pitch*2,Math.cos(angle)*3.4);camera.lookAt(targetX,targetY,-.35);
    }else{const preset=stageCamera(view),[tx,ty,tz]=preset.target,x=preset.position[0]-tx,z=preset.position[2]-tz;currentHeight=preset.height/zoom;camera.position.set(tx+x*Math.cos(yaw)+z*Math.sin(yaw),preset.position[1]+pitch*2,tz+z*Math.cos(yaw)-x*Math.sin(yaw));camera.lookAt(tx,ty,tz);}
    const aspect=canvas.width/Math.max(1,canvas.height);camera.left=-currentHeight*aspect/2;camera.right=-camera.left;camera.top=currentHeight/2;camera.bottom=-camera.top;camera.updateProjectionMatrix();
    canvas.setAttribute('data-spatial-node',cue?.nodeId??'observation');canvas.setAttribute('data-spatial-progress',String(cue?.progress??0));canvas.setAttribute('data-focus-actor',focusActor);
    for (const actor of frame.actors) {
      const item = actorObjects.get(actor.actorId)!, template = assetCatalog.puppets.find(item => item.id === actor.templateId)!;
      const root = localToWorld({ x: 0, y: 0 }, actor.pose);
      item.group.position.set(root.x, root.y, -frame.stage.puppetDistance);
      item.group.scale.set(actor.pose.scale * actor.pose.facing, actor.pose.scale, 1);
      const opacity = frame.actorOpacity?.[actor.actorId] ?? 1;
      for (const entry of item.parts) {
        const part = entry.attachment ? template.attachments.find(part => part.id === entry.partId)! : template.parts.find(part => part.partId === entry.partId)!;
        const transform = entry.attachment ? attachmentTransform(template, actor.pose, part as PuppetTemplate['attachments'][number]) : partTransform(template, actor.pose, part as PuppetTemplate['parts'][number]);
        entry.mesh.position.set(transform.x, transform.y, part.drawOrder * .00005); entry.mesh.rotation.z = transform.angle; entry.mesh.material.opacity = opacity;entry.mesh.material.color.setScalar(.15+.85*(cue?.light??1));
      }
      for (const entry of item.rods) {
        const point = rodPoint(template, actor.pose, entry.rodId), attribute = entry.line.geometry.getAttribute('position');
        attribute.setXYZ(0, point.x, point.y, -.007); attribute.setXYZ(1, point.x - .025, -.85 / actor.pose.scale, -.08);
        attribute.needsUpdate = true; entry.line.geometry.computeBoundingSphere(); entry.line.material.opacity = opacity;
      }
      for (const entry of item.joints) { const point = jointTransform(template, actor.pose, entry.jointId); entry.mesh.position.set(point.x, point.y, .01); entry.mesh.material.visible = opacity > 0; }
    }
    lamp.position.x = frame.stage.lampX;
    canvas.setAttribute('data-actors', frame.actors.map(actor => actor.actorId).join(','));
    canvas.setAttribute('data-lamp-x', String(frame.stage.lampX)); canvas.setAttribute('data-puppet-distance', String(frame.stage.puppetDistance));
  }
  function copySource() {
    if (!source.width || !source.height) throw new Error('二维幕面尚未就绪，空间展示未绘制。');
    const size = boundedTextureSize(source.width, source.height, textureLimit);
    if (sourceScratch.width !== size.width || sourceScratch.height !== size.height) { sourceScratch.width = size.width; sourceScratch.height = size.height; }
    sourceContext!.clearRect(0, 0, size.width, size.height); sourceContext!.drawImage(source, 0, 0, size.width, size.height); sourceTexture.needsUpdate = true;
    canvas.setAttribute('data-texture-width', String(size.width)); canvas.setAttribute('data-texture-height', String(size.height));
  }
  function render() {
    if (disposed || lost || !ready || !latest || !renderer) return;
    try {
      copySource(); positionActors(latest); renderer.render(scene, camera);
      canvas.setAttribute('data-geometries', String(renderer.info.memory.geometries)); canvas.setAttribute('data-textures', String(renderer.info.memory.textures));
      canvas.setAttribute('data-draw-calls',String(renderer.info.render.calls));canvas.setAttribute('data-scenery-layers',String(scenery.size));
      canvas.setAttribute('data-source-draws', source.getAttribute('data-draws') ?? '');
      status('ready', '同一成影的空间示意已就绪；切换观察不会改变作品。'+(softwareBudget?' 当前设备采用轻量空间绘制，二维幕面保持原画质。':''));
    }
    catch (error) { ready = false; status('error', error instanceof Error ? error.message : String(error)); }
  }
  function resize() {
    if (disposed || lost || !renderer) return;
    const box = host.getBoundingClientRect(), cssWidth = Math.max(1, host.clientWidth || box.width || 640);
    const width = Math.max(1, Math.min(renderMaxWidth / renderDpr, cssWidth)), height = width * .75;
    renderer.setPixelRatio(renderDpr); renderer.setSize(width, height, false);
    camera.left = -currentHeight * (width / height) / 2; camera.right = -camera.left; camera.top = currentHeight / 2; camera.bottom = -camera.top;
    camera.updateProjectionMatrix(); canvas.setAttribute('data-pixel-ratio', String(renderDpr)); canvas.setAttribute('data-buffer-width', String(canvas.width)); render();
  }
  function setView(next: StageView) {
    if (disposed || lost) return;
    view = next; const preset = stageCamera(view); currentHeight = preset.height;
    camera.position.set(...preset.position); camera.up.set(0, 1, 0); camera.lookAt(...preset.target);
    curtain.material.opacity = view === 'front' ? 1 : view==='story'||view==='character' ? .06 : .24;
    actors.visible = view !== 'front'; lamp.visible = view !== 'front';
    for (let index = 0; index < wings.length; index++) { wings[index]!.rotation.y = view === 'exhibit' ? (index ? -1 : 1) * .75 : 0; }
    canvas.setAttribute('data-view', view); resize();
  }
  const onResize = () => resize();
  const onLost = (event: Event) => { event.preventDefault(); lost = true; ready = false; resourceGeneration++; frameGeneration++; status('lost', '空间画面连接已中断，二维幕面仍可继续；可重新展开重试。'); };
  function dispose() {
    if (disposed) return; disposed = true; resourceGeneration++; frameGeneration++; latest = null; pending = null;
    window.removeEventListener('resize', onResize); canvas.removeEventListener('webglcontextlost', onLost);
    clearActors();
    for (const texture of textures) texture.dispose(); textures.clear();
    for (const geometry of geometries) geometry.dispose(); geometries.clear();
    for (const value of materials) value.dispose(); materials.clear();
    scene.clear(); renderer?.renderLists.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); renderer = null;
    sourceScratch.width = sourceScratch.height = 0; sourceContext = null; canvas.width = canvas.height = 0; canvas.remove();
  }
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    if(debug&&/SwiftShader|llvmpipe|software/i.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)))){softwareBudget=true;renderDpr=Math.min(1,dpr);renderMaxWidth=Math.min(512,maxWidth);}
    canvas.setAttribute('data-software-budget',String(softwareBudget));
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor('#17130f', 1);
    sourceContext = sourceScratch.getContext('2d'); if (!sourceContext) throw new Error('无法准备空间幕面，二维展示仍可使用。');
    sourceTexture = new THREE.CanvasTexture(sourceScratch); sourceTexture.colorSpace = THREE.SRGBColorSpace;
    sourceTexture.minFilter = sourceTexture.magFilter = THREE.LinearFilter; sourceTexture.generateMipmaps = false; textures.add(sourceTexture);
    scene.add(stageObjects, actors,sceneObjects);
    scene.add(new THREE.HemisphereLight('#b8d2ed','#61402b',2));
    const rim=new THREE.DirectionalLight('#9bb6df',2);rim.position.set(-2,3,2);scene.add(rim);
    warm=new THREE.PointLight('#ffd294',10,8,2);warm.position.set(0,.45,-1.2);scene.add(warm);
    // Repeated joinery and brass trim make the existing stage read as a built object.
    for(let i=0;i<9;i++)box(stageObjects,[.27,.018,1.55],[-1.08+i*.27,-.765,-.52],i%2?'#805b3d':'#94704b');
    for(const x of [-1.12,1.12])for(const y of [-.72,.7])box(stageObjects,[.12,.04,.17],[x,y,.04],'#c19b59');
    for(let i=0;i<11;i++)box(stageObjects,[.12,.035,.035],[-1+i*.2,.755,.09],'#c29b5b');
    // Fine deterministic threads retain the quiet linen surface without a new media download.
    const cloth=document.createElement('canvas');cloth.width=cloth.height=128;const c=cloth.getContext('2d')!;c.fillStyle='#d7c7a2';c.fillRect(0,0,128,128);for(let i=0;i<128;i+=4){c.fillStyle=i%8?'#c4b58f':'#e0d2b4';c.fillRect(i,0,1,128);c.fillRect(0,i,128,1);}const textile=new THREE.CanvasTexture(cloth);textile.colorSpace=THREE.SRGBColorSpace;textile.wrapS=textile.wrapT=THREE.RepeatWrapping;textile.repeat.set(5,4);textures.add(textile);
    const clothGeometry=new THREE.PlaneGeometry(2.04,1.54);geometries.add(clothGeometry);const clothMaterial=new THREE.MeshBasicMaterial({map:textile,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false});materials.add(clothMaterial);const linen=new THREE.Mesh(clothGeometry,clothMaterial);linen.position.z=-.015;stageObjects.add(linen);
    box(stageObjects, [2.55, .12, 1.65], [0, -.84, -.52], '#71442c');
    box(stageObjects, [2.42, .08, .13], [0, .82, .01], '#9a6236');
    for (const x of [-1.12, 1.12]) box(stageObjects, [.09, 1.66, .13], [x, -.01, .01], '#8c5432');
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(); wing.position.set(side * 1.16, -.01, -.02); stageObjects.add(wing); wings.push(wing);
      box(wing, [.24, 1.6, .065], [side * .12, 0, 0], '#582c24');
      box(wing, [.025, 1.5, .075], [side * .12, 0, .01], '#bd9251');
    }
    const geometry = new THREE.PlaneGeometry(2, 1.5); geometries.add(geometry);
    const value = new THREE.MeshBasicMaterial({ map: sourceTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false }); materials.add(value);
    curtain = new THREE.Mesh(geometry, value); curtain.renderOrder = 200; curtain.position.z = .002; stageObjects.add(curtain);
    lamp = new THREE.Group(); lamp.position.set(0, .0, -LAMP_DEPTH); stageObjects.add(lamp);
    box(lamp, [.045, .66, .045], [0, -.47, 0], '#af864d');
    const bulbGeometry = new THREE.SphereGeometry(.075, 12, 8); geometries.add(bulbGeometry);
    const bulb = new THREE.Mesh(bulbGeometry, material('#ffd68d')); lamp.add(bulb);
    box(lamp, [.22, .03, .16], [0, -.78, 0], '#b18a56');
    batchArchitecture(stageObjects);
    host.appendChild(canvas); window.addEventListener('resize', onResize); canvas.addEventListener('webglcontextlost', onLost);
    setView('workshop'); status('loading', '正在准备同一影偶的空间示意…');
  } catch (error) { dispose(); throw error; }

  async function update(input: CanvasFrame) {
    if (disposed || lost) return;
    const token = ++frameGeneration;
    try {
      const frame = prepareFrame(input, assetCatalog), scope = spatialResourceScope(frame); latest = frame;
      if (scope !== currentScope || !pending && !ready) {
        currentScope = scope; ready = false; const resourceToken = ++resourceGeneration;
        clearActors(); assets = new TextureCache(assetCatalog.manifest); compositor = new PartCompositor(assets, assetCatalog);
        const loadingAssets = assets; status('loading', '正在准备同一影偶的空间分件…');
        pending = (async () => {
          await loadingAssets.load(requiredAssets(frame, assetCatalog));
          if (disposed || lost || resourceToken !== resourceGeneration) return;
          createActors(latest!);createScenery(latest!); ready = true;
        })();
      }
      const work = pending; await work;
      if (disposed || lost || token !== frameGeneration) return;
      if (pending === work) pending = null;
      render();
    } catch (error) {
      if (!disposed && !lost && token === frameGeneration) { ready = false; pending = null; clearActors(); status('error', error instanceof Error ? error.message : String(error)); }
    }
  }
  return { canvas, update, setView, observe, resize, dispose };
}
