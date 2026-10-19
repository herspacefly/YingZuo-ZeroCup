import {expect,it} from 'vitest';
import {musicForScene} from '../../src/audio/music-scene';
import type {StageSoundSample} from '../../src/audio/stage-sound';
const sample=(nodeId:StageSoundSample['nodeId'],elapsedMs=0,playing=true):StageSoundSample=>({nodeId,elapsedMs,playing,mode:'full'});
it('keeps both first two-second reunion intervals silent in both modes',()=>{
  for(const node of ['reunion-reach','reunion-hold'] as const)for(const mode of ['full','guided'] as const){
    expect(musicForScene({...sample(node,1999),mode},true,true)).toEqual({trackId:null,playing:false});
    expect(musicForScene({...sample(node,2000),mode},true,true)).toEqual({trackId:'instrumental',playing:true});
  }
});
it('only selects vocals for the actual curtain and follows its pause',()=>{
  expect(musicForScene(sample('curtain'),true,true)).toEqual({trackId:'curtain',playing:true});
  expect(musicForScene(sample('curtain',4000,false),true,true)).toEqual({trackId:'curtain',playing:false});
  expect(musicForScene(sample('reunion-hold',3000),true,true)).toEqual({trackId:'instrumental',playing:true});
});
it('keeps missing story frames and hidden pages silent, with instrumental on other pages',()=>{
  expect(musicForScene(null,true,true)).toEqual({trackId:null,playing:false});
  expect(musicForScene(sample('curtain'),true,false)).toEqual({trackId:'curtain',playing:false});
  expect(musicForScene(null,false,false)).toEqual({trackId:'instrumental',playing:false});
  expect(musicForScene(null,false,true)).toEqual({trackId:'instrumental',playing:true});
});
