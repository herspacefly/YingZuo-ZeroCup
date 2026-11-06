import { describe, expect, it } from 'vitest';
import { storyFeedback } from '../../src/features/story/feedback';
import type { StoryFeedbackInput } from '../../src/features/story/feedback';

const ready: StoryFeedbackInput = {
  hasStory:true,error:false,blocked:false,ready:true,observing:false,playing:true,interactive:true,
  listening:false,choice:false,completed:false,resolving:false,reading:null,holdMs:500,
};

describe('story feedback mirrors the real director and observer', () => {
  it('waits for dialogue before handing over the puppet', () => {
    expect(storyFeedback({...ready,listening:true}).state).toBe('listening');
    expect(storyFeedback(ready).state).toBe('ready');
  });
  it('shows actual held time bounded by the authored target', () => {
    const reading = {evidence:null,coverage:.8,heldMs:250,distanceRatio:Infinity,phase:'holding' as const};
    expect(storyFeedback({...ready,reading}).progress).toEqual({value:250,max:500});
    expect(storyFeedback({...ready,reading:{...reading,heldMs:800}}).progress).toEqual({value:500,max:500});
    expect(storyFeedback({...ready,reading,holdMs:null}).progress).toBeNull();
  });
  it('asks for a deliberate lowering after the axe was raised', () => {
    const feedback = storyFeedback({...ready,reading:{evidence:null,coverage:0,heldMs:500,distanceRatio:Infinity,phase:'raised'}});
    expect(feedback.state).toBe('lower-axe');
    expect(feedback.progress).toBeNull();
  });
  it('does not mistake visual overlap for completion', () => {
    expect(storyFeedback({...ready,reading:{evidence:null,coverage:1,heldMs:0,distanceRatio:0,phase:'waiting'}}).state).toBe('ready');
    expect(storyFeedback({...ready,resolving:true}).state).toBe('showcase');
    expect(storyFeedback({...ready,playing:false,completed:true}).state).toBe('complete');
  });
  it('interruption states override active action hints and do not offer progress', () => {
    expect(storyFeedback({...ready,playing:false,resolving:true}).state).toBe('paused');
    expect(storyFeedback({...ready,observing:true}).state).toBe('observing');
    expect(storyFeedback({...ready,blocked:true,observing:true}).state).toBe('saving');
    expect(storyFeedback({...ready,ready:false}).state).toBe('loading');
    expect(storyFeedback({...ready,error:true,blocked:true}).state).toBe('error');
    expect(storyFeedback({...ready,hasStory:false}).state).toBe('empty');
  });
  it('offers an explicit choice during and after narration', () => {
    expect(storyFeedback({...ready,interactive:false,choice:true,playing:false}).state).toBe('choice');
    expect(storyFeedback({...ready,interactive:false,choice:true,listening:true}).state).toBe('choice');
  });
});
