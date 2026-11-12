// Storage layer. Everything the app saves goes through this object, so a
// cloud-synced version can later replace it without touching the rest of the app.
// Entries carry `updatedAt` so a future sync can tell which copy is newer.
const Store = (() => {
  let dbPromise;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('cafe-log', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('entries', { keyPath: 'id' });
          db.createObjectStore('meta', { keyPath: 'key' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  return {
    allEntries: () => run('entries', 'readonly', s => s.getAll()),
    putEntry: entry => run('entries', 'readwrite', s => s.put({ ...entry, updatedAt: Date.now() })),
    deleteEntry: id => run('entries', 'readwrite', s => s.delete(id)),
    getMeta: async key => {
      const row = await run('meta', 'readonly', s => s.get(key));
      return row ? row.value : undefined;
    },
    setMeta: (key, value) => run('meta', 'readwrite', s => s.put({ key, value, updatedAt: Date.now() })),
  };
})();
