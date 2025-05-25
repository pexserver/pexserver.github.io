// UI更新、エフェクト、ログ表示、インベントリUIを担当

// UI管理とモーダル機能

// UI更新関数
function updateUI() {
    if (!player || !currentEnemy) return;
    
    // プレイヤーステータス更新
    const playerStats = document.getElementById('player-stats');
    if (playerStats) {
        playerStats.innerHTML = `
            <div class="stat-group">
                <h3>${player.name}</h3>                <div class="stat-bar">
                    <div class="stat-label">HP: ${player.health}/${player.maxHealth}</div>
                    <div class="player-health-bar">
                        <div class="health-fill" style="width: ${(player.health / player.maxHealth) * 100}%"></div>
                    </div>
                </div>                <div class="stat-bar">
                    <div class="stat-label">MP: ${player.mana}/${player.maxMana}</div>
                    <div class="player-mana-bar">
                        <div class="mana-fill" style="width: ${(player.mana / player.maxMana) * 100}%"></div>
                    </div>
                </div>
                <div class="stats-grid">
                    <div>レベル: ${player.level}</div>
                    <div>ゴールド: ${player.gold}</div>
                    <div>攻撃力: ${player.getEffectiveAttack()}</div>
                    <div>防御力: ${player.getEffectiveDefense()}</div>
                    <div>経験値: ${player.exp}/${player.nextLevelExp}</div>
                </div>
            </div>
        `;
    }
    
    // 敵ステータス更新
    const enemyStats = document.getElementById('enemy-stats');
    if (enemyStats) {
        enemyStats.innerHTML = `
            <div class="enemy-info">
                <h3>${currentEnemy.name} ${currentEnemy.isBoss ? '👑' : ''}</h3>
                <div>レベル: ${currentEnemy.level}</div>
                <div>HP: ${currentEnemy.health}/${currentEnemy.maxHealth}</div>
                <div>攻撃力: ${currentEnemy.attack}</div>
                <div>防御力: ${currentEnemy.defense}</div>
            </div>        `;
    }
    
    // ステージ情報更新
    const currentStageElement = document.getElementById('current-stage');
    if (currentStageElement) {
        currentStageElement.textContent = player.currentStage;
    }
    
    // サウンドボタン更新
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.textContent = gameConfig.soundEnabled ? '🔊 サウンドON' : '🔇 サウンドOFF';
    }
    
    bindCommandButtonEvents(); // UI更新のたびにコマンドボタンイベントを再バインド
}

// 体力バーの色を取得
function getHealthBarColor(percentage) {
    if (percentage > 70) return '#4CAF50';
    if (percentage > 30) return '#FF9800';
    return '#F44336';
}

// バトルログ表示
function showBattleLog(message) {
    console.log(`[Battle] ${message}`);
    
    // 将来的にバトルログ表示エリアを追加予定
    const logArea = document.getElementById('battle-log');
    if (logArea) {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = message;
        logArea.appendChild(logEntry);
        
        // 古いログを削除（最新10件のみ保持）
        while (logArea.children.length > 10) {
            logArea.removeChild(logArea.firstChild);
        }
        
        // 自動スクロール
        logArea.scrollTop = logArea.scrollHeight;
    }
}

// モーダル管理
function openModal() {
    const modal = document.getElementById('game-modal');
    if (modal) {
        modal.style.display = 'block';
        updateShopItems();
        updateInventoryDisplay();
        updateSkillTree();
        updateStatsDisplay();
        playSound('menuOpen');
    }
}

function closeModal() {
    const modal = document.getElementById('game-modal');
    if (modal) {
        modal.style.display = 'none';
        playSound('menuClose');
    }
}

// タブ切り替え
function showTab(tabName) {
    // すべてのタブコンテンツを非表示
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));
    
    // すべてのタブボタンを非アクティブ
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => button.classList.remove('active'));
    
    // 選択されたタブを表示
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // 選択されたタブボタンをアクティブ
    const activeButton = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // タブ固有の更新処理
    switch (tabName) {
        case 'shop':
            updateShopItems();
            break;
        case 'inventory':
            updateInventoryDisplay();
            break;
        case 'skills':
            updateSkillTree();
            break;
        case 'stats':
            updateStatsDisplay();
            break;
    }
    
    playSound('click');
}

// ショップアイテム表示更新
function updateShopItems() {
    const shopGrid = document.getElementById('shop-items');
    if (!shopGrid) return;
    
    shopGrid.innerHTML = '';
    
    shopItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'shop-item';
        
        const canBuy = player.gold >= item.cost;
        itemDiv.innerHTML = `
            <div class="item-info">
                <h4>${item.name}</h4>
                <p>${item.description}</p>
                <p class="item-cost">💰 ${item.cost}ゴールド</p>
            </div>
            <button class="buy-btn ${canBuy ? '' : 'disabled'}" 
                    onclick="buyItem('${item.id}')" 
                    ${canBuy ? '' : 'disabled'}>
                購入
            </button>
        `;
        
        shopGrid.appendChild(itemDiv);
    });
}

// インベントリ表示更新
function updateInventoryDisplay() {
    const inventoryGrid = document.getElementById('inventory-items');
    if (!inventoryGrid) return;
    
    inventoryGrid.innerHTML = '';
    
    const inventoryItems = player.getInventoryItems();
    
    if (inventoryItems.length === 0) {
        inventoryGrid.innerHTML = '<div class="empty-inventory">アイテムがありません</div>';
        return;
    }
    
    inventoryItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'inventory-item';
        itemDiv.innerHTML = `
            <div class="item-info">
                <div class="item-name">${item.name} x${item.quantity}</div>
                <div class="item-description">${item.description}</div>
            </div>
            <button class="use-button" onclick="player.useItem('${item.id}'); updateInventoryDisplay(); updateUI();">
                使用
            </button>
        `;
        
        inventoryGrid.appendChild(itemDiv);
    });
}

// スキルツリー表示更新
function updateSkillTree() {
    const skillTree = document.getElementById('skill-tree');
    if (!skillTree) return;
    
    skillTree.innerHTML = '';
    
    player.skills.forEach(skill => {
        const skillDiv = document.createElement('div');
        skillDiv.className = 'skill-item';
        
        const canUse = player.canUseSkill(skill);
        skillDiv.innerHTML = `
            <div class="skill-info">
                <div class="skill-name">${skill.name}</div>
                <div class="skill-description">${skill.description}</div>
                <div class="skill-cost">MP: ${skill.manaCost}</div>
            </div>
            <div class="skill-status ${canUse ? 'available' : 'unavailable'}">
                ${canUse ? '使用可能' : 'MP不足'}
            </div>
        `;
        
        skillTree.appendChild(skillDiv);
    });
}

// 統計表示更新
function updateStatsDisplay() {
    const statsContainer = document.querySelector('#stats-tab .stats-container');
    if (!statsContainer) return;
    
    statsContainer.innerHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-label">倒した敵の数</div>
                <div class="stat-value">${player.stats.kills}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">ボス撃破数</div>
                <div class="stat-value">${player.stats.bossKills}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">PvP勝利数</div>
                <div class="stat-value">${player.stats.pvpWins}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">獲得ゴールド</div>
                <div class="stat-value">${player.stats.goldEarned}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">使用アイテム数</div>
                <div class="stat-value">${player.stats.itemsUsed}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">現在のステージ</div>
                <div class="stat-value">${player.currentStage}</div>
            </div>
        </div>
        <div class="controls">
            <button onclick="exportSaveData()">セーブデータエクスポート</button>
            <button onclick="resetGame()" class="danger-button">ゲームリセット</button>
        </div>
    `;
}

// ショップ購入処理
function buyItem(itemId) {
    const item = shopItems.find(i => i.id === itemId);
    if (!item) return;
    
    if (player.gold < item.cost) {
        showBattleLog('ゴールドが不足しています！');
        playSound('error');
        return;
    }
    
    player.gold -= item.cost;
    
    // アイテムタイプに応じた処理
    switch (itemId) {
        case 'healthPotion':
        case 'strengthPotion':
        case 'maxHealthUp':
            player.addToInventory(itemId, 1);
            break;
            
        case 'attackUp':
            player.attack += 5;
            showBattleLog('攻撃力が5上がった！');
            break;
            
        case 'defenseUp':
            player.defense += 3;
            showBattleLog('防御力が3上がった！');
            break;
    }
    
    playSound('buy');
    showBattleLog(`${item.name}を購入しました！`);
    
    updateShopItems();
    updateUI();
    saveGame();
}

// 攻撃エフェクト表示
function showAttackEffect() {
    const attackElement = document.createElement('div');
    attackElement.className = 'attack-animation';
    attackElement.style.left = '50%';
    attackElement.style.top = '50%';
    attackElement.style.transform = 'translate(-50%, -50%)';
    
    document.body.appendChild(attackElement);
    
    setTimeout(() => {
        if (attackElement.parentNode) {
            attackElement.parentNode.removeChild(attackElement);
        }
    }, 500);
}

// ウィンドウ外クリックでモーダルを閉じる
window.addEventListener('click', function(event) {
    const modals = ['skill-modal', 'item-modal', 'game-modal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// バトルログ表示関数
function showBattleLog(message) {
    console.log(`[バトルログ] ${message}`);
    
    const notification = document.createElement('div');
    notification.className = 'battle-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    }, 3000);
}

// メインUI更新関数
function updateUI() {
    if (!player || !currentEnemy) return;
    
    const playerStatsElement = document.getElementById('player-stats');
    if (playerStatsElement) {
        const healthPercent = Math.max(0, (player.health / player.maxHealth) * 100);
        const expPercent = Math.max(0, (player.exp / player.nextLevelExp) * 100);

        playerStatsElement.innerHTML = `
            <h4>プレイヤー (レベル ${player.level})</h4>
            <div class="stat-bar">
                <div class="health-bar" style="width: ${healthPercent}%"></div>
                <div class="stat-label">HP: ${player.health}/${player.maxHealth}</div>
            </div>
            <div class="stat-bar">
                <div class="mana-bar" style="width: ${expPercent}%"></div>
                <div class="stat-label">EXP: ${player.exp}/${player.nextLevelExp}</div>
            </div>
            <div class="player-stats-details">
                <span>攻撃力: ${Math.floor(player.attack * (player.attackMultiplier || 1))}</span>
                <span>ゴールド: ${player.gold}</span>
            </div>`;
    }

    const enemyStatsElement = document.getElementById('enemy-stats');
    if (enemyStatsElement && currentEnemy) {
        const enemyHealthPercent = Math.max(0, (currentEnemy.health / currentEnemy.maxHealth) * 100);

        enemyStatsElement.innerHTML = `
            <h4>${currentEnemy.name} (レベル ${currentEnemy.level})</h4>
            <div class="stat-bar">
                <div class="health-bar" style="width: ${enemyHealthPercent}%"></div>
                <div class="stat-label">HP: ${currentEnemy.health}/${currentEnemy.maxHealth}</div>
            </div>
            <div class="enemy-stats-details">
                <span>攻撃力: ${currentEnemy.attack}</span>
                <span>防御力: ${currentEnemy.defense}</span>
            </div>`;
    }

    const currentStageElement = document.getElementById('current-stage');
    if (currentStageElement) {
        currentStageElement.textContent = currentStage;
    }

    saveGame();
}
