import type { Point } from './projection';
import type { LimbId } from './limb-input';
export type CableSource = LimbId | 'body';
export interface CablePresentation { source: CableSource; bend: number }
export interface CableCurve { start: Point; first: Point; second: Point; end: Point }
/** One shared cubic for Canvas, SVG and sampled Three lines. Bend is in world units. */
export function cableCurve(start:Point,end:Point,bend=0):CableCurve {
  const x=end.x-start.x,y=end.y-start.y,length=Math.hypot(x,y)||1;
  const b=Number.isFinite(bend)?bend:0;
  return {start:{...start},first:{x:start.x+x/3-y/length*b,y:start.y+y/3+x/length*b},second:{x:start.x+x*2/3-y/length*b,y:start.y+y*2/3+x/length*b},end:{...end}};
}
export function cablePoint(curve:CableCurve,t:number):Point{const u=1-t;return{x:u*u*u*curve.start.x+3*u*u*t*curve.first.x+3*u*t*t*curve.second.x+t*t*t*curve.end.x,y:u*u*u*curve.start.y+3*u*u*t*curve.first.y+3*u*t*t*curve.second.y+t*t*t*curve.end.y};}
export function cablePath(curve:CableCurve){return`M ${curve.start.x} ${curve.start.y} C ${curve.first.x} ${curve.first.y} ${curve.second.x} ${curve.second.y} ${curve.end.x} ${curve.end.y}`;}
/** Only page-owned clock deltas advance the 700ms release. No timers or saved trajectory. */
export function createCableMotion(){let source:CableSource|null=null,bend=0,elapsed=0,held=false;
  return {pull(id:CableSource,velocity=0){source=id;held=true;elapsed=0;bend=Math.max(-.035,Math.min(.035,Number.isFinite(velocity)&&Math.abs(velocity)>.00001?velocity*1.5:.018));},release(){if(source){held=false;elapsed=0;}},clear(){source=null;bend=elapsed=0;held=false;},tick(delta:number){if(!held&&source&&Number.isFinite(delta)&&delta>0){elapsed=Math.min(700,elapsed+delta);if(elapsed>=700)source=null;}},get active(){return source!==null;},sample():CablePresentation|undefined{if(!source)return undefined;const fade=held?1:(1-elapsed/700)**2;return{source,bend:bend*fade*Math.cos(elapsed/700*Math.PI*2)};}};
}

export function cableScreenPath(start:Point,end:Point,bend:number,scale:number){const ratio=Math.max(1,scale),c=cableCurve({x:start.x/ratio,y:start.y/ratio},{x:end.x/ratio,y:end.y/ratio},bend);return cablePath({start,first:{x:c.first.x*ratio,y:c.first.y*ratio},second:{x:c.second.x*ratio,y:c.second.y*ratio},end});}
