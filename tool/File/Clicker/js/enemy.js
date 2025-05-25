// 敵キャラクターの生成・管理を担当
// 敵クラスと関連機能

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
        const enemies = [
            'ゴブリン', 'オーク', 'スケルトン', 'スライム', 'コボルト',
            'ウルフ', 'ベア', 'スパイダー', 'バット', 'レイス'
        ];
        const prefixes = ['', '凶暴な', '古い', '呪われた', '怒れる'];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const enemy = enemies[Math.floor(Math.random() * enemies.length)];
        return prefix + enemy;
    }

    generateBossName() {
        const bosses = [
            'ドラゴンロード', 'デーモンキング', 'リッチマスター', 'ゴーレムキング',
            'フェニックス', 'クラーケン', 'バハムート', 'レヴィアタン'
        ];
        const titles = ['暗黒の', '炎の', '氷の', '雷の', '死の', '混沌の'];
        const title = titles[Math.floor(Math.random() * titles.length)];
        const boss = bosses[Math.floor(Math.random() * bosses.length)];
        return title + boss;
    }

    generateSpecialSkill() {
        const skills = [
            {
                name: 'ファイアブレス',
                description: '炎のブレスで大ダメージ',
                effect: (caster, target) => {
                    playSound('fireball');
                    const damage = Math.floor(caster.attack * 1.8);
                    target.takeDamage(damage);
                    showBattleLog(`${caster.name}のファイアブレス！${damage}ダメージ！`);
                }
            },
            {
                name: 'ポイズンクロー',
                description: '毒の爪攻撃',
                effect: (caster, target) => {
                    playSound('attack');
                    const damage = Math.floor(caster.attack * 1.2);
                    target.takeDamage(damage);
                    target.addStatusEffect('poison');
                    showBattleLog(`${caster.name}のポイズンクロー！${damage}ダメージ！毒状態になった！`);
                }
            },
            {
                name: 'スタンストライク',
                description: 'スタン効果のある強打',
                effect: (caster, target) => {
                    playSound('powerStrike');
                    const damage = Math.floor(caster.attack * 1.5);
                    target.takeDamage(damage);
                    target.addStatusEffect('stun');
                    showBattleLog(`${caster.name}のスタンストライク！${damage}ダメージ！スタン状態になった！`);
                }
            },
            {
                name: 'ヒール',
                description: '自己回復',
                effect: (caster) => {
                    playSound('heal');
                    const healAmount = Math.floor(caster.maxHealth * 0.3);
                    caster.heal(healAmount);
                    showBattleLog(`${caster.name}が${healAmount}HP回復した！`);
                }
            }
        ];
        
        return skills[Math.floor(Math.random() * skills.length)];
    }

    takeDamage(damage) {
        const actualDamage = Math.max(1, damage - this.defense);
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

    getAIAction() {
        // ボスは特殊スキルを30%の確率で使用
        if (this.isBoss && this.specialSkill && Math.random() < 0.3) {
            return {
                type: 'skill',
                skill: this.specialSkill
            };
        }
        
        // 体力が30%以下で回復スキルを持っている場合、50%の確率で回復
        if (this.health < this.maxHealth * 0.3 && 
            this.specialSkill && 
            this.specialSkill.name === 'ヒール' && 
            Math.random() < 0.5) {
            return {
                type: 'skill',
                skill: this.specialSkill
            };
        }
        
        // 通常攻撃
        return {
            type: 'attack'
        };
    }

    performAction(target) {
        const action = this.getAIAction();
        
        switch (action.type) {
            case 'attack':
                const damage = Math.floor(this.attack * (0.8 + Math.random() * 0.4));
                const actualDamage = target.takeDamage(damage);
                showBattleLog(`${this.name}の攻撃！${actualDamage}ダメージ！`);
                playSound('attack');
                break;
                
            case 'skill':
                if (action.skill) {
                    action.skill.effect(this, target);
                }
                break;
        }
    }

    // ステータス異常の処理
    applyStatusEffects() {
        this.statusEffects = this.statusEffects.filter(effect => {
            effect.effect(this);
            effect.duration--;
            
            if (effect.duration <= 0) {
                showBattleLog(`${this.name}の${effect.name}の効果が切れた`);
                return false;
            }
            return true;
        });
    }

    addStatusEffect(effectName) {
        const effect = { ...statusEffects[effectName] };
        if (effect) {
            this.statusEffects.push(effect);
            showBattleLog(`${this.name}が${effect.name}状態になった！`);
            playSound('debuff');
        }
    }

    isDead() {
        return this.health <= 0;
    }

    getHealthPercentage() {
        return (this.health / this.maxHealth) * 100;
    }
}

// 敵生成関数
function createEnemy(stage) {
    const level = Math.floor(stage / 5) + 1;
    const isBoss = stage % gameConfig.bossEvery === 0;
    return new Enemy(level, isBoss);
}

// ランダムエンカウント敵生成
function createRandomEnemy(playerLevel) {
    const level = Math.max(1, playerLevel + Math.floor(Math.random() * 3) - 1);
    const isBoss = Math.random() < 0.1; // 10%の確率でボス
    return new Enemy(level, isBoss);
}
