import { assetCatalog } from '../../content/catalog';
import { sampleAction } from '../../domain/actions';
import type { ProjectV1 } from '../../domain/types';
import { canvasStage } from '../shared/canvas-stage';
import { append, element, scope } from '../shared/dom';
import { museumPreviewFrame } from './demo-geometry';

/** Two explicit stills of the existing wave, so the collaboration diagram needs no second clock. */
export function mountMuseumEnsemble(host:HTMLElement){
  const life=scope(),layout=element('div','workspace'),panel=element('div','control-panel');
  const stage=canvasStage('同一次招手的两个动作时刻 · 本作数字操偶示意，当前为静音。');
  const toggle=element('button','button secondary','看抬手的时刻'),reading=element('p','selection-summary');
  toggle.id='museum-wave-toggle';toggle.type='button';toggle.setAttribute('aria-pressed','false');reading.id='museum-wave-reading';reading.setAttribute('role','status');
  append(panel,element('h2','','从同一个招手，看配合。'),toggle,reading,element('p','quiet-note','点按切换静止画面。沿下方四种职责，看幕前动作与幕后的配合。'));append(layout,stage.figure,panel);host.appendChild(layout);
  let project:ProjectV1|null=null,identity='',raised=false,disposed=false;
  function render(){
    if(disposed)return;
    stage.update(()=>{
      const frame=museumPreviewFrame(project),actor=frame.actors[0]!,template=assetCatalog.puppets.find(item=>item.id===actor.templateId)!;
      const action=sampleAction('wave-v1',actor.pose,raised?600:0,template,frame.stage);
      if(!action.fits)throw new Error('招手示例暂时超出幕面，请重试。');
      return {...frame,actors:[{...actor,pose:action.pose}],showRods:true};
    });
    toggle.setAttribute('aria-pressed',String(raised));toggle.textContent=raised?'看抬手前的时刻':'看抬手的时刻';reading.textContent=raised?'右臂抬起，手杆与关节一起改变。':'抬手之前，影偶与操纵杆保持静止。';
  }
  life.on(toggle,'click',()=>{raised=!raised;render();});render();
  return {
    update(next:ProjectV1|null){if(disposed)return;const key=JSON.stringify([next?.projectId,next?.story?.runId,next?.story?.castSnapshot?.appearance]);if(key===identity)return;identity=key;project=next;raised=false;render();},
    dispose(){if(disposed)return;disposed=true;life.dispose();stage.dispose();},
  };
}
