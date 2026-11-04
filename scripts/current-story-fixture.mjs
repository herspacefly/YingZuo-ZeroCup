// Isolated synthetic projects for browser diagnostics. Never reads user storage.
import {readFileSync} from 'node:fs';
const definition=JSON.parse(readFileSync(new URL('../src/content/stories/reunion.json',import.meta.url),'utf8'));
const presets={
  home:{journeyIntent:'home',mountainPact:'shared',approach:'call-first',finalAction:'fulfill'},
  light:{journeyIntent:'open-road',mountainPact:'shared',approach:'call-first',finalAction:'fulfill'},
  road:{journeyIntent:'home',mountainPact:'shared',approach:'split-first',finalAction:'fulfill'},
  waiting:{journeyIntent:'home',mountainPact:'shared',approach:'call-first',finalAction:'wait'},
  sacrifice:{journeyIntent:'home',mountainPact:'self',approach:'call-first',finalAction:'fulfill'},
};
export function fixtureChoices(ending='home'){
  if(!Object.hasOwn(presets,ending))throw new Error('Unknown fixture ending '+ending);
  return {...presets[ending]};
}
export function currentStoryFixture(nodeId='intro',options={}){
  const ending=options.ending??(nodeId.startsWith('ending-')&&nodeId!=='ending-choice'?nodeId.split('-')[1]:nodeId.startsWith('reunion-')?'home':undefined);
  const selected={...fixtureChoices(ending),...(nodeId.startsWith('split-')&&!ending?{approach:'split-first'}:{}),...options};
  const resolved=selected.finalAction==='wait'?'waiting':selected.mountainPact==='self'?'sacrifice':selected.approach==='split-first'?'road':selected.journeyIntent==='home'?'home':'light';
  if(ending&&ending!==resolved)throw new Error('Fixture ending disagrees with cumulative choices');
  const appearance={templateId:'chenxiang-v1',patternId:'wave-v1',paletteId:'indigo-v1',colorSlots:{body:0,sleeve:1,hem:2},carvedSegments:[true,true,false]};
  const project={schemaVersion:1,assetVersion:1,appVersion:'0.0.1',projectId:'diagnostic-project',title:'灯下等你',savedAt:'2026-11-04T00:00:00.000Z',saveRevision:0,writerId:'diagnostic-writer',appearance,
    stage:{backgroundId:'plain-v1',lampX:.1,puppetDistance:.2},pose:{x:.5,y:.55,scale:.8,facing:1,joints:{head:0,leftShoulder:0,leftElbow:0,rightShoulder:0,rightElbow:0,leftHip:0,leftKnee:0,rightHip:0,rightKnee:0}},
    story:{storyId:'reunion',definitionVersion:5,runId:options.runId??'diagnostic-run',revision:0,mode:options.mode??'guided',nodeId:'intro',approach:null,approachSource:null,castSnapshot:null,assistedNodeIds:[],presetAppearanceUsed:false,completedAt:null,ending:null,endingSource:null,choices:{journeyIntent:null,mountainPact:null,finalAction:null}},
    museum:{visitedExhibitIds:[]},performance:null,partialRecording:null,lastRoute:'/story'};
  const story=project.story,seen=new Set();
  while(story.nodeId!==nodeId){
    const node=definition.nodes.find(row=>row.id===story.nodeId);
    if(!node||!node.next||seen.has(node.id))throw new Error('Fixture checkpoint is unreachable with these choices: '+nodeId);
    seen.add(node.id);
    if(node.id==='craft')story.castSnapshot={appearance:structuredClone(appearance),sharedMotif:appearance.patternId,motherPaletteId:'mother-v1',guardianPaletteId:'guardian-v1',assetVersion:1};
    if(node.id==='journey-choice')story.choices.journeyIntent=selected.journeyIntent;
    if(node.id==='mountain-pact-choice')story.choices.mountainPact=selected.mountainPact;
    if(node.id==='approach-choice'){story.approach=selected.approach;story.approachSource='user';}
    if(node.id==='ending-choice'){story.choices.finalAction=selected.finalAction;story.ending=resolved;story.endingSource='choices';}
    story.nodeId='default' in node.next?node.next.default:node.next[node.id==='ending-choice'?resolved:selected.approach];story.revision++;
    if(story.nodeId==='curtain')story.completedAt='2026-11-04T00:00:00.000Z';
  }
  return project;
}
