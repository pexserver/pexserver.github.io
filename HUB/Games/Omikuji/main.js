class OmikujiApp {
    constructor() {
        this.fortuneData = null;
        this.history = [];
        this.maxHistory = 10;
        this.isAnimating = false;
        this.selectedCategory = null;
        this.currentFortune = null;
        
        this.initializeElements();
        this.loadFortuneData();
        this.loadUserData();
        this.bindEvents();
        this.setupURLParams();
    }

    initializeElements() {
        this.elements = {
            // カテゴリ選択関連
            categorySelection: document.getElementById('categorySelection'),
            categoryGrid: document.getElementById('categoryGrid'),
            
            // おみくじセクション関連
            omikujiSection: document.getElementById('omikujiSection'),
            selectedCategory: document.getElementById('selectedCategory'),
            categoryIcon: document.getElementById('categoryIcon'),
            categoryName: document.getElementById('categoryName'),
            categoryDescription: document.getElementById('categoryDescription'),
            
            // おみくじボックス関連
            omikujiBox: document.getElementById('omikujiBox'),
            boxLid: document.getElementById('boxLid'),
            drawButton: document.getElementById('drawButton'),
            backButton: document.getElementById('backButton'),
            statusMessage: document.getElementById('statusMessage'),
            cooldownTimer: document.getElementById('cooldownTimer'),
            timeRemaining: document.getElementById('timeRemaining'),
            
            // モーダル関連
            modalOverlay: document.getElementById('modalOverlay'),
            modalContainer: document.getElementById('modalContainer'),
            modalClose: document.getElementById('modalClose'),
            fortuneCategory: document.getElementById('fortuneCategory'),
            fortuneType: document.getElementById('fortuneType'),
            fortuneMessage: document.getElementById('fortuneMessage'),
            fortuneDescription: document.getElementById('fortuneDescription'),
            luckStats: document.getElementById('luckStats'),
            adviceList: document.getElementById('adviceList'),
            saveButton: document.getElementById('saveButton'),
            shareButton: document.getElementById('shareButton'),
            
            // 履歴関連
            historySection: document.getElementById('historySection'),
            historyList: document.getElementById('historyList'),
            historyCount: document.getElementById('historyCount'),
            noHistory: document.getElementById('noHistory'),
            clearHistoryButton: document.getElementById('clearHistoryButton'),
            
            // その他
            loadingOverlay: document.getElementById('loadingOverlay'),
            confirmDialog: document.getElementById('confirmDialog'),
            confirmYes: document.getElementById('confirmYes'),
            confirmNo: document.getElementById('confirmNo'),
            confirmTitle: document.getElementById('confirmTitle'),
            confirmMessage: document.getElementById('confirmMessage')
        };
    }

    async loadFortuneData() {
        try {
            const response = await fetch('mikuji.json');
            this.fortuneData = await response.json();
            this.renderCategories();
        } catch (error) {
            console.error('おみくじデータの読み込みに失敗しました:', error);
            this.showMessage('データの読み込みに失敗しました。ページを再読み込みしてください。');
        }
    }

    renderCategories() {
        if (!this.fortuneData || !this.fortuneData.categories) return;

        const categoriesHTML = Object.entries(this.fortuneData.categories).map(([key, category]) => `
            <div class="category-card" data-category="${key}" style="color: ${category.color}">
                <i class="category-icon ${category.icon}"></i>
                <h3 class="category-title">${category.name}</h3>
                <p class="category-desc">${category.description}</p>
            </div>
        `).join('');

        this.elements.categoryGrid.innerHTML = categoriesHTML;
    }

    loadUserData() {
        // 履歴を取得
        const savedHistory = localStorage.getItem('omikuji_history');
        if (savedHistory) {
            this.history = JSON.parse(savedHistory);
        }
        this.updateHistoryDisplay();
    }

    saveUserData() {
        localStorage.setItem('omikuji_history', JSON.stringify(this.history));
    }

    bindEvents() {
        // カテゴリ選択
        this.elements.categoryGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.category-card');
            if (card) {
                this.selectCategory(card.dataset.category);
            }
        });

        // おみくじを引く
        this.elements.drawButton.addEventListener('click', () => this.drawFortune());
        this.elements.omikujiBox.addEventListener('click', () => this.drawFortune());

        // 戻るボタン
        this.elements.backButton.addEventListener('click', () => this.showCategorySelection());

        // モーダル関連
        this.elements.modalClose.addEventListener('click', () => this.hideModal());
        this.elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) {
                this.hideModal();
            }
        });

        // モーダル内ボタン
        this.elements.saveButton.addEventListener('click', () => this.saveFortune());
        this.elements.shareButton.addEventListener('click', () => this.shareFortune());

        // 履歴関連
        this.elements.clearHistoryButton.addEventListener('click', () => this.confirmClearHistory());

        // 確認ダイアログ
        this.elements.confirmYes.addEventListener('click', () => this.executeConfirmedAction());
        this.elements.confirmNo.addEventListener('click', () => this.hideConfirmDialog());

        // キーボードイベント
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
                this.hideConfirmDialog();
            }
        });

        // タッチイベント
        this.elements.drawButton.addEventListener('touchstart', (e) => this.createRipple(e));
        this.elements.drawButton.addEventListener('click', (e) => this.createRipple(e));
    }

    setupURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const category = urlParams.get('category');
        if (category && this.fortuneData && this.fortuneData.categories[category]) {
            this.selectCategory(category);
        }
    }

    selectCategory(categoryKey) {
        if (!this.fortuneData || !this.fortuneData.categories[categoryKey]) return;

        this.selectedCategory = categoryKey;
        const category = this.fortuneData.categories[categoryKey];

        // カテゴリ情報を表示
        this.elements.categoryIcon.className = `category-icon ${category.icon}`;
        this.elements.categoryIcon.style.color = category.color;
        this.elements.categoryName.textContent = category.name;
        this.elements.categoryDescription.textContent = category.description;
        this.elements.selectedCategory.style.borderLeftColor = category.color;

        // セクション切り替え
        this.elements.categorySelection.style.display = 'none';
        this.elements.omikujiSection.classList.add('active');

        // URL更新（履歴を残さない）
        const newURL = new URL(window.location);
        newURL.searchParams.set('category', categoryKey);
        window.history.replaceState({}, '', newURL);

        this.checkCooldown();
    }

    showCategorySelection() {
        this.elements.omikujiSection.classList.remove('active');
        this.elements.categorySelection.style.display = 'block';
        this.selectedCategory = null;

        // URL更新
        const newURL = new URL(window.location);
        newURL.searchParams.delete('category');
        window.history.replaceState({}, '', newURL);
    }

    checkCooldown() {
        const lastDrawKey = `omikuji_last_draw_${this.selectedCategory}`;
        const lastDrawDate = localStorage.getItem(lastDrawKey);
        if (!lastDrawDate) {
            this.enableDrawing();
            return;
        }
        const lastDraw = new Date(lastDrawDate);
        const now = new Date();
        const cooldownMs = 24 * 60 * 60 * 1000;
        const nextAvailable = lastDraw.getTime() + cooldownMs;
        if (now.getTime() >= nextAvailable) {
            this.enableDrawing();
            return;
        }
        // まだ24時間経っていない場合、クールダウンを表示
        this.disableDrawing();
        this.showCooldownTimer(lastDrawKey, nextAvailable);
    }

    enableDrawing() {
        this.elements.drawButton.disabled = false;
        this.elements.omikujiBox.style.pointerEvents = 'auto';
        this.elements.statusMessage.textContent = '心を落ち着けて、おみくじを引いてください';
        this.elements.cooldownTimer.style.display = 'none';
    }

    disableDrawing() {
        this.elements.drawButton.disabled = true;
        this.elements.omikujiBox.style.pointerEvents = 'none';
        this.elements.statusMessage.textContent = `今日はもう${this.fortuneData.categories[this.selectedCategory].name}を引きました`;
    }

    showCooldownTimer(lastDrawKey, nextAvailable) {
        this.elements.cooldownTimer.style.display = 'block';
        this.updateCooldownDisplay(nextAvailable);
        if (this.cooldownInterval) clearInterval(this.cooldownInterval);
        this.cooldownInterval = setInterval(() => {
            this.updateCooldownDisplay(nextAvailable);
        }, 1000);
    }

    updateCooldownDisplay(nextAvailable) {
        const now = new Date();
        const timeLeft = nextAvailable - now.getTime();
        if (timeLeft <= 0) {
            this.enableDrawing();
            if (this.cooldownInterval) {
                clearInterval(this.cooldownInterval);
            }
            return;
        }
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        this.elements.timeRemaining.textContent = `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    async drawFortune() {
        if (this.isAnimating || this.elements.drawButton.disabled || !this.selectedCategory) {
            return;
        }

        this.isAnimating = true;
        
        try {
            // ローディング表示
            this.showLoading();
            
            // アニメーション開始
            await this.playDrawAnimation();
            
            // おみくじの結果を決定
            const fortune = this.selectFortune();
            
            // 結果をモーダルで表示
            this.showFortuneModal(fortune);
            
            // クールダウン設定
            const lastDrawKey = `omikuji_last_draw_${this.selectedCategory}`;
            localStorage.setItem(lastDrawKey, new Date().toISOString());
            this.disableDrawing();
            this.showCooldownTimer(lastDrawKey);
            
        } catch (error) {
            console.error('おみくじを引く際にエラーが発生しました:', error);
            this.showMessage('エラーが発生しました。もう一度お試しください。');
        } finally {
            this.hideLoading();
            this.isAnimating = false;
        }
    }

    selectFortune() {
        const categoryFortunes = this.fortuneData.fortunes[this.selectedCategory];
        if (!categoryFortunes || categoryFortunes.length === 0) {
            // フォールバック: 総合運から選択
            const generalFortunes = this.fortuneData.fortunes.general || [];
            return generalFortunes[Math.floor(Math.random() * generalFortunes.length)];
        }

        // ランダムに選択
        return categoryFortunes[Math.floor(Math.random() * categoryFortunes.length)];
    }

    async playDrawAnimation() {
        return new Promise((resolve) => {
            // 蓋を開けるアニメーション
            this.elements.boxLid.classList.add('open');
            
            setTimeout(() => {
                this.elements.boxLid.classList.remove('open');
                resolve();
            }, 1500);
        });
    }

    showFortuneModal(fortune) {
        this.currentFortune = fortune;
        const category = this.fortuneData.categories[this.selectedCategory];

        // カテゴリと運勢タイプ
        this.elements.fortuneCategory.textContent = category.name;
        this.elements.fortuneCategory.style.color = category.color;
        this.elements.fortuneType.textContent = fortune.type;
        this.elements.fortuneType.style.color = fortune.color;

        // メッセージと説明
        this.elements.fortuneMessage.textContent = fortune.message;
        this.elements.fortuneDescription.textContent = fortune.description;

        // 運勢詳細
        this.renderLuckStats(fortune.luck);

        // アドバイス
        this.renderAdvice(fortune.advice);

        // モーダル表示
        this.elements.modalOverlay.classList.add('show');
        
        // ボディのスクロールを防ぐ
        document.body.style.overflow = 'hidden';
    }

    renderLuckStats(luck) {
        const luckHTML = Object.entries(luck).map(([key, value]) => `
            <div class="luck-item">
                <span class="luck-label">${this.getLuckLabel(key)}</span>
                <span class="luck-value">${value}</span>
            </div>
        `).join('');

        this.elements.luckStats.innerHTML = luckHTML;
    }

    getLuckLabel(key) {
        const labels = {
            love: '恋愛運',
            money: '金運',
            health: '健康運',
            work: '仕事運',
            attraction: '魅力度',
            communication: 'コミュ力',
            harmony: '調和',
            passion: '情熱',
            income: '収入',
            investment: '投資',
            savings: '貯蓄',
            spending: '支出',
            creativity: '創造性',
            teamwork: 'チーム力',
            leadership: 'リーダー力',
            efficiency: '効率',
            energy: 'エネルギー',
            immunity: '免疫力',
            mental: 'メンタル',
            vitality: '活力',
            concentration: '集中力',
            memory: '記憶力',
            understanding: '理解力',
            motivation: 'やる気'
        };
        return labels[key] || key;
    }

    renderAdvice(advice) {
        if (Array.isArray(advice)) {
            const adviceHTML = advice.map(item => `<li>${item}</li>`).join('');
            this.elements.adviceList.innerHTML = adviceHTML;
        } else {
            this.elements.adviceList.innerHTML = `<li>${advice}</li>`;
        }
    }

    hideModal() {
        this.elements.modalOverlay.classList.remove('show');
        document.body.style.overflow = '';
    }

    saveFortune() {
        if (!this.currentFortune) return;

        const historyItem = {
            id: Date.now(),
            date: new Date().toISOString(),
            category: this.selectedCategory,
            categoryName: this.fortuneData.categories[this.selectedCategory].name,
            categoryColor: this.fortuneData.categories[this.selectedCategory].color,
            type: this.currentFortune.type,
            message: this.currentFortune.message,
            color: this.currentFortune.color,
            description: this.currentFortune.description,
            advice: this.currentFortune.advice,
            luck: this.currentFortune.luck
        };

        this.history.unshift(historyItem);
        
        // 最大件数を超えた場合は古いものを削除
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(0, this.maxHistory);
        }

        this.saveUserData();
        this.updateHistoryDisplay();
        this.hideModal();

        this.showMessage('おみくじ結果を保存しました！');
    }

    async shareFortune() {
        if (!this.currentFortune) return;

        const shareText = `${this.fortuneData.categories[this.selectedCategory].name}: ${this.currentFortune.type}\n${this.currentFortune.message}\n\n#おみくじBox`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'おみくじBox - 結果',
                    text: shareText,
                    url: window.location.href
                });
            } catch (error) {
                console.log('シェアがキャンセルされました');
            }
        } else {
            // フォールバック: クリップボードにコピー
            try {
                await navigator.clipboard.writeText(shareText);
                this.showMessage('結果をクリップボードにコピーしました！');
            } catch (error) {
                console.error('クリップボードへのコピーに失敗しました:', error);
                this.showMessage('シェア機能は利用できません');
            }
        }
    }

    updateHistoryDisplay() {
        this.elements.historyCount.textContent = `(${this.history.length}/${this.maxHistory})`;

        if (this.history.length === 0) {
            this.elements.noHistory.style.display = 'block';
            this.elements.clearHistoryButton.style.display = 'none';
            return;
        }

        this.elements.noHistory.style.display = 'none';
        this.elements.clearHistoryButton.style.display = 'block';

        const historyHTML = this.history.map(item => {
            const date = new Date(item.date);
            const dateString = date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            return `
                <div class="history-item" style="border-left-color: ${item.categoryColor}" data-id="${item.id}">
                    <div class="history-header">
                        <span class="history-category" style="color: ${item.categoryColor}">${item.categoryName}</span>
                        <span class="history-date">${dateString}</span>
                    </div>
                    <div class="history-fortune" style="color: ${item.color}">${item.type}</div>
                    <div class="history-message">${item.message}</div>
                </div>
            `;
        }).join('');

        this.elements.historyList.innerHTML = historyHTML;

        // 履歴アイテムクリックイベント
        this.elements.historyList.addEventListener('click', (e) => {
            const item = e.target.closest('.history-item');
            if (item) {
                const historyId = parseInt(item.dataset.id);
                this.showHistoryDetail(historyId);
            }
        });
    }

    showHistoryDetail(historyId) {
        const historyItem = this.history.find(item => item.id === historyId);
        if (!historyItem) return;

        // 履歴詳細をモーダルで表示
        this.currentFortune = historyItem;
        this.elements.fortuneCategory.textContent = historyItem.categoryName;
        this.elements.fortuneCategory.style.color = historyItem.categoryColor;
        this.elements.fortuneType.textContent = historyItem.type;
        this.elements.fortuneType.style.color = historyItem.color;
        this.elements.fortuneMessage.textContent = historyItem.message;
        this.elements.fortuneDescription.textContent = historyItem.description;

        this.renderLuckStats(historyItem.luck);
        this.renderAdvice(historyItem.advice);

        this.elements.modalOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    confirmClearHistory() {
        this.elements.confirmTitle.textContent = '履歴削除の確認';
        this.elements.confirmMessage.textContent = 'すべての履歴を削除しますか？この操作は取り消せません。';
        this.confirmedAction = () => this.clearHistory();
        this.elements.confirmDialog.classList.add('show');
    }

    clearHistory() {
        this.history = [];
        this.saveUserData();
        this.updateHistoryDisplay();
        this.hideConfirmDialog();
        this.showMessage('履歴をクリアしました');
    }

    executeConfirmedAction() {
        if (this.confirmedAction) {
            this.confirmedAction();
            this.confirmedAction = null;
        }
    }

    hideConfirmDialog() {
        this.elements.confirmDialog.classList.remove('show');
    }

    showLoading() {
        this.elements.loadingOverlay.classList.add('show');
    }

    hideLoading() {
        setTimeout(() => {
            this.elements.loadingOverlay.classList.remove('show');
        }, 1500);
    }

    showMessage(message) {
        this.elements.statusMessage.textContent = message;
        
        // 3秒後に元のメッセージに戻す
        setTimeout(() => {
            if (this.selectedCategory) {
                this.elements.statusMessage.textContent = this.elements.drawButton.disabled 
                    ? `今日はもう${this.fortuneData.categories[this.selectedCategory].name}を引きました`
                    : '心を落ち着けて、おみくじを引いてください';
            }
        }, 3000);
    }

    createRipple(e) {
        const button = e.currentTarget;
        const ripple = button.querySelector('.button-ripple');
        
        if (!ripple) return;

        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        ripple.style.animation = 'none';
        requestAnimationFrame(() => {
            ripple.style.animation = 'ripple 0.6s linear';
        });
    }

    // エラーハンドリング
    handleError(error, context) {
        console.error(`${context}でエラーが発生:`, error);
        this.showMessage('エラーが発生しました。ページを再読み込みしてください。');
    }
}

// クリエパラメータAPI対応: ?type=fortuneType でjson返却
(function handleQueryOmikujiAPI() {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    if (typeParam) {
        // fortuneDataのロードを待つ
        const waitForData = () => {
            if (window.omikujiApp && window.omikujiApp.fortuneData) {
                const allFortunes = Object.values(window.omikujiApp.fortuneData.fortunes).flat();
                const found = allFortunes.find(f => f.type === typeParam);
                if (found) {
                    const result = JSON.stringify(found);
                    // JSONを返す（画面書き換え）
                    document.open();
                    document.write('<pre>' + result + '</pre>');
                    document.close();
                } else {
                    document.open();
                    document.write('<pre>{"error":"not found"}</pre>');
                    document.close();
                }
            } else {
                setTimeout(waitForData, 50);
            }
        };
        waitForData();
    }
})();

// ユーティリティ関数
const utils = {
    // デバイス判定
    isMobile: () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    
    // iOS判定
    isIOS: () => {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
    },
    
    // 日付フォーマット
    formatDate: (date) => {
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    },
    
    // ローカルストレージ使用可能チェック
    isLocalStorageAvailable: () => {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
};

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    // ローカルストレージチェック
    if (!utils.isLocalStorageAvailable()) {
        console.warn('ローカルストレージが使用できません。一部機能が制限されます。');
    }
    
    // iOS用の特別な設定
    if (utils.isIOS()) {
        document.body.classList.add('ios');
        
        // iOSでのビューポート問題を修正
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        }

        // iOS PWA フルスクリーン対応
        if (window.navigator.standalone) {
            document.body.classList.add('standalone');
        }
    }
    
    // モバイル用の特別な設定
    if (utils.isMobile()) {
        document.body.classList.add('mobile');
    }
    
    // アプリケーション開始
    window.omikujiApp = new OmikujiApp();
});

// エラーハンドリング
window.addEventListener('error', (e) => {
    console.error('グローバルエラー:', e.error);
    if (window.omikujiApp) {
        window.omikujiApp.handleError(e.error, 'グローバル');
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('未処理のPromise拒否:', e.reason);
    if (window.omikujiApp) {
        window.omikujiApp.handleError(e.reason, 'Promise');
    }
});

// パフォーマンス監視
window.addEventListener('load', () => {
    // ページ読み込み時間を測定
    if (window.performance && window.performance.timing) {
        const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
        console.log(`ページ読み込み時間: ${loadTime}ms`);
    }
});
