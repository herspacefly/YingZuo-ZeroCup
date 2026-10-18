import { describe, expect, it } from 'vitest';
import { spatialCapability } from '../../src/app/capabilities';

const desktop = { legacy: false, webgl2: true, width: 1440, deviceMemory: 8, hardwareConcurrency: 8, dpr: 2 };

describe('spatial capability boundary', () => {
  it('keeps legacy and missing WebGL2 in the complete two-dimensional experience', () => {
    expect(spatialCapability({ ...desktop, legacy: true })).toMatchObject({ eligible: false, reason: '当前模式保留二维幕面' });
    expect(spatialCapability({ ...desktop, webgl2: false })).toMatchObject({ eligible: false, reason: '当前设备保留二维幕面' });
    expect(spatialCapability({ ...desktop, legacy: true, webgl2: false }).eligible).toBe(false);
  });

  it.each([
    { width: 390 }, { width: 700 }, { deviceMemory: .25 }, { deviceMemory: 2 },
    { hardwareConcurrency: 1 }, { hardwareConcurrency: 2 }, { hardwareConcurrency: 2.5 }, { saveData: true },
  ])('admits low-budget spatial observation for %j', (signal) => {
    expect(spatialCapability({ ...desktop, ...signal })).toEqual({
      eligible: true, reason: '采用轻量空间观察', budget: { pixelRatio: 1, maxWidth: 512, textureSize: 512 },
    });
  });

  it('does not reject devices that omit optional resource signals and caps regular rendering', () => {
    expect(spatialCapability({ legacy: false, webgl2: true, width: 701 })).toEqual({
      eligible: true, reason: '可展开空间观察', budget: { pixelRatio: 1, maxWidth: 1024, textureSize: 1024 },
    });
    expect(spatialCapability({ ...desktop, width: Number.MAX_VALUE, dpr: Number.MAX_VALUE }).budget)
      .toEqual({ pixelRatio: 1.5, maxWidth: 1024, textureSize: 1024 });
  });

  it.each([0, -1, NaN, Infinity, -Infinity])('uses safe budgets for invalid numeric signals: %s', (invalid) => {
    expect(spatialCapability({ ...desktop, width: invalid, dpr: invalid })).toMatchObject({
      eligible: true, budget: { pixelRatio: 1, maxWidth: 512, textureSize: 512 },
    });
    expect(spatialCapability({ ...desktop, deviceMemory: invalid, hardwareConcurrency: invalid, dpr: invalid }))
      .toMatchObject({ eligible: true, budget: { pixelRatio: 1, maxWidth: 1024, textureSize: 1024 } });
  });

  it('preserves useful low DPR values, bounds extreme small values and returns independent budgets', () => {
    expect(spatialCapability({ ...desktop, dpr: .75 }).budget.pixelRatio).toBe(.75);
    expect(spatialCapability({ ...desktop, width: 390, dpr: .001 }).budget.pixelRatio).toBe(.5);
    const input = Object.freeze({ ...desktop });
    const first = spatialCapability(input), second = spatialCapability(input);
    first.budget.maxWidth = 1;
    expect(second.budget.maxWidth).toBe(1024);
    expect(input).toEqual(desktop);
  });
});
