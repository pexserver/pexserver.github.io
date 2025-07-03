/**
 * Music.js - Nintendo Switch ProController 2 音楽ハプティック統合API
 * 音楽再生とハプティックフィードバックの統合制御
 */

class ProCon2Music {
  constructor(core, haptic, audio) {
    this.core = core;
    this.haptic = haptic;
    this.audio = audio;
    
    // 状態管理
    this.isPlaying = false;
    this.currentTrack = null;
    this.playbackStartTime = 0;
    
    // 設定
    this.settings = {
      intensity: 0.7,          // ハプティック強度
      volumeSensitivity: 0.8,  // 音量感度
      bassBoost: false,        // 低音強調
      highToneMode: false,     // 高音域モード
      bpm: 120,               // BPM
      bpmAutoDetect: true,    // BPM自動検出
      updateInterval: 50,     // 更新間隔（ms）
      smoothing: 0.3          // スムージング
    };
    
    // 分析データ
    this.analysisData = null;
    this.lastAnalysisTime = 0;
    
    // 更新タイマー
    this.updateTimer = null;
    
    console.log('ProCon2Music 初期化完了');
  }

  /**
   * 音楽ファイルから再生
   */
  async playFromFile(options = {}) {
    try {
      if (!this.audio.audioBuffer) {
        throw new Error('音楽ファイルが読み込まれていません');
      }

      if (!this.core.getDeviceStatus().hidConnected) {
        throw new Error('Nintendo Switch Pro Controllerが接続されていません');
      }

      console.log('音楽ハプティック再生開始');
      
      // 設定適用
      if (options.intensity !== undefined) this.settings.intensity = options.intensity;
      if (options.bpm !== undefined) this.settings.bpm = options.bpm;
      
      // BPM自動検出
      if (this.settings.bpmAutoDetect) {
        const detectedBPM = this.audio.detectBPM();
        if (detectedBPM) {
          this.settings.bpm = detectedBPM;
          console.log(`BPM自動検出: ${detectedBPM}`);
        }
      }
      
      // 音楽再生開始
      await this.audio.play(options.startTime || 0);
      
      // ハプティック再生開始
      this.startHapticSync();
      
      this.isPlaying = true;
      this.playbackStartTime = Date.now();
      
      return {
        success: true,
        duration: this.audio.duration,
        bpm: this.settings.bpm
      };
      
    } catch (err) {
      console.error('音楽再生エラー:', err);
      throw err;
    }
  }

  /**
   * デモ再生
   */
  async playDemo(options = {}) {
    try {
      if (!this.core.getDeviceStatus().hidConnected) {
        throw new Error('Nintendo Switch Pro Controllerが接続されていません');
      }

      console.log('デモ再生開始');
      
      const mode = options.mode || 'auto';
      let notesPlayed = 0;
      
      switch (mode) {
        case 'rhythm':
          notesPlayed = await this.playRhythmDemo();
          break;
        case 'melody':
          notesPlayed = await this.playMelodyDemo();
          break;
        case 'auto':
        default:
          notesPlayed = await this.playAutoDemo();
          break;
      }
      
      return {
        success: true,
        notesPlayed,
        mode
      };
      
    } catch (err) {
      console.error('デモ再生エラー:', err);
      throw err;
    }
  }

  /**
   * リズムデモ
   */
  async playRhythmDemo() {
    const rhythmPattern = [
      { freq: 160, amp: 0.8, duration: 200 },
      { freq: 0, amp: 0, duration: 100 },
      { freq: 320, amp: 0.6, duration: 150 },
      { freq: 0, amp: 0, duration: 100 },
      { freq: 160, amp: 0.8, duration: 200 },
      { freq: 0, amp: 0, duration: 200 }
    ];

    let notesPlayed = 0;
    
    for (const note of rhythmPattern) {
      if (note.freq > 0) {
        await this.haptic.playPattern('custom', {
          frequency: note.freq,
          amplitude: note.amp * this.settings.intensity,
          duration: note.duration
        });
        notesPlayed++;
      } else {
        await new Promise(resolve => setTimeout(resolve, note.duration));
      }
    }
    
    return notesPlayed;
  }

  /**
   * メロディーデモ
   */
  async playMelodyDemo() {
    // ドレミファソラシド
    const melodyNotes = [
      { freq: 262, amp: 0.7, duration: 300 }, // ド
      { freq: 294, amp: 0.7, duration: 300 }, // レ
      { freq: 330, amp: 0.7, duration: 300 }, // ミ
      { freq: 349, amp: 0.7, duration: 300 }, // ファ
      { freq: 392, amp: 0.7, duration: 300 }, // ソ
      { freq: 440, amp: 0.7, duration: 300 }, // ラ
      { freq: 494, amp: 0.7, duration: 300 }, // シ
      { freq: 523, amp: 0.7, duration: 500 }  // ド（高）
    ];

    let notesPlayed = 0;
    
    for (const note of melodyNotes) {
      await this.haptic.playPattern('custom', {
        frequency: note.freq,
        amplitude: note.amp * this.settings.intensity,
        duration: note.duration
      });
      notesPlayed++;
      
      // 音符間の間隔
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return notesPlayed;
  }

  /**
   * 自動デモ
   */
  async playAutoDemo() {
    console.log('自動デモ: 各種ハプティックパターンのテスト');
    
    const patterns = [
      { name: 'test', duration: 1000 },
      { name: 'pulse', duration: 800 },
      { name: 'wave', duration: 1200 }
    ];

    let notesPlayed = 0;
    
    for (const pattern of patterns) {
      console.log(`デモパターン: ${pattern.name}`);
      await this.haptic.playPattern(pattern.name, {
        intensity: this.settings.intensity,
        duration: pattern.duration
      });
      notesPlayed++;
      
      // パターン間の間隔
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return notesPlayed;
  }

  /**
   * ハプティック同期開始
   */
  startHapticSync() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    
    this.updateTimer = setInterval(() => {
      this.updateHapticFromAudio();
    }, this.settings.updateInterval);
    
    console.log('ハプティック同期開始');
  }

  /**
   * オーディオデータからハプティック更新
   */
  updateHapticFromAudio() {
    if (!this.isPlaying || !this.audio.isPlaying) {
      return;
    }

    try {
      // 音楽解析データ取得
      this.analysisData = this.audio.getAnalysisData();
      
      // ハプティックパターン生成
      const hapticPattern = this.generateHapticFromAnalysis(this.analysisData);
      
      // ハプティック送信
      if (hapticPattern) {
        this.haptic.sendRumbleData(hapticPattern);
      }
      
    } catch (err) {
      console.warn('ハプティック更新エラー:', err);
    }
  }

  /**
   * 音楽解析からハプティックパターン生成
   */
  generateHapticFromAnalysis(analysis) {
    if (!analysis || !this.core.getDeviceStatus().hidConnected) {
      return null;
    }

    // 音量レベルに基づく基本強度
    let baseAmplitude = analysis.volume * this.settings.volumeSensitivity * this.settings.intensity;
    
    // 低音強調
    if (this.settings.bassBoost && analysis.bass > 0.3) {
      baseAmplitude = Math.min(1.0, baseAmplitude * 1.5);
    }
    
    // 高音域モード
    let frequency = 320; // デフォルト周波数
    if (this.settings.highToneMode && analysis.treble > 0.4) {
      frequency = 400 + (analysis.treble * 400); // 400-800Hz
    } else {
      frequency = 160 + (analysis.bass * 320); // 160-480Hz
    }
    
    // BPMに基づくパルス調整
    const bpmFactor = this.settings.bpm / 120; // 120BPMを基準
    const pulseDuration = Math.max(30, Math.min(200, 60000 / this.settings.bpm / 4));
    
    // スムージング適用
    if (this.lastAmplitude !== undefined) {
      baseAmplitude = this.lastAmplitude * this.settings.smoothing + 
                     baseAmplitude * (1 - this.settings.smoothing);
    }
    this.lastAmplitude = baseAmplitude;
    
    // ハプティックデータ生成
    const hapticData = this.core.encodeHDRumble(frequency, baseAmplitude);
    
    return {
      leftMotor: hapticData,
      rightMotor: hapticData,
      duration: pulseDuration
    };
  }

  /**
   * 停止
   */
  stop() {
    try {
      // タイマー停止
      if (this.updateTimer) {
        clearInterval(this.updateTimer);
        this.updateTimer = null;
      }
      
      // 音楽停止
      this.audio.stop();
      
      // ハプティック停止
      this.haptic.stop();
      
      this.isPlaying = false;
      console.log('音楽ハプティック再生停止');
      
    } catch (err) {
      console.error('停止エラー:', err);
    }
  }

  /**
   * 設定更新
   */
  setIntensity(value) {
    this.settings.intensity = Math.max(0, Math.min(1, value / 100)); // パーセンテージから0-1に変換
    console.log(`ハプティック強度: ${Math.round(this.settings.intensity * 100)}%`);
  }

  setVolumeSensitivity(value) {
    this.settings.volumeSensitivity = Math.max(0, Math.min(2, value / 100)); // パーセンテージから0-2に変換
    console.log(`音量感度: ${Math.round(this.settings.volumeSensitivity * 100)}%`);
  }

  setBassBoost(enabled) {
    this.settings.bassBoost = enabled;
    console.log(`低音強調: ${enabled ? '有効' : '無効'}`);
  }

  setHighToneMode(enabled) {
    this.settings.highToneMode = enabled;
    console.log(`高音域モード: ${enabled ? '有効' : '無効'}`);
  }

  setHeadphoneOutput(enabled) {
    this.audio.setHeadphoneOutput(enabled);
  }

  setBPM(bpm) {
    this.settings.bpm = Math.max(60, Math.min(200, bpm));
    console.log(`BPM: ${this.settings.bpm}`);
  }

  setBPMAutoDetect(enabled) {
    this.settings.bpmAutoDetect = enabled;
    console.log(`BPM自動検出: ${enabled ? '有効' : '無効'}`);
  }

  setUpdateInterval(ms) {
    this.settings.updateInterval = Math.max(20, Math.min(200, ms));
    console.log(`更新間隔: ${this.settings.updateInterval}ms`);
    
    // タイマー再起動
    if (this.isPlaying) {
      this.startHapticSync();
    }
  }

  setSmoothing(value) {
    this.settings.smoothing = Math.max(0, Math.min(1, value / 100)); // パーセンテージから0-1に変換
    console.log(`スムージング: ${Math.round(this.settings.smoothing * 100)}%`);
  }

  setSpeed(value) {
    // スピード設定（更新間隔の逆数として実装）
    const speed = Math.max(0.1, Math.min(2.0, value / 100));
    this.settings.updateInterval = Math.round(50 / speed);
    console.log(`再生速度: ${Math.round(speed * 100)}% (更新間隔: ${this.settings.updateInterval}ms)`);
    
    // タイマー再起動
    if (this.isPlaying) {
      this.startHapticSync();
    }
  }

  /**
   * 現在の設定を取得（UI互換形式）
   */
  getSettings() {
    return {
      intensity: this.settings.intensity * 100, // 0-1 を 0-100 に変換
      volumeSensitivity: this.settings.volumeSensitivity * 100,
      bassBoost: this.settings.bassBoost,
      highToneMode: this.settings.highToneMode,
      bpm: this.settings.bpm,
      bpmAutoDetect: this.settings.bpmAutoDetect,
      updateInterval: this.settings.updateInterval,
      smoothing: this.settings.smoothing * 100
    };
  }

  /**
   * 設定を一括更新
   */
  updateSettings(newSettings) {
    Object.assign(this.settings, newSettings);
    console.log('設定を更新しました:', newSettings);
  }

  /**
   * 設定をリセット
   */
  resetSettings() {
    this.settings = {
      intensity: 0.7,
      volumeSensitivity: 0.8,
      bassBoost: false,
      highToneMode: false,
      bpm: 120,
      bpmAutoDetect: true,
      updateInterval: 50,
      smoothing: 0.3
    };
    console.log('設定をリセットしました');
  }

  /**
   * ハプティック接続テスト
   */
  async testHapticConnection() {
    try {
      console.log('ハプティック接続テスト開始');
      
      if (!this.core.getDeviceStatus().hidConnected) {
        throw new Error('Nintendo Switch Pro Controllerが接続されていません');
      }
      
      // テストパターン送信
      const testResults = [];
      
      // 基本振動テスト
      console.log('基本振動テスト...');
      await this.haptic.playPattern('test', { intensity: 0.5, duration: 500 });
      testResults.push('基本振動: OK');
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 周波数レンジテスト
      console.log('周波数レンジテスト...');
      const frequencies = [160, 250, 320, 400];
      for (const freq of frequencies) {
        await this.haptic.playPattern('custom', {
          frequency: freq,
          amplitude: 0.6,
          duration: 300
        });
        testResults.push(`${freq}Hz: OK`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('ハプティック接続テスト完了');
      
      return {
        success: true,
        testResults,
        message: 'ハプティック接続テスト正常完了'
      };
      
    } catch (err) {
      console.error('ハプティック接続テストエラー:', err);
      return {
        success: false,
        error: err.message,
        message: 'ハプティック接続テスト失敗'
      };
    }
  }

  /**
   * 音量プレビュー表示
   */
  showVolumePreview() {
    if (!this.isPlaying || !this.analysisData) {
      console.log('音量プレビュー: 再生中ではありません');
      return null;
    }

    const preview = {
      volume: Math.round(this.analysisData.volume * 100),
      bass: Math.round(this.analysisData.bass * 100),
      mid: Math.round(this.analysisData.mid * 100),
      treble: Math.round(this.analysisData.treble * 100),
      hapticIntensity: Math.round(this.analysisData.volume * this.settings.intensity * 100)
    };

    console.log('音量プレビュー:', preview);
    return preview;
  }

  /**
   * 音楽再生中か確認
   */
  isPlayingMusic() {
    return this.isPlaying && this.audio.isPlaying;
  }

  /**
   * 現在の状態取得
   */
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      hasTrack: !!this.currentTrack,
      audioStatus: this.audio.getStatus(),
      hapticStatus: this.haptic.getStatus(),
      settings: { ...this.settings },
      lastAnalysis: this.analysisData ? {
        volume: this.analysisData.volume,
        bass: this.analysisData.bass,
        mid: this.analysisData.mid,
        treble: this.analysisData.treble
      } : null
    };
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    try {
      this.stop();
      console.log('ProCon2Music クリーンアップ完了');
    } catch (err) {
      console.warn('ProCon2Music クリーンアップエラー:', err);
    }
  }

  /**
   * 音楽ファイル読み込み（audioオブジェクトへの委譲）
   */
  async loadFile(file) {
    try {
      console.log('音楽ファイル読み込み開始:', file.name);
      
      // audioオブジェクトのloadFileメソッドを呼び出し
      const result = await this.audio.loadFile(file);
      
      if (result.success) {
        this.currentTrack = {
          file: file,
          name: result.fileName,
          duration: result.duration,
          sampleRate: result.sampleRate,
          channels: result.channels
        };
        
        console.log('音楽ファイル読み込み完了:', this.currentTrack);
        return result;
      } else {
        throw new Error('音楽ファイルの読み込みに失敗しました');
      }
      
    } catch (err) {
      console.error('音楽ファイル読み込みエラー:', err);
      throw err;
    }
  }

  /**
   * 音楽再生（簡易バージョン）
   */
  async play(startTime = 0) {
    try {
      if (!this.currentTrack && !this.audio.audioBuffer) {
        throw new Error('音楽ファイルが読み込まれていません');
      }

      console.log('音楽再生開始...');
      
      // playFromFileメソッドを内部的に呼び出し
      return await this.playFromFile({ startTime });
      
    } catch (err) {
      console.error('音楽再生エラー:', err);
      throw err;
    }
  }

  /**
   * 読み込まれたファイルの事前処理
   */
  async processLoadedFile() {
    try {
      if (!this.currentTrack && !this.audio.audioBuffer) {
        throw new Error('音楽ファイルが読み込まれていません');
      }

      console.log('音楽ファイル事前処理開始...');
      
      const audioBuffer = this.audio.audioBuffer;
      if (!audioBuffer) {
        throw new Error('オーディオバッファが初期化されていません');
      }
      
      // BPM検出
      let bpm = this.settings.bpm;
      if (this.settings.bpmAutoDetect) {
        const detectedBPM = this.audio.detectBPM();
        if (detectedBPM) {
          bpm = detectedBPM;
          this.settings.bpm = bpm;
          console.log(`BPM自動検出: ${bpm}`);
        }
      }
      
      // 音楽データの基本情報を算出
      const duration = audioBuffer.duration;
      const sampleRate = audioBuffer.sampleRate;
      const channels = audioBuffer.numberOfChannels;
      
      // 簡易ノート生成（ビート基準）
      const beatsPerSecond = bpm / 60;
      const totalBeats = Math.floor(duration * beatsPerSecond);
      const estimatedNotes = totalBeats * 2; // 1ビートあたり平均2ノート
      
      const result = {
        success: true,
        totalNotes: estimatedNotes,
        originalDuration: duration,
        duration: duration, // UI互換性のため
        detectedBPM: bpm,
        sampleRate: sampleRate,
        channels: channels,
        estimatedComplexity: estimatedNotes / duration, // ノート密度
        preparationComplete: true,
        // UI互換性のためのsettings追加
        settings: {
          bpm: bpm,
          intensity: this.settings.intensity,
          updateInterval: this.settings.updateInterval
        }
      };
      
      console.log('音楽ファイル事前処理完了:', result);
      return result;
      
    } catch (err) {
      console.error('事前処理エラー:', err);
      return {
        success: false,
        error: err.message,
        totalNotes: 0,
        originalDuration: 0
      };
    }
  }
}

// グローバルエクスポート
window.ProCon2Music = ProCon2Music;
