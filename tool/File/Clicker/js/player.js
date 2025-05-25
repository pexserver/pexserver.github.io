// プレイヤーの状態・スキル・レベルアップ処理を担当
// プレイヤークラスと関連機能

class Player {
    constructor(isBot = false) {
        if (isBot) {
            this.level = Math.max(1, player ? player.level - 1 : 1);
            this.maxHealth = gameConfig.initialHealth + (this.level * 10);
            this.health = this.maxHealth;
            this.attack = gameConfig.initialAttack + (this.level * 2);
            this.name = this.generateBotName();
            this.mana = 50;
            this.maxMana = 50;
            this.defense = this.level * 2;
            this.speed = 10;
            this.statusEffects = [];
            return;
        }

        const savedData = loadGame();
        let saved = savedData || {};
        
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
        this.defenseMultiplier = 1;
        this.name = saved.name ?? "プレイヤー";
        this.statusEffects = [];
        this.mana = saved.mana ?? 50;
        this.maxMana = saved.maxMana ?? 50;
        this.stats = saved.stats ?? {
            kills: 0,
            pvpWins: 0,
            goldEarned: 0,
            itemsUsed: 0,
            bossKills: 0
        };
        
        this.initializeSkillsAndItems();
    }

    initializeSkillsAndItems() {
        this.skills = [
            {
                name: '強打',
                manaCost: 10,
                description: '1.5倍のダメージを与える',
                effect: (player, enemy) => {
                    playSound('powerStrike');
                    const damage = Math.floor(player.getEffectiveAttack() * 1.5);
                    enemy.takeDamage(damage);
                    showBattleLog(`強打で${damage}ダメージを与えた！`);
                }
            },
            {
                name: '回復',
                manaCost: 15,
                description: 'HPを30回復する',
                effect: (player) => {
                    playSound('heal');
                    const healAmount = 30;
                    player.heal(healAmount);
                    showBattleLog(`${healAmount}HP回復した！`);
                }
            },
            {
                name: 'マジックミサイル',
                manaCost: 20,
                description: '魔法攻撃で確実にダメージを与える',
                effect: (player, enemy) => {
                    playSound('magicMissile');
                    const damage = Math.floor(player.getEffectiveAttack() * 1.2);
                    enemy.takeDamage(damage);
                    const healAmount = Math.floor(damage * 0.2);
                    player.heal(healAmount);
                    showBattleLog(`マジックミサイルで${damage}ダメージ！${healAmount}HP回復した！`);
                }
            },
            {
                name: 'ファイアボール',
                manaCost: 25,
                description: '2倍の炎ダメージを与える',
                effect: (player, enemy) => {
                    playSound('fireball');
                    const damage = Math.floor(player.getEffectiveAttack() * 2.0);
                    enemy.takeDamage(damage);
                    showBattleLog(`ファイアボールで${damage}の炎ダメージ！`);
                }
            },
            {
                name: 'ライトニング',
                manaCost: 30,
                description: '雷撃で大ダメージ(2.5倍)',
                effect: (player, enemy) => {
                    playSound('lightning');
                    const damage = Math.floor(player.getEffectiveAttack() * 2.5);
                    enemy.takeDamage(damage);
                    showBattleLog(`雷撃で${damage}の電撃ダメージ！`);
                }
            },
            {
                name: 'シールド',
                manaCost: 15,
                description: '防御力を一時的に2倍にする',
                effect: (player) => {
                    playSound('shield');
                    player.defenseMultiplier = 2;
                    showBattleLog('シールドで防御力が上がった！');
                    setTimeout(() => {
                        player.defenseMultiplier = 1;
                        showBattleLog('シールドの効果が切れた。');
                        updateUI();
                    }, 10000);
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

    getEffectiveAttack() {
        return Math.floor(this.attack * this.attackMultiplier);
    }

    getEffectiveDefense() {
        return Math.floor(this.defense * this.defenseMultiplier);
    }

    takeDamage(damage) {
        const actualDamage = Math.max(1, damage - this.getEffectiveDefense());
        this.health = Math.max(0, this.health - actualDamage);
        
        if (actualDamage > damage * 0.8) {
            playSound('critical');
        } else {
            playSound('hit');
        }
        
        return actualDamage;
    }

    heal(amount) {
        const oldHealth = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);
        return this.health - oldHealth;
    }

    gainExp(amount) {
        this.exp += amount;
        this.stats.goldEarned += amount; // XPも統計に含める
        
        while (this.exp >= this.nextLevelExp) {
            this.levelUp();
        }
    }

    gainGold(amount) {
        this.gold += amount;
        this.stats.goldEarned += amount;
    }

    levelUp() {
        this.exp -= this.nextLevelExp;
        this.level++;
        
        const oldMaxHealth = this.maxHealth;
        const oldAttack = this.attack;
        const oldDefense = this.defense;
        const oldMaxMana = this.maxMana;
        
        this.maxHealth += 20;
        this.attack += 3;
        this.defense += 2;
        this.maxMana += 5;
        
        this.health = this.maxHealth;
        this.mana = this.maxMana;
        this.nextLevelExp = this.calculateNextLevelExp();
        
        playSound('levelup');
        showBattleLog(`レベルアップ！Lv.${this.level}`);
        showBattleLog(`HP: ${oldMaxHealth} → ${this.maxHealth}`);
        showBattleLog(`攻撃力: ${oldAttack} → ${this.attack}`);
        showBattleLog(`防御力: ${oldDefense} → ${this.defense}`);
        showBattleLog(`MP: ${oldMaxMana} → ${this.maxMana}`);
    }

    canUseSkill(skill) {
        return this.mana >= skill.manaCost;
    }

    useSkill(skill, enemy = null) {
        if (!this.canUseSkill(skill)) {
            showBattleLog('MPが不足しています！');
            playSound('error');
            return false;
        }
        
        this.mana -= skill.manaCost;
        skill.effect(this, enemy);
        return true;
    }

    restoreMana(amount) {
        this.mana = Math.min(this.maxMana, this.mana + amount);
    }

    addToInventory(itemId, quantity = 1) {
        if (!this.inventory[itemId]) {
            this.inventory[itemId] = 0;
        }
        this.inventory[itemId] += quantity;
    }

    removeFromInventory(itemId, quantity = 1) {
        if (!this.inventory[itemId] || this.inventory[itemId] < quantity) {
            return false;
        }
        
        this.inventory[itemId] -= quantity;
        if (this.inventory[itemId] <= 0) {
            delete this.inventory[itemId];
        }
        
        return true;
    }

    getInventoryItems() {
        return Object.keys(this.inventory)
            .filter(itemId => this.inventory[itemId] > 0)
            .map(itemId => ({
                ...items[itemId],
                id: itemId,
                quantity: this.inventory[itemId]
            }));
    }

    useItem(itemId) {
        if (!this.removeFromInventory(itemId, 1)) {
            showBattleLog('アイテムがありません！');
            playSound('error');
            return false;
        }
        
        const item = items[itemId];
        if (item && item.effect) {
            item.effect(this);
            this.stats.itemsUsed++;
            showBattleLog(`${item.name}を使用した！`);
            return true;
        }
        
        return false;
    }

    // ステータス異常の処理
    applyStatusEffects() {
        this.statusEffects = this.statusEffects.filter(effect => {
            effect.effect(this);
            effect.duration--;
            
            if (effect.duration <= 0) {
                showBattleLog(`${effect.name}の効果が切れた`);
                return false;
            }
            return true;
        });
    }

    addStatusEffect(effectName) {
        const effect = { ...statusEffects[effectName] };
        if (effect) {
            this.statusEffects.push(effect);
            showBattleLog(`${effect.name}状態になった！`);
            playSound('debuff');
        }
    }
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
