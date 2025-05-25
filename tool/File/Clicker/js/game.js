// メインゲームロジック
// Cookie関連の関数、Player、Enemy、Save/Load機能は各モジュールファイルに定義されています

// ゲーム状態の変数
let player = null;
let currentEnemy = null;
let activeBuffs = [];
let battleState = 'player';
let currentStage = 1;

// サウンド関連の関数はsound.jsに定義されています
// ダメージ計算関数はbattle.jsに定義されています
// バトル関連の関数（playerAttack, enemyAttack, enemyTurn）はbattle.jsに定義されています
// UI関連の関数（showAttackEffect, showBattleLog, updateUI）はui.jsに定義されています
// 敵撃破処理、ゲームオーバー処理、敵生成処理はbattle.jsに定義されています
// レベルアップ処理はplayer.jsに定義されています

// ゲームデータ保存関数
function saveGame() {
    if (!player) return;
    
    const saveData = {
        gold: player.gold,
        level: player.level,
        health: player.health,
        maxHealth: player.maxHealth,
        attack: player.attack,
        defense: player.defense,
        speed: player.speed,
        exp: player.exp,
        currentStage: currentStage,
        inventory: player.inventory,
        stats: player.stats,
        name: player.name
    };
    
    setCookie('playerData', JSON.stringify(saveData), 365);
}

// インベントリUI更新
function updateInventoryUI() {
    const inventoryContainer = document.getElementById('inventory-items');
    if (!inventoryContainer) return;
    
    inventoryContainer.innerHTML = '';
    
    Object.entries(player.inventory || {}).forEach(([itemId, quantity]) => {
        if (quantity > 0 && items[itemId]) {
            const itemElement = document.createElement('div');
            itemElement.className = 'inventory-item';
            
            itemElement.innerHTML = `
                <div class="item-info">
                    <h4>${items[itemId].name}</h4>
                    <p>${items[itemId].description}</p>
                    <p class="item-quantity">所持数: ${quantity}</p>
                </div>
                <button onclick="useItem('${itemId}')" class="use-item-btn">
                    使用
                </button>
            `;
            inventoryContainer.appendChild(itemElement);
        }
    });
    
    if (Object.keys(player.inventory || {}).length === 0) {
        inventoryContainer.innerHTML = '<p style="text-align: center; color: #999;">アイテムがありません</p>';
    }
}

// ショップUI更新
function updateShopUI() {
    const shopContainer = document.getElementById('shop-items');
    if (!shopContainer) return;
    
    shopContainer.innerHTML = '';
    
    Object.entries(items).forEach(([itemId, item]) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'shop-item';
        
        const canAfford = player.gold >= item.cost;
        const buttonClass = canAfford ? 'buy-btn' : 'buy-btn disabled';
        
        itemElement.innerHTML = `
            <div class="item-info">
                <h4>${item.name}</h4>
                <p>${item.description}</p>
                <p class="item-cost">コスト: ${item.cost}ゴールド</p>
            </div>
            <button onclick="buyItem('${itemId}')" class="${buttonClass}" ${!canAfford ? 'disabled' : ''}>
                購入
            </button>
        `;
        shopContainer.appendChild(itemElement);
    });
}

// アイテム購入処理
function buyItem(itemId) {
    if (!items[itemId] || player.gold < items[itemId].cost) {
        showBattleLog('ゴールドが不足しています！');
        return;
    }
    
    player.gold -= items[itemId].cost;
    
    if (!player.inventory[itemId]) {
        player.inventory[itemId] = 0;
    }
    player.inventory[itemId]++;
    
    showBattleLog(`${items[itemId].name}を購入しました！`);
    playSound('buy');
    
    updateUI();
    updateShopUI();
    updateInventoryUI();
}

// アイテム使用処理
function useItem(itemId) {
    if (!player.inventory[itemId] || player.inventory[itemId] <= 0) {
        showBattleLog('そのアイテムは持っていません！');
        return;
    }
    
    const item = items[itemId];
    item.effect(player);
    player.inventory[itemId]--;
    
    showBattleLog(`${item.name}を使用しました！`);
    
    updateUI();
    updateInventoryUI();
}

// モーダル関連の関数
function openModal() {
    document.getElementById('game-modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('game-modal').style.display = 'none';
}

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        document.querySelectorAll('.tab-button').forEach(btn => {
            if (btn.onclick && btn.onclick.toString().includes(`'${tabName}'`)) {
                btn.classList.add('active');
            }
        });
    }
    
    switch(tabName) {
        case 'shop':
            updateShopUI();
            break;
        case 'inventory':
            updateInventoryUI();
            break;
        case 'skills':
            updateSkillUI();
            break;
        case 'stats':
            updateStatsUI();
            break;
    }
}

function toggleSound() {
    gameConfig.soundEnabled = !gameConfig.soundEnabled;
    const toggle = document.getElementById('sound-toggle');
    if (toggle) {
        toggle.textContent = gameConfig.soundEnabled ? '🔊 サウンドON' : '🔇 サウンドOFF';
    }
}

// コマンド処理（battle.jsのhandleCommandのみを使う）
// game.jsのhandleCommandは無効化

// コマンドボタンイベント再バインド
function bindCommandButtonEvents() {
    console.log('bindCommandButtonEvents called');
    console.log('window.handleCommand exists:', typeof window.handleCommand);
    
    const attackBtn = document.getElementById('attack-btn');
    if (attackBtn) {
        attackBtn.onclick = () => {
            console.log('Attack button clicked, calling handleCommand');
            window.handleCommand('attack');
        };
        console.log('Attack button bound');
    }
    
    const skillBtn = document.getElementById('skill-btn');
    if (skillBtn) {
        skillBtn.onclick = () => {
            console.log('Skill button clicked, calling handleCommand');
            window.handleCommand('skill');
        };
        console.log('Skill button bound');
    }
    
    const itemBtn = document.getElementById('item-btn');
    if (itemBtn) {
        itemBtn.onclick = () => {
            console.log('Item button clicked, calling handleCommand');
            window.handleCommand('item');
        };
        console.log('Item button bound');
    }
    
    const defendBtn = document.getElementById('defend-btn');
    if (defendBtn) {
        defendBtn.onclick = () => {
            console.log('Defend button clicked, calling handleCommand');
            window.handleCommand('defend');
        };
        console.log('Defend button bound');
    }
}

// 統計UI更新
function updateStatsUI() {
    const statsContainer = document.querySelector('.stats-container');
    if (!statsContainer) return;
    
    const stats = player.stats || { kills: 0, pvpWins: 0, goldEarned: 0, itemsUsed: 0, bossKills: 0 };
    
    statsContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">レベル</span>
            <span class="stat-value">${player.level}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">現在のゴールド</span>
            <span class="stat-value">${player.gold}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">総撃破数</span>
            <span class="stat-value">${stats.kills}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">ボス撃破数</span>
            <span class="stat-value">${stats.bossKills}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">現在のステージ</span>
            <span class="stat-value">${currentStage}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">最大HP</span>
            <span class="stat-value">${player.maxHealth}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">攻撃力</span>
            <span class="stat-value">${player.attack}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">獲得ゴールド総額</span>
            <span class="stat-value">${stats.goldEarned}</span>
        </div>
    `;
}

// スキルUI更新
function updateSkillUI() {
    const skillContainer = document.getElementById('skill-tree');
    if (!skillContainer) return;
    
    skillContainer.innerHTML = `
        <h3>スキルツリー</h3>
        <p>レベル ${player.level} / 経験値 ${player.exp}/${player.nextLevelExp}</p>
        <div class="skill-info">
            <p>現在利用可能なスキル:</p>
            <ul>
                <li>攻撃 - 基本攻撃</li>
                <li>防御 - ダメージを半減</li>
                ${player.level >= 3 ? '<li>強攻撃 - 1.5倍ダメージ</li>' : ''}
                ${player.level >= 5 ? '<li>回復 - HPを30回復</li>' : ''}
                ${player.level >= 7 ? '<li>会心撃 - 2倍ダメージ</li>' : ''}
            </ul>
        </div>
    `;
}

// コマンドボタン更新
function updateCommandButtons(disabled = false) {
    const commandArea = document.getElementById('command-area');
    if (!commandArea) return;
    const buttons = commandArea.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.disabled = disabled;
    });
}

// ゲーム開始時にすべてのUIを初期化
function initializeAllUI() {
    updateUI();
    updateInventoryUI();
    updateShopUI();
    updateStatsUI();
    updateSkillUI();
}

// ゲーム初期化処理
function initGame() {
    console.log('initGame called');
    player = new Player();
    player.initializeSkillsAndItems();
    currentStage = player.currentStage || 1;
    battleState = 'player';
    
    console.log('About to spawn enemy');
    spawnEnemy(); // これでstartBattleも呼ばれ、戦闘状態が始まる
    
    initializeAllUI();
    updateCommandButtons();
    bindCommandButtonEvents();
    
    console.log('initGame completed:', {
        playerExists: !!player,
        enemyExists: !!currentEnemy,
        inBattle: gameState ? gameState.inBattle : 'gameState not defined'
    });
    
    setInterval(() => {
        saveGame();
    }, 30000);
}

// ゲーム開始時の初期化
document.addEventListener('DOMContentLoaded', function() {
    try {
        initGame();
    } catch (error) {
        console.error('Game Error:', error);
        console.log('Critical error detected, resetting game...');
        resetGame();
    }
});
