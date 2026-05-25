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

        let allBookmarks = [];
        // 基础 URL（带分页参数）
        let baseUrl = `${base}/api/bookmarks/?limit=100`;

        // 如果有过滤标签，添加 q 参数实现 OR 查询
        if (filterTags.length > 0) {
            const query = filterTags.map(tag => `#${tag}`).join(' or ');
            baseUrl += `&q=${encodeURIComponent(query)}`;
        }

        let nextUrl = wrap(baseUrl);

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

        // 转换为分类结构：每个标签一个分类，书签出现在其所有已选标签的分类下
        return this._toServices(allBookmarks, filterTags);
    },

    _toServices(bookmarks, filterTags) {
        const groups = {};
        const tagFilter = filterTags?.length ? new Set(filterTags) : null;

        for (const bm of bookmarks) {
            const tags = bm.tag_names || [];

            if (tags.length === 0) {
                const category = '未分类';
                if (!groups[category]) groups[category] = [];
                groups[category].push(this._toServiceItem(bm));
            } else {
                for (const tag of tags) {
                    if (tagFilter && !tagFilter.has(tag)) continue;
                    if (!groups[tag]) groups[tag] = [];
                    groups[tag].push(this._toServiceItem(bm));
                }
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