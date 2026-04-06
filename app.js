// Default settings constant
const DEFAULT_SETTINGS = {
    iconSize: 64,
    iconRadius: 12,
    iconOpacity: 1,
    iconGap: 12,
    textSize: 18,
    textColor: '#1a1a1a',
    maxWidth: 1421,
    showNames: true,
    textIconGap: 12,
    textPosition: 'column',
    backgroundImage: null,
    gridColumns: 8
};

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

// Load settings from IndexedDB
function loadSettings() {
    const transaction = db.transaction(["settings"], "readonly");
    const store = transaction.objectStore("settings");
    const request = store.getAllKeys();

    request.onsuccess = () => {
        const keys = request.result;
        if (keys.length > 0) {
            keys.forEach(key => {
                const valueRequest = store.get(key);
                valueRequest.onsuccess = () => {
                    const value = valueRequest.result;
                    applySetting(key, value);
                };
            });
        } else {
            // If no saved settings, apply default settings
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
    switch (key) {
        case 'backgroundImage':
            if (value) {
                document.body.style.backgroundImage = `url(${value})`;
                document.body.classList.add('custom-bg');
            }
            break;
        case 'iconSize':
            document.documentElement.style.setProperty('--icon-size', value + 'px');
            $('#icon-size').val(value);
            break;
        case 'iconRadius':
            document.documentElement.style.setProperty('--icon-radius', value + 'px');
            $('#icon-radius').val(value);
            break;
        case 'iconOpacity':
            document.documentElement.style.setProperty('--icon-opacity', value);
            $('#icon-opacity').val(value * 100);
            break;
        case 'iconGap':
            document.documentElement.style.setProperty('--icon-gap', value + 'px');
            $('#icon-gap').val(value);
            break;
        case 'textSize':
            document.documentElement.style.setProperty('--text-size', value + 'px');
            $('#text-size').val(value);
            break;
        case 'textColor':
            document.documentElement.style.setProperty('--text-color', value);
            $('#custom-color').val(value);
            break;
        case 'maxWidth':
            document.documentElement.style.setProperty('--max-width', value + 'px');
            $('#max-width').val(value);
            break;
        case 'textIconGap':
            document.documentElement.style.setProperty('--text-icon-gap', value + 'px');
            $('#text-icon-gap').val(value);
            break;
        case 'textPosition':
            document.documentElement.style.setProperty('--text-position', value);
            $('#text-position').val(value);
            $('.service-link').attr('data-text-position', value);
            break;
        case 'gridColumns':
            document.documentElement.style.setProperty('--grid-columns', value);
            $('#grid-columns').val(value);
            break;
        case 'showNames':
            $('#show-names').prop('checked', value);
            $('.service-name').toggle(value);
            break;
    }
    updateDisplayValues();
    updateCategoryColor();
}

// Save setting to IndexedDB
function saveSetting(key, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["settings"], "readwrite");
        const store = transaction.objectStore("settings");
        const request = store.put(value, key);

        request.onsuccess = () => {
            console.log(`保存设置成功: ${key} = ${value}`);
            resolve();
        };

        request.onerror = () => {
            console.error(`保存设置失败: ${key}`);
            reject(request.error);
        };
    });
}

// Update all display values
function updateDisplayValues() {
    $('#icon-size-value').text($('#icon-size').val() + 'px');
    $('#icon-radius-value').text($('#icon-radius').val() + 'px');
    $('#icon-opacity-value').text($('#icon-opacity').val() + '%');
    $('#icon-gap-value').text($('#icon-gap').val() + 'px');
    $('#text-size-value').text($('#text-size').val() + 'px');
    $('#text-icon-gap-value').text($('#text-icon-gap').val() + 'px');
    $('#max-width-value').text($('#max-width').val() + 'px');
    $('#grid-columns-value').text($('#grid-columns').val());
}

// Update category title color
function updateCategoryColor() {
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
    $('.category-section h2').css('color', textColor);
}

// Lazy load images
function lazyLoadImages() {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
            }
        });
    });

    document.querySelectorAll('img.lazy').forEach(img => {
        imageObserver.observe(img);
    });
}

// Load services from JSON
function loadServices() {
    const timestamp = Date.now();
    $.getJSON(`services.json?t=${timestamp}`, function (data) {
        renderServices(data);
    }).fail(handleLoadError);
}

// Render services
function renderServices(data) {
    const container = $('#services-container');
    container.empty();

    const fragment = document.createDocumentFragment();

    data.forEach(category => {
        const categoryElement = document.createElement('div');
        categoryElement.className = 'category-section';
        categoryElement.innerHTML = `
            <h2 class="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800">
                <span>${category.category}</span>
            </h2>
            <div class="grid"></div>
        `;

        const servicesGrid = categoryElement.querySelector('.grid');

        category.services.forEach(service => {
            const serviceElement = document.createElement('a');
            serviceElement.href = service.uri;
            serviceElement.className = 'service-link';
            serviceElement.setAttribute('data-text-position', $('#text-position').val() || 'row');
            serviceElement.setAttribute('aria-label', service.name);
            serviceElement.setAttribute('role', 'link');

            serviceElement.innerHTML = `
                <img data-src="${service.icon}" 
                     alt="${service.name}" 
                     class="service-icon lazy"
                     src="/icons/sky.png">
                <span class="service-name">${service.name}</span>
            `;

            servicesGrid.appendChild(serviceElement);
        });

        fragment.appendChild(categoryElement);
    });

    container.append(fragment);
    lazyLoadImages();
}

// Error handler
function handleLoadError(jqXHR, textStatus, errorThrown) {
    console.error('Failed to load services:', errorThrown);
    $('#services-container').html(`
        <div class="text-center text-red-500 py-8">
            <p>加载失败</p>
            <button onclick="loadServices()" class="mt-4 px-4 py-2 bg-red-100 rounded">
                重试
            </button>
        </div>
    `);
}

// Document ready
$(document).ready(function () {
    // Settings modal handlers
    $('#settings-btn').click(() => $('#settings-modal').removeClass('hidden'));
    $('#close-settings').click(() => $('#settings-modal').addClass('hidden'));

    // Icon size handler
    $('#icon-size').on('input', function () {
        const value = parseInt($(this).val());
        document.documentElement.style.setProperty('--icon-size', value + 'px');
        $('#icon-size-value').text(value + 'px');
        saveSetting('iconSize', value).catch(error => {
            console.error('保存图标大小设置失败:', error);
        });
    });

    // Icon radius handler
    $('#icon-radius').on('input', function () {
        const value = parseInt($(this).val());
        document.documentElement.style.setProperty('--icon-radius', value + 'px');
        $('#icon-radius-value').text(value + 'px');
        saveSetting('iconRadius', value).catch(error => {
            console.error('保存图标圆角设置失败:', error);
        });
    });

    // Icon opacity handler
    $('#icon-opacity').on('input', function () {
        const value = parseInt($(this).val());
        document.documentElement.style.setProperty('--icon-opacity', value / 100);
        $('#icon-opacity-value').text(value + '%');
        saveSetting('iconOpacity', value / 100).catch(error => {
            console.error('保存图标不透明度设置失败:', error);
        });
    });

    // Icon gap handler
    $('#icon-gap').on('input', function () {
        const value = parseInt($(this).val());
        document.documentElement.style.setProperty('--icon-gap', value + 'px');
        $('#icon-gap-value').text(value + 'px');
        saveSetting('iconGap', value).catch(error => {
            console.error('保存图标间距设置失败:', error);
        });
    });

    // Text size handler
    $('#text-size').on('input', function () {
        const value = parseInt($(this).val());
        document.documentElement.style.setProperty('--text-size', value + 'px');
        $('#text-size-value').text(value + 'px');
        saveSetting('textSize', value).catch(error => {
            console.error('保存文字大小设置失败:', error);
        });
    });

    // Show names handler
    $('#show-names').change(function () {
        const value = $(this).prop('checked');
        $('.service-name').toggle(value);
        saveSetting('showNames', value).catch(error => {
            console.error('保存显示名称设置失败:', error);
        });
    });

    // Custom color input handler
    $('#apply-color').click(function () {
        const colorInput = $('#custom-color');
        const color = colorInput.val();

        if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
            $('.color-option').removeClass('selected');
            document.documentElement.style.setProperty('--text-color', color);
            saveSetting('textColor', color).catch(error => {
                console.error('保存文字颜色设置失败:', error);
            });
            colorInput.removeClass('border-red-500');
            updateCategoryColor();
        } else {
            colorInput.addClass('border-red-500');
        }
    });

    // Color picker handler
    $('.color-option').click(function () {
        $('.color-option').removeClass('selected');
        $(this).addClass('selected');
        const color = $(this).data('color');
        document.documentElement.style.setProperty('--text-color', color);
        saveSetting('textColor', color).catch(error => {
            console.error('保存文字颜色设置失败:', error);
        });
        $('#custom-color').val(color);
        updateCategoryColor();
    });

    // Max width handler
    $('#max-width').on('input', function () {
        const value = parseInt($(this).val());
        document.documentElement.style.setProperty('--max-width', value + 'px');
        $('#max-width-value').text(value + 'px');
        saveSetting('maxWidth', value).catch(error => {
            console.error('保存最大宽度设置失败:', error);
        });
    });

    // Background image handler
    $('#bg-upload').change(function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const base64Image = e.target.result;
                document.body.style.backgroundImage = `url(${base64Image})`;
                document.body.classList.add('custom-bg');
                saveSetting('backgroundImage', base64Image).catch(error => {
                    console.error('保存背景图片设置失败:', error);
                });
            };
            reader.readAsDataURL(file);
        }
    });

    // Reset background handler
    $('#reset-bg').click(function () {
        document.body.style.backgroundImage = '';
        document.body.classList.remove('custom-bg');
        saveSetting('backgroundImage', null).catch(error => {
            console.error('保存背景图片设置失败:', error);
        });
    });

    // Text position handler
    $('#text-position').change(function () {
        const value = $(this).val();
        $('.service-link').attr('data-text-position', value);
        document.documentElement.style.setProperty('--text-position', value);
        saveSetting('textPosition', value).catch(error => {
            console.error('保存文字位置设置失败:', error);
        });
    });

    // Text-icon gap handler
    $('#text-icon-gap').on('input', function () {
        const value = parseInt($(this).val());
        document.documentElement.style.setProperty('--text-icon-gap', value + 'px');
        $('#text-icon-gap-value').text(value + 'px');
        saveSetting('textIconGap', value).catch(error => {
            console.error('保存文字间距设置失败:', error);
        });
    });

    // Grid columns handler
    $('#grid-columns').on('input', function () {
        const value = parseInt($(this).val());
        document.documentElement.style.setProperty('--grid-columns', value);
        $('#grid-columns-value').text(value);
        saveSetting('gridColumns', value).catch(error => {
            console.error('保存网格设置失败:', error);
        });
    });

    // Reset all handler
    $('#reset-all').click(function () {
        const transaction = db.transaction(["settings"], "readwrite");
        const store = transaction.objectStore("settings");
        store.clear();

        Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
            applySetting(key, value);
            saveSetting(key, value).catch(error => {
                console.error(`保存设置失败: ${key}`, error);
            });
        });

        document.body.style.backgroundImage = '';
        document.body.classList.remove('custom-bg');

        updateDisplayValues();
        updateCategoryColor();
    });

    // Load services
    loadServices();

    // Close modal by clicking background
    $('#settings-modal').click(function (e) {
        if (e.target === this) {
            $(this).addClass('hidden');
        }
    });

    // Close modal by pressing ESC
    $(document).keydown(function (e) {
        if (e.key === 'Escape') {
            $('#settings-modal').addClass('hidden');
        }
    });
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
