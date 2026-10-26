import {describe,it,expect} from 'vitest';
import {cutSample} from '../../src/features/museum/carving-model';
import {defaultEnsembleScore,sampleEnsemble} from '../../src/features/museum/ensemble-model';
import {museumPreviewFrame} from '../../src/features/museum/demo-geometry';
import {prepareFrame} from '../../src/renderers/canvas/frame';
import {assetCatalog} from '../../src/content/catalog';
import {validateProject} from '../../src/domain/validation';
import fixture from '../fixtures/project-v1.json';

describe('museum experiments remain isolated and coordinated',()=>{
 it('point/drag duplicates cannot carve twice and invalid targets leave the specimen unchanged',()=>{const cuts=[2,4];expect(cutSample(cuts,2)).toEqual([2,4]);for(const n of [-1,8,NaN,.5])expect(cutSample(cuts,n)).toEqual(cuts);expect(cuts).toEqual([2,4]);});
 it('missing and delayed responsibilities independently change the performance',()=>{const score=defaultEnsembleScore();const full=sampleEnsemble(score,2400);expect(full.poseTime).toBeGreaterThan(0);expect(full.caption).toContain('沉香');expect(full.lit).toBe(true);score.puppet.enabled=false;score.voice.delay=1800;score.light.enabled=false;const partial=sampleEnsemble(score,2400);expect(partial.poseTime).toBe(0);expect(partial.caption).toBe('');expect(partial.lit).toBe(false);expect(partial.active).toEqual(['beat']);});
 it('sampling time is deterministic and cannot mutate the score',()=>{const score=defaultEnsembleScore(),before=JSON.stringify(score);expect(sampleEnsemble(score,-2)).toEqual(sampleEnsemble(score,NaN));expect(sampleEnsemble(score,6400).finished).toBe(true);expect(sampleEnsemble(score,999999)).toEqual(sampleEnsemble(score,6400));expect(JSON.stringify(score)).toBe(before);});
 it('transparent original-color shadows are explicit and validated',()=>{const frame=museumPreviewFrame(null);expect(prepareFrame({...frame,shadowOnly:true,shadowColor:'original'},assetCatalog).shadowColor).toBe('original');expect(()=>prepareFrame({...frame,shadowColor:'original'},assetCatalog)).toThrow('彩色幕影');});
 it('retired E08 visit records remain valid in old projects',()=>{const old=structuredClone(fixture);old.museum.visitedExhibitIds=['E08'];expect(validateProject(old)).toBeTruthy();});
});
