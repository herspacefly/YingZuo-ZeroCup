import type { LightSample } from './storage';

export const DEFAULT_LIGHT: LightSample = { lampX: 50, distance: 30 };

export interface LightStudy {
  getSample(): LightSample;
  setSample(sample: LightSample): void;
  dispose(): void;
}

/** Disposable, event-driven T00 drawing; T04 will supply the actual actor renderer. */
export function mountLightStudy(onChange: () => void): LightStudy | null {
  const canvas = document.getElementById('shadow-canvas') as HTMLCanvasElement;
  const status = document.getElementById('canvas-status')!;
  let context: CanvasRenderingContext2D | null;
  try { context = canvas.getContext('2d'); }
  catch { context = null; }
  if (!context) {
    status.textContent = '此浏览器无法启动二维画布，故事介绍仍可阅读。';
    status.setAttribute('data-state', 'unavailable');
    return null;
  }
  const ctx = context;
  const lamp = document.getElementById('lamp-x') as HTMLInputElement;
  const distance = document.getElementById('puppet-distance') as HTMLInputElement;
  const lampValue = document.getElementById('lamp-value')!;
  const distanceValue = document.getElementById('distance-value')!;
  const reset = document.getElementById('reset-light')!;
  let disposed = false;
  const getSample = (): LightSample => ({ lampX: Number(lamp.value), distance: Number(distance.value) });

  function draw() {
    if (disposed) return;
    const sample = getSample();
    lampValue.textContent = String(sample.lampX);
    distanceValue.textContent = String(sample.distance);
    const width = Math.max(240, canvas.clientWidth || 960);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(width * 0.75 * dpr);
    ctx.setTransform(canvas.width / 960, 0, 0, canvas.height / 720, 0, 0);
    ctx.clearRect(0, 0, 960, 720);
    ctx.fillStyle = '#4b3021';
    ctx.fillRect(0, 0, 960, 720);
    ctx.fillStyle = '#d7bd89';
    ctx.fillRect(22, 22, 916, 676);
    const glow = ctx.createRadialGradient(480 + (sample.lampX - 50) * 3, 330, 20, 480, 360, 700);
    glow.addColorStop(0, '#fff3cf');
    glow.addColorStop(0.7, '#e8c98c');
    glow.addColorStop(1, '#b79763');
    ctx.fillStyle = glow;
    ctx.fillRect(38, 38, 884, 644);
    ctx.strokeStyle = 'rgba(77, 52, 32, .25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(53, 53, 854, 614);
    // Layered paper scenery, original placeholder geometry, not final cultural art.
    ctx.fillStyle = 'rgba(49, 76, 88, .12)';
    ctx.beginPath();
    ctx.moveTo(38, 580); ctx.lineTo(190, 460); ctx.lineTo(300, 540);
    ctx.lineTo(680, 490); ctx.lineTo(790, 370); ctx.lineTo(922, 520);
    ctx.lineTo(922, 682); ctx.lineTo(38, 682); ctx.closePath(); ctx.fill();
    const scale = 1 + sample.distance / 100;
    const offset = (50 - sample.lampX) * sample.distance / 30;
    ctx.save();
    ctx.translate(465 + offset, 415);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    // Visible rods and articulated joints, with no animation loop.
    ctx.lineWidth = 3; ctx.strokeStyle = '#85613d';
    for (const [x, y] of [[-5, 30], [-65, -20], [84, -95]] as const) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 18, 190); ctx.stroke();
    }
    ctx.strokeStyle = '#3d281c'; ctx.lineWidth = 20;
    ctx.beginPath(); ctx.moveTo(-20, 65); ctx.lineTo(-30, 119); ctx.lineTo(-51, 124); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, 65); ctx.lineTo(30, 119); ctx.lineTo(54, 124); ctx.stroke();
    ctx.fillStyle = 'rgba(184, 59, 48, .88)';
    ctx.beginPath(); ctx.moveTo(-29, -59); ctx.lineTo(25, -59); ctx.lineTo(44, 72); ctx.lineTo(-51, 72); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#92392b'; ctx.lineWidth = 17;
    ctx.beginPath(); ctx.moveTo(-27, -43); ctx.lineTo(-65, -20); ctx.lineTo(-78, 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(25, -43); ctx.lineTo(61, -49); ctx.lineTo(84, -95); ctx.stroke();
    ctx.fillStyle = '#b26531'; ctx.strokeStyle = '#422d20'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-17, -61); ctx.lineTo(-23, -113);
    ctx.quadraticCurveTo(-9, -145, 20, -128); ctx.lineTo(28, -107);
    ctx.lineTo(42, -98); ctx.lineTo(28, -91); ctx.lineTo(28, -72); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#422d20';
    ctx.beginPath(); ctx.arc(-2, -135, 19, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(22, -108, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2d597';
    for (let y = -24; y < 58; y += 22) {
      ctx.beginPath(); ctx.moveTo(-2, y - 7); ctx.lineTo(6, y); ctx.lineTo(-2, y + 7); ctx.lineTo(-10, y); ctx.closePath(); ctx.fill();
    }
    for (const [x, y] of [[-27, -43], [25, -43], [-65, -20], [61, -49]] as const) {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    status.setAttribute('data-state', 'ready');
    status.textContent = '移动灯，看看影子往哪边走。';
  }
  const input = () => { draw(); onChange(); };
  const setSample = (sample: LightSample) => {
    lamp.value = String(sample.lampX);
    distance.value = String(sample.distance);
    draw();
  };
  const resetLight = () => { setSample(DEFAULT_LIGHT); onChange(); };
  lamp.addEventListener('input', input);
  lamp.addEventListener('change', input); // IE range also reports change while dragging.
  distance.addEventListener('input', input);
  distance.addEventListener('change', input);
  reset.addEventListener('click', resetLight);
  window.addEventListener('resize', draw);
  document.getElementById('light-controls')!.hidden = false;
  draw();
  return {
    getSample, setSample,
    dispose() {
      disposed = true;
      lamp.removeEventListener('input', input); lamp.removeEventListener('change', input);
      distance.removeEventListener('input', input); distance.removeEventListener('change', input);
      reset.removeEventListener('click', resetLight);
      window.removeEventListener('resize', draw);
    },
  };
}
