const gameConfig = {
    initialGold: 0,
    initialLevel: 1,
    initialHealth: 100,
    initialAttack: 10,
    soundEnabled: true,
    stagesPerArea: 10,
    bossEvery: 10,
    killHealPercent: 20,
    pvpBotInterval: 5,
    pvpRewards: {
        gold: 100,
        exp: 150
    }
};

// アイテム定義
const items = {
    healthPotion: {
        name: '回復ポーション',
        description: 'HPを50回復する',
        cost: 10,
        effect: (player) => {
            player.health = Math.min(player.maxHealth, player.health + 50);
            playSound('heal');
        }
    },
    strengthPotion: {
        name: '攻撃力アップポーション',
        description: '一時的に攻撃力が2倍になる(30秒)',
        cost: 100,
        effect: (player) => {
            player.attackMultiplier = 2;
            playSound('buff');
            setTimeout(() => {
                player.attackMultiplier = 1;
                updateUI();
            }, 30000);
        }
    },
    maxHealthUp: {
        name: 'HP上限アップ',
        description: '最大HPを25増加する',
        cost: 200,
        effect: (player) => {
            player.maxHealth += 25;
            player.health = player.maxHealth;
            playSound('powerup');
        }
    }
};

// エリア・イベント・状態異常・バフ定義
const areaList = [
    { name: '草原', bg: 'bg-grass', event: '宝箱' },
    { name: '洞窟', bg: 'bg-cave', event: 'ミニボス' },
    { name: '火山', bg: 'bg-volcano', event: 'ランダムバフ' },
    { name: '天空', bg: 'bg-sky', event: '回復泉' }
];

const statusEffects = {
    poison: { name: '毒', duration: 3, effect: (target) => { target.health -= 5; } },
    stun: { name: 'スタン', duration: 1, effect: (target) => { target.stunned = true; } },
    regen: { name: '再生', duration: 3, effect: (target) => { target.health = Math.min(target.maxHealth, target.health + 10); } }
};

// サウンド管理
const sounds = {
    click: { freq: 440, duration: 0.1 },
    levelup: { freq: [523.25, 659.25, 783.99], duration: 0.2 },
    battle: { freq: 329.63, duration: 0.15 },
    victory: { freq: [523.25, 659.25, 783.99, 1046.50], duration: 0.3 },
    heal: { freq: [698.46, 880.00], duration: 0.2 },
    buff: { freq: [587.33, 739.99, 880.00], duration: 0.15 },
    skill: { freq: [493.88, 587.33], duration: 0.1 },
    buy: { freq: [659.25, 523.25], duration: 0.1 },
    powerup: { freq: [523.25, 659.25, 783.99, 987.77], duration: 0.3 },
    newarea: { freq: [392.00, 493.88, 587.33, 783.99], duration: 0.4 },
    attack: { freq: 330, duration: 0.1 },
    critical: { freq: [440, 550, 660], duration: 0.15 },
    hit: { freq: 220, duration: 0.1 },
    gameover: { freq: [220, 196, 165], duration: 0.5 },
    pvpwin: { freq: [523.25, 659.25, 783.99], duration: 0.3 }
};

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
        currentStage: 1
    };
    
    Object.keys(defaults).forEach(key => {
        if (data[key] === undefined || data[key] === null || isNaN(data[key])) {
            data[key] = defaults[key];
        }
    });
    
    return data;
}

// プレイヤーの状態管理
class Player {
    constructor(isBot = false) {
        if (isBot) {
            this.level = Math.max(1, player ? player.level - 1 : 1);
            this.maxHealth = gameConfig.initialHealth + (this.level * 10);
            this.health = this.maxHealth;
            this.attack = gameConfig.initialAttack + (this.level * 2);
            this.name = this.generateBotName();
            return;
        }

        const savedData = getCookie('playerData');
        let saved = {};
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                saved = validateSaveData(data);
            } catch (e) {
                console.error('Failed to load save data:', e);
                saved = {};
            }
        }
        
        this.gold = saved.gold ?? gameConfig.initialGold;
        this.level = saved.level ?? gameConfig.initialLevel;
        this.maxHealth = saved.maxHealth ?? gameConfig.initialHealth;
        this.health = saved.health ?? this.maxHealth;
        this.attack = saved.attack ?? gameConfig.initialAttack;
        this.defense = saved.defense ?? 5;
        this.speed = saved.speed ?? 10;
        this.exp = saved.exp ?? 0;
        this.nextLevelExp = this.calculateNextLevelExp();
        this.currentStage = saved.currentStage ?? 1;
        this.inventory = saved.inventory ?? {};
        this.attackMultiplier = 1;
        this.name = saved.name ?? "プレイヤー";
        this.statusEffects = [];
        this.stats = saved.stats ?? {
            kills: 0,
            pvpWins: 0,
            goldEarned: 0,
            itemsUsed: 0,
            bossKills: 0
        };
    }

    initializeSkillsAndItems() {
        this.skills = [
            {
                name: '強打',
                manaCost: 10,
                description: '1.5倍のダメージを与える',
                effect: (player, enemy) => {
                    const damage = Math.floor(player.attack * 1.5);
                    enemy.health = Math.max(0, enemy.health - damage);
                    showBattleLog(`強打で${damage}ダメージを与えた！`);
                }
            },
            {
                name: '回復',
                manaCost: 15,
                description: 'HPを30回復する',
                effect: (player) => {
                    const healAmount = 30;
                    player.health = Math.min(player.maxHealth, player.health + healAmount);
                    showBattleLog(`${healAmount}HP回復した！`);
                }
            },
            {
                name: 'マジックミサイル',
                manaCost: 20,
                description: '魔法攻撃で確実にダメージを与える',
                effect: (player, enemy) => {
                    const damage = Math.floor(player.attack * 1.2);
                    enemy.health = Math.max(0, enemy.health - damage);
                    const healAmount = Math.floor(damage * 0.2);
                    player.health = Math.min(player.maxHealth, player.health + healAmount);
                    showBattleLog(`${healAmount}HP回復した！`);
                }
            }
        ];
        this.items = ['healthPotion'];
    }

    generateBotName() {
        const names = ['アルファ', 'ベータ', 'ガンマ', 'デルタ', 'イプシロン', 'ゼータ'];
        return names[Math.floor(Math.random() * names.length)] + 'ボット';
    }

    calculateNextLevelExp() {
        return this.level * 100 + Math.pow(this.level, 2) * 10;
    }
}

// 敵の状態管理
class Enemy {
    constructor(level = 1, isBoss = false) {
        this.level = level;
        this.isBoss = isBoss;
        this.name = isBoss ? this.generateBossName() : this.generateName();
        this.maxHealth = isBoss ? level * 150 : level * 50;
        this.health = this.maxHealth;
        this.attack = isBoss ? level * 15 : level * 8;
        this.defense = level * 2;
        this.exp = isBoss ? level * 50 : level * 20;
        this.gold = isBoss ? level * 25 : level * 10;
        this.statusEffects = [];
        
        if (isBoss && Math.random() < 0.7) {
            this.specialSkill = this.generateSpecialSkill();
        }
    }

    generateName() {
        const names = ['ゴブリン', 'オーク', 'スケルトン', 'スライム', 'ウルフ', 'バット', 'スパイダー'];
        return names[Math.floor(Math.random() * names.length)];
    }

    generateBossName() {
        const bossNames = ['キングゴブリン', 'ドラゴン', 'リッチ', 'バンシー', 'タイタン', 'フェニックス'];
        return bossNames[Math.floor(Math.random() * bossNames.length)];
    }

    generateSpecialSkill() {
        const skills = [
            { name: '火の息', effect: (player) => { player.health -= 25; } },
            { name: '氷の矢', effect: (player) => applyStatusEffect(player, 'stun') },
            { name: '猛毒', effect: (player) => applyStatusEffect(player, 'poison') },
            { name: '怒り', effect: (enemy) => { enemy.attack += 10; } }
        ];
        return skills[Math.floor(Math.random() * skills.length)];
    }
}

// 音声再生関数
function playSound(soundName) {
    if (!gameConfig.soundEnabled || !sounds[soundName]) return;
    
    try {
        const sound = sounds[soundName];
        if (Array.isArray(sound.freq)) {
            sound.freq.forEach((freq, i) => {
                setTimeout(() => {
                    if (Music && Music.js) {
                        Music.js.play(freq, sound.duration);
                    }
                }, i * (sound.duration * 1000));
            });
        } else {
            if (Music && Music.js) {
                Music.js.play(sound.freq, sound.duration);
            }
        }
    } catch (error) {
        console.warn('Sound playback failed:', error);
    }
}

// ゲーム変数
let player;
let currentEnemy;
let activeBuffs = [];
let battleState = 'player';
let currentStage = 1;

// ダメージ計算
function calculateDamage(attacker, defender) {
    const baseDamage = attacker.attack * (attacker.attackMultiplier || 1);
    const defense = defender.defense || 0;
    const damage = Math.max(1, Math.floor(baseDamage - defense * 0.5));
    return damage;
}

// プレイヤーの攻撃処理
function playerAttack() {
    if (!currentEnemy || currentEnemy.health <= 0) {
        showBattleLog('攻撃対象がいません！');
        battleState = 'player';
        updateCommandButtons();
        return;
    }
    
    const damage = calculateDamage(player, currentEnemy);
    const isCritical = Math.random() < 0.1;
    const finalDamage = isCritical ? Math.floor(damage * 1.5) : damage;
    
    currentEnemy.health = Math.max(0, currentEnemy.health - finalDamage);
    
    showAttackEffect();
    
    if (isCritical) {
        showBattleLog(`クリティカル！ ${finalDamage}ダメージ！`);
        playSound('critical');
    } else {
        showBattleLog(`${finalDamage}ダメージを与えた！`);
        playSound('attack');
    }
    
    updateUI();
    
    if (currentEnemy.health <= 0) {
        handleEnemyDefeat();
        return;
    }
    
    setTimeout(() => {
        enemyTurn();
    }, 1000);
}

// 敵の攻撃処理
function enemyAttack() {
    if (!player || player.health <= 0) {
        return;
    }
    
    const damage = calculateDamage(currentEnemy, player);
    const finalDamage = Math.max(1, damage - (player.defense || 0));
    
    player.health = Math.max(0, player.health - finalDamage);
    
    showBattleLog(`${currentEnemy.name}から${finalDamage}ダメージを受けた！`);
    playSound('hit');
    
    updateUI();
    
    if (player.health <= 0) {
        gameOver();
        return;
    }
    
    setTimeout(() => {
        battleState = 'player';
        updateCommandButtons();
    }, 1000);
}

// 敵のターン処理
function enemyTurn() {
    battleState = 'enemy';
    updateCommandButtons(true);
    
    if (currentEnemy.specialSkill && Math.random() < 0.3) {
        currentEnemy.specialSkill.effect(player, currentEnemy);
        showBattleLog(`敵の特殊スキル発動: ${currentEnemy.specialSkill.name}`);
    } else {
        enemyAttack();
        return;
    }
    
    if (player.health <= 0) {
        gameOver();
        return;
    }
    
    battleState = 'player';
    updateCommandButtons();
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

// 敵撃破処理
function handleEnemyDefeat() {
    const expReward = currentEnemy.exp;
    const goldReward = currentEnemy.gold;
    
    player.exp += expReward;
    player.gold += goldReward;
    
    // 統計更新
    if (!player.stats) {
        player.stats = { kills: 0, pvpWins: 0, goldEarned: 0, itemsUsed: 0, bossKills: 0 };
    }
    player.stats.kills++;
    player.stats.goldEarned += goldReward;
    
    if (currentEnemy.isBoss) {
        player.stats.bossKills++;
        const bonusGold = goldReward * 2;
        const healthPotion = Math.floor(Math.random() * 3) + 1;
        
        player.gold += bonusGold;
        if (!player.inventory.healthPotion) player.inventory.healthPotion = 0;
        player.inventory.healthPotion += healthPotion;
        
        showBattleLog(`ボス撃破！特別報酬: ${bonusGold}ゴールド、回復ポーション${healthPotion}個`);
        playSound('pvpwin');
    } else {
        playSound('victory');
    }
    
    showBattleLog(`敵を倒した！ ${goldReward}ゴールドと${expReward}経験値を獲得！`);
    
    const healAmount = Math.floor(player.maxHealth * gameConfig.killHealPercent / 100);
    player.health = Math.min(player.maxHealth, player.health + healAmount);
    
    if (player.exp >= player.nextLevelExp) {
        levelUp();
    }
    
    currentStage++;
    spawnEnemy();
    
    battleState = 'player';
    updateCommandButtons();
    updateUI();
}

// レベルアップ処理
function levelUp() {
    player.level++;
    const healthIncrease = 20;
    const attackIncrease = 5;
    
    player.maxHealth += healthIncrease;
    player.health = player.maxHealth;
    player.attack += attackIncrease;
    player.exp = 0;
    player.nextLevelExp = player.calculateNextLevelExp();
    
    playSound('levelup');
    showBattleLog(`レベルアップ！ HP+${healthIncrease}, 攻撃力+${attackIncrease}`);
}

// ゲームオーバー処理
function gameOver() {
    battleState = 'gameover';
    updateCommandButtons(true);
    
    showBattleLog('ゲームオーバー！');
    playSound('gameover');
    
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
        gameContainer.classList.add('game-over');
    }
    
    setTimeout(() => {
        const commandArea = document.querySelector('.command-area');
        if (commandArea) {
            const retryButton = document.createElement('button');
            retryButton.className = 'retry-button';
            retryButton.textContent = 'リトライ';
            retryButton.onclick = resetGame;
            commandArea.appendChild(retryButton);
        }
    }, 2000);
}

// ゲームリセット処理
function resetGame() {
    currentStage = 1;
    battleState = 'player';
    
    player = new Player();
    player.initializeSkillsAndItems();
    
    spawnEnemy();
    
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
        gameContainer.classList.remove('game-over');
    }
    
    const retryButton = document.querySelector('.retry-button');
    if (retryButton) {
        retryButton.remove();
    }
    
    initializeAllUI();
    updateCommandButtons();
    
    showBattleLog('ゲームをリセットしました！');
}

// 敵生成
function spawnEnemy() {
    const isBoss = currentStage % gameConfig.bossEvery === 0;
    const enemyLevel = Math.max(1, Math.floor(player.level * 0.8));
    currentEnemy = new Enemy(enemyLevel, isBoss);
    updateUI();
}

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
            </div>
        `;
    }

    const enemyStatsElement = document.getElementById('enemy-stats');
    if (enemyStatsElement && currentEnemy) {
        const enemyHealthPercent = Math.max(0, (currentEnemy.health / currentEnemy.maxHealth) * 100);
        
        enemyStatsElement.innerHTML = `
            <h4>${currentEnemy.name} (レベル ${currentEnemy.level})</h4>
            <div class="enemy-stats-details">
                <span>HP: ${currentEnemy.health}/${currentEnemy.maxHealth}</span>
                <span>攻撃力: ${currentEnemy.attack}</span>
                ${currentEnemy.isBoss ? '<span style="color: #ff6b35;">【ボス】</span>' : ''}
            </div>
        `;
        
        const enemyHealthBar = document.getElementById('enemy-health-bar');
        if (enemyHealthBar) {
            enemyHealthBar.style.width = enemyHealthPercent + '%';
        }
    }

    const currentStageElement = document.getElementById('current-stage');
    if (currentStageElement) {
        currentStageElement.textContent = currentStage;
    }

    saveGame();
}

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

// コマンド処理
function handleCommand(command) {
    if (battleState === 'processing' || battleState === 'gameover') {
        return;
    }
    
    switch(command) {
        case 'attack':
            battleState = 'processing';
            updateCommandButtons(true);
            playerAttack();
            break;
            
        case 'skill':
            const skillsWithEnoughMana = player.skills || [];
            openSkillModal(skillsWithEnoughMana, skill => {
                battleState = 'processing';
                updateCommandButtons(true);
                skill.effect(player, currentEnemy);
                showBattleLog(`${skill.name}を使用した！`);
                updateUI();
                
                if (currentEnemy.health <= 0) {
                    handleEnemyDefeat();
                } else {
                    setTimeout(() => {
                        enemyTurn();
                    }, 1000);
                }
            });
            break;
            
        case 'item':
            const usableItems = Object.entries(player.inventory || {})
                .filter(([itemId, quantity]) => quantity > 0 && items[itemId])
                .map(([itemId]) => ({ ...items[itemId], id: itemId }));
                
            openItemModal(usableItems, item => {
                if (battleState === 'player') {
                    useItem(item.id);
                    setTimeout(() => {
                        updateCommandButtons();
                    }, 500);
                }
            });
            break;
            
        case 'defend':
            battleState = 'processing';
            updateCommandButtons(true);
            showBattleLog('防御態勢に入った！');
            
            setTimeout(() => {
                const originalDefense = player.defense;
                player.defense *= 2;
                
                enemyTurn();
                
                setTimeout(() => {
                    player.defense = originalDefense;
                    updateCommandButtons();
                }, 1000);
            }, 1000);
            break;
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
    const buttons = ['attack-btn', 'skill-btn', 'item-btn', 'defend-btn'];
    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = disabled;
        }
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
    player = new Player();
    player.initializeSkillsAndItems();
    currentStage = player.currentStage || 1;
    battleState = 'player';
    spawnEnemy();
    initializeAllUI();
    updateCommandButtons();
    
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
