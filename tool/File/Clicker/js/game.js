
const gameConfig = {
    initialGold: 0,
    initialLevel: 1,
    initialHealth: 100,
    initialAttack: 10,
    soundEnabled: true,
    stagesPerArea: 10,    // 各エリアのステージ数
    bossEvery: 10,        // ボス出現間隔
    killHealPercent: 20,  // キル時のHP回復割合（%）
    pvpBotInterval: 5,    // PvPボット出現間隔
    pvpRewards: {         // PvP報酬
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

// プレイヤーの状態管理
class Player {
    constructor(isBot = false) {
        if (isBot) {
            // ボットの場合は現在のプレイヤーのレベルに応じて能力値を設定
            this.level = Math.max(1, player ? player.level - 1 : 1);
            this.maxHealth = gameConfig.initialHealth + (this.level * 10);
            this.health = this.maxHealth;
            this.attack = gameConfig.initialAttack + (this.level * 2);
            this.name = this.generateBotName();
            return;
        }

        const saved = this.loadProgress();
        this.gold = saved.gold ?? gameConfig.initialGold;
        this.level = saved.level ?? gameConfig.initialLevel;
        this.maxHealth = saved.maxHealth ?? gameConfig.initialHealth;
        this.health = saved.health ?? this.maxHealth;
        this.attack = saved.attack ?? gameConfig.initialAttack;
        this.exp = saved.exp ?? 0;
        this.nextLevelExp = this.calculateNextLevelExp();
        this.currentStage = saved.currentStage ?? 1;
        this.inventory = saved.inventory ?? {};
        this.attackMultiplier = 1;
        this.name = saved.name ?? "プレイヤー";
        this.stats = saved.stats ?? {
            kills: 0,
            pvpWins: 0,
            pvpLosses: 0,
            bossKills: 0,
            totalDamageDealt: 0
        };
        this.passive = saved.passive ?? {
            killHealBonus: 0,    // キル時回復量ボーナス
            criticalChance: 5,   // クリティカル発生率(%)
            criticalDamage: 150  // クリティカルダメージ(%)
        };
        this.skills = saved.skills ?? {            doubleStrike: {
                name: "二段攻撃",
                cost: 20,
                cooldown: 10000,
                lastUsed: 0,
                effect: () => this.attack * 2
            },
            heal: {
                name: "自己回復",
                cost: 50,
                cooldown: 15000,
                lastUsed: 0,
                effect: () => this.health += 30
            },
            powerStrike: {
                name: "強攻撃",
                cost: 35,
                cooldown: 12000,
                lastUsed: 0,
                effect: () => {
                    const damage = this.attack * 1.5;
                    this.stats.totalDamageDealt += damage;
                    return damage;
                }
            },
            berserker: {
                name: "狂戦士",
                cost: 70,
                cooldown: 20000,
                lastUsed: 0,
                effect: () => {
                    this.attackMultiplier = 2;
                    this.passive.criticalChance += 20;
                    setTimeout(() => {
                        this.attackMultiplier = 1;
                        this.passive.criticalChance -= 20;
                        updateUI();
                    }, 10000);
                }
            }
        };
    }

    calculateNextLevelExp() {
        return Math.floor(100 * Math.pow(1.2, this.level - 1));
    }

    gainExp(amount) {
        this.exp += amount;
        if (this.exp >= this.nextLevelExp) {
            this.levelUp();
        }
        this.saveProgress();
    }

    levelUp() {
        this.level++;
        this.health += 10;
        this.attack += 2;
        this.exp -= this.nextLevelExp;
        this.nextLevelExp = this.calculateNextLevelExp();
        playSound('levelup');
        updateUI();
    }

    saveProgress() {
        const data = {
            gold: this.gold,
            level: this.level,
            health: this.health,
            attack: this.attack,
            exp: this.exp
        };
        setCookie('playerData', JSON.stringify(data), 365);
    }

    loadProgress() {
        const saved = getCookie('playerData');
        return saved ? JSON.parse(saved) : {};
    }
}

// 敵の基本クラス
class Enemy {
    constructor(level, isBoss = false) {
        this.level = level;
        this.isBoss = isBoss;
        const multiplier = isBoss ? 3 : 1;
        this.health = (50 + (level * 10)) * multiplier;
        this.maxHealth = this.health;
        this.attack = (5 + (level * 2)) * multiplier;
        this.gold = (10 + (level * 5)) * multiplier;
        this.exp = (20 + (level * 8)) * multiplier;
        this.name = isBoss ? this.generateBossName() : this.generateEnemyName();
    }

    generateEnemyName() {
        const prefixes = ['凶暴な', '狂暴な', '巨大な', '邪悪な'];
        const types = ['スライム', 'ゴブリン', 'オーク', 'スケルトン', 'ゾンビ'];
        return prefixes[Math.floor(Math.random() * prefixes.length)] + 
               types[Math.floor(Math.random() * types.length)];
    }

    generateBossName() {
        const titles = ['魔王', '死神', '破壊王', '混沌の支配者'];
        const names = ['ダークロード', 'ネクロス', 'デスブリンガー', 'カオスキング'];
        return titles[Math.floor(Math.random() * titles.length)] + ' ' +
               names[Math.floor(Math.random() * names.length)];
    }
}

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
    newarea: { freq: [392.00, 493.88, 587.33, 783.99], duration: 0.4 }
};

function playSound(soundName) {
    if (!gameConfig.soundEnabled || !sounds[soundName]) return;
    
    const sound = sounds[soundName];
    if (Array.isArray(sound.freq)) {
        sound.freq.forEach((freq, i) => {
            setTimeout(() => {
                Music.js.play(freq, sound.duration);
            }, i * (sound.duration * 1000));
        });
    } else {
        Music.js.play(sound.freq, sound.duration);
    }
}

// クッキー管理
function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(name) {
    const cname = name + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(cname) === 0) {
            return c.substring(cname.length, c.length);
        }
    }
    return "";
}

// ゲーム初期化処理
let player;
let currentEnemy;
let activeBuffs = [];

function initGame() {
    player = new Player();
    spawnEnemy();
    updateUI();
    updateInventoryUI();
}

function spawnEnemy() {
    const isBoss = player.currentStage % gameConfig.bossEvery === 0;
    const enemyLevel = Math.max(1, Math.floor(player.level * 0.8));
    currentEnemy = new Enemy(enemyLevel, isBoss);
    updateUI();
}

function useItem(itemId) {
    const item = items[itemId];
    if (player.inventory[itemId] && player.inventory[itemId] > 0) {
        item.effect(player);
        player.inventory[itemId]--;
        player.saveProgress();
        updateUI();
        updateInventoryUI();
    }
}

function buyItem(itemId) {
    const item = items[itemId];
    if (player.gold >= item.cost) {
        player.gold -= item.cost;
        player.inventory[itemId] = (player.inventory[itemId] || 0) + 1;
        player.saveProgress();
        playSound('buy');
        updateUI();
        updateInventoryUI();
    }
}

function useSkill(skillId) {
    const skill = player.skills[skillId];
    const now = Date.now();
    if (now - skill.lastUsed >= skill.cooldown && player.gold >= skill.cost) {
        player.gold -= skill.cost;
        skill.lastUsed = now;
        const result = skill.effect();
        if (typeof result === 'number') {
            damageEnemy(result);
        }
        playSound('skill');
        updateUI();
        updateSkillCooldowns();
    }
}

function updateSkillCooldowns() {
    // スキルツリーが表示されているときのみ更新
    if (document.getElementById('game-modal').style.display === 'block' &&
        document.getElementById('skills-tab').classList.contains('active')) {
        updateSkillTreeContent();
    }
}

function healOnKill(amount = 0) {
    // キル時の回復処理
    const healPercent = gameConfig.killHealPercent + player.passive.killHealBonus;
    const healAmount = Math.floor((player.maxHealth * healPercent / 100) + amount);
    player.health = Math.min(player.maxHealth, player.health + healAmount);
    playSound('heal');
}

function generateCriticalDamage(baseDamage) {
    if (Math.random() * 100 < player.passive.criticalChance) {
        playSound('crit');
        return Math.floor(baseDamage * player.passive.criticalDamage / 100);
    }
    return baseDamage;
}

function generateBotName() {
    const prefixes = ['挑戦者', '戦士', '冒険者', 'ハンター'];
    const names = ['アレックス', 'クラウド', 'ソラ', 'レイン', 'ノア'];
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${names[Math.floor(Math.random() * names.length)]}`;
}

function startPvPBattle() {
    const botPlayer = new Player(true);
    currentEnemy = {
        name: botPlayer.name,
        health: botPlayer.health,
        maxHealth: botPlayer.maxHealth,
        attack: botPlayer.attack,
        level: botPlayer.level,
        isPvP: true
    };
    playSound('pvp');
    updateUI();
}

function advanceStage() {
    player.currentStage++;
    
    // PvPボット出現チェック
    if (player.currentStage % gameConfig.pvpBotInterval === 0) {
        startPvPBattle();
        return;
    }

    if (player.currentStage % gameConfig.bossEvery === 1) {
        // 新しいエリアに入った
        playSound('newarea');
    }
    spawnEnemy();
    updateUI();
}

// ダメージ処理
function damageEnemy(damage) {
    if (!currentEnemy) return;
    
    currentEnemy.health -= damage;    if (currentEnemy.health <= 0) {
        // 敵を倒した時の処理
        if (currentEnemy.isPvP) {
            // PvP勝利報酬
            player.gold += gameConfig.pvpRewards.gold;
            player.gainExp(gameConfig.pvpRewards.exp);
            player.stats.pvpWins++;
            playSound('pvpwin');
            healOnKill(50); // PvP勝利時は追加回復
        } else {
            player.gold += currentEnemy.gold;
            player.gainExp(currentEnemy.exp);
            player.stats.kills++;
            playSound('victory');
            healOnKill(); // 通常のキル時回復
            
            if (currentEnemy.isBoss) {
                // ボスを倒した場合、特別なボーナス
                player.stats.bossKills++;
                player.gold += currentEnemy.gold * 2;
                player.gainExp(currentEnemy.exp);
                const healthPotion = Math.floor(Math.random() * 2) + 1;
                const strengthPotion = Math.random() > 0.5 ? 1 : 0;
                
                player.inventory.healthPotion = (player.inventory.healthPotion || 0) + healthPotion;
                if (strengthPotion) {
                    player.inventory.strengthPotion = (player.inventory.strengthPotion || 0) + strengthPotion;
                }
            }
        }
        
        advanceStage();
    }
    updateUI();
}

// クリック処理
function handleClick() {
    if (!currentEnemy) return;
    
    playSound('click');
    damageEnemy(player.attack * player.attackMultiplier);
    
    // プレイヤーへの反撃
    player.health -= currentEnemy.attack;
    playSound('battle');
    if (player.health <= 0) {
        gameOver();
    }
    
    updateUI();
}

function gameOver() {
    alert('ゲームオーバー！');
    closeModal(); // モーダルが開いている場合は閉じる
    player = new Player();
    spawnEnemy();
    updateUI();
}

// UI更新
function updateUI() {
    document.getElementById('player-stats').innerHTML = `
        レベル: ${player.level}<br>
        HP: ${player.health}/${player.maxHealth}<br>
        攻撃力: ${player.attack * player.attackMultiplier}<br>
        ゴールド: ${player.gold}<br>
        経験値: ${player.exp}/${player.nextLevelExp}
    `;
    
    if (currentEnemy) {
        const healthPercent = (currentEnemy.health / currentEnemy.maxHealth) * 100;
        document.getElementById('enemy-stats').innerHTML = `
            ${currentEnemy.isBoss ? '👑 ボス: ' : ''}${currentEnemy.name} Lv.${currentEnemy.level}<br>
            HP: ${currentEnemy.health}/${currentEnemy.maxHealth}
        `;
        document.getElementById('enemy-health-bar').style.width = `${healthPercent}%`;
        document.getElementById('enemy-health-bar').style.backgroundColor = 
            currentEnemy.isBoss ? '#ff0000' : '#ff4444';
    }

    document.getElementById('current-stage').textContent = player.currentStage;
    updateSkillCooldowns();
}

function updateInventoryUI() {
    // モーダルが開かれているときのみ更新
    if (document.getElementById('game-modal').style.display === 'block') {
        updateModalContent();
    }
}

// モーダル関連の機能
function openModal() {
    document.getElementById('game-modal').style.display = 'block';
    updateModalContent();
}

function closeModal() {
    document.getElementById('game-modal').style.display = 'none';
}

function showTab(tabName) {
    // タブボタンのアクティブ状態を更新
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.textContent.toLowerCase().includes(tabName)) {
            button.classList.add('active');
        }
    });

    // タブコンテンツの表示を切り替え
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    updateModalContent(tabName);
}

function updateModalContent(tabName) {
    if (!tabName) {
        updateShopContent();
        updateInventoryContent();
        updateSkillTreeContent();
        return;
    }

    switch (tabName) {
        case 'shop':
            updateShopContent();
            break;
        case 'inventory':
            updateInventoryContent();
            break;
        case 'skills':
            updateSkillTreeContent();
            break;
    }
}

function updateShopContent() {
    const shopItems = document.getElementById('shop-items');
    shopItems.innerHTML = '';

    // 通常アイテムのショップ表示
    Object.entries(items).forEach(([itemId, item]) => {
        shopItems.innerHTML += `
            <div class="shop-item-card">
                <h3>${item.name}</h3>
                <p class="item-description">${item.description}</p>
                <p class="shop-item-price">${item.cost} ゴールド</p>
                <button onclick="buyItem('${itemId}')" 
                        ${player.gold < item.cost ? 'disabled' : ''}>
                    購入
                </button>
            </div>
        `;
    });
}

function updateInventoryContent() {
    const inventoryItems = document.getElementById('inventory-items');
    inventoryItems.innerHTML = '';

    Object.entries(player.inventory).forEach(([itemId, count]) => {
        if (count > 0 && items[itemId]) {
            inventoryItems.innerHTML += `
                <div class="inventory-item">
                    <h3>${items[itemId].name}</h3>
                    <p class="item-count">${count}個</p>
                    <button onclick="useItem('${itemId}')">使用</button>
                </div>
            `;
        }
    });
}

function updateSkillTreeContent() {
    const skillTree = document.getElementById('skill-tree');
    skillTree.innerHTML = '';

    Object.entries(player.skills).forEach(([skillId, skill]) => {
        const cooldownRemaining = Math.max(0, skill.cooldown - (Date.now() - skill.lastUsed));
        skillTree.innerHTML += `
            <div class="skill-card">
                <h3>${skill.name}</h3>
                <p class="skill-cost">コスト: ${skill.cost} ゴールド</p>
                <p>クールダウン: ${skill.cooldown / 1000}秒</p>
                <button onclick="useSkill('${skillId}')"
                        ${cooldownRemaining > 0 ? 'disabled' : ''}>
                    ${cooldownRemaining > 0 ? 
                        `使用可能まで ${Math.ceil(cooldownRemaining / 1000)}秒` : 
                        '使用'}
                </button>
            </div>
        `;
    });
}

// 設定の切り替え
function toggleSound() {
    gameConfig.soundEnabled = !gameConfig.soundEnabled;
    document.getElementById('sound-toggle').textContent = 
        gameConfig.soundEnabled ? '🔊 サウンドON' : '🔈 サウンドOFF';
    setCookie('soundEnabled', gameConfig.soundEnabled, 365);
}

// ウィンドウクリックイベントの設定
window.onclick = function(event) {
    const modal = document.getElementById('game-modal');
    if (event.target === modal) {
        closeModal();
    }
};

// ページ読み込み時の初期化
window.onload = () => {
    const soundSetting = getCookie('soundEnabled');
    if (soundSetting !== "") {
        gameConfig.soundEnabled = soundSetting === 'true';
    }
    document.getElementById('sound-toggle').textContent = 
        gameConfig.soundEnabled ? '🔊 サウンドON' : '🔈 サウンドOFF';
    initGame();
};
