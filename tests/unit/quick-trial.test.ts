import { describe, expect, it } from 'vitest';
import { createTrialScenes, createTrialTimeline, trialAdvanceBeforeVoiceTail, TRIAL_DURATION_MS, TRIAL_SEGMENTS } from '../../src/features/quick-trial/model';
import { createNodeInteraction, interactionGoal } from '../../src/story/node-interaction';
import { createAnimationClock } from '../../src/app/animation-clock';
import { choiceDefinition } from '../../src/content/reunion';

describe('isolated quick trial', () => {
  it('keeps exactly 90 seconds of automatic choreography and waits for both explicit interactions', () => {
    expect(TRIAL_DURATION_MS).toBe(90000);
    const timeline = createTrialTimeline();
    expect(timeline.advance(90000)).toMatchObject({ index: 2, elapsedMs: 12000, automaticMs: 38455, waiting: 'lamp', ended: false });
    expect(timeline.advance(60000).automaticMs).toBe(38455);
    expect(timeline.completeWait('wave')).toBe(false);
    expect(timeline.completeWait('lamp')).toBe(true);
    expect(timeline.advance(90000)).toMatchObject({ index: 3, elapsedMs: 18396, automaticMs: 56851, waiting: 'wave' });
    timeline.completeWait('wave');
    expect(timeline.advance(90000)).toMatchObject({ index: 6, elapsedMs: 5914, automaticMs: 90000, waiting: null, ended: true });
    timeline.reset(); expect(timeline.position()).toMatchObject({ index: 0, elapsedMs: 0, automaticMs: 0, waiting: null, ended: false });
  });

  it('fits original complete natural speech in the three narrated segments without reaching any ending', () => {
    const scenes = createTrialScenes();
    for (const [scene, id] of [[scenes.intro, 'intro'], [scenes.wave, 'wave'], [scenes.training, 'training']] as const) {
      const segment = TRIAL_SEGMENTS.find(item => item.id === id)!;
      expect(scene.director.durationMs).toBe(segment.durationMs);
      expect(scene.voice).toHaveLength(3);
      for (const cue of scene.voice) {
        expect(cue.clip.durationMs).toBeLessThanOrEqual(cue.endMs - cue.startMs);
        expect(cue.endMs).toBeLessThanOrEqual(segment.durationMs);
        expect(cue.clip.src).toMatch(/^\.\/audio\/voice-v5\//);
      }
    }
    expect(scenes.training.node.guidedSubtitles!.at(-1)!.text).toBe('斧刃停住，华山已在面前。');
    expect(TRIAL_SEGMENTS.map(segment => segment.id).join()).not.toMatch(/ending|curtain|reunion/);
  });

  it('captures independent drawing frames and never mutates authored story data or another trial', () => {
    const authored = JSON.stringify(choiceDefinition), first = createTrialScenes(), second = createTrialScenes();
    const position = { index: 2, elapsedMs: 12000, automaticMs: 38455, waiting: 'lamp' as const, ended: false };
    first.sample(position, false).frame.actors[0]!.pose.x = .99;
    const frame = first.lampFrame(); frame.stage.lampX = .7; frame.actors[0]!.pose.joints.rightElbow = 1;
    expect(first.lampFrame()).toEqual(second.lampFrame());
    expect(first.sample(position, false)).toEqual(second.sample(position, false));
    expect(JSON.stringify(choiceDefinition)).toBe(authored);
  });

  it('retains the real wave hold observation with a legal target, resetting evidence during pauses', () => {
    const scenes = createTrialScenes(), observer = createNodeInteraction(scenes.wave.node), initial = scenes.wave.director.sample(Infinity).frame;
    const goal = interactionGoal(scenes.wave.node, initial)!; expect(goal).toBeTruthy();
    const frame = { ...initial, actors: initial.actors.map(actor => actor.actorId === 'chenxiang' ? { ...actor, pose: goal.pose } : actor) };
    observer.observe(frame, 0, false, true); observer.observe(frame, 100, false, true);
    expect(observer.observe(frame, 200, true, true).heldMs).toBe(0);
    for (let time = 300; time <= 1400; time += 100) observer.observe(frame, time, false, true);
    expect(observer.observe(frame, 1500, false, true).evidence?.kind).toBe('wave');
  });

  it('uses one disposable scheduler and freezes the automatic budget while waiting', () => {
    const timeline = createTrialTimeline(); timeline.advance(38455);
    let now = 0, handle = 0; const jobs = new Map<number, (time: number) => void>();
    const clock = createAnimationClock({ now: () => now, request(callback) { jobs.set(++handle, callback); return handle; }, cancel(id) { jobs.delete(id); } }, delta => { timeline.advance(delta); return true; }, () => {});
    clock.start(); clock.start(); expect(jobs.size).toBe(1);
    for (let index = 0; index < 10; index++) { now += 100; const entries = [...jobs.entries()]; jobs.clear(); for (const [, callback] of entries) callback(now); expect(jobs.size).toBe(1); }
    expect(timeline.position().automaticMs).toBe(38455);
    clock.stop(); expect(jobs.size).toBe(0); clock.start(); expect(jobs.size).toBe(1); clock.dispose(); expect(jobs.size).toBe(0);
  });

  it('holds narrated boundaries until a playing native voice finishes, without changing the 90 second budget', () => {
    const position = { index: 1, elapsedMs: 20400, automaticMs: 26400, waiting: null, ended: false };
    expect(trialAdvanceBeforeVoiceTail(position, 100, true)).toBe(54);
    expect(trialAdvanceBeforeVoiceTail({ ...position, elapsedMs: 20454 }, 100, true)).toBe(0);
    expect(trialAdvanceBeforeVoiceTail({ ...position, elapsedMs: 20454 }, 100, false)).toBe(100);
    expect(TRIAL_DURATION_MS).toBe(90000);
  });
});
