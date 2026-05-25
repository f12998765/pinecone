
// Alpine component
document.addEventListener('alpine:init', () => {
    Alpine.data('app', () => ({
        // State
        services: [],
        error: false,
        settingsOpen: false,
        effects: [
            { preview: '🔍', label: '简洁放大' },
            { preview: '🚀', label: 'macOS Dock' }
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
        bgDataUrl: null,

        // Linkding
        dataSource: Alpine.$persist('local').as('pinecone-dataSource'),
        linkdingUrl: Alpine.$persist('').as('pinecone-linkdingUrl'),
        linkdingToken: Alpine.$persist('').as('pinecone-linkdingToken'),
        linkdingProxy: Alpine.$persist('https://corsproxy.io/?url={url}').as('pinecone-linkdingProxy'),
        linkdingProxyEnabled: Alpine.$persist(false).as('pinecone-linkdingProxyEnabled'),
        linkdingData: null,
        linkdingLoading: false,
        linkdingError: '',
        linkdingTags: [],
        linkdingSelectedTags: [],
        linkdingTagsLoading: false,
        tagModalOpen: false,
        tagSearch: '',

        // Resolved icon map (populated only in linkding mode)
        iconMap: {},

        // Linkding filter & custom icons
        linkdingFilterUrls: Alpine.$persist([]).as('pinecone-linkdingFilterUrls'),
        linkdingCustomIcons: Alpine.$persist({}).as('pinecone-linkdingCustomIcons'),
        contextMenu: { show: false, x: 0, y: 0, service: null },
        filterUrlsText: '',
        customIconsText: '',
        customIconModal: { show: false, uri: '', url: '' },
        _lpTimer: null,
        _suppressNextClick: false,
        _refreshTotal: 0,
        _refreshDone: 0,
        _loadingLinkding: false,

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

        async init() {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                this.$watch('iconSize', v => { if (v > 48) this.iconSize = 48; });
                this.$watch('iconGap', v => { if (v > 10) this.iconGap = 10; });
                this.$watch('textSize', v => { if (v > 15) this.textSize = 15; });
                this.$watch('textIconGap', v => { if (v > 10) this.textIconGap = 10; });
                this.$watch('gridColumns', v => { if (v > 5) this.gridColumns = 5; });
                this.$watch('maxWidth', v => { if (v > window.innerWidth - 32) this.maxWidth = window.innerWidth - 32; });
                // Apply caps immediately for initial values
                if (this.iconSize > 48) this.iconSize = 48;
                if (this.iconGap > 10) this.iconGap = 10;
                if (this.textSize > 15) this.textSize = 15;
                if (this.textIconGap > 10) this.textIconGap = 10;
                if (this.gridColumns > 5) this.gridColumns = 5;
                if (this.maxWidth > window.innerWidth - 32) this.maxWidth = window.innerWidth - 32;
            }

            if (!this.linkdingProxy) {
                this.linkdingProxy = 'https://corsproxy.io/?url={url}';
            }
            IconFetcher.init();
            IconFetcher.onResolved((domain, url) => {
                this.iconMap[domain] = url;
                if (this._refreshTotal > 0) {
                    this._refreshDone++;
                    this.linkdingError = `正在刷新图标 ${this._refreshDone}/${this._refreshTotal}`;
                    if (this._refreshDone >= this._refreshTotal) {
                        this._refreshTotal = 0;
                        this._refreshDone = 0;
                        this.linkdingError = '图标缓存已清除，重新获取成功';
                    }
                }
            });
            IconFetcher.onReady(() => {
                this.iconMap = IconFetcher.getAllCached();
            });

            // 先从 IndexedDB 加载全部持久化数据（含 dataSource），确保首次渲染就正确
            this._loadingLinkding = true;
            const [savedDataSource, savedLinkdingData, savedSelectedTags, savedBgDataUrl] = await Promise.all([
                PineconeDB.get('pinecone-dataSource').catch(() => null),
                PineconeDB.get('linkdingData').catch(() => null),
                PineconeDB.get('linkdingSelectedTags').catch(() => null),
                PineconeDB.get('bgDataUrl').catch(() => null)
            ]);

            if (savedDataSource && (savedDataSource === 'local' || savedDataSource === 'linkding')) {
                this.dataSource = savedDataSource;
            }
            if (savedLinkdingData) {
                this.linkdingData = savedLinkdingData;
            }
            if (savedSelectedTags && savedSelectedTags.length > 0) {
                this.linkdingSelectedTags = savedSelectedTags;
            }
            if (savedBgDataUrl) {
                this.bgDataUrl = savedBgDataUrl;
            }
            this._loadingLinkding = false;

            await this.loadServices();
            this._buildServiceMap();
            this.applyCssVars();
            this.applyBg();

            this.$watch('linkdingFilterUrls', () => {
                this.filterUrlsText = JSON.stringify(this.linkdingFilterUrls || [], null, 2);
            });
            this.$watch('linkdingCustomIcons', () => {
                this.customIconsText = JSON.stringify(this.linkdingCustomIcons || {}, null, 2);
            });

            const cssVarKeys = ['iconSize','iconRadius','iconOpacity','iconGap','textSize',
                'textColor','maxWidth','textIconGap','textPosition','gridColumns','settingsTextSize'];
            cssVarKeys.forEach(k => this.$watch(k, () => this.applyCssVars()));
            this.$watch('bgDataUrl', () => this.applyBg());
            this.$watch('dataSource', (val, oldVal) => {
                if (val !== oldVal) this.loadServices(true);
            });
            this.$watch('services', () => this._buildServiceMap());
        },

        async loadServices(fromUserAction) {
            this.error = false;
            if (this.dataSource === 'linkding') {
                if (this.linkdingData && this.linkdingData.length > 0) {
                    this.services = this._filterInvalid(this.linkdingData);
                    this.linkdingError = '';
                } else {
                    this.services = [];
                    if (fromUserAction && !this._loadingLinkding) {
                        this.linkdingError = '尚未同步 Linkding 数据';
                    }
                }
                return;
            }
            this.services = [];
            try {
                const r = await fetch('services.json');
                if (!r.ok) throw Error();
                const d = await r.json();
                if (this.dataSource !== 'local') return;
                this.services = this._filterInvalid(d);
            } catch {
                if (this.dataSource !== 'local') return;
                if (!this.services.length) this.error = true;
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
                    services: cat.services.filter(s => this.isValidURI(s.uri))
                }))
                .filter(cat => cat.services.length > 0);
        },

        toggleDataSource() {
            this.dataSource = this.dataSource === 'local' ? 'linkding' : 'local';
        },

        refreshIcons() {
            IconFetcher.refreshCache();
            this.iconMap = {};
            const domains = new Set();
            this.services.forEach(cat => cat.services.forEach(s => {
                const d = IconFetcher.extractDomain(s.uri);
                if (d) domains.add(d);
            }));
            this._refreshTotal = domains.size;
            this._refreshDone = 0;
            if (domains.size === 0) {
                this.linkdingError = '没有需要刷新的图标';
                return;
            }
            this.linkdingError = `正在刷新图标 0/${this._refreshTotal}`;
            IconFetcher.resolveDomains([...domains]);
        },

        clearLinkdingData() {
            if (!confirm('确定清除所有 Linkding 数据和图标缓存？')) return;
            this.linkdingData = null;
            PineconeDB.remove('linkdingData').catch(() => {});
            IconFetcher.refreshCache();
            this.iconMap = {};
            this.loadServices();
            this.linkdingError = 'Linkding 数据与图标缓存已清除';
        },

        tagColor(name) {
            let h = 0;
            for (let i = 0; i < name.length; i++) h = (name.charCodeAt(i) + ((h << 5) - h)) | 0;
            const colors = ['#ff2d55','#ff9500','#ffcc02','#34c759','#007aff','#5856d6','#af52de','#ff6482','#00c7be','#32ade6'];
            return colors[Math.abs(h) % colors.length];
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
            PineconeDB.set('linkdingSelectedTags', [...this.linkdingSelectedTags]).catch(() => {});
        },

        async fetchLinkdingTags() {
            const urlErr = LinkdingFetcher.validateUrl(this.linkdingUrl);
            if (urlErr) { this.linkdingError = urlErr; return; }
            const tokenErr = LinkdingFetcher.validateToken(this.linkdingToken);
            if (tokenErr) { this.linkdingError = tokenErr; return; }

            this.linkdingTagsLoading = true;
            try {
                const tags = await LinkdingFetcher.fetchTags(
                    this.linkdingUrl,
                    this.linkdingToken,
                    this.linkdingProxyEnabled ? this.linkdingProxy : ''
                );
                this.linkdingTags = tags.sort((a, b) => b.count - a.count);
                const validNames = new Set(tags.map(t => t.name));
                this.linkdingSelectedTags = this.linkdingSelectedTags.filter(t => validNames.has(t));
                PineconeDB.set('linkdingSelectedTags', [...this.linkdingSelectedTags]).catch(() => {});
            } catch (err) {
                this.linkdingError = '获取标签失败: ' + err.message;
            }
            this.linkdingTagsLoading = false;
        },

        syncLinkding() {
            const urlErr = LinkdingFetcher.validateUrl(this.linkdingUrl);
            if (urlErr) { this.linkdingError = urlErr; return; }
            const tokenErr = LinkdingFetcher.validateToken(this.linkdingToken);
            if (tokenErr) { this.linkdingError = tokenErr; return; }

            this.linkdingLoading = true;
            this.linkdingError = '';

            LinkdingFetcher.fetchBookmarks(this.linkdingUrl, this.linkdingToken, this.linkdingSelectedTags, this.linkdingProxyEnabled ? this.linkdingProxy : '')
                .then(data => {
                    this.linkdingData = data;
                    this.services = this._filterInvalid(data);
                    PineconeDB.set('linkdingData', data).catch(() => {});
                    this.linkdingLoading = false;
                    const count = data.reduce((s, c) => s + c.services.length, 0);
                    this.linkdingError = `同步成功，共 ${count} 个书签`;

                    const domains = new Set();
                    data.forEach(cat => cat.services.forEach(s => {
                        const d = IconFetcher.extractDomain(s.uri);
                        if (d) domains.add(d);
                    }));
                    if (domains.size > 0) {
                        IconFetcher.resolveDomains([...domains]);
                    }
                })
                .catch(err => {
                    this.linkdingError = err.message;
                    this.linkdingLoading = false;
                });
        },

        getServiceIcon(uri) {
            if (this.dataSource !== 'linkding') return null;
            if (!uri) return null;
            if (this.linkdingCustomIcons?.[uri]) return this.linkdingCustomIcons[uri];
            const domain = IconFetcher.extractDomain(uri);
            return domain ? (this.iconMap[domain] || null) : null;
        },

        handleContainerTouchStart(event) {
            if (this.dataSource !== 'linkding') return;
            const link = event.target.closest('.service-link');
            if (!link) return;
            const touch = event.touches[0];
            if (!touch) return;
            const cx = touch.clientX, cy = touch.clientY;
            const uri = link.dataset.uri;
            clearTimeout(this._lpTimer);
            this._lpTimer = setTimeout(() => {
                this._lpTimer = null;
                const service = this._serviceByUri(uri);
                if (!service) return;
                const menuW = 180, menuH = 80;
                let x = cx, y = cy;
                if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 8;
                if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
                if (x < 0) x = 8;
                if (y < 0) y = 8;
                this.contextMenu = { show: true, x, y, service };
                this._suppressNextClick = true;
            }, 500);
        },

        handleContainerTouchEnd() {
            clearTimeout(this._lpTimer);
            this._lpTimer = null;
        },

        handleContainerTouchMove() {
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
            const service = this._serviceByUri(link.dataset.uri);
            if (!service) return;
            const menuW = 180, menuH = 80;
            let x = event.clientX, y = event.clientY;
            if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 8;
            if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
            if (x < 0) x = 8;
            if (y < 0) y = 8;
            this.contextMenu = { show: true, x, y, service };
        },

        hideContextMenu() {
            this.contextMenu.show = false;
            this._suppressNextClick = false;
        },

        filterUrlFromMenu() {
            const uri = this.contextMenu.service.uri;
            if (uri && !this.linkdingFilterUrls.includes(uri)) {
                this.linkdingFilterUrls = [...this.linkdingFilterUrls, uri];
                this.filterUrlsText = JSON.stringify(this.linkdingFilterUrls, null, 2);
            }
            this.hideContextMenu();
        },

        customIconFromMenu() {
            const uri = this.contextMenu.service.uri;
            if (!uri) return;
            this.customIconModal = { show: true, uri, url: this.linkdingCustomIcons[uri] || '' };
            this.hideContextMenu();
        },

        saveCustomIcon() {
            const { uri, url } = this.customIconModal;
            if (!uri || !url?.trim()) return;
            this.linkdingCustomIcons = { ...this.linkdingCustomIcons, [uri]: url.trim() };
            this.customIconsText = JSON.stringify(this.linkdingCustomIcons, null, 2);
            this.customIconModal.show = false;
            const fileInput = document.querySelector('.modal-card input[type="file"]');
            if (fileInput) fileInput.value = '';
        },

        cancelCustomIcon() {
            this.customIconModal.show = false;
            const fileInput = document.querySelector('.modal-card input[type="file"]');
            if (fileInput) fileInput.value = '';
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
                this.linkdingError = '已屏蔽地址已更新';
            } catch {
                alert('格式错误：请输入有效的 JSON 数组，例如 ["https://example.com/page"]');
            }
        },

        applyCustomIcons() {
            try {
                const parsed = JSON.parse(this.customIconsText);
                if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
                this.linkdingCustomIcons = parsed;
                this.linkdingError = '自定义图标已更新';
            } catch {
                alert('格式错误：请输入有效的 JSON 对象，例如 {"https://example.com/page": "https://..."}');
            }
        },

        applyCssVars() {
            const r = document.documentElement;
            r.style.setProperty('--icon-size', this.iconSize + 'px');
            r.style.setProperty('--icon-radius', this.iconRadius + 'px');
            r.style.setProperty('--icon-opacity', this.iconOpacity / 100);
            r.style.setProperty('--icon-gap', this.iconGap + 'px');
            r.style.setProperty('--text-size', this.textSize + 'px');
            r.style.setProperty('--text-color', this.textColor);
            r.style.setProperty('--max-width', this.maxWidth + 'px');
            r.style.setProperty('--text-icon-gap', this.textIconGap + 'px');
            r.style.setProperty('--text-position', this.textPosition);
            r.style.setProperty('--grid-columns', this.gridColumns);
            r.style.setProperty('--settings-text-size', this.settingsTextSize + 'px');
        },

        applyBg() {
            if (this.bgDataUrl) {
                document.body.style.backgroundImage = `url(${this.bgDataUrl})`;
                document.body.classList.add('custom-bg');
            } else {
                document.body.style.backgroundImage = '';
                document.body.classList.remove('custom-bg');
            }
        },

        handleBgUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                if (!confirm(`图片较大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，确定继续？`)) {
                    e.target.value = '';
                    return;
                }
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.bgDataUrl = ev.target.result;
                PineconeDB.set('bgDataUrl', ev.target.result).catch(() => {});
            };
            reader.readAsDataURL(file);
        },

        resetBg() {
            this.bgDataUrl = null;
            PineconeDB.remove('bgDataUrl').catch(() => {});
        },

        resetAll() {
            const isMobile = window.innerWidth <= 768;
            this.iconSize = isMobile ? 48 : 64;
            this.iconRadius = 12;
            this.iconOpacity = 100;
            this.iconGap = isMobile ? 8 : 12;
            this.textSize = isMobile ? 14 : 18;
            this.textColor = '#1a1a1a';
            this.maxWidth = 1421;
            this.showNames = true;
            this.textIconGap = isMobile ? 8 : 12;
            this.textPosition = 'column';
            this.gridColumns = isMobile ? 4 : 8;
            this.hoverEffect = 2;
            this.settingsTextSize = 14;
            this.bgDataUrl = null;
            
            // Reset Linkding settings
            this.dataSource = 'local';
            this.linkdingUrl = '';
            this.linkdingToken = '';
            this.linkdingProxy = 'https://corsproxy.io/?url={url}';
            this.linkdingProxyEnabled = false;
            this.linkdingData = null;
            this.linkdingError = '';
            this.linkdingTags = [];
            this.linkdingSelectedTags = [];
            this.linkdingFilterUrls = [];
            this.linkdingCustomIcons = {};
            this.filterUrlsText = '';
            this.customIconsText = '';
            
            PineconeDB.remove('bgDataUrl').catch(() => {});
            PineconeDB.remove('linkdingData').catch(() => {});
            PineconeDB.remove('pinecone-linkdingFilterUrls').catch(() => {});
            PineconeDB.remove('pinecone-linkdingCustomIcons').catch(() => {});
            PineconeDB.remove('linkdingSelectedTags').catch(() => {});
            PineconeDB.remove('pinecone-linkdingSelectedTags').catch(() => {});
            PineconeDB.remove('pinecone-linkdingUrl').catch(() => {});
            PineconeDB.remove('pinecone-linkdingToken').catch(() => {});
            PineconeDB.remove('pinecone-linkdingProxy').catch(() => {});
            PineconeDB.remove('pinecone-linkdingProxyEnabled').catch(() => {});
            
            this.applyCssVars();
        },

        imgError(e) {
            const img = e.target;
            if (!img.dataset.fallback) {
                img.dataset.fallback = '1';
                img.src = '/favicon.svg';
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
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').then(registration => {
        console.log('ServiceWorker 注册成功，作用域:', registration.scope);

        registration.onupdatefound = () => {
            const newWorker = registration.installing;
            if (newWorker) {
                newWorker.onstatechange = () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        if (confirm('检测到新版本，是否立即刷新页面以获取最新内容？')) {
                            newWorker.postMessage({ action: 'skipWaiting' });
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'activated') window.location.reload();
                            });
                        }
                    }
                };
            }
        };

    }).catch(err => {
        console.error('ServiceWorker 注册失败:', err);
    });
}
