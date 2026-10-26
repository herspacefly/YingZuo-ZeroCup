import type { Approach, EndingId, FinalAction, JourneyIntent, MountainPact, StoryProgress } from './types';

/** Authored causal rules, independent of input skill, assistance and transport state. */
export function resolveEnding(journeyIntent:JourneyIntent,mountainPact:MountainPact,approach:Approach,finalAction:FinalAction):EndingId {
  if(finalAction==='wait')return 'waiting';
  if(mountainPact==='self')return 'sacrifice';
  if(approach==='split-first')return 'road';
  return journeyIntent==='home'?'home':'light';
}
export function choiceSummary(story:Pick<StoryProgress,'definitionVersion'|'choices'|'approach'>):{label:string;value:string}[] {
  if(story.definitionVersion!==5||!story.choices)return [];
  const {journeyIntent,mountainPact,finalAction}=story.choices;
  return [
    {label:'行路愿望',value:journeyIntent==='home'?'接母亲回家':journeyIntent==='open-road'?'为后来人留路':'尚未决定'},
    {label:'承山约定',value:mountainPact==='shared'?'与二郎神共同承山':mountainPact==='self'?'独自承山，承担永久化山的代价':'尚未决定'},
    {label:'山前先后',value:story.approach==='call-first'?'先举灯呼唤':story.approach==='split-first'?'先挥斧开山':'尚未决定'},
    {label:'最后行动',value:finalAction==='wait'?'暂缓最后一斧，留灯相守':finalAction==='fulfill'?'兑现此前约定，继续解印':'尚未决定'},
  ];
}
