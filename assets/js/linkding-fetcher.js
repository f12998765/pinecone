const LinkdingFetcher = {
    _req(url, token) {
        return fetch(url, { headers: { Authorization: `Token ${token}` } }).then(res => {
            if (!res.ok) throw new Error(
                res.status === 401 ? 'API 令牌无效'
                : res.status === 404 ? 'API 地址不正确'
                : `请求失败 (${res.status})`
            );
            return res.json();
        });
    },

    _makeWrap(proxyUrl) {
        const proxy = proxyUrl ? proxyUrl.trim().replace(/\/+$/, '') : '';
        return raw => {
            if (!proxy) return raw;
            const e = encodeURIComponent(raw);
            return proxy.includes('{url}') ? proxy.replace(/\{url\}/g, e) : proxy + e;
        };
    },

    async fetchTags(apiUrl, apiToken, proxyUrl) {
        const base = apiUrl.replace(/\/+$/, '');
        const wrap = this._makeWrap(proxyUrl);
        let items = [], url = wrap(`${base}/api/tags/?limit=100`);
        while (url) {
            const data = await this._req(url, apiToken);
            items.push(...(data.results || []));
            url = data.next ? wrap(data.next) : null;
        }
        return items;
    },

    async fetchBookmarks(apiUrl, apiToken, filterTags, proxyUrl) {
        const base = apiUrl.replace(/\/+$/, '');
        const wrap = this._makeWrap(proxyUrl);
        let url = wrap(`${base}/api/bookmarks/?limit=100`);
        if (filterTags?.length) {
            url += `&q=${encodeURIComponent(filterTags.map(t => `#${t}`).join(' or '))}`;
        }
        let items = [];
        while (url) {
            const data = await this._req(url, apiToken);
            items.push(...(data.results || []));
            url = data.next ? wrap(data.next) : null;
        }
        return this._toServices(items, filterTags);
    },

    _toServices(bookmarks, filterTags) {
        const groups = {};
        const tagFilter = filterTags?.length ? new Set(filterTags) : null;

        for (const bm of bookmarks) {
            const tags = bm.tag_names || [];
            if (tags.length === 0) {
                (groups['未分类'] ??= []).push(this._toServiceItem(bm));
            } else {
                for (const tag of tags) {
                    if (tagFilter && !tagFilter.has(tag)) continue;
                    (groups[tag] ??= []).push(this._toServiceItem(bm));
                }
            }
        }
        return Object.entries(groups).map(([category, services]) => ({ category, services }));
    },

    _toServiceItem(bm) {
        return { name: bm.title || bm.website_title || bm.url, uri: bm.url, icon: '' };
    },

    validateUrl(url) {
        if (!url || typeof url !== 'string') return '请输入 API 地址';
        try { const u = new URL(url); if (!u.protocol.startsWith('http')) return '地址必须以 http:// 或 https:// 开头'; return null; }
        catch { return 'API 地址格式不正确'; }
    },

    validateToken(token) {
        if (!token || typeof token !== 'string' || !token.trim()) return '请输入 API 令牌';
        return null;
    }
};
