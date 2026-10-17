export interface FramePort { request(callback:(time:number)=>void):number; cancel(id:number):void; now():number }
export type ClockFault = {reason:'gap'|'error';error?:unknown};
/** One disposable scheduler. Consumers compute absolute-time poses; the renderer has no RAF. */
export function createAnimationClock(port:FramePort,tick:(deltaMs:number)=>boolean,onFault:(fault:ClockFault)=>void) {
  let active=false,pending:number|null=null,last=0,generation=0,disposed=false;
  function stop() {active=false;generation++;if(pending!==null)port.cancel(pending);pending=null;}
  function schedule() {
    const token=generation;
    pending=port.request(time=>{
      if(disposed||!active||token!==generation)return;
      pending=null;const delta=time-last;last=time;
      if(!Number.isFinite(delta)||delta<0||delta>250) {stop();onFault({reason:'gap'});return;}
      try {if(!tick(delta)) {stop();return;}}
      catch(error) {stop();onFault({reason:'error',error});return;}
      if(active&&pending===null)schedule();
    });
  }
  return {
    start() {if(disposed||active)return;active=true;last=port.now();schedule();},
    stop,
    get running(){return active;},
    dispose(){stop();disposed=true;},
  };
}
