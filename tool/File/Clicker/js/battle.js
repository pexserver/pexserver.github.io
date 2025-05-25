// 戦闘ロジック（攻撃、ダメージ計算、敵撃破処理など）を担当

// バトルシステム管理

// ゲーム状態管理
let gameState = {
    inBattle: false,
    playerTurn: true,
    battlePhase: 'select', // 'select', 'action', 'enemy', 'result'
    turnCount: 0
};

// コマンド処理
function handleCommand(commandType) {
    if (!gameState.inBattle || !gameState.playerTurn) {
        return;
    }
    
    playSound('click');
    
    switch (commandType) {
        case 'attack':
            playerAttack();
            break;
        case 'skill':
            openSkillSelection();
            break;
        case 'item':
            openItemSelection();
            break;
        case 'defend':
            playerDefend();
            break;
    }
}
window.handleCommand = handleCommand;

// プレイヤーの攻撃
function playerAttack() {
    if (!currentEnemy || currentEnemy.isDead()) {
        return;
    }

    const damage = Math.floor(player.getEffectiveAttack() * (0.8 + Math.random() * 0.4));
    const actualDamage = currentEnemy.takeDamage(damage);

    const isCritical = actualDamage > damage * 0.9;
    showBattleLog(`${player.name}の攻撃！${actualDamage}ダメージ！${isCritical ? ' クリティカル！' : ''}`);

    if (isCritical) {
        playSound('critical');
    } else {
        playSound('attack');
    }

    // バトル終了時のみreturn、それ以外は敵ターンへ
    if (checkBattleEnd()) return;
    endPlayerTurn();
}

// プレイヤーの防御
function playerDefend() {
    player.defenseMultiplier = 1.5;
    showBattleLog(`${player.name}は防御した！次のターンまで防御力が上がる！`);
    playSound('shield');
    
    // 少しMPを回復
    player.restoreMana(5);
    
    endPlayerTurn();
}

// スキル選択モーダル
function openSkillSelection() {
    const availableSkills = player.skills.filter(skill => player.canUseSkill(skill));
    
    if (availableSkills.length === 0) {
        showBattleLog('使用可能なスキルがありません！');
        playSound('error');
        return;
    }
    
    openSkillModal(availableSkills, (skill) => {
        if (player.useSkill(skill, currentEnemy)) {
            checkBattleEnd();
            if (gameState.inBattle) {
                endPlayerTurn();
            }
        }
    });
}

// アイテム選択モーダル
function openItemSelection() {
    const availableItems = player.getInventoryItems();
    
    if (availableItems.length === 0) {
        showBattleLog('使用可能なアイテムがありません！');
        playSound('error');
        return;
    }
    
    openItemModal(availableItems, (item) => {
        if (player.useItem(item.id)) {
            updateUI();
            endPlayerTurn();
        }
    });
}

// プレイヤーターン終了
function endPlayerTurn() {
    gameState.playerTurn = false;
    gameState.turnCount++;
    
    // 防御効果をリセット
    if (player.defenseMultiplier > 1) {
        player.defenseMultiplier = 1;
    }
    
    updateUI();
    
    // 少し待ってから敵のターン
    setTimeout(() => {
        if (gameState.inBattle && !gameState.playerTurn) {
            enemyTurn();
        }
    }, 1000);
}

// 敵のターン
function enemyTurn() {
    if (!currentEnemy || currentEnemy.isDead()) {
        return;
    }
    
    // 敵のステータス異常処理
    currentEnemy.applyStatusEffects();
    
    // スタン状態なら行動スキップ
    if (currentEnemy.statusEffects.some(effect => effect.name === 'スタン')) {
        showBattleLog(`${currentEnemy.name}はスタンして動けない！`);
        setTimeout(() => {
            startPlayerTurn();
            updateCommandButtons(false);
        }, 1000);
        return;
    }
    
    // 敵の行動
    currentEnemy.performAction(player);
    
    // プレイヤーの死亡チェック
    if (player.health <= 0) {
        playerDefeated();
        return;
    }
    
    updateUI();
    setTimeout(() => {
        startPlayerTurn();
        updateCommandButtons(false);
    }, 1500);
}

// プレイヤーターン開始
function startPlayerTurn() {
    if (!gameState.inBattle) return;
    gameState.playerTurn = true;
    updateUI();
    updateCommandButtons(false); // ボタン有効化
}

// バトル開始
function startBattle(enemy) {
    currentEnemy = enemy;
    gameState.inBattle = true;
    gameState.playerTurn = true;
    gameState.turnCount = 0;
    
    showBattleLog(`${enemy.name}が現れた！`);
    playSound('battle');
    
    updateUI();
}

// バトル終了チェック
function checkBattleEnd() {
    if (currentEnemy && currentEnemy.isDead()) {
        gameState.inBattle = false;
        enemyDefeated();
        updateUI();
        return true;
    }
    if (player.health <= 0) {
        gameState.inBattle = false;
        playerDefeated();
        updateUI();
        return true;
    }
    return false;
}

// 敵撃破時の処理
function enemyDefeated() {
    gameState.inBattle = false;
    
    const expGained = currentEnemy.exp;
    const goldGained = currentEnemy.gold;
    
    player.gainExp(expGained);
    player.gainGold(goldGained);
    player.stats.kills++;
    
    if (currentEnemy.isBoss) {
        player.stats.bossKills++;
        showBattleLog(`ボス ${currentEnemy.name} を撃破！`);
        playSound('victory');
    } else {
        showBattleLog(`${currentEnemy.name} を撃破！`);
        playSound('victory');
    }
    
    showBattleLog(`${expGained}EXP と ${goldGained}ゴールドを獲得！`);
    
    // 体力回復（キルヒール）
    const healAmount = Math.floor(player.maxHealth * (gameConfig.killHealPercent / 100));
    player.heal(healAmount);
    showBattleLog(`${healAmount}HP回復した！`);
    
    // ランダムアイテムドロップ
    if (Math.random() < 0.3) {
        const dropItems = ['healthPotion'];
        const droppedItem = dropItems[Math.floor(Math.random() * dropItems.length)];
        player.addToInventory(droppedItem, 1);
        showBattleLog(`${items[droppedItem].name}をドロップした！`);
        playSound('treasure');
    }
    
    // 次のステージへ
    player.currentStage++;
    
    updateUI();
    saveGame();
    
    // 次の敵を生成
    setTimeout(() => {
        const nextEnemy = createEnemy(player.currentStage);
        startBattle(nextEnemy);
    }, 2000);
}

// プレイヤー敗北時の処理
function playerDefeated() {
    gameState.inBattle = false;
    
    showBattleLog('敗北しました...');
    playSound('defeat');
    
    // ペナルティ（ゴールドの一部を失う）
    const goldLoss = Math.floor(player.gold * 0.1);
    player.gold = Math.max(0, player.gold - goldLoss);
    
    if (goldLoss > 0) {
        showBattleLog(`${goldLoss}ゴールドを失った...`);
    }
    
    // 体力を半分回復
    player.health = Math.floor(player.maxHealth * 0.5);
    
    // ステージを少し戻す
    player.currentStage = Math.max(1, player.currentStage - 2);
    
    updateUI();
    saveGame();
    
    // 復活後に新しい敵と戦闘開始
    setTimeout(() => {
        showBattleLog('復活しました！');
        const nextEnemy = createEnemy(player.currentStage);
        startBattle(nextEnemy);
    }, 3000);
}

// PvPバトル開始
function startPvPBattle() {
    const botEnemy = new Player(true);
    botEnemy.health = botEnemy.maxHealth;
    
    showBattleLog(`PvPバトル！${botEnemy.name}との戦い！`);
    playSound('battle');
    
    startBattle(botEnemy);
}

// PvPバトルの特別処理
function handlePvPVictory(botEnemy) {
    player.gainExp(gameConfig.pvpRewards.exp);
    player.gainGold(gameConfig.pvpRewards.gold);
    player.stats.pvpWins++;
    
    showBattleLog(`PvP勝利！${gameConfig.pvpRewards.exp}EXP と ${gameConfig.pvpRewards.gold}ゴールドを獲得！`);
    playSound('pvpwin');
}

// エリアイベント処理
function triggerAreaEvent() {
    const currentAreaIndex = Math.floor((player.currentStage - 1) / gameConfig.stagesPerArea) % areaList.length;
    const area = areaList[currentAreaIndex];
    
    if (Math.random() < 0.3) { // 30%の確率でイベント発生
        switch (area.event) {
            case '宝箱':
                const goldFound = Math.floor(Math.random() * 50) + 25;
                player.gainGold(goldFound);
                showBattleLog(`宝箱を発見！${goldFound}ゴールドを獲得！`);
                playSound('treasure');
                break;
                
            case 'ミニボス':
                const miniBoss = new Enemy(player.level + 2, false);
                miniBoss.name = '迷子の' + miniBoss.name;
                miniBoss.maxHealth *= 1.5;
                miniBoss.health = miniBoss.maxHealth;
                miniBoss.attack *= 1.3;
                showBattleLog('ミニボスが現れた！');
                startBattle(miniBoss);
                return; // 通常の敵生成をスキップ
                
            case 'ランダムバフ':
                player.attackMultiplier = 1.5;
                showBattleLog('魔法の力で攻撃力が上がった！（次の戦闘まで）');
                playSound('buff');
                break;
                
            case '回復泉':
                player.health = player.maxHealth;
                player.mana = player.maxMana;
                showBattleLog('回復泉でHPとMPが全回復した！');
                playSound('heal');
                break;
        }
        
        updateUI();
    }
}

// ダメージ計算
function calculateDamage(attacker, defender) {
    const baseDamage = attacker.attack * (attacker.attackMultiplier || 1);
    const defense = defender.defense || 0;
    const damage = Math.max(1, Math.floor(baseDamage - defense * 0.5));
    return damage;
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
    
    gameState.inBattle = false;
    gameState.playerTurn = true;
    updateCommandButtons();
    updateUI();
}

// 敵生成
function spawnEnemy() {
    const isBoss = currentStage % gameConfig.bossEvery === 0;
    const enemyLevel = Math.max(1, Math.floor(player.level * 0.8));
    currentEnemy = new Enemy(enemyLevel, isBoss);
    
    // 戦闘開始
    startBattle(currentEnemy);
}

// 戦闘終了後の次の敵生成ロジックを追加
function prepareNextEnemy() {
    if (gameState.inBattle) return;

    // 次の敵を生成
    currentEnemy = generateRandomEnemy();
    showBattleLog(`${currentEnemy.name} が現れた！`);

    // UIを更新
    updateUI();

    // 戦闘状態をリセット
    gameState.inBattle = true;
    gameState.playerTurn = true;
    gameState.battlePhase = 'select';
}

// ゲームオーバー処理
function gameOver() {
    gameState.inBattle = false;
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
    gameState.inBattle = false;
    gameState.playerTurn = true;
    
    player = new Player();
    
    spawnEnemy();
    
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
        gameContainer.classList.remove('game-over');
    }
    
    const retryButton = document.querySelector('.retry-button');
    if (retryButton) {
        retryButton.remove();
    }
    
    updateUI();
    updateCommandButtons();
    
    showBattleLog('ゲームをリセットしました！');
}
