const LinkdingFetcher = {
    MAX_PAGES: 50,

    _req(url, token) {
        return fetch(url, { headers: { Authorization: `Token ${token}` } }).then(res => {
            if (!res.ok) throw new Error(
                res.status === 401 ? 'API 令牌无效' : res.status === 404 ? 'API 地址不正确' : `请求失败 (${res.status})`
            );
            return res.json();
        });
    },

    _makeWrap(proxyUrl) {
        const proxy = proxyUrl ? proxyUrl.trim().replace(/\/+$/, '') : '';
        if (!proxy) return raw => raw;
        return raw => {
            const encoded = encodeURIComponent(raw);
            if (proxy.includes('{url}')) return proxy.replace(/\{url\}/g, encoded);
            const separator = proxy.includes('?') ? '' : '/';
            return proxy + separator + encoded;
        };
    },

    async _paginate(buildUrl, apiToken, proxyUrl) {
        const wrap = this._makeWrap(proxyUrl);
        let items = [], url = wrap(buildUrl()), pages = 0;
        while (url && pages++ < this.MAX_PAGES) {
            const data = await this._req(url, apiToken);
            items.push(...(data.results || []));
            url = data.next ? wrap(data.next) : null;
        }
        return items;
    },

    async fetchTags(apiUrl, apiToken, proxyUrl) {
        const base = apiUrl.replace(/\/+$/, '');
        return this._paginate(() => `${base}/api/tags/?limit=100`, apiToken, proxyUrl);
    },

    async fetchBookmarks(apiUrl, apiToken, filterTags, proxyUrl) {
        const base = apiUrl.replace(/\/+$/, '');
        const q = filterTags?.length ? `&q=${encodeURIComponent(filterTags.map(t => `#${t}`).join(' or '))}` : '';
        const items = await this._paginate(() => `${base}/api/bookmarks/?limit=100${q}`, apiToken, proxyUrl);
        return this._toServices(items, filterTags);
    },

    _toServices(bookmarks, filterTags) {
        const groups = {};
        const tagFilter = filterTags?.length ? new Set(filterTags) : null;
        for (const bm of bookmarks) {
            const tags = bm.tag_names || [];
            if (tags.length === 0) {
                if (!tagFilter) (groups['未分类'] ??= []).push(this._toServiceItem(bm));
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
        return { name: bm.title || bm.website_title || bm.url || 'Untitled', uri: bm.url, icon: '' };
    },

    _validateHttpUrl(url, emptyMsg, protoMsg, formatMsg) {
        if (!url || typeof url !== 'string') return emptyMsg;
        try { const u = new URL(url); return u.protocol.startsWith('http') ? null : protoMsg; }
        catch { return formatMsg; }
    },

    validateUrl(url) { return LinkdingFetcher._validateHttpUrl(url, '请输入 API 地址', '地址必须以 http:// 或 https:// 开头', 'API 地址格式不正确'); },
    validateProxy(url) { return LinkdingFetcher._validateHttpUrl(url, '请输入代理地址', '代理地址必须以 http:// 或 https:// 开头', '代理地址格式不正确'); },
    validateToken(token) { return (!token || typeof token !== 'string' || !token.trim()) ? '请输入 API 令牌' : null; }
};
