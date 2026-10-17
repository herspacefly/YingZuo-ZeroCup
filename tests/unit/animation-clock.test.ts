import { describe, expect, it, vi } from 'vitest';
import { createAnimationClock } from '../../src/app/animation-clock';

function setup(tick = (_delta:number)=>true) {
  let time=100,id=0;const callbacks=new Map<number,(time:number)=>void>(),cancelled:number[]=[];
  const fault=vi.fn(),spy=vi.fn(tick),clock=createAnimationClock({now:()=>time,
    request(callback){callbacks.set(++id,callback);return id;},cancel(key){cancelled.push(key);callbacks.delete(key);}},spy,fault);
  function frame(delta:number) {time+=delta;const [key,callback]=callbacks.entries().next().value!;callbacks.delete(key);callback(time);}
  return {clock,callbacks,cancelled,fault,spy,frame,setTime(value:number){time=value;}};
}
describe('unique disposable animation clock',()=>{
  it('repeated starts keep one callback and accumulate actual 60/120 Hz time equally',()=>{
    for(const hz of [60,120]){let elapsed=0;const s=setup(delta=>{elapsed+=delta;return true;});s.clock.start();s.clock.start();
      for(let i=0;i<hz;i++){expect(s.callbacks.size).toBe(1);s.frame(1000/hz);}
      expect(elapsed).toBeCloseTo(1000,8);s.clock.dispose();expect(s.callbacks.size).toBe(0);}
  });
  it('stop/resume excludes paused time and rejects a cancelled callback delivered late',()=>{
    const s=setup();s.clock.start();const late=s.callbacks.values().next().value!;s.frame(20);s.clock.stop();s.setTime(9000);s.clock.start();
    late(9500);expect(s.callbacks.size).toBe(1);expect(s.spy).toHaveBeenCalledTimes(1);s.frame(15);expect(s.spy).toHaveBeenLastCalledWith(15);
  });
  it.each([251,NaN,-1])('pauses on invalid or excessive delta %s without ticking',delta=>{
    const s=setup();s.clock.start();s.frame(delta);expect(s.spy).not.toHaveBeenCalled();expect(s.fault).toHaveBeenCalledWith({reason:'gap'});expect(s.clock.running).toBe(false);expect(s.callbacks.size).toBe(0);
  });
  it('allows exactly 250 ms and stopping inside tick cannot restart a second loop',()=>{
    const s=setup(()=>{s.clock.stop();return true;});s.clock.start();s.frame(250);expect(s.spy).toHaveBeenCalledWith(250);expect(s.callbacks.size).toBe(0);
  });
  it('stops at completion and reports exceptions once',()=>{
    const end=setup(()=>false);end.clock.start();end.frame(10);expect(end.callbacks.size).toBe(0);
    const error=new Error('render failed'),s=setup(()=>{throw error;});s.clock.start();s.frame(10);expect(s.fault).toHaveBeenCalledExactlyOnceWith({reason:'error',error});expect(s.callbacks.size).toBe(0);
  });
  it('dispose makes old callbacks and future starts inert',()=>{
    const s=setup();s.clock.start();const late=s.callbacks.values().next().value!;s.clock.dispose();late(120);s.clock.start();expect(s.spy).not.toHaveBeenCalled();expect(s.callbacks.size).toBe(0);
  });
});
