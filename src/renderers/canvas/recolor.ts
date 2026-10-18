/** Explicit source-relative tint keeps the plate's shading and printed texture.
 * Default selections return every source channel unchanged. Old catalogs retain
 * the original exact replacement behavior by omitting the mode.
 */
export function tintSourceChannel(source: number, baseline: number, selected: number): number {
  return Math.max(0, Math.min(255, Math.round(source * selected / Math.max(1, baseline))));
}
