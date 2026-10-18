export interface SpatialCapabilityInput {
  legacy: boolean;
  webgl2: boolean;
  width: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
  dpr?: number;
}

export interface SpatialBudget {
  pixelRatio: number;
  maxWidth: number;
  textureSize: number;
}

export interface SpatialCapability {
  eligible: boolean;
  reason: string;
  budget: SpatialBudget;
}

function positiveFinite(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** A pure admission/budget decision; only the renderer can confirm WebGL initialization. */
export function spatialCapability(input: SpatialCapabilityInput): SpatialCapability {
  const width = positiveFinite(input.width) ?? 0;
  const memory = positiveFinite(input.deviceMemory);
  const cores = positiveFinite(input.hardwareConcurrency);
  const lightweight = width <= 700 || (memory !== undefined && memory <= 2)
    || (cores !== undefined && Math.floor(cores) <= 2) || input.saveData === true;
  const pixelRatioLimit = lightweight ? 1 : 1.5;
  const budget: SpatialBudget = {
    pixelRatio: Math.min(pixelRatioLimit, Math.max(.5, positiveFinite(input.dpr) ?? 1)),
    maxWidth: lightweight ? 512 : 1024,
    textureSize: lightweight ? 512 : 1024,
  };

  if (input.legacy) return { eligible: false, reason: '当前模式保留二维幕面', budget };
  if (!input.webgl2) return { eligible: false, reason: '当前设备保留二维幕面', budget };
  return { eligible: true, reason: lightweight ? '采用轻量空间观察' : '可展开空间观察', budget };
}
