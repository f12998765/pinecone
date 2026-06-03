
const VALID_MESSAGE_TYPES = new Set(['info', 'success', 'error']);
const TAG_COLORS = ['#ff2d55','#ff9500','#ffcc02','#34c759','#007aff','#5856d6','#af52de','#ff6482','#00c7be','#32ade6'];

// Alpine component
document.addEventListener('alpine:init', () => {
    Alpine.data('app', () => ({
        // State
        services: [],
        error: false,
        settingsOpen: false,
        effects: [
            { label: '简洁放大' },
            { label: 'macOS Dock' }
        ],

        // Persisted settings (IndexedDB via PineconeDB)
        iconSize: Alpine.$persist(64).as('pinecone-iconSize'),
        iconRadius: Alpine.$persist(12).as('pinecone-iconRadius'),
        iconOpacity: Alpine.$persist(100).as('pinecone-iconOpacity'),
        iconGap: Alpine.$persist(12).as('pinecone-iconGap'),
        textSize: Alpine.$persist(18).as('pinecone-textSize'),
        textColor: Alpine.$persist('#1a1a1a').as('pinecone-textColor'),
        maxWidth: Alpine.$persist(1421).as('pinecone-maxWidth'),
        showNames: Alpine.$persist(true).as('pinecone-showNames'),
        textIconGap: Alpine.$persist(12).as('pinecone-textIconGap'),
        textPosition: Alpine.$persist('column').as('pinecone-textPosition'),
        gridColumns: Alpine.$persist(8).as('pinecone-gridColumns'),
        hoverEffect: Alpine.$persist(2).as('pinecone-hoverEffect'),
        settingsTextSize: Alpine.$persist(14).as('pinecone-settingsTextSize'),
        openMode: Alpine.$persist('newtab').as('pinecone-openMode'),


        bgDataUrl: null,
        _bgBlobUrl: null,

        // Linkding
        dataSource: Alpine.$persist('local').as('pinecone-dataSource'),
        linkdingUrl: Alpine.$persist('').as('pinecone-linkdingUrl'),
        linkdingToken: Alpine.$persist('').as('pinecone-linkdingToken'),
        linkdingProxy: Alpine.$persist('https://corsproxy.io/?url={url}').as('pinecone-linkdingProxy'),
        linkdingProxyEnabled: Alpine.$persist(false).as('pinecone-linkdingProxyEnabled'),
        linkdingData: null,
        linkdingLoading: false,
        linkdingMessage: '',
        linkdingMessageType: '',
        linkdingTags: [],
        linkdingSelectedTags: Alpine.$persist([]).as('pinecone-selectedTags'),
        linkdingTagsLoading: false,
        tagModalOpen: false,

        RAINBOW: ['#ff8a80','#ffab91','#ffd54f','#aed581','#80cbc4','#90caf9','#b39ddb','#f48fb1'],

        tagOrder(name) {
            const idx = this.linkdingSelectedTags.indexOf(name);
            return idx >= 0 ? idx + 1 : 0;
        },

        badgeColor(order) {
            return this.RAINBOW[(order - 1) % this.RAINBOW.length];
        },

        // Resolved icon map (populated only in linkding mode)
        iconMap: {},

        // Linkding filter & custom icons (manually persisted to IndexedDB)
        linkdingFilterUrls: Alpine.$persist([]).as('pinecone-filterUrls'),
        linkdingCustomIcons: Alpine.$persist({}).as('pinecone-customIcons'),
        linkdingIconSources: Alpine.$persist([]).as('pinecone-iconSources'),
        customIconDataUrls: {},
        iconSourcesText: '',
        contextMenu: { show: false, x: 0, y: 0, service: null },
        filterUrlsText: '[]',
        customIconsText: '{}',
        customIconModal: { show: false, uri: '', domain: '', url: '', iconOptions: [], iconDone: false, iconProgress: '' },
        _lpTimer: null,
        _suppressNextClick: false,
        _messageTimer: null,
        _refreshTotal: 0,
        _refreshDone: 0,
        _refreshExpected: new Set(),
        _refreshStatusTimer: null,
        iconRefreshStatus: '',
        dataSourceLoading: false,
        _customIconGen: 0,
        _bgGen: 0,
        swUpdateAvailable: false,
        _serializedFilterUrls: '',
        _serializedCustomIcons: '',
        _serializedIconSources: '',

        get filterUrlsChanged() {
            return this.filterUrlsText !== this._serializedFilterUrls;
        },

        get customIconsChanged() {
            return this.customIconsText !== this._serializedCustomIcons;
        },

        get iconSourcesChanged() {
            return this.iconSourcesText !== this._serializedIconSources;
        },

        get _proxy() {
            return this.linkdingProxyEnabled ? this.linkdingProxy : '';
        },

        get activeServices() {
            if (this.dataSource === 'linkding' && this.linkdingFilterUrls?.length) {
                const blocked = new Set(this.linkdingFilterUrls);
                return this.services
                    .map(cat => ({
                        ...cat,
                        services: cat.services.filter(s => !blocked.has(s.uri))
                    }))
                    .filter(cat => cat.services.length > 0);
            }
            return this.services;
        },

        get linkdingMessageClass() {
            if (!this.linkdingMessageType) return '';
            return `status-${this.linkdingMessageType}`;
        },

        _setMessage(text, type = 'info') {
            this.linkdingMessage = text;
            this.linkdingMessageType = text ? (VALID_MESSAGE_TYPES.has(type) ? type : 'info') : '';
            clearTimeout(this._messageTimer);
            if (text && type !== 'error') {
                this._messageTimer = setTimeout(() => {
                    if (this.linkdingMessage === text) {
                        this.linkdingMessage = '';
                        this.linkdingMessageType = '';
                    }
                }, 3000);
            }
        },

        _ensureArray(key, fallback = []) {
            if (!Array.isArray(this[key])) this[key] = fallback;
        },

        _ensureObject(key) {
            if (!this[key] || typeof this[key] !== 'object' || Array.isArray(this[key])) this[key] = {};
        },

        _sanitizeNum(val, fallback) {
            const n = Number(val);
            return Number.isFinite(n) ? n : fallback;
        },

        async init() {
            this._ensureArray('linkdingIconSources');
            this._ensureArray('linkdingFilterUrls');
            this._ensureArray('linkdingSelectedTags');
            this._ensureObject('linkdingCustomIcons');
            this.iconSize = this._sanitizeNum(this.iconSize, 64);
            this.iconRadius = this._sanitizeNum(this.iconRadius, 12);
            this.iconOpacity = this._sanitizeNum(this.iconOpacity, 100);
            this.iconGap = this._sanitizeNum(this.iconGap, 12);
            this.textSize = this._sanitizeNum(this.textSize, 18);
            this.textColor = typeof this.textColor === 'string' && this.textColor.startsWith('#') ? this.textColor : '#1a1a1a';
            this.maxWidth = this._sanitizeNum(this.maxWidth, 1421);
            this.textIconGap = this._sanitizeNum(this.textIconGap, 12);
            this.gridColumns = this._sanitizeNum(this.gridColumns, 8);
            this.hoverEffect = this._sanitizeNum(this.hoverEffect, 2);
            this.settingsTextSize = this._sanitizeNum(this.settingsTextSize, 14);
            this.showNames = typeof this.showNames === 'boolean' ? this.showNames : true;
            this.openMode = ['self', 'newtab', 'background'].includes(this.openMode) ? this.openMode : 'newtab';
            this.textPosition = ['column', 'row'].includes(this.textPosition) ? this.textPosition : 'column';
            this.dataSource = ['local', 'linkding'].includes(this.dataSource) ? this.dataSource : 'local';
            this.linkdingProxyEnabled = typeof this.linkdingProxyEnabled === 'boolean' ? this.linkdingProxyEnabled : false;
            if (!this.linkdingProxy) {
                this.linkdingProxy = 'https://corsproxy.io/?url={url}';
            }
            IconFetcher.init();
            IconFetcher.onResolved((domain, url) => {
                this.iconMap[domain] = url;
                if (!this._refreshExpected.has(domain)) return;
                this._refreshExpected.delete(domain);
                this._refreshDone++;
                this.iconRefreshStatus = `正在刷新图标 ${this._refreshDone}/${this._refreshTotal}`;
                if (this._refreshDone >= this._refreshTotal) {
                    this._refreshExpected = new Set();
                    this._refreshTotal = 0;
                    this._refreshDone = 0;
                    this.iconRefreshStatus = '图标已刷新完成';
                    clearTimeout(this._refreshStatusTimer);
                    this._refreshStatusTimer = setTimeout(() => {
                        this._refreshStatusTimer = null;
                        if (this._refreshTotal === 0) this.iconRefreshStatus = '';
                    }, 3000);
                }
            });
            IconFetcher.onReady(() => {
                this.iconMap = IconFetcher.getAllCached();
            });

            const [savedLinkdingData, savedBgBlob, legacyBgUrl, savedDataUrls] = await Promise.all([
                PineconeDB.get('linkdingData').catch(() => null),
                PineconeDB.get('bgDataBlob').catch(() => null),
                PineconeDB.get('bgDataUrl').catch(() => null),
                PineconeDB.get('pinecone-customIconDataUrls').catch(() => null)
            ]);
            if (Array.isArray(savedLinkdingData) && savedLinkdingData.every(c => c && typeof c.category === 'string' && Array.isArray(c.services) && c.services.every(s => this._isValidService(s))))
                this.linkdingData = savedLinkdingData;
            if (savedDataUrls && typeof savedDataUrls === 'object' && !Array.isArray(savedDataUrls))
                this.customIconDataUrls = savedDataUrls;
            if (savedBgBlob && savedBgBlob.data instanceof Uint8Array) {
                const type = savedBgBlob.type || 'image/png';
                const blob = new Blob([savedBgBlob.data], { type });
                this._bgBlobUrl = URL.createObjectURL(blob);
                this.bgDataUrl = this._bgBlobUrl;
            } else if (legacyBgUrl) {
                this.bgDataUrl = legacyBgUrl;
                PineconeDB.remove('bgDataUrl');
            }
            this._serializedFilterUrls = JSON.stringify(this.linkdingFilterUrls || [], null, 2);
            this.filterUrlsText = this._serializedFilterUrls;
            this._serializedCustomIcons = JSON.stringify(this.linkdingCustomIcons || {}, null, 2);
            this.customIconsText = this._serializedCustomIcons;
            this._serializedIconSources = (this.linkdingIconSources || []).join('\n');
            this.iconSourcesText = this._serializedIconSources;

            await this.loadServices();
            this._buildServiceMap();
            this.applyCssVars();
            this.applyBg();

            this.$watch('linkdingFilterUrls', () => {
                this._serializedFilterUrls = JSON.stringify(this.linkdingFilterUrls || [], null, 2);
                if (document.activeElement?.tagName !== 'TEXTAREA')
                    this.filterUrlsText = this._serializedFilterUrls;
            });
            this.$watch('linkdingCustomIcons', () => {
                this._serializedCustomIcons = JSON.stringify(this.linkdingCustomIcons || {}, null, 2);
                if (document.activeElement?.tagName !== 'TEXTAREA')
                    this.customIconsText = this._serializedCustomIcons;
            });
            this.$watch('linkdingIconSources', () => {
                this._serializedIconSources = (this.linkdingIconSources || []).join('\n');
                this.iconSourcesText = this._serializedIconSources;
            });

            const cssVarKeys = ['iconSize','iconRadius','iconOpacity','iconGap','textSize',
                'textColor','maxWidth','textIconGap','gridColumns','settingsTextSize'];
            cssVarKeys.forEach(k => this.$watch(k, () => this.applyCssVars()));
            this.$watch('bgDataUrl', () => this.applyBg());
            this.$watch('dataSource', () => this.loadServices(true));
            this.$watch('services', () => this._buildServiceMap());

            let rt;
            window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => this.applyCssVars(), 100); });
            window.addEventListener('pinecone:sw-update', () => { this.swUpdateAvailable = true; });
        },

        applySwUpdate() {
            if (!pendingSwWorker || pendingSwWorker.state !== 'installed') return;
            pendingSwWorker.postMessage({ action: 'skipWaiting' });
            const onStateChange = () => {
                if (pendingSwWorker.state === 'activated') {
                    pendingSwWorker.removeEventListener('statechange', onStateChange);
                    window.location.reload();
                }
            };
            pendingSwWorker.addEventListener('statechange', onStateChange);
        },

        dismissSwUpdate() {
            this.swUpdateAvailable = false;
        },

        async loadServices(fromUserAction) {
            this.error = false;
            if (this.dataSource === 'linkding') {
                if (this.linkdingData?.length > 0) {
                    this.services = this._filterInvalid(this.linkdingData);
                    this._setMessage('');
                } else {
                    this.services = [];
                    if (fromUserAction) {
                        this._setMessage('尚未同步 Linkding 数据', 'info');
                    }
                }
                return;
            }
            this.services = [];
            this.dataSourceLoading = true;
            try {
                const r = await fetch('local/services.json');
                if (!r.ok) throw Error();
                const d = await r.json();
                if (this.dataSource !== 'local') return;
                this.services = this._filterInvalid(d);
            } catch {
                if (this.dataSource !== 'local') return;
                if (!this.services.length) this.error = true;
            } finally {
                this.dataSourceLoading = false;
            }
        },

        _buildServiceMap() {
            const map = {};
            for (const cat of this.services) {
                for (const s of cat.services) {
                    if (s.uri) map[s.uri] = s;
                }
            }
            this._serviceMap = map;
        },

        _serviceByUri(uri) {
            return this._serviceMap?.[uri] || null;
        },

        _filterInvalid(services) {
            return services
                .map(cat => ({
                    ...cat,
                    services: cat.services.filter(s => {
                        if (!this._isValidService(s)) return false;
                        s._validUri = true;
                        return true;
                    })
                }))
                .filter(cat => cat.services.length > 0);
        },

        _isValidService(s) {
            return s && typeof s === 'object'
                && typeof s.uri === 'string'
                && s.uri.length > 0
                && typeof s.name === 'string'
                && this.isValidURI(s.uri);
        },

        _resetRefreshState() {
            clearTimeout(this._refreshStatusTimer);
            this._refreshStatusTimer = null;
            this._refreshExpected = new Set();
            this._refreshTotal = 0;
            this._refreshDone = 0;
            this.iconRefreshStatus = '';
        },

        toggleDataSource() {
            this._resetRefreshState();
            this.dataSource = this.dataSource === 'local' ? 'linkding' : 'local';
            this.hideContextMenu();
        },

        refreshIcons() {
            this._setMessage('');
            this._resetRefreshState();
            const domains = new Set();
            this.services.forEach(cat => cat.services.forEach(s => {
                const d = IconFetcher.extractDomain(s.uri);
                if (d) domains.add(d);
            }));
            if (domains.size === 0) {
                this.iconRefreshStatus = '没有需要刷新的图标';
                this._refreshStatusTimer = setTimeout(() => {
                    this._refreshStatusTimer = null;
                    if (this.iconRefreshStatus === '没有需要刷新的图标') this.iconRefreshStatus = '';
                }, 3000);
                return;
            }
            IconFetcher.refreshCache();
            this._refreshExpected = domains;
            this._refreshTotal = domains.size;
            this._refreshDone = 0;
            this.iconRefreshStatus = `正在刷新图标 0/${this._refreshTotal}`;
            IconFetcher.resolveDomains([...domains]);
        },

        clearLinkdingData() {
            if (!confirm('确定清除所有 Linkding 数据和图标缓存？')) return;
            this._resetRefreshState();
            this.linkdingData = null;
            this.linkdingTags = [];
            this.linkdingSelectedTags = [];
            this.services = [];
            this.customIconDataUrls = {};
            PineconeDB.remove('linkdingData');
            PineconeDB.remove('pinecone-customIconDataUrls');
            IconFetcher.refreshCache();
            this.iconMap = {};
            this._setMessage('Linkding 数据与图标缓存已清除', 'info');
            this.dataSource = 'local';
            this.loadServices();
        },

        tagColor(name) {
            let h = 0;
            for (let i = 0; i < name.length; i++) h = (name.charCodeAt(i) + ((h << 5) - h)) | 0;
            return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
        },

        _validateLinkding() {
            const urlErr = LinkdingFetcher.validateUrl(this.linkdingUrl);
            if (urlErr) { this._setMessage(urlErr, 'error'); return false; }
            const tokenErr = LinkdingFetcher.validateToken(this.linkdingToken);
            if (tokenErr) { this._setMessage(tokenErr, 'error'); return false; }
            if (this.linkdingProxyEnabled) {
                const proxyErr = LinkdingFetcher.validateProxy(this.linkdingProxy);
                if (proxyErr) { this._setMessage(proxyErr, 'error'); return false; }
            }
            return true;
        },

        async handleTagButton() {
            if (this.linkdingTags.length > 0) { this.tagModalOpen = true; return; }
            await this.fetchLinkdingTags();
            if (this.linkdingTags.length > 0) this.tagModalOpen = true;
        },

        toggleTag(name) {
            this.linkdingSelectedTags = this.linkdingSelectedTags.includes(name)
                ? this.linkdingSelectedTags.filter(t => t !== name)
                : [...this.linkdingSelectedTags, name];
        },

        async fetchLinkdingTags() {
            if (!this._validateLinkding()) return;

            this.linkdingTagsLoading = true;
            try {
                const tags = await LinkdingFetcher.fetchTags(
                    this.linkdingUrl,
                    this.linkdingToken,
                    this._proxy
                );
                this.linkdingTags = tags.sort((a, b) => b.count - a.count);
                const validNames = new Set(tags.map(t => t.name));
                this.linkdingSelectedTags = this.linkdingSelectedTags.filter(t => validNames.has(t));

            } catch (err) {
                this._setMessage('获取标签失败: ' + err.message, 'error');
            }
            this.linkdingTagsLoading = false;
        },

        async syncLinkding() {
            if (!this._validateLinkding()) return;

            this.linkdingLoading = true;
            this._setMessage('');

            try {
                const data = await LinkdingFetcher.fetchBookmarks(this.linkdingUrl, this.linkdingToken, this.linkdingSelectedTags, this._proxy);
                const orderMap = new Map(this.linkdingSelectedTags.map((n, i) => [n, i]));
                data.sort((a, b) => (orderMap.get(a.category) ?? 999) - (orderMap.get(b.category) ?? 999));
                this.linkdingData = data;
                this.services = this._filterInvalid(data);
                PineconeDB.set('linkdingData', data);
                const count = data.reduce((s, c) => s + c.services.length, 0);
                this._setMessage(`同步成功，共 ${count} 个书签`, 'success');

                const domains = new Set();
                data.forEach(cat => cat.services.forEach(s => {
                    const d = IconFetcher.extractDomain(s.uri);
                    if (d) domains.add(d);
                }));
                if (domains.size > 0) {
                    IconFetcher.resolveDomains([...domains]);
                }
            } catch (err) {
                this._setMessage(err.message, 'error');
            }
            this.linkdingLoading = false;
        },

        getServiceIcon(uri) {
            if (this.dataSource !== 'linkding') return null;
            if (!uri) return null;
            if (this.customIconDataUrls?.[uri]) return this.customIconDataUrls[uri];
            if (this.linkdingCustomIcons?.[uri]) return this.linkdingCustomIcons[uri];
            const domain = IconFetcher.extractDomain(uri);
            return domain ? (this.iconMap[domain] || null) : null;
        },

        _clampMenuPosition(x, y, menuW = 180, menuH = 80) {
            if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 8;
            if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
            if (x < 0) x = 8;
            if (y < 0) y = 8;
            return { x, y };
        },

        _showContextMenu(clientX, clientY, uri) {
            const service = this._serviceByUri(uri);
            if (!service) return false;
            const { x, y } = this._clampMenuPosition(clientX, clientY);
            this.contextMenu = { show: true, x, y, service };
            return true;
        },

        handleContainerTouchStart(event) {
            if (this.dataSource !== 'linkding') return;
            const link = event.target.closest('.service-link');
            if (!link) return;
            const touch = event.touches[0];
            if (!touch) return;
            const uri = link.dataset.uri;
            clearTimeout(this._lpTimer);
            this._lpTimer = setTimeout(() => {
                this._lpTimer = null;
                if (this._showContextMenu(touch.clientX, touch.clientY, uri))
                    this._suppressNextClick = true;
            }, 500);
        },

        handleContainerTouchEnd() {
            clearTimeout(this._lpTimer);
            this._lpTimer = null;
        },

        handleContainerClick(event) {
            if (this._suppressNextClick) {
                this._suppressNextClick = false;
                event.preventDefault();
            }
        },

        handleContainerContextMenu(event) {
            if (this.dataSource !== 'linkding') return;
            const link = event.target.closest('.service-link');
            if (!link) return;
            event.preventDefault();
            this._showContextMenu(event.clientX, event.clientY, link.dataset.uri);
        },

        hideContextMenu() {
            this.contextMenu.show = false;
            this._suppressNextClick = false;
        },

        filterUrlFromMenu() {
            const uri = this.contextMenu.service.uri;
            if (uri && !this.linkdingFilterUrls.includes(uri)) {
                this.linkdingFilterUrls = [...this.linkdingFilterUrls, uri];
            }
            this.hideContextMenu();
        },

        customIconFromMenu() {
            const uri = this.contextMenu.service.uri;
            if (!uri) return;
            const domain = IconFetcher.extractDomain(uri) || '';
            const url = this.customIconDataUrls[uri] || this.linkdingCustomIcons[uri] || '';
            this.customIconModal = { show: true, uri, domain, url, iconOptions: [], iconDone: false, iconProgress: '' };
            this.hideContextMenu();
            if (!domain) {
                this.customIconModal.iconDone = true;
                return;
            }
            const gen = ++this._customIconGen;
            const customSources = (this.linkdingIconSources || []).filter(Boolean);
            IconFetcher.fetchAllIconOptions(domain, {
                onProgress: label => {
                    if (gen !== this._customIconGen) return;
                    this.customIconModal.iconProgress = label;
                },
                onItem: item => {
                    if (gen !== this._customIconGen) return;
                    this.customIconModal.iconOptions = [...this.customIconModal.iconOptions, item];
                },
                customSources,
            }).then(() => {
                if (gen !== this._customIconGen) return;
                this.customIconModal.iconDone = true;
            });
        },

        saveCustomIcon() {
            const { uri, url } = this.customIconModal;
            if (!uri || !url?.trim()) return;
            const trimmed = url.trim();
            if (trimmed.startsWith('data:')) {
                this.customIconDataUrls = { ...this.customIconDataUrls, [uri]: trimmed };
                PineconeDB.set('pinecone-customIconDataUrls', this.customIconDataUrls);
            } else {
                this.linkdingCustomIcons = { ...this.linkdingCustomIcons, [uri]: trimmed };
            }
            this.customIconModal.show = false;
            this._resetCustomIconModal();
            if (this.$refs?.customIconFile) this.$refs.customIconFile.value = '';
        },

        cancelCustomIcon() {
            this.customIconModal.show = false;
            this._resetCustomIconModal();
            if (this.$refs?.customIconFile) this.$refs.customIconFile.value = '';
        },

        _resetCustomIconModal() {
            this.customIconModal = { show: false, uri: '', domain: '', url: '', iconOptions: [], iconDone: false, iconProgress: '' };
        },

        handleCustomIconUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            const input = event.target;
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.customIconModal.url = ev.target.result;
                input.value = '';
            };
            reader.readAsDataURL(file);
        },

        applyFilterUrls() {
            try {
                const parsed = JSON.parse(this.filterUrlsText);
                if (!Array.isArray(parsed)) throw new Error();
                this.linkdingFilterUrls = parsed;
                this._setMessage('已屏蔽地址已更新', 'success');
            } catch {
                alert('格式错误：请输入有效的 JSON 数组，例如 ["https://example.com/page"]');
            }
        },

        applyCustomIcons() {
            try {
                const parsed = JSON.parse(this.customIconsText);
                if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
                this.linkdingCustomIcons = parsed;
                this._setMessage('自定义图标已更新', 'success');
            } catch {
                alert('格式错误：请输入有效的 JSON 对象，例如 {"https://example.com/page": "https://..."}');
            }
        },

        applyIconSources() {
            const lines = this.iconSourcesText.split('\n').map(s => s.trim()).filter(Boolean);
            this.linkdingIconSources = lines;
            this._setMessage('自定义图标源已更新', 'success');
        },

        applyCssVars() {
            const r = document.documentElement;
            const mb = window.innerWidth <= 768;
            r.style.setProperty('--icon-size', (mb ? Math.min(this.iconSize, 48) : this.iconSize) + 'px');
            r.style.setProperty('--icon-radius', this.iconRadius + 'px');
            r.style.setProperty('--icon-opacity', this.iconOpacity / 100);
            r.style.setProperty('--icon-gap', (mb ? Math.min(this.iconGap, 10) : this.iconGap) + 'px');
            r.style.setProperty('--text-size', (mb ? Math.min(this.textSize, 15) : this.textSize) + 'px');
            r.style.setProperty('--text-color', this.textColor);
            r.style.setProperty('--max-width', (mb ? Math.min(this.maxWidth, window.innerWidth - 32) : this.maxWidth) + 'px');
            r.style.setProperty('--text-icon-gap', (mb ? Math.min(this.textIconGap, 10) : this.textIconGap) + 'px');
            r.style.setProperty('--grid-columns', mb ? Math.min(this.gridColumns, 5) : this.gridColumns);
            r.style.setProperty('--settings-text-size', this.settingsTextSize + 'px');
        },

        applyBg() {
            const url = this.bgDataUrl;
            if (url) {
                document.body.style.backgroundImage = `url(${url})`;
                document.body.classList.add('custom-bg');
            } else {
                document.body.style.backgroundImage = '';
                document.body.classList.remove('custom-bg');
            }
        },

        _revokeBgBlobUrl() {
            if (this._bgBlobUrl) {
                URL.revokeObjectURL(this._bgBlobUrl);
                this._bgBlobUrl = null;
            }
        },

        handleBgUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                if (!confirm(`图片较大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，可能影响性能，确定继续？`)) {
                    e.target.value = '';
                    return;
                }
            }
            this._revokeBgBlobUrl();
            this._bgBlobUrl = URL.createObjectURL(file);
            this.bgDataUrl = this._bgBlobUrl;
            
            const gen = ++this._bgGen;
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (gen !== this._bgGen) return;
                PineconeDB.set('bgDataBlob', { type: file.type, data: new Uint8Array(ev.target.result) });
            };
            reader.readAsArrayBuffer(file);
        },

        resetBg() {
            this._revokeBgBlobUrl();
            this.bgDataUrl = null;
            PineconeDB.remove('bgDataBlob');
            PineconeDB.remove('bgDataUrl');
            if (this.$refs.bgFileInput) this.$refs.bgFileInput.value = '';
        },

        resetAll() {
            this.iconSize = 64;
            this.iconRadius = 12;
            this.iconOpacity = 100;
            this.iconGap = 12;
            this.textSize = 18;
            this.textColor = '#1a1a1a';
            this.maxWidth = 1421;
            this.showNames = true;
            this.textIconGap = 12;
            this.textPosition = 'column';
            this.gridColumns = 8;
            this.hoverEffect = 2;
            this.settingsTextSize = 14;
            this.openMode = 'newtab';
            this._revokeBgBlobUrl();
            this.bgDataUrl = null;

            this.dataSource = 'local';
            this.linkdingUrl = '';
            this.linkdingToken = '';
            this.linkdingProxy = 'https://corsproxy.io/?url={url}';
            this.linkdingProxyEnabled = false;
            this.linkdingData = null;
            this._setMessage('');
            this.linkdingTags = [];
            this.linkdingSelectedTags = [];
            this.linkdingFilterUrls = [];
            this.linkdingCustomIcons = {};
            this.linkdingIconSources = [];
            this.customIconDataUrls = {};
            this.filterUrlsText = '[]';
            this.customIconsText = '{}';
            this.iconSourcesText = '';

            PineconeDB.remove('bgDataBlob');
            PineconeDB.remove('linkdingData');
            PineconeDB.remove('pinecone-customIconDataUrls');

            this._resetRefreshState();
            this.hideContextMenu();
            this.customIconModal.show = false;
            this.tagModalOpen = false;
            this.applyCssVars();
        },

        handleBackgroundClick(e, uri) {
            // Let native <a target="_blank"> handle navigation
            // but immediately refocus this tab
            setTimeout(() => window.focus(), 50);
        },

        imgError(e) {
            const img = e.target;
            if (!img.dataset.fallback) {
                img.dataset.fallback = '1';
                img.src = '/assets/images/favicon.svg';
            }
        },

        isValidURI(uri) {
            if (!uri || typeof uri !== 'string') return false;
            const t = uri.trim().toLowerCase();
            return t.startsWith('http://') || t.startsWith('https://') ||
                   t.startsWith('/') || t.startsWith('./') || t.startsWith('../');
        }
    }));
});

// Service Worker registration
let pendingSwWorker = null;
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('ServiceWorker 注册成功，作用域:', registration.scope);

        registration.onupdatefound = () => {
            const newWorker = registration.installing;
            if (newWorker) {
                newWorker.onstatechange = () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        pendingSwWorker = newWorker;
                        window.dispatchEvent(new CustomEvent('pinecone:sw-update'));
                    }
                };
            }
        };

    }).catch(err => {
        console.error('ServiceWorker 注册失败:', err);
    });
}
