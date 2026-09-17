/* Virtual disk persistence.
   The disk was a Map that died with the tab, so nothing a session produced
   ever outlived it. IndexedDB, because it is the only browser store that is
   everywhere, needs no permission prompt, and survives a reload. */

const DB = 'web-agent-machine';
const STORE = 'disk';

const open = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const tx = async (mode, fn) => {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const out = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(out?.result);
      t.onerror = () => reject(t.error);
    });
  } finally { db.close(); }
};

/* Both sides swallow their own failures. Private mode, a blocked origin or a
   quota wall must degrade to "this session is ephemeral", never to a dead app. */
export const load = async () => {
  try { return (await tx('readonly', (s) => s.get('entries'))) || null; }
  catch { return null; }
};

export const save = async (store) => {
  try { await tx('readwrite', (s) => s.put([...store], 'entries')); return true; }
  catch { return false; }
};

