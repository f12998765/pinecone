// Default settings constant
const DEFAULT_SETTINGS = {
    iconSize: 64,
    iconRadius: 12,
    iconOpacity: 100,
    iconGap: 12,
    textSize: 18,
    textColor: '#1a1a1a',
    maxWidth: 1421,
    showNames: true,
    textIconGap: 12,
    textPosition: 'column',
    backgroundImage: null,
    gridColumns: 8,
    hoverEffect: 2,
    settingsTextSize: 14
};

// Responsive defaults
function getResponsiveDefaults() {
    const isMobile = window.innerWidth <= 640;
    return {
        iconSize: isMobile ? 48 : 64,
        iconGap: isMobile ? 8 : 12,
        textSize: isMobile ? 14 : 18,
        textIconGap: isMobile ? 8 : 12,
        gridColumns: isMobile ? 4 : 8
    };
}

// Apply responsive defaults on load
const responsiveDefaults = getResponsiveDefaults();
Object.keys(responsiveDefaults).forEach(key => {
    DEFAULT_SETTINGS[key] = responsiveDefaults[key];
});

// IndexedDB initialization
let db;
const dbName = "navigationDB";
const request = indexedDB.open(dbName, 1);

request.onerror = (event) => {
    console.error("Database error:", event.target.error);
};

request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings");
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    loadSettings();
};

// Settings configuration map
const SETTINGS_CONFIG = {
    iconSize: { cssVar: '--icon-size', unit: 'px', inputId: 'icon-size' },
    iconRadius: { cssVar: '--icon-radius', unit: 'px', inputId: 'icon-radius' },
    iconOpacity: { cssVar: '--icon-opacity', unit: '', inputId: 'icon-opacity', transform: v => v / 100 },
    iconGap: { cssVar: '--icon-gap', unit: 'px', inputId: 'icon-gap' },
    textSize: { cssVar: '--text-size', unit: 'px', inputId: 'text-size' },
    textColor: { cssVar: '--text-color', unit: '', inputId: 'custom-color' },
    maxWidth: { cssVar: '--max-width', unit: 'px', inputId: 'max-width' },
    textIconGap: { cssVar: '--text-icon-gap', unit: 'px', inputId: 'text-icon-gap' },
    textPosition: { cssVar: '--text-position', unit: '', inputId: 'text-position', isAttribute: true },
    gridColumns: { cssVar: '--grid-columns', unit: '', inputId: 'grid-columns' },
    settingsTextSize: { cssVar: '--settings-text-size', unit: 'px', inputId: 'settings-text-size' }
};

// Track current effect to optimize class switching
let currentEffect = 2;
let currentBgObjectURL = null;
let servicesLoaded = false;
let pendingTextPosition = null;

// Load all settings from IndexedDB in one transaction
function loadSettings() {
    const transaction = db.transaction(["settings"], "readonly");
    const store = transaction.objectStore("settings");
    const request = store.getAll();

    request.onsuccess = () => {
        const allEntries = request.result;
        const settings = {};

        if (allEntries.length > 0) {
            // Use cursor to get key-value pairs reliably
            const cursorTx = db.transaction(["settings"], "readonly");
            const cursorStore = cursorTx.objectStore("settings");
            const cursorReq = cursorStore.openCursor();

            cursorReq.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    settings[cursor.key] = cursor.value;
                    cursor.continue();
                } else {
                    // All settings loaded, apply them
                    Object.entries(settings).forEach(([key, value]) => {
                        applySetting(key, value);
                    });
                }
            };
        } else {
            // No saved settings, apply defaults
            Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
                applySetting(key, value);
                saveSetting(key, value).catch(error => {
                    console.error(`保存默认设置失败: ${key}`, error);
                });
            });
        }
    };
}

// Apply a single setting
function applySetting(key, value) {
    if (key === 'backgroundImage') {
        if (value) {
            if (value instanceof Blob) {
                if (currentBgObjectURL) {
                    URL.revokeObjectURL(currentBgObjectURL);
                }
                currentBgObjectURL = URL.createObjectURL(value);
                document.body.style.backgroundImage = `url(${currentBgObjectURL})`;
            } else {
                document.body.style.backgroundImage = `url(${value})`;
            }
            document.body.classList.add('custom-bg');
        } else {
            if (currentBgObjectURL) {
                URL.revokeObjectURL(currentBgObjectURL);
                currentBgObjectURL = null;
            }
            document.body.style.backgroundImage = '';
            document.body.classList.remove('custom-bg');
        }
        return;
    }

    if (key === 'hoverEffect') {
        applyEffect(value);
        updateEffectSelector(value);
        return;
    }

    if (key === 'showNames') {
        const el = document.getElementById('show-names');
        if (el) el.checked = value;
        document.querySelectorAll('.service-name').forEach(nameEl => {
            nameEl.style.display = value ? '' : 'none';
        });
        return;
    }

    if (key === 'textPosition') {
        pendingTextPosition = value;
        document.documentElement.style.setProperty('--text-position', value);
        const el = document.getElementById('text-position');
        if (el) el.value = value;
        document.querySelectorAll('.service-link').forEach(linkEl => {
            linkEl.setAttribute('data-text-position', value);
        });
        return;
    }

    if (key === 'iconOpacity') {
        // Normalize old values (0-1 range) to new range (0-100)
        let normalizedValue = value;
        if (typeof value === 'number' && value <= 1 && value >= 0) {
            normalizedValue = Math.round(value * 100);
            // Save normalized value
            saveSetting('iconOpacity', normalizedValue).catch(() => {});
        }
        const opacityValue = normalizedValue / 100;
        document.documentElement.style.setProperty('--icon-opacity', opacityValue);
        const el = document.getElementById('icon-opacity');
        if (el) el.value = normalizedValue;
        return;
    }

    // Handle standard CSS variable settings
    const config = SETTINGS_CONFIG[key];
    if (config) {
        const cssValue = config.transform ? config.transform(value) : value;
        document.documentElement.style.setProperty(config.cssVar, cssValue + config.unit);
        const inputEl = document.getElementById(config.inputId);
        if (inputEl) inputEl.value = value;
    }
}

// Save setting to IndexedDB
function saveSetting(key, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["settings"], "readwrite");
        const store = transaction.objectStore("settings");
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Update all display values
function updateDisplayValues() {
    const mappings = [
        ['icon-size', 'icon-size-value', 'px'],
        ['icon-radius', 'icon-radius-value', 'px'],
        ['icon-opacity', 'icon-opacity-value', '%'],
        ['icon-gap', 'icon-gap-value', 'px'],
        ['text-size', 'text-size-value', 'px'],
        ['text-icon-gap', 'text-icon-gap-value', 'px'],
        ['max-width', 'max-width-value', 'px'],
        ['grid-columns', 'grid-columns-value', ''],
        ['settings-text-size', 'settings-text-size-value', 'px']
    ];

    mappings.forEach(([inputId, displayId, suffix]) => {
        const input = document.getElementById(inputId);
        const display = document.getElementById(displayId);
        if (input && display) {
            display.textContent = input.value + suffix;
        }
    });
}

// Validate URI to prevent javascript: protocol injection
function isValidURI(uri) {
    if (!uri || typeof uri !== 'string') return false;
    const trimmed = uri.trim().toLowerCase();
    return trimmed.startsWith('http://') ||
           trimmed.startsWith('https://') ||
           trimmed.startsWith('/') ||
           trimmed.startsWith('./') ||
           trimmed.startsWith('../');
}

// Escape HTML to prevent XSS
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Load services from JSON
function loadServices() {
    fetch('services.json')
        .then(res => {
            if (!res.ok) throw new Error('Network response was not ok');
            return res.json();
        })
        .then(data => renderServices(data))
        .catch(handleLoadError);
}

// Render services
function renderServices(data) {
    const container = document.getElementById('services-container');
    container.innerHTML = '';

    const fragment = document.createDocumentFragment();

    data.forEach(category => {
        const categoryElement = document.createElement('div');
        categoryElement.className = 'category-section';

        const titleEl = document.createElement('h2');
        titleEl.className = 'category-title';
        titleEl.textContent = category.category;
        categoryElement.appendChild(titleEl);

        const servicesGrid = document.createElement('div');
        servicesGrid.className = 'grid';

        category.services.forEach(service => {
            if (!service.uri || !service.name) return;

            const serviceElement = document.createElement('a');
            serviceElement.href = isValidURI(service.uri) ? service.uri : '#';
            serviceElement.className = 'service-link';
            const textPos = pendingTextPosition ||
                document.getElementById('text-position')?.value ||
                DEFAULT_SETTINGS.textPosition;
            serviceElement.setAttribute('data-text-position', textPos);
            serviceElement.setAttribute('aria-label', `打开 ${escapeHTML(service.name)}`);

            const img = document.createElement('img');
            img.className = 'service-icon';
            img.alt = escapeHTML(service.name);
            img.loading = 'lazy';

            // Set src with fallback
            const defaultIcon = '/favicon.svg';
            img.src = service.icon && service.icon.trim() !== '' ? service.icon : defaultIcon;

            let hasFallback = false;
            img.onerror = function() {
                if (!hasFallback && this.src !== defaultIcon) {
                    hasFallback = true;
                    this.src = defaultIcon;
                }
            };

            const nameSpan = document.createElement('span');
            nameSpan.className = 'service-name';
            nameSpan.textContent = service.name;

            serviceElement.appendChild(img);
            serviceElement.appendChild(nameSpan);
            servicesGrid.appendChild(serviceElement);
        });

        categoryElement.appendChild(servicesGrid);
        fragment.appendChild(categoryElement);
    });

    container.appendChild(fragment);

    // Ensure current hover effect is applied to newly created elements
    applyEffect(currentEffect);
}

// Error handler
function handleLoadError(error) {
    console.error('Failed to load services:', error);
    const container = document.getElementById('services-container');
    container.innerHTML = `
        <div class="error-message">
            <p>无法加载服务列表，请检查网络连接</p>
            <button id="retry-load-btn" class="retry-btn">
                重试
            </button>
        </div>
    `;
    const retryBtn = document.getElementById('retry-load-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', loadServices);
    }
}

// Select hover effect
function selectEffect(effectNum) {
    document.querySelectorAll('.effect-option').forEach(el => {
        el.classList.remove('selected');
    });
    const selected = document.querySelector(`.effect-option[data-effect="${effectNum}"]`);
    if (selected) selected.classList.add('selected');

    applyEffect(effectNum);
    saveSetting('hoverEffect', effectNum).catch(error => {
        console.error('保存悬浮效果设置失败:', error);
    });
}

// Apply hover effect - ensure elements have the current effect class
function applyEffect(effectNum) {
    const newClass = `demo-effect-${effectNum}`;

    document.querySelectorAll('.service-link').forEach(el => {
        if (!el.classList.contains(newClass)) {
            // Remove all effect classes
            for (let i = 1; i <= 15; i++) {
                el.classList.remove(`demo-effect-${i}`);
            }
            el.classList.add(newClass);
        }
    });

    currentEffect = effectNum;
}

// Update effect selector UI
function updateEffectSelector(effectNum) {
    document.querySelectorAll('.effect-option').forEach(el => {
        el.classList.toggle('selected', parseInt(el.dataset.effect) === effectNum);
    });
}

// Register slider handler
function registerSliderHandler(inputId, settingKey, suffix = '', transform = null) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('input', function () {
        const value = transform ? transform(this.value) : parseInt(this.value);
        const displayId = inputId + '-value';
        const display = document.getElementById(displayId);
        if (display) display.textContent = this.value + suffix;

        if (settingKey === 'iconOpacity') {
            document.documentElement.style.setProperty('--icon-opacity', value / 100);
        } else if (settingKey === 'settingsTextSize') {
            document.documentElement.style.setProperty('--settings-text-size', value + 'px');
        } else if (settingKey === 'textSize') {
            document.documentElement.style.setProperty('--text-size', value + 'px');
        } else if (settingKey === 'iconSize') {
            document.documentElement.style.setProperty('--icon-size', value + 'px');
        } else if (settingKey === 'iconRadius') {
            document.documentElement.style.setProperty('--icon-radius', value + 'px');
        } else if (settingKey === 'iconGap') {
            document.documentElement.style.setProperty('--icon-gap', value + 'px');
        } else if (settingKey === 'textIconGap') {
            document.documentElement.style.setProperty('--text-icon-gap', value + 'px');
        } else if (settingKey === 'maxWidth') {
            document.documentElement.style.setProperty('--max-width', value + 'px');
        } else if (settingKey === 'gridColumns') {
            document.documentElement.style.setProperty('--grid-columns', value);
        }

        saveSetting(settingKey, value).catch(error => {
            console.error(`保存设置失败: ${settingKey}`, error);
        });
    });
}

// Document ready
document.addEventListener('DOMContentLoaded', function () {
    // Settings modal handlers
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const minimizeBtn = document.getElementById('minimize-modal');
    const maximizeBtn = document.getElementById('maximize-modal');
    const modalWindow = document.getElementById('modal-window');
    const dragHandle = document.getElementById('modal-drag-handle');

    let isMaximized = false;
    let lastFocusedElement = null;

    settingsBtn.addEventListener('click', () => {
        lastFocusedElement = settingsBtn;
        settingsModal.classList.remove('hidden');
        if (modalWindow) {
            modalWindow.classList.remove('minimized');
            if (isMaximized) {
                isMaximized = false;
                modalWindow.classList.remove('maximized');
            }
        }
        // Focus first interactive element
        setTimeout(() => {
            const firstBtn = modalWindow?.querySelector('.effect-option, .tab-btn, button');
            if (firstBtn) firstBtn.focus();
        }, 100);
    });

    closeSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
        if (lastFocusedElement) lastFocusedElement.focus();
    });

    // Trap focus inside modal
    modalWindow?.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || settingsModal.classList.contains('hidden')) return;

        const focusable = modalWindow.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });

    // Minimize handler
    if (minimizeBtn && modalWindow) {
        minimizeBtn.addEventListener('click', () => {
            modalWindow.classList.toggle('minimized');
        });
    }

    // Maximize handler
    if (maximizeBtn && modalWindow) {
        maximizeBtn.addEventListener('click', () => {
            isMaximized = !isMaximized;
            modalWindow.classList.toggle('maximized', isMaximized);
        });
    }

    // Draggable window
    if (dragHandle && modalWindow) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        let isMobile = window.innerWidth <= 640;

        window.addEventListener('resize', () => {
            isMobile = window.innerWidth <= 640;
        });

        dragHandle.addEventListener('mousedown', startDrag);
        dragHandle.addEventListener('touchstart', startDragTouch, { passive: false });

        function startDrag(e) {
            if (isMobile || e.target.closest('.window-btn')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            if (!modalWindow.classList.contains('dragging') && !modalWindow.classList.contains('maximized')) {
                const rect = modalWindow.getBoundingClientRect();
                modalWindow.style.left = rect.left + 'px';
                modalWindow.style.top = rect.top + 'px';
                modalWindow.style.right = 'auto';
            }

            startLeft = parseFloat(modalWindow.style.left) || modalWindow.offsetLeft;
            startTop = parseFloat(modalWindow.style.top) || modalWindow.offsetTop;
            modalWindow.classList.add('dragging');

            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', stopDrag);
        }

        function startDragTouch(e) {
            if (isMobile) return;
            if (e.touches.length === 1) {
                if (e.target.closest('.window-btn')) return;
                isDragging = true;
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;

                if (!modalWindow.classList.contains('dragging') && !modalWindow.classList.contains('maximized')) {
                    const rect = modalWindow.getBoundingClientRect();
                    modalWindow.style.left = rect.left + 'px';
                    modalWindow.style.top = rect.top + 'px';
                    modalWindow.style.right = 'auto';
                }

                startLeft = parseFloat(modalWindow.style.left) || modalWindow.offsetLeft;
                startTop = parseFloat(modalWindow.style.top) || modalWindow.offsetTop;
                modalWindow.classList.add('dragging');

                document.addEventListener('touchmove', onDragTouch, { passive: false });
                document.addEventListener('touchend', stopDragTouch);
            }
        }

        function onDrag(e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            modalWindow.style.left = (startLeft + dx) + 'px';
            modalWindow.style.top = (startTop + dy) + 'px';
        }

        function onDragTouch(e) {
            if (!isDragging || e.touches.length !== 1) return;
            e.preventDefault();
            const touch = e.touches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            modalWindow.style.left = (startLeft + dx) + 'px';
            modalWindow.style.top = (startTop + dy) + 'px';
        }

        function stopDrag() {
            isDragging = false;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
        }

        function stopDragTouch() {
            isDragging = false;
            document.removeEventListener('touchmove', onDragTouch);
            document.removeEventListener('touchend', stopDragTouch);
        }
    }

    // Tab switching
    const tabNav = document.querySelector('.tab-nav');
    if (tabNav) {
        tabNav.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.tab-btn');
            if (!tabBtn) return;

            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            tabBtn.classList.add('active');

            const tabId = tabBtn.dataset.tab;
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            const targetPane = document.getElementById('tab-' + tabId);
            if (targetPane) targetPane.classList.add('active');
        });
    }

    // ESC to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
            settingsModal.classList.add('hidden');
            if (lastFocusedElement) lastFocusedElement.focus();
        }
    });

    // Close modal by clicking background
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
            if (lastFocusedElement) lastFocusedElement.focus();
        }
    });

    // Effect grid event delegation
    const effectGrid = document.querySelector('.effect-grid');
    if (effectGrid) {
        effectGrid.addEventListener('click', (e) => {
            const option = e.target.closest('.effect-option');
            if (option) {
                selectEffect(parseInt(option.dataset.effect));
            }
        });
    }

    // Register all slider handlers
    registerSliderHandler('icon-size', 'iconSize', 'px');
    registerSliderHandler('icon-radius', 'iconRadius', 'px');
    registerSliderHandler('icon-opacity', 'iconOpacity', '%');
    registerSliderHandler('icon-gap', 'iconGap', 'px');
    registerSliderHandler('text-size', 'textSize', 'px');
    registerSliderHandler('settings-text-size', 'settingsTextSize', 'px');
    registerSliderHandler('text-icon-gap', 'textIconGap', 'px');
    registerSliderHandler('max-width', 'maxWidth', 'px');
    registerSliderHandler('grid-columns', 'gridColumns', '');

    // Show names handler
    const showNames = document.getElementById('show-names');
    if (showNames) {
        showNames.addEventListener('change', function () {
            const value = this.checked;
            document.querySelectorAll('.service-name').forEach(el => {
                el.style.display = value ? '' : 'none';
            });
            saveSetting('showNames', value).catch(error => {
                console.error('保存显示名称设置失败:', error);
            });
        });
    }

    // Custom color input handler
    const applyColor = document.getElementById('apply-color');
    if (applyColor) {
        applyColor.addEventListener('click', function () {
            const colorInput = document.getElementById('custom-color');
            const color = colorInput.value;

            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                document.querySelectorAll('.color-option').forEach(el => {
                    el.classList.remove('selected');
                });
                document.documentElement.style.setProperty('--text-color', color);
                saveSetting('textColor', color).catch(error => {
                    console.error('保存文字颜色设置失败:', error);
                });
                colorInput.classList.remove('border-red-500');
            } else {
                colorInput.classList.add('border-red-500');
            }
        });
    }

    // Color picker handler
    document.querySelectorAll('.color-option').forEach(el => {
        el.addEventListener('click', function () {
            document.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
            const color = this.dataset.color;
            document.documentElement.style.setProperty('--text-color', color);
            saveSetting('textColor', color).catch(error => {
                console.error('保存文字颜色设置失败:', error);
            });
            document.getElementById('custom-color').value = color;
        });
    });

    // Text position handler
    const textPosition = document.getElementById('text-position');
    if (textPosition) {
        textPosition.addEventListener('change', function () {
            const value = this.value;
            document.querySelectorAll('.service-link').forEach(el => {
                el.setAttribute('data-text-position', value);
            });
            document.documentElement.style.setProperty('--text-position', value);
            saveSetting('textPosition', value).catch(error => {
                console.error('保存文字位置设置失败:', error);
            });
        });
    }

    // Background image handler
    const bgUpload = document.getElementById('bg-upload');
    if (bgUpload) {
        bgUpload.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                if (currentBgObjectURL) {
                    URL.revokeObjectURL(currentBgObjectURL);
                }
                currentBgObjectURL = URL.createObjectURL(file);
                document.body.style.backgroundImage = `url(${currentBgObjectURL})`;
                document.body.classList.add('custom-bg');

                saveSetting('backgroundImage', file).catch(error => {
                    console.error('保存背景图片设置失败:', error);
                });
            }
        });
    }

    // Reset background handler
    const resetBg = document.getElementById('reset-bg');
    if (resetBg) {
        resetBg.addEventListener('click', function () {
            if (currentBgObjectURL) {
                URL.revokeObjectURL(currentBgObjectURL);
                currentBgObjectURL = null;
            }
            document.body.style.backgroundImage = '';
            document.body.classList.remove('custom-bg');
            saveSetting('backgroundImage', null).catch(error => {
                console.error('保存背景图片设置失败:', error);
            });
        });
    }

    // Reset all handler
    const resetAll = document.getElementById('reset-all');
    if (resetAll) {
        resetAll.addEventListener('click', function () {
            const transaction = db.transaction(["settings"], "readwrite");
            const store = transaction.objectStore("settings");
            store.clear();

            Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
                applySetting(key, value);
                saveSetting(key, value).catch(error => {
                    console.error(`保存设置失败: ${key}`, error);
                });
            });

            if (currentBgObjectURL) {
                URL.revokeObjectURL(currentBgObjectURL);
                currentBgObjectURL = null;
            }
            document.body.style.backgroundImage = '';
            document.body.classList.remove('custom-bg');

            updateDisplayValues();
        });
    }

    // Load services
    loadServices();
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
                        console.log('检测到新版本 Service Worker');
                        if (confirm('检测到新版本，是否立即刷新页面以获取最新内容？')) {
                            newWorker.postMessage({ action: 'skipWaiting' });
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'activated') {
                                    window.location.reload();
                                }
                            });
                        }
                    }
                };
            }
        };

        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.action === 'newContentAvailable') {
                console.log('收到新内容可用通知');
                if (confirm('内容已更新，是否立即刷新页面？')) {
                    window.location.reload();
                }
            }
        });
    }).catch(err => {
        console.error('ServiceWorker 注册失败:', err);
    });
}
