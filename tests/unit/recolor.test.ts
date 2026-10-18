import {describe,expect,it} from 'vitest';
import {tintSourceChannel} from '../../src/renderers/canvas/recolor';

describe('source-relative image tint',()=>{
  it('keeps every source channel unchanged for the default selection',()=>{
    for(let source=0;source<256;source++)for(const base of [15,48,83,184,215,242])expect(tintSourceChannel(source,base,base)).toBe(source);
  });
  it('keeps the difference between ink and lit cloth after a color change',()=>{
    expect(tintSourceChannel(40,80,120)).toBe(60);
    expect(tintSourceChannel(80,80,120)).toBe(120);
    expect(tintSourceChannel(120,80,120)).toBe(180);
  });
  it('bounds bright channels and handles a dark baseline without nonfinite values',()=>{
    expect(tintSourceChannel(220,30,200)).toBe(255);
    expect(tintSourceChannel(0,0,200)).toBe(0);
  });
});
