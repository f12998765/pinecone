// Inline services data (fallback for file:// access where fetch is blocked by CORS)
const INLINE_SERVICES = [
  {"category":"✨ 常用","services":[
    {"name":"青空","uri":"https://main.elk.zone/","icon":"/icons/sky.jpg"},
    {"name":"Link","uri":"https://link.xizero.com/","icon":"/icons/linkding.webp"},
    {"name":"Twitter","uri":"https://x.com/home","icon":"/icons/twitter.png"},
    {"name":"Inoreader","uri":"https://www.inoreader.com/all_articles","icon":"/icons/inoreader.png"},
    {"name":"Hacker News","uri":"https://news.ycombinator.com/","icon":"/icons/hackernews.png"},
    {"name":"其乐","uri":"https://keylol.com/","icon":"/icons/keylol.png"},
    {"name":"Switch520","uri":"https://www.gamer520.com/","icon":"/icons/ns.png"},
    {"name":"Reddit","uri":"https://www.reddit.com/","icon":"/icons/reddit.png"}]},
  {"category":"🌙 娱乐","services":[
    {"name":"哔哩哔哩","uri":"https://www.bilibili.com/","icon":"/icons/bilibili.png"},
    {"name":"抖音","uri":"https://www.douyin.com/","icon":"/icons/douyin.png"},
    {"name":"小红书","uri":"https://www.xiaohongshu.com/","icon":"/icons/redbook.png"},
    {"name":"NGA","uri":"https://nga.178.com/","icon":"/icons/nga.png"},
    {"name":"YouTube","uri":"https://www.youtube.com/","icon":"/icons/youtube.png"},
    {"name":"Instagram","uri":"https://www.instagram.com/","icon":"/icons/instagram.png"},
    {"name":"Twitch","uri":"https://www.twitch.tv/","icon":"/icons/twitch.png"},
    {"name":"Discord","uri":"https://discord.com/channels/@me","icon":"/icons/discord.png"}]},
  {"category":"⚡️ 工具","services":[
    {"name":"DeepSeek","uri":"https://chat.deepseek.com/","icon":"/icons/deepseek.png"},
    {"name":"DuckDuckGo AI","uri":"https://duck.ai/","icon":"/icons/duckduckgo.png"},
    {"name":"Microsoft Copilot","uri":"https://copilot.microsoft.com/","icon":"/icons/copilot-color.svg"},
    {"name":"Gemini","uri":"https://gemini.google.com/app","icon":"/icons/gemini.png"},
    {"name":"Qwen","uri":"https://chat.qwen.ai/","icon":"/icons/qwen.png"},
    {"name":"OutLook","uri":"https://outlook.live.com/mail/0/inbox/","icon":"/icons/outlook.png"},
    {"name":"OneDrive","uri":"https://onedrive.live.com/","icon":"/icons/onedrive.png"},
    {"name":"临时邮箱","uri":"https://www.emailtick.com/zh","icon":"/icons/tempemail.png"}]},
  {"category":"🎮 游戏","services":[
    {"name":"Todo.txt","uri":"https://xizero.com/todo.txt/","icon":"/icons/todo.jpg"},
    {"name":"FFXIV Wiki","uri":"https://ff14.huijiwiki.com/wiki/%E9%A6%96%E9%A1%B5","icon":"/icons/ffxiv_wiki.webp"},
    {"name":"艾欧泽亚售楼中心","uri":"https://house.ffxiv.cyou/","icon":"/icons/ffxiv_house.png"},
    {"name":"Soulframe Wiki","uri":"https://wiki.avakot.org/","icon":"/icons/soulframe_wiki.png"},
    {"name":"Warframe 中文维基","uri":"https://warframe.huijiwiki.com/wiki/Mainpage","icon":"/icons/warframe_huiji_wiki.webp"},
    {"name":"Warframe Wiki","uri":"https://wiki.warframe.com/","icon":"/icons/warframe_wiki.webp"},
    {"name":"Warframe Market","uri":"https://warframe.market/zh-hans/","icon":"/icons/wm.webp"},
    {"name":"Warframe 掉宝","uri":"https://warframestreams.lol/","icon":"/icons/warframestreams.png"}]},
  {"category":"🍀 社区","services":[
    {"name":"v2ex","uri":"https://www.v2ex.com/","icon":"/icons/v2ex.png"},
    {"name":"Linux do","uri":"https://linux.do/","icon":"/icons/linuxdo.webp"},
    {"name":"NodeSeek","uri":"https://www.nodeseek.com/","icon":"/icons/nodeseek.png"},
    {"name":"Github","uri":"https://www.github.com/","icon":"/icons/github.png"},
    {"name":"Bangumi","uri":"https://bgm.tv/","icon":"/icons/bgmtv.png"}]}
];

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

        // Persisted settings (localStorage)
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
        bgDataUrl: Alpine.$persist(null).as('pinecone-bg'),

        init() {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                if (localStorage.getItem('pinecone-iconSize') === null) {
                    this.iconSize = 48;
                    this.iconGap = 8;
                    this.textSize = 14;
                    this.textIconGap = 8;
                    this.gridColumns = 4;
                } else {
                    if (this.iconSize > 48) this.iconSize = 48;
                    if (this.iconGap > 8) this.iconGap = 8;
                    if (this.textSize > 14) this.textSize = 14;
                    if (this.textIconGap > 8) this.textIconGap = 8;
                    if (this.gridColumns > 4) this.gridColumns = 4;
                }
            }

            this.loadServices();
            this.applyCssVars();
            this.applyBg();

            const numericKeys = ['iconSize','iconRadius','iconOpacity','iconGap','textSize',
                'textColor','maxWidth','textIconGap','textPosition','gridColumns','settingsTextSize'];
            numericKeys.forEach(k => this.$watch(k, () => this.applyCssVars()));
            this.$watch('bgDataUrl', () => this.applyBg());
        },

        loadServices() {
            this.error = false;
            fetch('services.json')
                .then(r => { if (!r.ok) throw Error(); return r.json(); })
                .then(d => { this.services = d; })
                .catch(() => {
                    this.services = INLINE_SERVICES;
                    if (!INLINE_SERVICES.length) this.error = true;
                });
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
            const reader = new FileReader();
            reader.onload = (ev) => { this.bgDataUrl = ev.target.result; };
            reader.readAsDataURL(file);
        },

        resetBg() {
            this.bgDataUrl = null;
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

        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.action === 'newContentAvailable') {
                if (confirm('内容已更新，是否立即刷新页面？')) window.location.reload();
            }
        });
    }).catch(err => {
        console.error('ServiceWorker 注册失败:', err);
    });
}
