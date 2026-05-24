const IconFetcher = {
    _cache: null,
    _resolving: {},
    _listeners: [],
    _readyListeners: [],
    _ready: false,

    init() {
        this._cache = {};
        PineconeDB.get('pinecone-iconMap').then(data => {
            if (data && typeof data === 'object') {
                this._cache = data;
            }
            this._ready = true;
            this._readyListeners.forEach(cb => cb());
            this._readyListeners = [];
        }).catch(() => {
            this._ready = true;
            this._readyListeners.forEach(cb => cb());
            this._readyListeners = [];
        });
    },

    onReady(callback) {
        if (this._ready) {
            callback();
        } else {
            this._readyListeners.push(callback);
        }
    },

    getAllCached() {
        return this._cache ? { ...this._cache } : {};
    },

    onResolved(callback) {
        this._listeners.push(callback);
    },

    _notify(domain, url) {
        this._listeners.forEach(cb => {
            try { cb(domain, url); } catch {}
        });
    },

    _saveCache() {
        PineconeDB.set('pinecone-iconMap', this._cache).catch(() => {});
    },

    resolveDomain(domain) {
        if (!domain || typeof domain !== 'string') return Promise.resolve(null);
        if (this._cache && this._cache[domain]) return Promise.resolve(this._cache[domain]);
        if (this._resolving[domain]) return this._resolving[domain];

        const promise = this._runChain(domain).then(url => {
            if (this._cache) this._cache[domain] = url;
            this._saveCache();
            this._notify(domain, url);
            delete this._resolving[domain];
            return url;
        }).catch(() => {
            this._notify(domain, '/favicon.svg');
            delete this._resolving[domain];
            return '/favicon.svg';
        });

        this._resolving[domain] = promise;
        return promise;
    },

    resolveDomains(domains, concurrency) {
        concurrency = concurrency || 5;
        const unique = [...new Set(domains.filter(Boolean))];
        let index = 0;

        const next = () => {
            if (index >= unique.length) return;
            const i = index++;
            return this.resolveDomain(unique[i]).finally(() => next());
        };

        return Promise.allSettled(
            Array.from({ length: Math.min(concurrency, unique.length) }, () => next())
        );
    },

    async _runChain(domain) {
        const cb = `_=${Date.now()}`;
        const url1 = `https://twenty-icons.com/${domain}?${cb}`;
        if (await this._checkImg(url1)) return url1;

        const url2 = `https://favicon.im/${domain}?throw-error-on-404=true&larger=true&${cb}`;
        if (await this._checkImg(url2)) return url2;

        const vemetricUrl = await this._tryVemetric(domain);
        if (vemetricUrl) return vemetricUrl;

        const url4 = `https://${domain}/apple-touch-icon.png?${cb}`;
        if (await this._checkImg(url4)) return url4;

        throw new Error('not found');
    },

    async _tryVemetric(domain) {
        try {
            const res = await fetch(`https://favicon.vemetric.com/${domain}?response=json&_=${Date.now()}`);
            if (!res.ok) return null;
            const data = await res.json();
            if (data && data.source && data.source !== 'default' && data.url) {
                const ok = await this._checkImg(data.url);
                if (ok) return data.url;
            }
            return null;
        } catch {
            return null;
        }
    },

    _checkImg(url) {
        return new Promise(resolve => {
            const img = new Image();
            let done = false;
            const timer = setTimeout(() => {
                if (!done) { done = true; resolve(false); }
            }, 4000);
            img.onload = () => {
                if (!done) { done = true; clearTimeout(timer); resolve(true); }
            };
            img.onerror = () => {
                if (!done) { done = true; clearTimeout(timer); resolve(false); }
            };
            img.src = url;
        });
    },

    refreshCache() {
        this._cache = {};
        this._resolving = {};
        PineconeDB.remove('pinecone-iconMap').catch(() => {});
    },

    extractDomain(uri) {
        if (!uri || typeof uri !== 'string') return null;
        if (uri.startsWith('/') || uri.startsWith('./') || uri.startsWith('../')) return null;
        try {
            return new URL(uri).hostname;
        } catch {
            return null;
        }
    }
};
