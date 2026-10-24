import { describe, expect, it } from 'vitest';
import { createStageAudioSession } from '../../src/audio/stage-session';
import type { MusicMedia, MusicStatus } from '../../src/audio/stage-music';
import type { StageAudioContext } from '../../src/audio/stage-sound';

const tracks=[{id:'instrumental',src:'/local-music.mp3',title:'器乐',credit:'原署名',volume:.2,loop:true}];
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
function setup(blocked=false){
  let permitted=!blocked,resumes=0,plays=0,pauses=0,closed=0,voices=0,audible=false;
  const statuses:{status:MusicStatus;intent:boolean}[]=[];
  const media:MusicMedia={src:'',preload:'',volume:1,loop:false,
    play(){plays++;if(!permitted)return Promise.reject(new DOMException('gesture required','NotAllowedError'));audible=true;},
    pause(){pauses++;audible=false;},load(){},removeAttribute(){},addEventListener(){},removeEventListener(){},
  };
  const parameter={setValueAtTime(){},linearRampToValueAtTime(){}};
  const graph={connect(){},disconnect(){}};
  const context:StageAudioContext={state:'suspended',currentTime:0,sampleRate:48000,destination:{},
    resume(){resumes++;if(!permitted)return Promise.reject(new DOMException('gesture required','NotAllowedError'));Object.assign(context,{state:'running'});return Promise.resolve();},
    close(){closed++;Object.assign(context,{state:'closed'});return Promise.resolve();},
    createGain(){return {...graph,gain:parameter};},
    createOscillator(){return {...graph,type:'sine',frequency:parameter,onended:null,start(){voices++;},stop(){}};},
    createBuffer(){return {getChannelData(){return new Float32Array(1);}};},
    createBufferSource(){return {...graph,buffer:null,onended:null,start(){voices++;},stop(){}};},
  };
  const session=createStageAudioSession({tracks,onMusic(status,intent){statuses.push({status,intent});},createAudio:()=>media,effects:{legacy:false,createContext:()=>{Object.assign(context,{state:'suspended'});return context;}}});
  return {session,statuses,permit(){permitted=true;},get resumes(){return resumes;},get plays(){return plays;},get pauses(){return pauses;},get closed(){return closed;},get voices(){return voices;},get audible(){return audible;}};
}
describe('per-document default-on audio session',()=>{
  it('attempts default-on play and resume synchronously, keeps manual mute over route changes, and resets with a fresh document',async()=>{
    const fixture=setup(),{session}=fixture;
    expect(session.musicEnabled()).toBe(true);expect(session.effectsEnabled()).toBe(true);
    session.setScene(null,false);session.unlock();
    expect(fixture.plays).toBe(1);expect(fixture.resumes).toBe(1);await flush();
    session.toggleMusic();session.effects.mute();expect(fixture.audible).toBe(false);
    session.setScene({nodeId:'intro',mode:'full',elapsedMs:0,playing:true,definitionVersion:3},true);
    session.setScene(null,false);session.unlock();
    expect(session.musicEnabled()).toBe(false);expect(session.effectsEnabled()).toBe(false);
    expect(fixture.plays).toBe(1);expect(fixture.resumes).toBe(1);
    session.dispose();const fresh=setup();expect(fresh.session.musicEnabled()).toBe(true);expect(fresh.session.effectsEnabled()).toBe(true);fresh.session.dispose();
  });
  it('distinguishes blocked playback from mute, retries only on a gesture, and does not catch up old stage cues',async()=>{
    const fixture=setup(true),{session}=fixture;
    session.setScene(null,false);session.unlock();await flush();
    expect(fixture.statuses.at(-1)).toMatchObject({status:{state:'blocked'},intent:true});
    expect(session.effects.getStatus().state).toBe('blocked');
    session.setScene({nodeId:'intro',mode:'full',elapsedMs:4100,playing:true,definitionVersion:1},true);
    session.setScene({nodeId:'intro',mode:'full',elapsedMs:4116,playing:true,definitionVersion:1},true);
    expect(fixture.plays).toBe(1);expect(fixture.resumes).toBe(1);
    fixture.permit();session.unlock();expect(fixture.plays).toBe(2);expect(fixture.resumes).toBe(2);await flush();
    session.setScene({nodeId:'intro',mode:'full',elapsedMs:4132,playing:true,definitionVersion:1},true);
    expect(fixture.voices).toBe(0);expect(session.effects.getStatus().state).toBe('enabled');
    session.dispose();
  });
  it('stops music and event voices when inactive and never changes intent during pause, reset or seeking',async()=>{
    const fixture=setup(),{session}=fixture;
    session.setScene(null,false);session.unlock();await flush();
    session.setScene({nodeId:'call-light',mode:'full',elapsedMs:0,playing:true,event:'light-found'},true);
    expect(fixture.voices).toBe(1);session.setActive(false);expect(fixture.audible).toBe(false);
    const count=fixture.voices;session.effects.update({nodeId:'call-light',mode:'full',elapsedMs:16,playing:true,event:'light-found'});
    expect(fixture.voices).toBe(count);
    session.effects.reset('intro');session.effects.seek({nodeId:'intro',mode:'full',elapsedMs:4100,playing:true});
    expect(session.effectsEnabled()).toBe(true);expect(session.musicEnabled()).toBe(true);
    session.dispose();session.dispose();expect(fixture.closed).toBe(1);
  });
});
