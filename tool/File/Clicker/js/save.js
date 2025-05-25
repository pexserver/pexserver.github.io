// セーブ・ロード・バリデーションを担当

// セーブ/ロード機能管理

// Cookie関連の関数
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// セーブデータの検証
function validateSaveData(data) {
    const defaults = {
        gold: 0,
        level: 1,
        health: gameConfig.initialHealth,
        maxHealth: gameConfig.initialHealth,
        attack: gameConfig.initialAttack,
        exp: 0,
        currentStage: 1,
        mana: 50,
        maxMana: 50,
        defense: 5,
        speed: 10,
        inventory: {},
        stats: {
            kills: 0,
            pvpWins: 0,
            goldEarned: 0,
            itemsUsed: 0,
            bossKills: 0
        }
    };
    
    Object.keys(defaults).forEach(key => {
        if (data[key] === undefined || data[key] === null) {
            if (typeof defaults[key] === 'object') {
                data[key] = { ...defaults[key] };
            } else if (!isNaN(defaults[key]) && isNaN(data[key])) {
                data[key] = defaults[key];
            }
        }
    });
    
    return data;
}

// ゲームデータを保存
function saveGame() {
    if (!player) return;
    
    try {
        const saveData = {
            gold: player.gold,
            level: player.level,
            health: player.health,
            maxHealth: player.maxHealth,
            attack: player.attack,
            defense: player.defense,
            speed: player.speed,
            exp: player.exp,
            currentStage: player.currentStage,
            inventory: player.inventory,
            name: player.name,
            mana: player.mana || 50,
            maxMana: player.maxMana || 50,
            stats: player.stats || {
                kills: 0,
                pvpWins: 0,
                goldEarned: 0,
                itemsUsed: 0,
                bossKills: 0
            },
            soundEnabled: gameConfig.soundEnabled
        };
        
        setCookie('playerData', JSON.stringify(saveData), 30);
        console.log('Game saved successfully');
        
    } catch (error) {
        console.error('Failed to save game:', error);
    }
}

// ゲームデータを読み込み
function loadGame() {
    try {
        const savedData = getCookie('playerData');
        if (savedData) {
            const data = JSON.parse(savedData);
            const validatedData = validateSaveData(data);
            
            // サウンド設定を復元
            if (validatedData.soundEnabled !== undefined) {
                gameConfig.soundEnabled = validatedData.soundEnabled;
            }
            
            return validatedData;
        }
    } catch (error) {
        console.error('Failed to load save data:', error);
    }
    
    return null;
}

// ゲームリセット
function resetGame() {
    if (confirm('本当にゲームをリセットしますか？すべてのデータが失われます。')) {
        // Cookieを削除
        document.cookie = 'playerData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        // ページをリロード
        location.reload();
        
        playSound('notification');
    }
}

// 自動セーブ機能
function startAutoSave() {
    setInterval(() => {
        saveGame();
    }, 30000); // 30秒ごとに自動セーブ
}

// データエクスポート（デバッグ用）
function exportSaveData() {
    const saveData = getCookie('playerData');
    if (saveData) {
        const blob = new Blob([saveData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'clicker_rpg_save.json';
        a.click();
        URL.revokeObjectURL(url);
    }
}

// データインポート（デバッグ用）
function importSaveData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        const validatedData = validateSaveData(data);
        setCookie('playerData', JSON.stringify(validatedData), 30);
        location.reload();
    } catch (error) {
        console.error('Failed to import save data:', error);
        alert('セーブデータの読み込みに失敗しました。');
    }
}
