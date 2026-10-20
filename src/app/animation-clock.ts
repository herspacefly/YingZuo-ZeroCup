export interface FramePort { request(callback:(time:number)=>void):number; cancel(id:number):void; now():number }
export interface FrameObserver { frame(deltaMs:number):void; reset():void }
export type ClockFault = {reason:'gap'|'error';error?:unknown};
/** One disposable scheduler. Consumers compute absolute-time poses; the renderer has no RAF. */
export function createAnimationClock(port:FramePort,tick:(deltaMs:number)=>boolean,onFault:(fault:ClockFault)=>void,observer?:FrameObserver) {
  let active=false,pending:number|null=null,last=0,generation=0,disposed=false,firstFrame=true;
  function stop() {active=false;generation++;if(pending!==null)port.cancel(pending);pending=null;observer?.reset();}
  function schedule() {
    const token=generation;
    pending=port.request(time=>{
      if(disposed||!active||token!==generation)return;
      pending=null;const delta=time-last;
      // RAF timestamps name the beginning of the frame. A play click later in that
      // same frame may have a newer performance.now(); wait for the next frame
      // without shifting the play baseline or treating this as a backwards clock.
      if(firstFrame&&Number.isFinite(delta)&&delta<0){firstFrame=false;schedule();return;}
      firstFrame=false;last=time;
      if(!Number.isFinite(delta)||delta<0||delta>250) {stop();onFault({reason:'gap'});return;}
      try {if(!tick(delta)) {stop();return;}if(active)observer?.frame(delta);}
      catch(error) {stop();onFault({reason:'error',error});return;}
      if(active&&pending===null)schedule();
    });
  }
  return {
    start() {if(disposed||active)return;observer?.reset();active=true;firstFrame=true;last=port.now();schedule();},
    stop,
    get running(){return active;},
    dispose(){stop();disposed=true;},
  };
}
