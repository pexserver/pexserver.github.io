/**
 * ショップのデータを一元管理するクラス
 */
class DataManager {
    constructor() {
        this.COOKIE_KEY = 'pex_shop';
        this.initializeData();
    }

    /**
     * データを初期化
     */
    initializeData() {
        const savedData = this._getCookie(this.COOKIE_KEY);
        if (savedData) {
            this.data = JSON.parse(decodeURIComponent(savedData));
        } else {
            // デフォルトのデータ構造
            this.data = {
                balance: 1000, // 初期残高
                inventory: {}, // 在庫データ
                purchaseHistory: [], // 購入履歴
                cart: [], // カートの状態
                lastUpdated: new Date().toISOString()
            };
            this.saveData();
        }
    }

    /**
     * データを保存
     */
    saveData() {
        this.data.lastUpdated = new Date().toISOString();
        const value = encodeURIComponent(JSON.stringify(this.data));
        this._setCookie(this.COOKIE_KEY, value, 365); // 365日間保存
    }

    /**
     * 残高を取得
     */
    getBalance() {
        return this.data.balance;
    }

    /**
     * 残高を設定
     * @param {number} amount 
     */
    setBalance(amount) {
        this.data.balance = amount;
        this.saveData();
    }

    /**
     * 残高を減算
     * @param {number} amount 
     */
    deductBalance(amount) {
        if (this.data.balance >= amount) {
            this.data.balance -= amount;
            this.saveData();
            return true;
        }
        return false;
    }

    /**
     * 在庫データを取得
     * @param {string} itemId 
     */
    getStock(itemId) {
        return this.data.inventory[itemId] || 0;
    }

    /**
     * 在庫データを設定
     * @param {string} itemId 
     * @param {number} quantity 
     */
    setStock(itemId, quantity) {
        this.data.inventory[itemId] = quantity;
        this.saveData();
    }

    /**
     * 購入履歴を取得
     */
    getPurchaseHistory() {
        return this.data.purchaseHistory;
    }

    /**
     * 購入履歴を追加
     * @param {Object} purchaseData 
     */
    addPurchaseHistory(purchaseData) {
        this.data.purchaseHistory.push({
            ...purchaseData,
            timestamp: new Date().toISOString()
        });
        this.saveData();
    }

    /**
     * 購入履歴をクリア
     */
    clearPurchaseHistory() {
        this.data.purchaseHistory = [];
        this.saveData();
    }

    /**
     * クッキーを取得
     * @param {string} name 
     */
    _getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    /**
     * クッキーを設定
     * @param {string} name 
     * @param {string} value 
     * @param {number} days 
     */
    _setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = `expires=${date.toUTCString()}`;
        document.cookie = `${name}=${value};${expires};path=/`;
    }

    /**
     * データをエクスポート（GAS連携用）
     */
    exportData() {
        return {
            balance: this.data.balance,
            inventory: this.data.inventory,
            purchaseHistory: this.data.purchaseHistory,
            lastUpdated: this.data.lastUpdated
        };
    }

    /**
     * データをインポート（GAS連携用）
     * @param {Object} data 
     */
    importData(data) {
        this.data = {
            ...this.data,
            ...data,
            lastUpdated: new Date().toISOString()
        };
        this.saveData();
    }

    /**
     * ユーザーIDを取得（なければ生成して保存）
     * @returns {string}
     */
    getUserId() {
        const key = 'shopUserId';
        let id = localStorage.getItem(key);
        if (!id) {
            id = Math.random().toString(36).slice(2, 12);
            localStorage.setItem(key, id);
        }
        return id;
    }
}

// シングルトンインスタンスとしてエクスポート
const dataManager = new DataManager();
