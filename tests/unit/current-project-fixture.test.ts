import {expect,it} from 'vitest';
import {currentProject} from '../helpers/current-project';
import {STORY_NODE_IDS} from '../../src/domain/limits';
import {validateProject} from '../../src/domain/validation';
it('browser fixtures supply valid current decisions and frozen casts for every authored checkpoint',()=>{
 for(const id of STORY_NODE_IDS)for(const mode of ['full','guided'] as const){const project=currentProject(id,mode);expect(validateProject(project)).toEqual(project);}
});
