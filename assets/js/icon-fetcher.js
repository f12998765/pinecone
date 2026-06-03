const IconFetcher = {
    _cache: null,
    _resolving: {},
    _listeners: [],
    _readyListeners: [],
    _ready: false,
    _initialized: false,
    _generation: 0,

    init() {
        if (this._initialized) return;
        this._initialized = true;
        this._cache = {};
        this._generation = 0;
        PineconeDB.get('pinecone-iconMap').then(data => {
            if (data && typeof data === 'object') this._cache = data;
            this._setReady();
        }).catch(() => this._setReady());
    },

    _setReady() {
        this._ready = true;
        this._readyListeners.forEach(cb => cb());
        this._readyListeners = [];
    },

    onReady(callback) {
        this._ready ? callback() : this._readyListeners.push(callback);
    },

    getAllCached() {
        return this._cache ? { ...this._cache } : {};
    },

    onResolved(callback) {
        this._listeners.push(callback);
    },

    _notify(domain, url) {
        this._listeners.forEach(cb => { try { cb(domain, url); } catch {} });
    },

    _saveTimer: null,

    _saveCache() {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            PineconeDB.set('pinecone-iconMap', this._cache);
        }, 300);
    },

    resolveDomain(domain) {
        if (!domain || typeof domain !== 'string') return Promise.resolve(null);
        if (this._cache?.[domain]) return Promise.resolve(this._cache[domain]);
        if (this._resolving[domain]) return this._resolving[domain];

        const gen = this._generation;
        const promise = this._runChain(domain).then(url => {
            if (gen !== this._generation) return url;
            if (this._cache) this._cache[domain] = url;
            this._saveCache();
            this._notify(domain, url);
            delete this._resolving[domain];
            return url;
        }).catch(() => {
            if (gen !== this._generation) return '/assets/images/favicon.svg';
            this._notify(domain, '/assets/images/favicon.svg');
            delete this._resolving[domain];
            return '/assets/images/favicon.svg';
        });

        this._resolving[domain] = promise;
        return promise;
    },

    resolveDomains(domains, concurrency = 10) {
        const unique = [...new Set(domains.filter(Boolean))];
        let index = 0;
        const next = () => index < unique.length ? this.resolveDomain(unique[index++]).finally(next) : null;
        return Promise.allSettled(Array.from({ length: Math.min(concurrency, unique.length) }, next));
    },

    async _runChain(domain) {
        const qs = `_=${Date.now()}`;
        if (await this._checkImg(`https://twenty-icons.com/${domain}?${qs}`)) return `https://twenty-icons.com/${domain}?${qs}`;
        if (await this._checkImg(`https://favicon.im/${domain}?throw-error-on-404=true&larger=true&${qs}`)) return `https://favicon.im/${domain}?throw-error-on-404=true&larger=true&${qs}`;
        const v = await this._tryVemetric(domain);
        if (v) return v;
        if (await this._checkImg(`https://${domain}/apple-touch-icon.png?${qs}`)) return `https://${domain}/apple-touch-icon.png?${qs}`;
        throw new Error('not found');
    },

    async _tryVemetric(domain) {
        try {
            const res = await fetch(`https://favicon.vemetric.com/${domain}?response=json&_=${Date.now()}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data?.source !== 'default' && data?.url && (await this._checkImg(data.url)) ? data.url : null;
        } catch { return null; }
    },

    _checkImg(url) {
        return Promise.race([
            new Promise(resolve => { const i = new Image(); i.onload = () => resolve(true); i.onerror = () => resolve(false); i.src = url; }),
            new Promise(resolve => setTimeout(() => resolve(false), 4000))
        ]);
    },

    async fetchAllIconOptions(domain, { onProgress, onItem, customSources }) {
        const qs = `_=${Date.now()}`;
        let completed = 0;
        const total = 4 + (customSources?.length || 0);
        const trySource = async (url, label) => {
            const ok = await this._checkImg(url);
            if (ok && onItem) onItem({ url, label });
            return ok;
        };
        const tick = () => { completed++; if (onProgress) onProgress(`正在获取图标 (${completed}/${total})...`); };

        const tasks = [
            trySource(`https://twenty-icons.com/${domain}?${qs}`, 'twenty-icons').then(tick),
            trySource(`https://favicon.im/${domain}?throw-error-on-404=true&larger=true&${qs}`, 'favicon.im').then(tick),
            (async () => {
                const url = await this._tryVemetric(domain);
                if (url && onItem) onItem({ url, label: 'favicon.vemetric' });
            })().then(tick),
            trySource(`https://${domain}/apple-touch-icon.png?${qs}`, 'apple-touch-icon').then(tick),
        ];

        for (const [i, src] of (customSources || []).entries()) {
            const sep = src.includes('?') ? '&' : '?';
            tasks.push(trySource(src.replace(/\{domain\}/g, domain) + `${sep}_cb=${Date.now()}_${i}`, `源 ${i + 1}`).then(tick));
        }

        await Promise.allSettled(tasks);
        if (onProgress) onProgress('');
    },

    refreshCache() {
        this._cache = {};
        this._resolving = {};
        this._generation++;
        PineconeDB.remove('pinecone-iconMap');
    },

    extractDomain(uri) {
        if (!uri || typeof uri !== 'string') return null;
        if (uri.startsWith('/') || uri.startsWith('./') || uri.startsWith('../')) return null;
        try { return new URL(uri).hostname; } catch { return null; }
    }
};
