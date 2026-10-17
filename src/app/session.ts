import { newIdentifier } from './identity';
import { ProjectStore } from './store';
import { ProjectStorage } from '../persistence/storage';

export async function openProjectSession(): Promise<ProjectStore> {
  const writerId = newIdentifier('writer');
  let factory: IDBFactory | undefined;
  try { factory = window.indexedDB; } catch { factory = undefined; }
  return ProjectStore.open(new ProjectStorage(factory, { writerId, now: () => new Date().toISOString() }), {
    writerId, createId: () => newIdentifier('project'), now: () => new Date().toISOString(),
  });
}
