/**
 * Browser-only persistence for the Data workspace.  IndexedDB holds the
 * original reports (as Blob objects) and a complete extracted-data snapshot;
 * localStorage remains a small, synchronous recovery cache for older browsers.
 */
const DB_NAME = 'separation-data';
const STORE_NAME = 'workspace';
const SNAPSHOT_KEY = 'snapshot';

export type StoredSource = {
  id: string;
  kind: string;
  name: string;
  type: string;
  importedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(key: string, value: unknown) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function saveWorkspaceSnapshot(snapshot: unknown) {
  if (!('indexedDB' in window)) return;
  await put(SNAPSHOT_KEY, snapshot);
}

export async function loadWorkspaceSnapshot<T>(): Promise<T | null> {
  if (!('indexedDB' in window)) return null;
  const db = await openDb();
  const result = await new Promise<T | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(SNAPSHOT_KEY);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export async function saveSourceReport(source: StoredSource, file: File) {
  if (!('indexedDB' in window)) return;
  await put(`source:${source.id}`, { source, blob: file });
}

export async function deleteSourceReports(kind?: string) {
  if (!('indexedDB' in window)) return;
  const db = await openDb();
  const records = await new Promise<Array<{ key: IDBValidKey; value: { source?: StoredSource } }>>((resolve, reject) => {
    const output: Array<{ key: IDBValidKey; value: { source?: StoredSource } }> = [];
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve(output);
      if (String(cursor.key).startsWith('source:')) output.push({ key: cursor.key, value: cursor.value as { source?: StoredSource } });
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    records.filter(({ value }) => !kind || value.source?.kind === kind).forEach(({ key }) => store.delete(key));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
