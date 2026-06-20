const PineconeDB = {
    _db: null,
    _openPromise: null,

    async _open() {
        if (this._db) return this._db;
        if (this._openPromise) return this._openPromise;
        this._openPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open('PineconeDB', 1);
            req.onupgradeneeded = e => {
                if (!e.target.result.objectStoreNames.contains('kv'))
                    e.target.result.createObjectStore('kv');
            };
            req.onsuccess = e => {
                this._db = e.target.result;
                this._openPromise = null;
                resolve(this._db);
            };
            req.onerror = () => {
                this._openPromise = null;
                console.error('PineconeDB open failed:', req.error);
                reject(req.error);
            };
            req.onblocked = () => {
                this._openPromise = null;
                reject(new Error('IndexedDB blocked by another tab'));
            };
        });
        return this._openPromise;
    },

    _request(mode, cb) {
        return this._open().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction('kv', mode);
            const req = cb(tx.objectStore('kv'));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
        }));
    },

    get(key)    { return this._request('readonly',  s => s.get(key)).catch(e => { console.warn('PineconeDB failed: get', key, e); return null; }); },
    set(key, v) { return this._request('readwrite', s => s.put(v, key)).catch(e => console.warn('PineconeDB failed: set', key, e)); },
    remove(key) { return this._request('readwrite', s => s.delete(key)).catch(e => console.warn('PineconeDB failed: remove', key, e)); },
};
