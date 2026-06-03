const PineconeDB = {
    _db: null,
    _openFailed: false,

    async _open() {
        if (this._db) return this._db;
        if (this._openFailed) throw new Error('IndexedDB unavailable');
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('PineconeDB', 1);
            req.onupgradeneeded = e => {
                if (!e.target.result.objectStoreNames.contains('kv'))
                    e.target.result.createObjectStore('kv');
            };
            req.onsuccess = e => resolve(this._db = e.target.result);
            req.onerror = () => { this._openFailed = true; console.error('PineconeDB open failed:', req.error); reject(req.error); };
        });
    },

    _request(mode, cb) {
        return this._open().then(db => new Promise((resolve, reject) => {
            const req = cb(db.transaction('kv', mode).objectStore('kv'));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
    },

    get(key)    { return this._request('readonly',  s => s.get(key)); },
    set(key, v) { return this._request('readwrite', s => s.put(v, key)); },
    remove(key) { return this._request('readwrite', s => s.delete(key)); },
};
