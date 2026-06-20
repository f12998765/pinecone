const IconFetcher = {
    _cache: null,
    _resolving: {},
    _listeners: [],
    _readyListeners: [],
    _ready: false,
    _initialized: false,
    _generation: 0,
    _saveTimer: null,

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

    onReady(cb) { this._ready ? cb() : this._readyListeners.push(cb); },
    onResolved(cb) { this._listeners.push(cb); },
    offResolved(cb) { this._listeners = this._listeners.filter(c => c !== cb); },
    getAllCached() { return this._cache ? { ...this._cache } : {}; },

    _notify(domain, url) {
        this._listeners.forEach(cb => { try { cb(domain, url); } catch {} });
    },

    _saveCache() {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => PineconeDB.set('pinecone-iconMap', this._cache), 300);
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
            if (gen !== this._generation) return '/assets/images/apple-touch-icon.png';
            if (this._cache) this._cache[domain] = '/assets/images/apple-touch-icon.png';
            this._saveCache();
            this._notify(domain, '/assets/images/apple-touch-icon.png');
            delete this._resolving[domain];
            return '/assets/images/apple-touch-icon.png';
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
        if (await this._checkImg(`https://www.google.com/s2/favicons?domain=${domain}&sz=64&${qs}`)) return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        if (await this._checkImg(`https://icon.horse/icon/${domain}?${qs}`)) return `https://icon.horse/icon/${domain}`;
        if (await this._checkImg(`https://icons.duckduckgo.com/ip3/${domain}.ico?${qs}`)) return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
        if (await this._checkImg(`https://${domain}/apple-touch-icon.png?${qs}`)) return `https://${domain}/apple-touch-icon.png?${qs}`;
        if (await this._checkImg(`https://${domain}/favicon.ico?${qs}`)) return `https://${domain}/favicon.ico`;
        throw new Error('not found');
    },

    async _tryVemetric(domain) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(`https://favicon.vemetric.com/${domain}?response=json&_=${Date.now()}`, { signal: controller.signal });
            if (!res.ok) return null;
            const data = await res.json();
            return data?.source !== 'default' && data?.url && (await this._checkImg(data.url)) ? data.url : null;
        } catch { return null; }
        finally { clearTimeout(timer); }
    },

    _checkImg(url) {
        return new Promise(resolve => {
            const i = new Image();
            let done = false;
            const finish = (result) => { if (!done) { done = true; i.onload = i.onerror = null; resolve(result); } };
            i.onload = () => finish(true);
            i.onerror = () => finish(false);
            i.src = url;
            setTimeout(() => { finish(false); i.src = ''; }, 4000);
        });
    },

    async fetchAllIconOptions(domain, { onProgress, onItem, customSources }) {
        const qs = `_=${Date.now()}`;
        let completed = 0;
        const total = 8 + (customSources?.length || 0);
        const trySource = async (url, label) => {
            if (await this._checkImg(url)) { if (onItem) onItem({ url, label }); return true; }
            return false;
        };
        const tick = () => { completed++; if (onProgress) onProgress(`正在获取图标 (${completed}/${total})...`); };
        await Promise.allSettled([
            trySource(`https://twenty-icons.com/${domain}?${qs}`, 'twenty-icons').then(tick),
            trySource(`https://favicon.im/${domain}?throw-error-on-404=true&larger=true&${qs}`, 'favicon.im').then(tick),
            (async () => { const url = await this._tryVemetric(domain); if (url && onItem) onItem({ url, label: 'favicon.vemetric' }); })().then(tick),
            trySource(`https://www.google.com/s2/favicons?domain=${domain}&sz=64&${qs}`, 'google').then(tick),
            trySource(`https://icon.horse/icon/${domain}?${qs}`, 'icon.horse').then(tick),
            trySource(`https://icons.duckduckgo.com/ip3/${domain}.ico?${qs}`, 'duckduckgo').then(tick),
            trySource(`https://${domain}/apple-touch-icon.png?${qs}`, 'apple-touch-icon').then(tick),
            trySource(`https://${domain}/favicon.ico?${qs}`, 'favicon.ico').then(tick),
            ...(customSources || []).map((src, i) => {
                const sep = src.includes('?') ? '&' : '?';
                return trySource(src.replace(/\{domain\}/g, domain) + `${sep}_cb=${Date.now()}_${i}`, `源 ${i + 1}`).then(tick);
            }),
        ]);
        if (onProgress) onProgress('');
    },

    refreshCache() {
        clearTimeout(this._saveTimer);
        this._cache = {};
        this._resolving = {};
        this._generation++;
        PineconeDB.remove('pinecone-iconMap');
    },

    extractDomain(uri) {
        if (!uri || typeof uri !== 'string' || uri.startsWith('/') || uri.startsWith('./') || uri.startsWith('../')) return null;
        try { return new URL(uri).hostname; } catch { return null; }
    }
};
