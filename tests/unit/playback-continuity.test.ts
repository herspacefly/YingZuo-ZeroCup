import {describe,it,expect} from 'vitest';
import {createPlaybackContinuity} from '../../src/story/playback-continuity';
const at={projectId:'project',runId:'run',revision:3,nodeId:'training'},next={...at,revision:4,nodeId:'guardian'};
describe('mounted performance playback handoff',()=>{
 it('starts paused and consumes exactly the expected successor once',()=>{const c=createPlaybackContinuity();expect(c.consume(at)).toBe(false);c.start(at);c.handoff(at,'guardian');for(const other of [{...next,projectId:'other'},{...next,runId:'other'},{...next,revision:5},{...next,nodeId:'road'},at])expect(c.consume(other)).toBe(false);expect(c.consume(next)).toBe(true);expect(c.consume(next)).toBe(false);expect(c.active(next)).toBe(true);});
 it('pause, failure or unmount revoke a delayed successor and its further handoffs',()=>{const c=createPlaybackContinuity();c.start(at);c.handoff(at,'guardian');c.stop();expect(c.pending()).toBe(false);expect(c.consume(next)).toBe(false);c.handoff(next,'approach-choice');expect(c.pending()).toBe(false);});
 it('only an explicitly armed opening can start a mounted node',()=>{const c=createPlaybackContinuity();c.resumeHere(at);expect(c.consume(at)).toBe(true);c.stop();expect(createPlaybackContinuity().consume(at)).toBe(false);});
});
