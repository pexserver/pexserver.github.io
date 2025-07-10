// PEX Server HUB - Interactive JavaScript
class HubManager {
    constructor() {
        this.contents = null;
        this.favorites = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.userOS = this.detectUserOS(); // OS自動検知
        try {
            const fav = localStorage.getItem('hub-favorites');
            this.favorites = fav ? JSON.parse(fav) : [];
        } catch (e) {
            this.favorites = [];
        }
        this.init();
    }

    detectUserOS() {
        const ua = navigator.userAgent.toLowerCase();
        if (/android|iphone|ipad|ipod|mobile|windows phone/.test(ua)) {
            return 'mobile';
        } else if (/windows|macintosh|linux/.test(ua)) {
            return 'pc';
        }
        return 'none'; // 両対応または判別不能
    }

    async init() {
        try {
            await this.loadContents();
            this.setupEventListeners();
            this.render();
            this.hideLoadingScreen();
        } catch (error) {
            console.error('初期化エラー:', error);
            this.showToast('データの読み込みに失敗しました', 'error');
        }
    }

    async loadContents() {
        try {
            const response = await fetch('./contents.json');
            if (!response.ok) {
                throw new Error('データの読み込みに失敗しました');
            }
            this.contents = await response.json();
        } catch (error) {
            console.error('コンテンツ読み込みエラー:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Navigation buttons
        document.getElementById('home-btn').addEventListener('click', () => this.switchTab('home'));
        document.getElementById('search-btn').addEventListener('click', () => this.switchTab('search'));
        document.getElementById('favorites-btn').addEventListener('click', () => this.switchTab('favorites'));

        // Search functionality
        const searchInput = document.getElementById('search-input');
        const clearSearch = document.getElementById('clear-search');
        
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.performSearch();
        });

        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            this.searchQuery = '';
            this.performSearch();
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.category;
                this.performSearch();
            });
        });

        // Modal functionality
        document.getElementById('item-modal').addEventListener('click', (e) => {
            if (e.target.id === 'item-modal' || e.target.classList.contains('modal-close')) {
                this.closeModal();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('item-modal').classList.contains('hidden')) {
                this.closeModal();
            }
        });
    }

    hideLoadingScreen() {
        setTimeout(() => {
            document.getElementById('loading-screen').style.opacity = '0';
            document.getElementById('loading-screen').style.visibility = 'hidden';
            document.getElementById('main-container').classList.remove('hidden');
            document.getElementById('main-container').classList.add('fade-in');
        }, 1000);
    }

    switchTab(tab) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${tab}-btn`).classList.add('active');

        // Show/hide sections
        const sections = ['featured-section', 'categories-section', 'all-items-section', 'search-results-section'];
        sections.forEach(section => {
            document.getElementById(section).classList.add('hidden');
        });

        switch(tab) {
            case 'home':
                document.getElementById('featured-section').classList.remove('hidden');
                document.getElementById('categories-section').classList.remove('hidden');
                document.getElementById('all-items-section').classList.remove('hidden');
                break;
            case 'search':
                document.getElementById('search-results-section').classList.remove('hidden');
                document.getElementById('search-input').focus();
                break;
            case 'favorites':
                this.showFavorites();
                break;
        }
    }

    render() {
        this.renderFeatured();
        this.renderCategories();
        this.renderAllItems();
    }

    renderFeatured() {
        const grid = document.getElementById('featured-grid');
        grid.innerHTML = '';

        this.contents.featured.forEach((item, index) => {
            const card = this.createFeaturedCard(item, index);
            grid.appendChild(card);
        });
    }

    createFeaturedCard(item, index) {
        const card = document.createElement('div');
        card.className = 'featured-item slide-in-up';
        card.style.animationDelay = `${index * 0.1}s`;
        card.innerHTML = `
            <img src="${item.thumbnail}" alt="${item.name}" class="featured-thumbnail" onerror="this.src='/libs/Assets/images/None.jpg'">
            <div class="featured-content">
                <h3 class="featured-title">${item.name}</h3>
                <p class="featured-description">${item.description}</p>
                <span class="featured-category">${this.getCategoryName(item.category)}</span>
            </div>
        `;
        card.addEventListener('click', () => this.openModal(item));
        return card;
    }

    renderCategories() {
        const grid = document.getElementById('categories-grid');
        grid.innerHTML = '';

        this.contents.categories.forEach((category, index) => {
            const card = this.createCategoryCard(category, index);
            grid.appendChild(card);
        });
    }

    createCategoryCard(category, index) {
        const card = document.createElement('div');
        card.className = 'category-card scale-in';
        card.style.animationDelay = `${index * 0.1}s`;
        card.innerHTML = `
            <div class="category-icon">${category.icon}</div>
            <h3 class="category-name">${category.name}</h3>
            <p class="category-description">${category.description}</p>
            <span class="category-count">${category.items.length} アイテム</span>
        `;
        card.addEventListener('click', () => {
            this.currentFilter = category.id;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector(`[data-category="${category.id}"]`).classList.add('active');
            this.performSearch();
            this.switchTab('search');
        });
        return card;
    }

    renderAllItems() {
        const grid = document.getElementById('all-items-grid');
        grid.innerHTML = '';

        const allItems = this.getAllItems();
        allItems.forEach((item, index) => {
            const card = this.createItemCard(item, index);
            grid.appendChild(card);
        });
    }

    createItemCard(item, index) {
        const card = document.createElement('div');
        card.className = 'item-card slide-in-up';
        card.style.animationDelay = `${index * 0.05}s`;
        const isFavorite = this.favorites.includes(item.url);
        
        card.innerHTML = `
            <img src="${item.thumbnail}" alt="${item.name}" class="item-thumbnail" onerror="this.src='/libs/Assets/images/None.jpg'">
            <div class="item-content">
                <h3 class="item-title">${item.name}</h3>
                <p class="item-description">${item.description}</p>
                <div class="item-footer">
                    <span class="item-category">${this.getCategoryName(item.category)}</span>
                    <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-url="${item.url}">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
                ${item.tags ? `<div class="item-tags">${item.tags.map(tag => `<span class="item-tag">${tag}</span>`).join('')}</div>` : ''}
            </div>
        `;
        
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('favorite-btn') && !e.target.classList.contains('fa-star')) {
                this.openModal(item);
            }
        });

        const favoriteBtn = card.querySelector('.favorite-btn');
        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFavorite(item.url);
            favoriteBtn.classList.toggle('active');
        });

        return card;
    }

    getAllItems() {
        const items = [];
        this.contents.categories.forEach(category => {
            items.push(...category.items);
        });
        return items;
    }

    getCategoryName(categoryId) {
        const category = this.contents.categories.find(cat => cat.id === categoryId);
        return category ? category.name : categoryId;
    }

    performSearch() {
        const resultsGrid = document.getElementById('search-results-grid');
        const noResults = document.getElementById('no-results');
        
        let items = this.getAllItems();

        // Apply category filter
        if (this.currentFilter !== 'all') {
            items = items.filter(item => item.category === this.currentFilter);
        }

        // OS自動フィルタ: userOSがnone以外なら対応しているものだけ
        if (this.userOS !== 'none') {
            items = items.filter(item => Array.isArray(item.os) && item.os.includes(this.userOS));
        }

        // Apply search query
        if (this.searchQuery) {
            items = items.filter(item => 
                item.name.toLowerCase().includes(this.searchQuery) ||
                item.description.toLowerCase().includes(this.searchQuery) ||
                (item.tags && item.tags.some(tag => tag.toLowerCase().includes(this.searchQuery)))
            );
        }

        resultsGrid.innerHTML = '';
        
        if (items.length === 0) {
            noResults.classList.remove('hidden');
        } else {
            noResults.classList.add('hidden');
            items.forEach((item, index) => {
                const card = this.createItemCard(item, index);
                resultsGrid.appendChild(card);
            });
        }
    }

    showFavorites() {
        const resultsGrid = document.getElementById('search-results-grid');
        const noResults = document.getElementById('no-results');
        const section = document.getElementById('search-results-section');
        
        section.classList.remove('hidden');
        section.querySelector('.section-title').innerHTML = '<i class="fas fa-star"></i> お気に入り';
        
        const allItems = this.getAllItems();
        const favoriteItems = allItems.filter(item => this.favorites.includes(item.url));
        
        resultsGrid.innerHTML = '';
        
        if (favoriteItems.length === 0) {
            noResults.classList.remove('hidden');
            noResults.querySelector('h3').textContent = 'お気に入りがありません';
            noResults.querySelector('p').textContent = 'アイテムをお気に入りに追加してください';
        } else {
            noResults.classList.add('hidden');
            favoriteItems.forEach((item, index) => {
                const card = this.createItemCard(item, index);
                resultsGrid.appendChild(card);
            });
        }
    }

    openModal(item) {
        const modal = document.getElementById('item-modal');
        const thumbnail = document.getElementById('modal-thumbnail');
        const title = document.getElementById('modal-title');
        const description = document.getElementById('modal-description');
        const tags = document.getElementById('modal-tags');
        const visitBtn = document.getElementById('modal-visit');
        const favoriteBtn = document.getElementById('modal-favorite');

        thumbnail.src = item.thumbnail;
        thumbnail.onerror = () => { thumbnail.src = '/libs/Assets/images/None.jpg'; };
        title.textContent = item.name;
        description.textContent = item.description;
        
        tags.innerHTML = '';
        if (item.tags) {
            item.tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'modal-tag';
                tagSpan.textContent = tag;
                tags.appendChild(tagSpan);
            });
        }

        visitBtn.onclick = () => {
            window.location.href = item.url;
            this.closeModal();
        };

        const isFavorite = this.favorites.includes(item.url);
        favoriteBtn.innerHTML = isFavorite ? 
            '<i class="fas fa-star"></i> お気に入り解除' : 
            '<i class="far fa-star"></i> お気に入り追加';
        
        favoriteBtn.onclick = () => {
            this.toggleFavorite(item.url);
            const newIsFavorite = this.favorites.includes(item.url);
            favoriteBtn.innerHTML = newIsFavorite ? 
                '<i class="fas fa-star"></i> お気に入り解除' : 
                '<i class="far fa-star"></i> お気に入り追加';
        };

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modal = document.getElementById('item-modal');
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    toggleFavorite(url) {
        const index = this.favorites.indexOf(url);
        if (index > -1) {
            this.favorites.splice(index, 1);
            this.showToast('お気に入りから削除しました', 'info');
        } else {
            this.favorites.push(url);
            this.showToast('お気に入りに追加しました', 'success');
        }
        try {
            localStorage.setItem('hub-favorites', JSON.stringify(this.favorites));
        } catch (e) {
            // localStorageが使えない場合は何もしない
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 
                    'info-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HubManager();
});



// Smooth scrolling for anchor links
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && e.target.getAttribute('href').startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(e.target.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

// Add subtle animations on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for scroll animations
setTimeout(() => {
    document.querySelectorAll('.item-card, .featured-item, .category-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}, 1500);

// iOSホーム追加案内モーダル表示ロジック
function shouldShowIOSPWAModal() {
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isInStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const ignored = localStorage.getItem('ios-pwa-modal-ignore');
    return isIOS && !isInStandalone && !ignored;
}

document.addEventListener('DOMContentLoaded', () => {
    if (shouldShowIOSPWAModal()) {
        document.getElementById('ios-pwa-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    document.getElementById('ios-pwa-close').onclick = () => {
        document.getElementById('ios-pwa-modal').classList.add('hidden');
        document.body.style.overflow = 'auto';
    };
    document.getElementById('ios-pwa-ignore').onclick = () => {
        localStorage.setItem('ios-pwa-modal-ignore', '1');
        document.getElementById('ios-pwa-modal').classList.add('hidden');
        document.body.style.overflow = 'auto';
    };
});