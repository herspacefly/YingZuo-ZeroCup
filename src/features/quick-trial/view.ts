import type { StageAudioSession } from '../../audio/stage-session';
import { createAnimationClock } from '../../app/animation-clock';
import { assetCatalog } from '../../content/catalog';
import type { Pose } from '../../domain/types';
import { constrainPoseToStage } from '../../domain/pose';
import { minimumLampDepth, projectionParameters, fitViewport, worldToViewport } from '../../domain/projection';
import type { CanvasFrame } from '../../renderers/canvas/types';
import { createNodeInteraction } from '../../story/node-interaction';
import { normalizedTargetBounds } from '../../story/interactions';
import { canvasStage } from '../shared/canvas-stage';
import { append, element, scope, removeNode } from '../shared/dom';
import { mountLimbControls } from '../shared/limb-controls';
import { mountVoiceControls } from '../shared/voice-controls';
import { createTrialScenes, createTrialTimeline, trialAdvanceBeforeVoiceTail, TRIAL_DURATION_MS, TRIAL_SEGMENTS } from './model';

export interface QuickTrialOptions {
  audio?: StageAudioSession;
  onClose(): void;
  onFullExperience(): void;
  onMuseum(): void;
}

/** Standalone rehearsal: no Store, editor command, durable action or real story input exists here. */
export function mountQuickTrial(host: HTMLElement, options: QuickTrialOptions) {
  const rollback: (() => void)[] = [];
  try { return buildQuickTrial(host, options, cleanup => rollback.push(cleanup)); }
  catch (error) {
    const cleanupErrors: unknown[] = [];
    for (const cleanup of rollback.reverse()) try { cleanup(); } catch (cleanupError) { cleanupErrors.push(cleanupError); }
    if (cleanupErrors.length) throw new Error(String(error) + '；试演清理报告：' + cleanupErrors.map(String).join('；'));
    throw error;
  }
}

function buildQuickTrial(host: HTMLElement, options: QuickTrialOptions, rollback: (cleanup: () => void) => void) {
  const life = scope(), root = element('section', 'quick-trial'); root.id = 'quick-trial';
  rollback(() => life.dispose()); rollback(() => removeNode(root)); rollback(() => options.audio?.setVoice(null));
  root.setAttribute('aria-labelledby', 'trial-title');
  const title = element('h2', '', '先借你一盏灯，一双手。'); title.id = 'trial-title'; title.tabIndex = -1;
  const note = element('p', 'quiet-note', '90秒自动编排，加载、亲手操作与暂停另计。这里只试演，不改你的作品，也不透露终章。');
  const heading = element('div', 'trial-heading'), close = element('button', 'button secondary', '关闭试演'); close.id = 'trial-close'; close.type = 'button';
  append(heading, title, close); append(root, heading, note);
  const timeline = createTrialTimeline(), scenes = createTrialScenes(), waveObserver = createNodeInteraction(scenes.wave.node);
  let disposed = false, blocked = false, ready = false, resourceError = false, playing = false, initialIntent = true, ended = false;
  let frame: CanvasFrame = scenes.sample(timeline.position(), false).frame, lampFrame = scenes.lampFrame(), pose: Pose | null = null;
  let manualMs = 0, operated = false, lampChanged = false, message = '幕面准备好后开始试演。', lastPhase = '', holdMs = 0, voiceTailMs = 0;
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)'); let reduced = media?.matches ?? false;
  const backstageOptions = { backstage: { beforeOpen() { pause('已暂停试演，看看灯、偶与幕的关系。'); }, onChange(open: boolean) { if (!open) { message = '已回到同一刻，点击继续试演。'; controls(); } } } };
  const stage = canvasStage('同一盏灯、同一副影偶；试演中的操作只留在这里。', backstageOptions);
  rollback(() => stage.dispose());
  const target = element('div', 'trial-wave-target'); target.setAttribute('aria-hidden', 'true'); stage.screen.appendChild(target);
  const panel = element('div', 'trial-panel'), layout = element('div', 'workspace trial-layout');
  const phase = element('p', 'trial-phase'), status = element('p', 'selection-summary'), cue = element('p', 'trial-subtitle'), budget = element('p', 'quiet-note'), progress = element('progress');
  phase.id = 'trial-phase'; phase.setAttribute('role', 'status'); status.id = 'trial-status'; status.setAttribute('role', 'status');
  cue.id = 'trial-subtitle'; cue.setAttribute('aria-label', '当前台词'); progress.max = TRIAL_DURATION_MS; progress.setAttribute('aria-label', '自动编排进度');
  const transport = element('div', 'trial-actions'), play = element('button', 'button primary', '继续试演'), pauseButton = element('button', 'button secondary', '暂停试演'), restart = element('button', 'button secondary', '从头试演');
  for (const [button, id] of [[play, 'play'], [pauseButton, 'pause'], [restart, 'restart']] as const) { button.id = 'trial-' + id; button.type = 'button'; transport.appendChild(button); }
  append(panel, phase, cue, status, progress, budget, transport);
  const lamp = element('fieldset', 'trial-lamp-controls'); lamp.id = 'trial-lamp-controls'; lamp.appendChild(element('legend', '', '请挪一挪灯，让影子回应'));
  const track = element('div', 'trial-lamp-track'), lampHandle = element('button', 'trial-lamp-handle', '灯'); lampHandle.id = 'trial-lamp-handle'; lampHandle.type = 'button'; lampHandle.setAttribute('aria-label', '左右拖动灯具'); track.appendChild(lampHandle);
  const lampX = element('input'), lampDepth = element('input');
  function range(label: string, input: HTMLInputElement, id: string, min: number, max: number, step: string) {
    const row = element('label', 'range-control', label); input.id = id; input.type = 'range'; input.min = String(min); input.max = String(max); input.step = step; input.setAttribute('aria-label', label); row.appendChild(input); return row;
  }
  append(lamp, element('p', 'quiet-note', '拖动金色灯点，或使用滑块与按钮。灯向左，影子向右；灯靠近影偶，影子变大。'), track, range('灯的左右位置', lampX, 'trial-lamp-x', -.8, .8, '.01'), range('灯离幕的距离', lampDepth, 'trial-lamp-depth', .6, 2.4, '.01'));
  const lampSteps = element('div', 'trial-actions');
  for (const [label, dx, dd] of [['灯向左', -.1, 0], ['灯向右', .1, 0], ['灯靠近影偶', 0, -.1], ['灯远离影偶', 0, .1]] as const) {
    const button = element('button', 'button secondary', label); button.type = 'button'; life.on(button, 'click', () => moveLamp(lampFrame.stage.lampX + dx, projectionParameters(lampFrame.stage).lampDepth + dd)); lampSteps.appendChild(button);
  }
  const lampDone = element('button', 'button primary', '灯影看清了，接过影偶'); lampDone.id = 'trial-lamp-done'; lampDone.type = 'button'; append(lamp, lampSteps, lampDone);
  const wave = element('fieldset', 'trial-wave-controls'); wave.id = 'trial-wave-controls'; wave.appendChild(element('legend', '', '抬起沉香的右手，向母亲招呼'));
  const shoulder = element('input'), elbow = element('input'), template = assetCatalog.puppets.find(item => item.id === 'chenxiang-v1')!;
  for (const [input, joint, label] of [[shoulder, 'rightShoulder', '右肩'], [elbow, 'rightElbow', '右肘']] as const) {
    const bounds = template.joints.find(item => item.jointId === joint)!;
    wave.appendChild(range(label, input, 'trial-' + joint, bounds.minRad, bounds.maxRad, '.01'));
    life.on(input, 'input', () => { if (!canOperate('wave')) return; const next = clonePose(frame.actors.find(actor => actor.actorId === 'chenxiang')!.pose); next.joints[joint] = Number(input.value); changePose(next); });
  }
  const hold = element('p', 'quiet-note'); hold.id = 'trial-wave-hold'; wave.appendChild(hold);
  const assist = element('button', 'button secondary', '请代演这一步'); assist.id = 'trial-assist'; assist.type = 'button';
  const finish = element('div', 'trial-finish'), full = element('button', 'button primary', '为沉香备行装，开始完整体验'), museum = element('button', 'button secondary', '去展馆看看幕后');
  full.id = 'trial-full-experience'; museum.id = 'trial-museum'; full.type = museum.type = 'button'; append(finish, element('p', '', '山还没有打开。后面的路，留给你的选择。'), full, museum);
  append(panel, lamp, wave, assist, finish); const voiceControls = mountVoiceControls(panel, options.audio, 'trial');
  rollback(() => voiceControls.dispose());
  append(layout, stage.figure, panel); root.appendChild(layout); host.appendChild(root);
  const clock = createAnimationClock({ request: cb => requestAnimationFrame(cb), cancel: id => cancelAnimationFrame(id), now: () => performance.now() }, delta => {
    if (!playing || blocked || !ready || disposed || observing()) return false;
    const before = timeline.position();
    if (before.waiting === 'wave') {
      manualMs += delta; direct.tick(delta);
      const result = waveObserver.observe(frame, manualMs, false, operated); holdMs = result.heldMs;
      if (result.evidence) { timeline.completeWait('wave'); pose = null; message = '这次招手，母亲看见了。'; direct.release(); }
    } else if (!before.waiting) {
      const safeDelta = trialAdvanceBeforeVoiceTail(before, delta, options.audio?.voice.getStatus().playing ?? false);
      if (safeDelta < delta) {
        voiceTailMs += delta - safeDelta;
        if (voiceTailMs > 3000) { pause('本句配音尚未结束，已保留这一刻。可重试或关闭配音后继续。'); return false; }
      } else voiceTailMs = 0;
      timeline.advance(safeDelta);
    }
    stage.cables.tick(delta); draw();
    if (timeline.position().ended) { playing = false; ended = true; syncVoice(); controls(); return false; }
    return playing;
  }, fault => pause(fault.reason === 'gap' ? '页面停顿较久，已暂停。点击继续试演。' : '试演已暂停：' + String(fault.error)), stage.frameObserver);
  rollback(() => clock.dispose());
  function observing() { return stage.isObserving(); }
  function clonePose(value: Pose): Pose { return { ...value, joints: { ...value.joints } }; }
  function canOperate(kind: 'lamp' | 'wave') { return !disposed && !blocked && ready && playing && !observing() && timeline.position().waiting === kind; }
  function changePose(value: Pose) {
    if (!canOperate('wave')) return;
    const fitted = constrainPoseToStage(value, template, frame.stage);
    if (!fitted.fits) return;
    pose = clonePose(fitted.pose); operated = true; draw();
  }
  const direct = mountLimbControls(stage, { read: () => ({ frame, enabled: canOperate('wave') }), change: changePose, wake() { if (playing && !blocked && ready) clock.start(); }, report(text) { message = text; controls(); } });
  rollback(() => direct.dispose());
  function syncVoice() {
    if (disposed) return;
    const p = timeline.position(), id = TRIAL_SEGMENTS[p.index]!.id;
    const selected = id === 'intro' ? scenes.intro : id === 'wave' ? scenes.wave : id === 'training' ? scenes.training : null;
    const audible = playing && ready && !blocked && !observing() && !p.waiting;
    options.audio?.setVoice(selected ? { token: 'trial:' + selected.node.id, elapsedMs: p.elapsedMs, playing: audible, cues: selected.voice } : null,
      selected ? { nodeId: selected.node.id, mode: 'guided', definitionVersion: 5, elapsedMs: p.elapsedMs, playing: audible } : null);
  }
  function controls() {
    if (disposed) return;
    const p = timeline.position(), segment = TRIAL_SEGMENTS[p.index]!, waiting = p.waiting;
    const state = blocked ? 'blocked' : resourceError ? 'error' : !ready ? 'loading' : ended ? 'completed' : !playing ? 'paused' : waiting ? 'waiting-' + waiting : 'playing';
    root.setAttribute('data-state', state); root.setAttribute('data-segment', segment.id); root.setAttribute('data-automatic-ms', String(p.automaticMs));
    const phaseText = (p.index + 1) + ' / 7 · ' + segment.title;
    if (phase.textContent !== phaseText) phase.textContent = phaseText;
    const help = waiting === 'lamp' ? '轮到你：挪动灯具，观察影子，再继续。' : waiting === 'wave' ? '轮到你：抬起右手，让手臂进入金色目标区域并稍停。也可以请代演。' : ended ? '试演到这里。正式演出中的选择，将由你自己决定。' : '';
    const statusText = resourceError ? message : !ready ? '正在准备影偶与幕面，请稍候。' : message || (voiceTailMs > 0 ? '等这一句配音自然说完，随后继续。' : help);
    if (status.textContent !== statusText) status.textContent = statusText;
    play.disabled = blocked || !ready || playing || ended || observing(); pauseButton.disabled = !playing; restart.disabled = blocked;
    play.textContent = waiting ? '继续操作' : '继续试演';
    lamp.hidden = waiting !== 'lamp'; wave.hidden = waiting !== 'wave'; assist.hidden = !waiting; finish.hidden = !(segment.id === 'invitation' || ended);
    lamp.disabled = !canOperate('lamp'); wave.disabled = !canOperate('wave'); assist.disabled = blocked || !ready || !playing || observing();
    lampDone.disabled = !canOperate('lamp') || !lampChanged;
    lampX.value = String(lampFrame.stage.lampX); lampDepth.value = String(projectionParameters(lampFrame.stage).lampDepth); lampHandle.style.left = ((lampFrame.stage.lampX + .8) / 1.6 * 100) + '%';
    progress.value = p.automaticMs; budget.textContent = '自动编排 ' + (p.automaticMs / 1000).toFixed(1) + ' / 90 秒 · 亲手操作与暂停另计';
    const actor = frame.actors.find(item => item.actorId === 'chenxiang');
    if (actor) { shoulder.value = String(actor.pose.joints.rightShoulder); elbow.value = String(actor.pose.joints.rightElbow); }
    hold.textContent = holdMs > 0 ? '已经稳住 ' + (holdMs / 1000).toFixed(1) + ' 秒。' : '拖动幕上的手部圆点；也可用右肩、右肘滑块调整。';
    full.disabled = museum.disabled = blocked;
    target.hidden = waiting !== 'wave' || observing();
    const completion = scenes.wave.node.completion;
    const bounds = 'target' in completion ? normalizedTargetBounds(completion.target) : null;
    if (bounds && !target.hidden) {
      const rect = stage.canvas.getBoundingClientRect(), screen = stage.screen.getBoundingClientRect(), viewport = fitViewport(rect.width, rect.height);
      const from = worldToViewport({ x: bounds.minX, y: bounds.maxY }, viewport), to = worldToViewport({ x: bounds.maxX, y: bounds.minY }, viewport);
      target.style.left = (rect.left - screen.left + from.x) + 'px'; target.style.top = (rect.top - screen.top + from.y) + 'px'; target.style.width = (to.x - from.x) + 'px'; target.style.height = (to.y - from.y) + 'px';
    }
  }
  function draw() {
    if (disposed) return;
    const p = timeline.position(), segment = TRIAL_SEGMENTS[p.index]!, sample = scenes.sample(p, reduced);
    if (lastPhase !== segment.id) { lastPhase = segment.id; pose = null; holdMs = 0; voiceTailMs = 0; operated = false; manualMs = 0; waveObserver.reset(); message = ''; }
    frame = segment.id === 'lamp' ? lampFrame : sample.frame;
    if (segment.id === 'lamp' && !p.waiting) {
      lampFrame = scenes.lampFrame(); lampFrame.stage.lampX = reduced ? 0 : .4 * Math.sin(p.elapsedMs / 12000 * Math.PI * 2); frame = lampFrame;
    }
    if (pose && p.waiting === 'wave') frame = { ...frame, showRods: true, actors: frame.actors.map(actor => actor.actorId === 'chenxiang' ? { ...actor, pose: clonePose(pose!) } : actor) };
    if (p.waiting === 'wave') frame = { ...frame, showRods: true };
    stage.update(frame); stage.screen.style.opacity = String(sample.light); direct.render();
    cue.textContent = sample.cues.map(line => (line.speaker === 'narrator' ? '旁白' : line.speaker === 'mother' ? '母亲' : '沉香') + '：' + line.text).join('\n');
    syncVoice(); controls();
  }
  function pause(text: string) {
    if (disposed) return;
    initialIntent = false; playing = false; clock.stop(); direct.release(); direct.render(); waveObserver.reset(); holdMs = 0; releaseLamp(); message = text; syncVoice(); controls();
  }
  function start() { if (disposed || blocked || !ready || ended || observing()) return; initialIntent = false; playing = true; voiceTailMs = 0; message = ''; options.audio?.unlock(); syncVoice(); controls(); clock.start(); }
  function moveLamp(x: number, depth: number) {
    if (!canOperate('lamp')) return;
    const next = { ...lampFrame.stage, lampX: Math.max(-.8, Math.min(.8, x)), lampGeometry: { version: 1 as const, depth: Math.max(minimumLampDepth(lampFrame.stage), Math.min(2.4, depth)) } };
    lampChanged ||= Math.abs(next.lampX - lampFrame.stage.lampX) > .001 || Math.abs(next.lampGeometry.depth - projectionParameters(lampFrame.stage).lampDepth) > .001;
    lampFrame = { ...lampFrame, stage: next }; message = '影子已经随灯移动。看清后，可以接过影偶。'; draw();
  }
  let lampDrag: number | null = null;
  function releaseLamp() { lampDrag = null; }
  function dragLamp(clientX: number) { const box = track.getBoundingClientRect(); if (box.width > 0) moveLamp((clientX - box.left) / box.width * 1.6 - .8, projectionParameters(lampFrame.stage).lampDepth); }
  if (window.PointerEvent) {
    life.on(lampHandle, 'pointerdown', event => { const e = event as PointerEvent; if (e.button !== 0 || !canOperate('lamp')) return; e.preventDefault(); lampDrag = e.pointerId; lampHandle.setPointerCapture?.(e.pointerId); });
    life.on(lampHandle, 'pointermove', event => { const e = event as PointerEvent; if (lampDrag === e.pointerId) { e.preventDefault(); dragLamp(e.clientX); } });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) life.on(lampHandle, name, releaseLamp);
  } else {
    life.on(lampHandle, 'mousedown', event => { if ((event as MouseEvent).button === 0 && canOperate('lamp')) { event.preventDefault(); lampDrag = 0; } });
    life.on(window, 'mousemove', event => { if (lampDrag === 0) dragLamp((event as MouseEvent).clientX); }); life.on(window, 'mouseup', releaseLamp);
  }
  life.on(lampX, 'input', () => moveLamp(Number(lampX.value), projectionParameters(lampFrame.stage).lampDepth));
  life.on(lampDepth, 'input', () => moveLamp(lampFrame.stage.lampX, Number(lampDepth.value)));
  life.on(lampHandle, 'keydown', event => { const e = event as KeyboardEvent; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); moveLamp(lampFrame.stage.lampX + (e.key === 'ArrowLeft' ? -.1 : .1), projectionParameters(lampFrame.stage).lampDepth); } });
  life.on(lampDone, 'click', () => { if (lampDone.disabled) return; timeline.completeWait('lamp'); message = ''; draw(); });
  life.on(assist, 'click', () => { const waiting = timeline.position().waiting; if (!waiting || assist.disabled) return; timeline.completeWait(waiting); message = '这一步由编排示范，正式演出仍由你决定。'; direct.release(); draw(); });
  life.on(play, 'click', start); life.on(pauseButton, 'click', () => pause('由你暂停。可以随时继续。'));
  life.on(restart, 'click', () => {
    pause('已回到试演开头，点击继续试演。'); stage.closeBackstage(); timeline.reset(); ended = false; lampFrame = scenes.lampFrame(); lampChanged = false; pose = null; lastPhase = ''; draw();
  });
  function leave(callback: () => void, closing = false) { if (disposed || blocked && !closing) return; pause(''); dispose(); callback(); }
  life.on(close, 'click', () => leave(options.onClose, true)); life.on(full, 'click', () => leave(options.onFullExperience)); life.on(museum, 'click', () => leave(options.onMuseum));
  life.on(root, 'keydown', event => { if ((event as KeyboardEvent).key === 'Escape') { event.preventDefault(); leave(options.onClose, true); } });
  life.on(window, 'blur', () => pause('窗口失去焦点，试演暂停。点击继续试演。'));
  life.on(document, 'visibilitychange', () => { if (document.hidden) pause('页面已隐藏，试演暂停。点击继续试演。'); });
  const changeMotion = () => { reduced = media?.matches ?? false; pause('动态偏好已改变，点击继续试演。'); draw(); };
  if (media?.addEventListener) media.addEventListener('change', changeMotion); else media?.addListener?.(changeMotion);
  rollback(() => { if (media?.removeEventListener) media.removeEventListener('change', changeMotion); else media?.removeListener?.(changeMotion); });
  const unsubscribe = stage.subscribe(value => {
    ready = value.state === 'ready'; resourceError = value.state === 'error';
    if (!ready) { if (!initialIntent || resourceError) pause(resourceError ? '幕面未能准备好，请重试幕面后继续：' + value.message : '正在准备下一段，幕面就绪后点击继续。'); else { playing = false; clock.stop(); syncVoice(); controls(); } }
    else if (initialIntent && !blocked && !document.hidden && document.hasFocus()) start(); else controls();
  });
  rollback(unsubscribe);
  life.on(window, 'resize', controls);
  function dispose() {
    if (disposed) return; disposed = true; playing = false; initialIntent = false; releaseLamp(); clock.dispose(); direct.dispose(); unsubscribe(); voiceControls.dispose(); options.audio?.setVoice(null); life.dispose();
    if (media?.removeEventListener) media.removeEventListener('change', changeMotion); else media?.removeListener?.(changeMotion);
    stage.dispose(); removeNode(root);
  }
  draw(); options.audio?.unlock(); title.focus({ preventScroll: true });
  return { dispose, setBlocked(value: boolean) { if (disposed) return; blocked = value; if (value) pause('请先处理当前作品操作，再继续试演。'); else controls(); } };
}
