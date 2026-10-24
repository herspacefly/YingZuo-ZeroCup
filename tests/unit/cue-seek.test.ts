import { describe, expect, it } from 'vitest';
import { reunionDefinition,expandedDefinition,literaryDefinition,lamplitDefinition } from '../../src/content/reunion';
import { subtitlesForMode } from '../../src/content/story-contract';
import { cueSeekTime } from '../../src/story/cue-seek';
import type { CueSeek,CueSeekState } from '../../src/story/cue-seek';

describe('current-fragment cue transport',()=>{
  for(const definition of [reunionDefinition,expandedDefinition,literaryDefinition,lamplitDefinition])for(const mode of ['full','guided'] as const){
    it(`v${definition.definitionVersion}/${mode} resolves authored cues on its own playback timeline`,()=>{
      const node=definition.nodes.find(n=>n.id==='memory-wave')!,state:CueSeekState={nodeToken:'mounted-node',mode,node,ready:true,blocked:false,resolving:false,completed:false};
      const before=structuredClone(state),cues=subtitlesForMode(node,mode);
      cues.forEach((cue,cueIndex)=>expect(cueSeekTime({nodeToken:state.nodeToken,mode,cueIndex},state)).toBe(cue.startMs));
      expect(state).toEqual(before);
      if(mode==='guided'&&node.guidedSubtitles)expect(cues.map(c=>c.text)).toEqual(node.guidedSubtitles.map(c=>c.text));
    });
  }
  it('rejects stale fragments, mode changes, indices and every locked phase',()=>{
    const node=lamplitDefinition.nodes.find(n=>n.id==='memory-wave')!,state:CueSeekState={nodeToken:'active',mode:'guided',node,ready:true,blocked:false,resolving:false,completed:false};
    const request:CueSeek={nodeToken:'active',mode:'guided',cueIndex:0};
    for(const changed of [{nodeToken:'old'},{mode:'full' as const},{cueIndex:-1},{cueIndex:.5},{cueIndex:Infinity},{cueIndex:99}])expect(cueSeekTime({...request,...changed},state)).toBeNull();
    for(const changed of [{ready:false},{blocked:true},{resolving:true},{completed:true}])expect(cueSeekTime(request,{...state,...changed})).toBeNull();
    for(const id of ['craft','completed'])expect(cueSeekTime(request,{...state,node:lamplitDefinition.nodes.find(n=>n.id===id)!})).toBeNull();
  });
});
