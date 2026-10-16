import type { StoryDefinition,StoryNode } from '../domain/story-types';
import type { PuppetTemplate, SceneDefinition } from './asset-types';

export interface StoryReferences { nodeIds: readonly string[]; jointIds: readonly string[]; sourceIds: string[]; assetIds: string[]; puppets: PuppetTemplate[]; scenes: SceneDefinition[] }
export function subtitlesForMode(node:StoryNode,mode:'full'|'guided') {
  const ratio=mode==='full'?1:node.fullTiming.targetMs>0?node.guidedTiming.targetMs/node.fullTiming.targetMs:0;
  return node.subtitles.map(cue=>({...cue,startMs:cue.startMs*ratio,endMs:cue.endMs*ratio}));
}
// Shared repository config checker; erasable TS, with no runtime imports for Node 24.
export function validateStoryDefinition(definition: StoryDefinition,refs: StoryReferences): string[] {
  const errors:string[]=[];const check=(ok: unknown,message: string)=>{if(!ok)errors.push(message);};
  const finite=(v: number,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number' && Number.isFinite(v) && v>=min && v<=max;
  const same=(a: readonly string[],b: readonly string[])=>[...a].sort().join(',')===[...b].sort().join(',');
  try {
    check(definition.storyId==='reunion' && definition.definitionVersion===1 && definition.assetVersion===1 && definition.startNodeId==='intro','story identity/version');
    check(!!definition.title && !!definition.adaptationCredit,'adaptation credit missing');
    check(definition.subtitleTimebase==='full-target-ms','subtitle timebase must be explicit');
    check(same(definition.nodes.map(n=>n.id),refs.nodeIds),'exact 18 story nodes required');
    const expected:Record<string,string|Record<string,string>|null>={intro:'craft',craft:'memory-wave','memory-wave':'memory-separate','memory-separate':'road',road:'training',training:'guardian',guardian:'approach-choice','approach-choice':{'call-first':'call-light','split-first':'split-axe'},'call-light':'call-response','call-response':'call-split','call-split':'reunion-reach','split-axe':'split-search','split-search':'split-response','split-response':'reunion-reach','reunion-reach':'reunion-hold','reunion-hold':'curtain',curtain:'completed',completed:null};
    const kinds:Record<string,string>={intro:'cinematic',craft:'interaction','memory-wave':'interaction','memory-separate':'cinematic',road:'interaction',training:'cinematic',guardian:'interaction','approach-choice':'choice','call-light':'interaction','call-response':'cinematic','call-split':'interaction','split-axe':'interaction','split-search':'interaction','split-response':'cinematic','reunion-reach':'interaction','reunion-hold':'cinematic',curtain:'curtain',completed:'terminal'};
    const completionKinds:Record<string,string>={craft:'craft','memory-wave':'wave',road:'road',guardian:'block','call-light':'light','call-split':'axe','split-axe':'axe','split-search':'light','reunion-reach':'reach','approach-choice':'choice',completed:'terminal'};
    for(const node of definition.nodes) {
      const id=node.id;
      check(node.kind===kinds[id] && node.completion.kind===(completionKinds[id]??'scene'),`node kind/completion ${id}`);
      check(!!node.title && !!node.lead && node.contentKind==='original-adaptation' && Number.isInteger(node.act) && finite(node.act,0,4),`node prose/act ${id}`);
      const edge=expected[id],wanted=typeof edge==='string'?{default:edge}:edge;
      check(JSON.stringify(node.next)===JSON.stringify(wanted),`story edge ${id}`);
      const actions=node.kind==='terminal'?['SET_MODE']:['SET_MODE',node.kind==='choice'?'CHOOSE':node.kind==='interaction'?'COMPLETE_INTERACTION':'COMPLETE_SCENE'];
      check(same(node.allowedActions,actions),`allowed actions ${id}`);
      check(node.actors.length<=2 && new Set(node.actors).size===node.actors.length && node.actors.includes('chenxiang') && node.actors.every(actor=>['chenxiang','mother','guardian'].includes(actor)),`actor whitelist/count ${id}`);
      const withMother=['intro','memory-wave','memory-separate','call-light','call-response','split-search','split-response','reunion-reach','reunion-hold','curtain','completed'].includes(id);
      check(same(node.actors,withMother?['chenxiang','mother']:id==='guardian'?['chenxiang','guardian']:['chenxiang']),`story cast ${id}`);
      check(same(Object.keys(node.entryPoses),node.actors),`entry actors/poses ${id}`);
      const expectedApproach=id.startsWith('call-')?'call-first':id.startsWith('split-')?'split-first':null;
      check(node.prerequisites.approach===expectedApproach && node.prerequisites.frozenCast===!['intro','craft'].includes(id),`prerequisites ${id}`);
      for(const actor of node.actors) {
        const template=refs.puppets.find(t=>t.id===`${actor}-v1`),pose=node.entryPoses[actor];
        check(template && pose && finite(pose.x,0,1) && finite(pose.y,0,1) && finite(pose.scale,.6,1) && [1,-1].includes(pose.facing),`entry pose ${id}/${actor}`);
        if(template && pose) {
          check(same(Object.keys(pose.joints),refs.jointIds),`nine entry joints ${id}/${actor}`);
          for(const joint of template.joints) check(finite(pose.joints[joint.jointId],joint.minRad,joint.maxRad) && (joint.enabled || pose.joints[joint.jointId]===0),`entry joint limits ${id}/${actor}/${joint.jointId}`);
          const required=template.parts.flatMap(part=>[part.maskAssetId,part.colorAssetId,part.colorMapAssetId]);
          check(required.every(asset=>node.assetIds.includes(asset)),`missing actor part assets ${id}/${actor}`);
        }
      }
      const attachmentKeys=node.entryAttachments.map(a=>`${a.actorId}/${a.attachmentId}`);
      const expectedAttachments=id==='guardian'?['guardian/staff']:['training','call-split','split-axe'].includes(id)?['chenxiang/axe']:[];
      check(same(attachmentKeys,expectedAttachments),`story attachments ${id}`);
      for(const attachment of node.entryAttachments) {
        const template=refs.puppets.find(t=>t.id===`${attachment.actorId}-v1`),prop=template?.attachments.find(p=>p.id===attachment.attachmentId);
        check(node.actors.includes(attachment.actorId) && prop && node.assetIds.includes(prop.assetId),`attachment resource ${id}/${attachment.attachmentId}`);
      }
      check(new Set(node.assetIds).size===node.assetIds.length && node.assetIds.every(asset=>refs.assetIds.includes(asset)),`asset reference ${id}`);
      check(node.sourceIds.length>0 && new Set(node.sourceIds).size===node.sourceIds.length && node.sourceIds.every(source=>refs.sourceIds.includes(source)),`source reference ${id}`);
      const scene=refs.scenes.find(s=>s.id===node.entryStage.backgroundId);
      check(scene && finite(node.entryStage.lampX,-.8,.8) && finite(node.entryStage.puppetDistance,.05,.4),`entry stage ${id}`);
      if(scene) {
        check(same(node.entrySceneLayers.map(layer=>layer.id),scene.layers.map(layer=>layer.id)),`entry scene layer set ${id}`);
        for(const layer of node.entrySceneLayers) {
          const allowed=scene.layers.find(l=>l.id===layer.id);
          check(allowed && Object.keys(layer).sort().join(',')==='id,opacity,x,y' && finite(layer.x,...allowed.xRange) && finite(layer.y,...allowed.yRange) && finite(layer.opacity,...allowed.opacityRange),`entry scene params ${id}/${layer.id}`);
          if(allowed)check(node.assetIds.includes(allowed.assetId),`missing layer asset ${id}/${layer.id}`);
          if(scene.id==='mountain-v1' && ['mountain-left','mountain-right'].includes(layer.id)) {
            const opened=['split-search','split-response','reunion-reach','reunion-hold'].includes(id);
            check(layer.x===(opened?(layer.id==='mountain-left'?-.55:.55):0) && layer.opacity===1,`branch mountain state ${id}/${layer.id}`);
          }
        }
      }
      for(const timing of [node.fullTiming,node.guidedTiming])check(finite(timing.targetMs) && finite(timing.minDurationMs,0,timing.targetMs),`node timing ${id}`);
      check(node.guidedTiming.targetMs<=node.fullTiming.targetMs,`guided timing ${id}`);
      if(['cinematic','curtain'].includes(node.kind))check(node.fullTiming.minDurationMs>=4000 && node.fullTiming.targetMs<=20000 && node.guidedTiming.minDurationMs>=4000,`short scene duration ${id}`);
      for(const cue of node.subtitles)check(finite(cue.startMs,0,node.fullTiming.targetMs) && finite(cue.endMs,cue.startMs,node.fullTiming.targetMs) && cue.endMs>cue.startMs && cue.text && ['narrator',...node.actors].includes(cue.speaker) && cue.contentKind==='original-adaptation',`subtitles ${id}`);
      for(const cue of subtitlesForMode(node,'guided'))check(finite(cue.startMs,0,node.guidedTiming.targetMs) && finite(cue.endMs,cue.startMs,node.guidedTiming.targetMs),`mapped guided subtitles ${id}`);
      const c=node.completion;
      if('target' in c)check(finite(c.target.x,0,1) && finite(c.target.y,0,1) && finite(c.target.width,Number.EPSILON,1-c.target.x) && finite(c.target.height,Number.EPSILON,1-c.target.y),`normalized target ${id}`);
      if('overlapRatio' in c)check(c.overlapRatio===.35 && finite(c.holdMs,0,2000),`overlap threshold ${id}`);
      if(c.kind==='light')check(c.holdMs===600,`light hold ${id}`);
      if(c.kind==='axe')check(c.holdMs===500 && c.raisedAngleRange.length===2 && c.landedAngleRange.length===2 && c.raisedAngleRange.every(v=>finite(v,-1.4,1.8)) && c.landedAngleRange.every(v=>finite(v,-1.4,1.8)) && c.raisedAngleRange[0]<c.raisedAngleRange[1] && c.landedAngleRange[0]<c.landedAngleRange[1],`axe hold/angles ${id}`);
      if(c.kind==='reach')check(c.maxDistanceRatio===.04 && c.maxSnapRatio===.02,`reach/snap thresholds ${id}`);
      if(c.kind==='scene')check(c.activation===(id==='reunion-hold'?'user':'automatic') && c.skippable===(id==='intro'),`scene activation ${id}`);
      if(id==='reunion-hold')check(node.fullTiming.minDurationMs>=4000 && node.guidedTiming.minDurationMs>=4000,`quiet hold ${id}`);
    }
    // Trace each permitted choice, independently of array order; detect cycles/dead nodes.
    const reachable=new Set<string>();
    for(const approach of ['call-first','split-first'] as const) {
      const seen=new Set<string>();let id:string='intro';
      while(true) {
        const node=definition.nodes.find(n=>n.id===id);
        if(!node || seen.has(id)){check(false,`dead/cyclic ${approach}/${id}`);break;}
        seen.add(id);reachable.add(id);
        if(node.next===null){check(node.id==='completed',`premature terminal ${id}`);break;}
        id='default' in node.next?node.next.default:node.next[approach];
      }
      check(seen.size===15 && seen.has('curtain') && seen.has('reunion-reach'),`complete path ${approach}`);
    }
    check(reachable.size===18,'unreachable story nodes');
  } catch(error){errors.push(`malformed story config: ${error instanceof Error?error.message:String(error)}`);}
  return errors;
}
