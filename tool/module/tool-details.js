let toolsData = {};

async function getToolJson() {
    try {
        const response = await fetch('./module/tools.json');
        return await response.json();
    } catch (err) {
        console.error('tools.json の読み込みに失敗しました', err);
        return {};
    }
}


function getToolDetails(id) {
    return toolsData[id] || null;
}

window.toolsRepository = {
    getToolDetails: getToolDetails,
    getAllTools: function () {
        return Object.keys(toolsData).map(key => ({
            id: key,
            ...toolsData[key]
        }));
    }
};

let platformModal = null;
let currentToolDataForMainModal = null;

function ensurePlatformModalExists() {
    if (platformModal) return;

    platformModal = document.createElement('div');
    platformModal.id = 'platform-modal';
    platformModal.style.display = 'none'; // Start hidden
    platformModal.style.position = 'fixed';
    platformModal.style.left = '0';
    platformModal.style.top = '0';
    platformModal.style.width = '100vw';
    platformModal.style.height = '100vh';
    platformModal.style.background = 'rgba(0,0,0,0.6)';
    platformModal.style.zIndex = '1050';
    platformModal.style.alignItems = 'center';
    platformModal.style.justifyContent = 'center';

    platformModal.innerHTML = `
        <div style="background: var(--background-color, #fff); color: var(--text-color, #333); max-width: 400px; width: 90%; margin: auto; padding: 2em; border-radius: 8px; position: relative; display: flex; flex-direction: column; align-items: center; box-shadow: 0 5px 15px rgba(0,0,0,0.2);">
            <h3 style="margin-top: 0; margin-bottom: 1.5em; text-align: center;">プラットフォームを選択</h3>
            <div id="platform-btns" style="width: 100%; display: grid; gap: 0.75em;"></div>
            <button id="platform-modal-close" style="margin-top: 1.5em; padding: 0.6em 1.2em; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">閉じる</button>
        </div>
    `;
    document.body.appendChild(platformModal);

    const closeButton = platformModal.querySelector('#platform-modal-close');
    const modalContent = platformModal.querySelector('div');

    closeButton.onclick = hidePlatformModal;

    platformModal.addEventListener('click', (e) => {
        if (e.target === platformModal) {
            hidePlatformModal();
        }
    });

    modalContent.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

function hidePlatformModal() {
    if (platformModal) {
        platformModal.style.display = 'none';
    }
}

function showPlatformSelectionModal(toolData) {
    ensurePlatformModalExists();

    if (!toolData) {
        console.error("showPlatformSelectionModal: toolData is missing.");
        return;
    }

    const platformUrls = Object.entries(toolData)
        .filter(([key, val]) => key.startsWith('downloadUrl_') && val)
        .map(([key, val]) => {
            const platform = key.replace('downloadUrl_', '');
            const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
            return { platform: platformLabel, url: val };
        });

    if (platformUrls.length === 0) {
        console.warn(`No platform-specific download URLs found for tool: ${toolData.title}`);
        return;
    }

    const btnsDiv = platformModal.querySelector('#platform-btns');
    const modalTitleEl = platformModal.querySelector('h3');

    if (!btnsDiv || !modalTitleEl) {
        console.error("Platform modal elements (#platform-btns or h3) not found!");
        return;
    }

    modalTitleEl.textContent = `「${toolData.title}」のプラットフォームを選択`;
    btnsDiv.innerHTML = '';

    platformUrls.forEach(({ platform, url }) => {
        const btn = document.createElement('button');
        btn.textContent = `${platform} 版ダウンロード`;
        btn.classList.add('btn', 'btn-secondary');
        btn.style.padding = '0.8em 1.2em';
        btn.style.cursor = 'pointer';
        btn.style.width = '100%';

        btn.onclick = () => {
            window.open(url, '_blank');
            hidePlatformModal();
        };
        btnsDiv.appendChild(btn);
    });

    platformModal.style.display = 'flex'; // Show the modal
}

document.addEventListener('DOMContentLoaded', async function () {
    const data = await getToolJson();
    console.log(JSON.stringify(data))
    toolsData = data
    ensurePlatformModalExists();
    initializeToolModals();
    initializeFilters();
});

function initializeToolModals() {
    const toolGrid = document.querySelector('.tool-grid');
    const modal = document.getElementById('tool-detail-modal');
    const modalClose = document.getElementById('modal-close');

    const modalTitle = document.getElementById('modal-title');
    const modalImage = document.getElementById('modal-image');
    const modalDescription = document.getElementById('modal-description');
    const modalCategory = document.getElementById('modal-category');
    const modalVersion = document.getElementById('modal-version');
    const modalUpdated = document.getElementById('modal-updated');
    const modalDownloadBtn = document.getElementById('modal-download');
    const modalDocBtn = document.getElementById('modal-docs');

    if (toolGrid && modal && modalTitle) {
        toolGrid.addEventListener('click', function (e) {
            const card = e.target.closest('.tool-card');

            if (card && !e.target.closest('.btn')) {
                const toolId = card.getAttribute('data-id');
                const toolData = window.toolsRepository.getToolDetails(toolId);
                currentToolDataForMainModal = toolData;

                if (toolData) {
                    modalTitle.textContent = toolData.title;
                    modalImage.src = toolData.imageLarge || toolData.image;
                    modalImage.alt = toolData.title;
                    modalDescription.innerHTML = toolData.detailedDescription || toolData.description;
                    modalCategory.textContent = toolData.category || 'N/A';
                    modalVersion.textContent = toolData.version || 'N/A';
                    modalUpdated.textContent = toolData.updated || 'N/A';

                    if (toolData.downloadUrl) {
                        modalDownloadBtn.href = toolData.downloadUrl;
                        modalDownloadBtn.style.display = 'inline-flex';
                        modalDownloadBtn.removeAttribute('data-requires-platform-selection');
                    } else {
                        const hasPlatformUrls = Object.keys(toolData).some(key => key.startsWith('downloadUrl_'));
                        if (hasPlatformUrls) {
                            modalDownloadBtn.href = "#";
                            modalDownloadBtn.style.display = 'inline-flex';
                            modalDownloadBtn.setAttribute('data-requires-platform-selection', 'true');
                        } else {
                            modalDownloadBtn.style.display = 'none';
                            modalDownloadBtn.removeAttribute('data-requires-platform-selection');
                        }
                    }

                    if (toolData.docsUrl) {
                        modalDocBtn.href = toolData.docsUrl;
                        modalDocBtn.style.display = 'inline-flex';
                    } else {
                        modalDocBtn.style.display = 'none';
                    }

                    modal.classList.add('show');
                    document.body.style.overflow = 'hidden';
                } else {
                    console.error(`Tool data not found for ID: ${toolId}`);
                    currentToolDataForMainModal = null;
                }
            }
        });
    } else {
        console.warn("Tool grid, main modal, or modal title element not found. Modal functionality disabled.");
    }

    if (modalDownloadBtn) {
        modalDownloadBtn.addEventListener('click', function (e) {
            if (this.getAttribute('data-requires-platform-selection') === 'true') {
                e.preventDefault();
                if (currentToolDataForMainModal) {
                    showPlatformSelectionModal(currentToolDataForMainModal);
                } else {
                    console.error("Cannot show platform selection: current tool data is missing.");
                }
            }
        });
    }

    const closeMainModal = () => {
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            currentToolDataForMainModal = null;
        }
    };

    if (modalClose) {
        modalClose.addEventListener('click', closeMainModal);
    }

    window.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeMainModal();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (platformModal && platformModal.style.display !== 'none') {
                hidePlatformModal();
            }
            else if (modal && modal.classList.contains('show')) {
                closeMainModal();
            }
        }
    });
}

function initializeFilters() {
    const toolSearch = document.getElementById('tool-search');
    const categoryFilter = document.getElementById('category-filter');
    const platformFilter = document.getElementById('platform-filter');
    const sortFilter = document.getElementById('sort-filter');
    const applyFilterBtn = document.getElementById('apply-filter');
    const resetFilterBtn = document.getElementById('reset-filter');
    const filterToggle = document.getElementById('filter-toggle');
    const filterContent = document.getElementById('filter-content');
    const categoryNavLinks = document.querySelectorAll('.category-nav a');
    const toolGrid = document.querySelector('.tool-grid');

    const getCurrentUiFilters = () => ({
        search: toolSearch ? toolSearch.value.trim().toLowerCase() : '',
        categoryType: categoryFilter ? categoryFilter.value : '',
        platform: platformFilter ? platformFilter.value : '',
        sort: sortFilter ? sortFilter.value : 'latest'
    });

    const getActiveNavCategory = () => {
        const activeLink = document.querySelector('.category-nav a.active');
        if (activeLink) {
            const category = activeLink.getAttribute('href').replace('#', '');
            return category === 'all' ? '' : category;
        }
        return '';
    };

    if (categoryNavLinks.length > 0 && toolGrid) {
        const allLink = Array.from(categoryNavLinks).find(link => link.getAttribute('href') === '#all');
        if (allLink && !document.querySelector('.category-nav a.active')) {
            categoryNavLinks.forEach(link => link.classList.remove('active'));
            allLink.classList.add('active');
        }
        filterTools({ sort: 'latest', categoryType: getActiveNavCategory() });
    } else if (toolGrid) {
        filterTools({ sort: 'latest' });
    }

    if (filterToggle && filterContent) {
        filterToggle.addEventListener('click', function () {
            const isHidden = filterContent.classList.toggle('hidden');
            const icon = filterToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-chevron-down', isHidden);
                icon.classList.toggle('fa-chevron-up', !isHidden);
            }
            filterToggle.setAttribute('aria-expanded', String(!isHidden));
            filterContent.setAttribute('aria-hidden', String(isHidden));
        });
        const initiallyHidden = filterContent.classList.contains('hidden');
        filterToggle.setAttribute('aria-expanded', String(!initiallyHidden));
        filterContent.setAttribute('aria-hidden', String(initiallyHidden));
    }

    categoryNavLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            categoryNavLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            const clickedCategory = this.getAttribute('href').replace('#', '');
            const categoryToFilter = clickedCategory === 'all' ? '' : clickedCategory;

            const currentUiState = getCurrentUiFilters();

            filterTools({
                ...currentUiState,
                categoryType: categoryToFilter,
            });

            if (categoryFilter) {
                categoryFilter.value = categoryToFilter;
            }
        });
    });

    if (toolSearch) {
        toolSearch.addEventListener('input', function () {
            const currentUiState = getCurrentUiFilters();
            const activeNavCategory = getActiveNavCategory();

            filterTools({
                ...currentUiState,
                search: this.value.trim().toLowerCase(),
                categoryType: activeNavCategory,
            });
        });
    }

    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', function () {
            const filtersFromUi = getCurrentUiFilters();
            const activeNavCategory = getActiveNavCategory();

            const categoryToUse = filtersFromUi.categoryType ? filtersFromUi.categoryType : activeNavCategory;

            filterTools({
                ...filtersFromUi,
                categoryType: categoryToUse,
            });

            if (filtersFromUi.categoryType) {
                categoryNavLinks.forEach(l => l.classList.remove('active'));
                const targetNavLink = document.querySelector(`.category-nav a[href="#${filtersFromUi.categoryType}"]`);
                if (targetNavLink) {
                    targetNavLink.classList.add('active');
                } else {
                    const allLink = document.querySelector('.category-nav a[href="#all"]');
                    if (allLink) allLink.classList.add('active');
                }
            }
        });
    }

    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', function () {
            if (toolSearch) toolSearch.value = '';
            if (categoryFilter) categoryFilter.value = '';
            if (platformFilter) platformFilter.value = '';
            if (sortFilter) sortFilter.value = 'latest';

            categoryNavLinks.forEach(l => l.classList.remove('active'));
            const allLink = Array.from(categoryNavLinks).find(link => link.getAttribute('href') === '#all');
            if (allLink) {
                allLink.classList.add('active');
            }

            filterTools({ search: '', categoryType: '', platform: '', sort: 'latest' });
        });
    }

    function filterTools(filters = {}) {
        if (!toolGrid) {
            console.error("Tool grid element not found. Cannot filter tools.");
            return;
        }

        const allTools = window.toolsRepository.getAllTools();
        const defaultFilters = { search: '', categoryType: '', platform: '', sort: 'latest' };
        const effectiveFilters = { ...defaultFilters, ...filters };

        let filteredTools = allTools.filter(tool => {
            const searchLower = effectiveFilters.search;
            const titleMatch = !searchLower || (tool.title && tool.title.toLowerCase().includes(searchLower));
            const descMatch = !searchLower || (tool.description && tool.description.toLowerCase().includes(searchLower));
            const searchMatch = titleMatch || descMatch;

            const categoryMatch = !effectiveFilters.categoryType || tool.categoryType === effectiveFilters.categoryType;

            const platformMatch = !effectiveFilters.platform || (tool.platform && tool.platform.split(',').map(p => p.trim()).includes(effectiveFilters.platform));

            return searchMatch && categoryMatch && platformMatch;
        });

        filteredTools.sort((a, b) => {
            if (effectiveFilters.sort === 'latest') {
                const dateA = new Date(a.updated);
                const dateB = new Date(b.updated);
                if (isNaN(dateA) && isNaN(dateB)) return 0;
                if (isNaN(dateA)) return 1;
                if (isNaN(dateB)) return -1;
                return dateB - dateA;
            } else if (effectiveFilters.sort === 'name') {
                const titleA = a.title || '';
                const titleB = b.title || '';
                return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
            }
            return 0;
        });

        updateToolGrid(filteredTools);
    }

    function updateToolGrid(tools) {
        if (!toolGrid) return;

        toolGrid.innerHTML = '';

        if (tools.length === 0) {
            toolGrid.innerHTML = `
                <div class="no-results" style="text-align: center; padding: 3em 1em; grid-column: 1 / -1; color: var(--text-color-secondary);">
                    <i class="fas fa-ghost fa-3x" style="margin-bottom: 0.5em; opacity: 0.7;"></i>
                    <h3>一致するツールが見つかりませんでした</h3>
                    <p>検索条件やフィルタを変更して、もう一度お試しください。</p>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();

        tools.forEach(tool => {
            const toolCard = document.createElement('article');
            toolCard.className = 'tool-card';
            toolCard.setAttribute('data-id', tool.id);

            const platformUrls = Object.entries(tool)
                .filter(([key, value]) => key.startsWith('downloadUrl_') && value)
                .map(([key, url]) => {
                    const platform = key.substring('downloadUrl_'.length);
                    const platformLabel = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : '不明';
                    return { platform: platformLabel, url };
                });

            let primaryDownloadUrl = tool.downloadUrl || "#";
            let requiresPlatformSelection = false;
            if (!tool.downloadUrl && platformUrls.length > 0) {
                requiresPlatformSelection = true;
            }

            const docsButtonHtml = tool.docsUrl ? `
                <a href="${tool.docsUrl}" class="btn btn-outline" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">
                    <i class="fas fa-book"></i> 詳細
                </a>` : '';

            toolCard.innerHTML = `
                <div class="tool-image">
                    <span class="tool-category">${tool.category || '未分類'}</span>
                    <img src="${tool.image || '../lib/Assets/images/placeholder.png'}" alt="${tool.title || 'Tool Image'}" loading="lazy">
                </div>
                <div class="tool-content">
                    <h3 class="tool-title">${tool.title || 'Untitled Tool'}</h3>
                    <div class="tool-meta">
                        <div>
                            <i class="fas fa-code-branch"></i>
                            <span>${tool.version || 'N/A'}</span>
                        </div>
                        <div>
                            <i class="fas fa-calendar-alt"></i>
                            <span>${tool.updated || 'N/A'}</span>
                        </div>
                    </div>
                    <p class="tool-description">${tool.description || 'No description available.'}</p>
                    <div class="tool-actions">
                        <a href="${primaryDownloadUrl}" class="btn btn-primary download-btn" ${requiresPlatformSelection ? 'data-requires-platform-selection="true"' : ''}>
                            <i class="fas fa-download"></i> ダウンロード
                        </a>
                        ${docsButtonHtml}
                    </div>
                </div>
            `;

            const downloadBtn = toolCard.querySelector('.download-btn');
            if (downloadBtn) {
                if (downloadBtn.getAttribute('data-requires-platform-selection') === 'true') {
                    downloadBtn.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        showPlatformSelectionModal(tool);
                    });
                } else if (primaryDownloadUrl !== "#") {
                    downloadBtn.addEventListener('click', function (e) {
                        e.stopPropagation();
                    });
                } else {
                    downloadBtn.classList.add('disabled');
                    downloadBtn.style.pointerEvents = 'none';
                    downloadBtn.addEventListener('click', (e) => e.preventDefault());
                }
            }

            fragment.appendChild(toolCard)
        });
        toolGrid.appendChild(fragment)
    }
}
