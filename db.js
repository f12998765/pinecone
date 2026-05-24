const PineconeDB = {
    _db: null,
    _openFailed: false,

    async _open() {
        if (this._db) return this._db;
        if (this._openFailed) throw new Error('IndexedDB unavailable');
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('PineconeDB', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('kv')) {
                    db.createObjectStore('kv');
                }
            };
            req.onsuccess = (e) => {
                this._db = e.target.result;
                resolve(this._db);
            };
            req.onerror = () => {
                this._openFailed = true;
                reject(req.error);
            };
        });
    },

    async get(key) {
        const db = await this._open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readonly');
            const req = tx.objectStore('kv').get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async set(key, value) {
        const db = await this._open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readwrite');
            tx.objectStore('kv').put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async remove(key) {
        const db = await this._open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readwrite');
            tx.objectStore('kv').delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
};
