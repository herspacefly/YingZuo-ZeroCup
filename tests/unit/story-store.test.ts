import { IDBFactory,IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { ProjectStore } from '../../src/app/store';
import { startStory,submitStoryCommand } from '../../src/app/story-commands';
import { ProjectStorage,decodeStoredProject } from '../../src/persistence/storage';
import { storyGuard,reunionSummary } from '../../src/domain/story';
import { exportProjectJSON,importProjectJSON } from '../../src/persistence/project-file';
import type { ProjectV1 } from '../../src/domain/types';
import { NOW,at,commandFor } from '../helpers/story';

const stores:ProjectStore[]=[],storages:ProjectStorage[]=[];
async function open(seed?:ProjectV1){
  let wall=NOW;const factory=new IDBFactory(),storage=new ProjectStorage(factory,{writerId:'writer-test',now:()=>wall});storages.push(storage);
  if(seed)await storage.save(seed,null);
  const store=await ProjectStore.open(storage,{writerId:'writer-test',createId:()=> 'project-store',now:()=>wall});stores.push(store);
  return {store,storage,factory,later:()=>{wall='2026-10-17T14:00:00.000Z';}};
}
const context={paused:false,elapsedMs:20000,now:NOW};
function failNextDraft(){
  const original=FakeObjectStore.prototype.put;let pending=true;
  vi.spyOn(FakeObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key){if(pending&&key==='draft'){pending=false;throw new DOMException('Quota exceeded','QuotaExceededError');}return original.call(this,value,key);});
}
afterEach(()=>{vi.restoreAllMocks();stores.splice(0).forEach(s=>s.dispose());storages.splice(0).forEach(s=>s.close());});
describe('STORY-07 guarded commands through the real Store/IDB boundary',()=>{
  it('serializes repeated start and choice commands into one saved identity and one decision',async()=>{
    const {store,storage}=await open();
    await Promise.all([startStory(store,'run-first','full'),startStory(store,'run-duplicate','guided')]);
    expect(store.getState().project!.story).toMatchObject({definitionVersion:5,runId:'run-first',mode:'full',nodeId:'intro',choices:{journeyIntent:null,mountainPact:null,finalAction:null}});
    const choice=at('approach-choice');const seeded=await open(choice),cmd=commandFor(seeded.store.getState().project!,'split-first');
    const before=seeded.store.getState().project!.saveRevision;
    await Promise.all([submitStoryCommand(seeded.store,cmd,context),submitStoryCommand(seeded.store,cmd,context)]);
    expect(seeded.store.getState().project!.saveRevision).toBe(before+1);
    expect(decodeStoredProject((await seeded.storage.readRaw()).draft).story).toMatchObject({approach:'split-first',nodeId:'split-axe'});
    expect(decodeStoredProject((await storage.readRaw()).draft).story!.runId).toBe('run-first');
  });
  it('freezes queue-time appearance and cannot overwrite the cast with later draft edits',async()=>{
    const {store,storage}=await open(at('craft'));
    await store.edit({type:'PATTERN',patternId:'flower-v1'});await store.edit({type:'PALETTE',paletteId:'indigo-v1'});
    await submitStoryCommand(store,commandFor(store.getState().project!),context);
    await store.edit({type:'PALETTE',paletteId:'woodland-v1'});await store.flush();
    const restored=decodeStoredProject((await storage.readRaw()).draft);
    expect(restored.appearance.paletteId).toBe('woodland-v1');expect(restored.story!.castSnapshot!.appearance).toMatchObject({patternId:'flower-v1',paletteId:'indigo-v1'});
  });
  it('keeps failed reunion out of applied/durable state and retries the same candidate time/result',async()=>{
    const {store,storage,later}=await open(at('reunion-hold')),before=await storage.readRaw();failNextDraft();
    expect(await submitStoryCommand(store,commandFor(store.getState().project!),context)).toMatchObject({ok:false});
    expect(store.getState()).toMatchObject({hasPending:true,project:{story:{nodeId:'reunion-hold',completedAt:null}}});
    expect(await storage.readRaw()).toEqual(before);
    const exported=importProjectJSON(exportProjectJSON(store.getExportProject()!));expect(exported.story).toMatchObject({nodeId:'curtain',completedAt:NOW});
    expect(await submitStoryCommand(store,commandFor(store.getState().project!),context)).toMatchObject({ok:false});
    later();await store.retryPending();const committed=store.getState().project!;
    expect(reunionSummary(committed)).toMatchObject({id:'run-test:reunion',completedAt:NOW});
    const restored=(await storage.load()).project!;expect(restored.story!.runId).toBe('run-test');
    expect(restored.story!.completedAt).toBe(NOW);expect(restored.story!.nodeId).toBe('curtain');
  });
  it('keeps a failed branch explicit, with cancel and acknowledged memory continuation',async()=>{
    const {store,storage}=await open(at('approach-choice'));failNextDraft();
    await submitStoryCommand(store,commandFor(store.getState().project!,'split-first'),context);
    expect(store.getState().project!.story!.approach).toBeNull();expect(store.getExportProject()!.story!.approach).toBe('split-first');
    await store.cancelPending();expect(store.getState().project!.story!.nodeId).toBe('approach-choice');
    vi.restoreAllMocks();failNextDraft();await submitStoryCommand(store,commandFor(store.getState().project!,'call-first'),context);
    await store.continuePendingUnsaved();expect(store.getState()).toMatchObject({status:'memory',project:{story:{nodeId:'call-light',approach:'call-first'}}});
    expect(decodeStoredProject((await storage.readRaw()).draft).story).toMatchObject({nodeId:'approach-choice',approach:null});
  });
  it('persists a paused mode change with fresh revision while old scene callbacks never write',async()=>{
    const {store,storage}=await open(at('call-response')),before=store.getState().project!,old=commandFor(before);
    await submitStoryCommand(store,{...storyGuard(before.story!),action:'SET_MODE',mode:'guided'},{...context,paused:true});
    const revision=store.getState().project!.saveRevision;
    await submitStoryCommand(store,old,context);expect(store.getState().project!.saveRevision).toBe(revision);
    await submitStoryCommand(store,commandFor(store.getState().project!),context);
    expect(decodeStoredProject((await storage.readRaw()).draft).story).toMatchObject({nodeId:'call-split',mode:'guided'});
  });
});
