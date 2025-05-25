// 定数・設定値を管理
// ゲーム設定とグローバル定数
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

// ショップアイテム定義
const shopItems = [
    { id: 'healthPotion', name: '回復ポーション', cost: 10, description: 'HPを50回復' },
    { id: 'strengthPotion', name: '攻撃力アップポーション', cost: 100, description: '30秒間攻撃力2倍' },
    { id: 'maxHealthUp', name: 'HP上限アップ', cost: 200, description: '最大HP+25' },
    { id: 'attackUp', name: '攻撃力アップ', cost: 500, description: '攻撃力+5' },
    { id: 'defenseUp', name: '防御力アップ', cost: 300, description: '防御力+3' }
];
