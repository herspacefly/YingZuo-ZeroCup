import { describe, expect, it, vi } from 'vitest';
import { createAnimationClock } from '../../src/app/animation-clock';
import type { FrameObserver } from '../../src/app/animation-clock';

function setup(tick = (_delta:number)=>true,observer?:FrameObserver) {
  let time=100,id=0;const callbacks=new Map<number,(time:number)=>void>(),cancelled:number[]=[];
  const fault=vi.fn(),spy=vi.fn(tick),clock=createAnimationClock({now:()=>time,
    request(callback){callbacks.set(++id,callback);return id;},cancel(key){cancelled.push(key);callbacks.delete(key);}},spy,fault,observer);
  function frame(delta:number) {time+=delta;const [key,callback]=callbacks.entries().next().value!;callbacks.delete(key);callback(time);}
  return {clock,callbacks,cancelled,fault,spy,frame,setTime(value:number){time=value;}};
}
describe('unique disposable animation clock',()=>{
  it('samples performance through the same live clock and resets across pauses, gaps and disposal',()=>{
    const observer={frame:vi.fn(),reset:vi.fn()},s=setup(()=>true,observer);
    s.clock.start();s.clock.start();expect(observer.reset).toHaveBeenCalledTimes(1);
    const late=s.callbacks.values().next().value!;s.frame(50);expect(observer.frame).toHaveBeenLastCalledWith(50);
    s.clock.stop();s.setTime(10_000);s.clock.start();late(20_000);
    expect(observer.frame).toHaveBeenCalledTimes(1);expect(s.callbacks.size).toBe(1);
    s.frame(100);s.frame(251);expect(observer.frame.mock.calls).toEqual([[50],[100]]);
    expect(s.clock.running).toBe(false);expect(observer.reset).toHaveBeenCalledTimes(4);
    s.clock.dispose();s.clock.start();expect(s.callbacks.size).toBe(0);
  });
  it('does not sample a frame whose consumer stopped, finished or threw',()=>{
    const observer={frame:vi.fn(),reset:vi.fn()},ended=setup(()=>false,observer);ended.clock.start();ended.frame(50);
    const stopped=setup(()=>{stopped.clock.stop();return true;},observer);stopped.clock.start();stopped.frame(50);
    const failed=setup(()=>{throw new Error('render failure');},observer);failed.clock.start();failed.frame(50);
    expect(observer.frame).not.toHaveBeenCalled();
  });
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
