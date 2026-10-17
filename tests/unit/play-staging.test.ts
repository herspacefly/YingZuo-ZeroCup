import {describe,expect,it} from 'vitest';
import {reunionDefinition} from '../../src/content/reunion';
import {storyEntry} from '../../src/domain/story';
import type {StoryNodeId} from '../../src/domain/types';
import {createSceneDirector} from '../../src/story/director';
import {interactionHandPoints} from '../../src/story/node-interaction';
import {handDistanceRatio} from '../../src/story/interactions';
import {holdingFrame,stagePlayFrame} from '../../src/story/play-staging';
import {at} from '../helpers/story';
const effects={opening:0,reveal:0,reaction:0,guardianExit:0};
function setup(id:StoryNodeId){const project=at(id,id.startsWith('split-')?'split-first':'call-first'),entry=storyEntry(project,reunionDefinition,1);return{node:entry.node,director:createSceneDirector(project,entry)};}
describe('T17 visible staging and stable reunion recovery',()=>{
  it('keeps the mountain closed until an actual axe resolution while letting the user see the silhouette',()=>{
    const call=setup('call-light'),frame=call.director.sample(2000).frame,before=JSON.stringify(frame);
    const hidden=stagePlayFrame(call.node,frame,effects),revealed=stagePlayFrame(call.node,frame,{...effects,reveal:1});
    expect(hidden.sceneLayers!.find(layer=>layer.id==='mountain-left')).toMatchObject({x:0,opacity:.3});
    expect(hidden.actorOpacity!.mother).toBe(.05);expect(revealed.actorOpacity!.mother).toBe(1);expect(revealed.sceneLayers!.find(layer=>layer.id==='mountain-left')!.x).toBe(0);
    expect(JSON.stringify(frame)).toBe(before);
    const axe=setup('split-axe'),opened=stagePlayFrame(axe.node,axe.director.sample(0).frame,{...effects,opening:1});
    expect(opened.sceneLayers!.find(layer=>layer.id==='mountain-left')!.x).toBe(-.55);expect(opened.sceneLayers!.find(layer=>layer.id==='mountain-right')!.x).toBe(.55);
  });
  it('replies to a wave only during the observed reaction and clears the opened dust with real light',()=>{
    const wave=setup('memory-wave'),frame=wave.director.sample(2000).frame;
    const before=stagePlayFrame(wave.node,frame,effects),reply=stagePlayFrame(wave.node,frame,{...effects,reaction:1});
    expect(before.actors[1]!.pose.joints).toEqual(wave.node.entryPoses.mother!.joints);expect(reply.actors[1]!.pose.joints.rightShoulder).toBeGreaterThan(0);
    const search=setup('split-search');expect(stagePlayFrame(search.node,search.director.sample(0).frame,{...effects,reveal:1}).sceneLayers!.find(layer=>layer.id==='mountain-dust')!.opacity).toBe(0);
  });
  it('rebuilds a legal close pair on refresh and preserves an actual carried pair into hold and curtain',()=>{
    const hold=setup('reunion-hold'),frame=hold.director.sample(0).frame,restored=holdingFrame(frame),points=interactionHandPoints(restored)!;
    expect(handDistanceRatio(points.chenxiang,points.mother)).toBeLessThanOrEqual(.04);
    expect(frame.actors[0]!.pose).toEqual(hold.node.entryPoses.chenxiang);
    for(const id of ['reunion-hold','curtain','completed'] as const){
      const scene=setup(id),composed=stagePlayFrame(scene.node,scene.director.sample(0).frame,{...effects,holding:restored});
      expect(composed.actors.map(actor=>actor.pose)).toEqual(restored.actors.map(actor=>actor.pose));
    }
  });
});
