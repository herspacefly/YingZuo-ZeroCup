import type { StoryPayload } from '../domain/story-types';
import type { StoryNodeId, StoryProgress } from '../domain/types';

export interface ChoiceOption {id:string;nodeId:StoryNodeId;label:string;payload:StoryPayload}
/** The formal stage and text alternative expose the same authored actions. */
export function v5ChoiceOptions(story:Pick<StoryProgress,'choices'>|null|undefined):ChoiceOption[] {
  return [
    {id:'journey-home',nodeId:'journey-choice',label:'接母亲回家',payload:{action:'CHOOSE_JOURNEY',journeyIntent:'home'}},
    {id:'journey-open-road',nodeId:'journey-choice',label:'为后来人留路',payload:{action:'CHOOSE_JOURNEY',journeyIntent:'open-road'}},
    {id:'pact-shared',nodeId:'mountain-pact-choice',label:'请二郎神共同承山',payload:{action:'CHOOSE_PACT',mountainPact:'shared'}},
    {id:'pact-self',nodeId:'mountain-pact-choice',label:'由我独自承山，承担永久化为山影的代价',payload:{action:'CHOOSE_PACT',mountainPact:'self'}},
    {id:'final-wait',nodeId:'ending-choice',label:'暂缓最后一斧，留灯相守',payload:{action:'CHOOSE_FINAL_ACTION',finalAction:'wait'}},
    {id:'final-fulfill',nodeId:'ending-choice',label:story?.choices?.mountainPact==='self'?'由我永久化为山影，换母亲自由':'请二郎神一起稳山，再解开封印',payload:{action:'CHOOSE_FINAL_ACTION',finalAction:'fulfill'}},
  ];
}
