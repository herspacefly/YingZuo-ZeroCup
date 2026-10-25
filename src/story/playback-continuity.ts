export interface PlaybackPosition {projectId:string;runId:string;revision:number;nodeId:string}
const runKey=(position:PlaybackPosition)=>JSON.stringify([position.projectId,position.runId]);
/** A one-use handoff within this mounted performance; never serialized or restored. */
export function createPlaybackContinuity(){
  let run='',ticket:PlaybackPosition|null=null;
  return{
    start(position:PlaybackPosition){run=runKey(position);ticket=null;},
    resumeHere(position:PlaybackPosition){run=runKey(position);ticket={...position};},
    handoff(position:PlaybackPosition,nodeId:string){if(run===runKey(position))ticket={...position,revision:position.revision+1,nodeId};},
    active(position:PlaybackPosition){return run===runKey(position);},
    pending(){return ticket!==null;},
    consume(position:PlaybackPosition){if(!ticket||run!==runKey(position)||ticket.projectId!==position.projectId||ticket.runId!==position.runId||ticket.revision!==position.revision||ticket.nodeId!==position.nodeId)return false;ticket=null;return true;},
    stop(){run='';ticket=null;},
  };
}
