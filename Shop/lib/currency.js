/**
 * 通貨管理クラス
 * DataManager対応版
 */
class CurrencyManager {
    constructor() {
        this.API_ENDPOINT = '/api/currency'; // APIエンドポイント（将来の拡張用）
    }

    /**
     * 残高を取得
     */
    getBalance() {
        return dataManager.getBalance();
    }

    /**
     * 残高を設定
     * @param {number} amount 
     */
    setBalance(amount) {
        dataManager.setBalance(amount);
    }

    /**
     * 金額を追加
     * @param {number} amount 
     */
    addBalance(amount) {
        const currentBalance = dataManager.getBalance();
        dataManager.setBalance(currentBalance + amount);
        return dataManager.getBalance();
    }

    /**
     * 金額を差し引く
     * @param {number} amount 
     * @returns {boolean} 取引が成功したかどうか
     */
    deductBalance(amount) {
        const currentBalance = dataManager.getBalance();
        if (currentBalance >= amount) {
            dataManager.setBalance(currentBalance - amount);
            return true;
        }
        return false;
    }

    /**
     * API通信用のヘルパーメソッド（将来の拡張用）
     */
    async _apiRequest(endpoint, method = 'GET', data = null) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: data ? JSON.stringify(data) : undefined
            };
            const response = await fetch(`${this.API_ENDPOINT}${endpoint}`, options);
            if (!response.ok) throw new Error('API request failed');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    }
}

// シングルトンインスタンスとしてエクスポート
const currencyManager = new CurrencyManager();
