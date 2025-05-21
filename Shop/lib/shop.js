class Shop {
    constructor() {
        this.items = [];
        this.cart = [];
        this.categories = new Set();
        // JsonDB APIのURL
        this.API_URL = 'https://script.google.com/macros/s/AKfycbwMrD6nmpk5_nWyt_f5NzgKWmbBVjRJaGsdFZXnt1YzQHRAv_u2RqddUbNM9S-McU82/exec';
        this.AUTH_KEY = 'pex_shop_secret';
        this.SHOP_SHEET = 'shop_data';
        
        // ユーザー情報
        this.currentUser = null;
        
        // セッション管理の設定
        this.sessionTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 5000;
        this.sessionDuration = 30 * 60 * 1000; // 30分
        this.sessionWarningTime = 5 * 60 * 1000; // 5分前に警告
        this.sessionWarningTimeout = null;
        
        // 通知管理
        this.notifications = [];
        this.createNotificationContainer();
        
        // ログイン状態の確認
        this.checkLoginState();
        
        // 再接続設定の改善
        this.maxReconnectAttempts = 3;
        this.baseReconnectDelay = 1000; // 初期遅延時間（1秒）
        this.maxReconnectDelay = 10000; // 最大遅延時間（10秒）
        
        // エラー追跡用
        this.lastErrorTime = null;
        this.errorCount = 0;
    }

    // 通知コンテナの作成
    createNotificationContainer() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'session-notifications';
        this.notificationContainer.style.position = 'fixed';
        this.notificationContainer.style.bottom = '20px';
        this.notificationContainer.style.right = '20px';
        this.notificationContainer.style.zIndex = '1000';
        document.body.appendChild(this.notificationContainer);
    }

    // 通知の表示
    showNotification(message, type = 'info', duration = 5000, actions = []) {
        const notification = document.createElement('div');
        notification.className = `session-notification ${type}`;
        
        let icon = '';
        switch (type) {
            case 'error':
                icon = '⚠️';
                break;
            case 'warning':
                icon = '⚠️';
                break;
            case 'success':
                icon = '✅';
                break;
            default:
                icon = 'ℹ️';
        }

        notification.innerHTML = `
            <span class="icon">${icon}</span>
            <div class="message">${message}</div>
            ${actions.map(action => `
                <button class="action" data-action="${action.id}">${action.label}</button>
            `).join('')}
            <button class="close">×</button>
        `;

        // アクションボタンのイベントリスナー
        actions.forEach(action => {
            const button = notification.querySelector(`[data-action="${action.id}"]`);
            if (button) {
                button.addEventListener('click', () => {
                    action.handler();
                    this.removeNotification(notification);
                });
            }
        });

        // 閉じるボタンのイベントリスナー
        const closeBtn = notification.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.removeNotification(notification);
            });
        }

        this.notificationContainer.appendChild(notification);
        this.notifications.push(notification);

        // 自動で消える設定
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
        }

        return notification;
    }

    // 通知の削除
    removeNotification(notification) {
        notification.classList.add('hiding');
        setTimeout(() => {
            if (notification.parentNode === this.notificationContainer) {
                this.notificationContainer.removeChild(notification);
            }
            this.notifications = this.notifications.filter(n => n !== notification);
        }, 300);
    }

    // ログイン状態をチェック
    async checkLoginState() {
        const savedUser = localStorage.getItem('shop_user');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                
                // セッションの有効性を確認
                const isValid = await this.validateSession();
                if (isValid) {
                    this.updateUserDisplay();
                    document.getElementById('loginModal').classList.remove('visible');
                    document.getElementById('mainContent').classList.remove('hidden');
                    this.startSessionTimer();
                } else {
                    this.handleSessionExpired();
                }
            } catch (error) {
                console.error('セッション確認エラー:', error);
                this.handleSessionExpired();
            }
        }
    }

    // セッションの有効性を確認
    async validateSession() {
        try {
            if (!this.currentUser) return false;
            
            // ユーザー情報を再確認
            const users = await this.callJsonDbApi('findItems', {
                query: { id: this.currentUser.id }
            });

            return users.length > 0;
        } catch (error) {
            console.error('セッション検証エラー:', error);
            return false;
        }
    }

    // セッションタイマーを開始
    startSessionTimer() {
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
        }
        if (this.sessionWarningTimeout) {
            clearTimeout(this.sessionWarningTimeout);
        }

        // 警告タイマーの設定
        this.sessionWarningTimeout = setTimeout(() => {
            const remainingTime = Math.ceil(this.sessionWarningTime / 1000 / 60);
            this.showNotification(
                `セッションが${remainingTime}分後に期限切れになります。続行しますか？`,
                'warning',
                0,
                [{
                    id: 'extend',
                    label: 'セッションを延長',
                    handler: () => this.extendSession()
                }]
            );
        }, this.sessionDuration - this.sessionWarningTime);

        // セッション期限切れタイマーの設定
        this.sessionTimeout = setTimeout(() => {
            this.handleSessionExpired();
        }, this.sessionDuration);
    }

    // セッションの延長
    async extendSession() {
        try {
            const isValid = await this.validateSession();
            if (isValid) {
                this.startSessionTimer();
                this.showNotification('セッションを延長しました', 'success');
            } else {
                this.handleSessionExpired();
            }
        } catch (error) {
            console.error('セッション延長エラー:', error);
            this.handleSessionExpired();
        }
    }

    // ログイン処理
    async login(username, password) {
        try {
            // ユーザー情報を検索
            const users = await this.callJsonDbApi('findItems', {
                query: { name: username }
            });

            if (users.length === 0) {
                throw new Error('ユーザーが見つかりません');
            }

            const user = users[0];
            
            // パスワードの確認
            if (user.password !== password) { // 実際の実装ではハッシュ化して比較
                throw new Error('パスワードが正しくありません');
            }

            // ログイン成功
            this.currentUser = {
                id: user.id,
                name: user.name,
                balance: user.balance
            };

            // ログイン情報を保存
            localStorage.setItem('shop_user', JSON.stringify(this.currentUser));

            // UI更新
            this.updateUserDisplay();
            document.getElementById('loginModal').classList.remove('visible');
            document.getElementById('mainContent').classList.remove('hidden');

            // セッション管理を開始
            this.startSessionTimer();
            this.reconnectAttempts = 0;

            return true;
        } catch (error) {
            console.error('ログインエラー:', error);
            throw error;
        }
    }

    // ログアウト処理
    logout() {
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
        }
        this.currentUser = null;
        localStorage.removeItem('shop_user');
        this.cart = [];
        this.updateCartUI();
        document.getElementById('loginModal').classList.add('visible');
        document.getElementById('mainContent').classList.add('hidden');
    }

    // セッション期限切れの処理
    handleSessionExpired() {
        console.log('セッションが期限切れになりました');
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.showNotification(
                `セッションの再確立を試みています (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
                'warning',
                0,
                [{
                    id: 'retry',
                    label: '今すぐ再試行',
                    handler: () => this.checkLoginState()
                }]
            );
            
            setTimeout(() => {
                this.checkLoginState();
            }, this.reconnectDelay);
        } else {
            this.showNotification(
                'セッションが期限切れになりました。再度ログインしてください。',
                'error',
                0,
                [{
                    id: 'login',
                    label: 'ログイン',
                    handler: () => this.logout()
                }]
            );
            this.logout();
        }
    }

    // JsonDB APIとの通信用メソッド
    async callJsonDbApi(action, data = {}, allowRetry = true) {
        try {
            const requestData = {
                type: action, // APIのtypeパラメータ
                auth: this.AUTH_KEY,
                sheetName: this.SHOP_SHEET,
                ...data
            };

            // Shareツールと同じform-style POST
            const ajaxSettings = {
                dataType: 'json',
                // contentTypeは指定しない（デフォルト: application/x-www-form-urlencoded）
                timeout: 10000, // 10秒でタイムアウト
            };

            // メインリクエスト
            const result = await $.ajax({
                ...ajaxSettings,
                url: this.API_URL,
                type: 'POST',
                data: requestData
            });
            if (!result) {
                throw new Error('サーバーからの応答が空です');
            }
            this.errorCount = 0;
            this.lastErrorTime = null;
            if (!result.success) {
                throw new Error(result.error || 'API通信エラーが発生しました');
            }
            // --- ここでdata配列の各要素のdataフィールドをパース ---
            if (Array.isArray(result.data)) {
                return result.data.map(item => {
                    if (typeof item.data === 'string') {
                        try {
                            return { ...item, data: JSON.parse(item.data) };
                        } catch (e) {
                            return item;
                        }
                    }
                    return item;
                });
            } else if (result.data && typeof result.data.data === 'string') {
                // 単一オブジェクトの場合
                try {
                    return { ...result.data, data: JSON.parse(result.data.data) };
                } catch (e) {
                    return result.data;
                }
            }
            return result.data;
        } catch (error) {
            return this.handleApiError(error, action, data, allowRetry);
        }
    }

    // APIエラーハンドリング
    handleApiError(error, action, data, allowRetry) {
        console.error('API Error:', error);

        const now = Date.now();
        if (this.lastErrorTime && (now - this.lastErrorTime) > 60000) {
            this.errorCount = 0;
        }
        this.errorCount++;
        this.lastErrorTime = now;

        // エラーメッセージの表示
        const errorMessage = error.message || 'APIとの通信中にエラーが発生しました';
        this.showError(errorMessage);

        // 再試行可能なエラーの場合
        if (allowRetry && this.shouldRetryRequest(error)) {
            return this.retryConnection(action, data);
        }

        throw error;
    }

    // エラーメッセージの表示
    showError(message) {
        // エラー通知の表示
        this.showNotification(message, 'error', 5000);
    }

    // 再試行判断
    shouldRetryRequest(error) {
        const retryableErrors = [
            'ネットワークエラー',
            'タイムアウト',
            'サーバー内部エラー',
            'Failed to fetch',
            '503',
            '504'
        ];
        const msg = (error && error.message) ? error.message : '';
        const isRetryableError = retryableErrors.some(e => 
            msg.toLowerCase().includes(e.toLowerCase())
        );
        return isRetryableError && this.errorCount <= this.maxReconnectAttempts;
    }

    // 通信障害時の再接続処理
    async retryConnection(action, data, retryCount = 0) {
        if (retryCount >= this.maxReconnectAttempts) {
            this.showError('サーバーとの通信に失敗しました。しばらく待ってから再度お試しください。');
            throw new Error('再接続の試行回数が上限に達しました');
        }

        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, retryCount),
            this.maxReconnectDelay
        );

        this.showNotification(
            `通信を再試行しています (${retryCount + 1}/${this.maxReconnectAttempts})`,
            'warning',
            delay
        );

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            return await this.callJsonDbApi(action, data, false);
        } catch (error) {
            if (this.shouldRetryRequest(error)) {
                return this.retryConnection(action, data, retryCount + 1);
            }
            throw error;
        }
    }
    
    // エラーメッセージの表示
    showError(message) {
        // エラー通知の表示
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <p class="error-message">${message}</p>
                <button class="error-close">×</button>
            </div>
        `;

        document.body.appendChild(notification);

        // 5秒後に自動で消える
        setTimeout(() => {
            notification.remove();
        }, 5000);

        // 閉じるボタンの処理
        const closeButton = notification.querySelector('.error-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                notification.remove();
            });
        }
    }

    // ユーザー表示の更新
    updateUserDisplay() {
        if (this.currentUser) {
            document.querySelector('.username-display').textContent = this.currentUser.name;
            document.getElementById('balance').textContent = this.currentUser.balance;
        }
    }

    // 購入履歴を取得
    async getPurchaseHistory() {
        if (!this.currentUser) return [];
        try {
            const history = await this.callJsonDbApi('findItems', {
                query: {
                    'userId': this.currentUser.id,
                }
            });
            return history.filter(item => item.id.startsWith('transaction_'))
                         .sort((a, b) => new Date(b.data.timestamp) - new Date(a.data.timestamp));
        } catch (error) {
            console.error('購入履歴取得エラー:', error);
            return [];
        }
    }

    // 残高を取得
    async fetchBalance() {
        if (!this.currentUser) return 0;
        try {
            const user = await this.callJsonDbApi('getItemById', { id: this.currentUser.id });
            if (user && user.data) {
                this.currentUser.balance = user.data.balance;
                this.updateUserDisplay();
                return user.data.balance;
            }
            return 0;
        } catch (error) {
            console.error('残高取得エラー:', error);
            return 0;
        }
    }

    // 残高を更新
    async updateBalance(amount) {
        if (!this.currentUser) return false;
        try {
            await this.callJsonDbApi('updateItemById', {
                id: this.currentUser.id,
                data: {
                    ...this.currentUser,
                    balance: amount
                }
            });
            this.currentUser.balance = amount;
            this.updateUserDisplay();
            return true;
        } catch (error) {
            console.error('残高更新エラー:', error);
            return false;
        }
    }

    // 購入処理
    async checkout() {
        if (!this.currentUser) {
            return {
                success: false,
                error: 'ログインが必要です'
            };
        }

        const total = this.getCartTotal();

        try {
            // 残高の確認
            const currentBalance = await this.fetchBalance();
            if (currentBalance < total) {
                return {
                    success: false,
                    error: '残高が不足しています'
                };
            }

            // 在庫チェック
            for (const item of this.cart) {
                const itemData = await this.callJsonDbApi('getItemById', { id: item.id });
                if (!itemData || !itemData.data || itemData.data.stock < item.quantity) {
                    return {
                        success: false,
                        error: `${item.name}の在庫が不足しています`
                    };
                }
            }

            // トランザクションの記録
            const purchaseHash = crypto.randomUUID();
            await this.callJsonDbApi('addItem', {
                customId: `transaction_${purchaseHash}`,
                data: {
                    userId: this.currentUser.id,
                    items: this.cart,
                    total: total,
                    timestamp: new Date().toISOString()
                }
            });

            // 残高の更新
            const newBalance = currentBalance - total;
            await this.updateBalance(newBalance);

            // 在庫の更新
            for (const item of this.cart) {
                const itemData = await this.callJsonDbApi('getItemById', { id: item.id });
                if (itemData && itemData.data) {
                    const newStock = itemData.data.stock - item.quantity;
                    await this.callJsonDbApi('updateItemById', {
                        id: item.id,
                        data: { ...itemData.data, stock: newStock }
                    });
                }
            }

            // カートをクリア
            this.cart = [];
            this.updateCartUI();

            return {
                success: true,
                hash: purchaseHash,
                newBalance: newBalance
            };

        } catch (error) {
            console.error('購入処理エラー:', error);
            return {
                success: false,
                error: error.message || '購入処理に失敗しました'
            };
        }
    }

    /**
     * 商品を追加
     * @param {Object} item 
     */
    addItem(item) {
        this.items.push(item);
        if (item.category) {
            this.categories.add(item.category);
        }
        // 在庫を初期化（まだ設定されていない場合）
        const currentStock = dataManager.getStock(item.id);
        if (currentStock === 0 && item.stock) {
            dataManager.setStock(item.id, item.stock);
        }
    }

    /**
     * 在庫数を取得
     * @param {string} itemId 
     */    getStock(itemId) {
        return dataManager.getStock(itemId);
    }

    /**
     * 在庫を更新
     * @param {string} itemId 
     * @param {number} quantity 
     */
    updateStock(itemId, quantity) {
        dataManager.setStock(itemId, quantity);
    }

    /**
     * カートに商品を追加
     * @param {string} itemId 
     */
    addToCart(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (item) {
            const existingItem = this.cart.find(i => i.id === itemId);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                this.cart.push({ ...item, quantity: 1 });
            }
            this.updateCartUI();
        }
    }

    /**
     * カートから商品を削除
     * @param {string} itemId 
     */
    removeFromCart(itemId) {
        const index = this.cart.findIndex(i => i.id === itemId);
        if (index !== -1) {
            this.cart.splice(index, 1);
            this.updateCartUI();
        }
    }

    /**
     * カートの合計金額を計算
     */
    getCartTotal() {
        return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }    /**
     * 購入処理を実行
     */    async checkout() {
        const total = this.getCartTotal();

        // 在庫チェック
        for (const item of this.cart) {
            const currentStock = this.getStock(item.id);
            if (currentStock < item.quantity) {
                return {
                    success: false,
                    error: `${item.name}の在庫が不足しています`
                };
            }
        }

        // 購入の妥当性を確認
        const validationResponse = await this.callGasApi('validatePurchase', {
            itemId: this.cart.map(item => item.id).join(','),
            price: total
        });

        if (validationResponse.status === 'error') {
            return {
                success: false,
                error: validationResponse.message
            };
        }

        // 購入処理の実行
        const purchaseResponse = await this.callGasApi('processPurchase', {
            itemId: this.cart.map(item => item.id).join(','),
            price: total
        });

        if (purchaseResponse.status === 'success') {
            // 在庫を減らす
            for (const item of this.cart) {
                const currentStock = this.getStock(item.id);
                this.updateStock(item.id, currentStock - item.quantity);
            }

            // 購入後の処理実行
            await this.executePurchaseActions(purchaseResponse.hash);

            // カートをクリア
            this.cart = [];
            this.updateCartUI();

            return {
                success: true,
                hash: purchaseResponse.hash,
                newBalance: purchaseResponse.newBalance
            };
        }

        return {
            success: false,
            error: purchaseResponse.message
        };
    }

    // 購入後のアクション実行
    async executePurchaseActions(hash) {
        for (const item of this.cart) {
            if (typeof item.onPurchase === 'function') {
                await item.onPurchase(hash);
            }
        }
    }

    /**
     * カートのUIを更新
     */
    updateCartUI() {
        const cartCount = document.querySelector('.cart-count');
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');
        const checkoutBtn = document.getElementById('checkoutBtn');

        // カート数の更新
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
        
        if (totalItems === 0) {
            cartItems.innerHTML = `
                <div class="empty-cart">
                    <span class="empty-cart-icon">🛒</span>
                    <p>カートは空です</p>
                </div>
            `;
            checkoutBtn.disabled = true;
            return;
        }

        // カート内容の更新
        cartItems.innerHTML = this.cart.map(item => `
            <div class="cart-item" role="listitem">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <div class="cart-item-controls">
                        <button 
                            class="quantity-btn" 
                            onclick="shop.updateQuantity('${item.id}', ${item.quantity - 1})"
                            ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button 
                            class="quantity-btn"
                            onclick="shop.updateQuantity('${item.id}', ${item.quantity + 1})"
                            ${item.quantity >= shop.getStock(item.id) ? 'disabled' : ''}>+</button>
                    </div>
                </div>
                <div class="cart-item-price">
                    ${item.price * item.quantity}コイン
                </div>
                <button 
                    class="remove-item-btn"
                    onclick="shop.removeFromCart('${item.id}')"
                    aria-label="${item.name}をカートから削除">
                    ×
                </button>
            </div>
        `).join('');

        // 合計金額の更新と購入ボタンの状態設定
        const total = this.getCartTotal();
        cartTotal.textContent = total;
        
        // 残高チェックして購入ボタンの状態を更新
        const canAfford = currencyManager.getBalance() >= total;
        checkoutBtn.disabled = !canAfford;
        checkoutBtn.classList.toggle('disabled', !canAfford);
        if (!canAfford) {
            checkoutBtn.setAttribute('title', '残高が不足しています');
        } else {
            checkoutBtn.removeAttribute('title');
        }
    }

    /**
     * カート内のアイテム数量を更新
     * @param {string} itemId 
     * @param {number} newQuantity
     */
    updateQuantity(itemId, newQuantity) {
        const item = this.cart.find(i => i.id === itemId);
        if (!item) return;

        if (newQuantity <= 0) {
            this.removeFromCart(itemId);
            return;
        }

        // 在庫チェック
        const stock = this.getStock(itemId);
        if (newQuantity > stock) {
            showNotification('在庫が不足しています', 'error');
            return;
        }

        item.quantity = newQuantity;
        this.updateCartUI();
    }    /**
     * Updates the balance display in the UI.
     */
    updateBalanceUI() {
        const balanceElement = document.getElementById('userBalance');
        if (!balanceElement) {
            console.warn('Balance display element not found, retrying...');
            // DOMが完全に読み込まれるのを待つ
            setTimeout(() => {
                const retryElement = document.getElementById('userBalance');
                if (retryElement) {
                    retryElement.textContent = dataManager.getBalance();
                } else {
                    console.error('Balance display element not found after retry');
                }
            }, 100);
            return;
        }
        balanceElement.textContent = dataManager.getBalance();
    }

    // 購入処理
    async purchaseItem(item) {
        // 価格の検証
        const isPriceValid = await this.verifyPrice(item.id, item.price);
        if (!isPriceValid) {
            throw new Error('商品価格が変更されています。ページを更新してください。');
        }

        // 残高の確認
        const balance = await this.fetchBalance();
        if (balance < item.price) {
            throw new Error('残高が不足しています。');
        }

        // 購入処理
        const purchaseResponse = await this.callGasApi('processPurchase', {
            itemId: item.id,
            price: item.price
        });

        if (purchaseResponse.status === 'success') {
            // トランザクションの保存
            await this.callGasApi('saveTransaction', {
                transactionId: purchaseResponse.hash,
                type: 'purchase',
                amount: -item.price
            });

            // アイテム固有の処理を実行
            await this.executeItemAction(item, purchaseResponse.hash);
            
            // カートから削除
            this.removeFromCart(item.id);
            
            // 残高を更新
            await this.fetchBalance();
            
            return {
                status: 'success',
                message: '購入が完了しました',
                hash: purchaseResponse.hash
            };
        }

        throw new Error('購入処理に失敗しました。');
    }

    // アイテム固有の処理を実行
    async executeItemAction(item, hash) {
        switch (item.type) {
            case 'command':
                await this.executeCommand(item.action, hash);
                break;
            case 'download':
                await this.initiateDownload(item.fileUrl, hash);
                break;
            case 'unlock':
                await this.unlockContent(item.contentId, hash);
                break;
            default:
                console.log('No specific action for this item type');
        }
    }

    // コマンド実行
    async executeCommand(command, hash) {
        // コマンド実行のロジック
        console.log(`Executing command: ${command} with hash: ${hash}`);
    }

    // ダウンロード開始
    async initiateDownload(url, hash) {
        // ダウンロード処理のロジック
        window.open(`${url}?hash=${hash}`, '_blank');
    }

    // コンテンツのアンロック
    async unlockContent(contentId, hash) {
        // コンテンツアンロックのロジック
        console.log(`Unlocking content: ${contentId} with hash: ${hash}`);
    }
}

// シングルトンインスタンスとしてエクスポート
const shop = new Shop();
