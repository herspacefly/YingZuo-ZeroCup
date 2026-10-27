import { describe, expect, it } from 'vitest';
import { createStageAudioSession } from '../../src/audio/stage-session';
import type { MusicMedia, MusicStatus } from '../../src/audio/stage-music';
import type { StageAudioContext } from '../../src/audio/stage-sound';
import type { StageVoiceSample, VoiceMedia } from '../../src/audio/stage-voice';

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
  it('atomically replaces a reset sample without consuming the new opening cue through the old elapsed time',async()=>{
    const fixture=setup(),{session}=fixture;session.setScene(null,false);session.unlock();await flush();
    session.effects.update({nodeId:'intro',mode:'full',elapsedMs:0,playing:true});
    expect(fixture.voices).toBe(1);
    session.setScene({nodeId:'intro',mode:'full',elapsedMs:200,playing:false},true);
    session.effects.reset('intro');session.setScene({nodeId:'intro',mode:'full',elapsedMs:0,playing:false},true,true);
    session.effects.update({nodeId:'intro',mode:'full',elapsedMs:0,playing:true});
    expect(fixture.voices).toBe(2);session.dispose();
  });
});

function voiceSession(blocked=false){
  let permitted=!blocked;
  function media(){
    const listeners=new Map<string,Set<()=>void>>();let playing=false,plays=0;
    const item:VoiceMedia={src:'',preload:'',volume:1,loop:false,currentTime:0,readyState:1,error:null,
      play(){plays++;if(!permitted)return Promise.reject(new DOMException('gesture required','NotAllowedError'));playing=true;},
      pause(){playing=false;},load(){},removeAttribute(name){if(name==='src')item.src='';},
      addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type)!.add(listener);},
      removeEventListener(type,listener){listeners.get(type)?.delete(listener);},
    };
    return {item,emit(type:string){for(const listener of [...(listeners.get(type)??[])])listener();},get audible(){return playing;},get plays(){return plays;},listeners};
  }
  const musicPlayers:ReturnType<typeof media>[]=[],voicePlayers:ReturnType<typeof media>[]=[],statuses:MusicStatus[]=[];
  const session=createStageAudioSession({
    tracks:[...tracks,{id:'curtain',src:'/curtain-vocal.mp3',title:'谢幕',credit:'原署名',volume:.4,loop:false}],
    createAudio:()=>{const value=media();musicPlayers.push(value);return value.item;},
    voice:{createAudio:()=>{const value=media();voicePlayers.push(value);return value.item;}},effects:{legacy:true},
    onMusic(status){statuses.push(status);},
  });
  const cues=[{startMs:0,endMs:1500,clip:{id:'voice-one',src:'/voice/one.mp3',durationMs:1200}}];
  function update(elapsedMs=0,playing=true,nodeId:'intro'|'curtain'='intro'){
    const voice:StageVoiceSample={token:`run:revision:${nodeId}`,elapsedMs,playing,cues};
    session.setVoice(voice,{nodeId,mode:'full',definitionVersion:5,elapsedMs,playing});
  }
  return {session,update,musicPlayers,voicePlayers,statuses,permit(){permitted=true;}};
}

describe('v5 dialogue and soundtrack session integration',()=>{
  it('defaults voice intent on, unlocks synchronously and retains independent voice/music preferences across routes',async()=>{
    const {session,update,musicPlayers,voicePlayers}=voiceSession();
    expect(session.voiceEnabled()).toBe(true);expect(session.musicEnabled()).toBe(true);
    session.setScene({nodeId:'intro',mode:'full',definitionVersion:5,elapsedMs:0,playing:true},true);update();
    expect(voicePlayers).toHaveLength(0);session.unlock();expect(voicePlayers[0]!.plays).toBe(1);await flush();
    session.toggleVoice();expect(session.voiceEnabled()).toBe(false);expect(session.musicEnabled()).toBe(true);
    expect(voicePlayers[0]!.audible).toBe(false);expect(musicPlayers[0]!.audible).toBe(true);
    session.setVoice(null);session.setScene(null,false);session.unlock();update(100);expect(voicePlayers).toHaveLength(1);
    session.toggleMusic();expect(session.musicEnabled()).toBe(false);session.toggleVoice();await flush();
    expect(session.voiceEnabled()).toBe(true);expect(session.musicEnabled()).toBe(false);expect(voicePlayers[1]!.audible).toBe(true);
    expect(musicPlayers.every(player=>!player.audible)).toBe(true);session.dispose();
    const fresh=voiceSession();expect(fresh.session.voiceEnabled()).toBe(true);fresh.session.dispose();
  });
  it('keeps blocked voice intent on, does not retry on frames and retries on a gesture at the current offset',async()=>{
    const {session,update,voicePlayers,permit}=voiceSession(true);update();session.unlock();await flush();
    expect(session.voice.getStatus().state).toBe('blocked');expect(session.voiceEnabled()).toBe(true);
    update(200);update(400);expect(voicePlayers).toHaveLength(1);
    permit();session.unlock();expect(voicePlayers).toHaveLength(2);expect(voicePlayers[1]!.item.currentTime).toBe(.4);await flush();
    voicePlayers[1]!.emit('playing');expect(session.voice.getStatus()).toMatchObject({state:'enabled',playing:true});session.dispose();
  });
  it('ducks music only after native voice playing and restores gain on pause, end, error and route cleanup',async()=>{
    const {session,update,musicPlayers,voicePlayers}=voiceSession();update();session.unlock();await flush();
    const music=musicPlayers[0]!,voice=voicePlayers[0]!;
    expect(music.item.volume).toBe(.2);voice.emit('playing');expect(music.item.volume).toBe(.05);
    update(300,false);expect(music.item.volume).toBe(.2);expect(voice.audible).toBe(false);
    update(300,true);voice.emit('playing');expect(music.item.volume).toBe(.05);voice.emit('ended');expect(music.item.volume).toBe(.2);
    session.voice.seek({token:'new-seek',elapsedMs:0,playing:true,cues:[{startMs:0,endMs:1500,clip:{id:'voice-one',src:'/voice/one.mp3',durationMs:1200}}]});
    const second=voicePlayers[1]!;second.emit('playing');expect(music.item.volume).toBe(.05);
    Object.assign(second.item,{error:{code:3,message:'decode failed'}});second.emit('error');expect(music.item.volume).toBe(.2);
    await session.voice.enable();const third=voicePlayers[2]!;third.emit('playing');expect(music.item.volume).toBe(.05);
    session.setVoice(null);session.setScene(null,false);expect(music.item.volume).toBe(.2);expect(third.audible).toBe(false);session.dispose();
  });
  it('reserves instrumental accompaniment for curtain dialogue and switches to the original singing only after its subtitle tail',async()=>{
    const {session,update,musicPlayers,voicePlayers,statuses}=voiceSession();update(0,true,'curtain');session.unlock();await flush();
    expect(statuses.at(-1)?.trackId).toBe('instrumental');expect(musicPlayers[0]!.item.src).toBe('/local-music.mp3');
    voicePlayers[0]!.emit('playing');expect(musicPlayers[0]!.item.volume).toBe(.05);
    session.toggleVoice();update(1300,true,'curtain');expect(statuses.at(-1)?.trackId).toBe('instrumental');expect(musicPlayers[0]!.item.volume).toBe(.2);
    update(1500,true,'curtain');expect(statuses.at(-1)?.trackId).toBe('curtain');expect(musicPlayers[0]!.audible).toBe(false);
    expect(musicPlayers[1]!.item.src).toBe('/curtain-vocal.mp3');expect(musicPlayers[1]!.item.volume).toBe(.4);
    expect(session.voiceEnabled()).toBe(false);expect(voicePlayers.every(player=>!player.audible)).toBe(true);session.dispose();
  });
  it('stops inactive dialogue and restores gain immediately; focus alone cannot revive the last request',async()=>{
    const {session,update,musicPlayers,voicePlayers}=voiceSession();update();session.unlock();await flush();
    voicePlayers[0]!.emit('playing');expect(musicPlayers[0]!.item.volume).toBe(.05);
    session.setActive(false);expect(voicePlayers[0]!.audible).toBe(false);expect(musicPlayers[0]!.item.volume).toBe(.2);
    const plays=voicePlayers[0]!.plays;session.setActive(true);session.unlock();expect(voicePlayers[0]!.plays).toBe(plays);expect(voicePlayers[0]!.audible).toBe(false);
    update(300);expect(voicePlayers[0]!.plays).toBe(plays+1);expect(voicePlayers[0]!.item.currentTime).toBe(.3);session.dispose();
    expect(voicePlayers.every(player=>[...player.listeners.values()].every(group=>group.size===0))).toBe(true);
  });
});
