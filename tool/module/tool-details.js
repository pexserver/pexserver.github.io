const toolsData = {
    'tool1': {
        title: 'Markdown Editor',
        image: '../lib/Assets/images/Markdown/markdown.png',
        imageLarge: '../lib/Assets/images/Markdown/label.png',
        category: '開発ツール',
        version: '1.0.0',
        updated: '2025-04-19',
        description: 'リアルタイムでMarkdownを編集・プレビューできるWebベースのエディタです。保存、読み込み、エクスポート、共有機能も備えています。',
        detailedDescription: `
        <p>ブラウザ上で動作する高機能なMarkdownエディタです。入力したMarkdownテキストがリアルタイムでプレビューされ、直感的に文書を作成できます。</p>
        <p>Marked.jsによる高速なプレビュー更新、Prettierによるコードフォーマット、LZ-Stringを利用したURL共有など、モダンなWeb技術を活用しています。</p>

        <h4>主な機能:</h4>
        <ul>
            <li>リアルタイムMarkdown編集エリア (contenteditable)</li>
            <li>リアルタイムHTMLプレビュー (Marked.js使用)</li>
            <li>Markdownファイル (.md) としてローカルに保存</li>
            <li>ローカルからMarkdownファイル (.md) を読み込み</li>
            <li>表示中のプレビューをHTMLファイル (.html) としてエクスポート</li>
            <li>編集内容を圧縮してURLパラメータで共有 (LZ-String使用)</li>
            <li>右クリックメニューによる操作:
                <ul>
                    <li>サンプルMarkdownの挿入 (リファクター)</li>
                    <li>Markdownソースのフォーマット (Prettier使用)</li>
                    <li>プレビューを別ウィンドウで表示</li>
                </ul>
            </li>
        </ul>

        <h4>技術スタック:</h4>
        <ul>
            <li>HTML5, CSS3, JavaScript (ES6)</li>
            <li>Marked.js (Markdownパーサー)</li>
            <li>Prettier (コードフォーマッター)</li>
            <li>LZ-String (データ圧縮)</li>
        </ul>

        <h4>システム要件:</h4>
        <ul>
            <li>最新のWebブラウザ (Chrome, Firefox, Safari, Edgeなど)</li>
            <li>インターネット接続 (ライブラリ読み込み・共有機能で必要)</li>
        </ul>

        <p>特別なインストールは不要で、提供されたHTMLファイルをWebブラウザで開くだけで利用を開始できます。</p>
    `,
        downloadUrl: './File/markdown.html',
        docsUrl: './File/markdown.html',
        platform: 'web',
        categoryType: 'markdown'
    }
};

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

document.addEventListener('DOMContentLoaded', function () {
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

                if (toolData) {
                    modalTitle.textContent = toolData.title;
                    modalImage.src = toolData.imageLarge || toolData.image;
                    modalImage.alt = toolData.title;
                    modalDescription.innerHTML = toolData.detailedDescription || toolData.description;
                    modalCategory.textContent = toolData.category;
                    modalVersion.textContent = toolData.version;
                    modalUpdated.textContent = toolData.updated;

                    modalDownloadBtn.href = toolData.downloadUrl;

                    if (toolData.docsUrl) {
                        modalDocBtn.href = toolData.docsUrl;
                        modalDocBtn.style.display = 'inline-flex';
                    } else {
                        modalDocBtn.style.display = 'none';
                    }

                    modal.classList.add('show');
                    document.body.style.overflow = 'hidden';
                }
            }
        });
    }

    const closeModal = () => {
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    };

    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    window.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
            closeModal();
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

        if (allLink) {
            categoryNavLinks.forEach(link => link.classList.remove('active'));
            allLink.classList.add('active');
        }
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
        });
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

            filterTools({ sort: 'latest' });
        });
    }


    function filterTools(filters = {}) {
        if (!toolGrid) return;

        const allTools = window.toolsRepository.getAllTools();

        const defaultFilters = { search: '', categoryType: '', platform: '', sort: 'latest' };
        const effectiveFilters = { ...defaultFilters, ...filters };

        let filteredTools = allTools.filter(tool => {
            const searchLower = effectiveFilters.search;
            const titleMatch = !searchLower || tool.title.toLowerCase().includes(searchLower);
            const descMatch = !searchLower || tool.description.toLowerCase().includes(searchLower);
            const categoryMatch = !effectiveFilters.categoryType || tool.categoryType === effectiveFilters.categoryType;
            const platformMatch = !effectiveFilters.platform || (tool.platform && tool.platform.includes(effectiveFilters.platform));

            return (titleMatch || descMatch) && categoryMatch && platformMatch;
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
                return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
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
                <div class="no-results">
                    <i class="fas fa-ghost"></i>
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

            const docsButtonHtml = tool.docsUrl ? `
                <a href="${tool.docsUrl}" class="btn btn-outline" target="_blank" rel="noopener noreferrer">
                    <i class="fas fa-book"></i>詳細
                </a>` : '';

            toolCard.innerHTML = `
                <div class="tool-image">
                    <span class="tool-category">${tool.category || '未分類'}</span>
                    <img src="${tool.image || '../lib/Assets/images/placeholder.png'}" alt="${tool.title}">
                </div>
                <div class="tool-content">
                    <h3 class="tool-title">${tool.title}</h3>
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
                    <p class="tool-description">${tool.description}</p>
                    <div class="tool-actions">
                        <a href="${tool.downloadUrl}" class="btn btn-primary">
                            <i class="fas fa-download"></i>ダウンロード
                        </a>
                        ${docsButtonHtml}
                    </div>
                </div>
            `;
            fragment.appendChild(toolCard);
        });
        toolGrid.appendChild(fragment);
    }
}
