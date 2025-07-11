class OmikujiApp {
    constructor() {
        this.fortuneData = null;
        this.history = [];
        this.maxHistory = 30; // 最大保存数を30に変更
        this.isAnimating = false;
        this.selectedCategory = null;
        this.currentFortune = null;
        this._historyClickHandler = null;
        this.availableCards = []; // 札選択用の配列
        
        this.detectDevice();
        this.initializeElements();
        this.loadFortuneData();
        this.loadUserData();
        this.bindEvents();
        this.setupURLParams();
    }

    // デバイス判定を行い、適切なクラスをbodyに追加
    detectDevice() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                        window.innerWidth <= 768;
        
        // bodyにクラスを追加
        document.body.classList.toggle('ios', isIOS);
        document.body.classList.toggle('mobile', isMobile);
        document.body.classList.toggle('desktop', !isMobile);
        
        // Viewportの高さを設定（iOS Safariのアドレスバー対策）
        this.updateViewportHeight();
        window.addEventListener('resize', () => this.updateViewportHeight());
        
        // 画面の向きが変わったときにもビューポート高さを更新
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.updateViewportHeight(), 100);
        });
    }
    
    // iOS Safariのアドレスバーを考慮したビューポート高さを設定
    updateViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
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
            cardSelectionPrompt: document.getElementById('cardSelectionPrompt'),
            cardsContainer: document.getElementById('cardsContainer'),
            cardsGrid: document.getElementById('cardsGrid'),
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
            const data = await response.json();
            this.fortuneData = { categories: data.categories };
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
        this.elements.drawButton.addEventListener('click', () => {
            if (this.elements.drawButton.disabled) return; // 二重防止
            this.drawFortune();
        });
        
        // 札選択のイベントリスナー（動的に追加）
        this.elements.cardsGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.omikuji-card');
            if (card && !card.classList.contains('flipped')) {
                this.selectCard(card);
            }
        });

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

    async selectCategory(categoryKey) {
        if (!this.fortuneData || !this.fortuneData.categories[categoryKey]) return;

        this.selectedCategory = categoryKey;
        const category = this.fortuneData.categories[categoryKey];

        // アニメーションをリセット
        this.resetOmikujiAnimation();

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

        // fortuneデータをカテゴリごとにfetch
        try {
            const fortuneRes = await fetch(`Mikuji/${categoryKey}.jsonc`);
            if (!fortuneRes.ok) throw new Error('fortuneデータ取得失敗');
            this.categoryFortunes = await fortuneRes.json();
        } catch (e) {
            this.categoryFortunes = [];
            this.showMessage('おみくじ内容の取得に失敗しました');
        }

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
        this.elements.drawButton.style.display = 'inline-flex';
        this.elements.statusMessage.textContent = '心を落ち着けて、おみくじを引いてください';
        this.elements.cooldownTimer.style.display = 'none';
        // 札選択エリアを隠す
        this.elements.cardsContainer.classList.remove('show');
        this.elements.cardsContainer.classList.add('hidden');
        this.elements.cardSelectionPrompt.style.display = 'flex';
    }

    disableDrawing() {
        this.elements.drawButton.disabled = true;
        this.elements.drawButton.style.display = 'none';
        this.elements.statusMessage.textContent = `今日はもう${this.fortuneData.categories[this.selectedCategory].name}を引きました`;
        // 札選択エリアを隠す
        this.elements.cardsContainer.classList.remove('show');
        this.elements.cardsContainer.classList.add('hidden');
        this.elements.cardSelectionPrompt.style.display = 'flex';
        // クールダウンタイマーを正しく表示
        const lastDrawKey = `omikuji_last_draw_${this.selectedCategory}`;
        const lastDrawDate = localStorage.getItem(lastDrawKey);
        if (lastDrawDate) {
            const lastDraw = new Date(lastDrawDate);
            const cooldownMs = 24 * 60 * 60 * 1000;
            const nextAvailable = lastDraw.getTime() + cooldownMs;
            this.showCooldownTimer(lastDrawKey, nextAvailable);
        }
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
            
            // 札を準備（5枚）
            await this.prepareCards();
            
            // 札選択状態に移行
            this.showCardSelection();
            
        } catch (error) {
            console.error('おみくじを引く際にエラーが発生しました:', error);
            this.showMessage('エラーが発生しました。もう一度お試しください。');
        } finally {
            this.hideLoading();
            this.isAnimating = false;
        }
    }

    async prepareCards() {
        const categoryFortunes = this.categoryFortunes;
        if (!categoryFortunes || categoryFortunes.length === 0) {
            throw new Error('おみくじデータがありません');
        }

        // 5枚の札を準備（重複なし）
        const shuffled = [...categoryFortunes].sort(() => Math.random() - 0.5);
        this.availableCards = shuffled.slice(0, 5);
        
        // 札のHTMLを生成
        const cardsHTML = this.availableCards.map((fortune, index) => `
            <div class="omikuji-card" data-card-index="${index}">
                <div class="card-face card-front">
                    <div class="card-number">${index + 1}</div>
                    <div class="card-label">おみくじ札</div>
                    <div class="card-graphic">
                        <i class="fas fa-scroll"></i>
                    </div>
                    <div class="card-tap">クリックして開く</div>
                </div>
                <div class="card-face card-back">
                    <div class="card-result">
                        <span class="result-type" style="color: ${fortune.color || '#2e7d32'}">${fortune.type}</span>
                        <span class="result-message">${fortune.message}</span>
                    </div>
                </div>
            </div>
        `).join('');

        this.elements.cardsGrid.innerHTML = cardsHTML;
    }

    showCardSelection() {
        // プロンプトを隠して札選択エリアを表示
        this.elements.cardSelectionPrompt.style.display = 'none';
        this.elements.cardsContainer.classList.remove('hidden');
        this.elements.cardsContainer.classList.add('show');
        
        // ステータスメッセージを更新
        this.elements.statusMessage.textContent = '札を選んでクリックしてください';
    }

    async selectCard(cardElement) {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        
        try {
            // 選択された札を取得
            const cardIndex = parseInt(cardElement.dataset.cardIndex);
            const selectedFortune = this.availableCards[cardIndex];
            
            // 札を選択状態にする
            cardElement.classList.add('selected');
            
            // 少し待ってから開く
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 札を開く
            cardElement.classList.add('flipped');
            
            // 開くアニメーション完了を待つ
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // 結果モーダルを表示
            this.showFortuneModal(selectedFortune);
            
            // クールダウン設定
            const lastDrawKey = `omikuji_last_draw_${this.selectedCategory}`;
            const now = new Date();
            localStorage.setItem(lastDrawKey, now.toISOString());
            this.disableDrawing();
            const cooldownMs = 24 * 60 * 60 * 1000;
            const nextAvailable = now.getTime() + cooldownMs;
            this.showCooldownTimer(lastDrawKey, nextAvailable);
            
        } catch (error) {
            console.error('札選択でエラーが発生しました:', error);
            this.showMessage('エラーが発生しました。もう一度お試しください。');
        } finally {
            this.isAnimating = false;
        }
    }

    showFortuneModal(fortune) {
        this.currentFortune = fortune;
        const category = this.fortuneData.categories[this.selectedCategory];
        
        // 既存のモーダル表示処理
        this.elements.fortuneCategory.textContent = category.name;
        this.elements.fortuneCategory.style.color = category.color;
        this.elements.fortuneType.textContent = fortune.type;
        this.elements.fortuneType.style.color = fortune.color;
        this.elements.fortuneMessage.textContent = fortune.message;
        this.elements.fortuneDescription.textContent = fortune.description;
        this.renderLuckStats(fortune.luck);
        this.renderAdvice(fortune.advice);
        // モーダル表示
        this.elements.modalOverlay.classList.add('show');
        this.elements.modalOverlay.classList.remove('hidden');
        this.elements.modalContainer.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('modal-open');

        // 履歴に追加
        this.addHistory(fortune, category);
    }

    addHistory(fortune, category) {
        // 履歴に追加（最大30件まで）
        const newItem = {
            id: Date.now(),
            categoryName: category.name,
            categoryColor: category.color,
            type: fortune.type,
            color: fortune.color,
            message: fortune.message,
            description: fortune.description,
            luck: fortune.luck,
            advice: fortune.advice,
            date: new Date().toISOString()
        };
        this.history.unshift(newItem);
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(0, this.maxHistory);
        }
        this.saveUserData();
        this.updateHistoryDisplay();
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
            motivation: 'やる気',
            focus: '集中力',
            result: '成果'
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
        this.elements.modalOverlay.classList.add('hidden');
        this.elements.modalContainer.classList.add('hidden');
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open'); // モーダル表示時のクラスを削除
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

        // 履歴アイテムクリックイベントを削除して再追加
        this.elements.historyList.removeEventListener('click', this._historyClickHandler);
        this._historyClickHandler = (e) => {
            const item = e.target.closest('.history-item');
            if (item) {
                const historyId = parseInt(item.dataset.id);
                this.showHistoryDetail(historyId);
            }
        };
        this.elements.historyList.addEventListener('click', this._historyClickHandler);
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
        this.elements.modalOverlay.classList.remove('hidden');
        this.elements.modalContainer.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('modal-open'); // モーダル表示時のクラスを追加
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

    // おみくじアニメーションをリセット
    resetOmikujiAnimation() {
        // 札選択エリアをリセット
        this.elements.cardsContainer.classList.remove('show');
        this.elements.cardsContainer.classList.add('hidden');
        this.elements.cardSelectionPrompt.style.display = 'flex';
        this.elements.cardsGrid.innerHTML = '';
        
        // 利用可能な札をクリア
        this.availableCards = [];
    }
}

// クリエパラメータAPI対応: ?type=fortuneType でjson返却
(function handleQueryOmikujiAPI() {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    const omikujiParam = urlParams.get('omikuji');
    if (typeParam || omikujiParam) {
        // fortuneDataのロードを待つ
        const waitForData = () => {
            if (window.omikujiApp && window.omikujiApp.fortuneData) {
                const categories = Object.keys(window.omikujiApp.fortuneData.categories);
                // ?omikuji=カテゴリ名 の場合（ランダム抽選して1件返す）
                if (omikujiParam && categories.includes(omikujiParam)) {
                    fetch(`Mikuji/${omikujiParam}.json`).then(r => r.json()).then(data => {
                        if (Array.isArray(data) && data.length > 0) {
                            const picked = data[Math.floor(Math.random() * data.length)];
                            document.open();
                            document.write('<pre>' + JSON.stringify(picked, null, 2) + '</pre>');
                            document.close();
                        } else {
                            document.open();
                            document.write('<pre>{"error":"no data"}</pre>');
                            document.close();
                        }
                    }).catch(() => {
                        document.open();
                        document.write('<pre>{"error":"data load error"}</pre>');
                        document.close();
                    });
                    return;
                }
                // ?type=xxx の場合（従来通り）
                if (typeParam) {
                    Promise.all(
                        categories.map(cat => fetch(`Mikuji/${cat}.json`).then(r => r.json()))
                    ).then(allData => {
                        const allFortunes = allData.flat();
                        const found = allFortunes.find(f => f.type === typeParam);
                        if (found) {
                            const result = JSON.stringify(found);
                            document.open();
                            document.write('<pre>' + result + '</pre>');
                            document.close();
                        } else {
                            document.open();
                            document.write('<pre>{"error":"not found"}</pre>');
                            document.close();
                        }
                    }).catch(() => {
                        document.open();
                        document.write('<pre>{"error":"data load error"}</pre>');
                        document.close();
                    });
                    return;
                }
                // パラメータ値が不正な場合
                document.open();
                document.write('<pre>{"error":"invalid parameter"}</pre>');
                document.close();
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
    
    // ページコンテナの初期設定
    const historyPage = document.getElementById('historyPage');
    if (historyPage) {
        historyPage.classList.remove('active');
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

window.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.getElementById('hamburgerMenu');
  const sideMenu = document.getElementById('sideMenu');
  let menuOpen = false;

  function openMenu() {
    sideMenu.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    menuOpen = true;
    // フォーカスをメニューに移動
    sideMenu.querySelector('li')?.focus();
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    sideMenu.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    menuOpen = false;
    document.body.style.overflow = '';
  }
  hamburger?.addEventListener('click', function(e) {
    e.stopPropagation();
    if (menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });
  // メニュー外クリックで閉じる
  document.addEventListener('click', function(e) {
    if (menuOpen && !sideMenu.contains(e.target) && e.target !== hamburger) {
      closeMenu();
    }
  });
  // Escキーで閉じる
  document.addEventListener('keydown', function(e) {
    if (menuOpen && (e.key === 'Escape' || e.key === 'Esc')) {
      closeMenu();
      hamburger.focus();
    }
  });
  // メニュー内Tab移動サポート
  sideMenu.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      const focusable = sideMenu.querySelectorAll('li');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  // メニュー項目にtabindex
  sideMenu.querySelectorAll('li').forEach(li => li.setAttribute('tabindex', '0'));

  // サイドメニューからホームページへ移動
  document.getElementById('menuHome')?.addEventListener('click', function() {
    document.getElementById('historyPage').classList.remove('active');
    document.querySelector('.container:not(#historyPage)').style.display = 'block';
    closeMenu(); // メニューを閉じる
  });

  // サイドメニューから履歴ページへ移動
  document.getElementById('menuHistory')?.addEventListener('click', function() {
    document.getElementById('historyPage').classList.add('active');
    document.querySelector('.container:not(#historyPage)').style.display = 'none';
    closeMenu();
  });
  // 履歴ページからメインページへ戻る処理はハンバーガーメニューの「ホームへ」で対応
});
