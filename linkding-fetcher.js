const LinkdingFetcher = {
    async fetchTags(apiUrl, apiToken, proxyUrl) {
        const base = apiUrl.replace(/\/+$/, '');
        const proxy = proxyUrl ? proxyUrl.trim().replace(/\/+$/, '') : '';

        const wrap = raw => {
            if (!proxy) return raw;
            const encoded = encodeURIComponent(raw);
            return proxy.includes('{url}') ? proxy.replace(/\{url\}/g, encoded) : proxy + encoded;
        };

        let allTags = [];
        let nextUrl = wrap(`${base}/api/tags/?limit=100`);
        while (nextUrl) {
            const res = await fetch(nextUrl, {
                headers: { Authorization: `Token ${apiToken}` }
            });
            if (!res.ok) {
                const msg = res.status === 401 ? 'API 令牌无效'
                    : res.status === 404 ? 'API 地址不正确'
                    : `请求失败 (${res.status})`;
                throw new Error(msg);
            }
            const data = await res.json();
            allTags = allTags.concat(data.results || []);
            nextUrl = data.next ? wrap(data.next) : null;
        }
        return allTags;
    },

    async fetchBookmarks(apiUrl, apiToken, filterTags, proxyUrl) {
        filterTags = filterTags || [];
        const base = apiUrl.replace(/\/+$/, '');
        const proxy = proxyUrl ? proxyUrl.trim().replace(/\/+$/, '') : '';

        const wrap = raw => {
            if (!proxy) return raw;
            const encoded = encodeURIComponent(raw);
            return proxy.includes('{url}') ? proxy.replace(/\{url\}/g, encoded) : proxy + encoded;
        };

        const tagQuery = filterTags.length > 0 ? filterTags.map(t => '#' + t).join(' ') : '';
        const queryParam = tagQuery ? `&q=${encodeURIComponent(tagQuery)}` : '';
        let allBookmarks = [];
        let nextUrl = wrap(`${base}/api/bookmarks/?limit=100${queryParam}`);

        while (nextUrl) {
            const res = await fetch(nextUrl, {
                headers: { Authorization: `Token ${apiToken}` }
            });
            if (!res.ok) {
                const msg = res.status === 401 ? 'API 令牌无效'
                    : res.status === 404 ? 'API 地址不正确'
                    : `请求失败 (${res.status})`;
                throw new Error(msg);
            }
            const data = await res.json();
            allBookmarks = allBookmarks.concat(data.results || []);
            nextUrl = data.next ? wrap(data.next) : null;
        }

        return this._toServices(allBookmarks, filterTags);
    },

    _toServices(bookmarks, filterTags) {
        const groups = {};

        for (const bm of bookmarks) {
            const remaining = (bm.tag_names || []).filter(t => !filterTags.includes(t));
            const categories = remaining.length > 0 ? remaining : ['未分类'];

            for (const category of categories) {
                if (!groups[category]) groups[category] = [];
                groups[category].push(this._toServiceItem(bm));
            }
        }

        return Object.entries(groups).map(([category, services]) => ({
            category,
            services
        }));
    },

    _toServiceItem(bm) {
        return {
            name: bm.title || bm.website_title || bm.url,
            uri: bm.url,
            icon: ''
        };
    },

    validateUrl(url) {
        if (!url || typeof url !== 'string') return '请输入 API 地址';
        try {
            const u = new URL(url);
            if (!u.protocol.startsWith('http')) return '地址必须以 http:// 或 https:// 开头';
            return null;
        } catch {
            return 'API 地址格式不正确';
        }
    },

    validateToken(token) {
        if (!token || typeof token !== 'string' || !token.trim()) return '请输入 API 令牌';
        return null;
    }
};
