import { mountLimbControls } from '../shared/limb-controls';
import { createAnimationClock } from '../../app/animation-clock';
import { append, element, link, scope } from '../shared/dom';
import { editable, heading, pageLinks, paletteLabel } from '../shared/pieces';
import { canvasStage, editorFrame } from '../shared/canvas-stage';
import { mountCraftBodyRod } from './body-rod';
import { archiveForRehearsal, confirmCraft } from '../../app/craft-commands';
import { newIdentifier } from '../../app/identity';
import { storyGuard } from '../../domain/story';
import { constrainPoseToStage } from '../../domain/pose';
import { moveRodBy } from '../../domain/rod-input';
import { assetCatalog } from '../../content/catalog';
import type { PageFactory } from '../../app/view';
import type { StoreState } from '../../app/store';
import type { PaletteId, Pose, StageConfig } from '../../domain/types';
import palettes from '../../content/palettes.json';

const template=assetCatalog.puppets.find(item=>item.id==='chenxiang-v1')!;
const colorNames:Record<string,string>={'#B83B30':'朱红','#D7A253':'金黄','#314C58':'靛青','#17130F':'墨黑','#F2E5C9':'米白','#8BA6A4':'青灰','#4F6B49':'苔绿','#A26A42':'赭棕'};
export const mountCraft:PageFactory=(host,ctx)=>{
  const life=scope();append(host,heading('先备行装','给远行的人，备一身衣色。','保留影偶原画的细密刻纹，选择一套颜色；再牵一牵手脚，看看这身行装怎样走上舞台。'),pageLinks());
  const layout=element('section','workspace craft-workspace'),stage=canvasStage('为沉香选好行装，再试着牵动他的手脚。');
  const panel=element('div','control-panel'),field=element('fieldset');field.appendChild(element('legend','','沉香的行装'));
  const palette=element('select');palette.id='craft-palette';
  for(const p of palettes.palettes.filter(item=>item.editable)){const option=element('option','',p.label);option.value=p.id;palette.appendChild(option);}
  const paletteLabelNode=element('label','','这一套颜色');append(paletteLabelNode,palette);
  const apply=element('button','button secondary','采用这套配色');apply.id='craft-apply-palette';
  const colorToggle=element('button','button secondary','分别给衣身、袖、下摆着色');colorToggle.setAttribute('aria-expanded','false');colorToggle.setAttribute('aria-controls','craft-colors');
  const colors=element('div');colors.id='craft-colors';colors.hidden=true;const slots=new Map<'body'|'sleeve'|'hem',HTMLSelectElement>();
  for(const [slot,label]of [['body','衣身颜色'],['sleeve','袖的颜色'],['hem','下摆颜色']] as const){
    const group=element('label','',label),select=element('select');select.id=`craft-${slot}`;select.setAttribute('aria-label',label);for(let i=0;i<5;i++){const option=element('option');option.value=String(i);select.appendChild(option);}group.appendChild(select);colors.appendChild(group);slots.set(slot,select);
    life.on(select,'change',()=>{if(allowed())ctx.edit({type:'COLOR_SLOT',slot,colorIndex:Number(select.value)});});
  }
  const swatches=element('div','palette-swatches');swatches.setAttribute('aria-hidden','true');
  const summary=element('p','selection-summary'),save=element('button','button secondary','保存这身行装');summary.id='craft-summary';
  append(field,paletteLabelNode,swatches,apply,colorToggle,colors);append(panel,field,summary,save);
  const confirmation=element('section','craft-confirmation'),confirmationText=element('p','quiet-note'),mode=element('select');mode.id='craft-mode';
  for(const [value,label]of [['full','完整演出'],['guided','节选导览']]){const option=element('option','',label);option.value=value!;mode.appendChild(option);}
  const modeLabel=element('label','','新场的节奏');modeLabel.appendChild(mode);
  const play=element('button','button primary','用这身行装开演'),preset=element('button','button secondary','采用默认影偶开演');play.id='craft-confirm';preset.id='craft-preset';
  const restart=element('button','button secondary','归档旧场，用新造型重新开演');restart.id='craft-restart';
  const acknowledgeLabel=element('label','acknowledge'),acknowledge=element('input');acknowledge.type='checkbox';acknowledge.id='craft-archive-ack';append(acknowledgeLabel,acknowledge,element('span','','允许替换已有的上一项目（可先导出）'));
  const back=link('继续本场已冻结的演出 →','#/story');back.id='craft-return';
  const next=element('button','button primary journey-recommended','保存行装，下一步调灯 →');next.id='journey-to-light';const nextBox=element('section','journey-next');append(nextBox,element('p','','第2步 / 制偶：挑好喜欢的颜色，就可以继续调灯。现在只保存编辑稿，正式开演时再确认本场造型。'),next);panel.appendChild(nextBox);
  append(confirmation,confirmationText,modeLabel,play,preset,back,restart,acknowledgeLabel);panel.appendChild(confirmation);
  append(layout,stage.figure,panel);host.appendChild(layout);
  const trial=element('div','craft-trial'),trialHelp=element('p','quiet-note','试提身杆：拖动幕下握柄，或聚焦后用方向键。这里的试提可重置，不改练习台存下的姿态。');
  const trialPad=element('div','direction-pad');trialPad.setAttribute('role','group');trialPad.setAttribute('aria-label','试提身杆逐步操作');
  for(const [label,delta]of [['身杆向左',{x:-.025,y:0}],['身杆向上',{x:0,y:.025}],['身杆向下',{x:0,y:-.025}],['身杆向右',{x:.025,y:0}]] as const){const button=element('button','',label);trialPad.appendChild(button);life.on(button,'click',()=>{if(bodyModel&&canTry()){const fit=moveRodBy(template,bodyModel.pose,bodyModel.stage,'body',delta);if(fit.fits){trialPose=fit.pose;render();}}});}
  const resetTrial=element('button','button secondary','重置试提');life.on(resetTrial,'click',()=>{trialPose=null;render();});append(trial,trialHelp,trialPad,resetTrial);stage.figure.appendChild(trial);
  let state:StoreState|null=null,trialPose:Pose|null=null,projectId='',disposed=false,bodyModel:{pose:Pose;stage:StageConfig}|null=null;
  const body=mountCraftBodyRod(stage,pose=>{trialPose=pose;render();},()=>clock.start());
  const allowed=()=>!!state&&editable(state)&&!ctx.isBusy();
  const canTry=()=>allowed()&&!state!.hasPending&&stage.getStatus().state==='ready';
  function syncControls(){
    body.update(bodyModel,canTry());const advance=allowed()&&!state!.hasPending&&state!.status!=='saving'&&stage.getStatus().state==='ready';
    play.disabled=preset.disabled=restart.disabled=mode.disabled=acknowledge.disabled=next.disabled=!advance;
    trialPad.querySelectorAll('button').forEach(button=>{button.disabled=!canTry();});resetTrial.disabled=!canTry();
  }
  const direct=mountLimbControls(stage,{read(){const draft=ctx.store.getExportProject()??state?.project;if(!draft||!bodyModel)return null;return {frame:{actors:[{actorId:'chenxiang',templateId:'chenxiang-v1',appearance:draft.appearance,pose:bodyModel.pose}],stage:bodyModel.stage},enabled:canTry()};},change(pose){trialPose=pose;render();},wake(){clock.start();},end(){if(!stage.cables.active)clock.stop();},report(text){trialHelp.textContent=text;}});
  const clock=createAnimationClock({request:cb=>requestAnimationFrame(cb),cancel:id=>cancelAnimationFrame(id),now:()=>performance.now()},delta=>{direct.tick(delta);body.render();return canTry()&&direct.isActive();},()=>{direct.release();body.render();},stage.frameObserver);
  const offStatus=stage.subscribe(()=>{syncControls();direct.render();});
  function render(){
    if(disposed||!state)return;const draft=ctx.store.getExportProject()??state.project,story=state.project?.story;
    field.disabled=!allowed();save.disabled=!allowed()||state.hasPending||state.status==='saving';
    if(!draft){stage.update(null);bodyModel=null;body.update(null,false);summary.textContent='请先处理作品存档，再继续制作。';play.disabled=preset.disabled=restart.disabled=true;return;}
    if(draft.projectId!==projectId){trialPose=null;projectId=draft.projectId;}
    let frame;
    try {frame=editorFrame(draft,true,true);if(trialPose){const fit=constrainPoseToStage(trialPose,template,frame.stage);if(fit.fits)frame.actors[0]!.pose=fit.pose;}}
    catch(error){bodyModel=null;body.update(null,false);stage.update(()=>{throw error;});return;}
    bodyModel={pose:frame.actors[0]!.pose,stage:frame.stage};stage.update(frame);body.update(bodyModel,canTry());
    palette.value=draft.appearance.paletteId;
    const selected=palettes.palettes.find(item=>item.id===draft.appearance.paletteId)!;
    for(const [slot,select]of slots){for(let i=0;i<5;i++)select.options[i]!.textContent=colorNames[selected.colors[i]!]!;select.value=String(draft.appearance.colorSlots[slot]);}
    while(swatches.firstChild)swatches.removeChild(swatches.firstChild);for(const color of selected.colors){const span=element('span','swatch');span.style.backgroundColor=color;swatches.appendChild(span);}
    summary.textContent=`${paletteLabel(palette.value)}。${state.hasPending&&draft.story?.castSnapshot?'待保存的本场造型已冻结；后续修改排队到编辑稿，不改候选演出。':story?.castSnapshot?'这是编辑稿；本场已冻结的造型保持不变。':'保留原画的精细纹理；确认开演前还可以修改配色。'}`;
    const frozen=!!story?.castSnapshot;nextBox.hidden=!!story;play.className=story?'button primary':'button secondary';
    modeLabel.hidden=!!story;play.hidden=preset.hidden=frozen;
    back.hidden=!story;restart.hidden=acknowledgeLabel.hidden=!frozen;
    back.textContent=frozen?'继续本场已冻结的演出 →':'回到当前剧情 →';
    confirmationText.textContent=frozen?'本场已冻结。继续会使用原造型；归档重开会保留现在的编辑稿并建立新项目，随后由你确认新场。':'推荐先调灯、练习，再正式开演。也可以在此直接确认造型并进入第一幕；采用默认影偶会标为预设造型。';
    syncControls();direct.render();
  }
  life.on(palette,'change',()=>{if(allowed())ctx.edit({type:'PALETTE',paletteId:palette.value as PaletteId});});
  life.on(apply,'click',()=>{if(allowed())ctx.edit({type:'APPLY_PALETTE',paletteId:palette.value as PaletteId});});
  life.on(colorToggle,'click',()=>{colors.hidden=!colors.hidden;colorToggle.setAttribute('aria-expanded',String(!colors.hidden));});
  life.on(save,'click',()=>{if(allowed()&&!state!.hasPending)void ctx.run(()=>ctx.store.flush());});
  function open(presetAppearanceUsed:boolean){
    if(!allowed()||state!.hasPending)return;const story=ctx.store.getState().project?.story;if(story?.castSnapshot)return;
    void ctx.durable(()=>confirmCraft(ctx.store,{runId:story?.runId??newIdentifier('run'),mode:mode.value as 'full'|'guided',presetAppearanceUsed,guard:story?storyGuard(story):null,now:new Date().toISOString()}),{path:'/story',exhibitId:null});
  }
  life.on(next,'click',()=>{if(allowed()&&!state!.hasPending)void ctx.durable(()=>ctx.store.flush(),{path:'/light',exhibitId:null});});
  life.on(play,'click',()=>open(false));life.on(preset,'click',()=>open(true));
  life.on(restart,'click',()=>{if(allowed()&&!state!.hasPending)void ctx.durable(()=>archiveForRehearsal(ctx.store,acknowledge.checked),{path:'/craft',exhibitId:null});});
  return {update(next){state=next;render();},dispose(){disposed=true;offStatus();clock.dispose();direct.dispose();body.dispose();life.dispose();stage.dispose();}};
};
