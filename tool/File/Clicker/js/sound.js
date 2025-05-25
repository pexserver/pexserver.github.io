// サウンド管理・再生を担当

// サウンド定義と管理
const sounds = {
    // 基本的なアクション
    click: { type: 'simple', freq: 440, duration: 0.1, waveType: 'square' },
    attack: { type: 'simple', freq: 330, duration: 0.1, waveType: 'sawtooth' },
    hit: { type: 'simple', freq: 220, duration: 0.1, waveType: 'triangle' },
    critical: { type: 'chord', freq: [440, 550, 660], duration: 0.15, waveType: 'sine' },
    
    // スキル系サウンド
    skill: { type: 'sweep', startFreq: 493.88, endFreq: 987.77, duration: 0.3, waveType: 'sine' },
    heal: { type: 'sequence', notes: [
        { frequency: 523.25, duration: 0.1, waveType: 'sine' },
        { frequency: 659.25, duration: 0.1, waveType: 'sine' },
        { frequency: 783.99, duration: 0.2, waveType: 'sine' }
    ]},
    magicMissile: { type: 'sequence', notes: [
        { frequency: 659.25, duration: 0.05, waveType: 'square' },
        { frequency: 783.99, duration: 0.05, waveType: 'square' },
        { frequency: 987.77, duration: 0.1, waveType: 'square' }
    ]},
    fireball: { type: 'sweep', startFreq: 220, endFreq: 880, duration: 0.4, waveType: 'sawtooth' },
    lightning: { type: 'sequence', notes: [
        { frequency: 1318.51, duration: 0.03, waveType: 'square' },
        { frequency: 1174.66, duration: 0.03, waveType: 'square' },
        { frequency: 987.77, duration: 0.04, waveType: 'square' }
    ]},
    shield: { type: 'chord', freq: [329.63, 392.00, 493.88], duration: 0.25, waveType: 'sine' },
    powerStrike: { type: 'sequence', notes: [
        { frequency: 261.63, duration: 0.1, waveType: 'sawtooth' },
        { frequency: 329.63, duration: 0.1, waveType: 'sawtooth' },
        { frequency: 392.00, duration: 0.15, waveType: 'sawtooth' }
    ]},
    
    // 状態変化
    buff: { type: 'sequence', notes: [
        { frequency: 587.33, duration: 0.1, waveType: 'sine' },
        { frequency: 739.99, duration: 0.1, waveType: 'sine' },
        { frequency: 880.00, duration: 0.15, waveType: 'sine' }
    ]},
    debuff: { type: 'sweep', startFreq: 440, endFreq: 220, duration: 0.3, waveType: 'triangle' },
    poison: { type: 'simple', freq: 185, duration: 0.2, waveType: 'triangle' },
    stun: { type: 'chord', freq: [146.83, 220.00], duration: 0.3, waveType: 'square' },
    
    // レベルアップ・成長
    levelup: { type: 'sequence', notes: [
        { frequency: 523.25, duration: 0.1, waveType: 'sine' },
        { frequency: 659.25, duration: 0.1, waveType: 'sine' },
        { frequency: 783.99, duration: 0.1, waveType: 'sine' },
        { frequency: 1046.50, duration: 0.2, waveType: 'sine' }
    ]},
    powerup: { type: 'sequence', notes: [
        { frequency: 523.25, duration: 0.1, waveType: 'sine' },
        { frequency: 659.25, duration: 0.1, waveType: 'sine' },
        { frequency: 783.99, duration: 0.1, waveType: 'sine' },
        { frequency: 987.77, duration: 0.2, waveType: 'sine' }
    ]},
    
    // バトル関連
    battle: { type: 'simple', freq: 329.63, duration: 0.15, waveType: 'square' },
    victory: { type: 'sequence', notes: [
        { frequency: 523.25, duration: 0.15, waveType: 'sine' },
        { frequency: 659.25, duration: 0.15, waveType: 'sine' },
        { frequency: 783.99, duration: 0.15, waveType: 'sine' },
        { frequency: 1046.50, duration: 0.3, waveType: 'sine' }
    ]},
    defeat: { type: 'sweep', startFreq: 440, endFreq: 110, duration: 0.8, waveType: 'triangle' },
    
    // UI・システム
    buy: { type: 'chord', freq: [659.25, 523.25], duration: 0.1, waveType: 'sine' },
    sell: { type: 'chord', freq: [523.25, 415.30], duration: 0.1, waveType: 'sine' },
    error: { type: 'simple', freq: 146.83, duration: 0.3, waveType: 'square' },
    notification: { type: 'simple', freq: 880, duration: 0.1, waveType: 'sine' },
    
    // エリア・探索
    newarea: { type: 'sequence', notes: [
        { frequency: 392.00, duration: 0.15, waveType: 'sine' },
        { frequency: 493.88, duration: 0.15, waveType: 'sine' },
        { frequency: 587.33, duration: 0.15, waveType: 'sine' },
        { frequency: 783.99, duration: 0.25, waveType: 'sine' }
    ]},
    treasure: { type: 'sequence', notes: [
        { frequency: 659.25, duration: 0.1, waveType: 'sine' },
        { frequency: 783.99, duration: 0.1, waveType: 'sine' },
        { frequency: 987.77, duration: 0.1, waveType: 'sine' },
        { frequency: 1174.66, duration: 0.2, waveType: 'sine' }
    ]},
    
    // PvP
    pvpwin: { type: 'sequence', notes: [
        { frequency: 523.25, duration: 0.1, waveType: 'sine' },
        { frequency: 659.25, duration: 0.1, waveType: 'sine' },
        { frequency: 783.99, duration: 0.2, waveType: 'sine' }
    ]},
    pvplose: { type: 'sweep', startFreq: 330, endFreq: 165, duration: 0.4, waveType: 'triangle' },
    
    // その他
    gameover: { type: 'sequence', notes: [
        { frequency: 220, duration: 0.2, waveType: 'triangle' },
        { frequency: 196, duration: 0.2, waveType: 'triangle' },
        { frequency: 165, duration: 0.4, waveType: 'triangle' }
    ]},
    menuOpen: { type: 'simple', freq: 698.46, duration: 0.1, waveType: 'sine' },
    menuClose: { type: 'simple', freq: 523.25, duration: 0.1, waveType: 'sine' }
};

// 音声再生関数
function playSound(soundName) {
    if (!gameConfig.soundEnabled || !sounds[soundName]) return;
    
    try {
        const sound = sounds[soundName];
        
        if (typeof Music === 'undefined' || !Music.js) {
            console.error('Music object is not defined. Attempting to initialize Music.');
            if (typeof Music !== 'undefined' && Music.js && typeof Music.js.init === 'function') {
                Music.js.init();
            } else {
                console.error('Failed to initialize Music object. Sound playback skipped.');
                return;
            }
        }
        
        switch (sound.type) {
            case 'simple':
                Music.js.play(sound.freq, sound.duration, sound.waveType, sound.volume);
                break;
                
            case 'chord':
                Music.js.playChord(sound.freq, sound.duration, sound.waveType, sound.volume);
                break;
                
            case 'sequence':
                Music.js.playSequence(sound.notes, sound.interval || 100);
                break;
                
            case 'sweep':
                Music.js.playSweep(sound.startFreq, sound.endFreq, sound.duration, sound.waveType);
                break;
                
            default:
                // 後方互換性のための古い形式サポート
                if (Array.isArray(sound.freq)) {
                    sound.freq.forEach((freq, i) => {
                        setTimeout(() => {
                            Music.js.play(freq, sound.duration);
                        }, i * (sound.duration * 1000));
                    });
                } else {
                    Music.js.play(sound.freq, sound.duration);
                }
                break;
        }
    } catch (error) {
        console.warn('Sound playback failed:', error);
    }
}

// サウンド設定管理
function toggleSound() {
    gameConfig.soundEnabled = !gameConfig.soundEnabled;
    const button = document.getElementById('sound-toggle');
    if (button) {
        button.textContent = gameConfig.soundEnabled ? '🔊 サウンドON' : '🔇 サウンドOFF';
    }
    
    if (gameConfig.soundEnabled) {
        playSound('notification');
    }
    
    saveGame();
}
