import type {Approach,EndingId,FinalAction,JourneyIntent,MountainPact} from '../../src/domain/types';
export interface ChoiceRun {journeyIntent:JourneyIntent;mountainPact:MountainPact;approach:Approach;finalAction:FinalAction;ending:EndingId}
const continuing:readonly [JourneyIntent,MountainPact,Approach,EndingId][]=[
 ['home','shared','call-first','home'],['open-road','shared','call-first','light'],
 ['home','shared','split-first','road'],['open-road','shared','split-first','road'],
 ['home','self','call-first','sacrifice'],['open-road','self','call-first','sacrifice'],
 ['home','self','split-first','sacrifice'],['open-road','self','split-first','sacrifice'],
];
export const CHOICE_RUNS:ChoiceRun[]=continuing.flatMap(([journeyIntent,mountainPact,approach,ending])=>[
 {journeyIntent,mountainPact,approach,finalAction:'wait' as const,ending:'waiting' as const},
 {journeyIntent,mountainPact,approach,finalAction:'fulfill' as const,ending},
]);
