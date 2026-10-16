import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openProbeDatabase, readProbe, writeProbe } from '../../src/probes/storage';

describe('T00 independent IndexedDB transaction probe', () => {
  let factory: IDBFactory;
  const connections: IDBDatabase[] = [];
  beforeEach(() => { factory = new IDBFactory(); });
  afterEach(() => { connections.splice(0).forEach(connection => connection.close()); });
  async function connect() {
    const database = await openProbeDatabase(factory);
    connections.push(database);
    return database;
  }
  it('commits a pair and reads it again after reopening', async () => {
    const database = await connect();
    await writeProbe(database, { lampX: 20, distance: 30 }, 0);
    await writeProbe(database, { lampX: 80, distance: 45 }, 1);
    database.close();
    const reopened = await connect();
    expect(await readProbe(reopened)).toEqual({
      current: { schemaVersion: 1, revision: 2, lampX: 80, distance: 45 },
      backup: { schemaVersion: 1, revision: 1, lampX: 20, distance: 30 },
    });
  });
  it('rejects on abort after the puts succeed and rolls back both records', async () => {
    const database = await connect();
    await writeProbe(database, { lampX: 25, distance: 30 }, 0);
    await writeProbe(database, { lampX: 65, distance: 40 }, 1);
    const before = await readProbe(database);
    await expect(writeProbe(database, { lampX: 99, distance: 50 }, 2, true)).rejects.toMatchObject({ code: 'aborted' });
    expect(await readProbe(database)).toEqual(before);
  });
  it('keeps an empty store empty if the first write aborts', async () => {
    const database = await connect();
    await expect(writeProbe(database, { lampX: 10, distance: 20 }, 0, true)).rejects.toMatchObject({ code: 'aborted' });
    expect(await readProbe(database)).toEqual({ current: null, backup: null });
  });
  it('allows only one of two writers with the same expected revision to commit', async () => {
    const first = await connect();
    const second = await connect();
    await writeProbe(first, { lampX: 50, distance: 30 }, 0);
    const results = await Promise.allSettled([
      writeProbe(first, { lampX: 20, distance: 30 }, 1),
      writeProbe(second, { lampX: 80, distance: 30 }, 1),
    ]);
    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'conflict' });
    expect((await readProbe(first)).current?.revision).toBe(2);
  });
  it('does not overwrite unrecognized stored data', async () => {
    const database = await connect();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('samples', 'readwrite');
      transaction.objectStore('samples').put({ schemaVersion: 88, payload: 'preserve' }, 'current');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    await expect(readProbe(database)).rejects.toMatchObject({ code: 'invalid' });
    await expect(writeProbe(database, { lampX: 50, distance: 30 }, 0)).rejects.toMatchObject({ code: 'invalid' });
    const value = await new Promise<unknown>(resolve => {
      const request = database.transaction('samples').objectStore('samples').get('current');
      request.onsuccess = () => resolve(request.result);
    });
    expect(value).toEqual({ schemaVersion: 88, payload: 'preserve' });
  });
  it('rejects invalid numbers without changing the previous sample', async () => {
    const database = await connect();
    await writeProbe(database, { lampX: 50, distance: 30 }, 0);
    await expect(writeProbe(database, { lampX: Infinity, distance: 30 }, 1)).rejects.toMatchObject({ code: 'invalid' });
    expect((await readProbe(database)).current?.revision).toBe(1);
  });
  it('reports missing or prohibited storage without claiming success', async () => {
    await expect(openProbeDatabase(undefined)).rejects.toMatchObject({ code: 'unavailable' });
    const denied = { open() { throw new DOMException('Denied', 'SecurityError'); } } as unknown as IDBFactory;
    await expect(openProbeDatabase(denied)).rejects.toMatchObject({ code: 'unavailable' });
  });
});
