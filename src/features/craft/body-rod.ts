import { assetCatalog } from '../../content/catalog';
import { fitViewport, viewportToWorld, worldToViewport } from '../../domain/projection';
import type { Point } from '../../domain/projection';
import { moveRodBy, moveRodTo, rodScreenPoint } from '../../domain/rod-input';
import type { Pose, StageConfig } from '../../domain/types';
import type { canvasStage } from '../shared/canvas-stage';
import { element, scope } from '../shared/dom';

type Model = { pose: Pose; stage: StageConfig };
type Drag = { id: number; kind: 'pointer' | 'mouse' | 'touch'; offset: Point };
const template = assetCatalog.puppets.find(item => item.id === 'chenxiang-v1')!;
const directions: Record<string, Point> = {
  ArrowLeft: { x: -.025, y: 0 }, ArrowRight: { x: .025, y: 0 },
  ArrowUp: { x: 0, y: .025 }, ArrowDown: { x: 0, y: -.025 },
};
const oldKeys: Record<string, string> = { Left: 'ArrowLeft', Right: 'ArrowRight', Up: 'ArrowUp', Down: 'ArrowDown' };
const copyPose = (pose: Pose): Pose => ({ ...pose, joints: { ...pose.joints } });

/** A temporary craft-preview input. The caller owns the pose, readiness and all persistence. */
export function mountCraftBodyRod(stage: ReturnType<typeof canvasStage>, onMove: (pose: Pose) => void) {
  const life = scope(), touchCleanups: (() => void)[] = [];
  const overlay = element('div', 'rod-overlay');
  overlay.hidden = true;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'rod-lines'); svg.setAttribute('aria-hidden', 'true');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); svg.appendChild(line);
  const handle = element('button', 'rod-handle', '身');
  handle.type = 'button'; handle.disabled = true;
  handle.setAttribute('data-craft-rod', 'body');
  handle.setAttribute('aria-label', '试提身杆，方向键移动');
  overlay.appendChild(svg); overlay.appendChild(handle); stage.screen.appendChild(overlay);
  const status = element('p', 'quiet-note', '身杆已就位。');
  status.setAttribute('role', 'status'); stage.figure.appendChild(status);
  let model: Model | null = null, enabled = false, disposed = false, drag: Drag | null = null;

  function canMove() { return !disposed && enabled && model !== null; }
  function report(message: string) { if (!disposed && status.textContent !== message) status.textContent = message; }
  function release() {
    const previous = drag; drag = null;
    if (previous?.kind !== 'pointer') return;
    try { if (handle.hasPointerCapture?.(previous.id)) handle.releasePointerCapture(previous.id); }
    catch (error) { report(`身杆拖动已结束：${error instanceof Error ? error.message : String(error)}`); }
  }
  function render() {
    if (disposed) return;
    handle.disabled = !canMove(); overlay.hidden = !canMove();
    if (!canMove()) return;
    try {
      const rect = stage.canvas.getBoundingClientRect(), viewport = fitViewport(rect.width, rect.height);
      const point = worldToViewport(rodScreenPoint(template, model!.pose, model!.stage, 'body'), viewport);
      if (viewport.scale <= 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        overlay.hidden = true; handle.disabled = true; release(); return;
      }
      // The enlarged grip stays inside the curtain; its offset from the joint survives grabbing.
      const minX = viewport.x + Math.min(24, viewport.width / 2), maxX = viewport.x + viewport.width - Math.min(24, viewport.width / 2);
      const minY = viewport.y + Math.min(24, viewport.height / 2), maxY = viewport.y + viewport.height - Math.min(24, viewport.height / 2);
      const x = Math.max(minX, Math.min(maxX, point.x)), y = Math.max(minY, Math.min(maxY, point.y + .22 * viewport.height));
      svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
      line.setAttribute('x1', String(point.x)); line.setAttribute('y1', String(point.y));
      line.setAttribute('x2', String(x)); line.setAttribute('y2', String(y));
      handle.style.left = `${x}px`; handle.style.top = `${y}px`;
      handle.setAttribute('aria-pressed', String(Boolean(drag)));
    } catch (error) {
      overlay.hidden = true; handle.disabled = true; release();
      report(`身杆预览暂不可用：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  function screenPoint(clientX: number, clientY: number): Point | null {
    const rect = stage.canvas.getBoundingClientRect();
    return viewportToWorld({ x: clientX - rect.left, y: clientY - rect.top }, fitViewport(rect.width, rect.height));
  }
  function accept(fit: ReturnType<typeof moveRodTo>, target?: Point) {
    if (!canMove()) return;
    if (!fit.fits) { report('这个姿态无法完整放进幕面，请调整灯位或减小影偶。'); return; }
    const actual = rodScreenPoint(template, fit.pose, model!.stage, 'body');
    const limited = target && Math.hypot(actual.x - target.x, actual.y - target.y) > .0001;
    if (JSON.stringify(fit.pose) === JSON.stringify(model!.pose)) {
      report(limited ? '身杆已到幕面边界，请换个方向试提。' : '身杆位置保持不变。'); return;
    }
    report(limited ? '已按幕面边界限制试提位置。' : '身杆试提位置已调整。');
    // The callback may synchronously update, disable or dispose this input. Do not mutate after it.
    try { onMove(copyPose(fit.pose)); }
    catch (error) { release(); render(); report(`身杆试提未能完成：${error instanceof Error ? error.message : String(error)}`); }
  }
  function start(id: number, kind: Drag['kind'], clientX: number, clientY: number) {
    if (!canMove() || drag) return false;
    const point = screenPoint(clientX, clientY); if (!point) return false;
    const connection = rodScreenPoint(template, model!.pose, model!.stage, 'body');
    drag = { id, kind, offset: { x: point.x - connection.x, y: point.y - connection.y } };
    report('正在试提身杆。'); render(); return true;
  }
  function move(clientX: number, clientY: number) {
    if (!drag || !canMove()) return;
    const point = screenPoint(clientX, clientY);
    if (!point) { report('拖动目标超出幕面，请回到幕内。'); return; }
    const target = { x: point.x - drag.offset.x, y: point.y - drag.offset.y };
    try { accept(moveRodTo(template, model!.pose, model!.stage, 'body', target), target); }
    catch (error) { release(); render(); report(`身杆试提未能完成：${error instanceof Error ? error.message : String(error)}`); }
  }
  function end() { if (drag) { release(); render(); report('已放开身杆。'); } }

  if ('PointerEvent' in window && window.PointerEvent) {
    life.on(handle, 'pointerdown', event => {
      const e = event as PointerEvent;
      if (e.button !== 0 || e.isPrimary === false || !start(e.pointerId, 'pointer', e.clientX, e.clientY)) return;
      e.preventDefault(); handle.focus();
      try { handle.setPointerCapture?.(e.pointerId); }
      catch (error) { report(`使用页面范围跟踪试提：${error instanceof Error ? error.message : String(error)}`); }
    });
    life.on(window, 'pointermove', event => {
      const e = event as PointerEvent;
      if (drag?.kind === 'pointer' && drag.id === e.pointerId) { e.preventDefault(); move(e.clientX, e.clientY); }
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) life.on(name === 'lostpointercapture' ? handle : window, name, event => {
      if (drag?.kind === 'pointer' && drag.id === (event as PointerEvent).pointerId) end();
    });
  } else {
    life.on(handle, 'mousedown', event => {
      const e = event as MouseEvent;
      if (e.button === 0 && start(0, 'mouse', e.clientX, e.clientY)) { e.preventDefault(); handle.focus(); }
    });
    life.on(window, 'mousemove', event => { const e = event as MouseEvent; if (drag?.kind === 'mouse') move(e.clientX, e.clientY); });
    life.on(window, 'mouseup', () => { if (drag?.kind === 'mouse') end(); });
    const touchStart = (event: Event) => {
      const e = event as TouchEvent, touch = e.changedTouches[0];
      if (touch && start(touch.identifier, 'touch', touch.clientX, touch.clientY)) e.preventDefault();
    };
    const touchMove = (event: Event) => {
      const e = event as TouchEvent; if (drag?.kind !== 'touch') return;
      const id = drag.id;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i]!;
        if (touch.identifier === id) { e.preventDefault(); move(touch.clientX, touch.clientY); break; }
      }
    };
    const touchEnd = (event: Event) => {
      const e = event as TouchEvent; if (drag?.kind !== 'touch') return;
      const id = drag.id;
      for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i]!.identifier === id) { end(); break; }
    };
    handle.addEventListener('touchstart', touchStart, { passive: false });
    window.addEventListener('touchmove', touchMove, { passive: false });
    window.addEventListener('touchend', touchEnd); window.addEventListener('touchcancel', touchEnd);
    touchCleanups.push(() => {
      handle.removeEventListener('touchstart', touchStart, { capture: false });
      window.removeEventListener('touchmove', touchMove, { capture: false });
      window.removeEventListener('touchend', touchEnd); window.removeEventListener('touchcancel', touchEnd);
    });
  }
  life.on(handle, 'keydown', event => {
    const e = event as KeyboardEvent, direction = directions[oldKeys[e.key] ?? e.key];
    if (!direction || !canMove()) return;
    e.preventDefault(); release(); render();
    try {
      const target = rodScreenPoint(template, model!.pose, model!.stage, 'body');
      accept(moveRodBy(template, model!.pose, model!.stage, 'body', direction), { x: target.x + direction.x, y: target.y + direction.y });
    } catch (error) { report(`身杆试提未能完成：${error instanceof Error ? error.message : String(error)}`); }
  });
  life.on(handle, 'blur', end); life.on(window, 'blur', end);
  life.on(document, 'visibilitychange', () => { if (document.hidden) end(); });
  life.on(window, 'resize', render);

  return {
    update(next: Model | null, editable: boolean) {
      if (disposed) return;
      if (!next || !editable || (model && JSON.stringify(model.stage) !== JSON.stringify(next.stage))) release();
      model = next ? { pose: copyPose(next.pose), stage: { ...next.stage } } : null;
      enabled = editable; render();
    },
    dispose() {
      if (disposed) return;
      release(); disposed = true; model = null; enabled = false;
      life.dispose(); touchCleanups.forEach(cleanup => cleanup());
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (status.parentNode) status.parentNode.removeChild(status);
    },
  };
}
