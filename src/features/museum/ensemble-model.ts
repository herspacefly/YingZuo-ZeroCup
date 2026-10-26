export const ENSEMBLE_ROLES=['puppet','voice','beat','light'] as const;
export type EnsembleRole=typeof ENSEMBLE_ROLES[number];
export type EnsembleScore=Record<EnsembleRole,{enabled:boolean;delay:number}>;
export const ENSEMBLE_DURATION=6400;
export function defaultEnsembleScore():EnsembleScore{return {puppet:{enabled:true,delay:0},voice:{enabled:true,delay:0},beat:{enabled:true,delay:0},light:{enabled:true,delay:0}};}
export function sampleEnsemble(score:EnsembleScore,time:number){
  const t=Number.isFinite(time)?Math.max(0,Math.min(ENSEMBLE_DURATION,time)):0;
  const active=(role:EnsembleRole)=>score[role].enabled&&t>=1000+score[role].delay;
  const local=(role:EnsembleRole)=>Math.max(0,t-1000-score[role].delay);
  return {time:t,finished:t>=ENSEMBLE_DURATION,poseTime:active('puppet')?Math.min(1800,local('puppet')):0,
    caption:active('voice')?(local('voice')<1900?'沉香：娘，你看见这盏灯了吗？':'母亲：看见了。你伸手，我就在这里。'):'',
    lit:active('light'),beat:active('beat')&&local('beat')%1000<320,active:ENSEMBLE_ROLES.filter(active)};
}
