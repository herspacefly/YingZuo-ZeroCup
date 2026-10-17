import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectStore } from '../../src/app/store';
import { archiveForRehearsal, confirmCraft } from '../../src/app/craft-commands';
import { ProjectStorage, decodeStoredProject } from '../../src/persistence/storage';
import { defaultAppearance } from '../../src/domain/defaults';
import { storyGuard } from '../../src/domain/story';
import type { ProjectV1 } from '../../src/domain/types';
import { at, NOW } from '../helpers/story';
const stores:ProjectStore[]=[],storages:ProjectStorage[]=[];
async function open(seed?:ProjectV1){
  let id=0;const storage=new ProjectStorage(new IDBFactory(),{writerId:'craft-test',now:()=>NOW});storages.push(storage);if(seed)await storage.save(seed,null);
  const store=await ProjectStore.open(storage,{writerId:'craft-test',createId:()=>`craft-project-${++id}`,now:()=>NOW});stores.push(store);return {store,storage};
}
const options={runId:'new-craft-run',mode:'full' as const,presetAppearanceUsed:false,guard:null,now:NOW};
function failNextDraft(){const put=FakeObjectStore.prototype.put;let fail=true;vi.spyOn(FakeObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key){if(fail&&key==='draft'){fail=false;throw new DOMException('Injected quota','QuotaExceededError');}return put.call(this,value,key);});}
afterEach(()=>{vi.restoreAllMocks();stores.splice(0).forEach(store=>store.dispose());storages.splice(0).forEach(storage=>storage.close());});
describe('craft confirmation and archived rehearsal through Store/IDB',()=>{
  it('freezes queue-time fields on a direct visit in one saved candidate, without persisting an intermediate intro',async()=>{
    const {store,storage}=await open(),revision=store.getState().project!.saveRevision;
    await Promise.all([store.edit({type:'PATTERN',patternId:'flower-v1'}),store.edit({type:'CARVE_NEXT'}),store.edit({type:'COLOR_SLOT',slot:'hem',colorIndex:4}),confirmCraft(store,options)]);
    const project=decodeStoredProject((await storage.readRaw()).draft);
    expect(project.story).toMatchObject({runId:'new-craft-run',nodeId:'memory-wave',revision:2,presetAppearanceUsed:false});
    expect(project.story!.castSnapshot!.appearance).toEqual(project.appearance);expect(project.story!.castSnapshot!.sharedMotif).toBe('flower-v1');expect(project.appearance.colorSlots.hem).toBe(4);expect(project.appearance.carvedSegments).toEqual([true,false,false]);
    expect(project.saveRevision).toBe(revision+1);expect(decodeStoredProject((await storage.readRaw()).backup).story).toBeNull();
  });
  it('explicit intro skip keeps the existing run identity and guided mode',async()=>{
    const {store}=await open(at('intro','call-first','guided')),story=store.getState().project!.story!;
    await confirmCraft(store,{...options,guard:storyGuard(story)});expect(store.getState().project!.story).toMatchObject({runId:story.runId,mode:'guided',nodeId:'memory-wave',revision:2});
  });
  it('craft confirmation is guarded and repeated clicks cannot refreeze or save twice',async()=>{
    const {store}=await open(at('craft')),story=store.getState().project!.story!,request={...options,guard:storyGuard(story)},before=store.getState().project!.saveRevision;
    await Promise.all([confirmCraft(store,request),confirmCraft(store,request)]);expect(store.getState().project!.saveRevision).toBe(before+1);
    const cast=store.getState().project!.story!.castSnapshot;await store.edit({type:'PATTERN',patternId:'flower-v1'});
    await confirmCraft(store,{...request,guard:storyGuard(store.getState().project!.story!)});expect(store.getState().project!.story!.castSnapshot).toEqual(cast);
  });
  it('default appearance is honestly marked and does not erase the editor',async()=>{
    const {store}=await open();await store.edit({type:'PATTERN',patternId:'flower-v1'});await store.edit({type:'CARVE_NEXT'});
    await confirmCraft(store,{...options,presetAppearanceUsed:true});const project=store.getState().project!;
    expect(project.appearance.patternId).toBe('flower-v1');expect(project.appearance.carvedSegments[0]).toBe(true);
    expect(project.story!.presetAppearanceUsed).toBe(true);expect(project.story!.castSnapshot!.appearance).toEqual(defaultAppearance());
  });
  it('stale guard or a direct request during an existing performance leaves it unchanged',async()=>{
    const {store}=await open(at('call-light')),before=store.getState().project!;
    await confirmCraft(store,options);await confirmCraft(store,{...options,guard:{...storyGuard(before.story!),expectedRevision:0}});expect(store.getState().project).toEqual(before);
  });
  it('quota failure preserves the old applied state and retries exactly the same frozen candidate',async()=>{
    const {store,storage}=await open();failNextDraft();expect(await confirmCraft(store,options)).toMatchObject({ok:false});
    expect(store.getState()).toMatchObject({hasPending:true,project:{story:null}});expect(decodeStoredProject((await storage.readRaw()).draft).story).toBeNull();
    const candidate=store.getExportProject()!;await store.edit({type:'PATTERN',patternId:'flower-v1'});await store.retryPending();
    expect(store.getState().project!.story).toEqual(candidate.story);expect(store.getState().project!.appearance.patternId).toBe('flower-v1');expect(store.getState().project!.story!.castSnapshot!.appearance.patternId).toBe('cloud-v1');
  });
  it('cancelled confirmation preserves queued editing without a phantom run',async()=>{
    const {store}=await open();failNextDraft();await confirmCraft(store,options);await store.edit({type:'CARVE_NEXT'});await store.cancelPending();expect(store.getState().project!.story).toBeNull();expect(store.getState().project!.appearance.carvedSegments[0]).toBe(true);
  });
  it('archived rehearsal keeps latest queued editor, archives the complete old run and creates a fresh identity',async()=>{
    const {store,storage}=await open(at('call-light')),old=store.getState().project!;
    await Promise.all([store.edit({type:'PATTERN',patternId:'flower-v1'}),store.edit({type:'LAMP_X',lampX:.6}),archiveForRehearsal(store)]);
    const fresh=store.getState().project!,archived=decodeStoredProject((await storage.readRaw()).previousProject);
    expect(fresh.projectId).not.toBe(old.projectId);expect(fresh.story).toBeNull();expect(fresh.appearance.patternId).toBe('flower-v1');expect(fresh.stage.lampX).toBe(.6);expect(fresh.pose).toEqual(old.pose);expect(fresh.lastRoute).toBe('/craft');
    expect(archived.story).toEqual(old.story);expect(archived.appearance.patternId).toBe('flower-v1');
    await confirmCraft(store,options);expect(store.getState().project!.story!.runId).not.toBe(old.story!.runId);expect(decodeStoredProject((await storage.readRaw()).previousProject).story).toEqual(old.story);
  });
  it('a second archive waits for explicit previous-project replacement and can retry its exact candidate',async()=>{
    const {store,storage}=await open(at('memory-wave'));await archiveForRehearsal(store);const firstArchive=(await storage.readRaw()).previousProject;
    await confirmCraft(store,options);const current=store.getState().project!;expect(await archiveForRehearsal(store)).toMatchObject({ok:false});expect(store.getState().project!.projectId).toBe(current.projectId);expect((await storage.readRaw()).previousProject).toBe(firstArchive);
    const candidate=store.getExportProject()!;expect(candidate.story).toBeNull();await store.retryPending(true);expect(store.getState().project!.projectId).toBe(candidate.projectId);expect(decodeStoredProject((await storage.readRaw()).previousProject).story).toEqual(current.story);
  });
  it('archive refuses a pending confirmation and never replaces the old project on a failed save',async()=>{
    const {store,storage}=await open(at('craft')),before=await storage.readRaw();failNextDraft();await confirmCraft(store,{...options,guard:storyGuard(store.getState().project!.story!)});
    expect(await archiveForRehearsal(store)).toMatchObject({ok:false});expect(await storage.readRaw()).toEqual(before);
  });
});
