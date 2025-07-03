/**
 * ProCon2Haptic.js - Nintendo Switch ProController 2 ハプティック制御API
 * 振動パターンの生成、再生、管理を専門に扱う
 */

class ProCon2Haptic {
  constructor(core) {
    this.core = core;
    
    // ハプティック状態
    this.isPlaying = false;
    this.stopRequested = false;
    this.currentPattern = null;
    this.currentIndex = 0;
    this.counter = 0;
    this.intervalMs = 100; // handheldlegend/procon2tool と同じ100ms間隔
    this.timeout = null;
    this.interval = null;
    
    // エラー管理
    this.consecutiveErrors = 0;
    this.maxRetries = 3;
    this.maxConsecutiveErrors = 5;
    
    // プリセットパターン（handheldlegend/procon2tool 実証済み）
    this.presetPatterns = {
      // handheldlegend/procon2tool からの実証済みテストパターン
      test: [
        [0x93, 0x35, 0x36, 0x1c, 0x0d],
        [0xa8, 0x29, 0xc5, 0xdc, 0x0c],
        [0x75, 0x21, 0xb5, 0x5d, 0x13],
        [0x75, 0xf5, 0x70, 0x1e, 0x11],
        [0xba, 0x55, 0x40, 0x1e, 0x08],
        [0x90, 0x31, 0x10, 0x9e, 0x00],
        [0x3f, 0x01, 0xf0, 0x19, 0x00]
      ],
      // 短いテストパターン（デバッグ用）
      simple: [
        [0x93, 0x35, 0x36, 0x1c, 0x0d],
        [0xa8, 0x29, 0xc5, 0xdc, 0x0c],
        [0x3f, 0x01, 0xf0, 0x19, 0x00]
      ],
      gentle: [
        [0x50, 0x10, 0x10, 0x10, 0x08],
        [0x51, 0x15, 0x15, 0x15, 0x08],
        [0x52, 0x10, 0x10, 0x10, 0x08]
      ],
      strong: [
        [0x60, 0x30, 0x30, 0x30, 0x20],
        [0x61, 0x35, 0x35, 0x35, 0x20],
        [0x62, 0x30, 0x30, 0x30, 0x20]
      ],
      // 停止パターン
      stop: [
        [0x00, 0x01, 0x40, 0x40, 0x00]
      ]
    };
  }

  /**
   * パターン再生開始
   */
  async playPattern(patternName = 'test', options = {}) {
    if (this.isPlaying) {
      throw new Error('既に再生中です');
    }

    if (!this.core.getDeviceStatus().hidConnected) {
      throw new Error('HIDデバイスが接続されていません');
    }

    const pattern = this.presetPatterns[patternName];
    if (!pattern) {
      throw new Error(`パターン '${patternName}' が見つかりません`);
    }

    this.currentPattern = pattern;
    this.currentIndex = 0;
    this.counter = 0;
    this.consecutiveErrors = 0;
    this.isPlaying = true;
    
    // オプション設定
    this.intervalMs = options.intervalMs || this.intervalMs;
    const timeoutMs = options.timeoutMs || 30000;

    // タイムアウト設定
    this.timeout = setTimeout(() => {
      this.stop();
    }, timeoutMs);

    // 再生開始
    this.scheduleNext();

    return {
      patternName,
      length: pattern.length,
      intervalMs: this.intervalMs
    };
  }

  /**
   * カスタムパターン再生
   */
  async playCustomPattern(pattern, options = {}) {
    if (!Array.isArray(pattern) || pattern.length === 0) {
      throw new Error('無効なパターンです');
    }

    // パターンを一時的に登録
    this.presetPatterns.custom = pattern;
    
    return await this.playPattern('custom', options);
  }

  /**
   * 次のパケット送信をスケジュール
   */
  scheduleNext() {
    if (!this.isPlaying) return;

    if (this.currentIndex >= this.currentPattern.length) {
      this.stop();
      return;
    }

    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      this.stop();
      return;
    }

    this.interval = setTimeout(async () => {
      await this.sendCurrentPacket();
      this.scheduleNext();
    }, this.intervalMs);
  }

  /**
   * 現在のパケット送信
   */
  async sendCurrentPacket() {
    if (!this.isPlaying || this.currentIndex >= this.currentPattern.length) {
      return;
    }

    const hapticData = this.currentPattern[this.currentIndex];
    const report = this.core.createHapticReport(hapticData, this.counter);

    let success = false;
    let lastError = null;

    // リトライ機能付きで送信
    for (let retry = 0; retry < this.maxRetries && !success; retry++) {
      try {
        await this.core.sendHidData(report);
        success = true;
        this.consecutiveErrors = 0;
      } catch (err) {
        lastError = err;
        
        if (err.message.includes('disconnected')) {
          this.stop();
          return;
        }
        
        // リトライ前の待機
        if (retry < this.maxRetries - 1) {
          const waitMs = err.message.includes('Failed to write') ? 20 : 2;
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
      }
    }

    if (!success) {
      this.consecutiveErrors++;
    }

    // 次のパケットに進む
    this.counter = (this.counter + 1) & 0x0F;
    this.currentIndex++;
  }

  /**
   * 再生停止（改良版）
   */
  stop() {
    console.log('ハプティック再生停止要求');
    this.stopRequested = true;
    
    // タイマーのクリア
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = null;
    }

    const wasPlaying = this.isPlaying;
    this.isPlaying = false;

    // 停止コマンド送信（handheldlegend/procon2tool 準拠）
    if (wasPlaying && this.core.getDeviceStatus().hidConnected) {
      try {
        // 停止用のハプティックデータ（振動なし）
        const stopData = [0x00, 0x01, 0x40, 0x40];
        const stopReport = this.core.createHapticReport(stopData, this.counter);
        
        // 停止コマンドは即座に送信（非同期でエラーを無視）
        this.core.sendHidData(stopReport).then(() => {
          console.log('停止コマンド送信完了');
        }).catch(err => {
          console.warn('停止コマンド送信エラー（無視）:', err.message);
        });
        
        // カウンターを更新
        this.counter = (this.counter + 1) & 0x0F;
        
      } catch (err) {
        console.warn('停止処理エラー（無視）:', err.message);
      }
    }

    // 状態リセット
    this.currentPattern = null;
    this.currentIndex = 0;
    this.consecutiveErrors = 0;
    
    console.log('ハプティック再生停止完了');
  }

  /**
   * 送信間隔変更（handheldlegend/procon2tool 準拠）
   */
  setInterval(ms) {
    // handheldlegend/procon2tool では4ms間隔が実証済み
    // 最小値を4msに設定
    this.intervalMs = Math.max(4, Math.min(1000, ms));
  }

  /**
   * 強度調整付きパターン生成
   */
  generateIntensityPattern(basePattern, intensity = 100) {
    const multiplier = Math.max(10, Math.min(200, intensity)) / 100;
    
    return basePattern.map(packet => {
      return packet.map((byte, index) => {
        if (index >= 1 && index <= 3) { // 強度バイト
          return Math.max(0x10, Math.min(0x30, Math.floor(byte * multiplier)));
        }
        return byte;
      });
    });
  }

  /**
   * 音楽ノート→振動パターン変換（Nintendo Switch公式仕様対応）
   * handheldlegend/procon2tool の実装に基づく改良版
   */
  noteToHapticPattern(note, intensity = 100, highToneMode = false) {
    const noteRegex = /^([A-G]#?)(-?\d)$/;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let midi = 60; // デフォルトC4

    if (typeof note === 'string') {
      const match = note.match(noteRegex);
      if (match) {
        const idx = noteNames.indexOf(match[1]);
        if (idx >= 0) {
          midi = idx + (parseInt(match[2], 10) + 1) * 12;
          if (highToneMode) {
            midi += 12;
          }
        }
      }
    } else if (typeof note === 'number') {
      midi = note;
    }

    // MIDI番号を周波数に変換
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    
    // 強度を0.0-1.0に正規化
    const amplitude = Math.max(0.1, Math.min(1.0, intensity / 100));
    
    // HD Rumble用の周波数範囲に調整 (Nintendo Switch公式範囲)
    const clampedFreq = Math.max(81.75, Math.min(1252.27, frequency));
    
    // core.encodeHDRumbleを使用してパターン生成（Nintendo公式仕様）
    return this.core.encodeHDRumble(clampedFreq, amplitude);
  }

  /**
   * ピアノ鍵盤番号→振動パターン変換
   */
  pianoKeyToHapticPattern(pianoKey, intensity = 100) {
    // ピアノ鍵盤番号をMIDI番号に変換 (鍵盤1 = MIDI 21 = A0)
    const midi = pianoKey + 20;
    return this.noteToHapticPattern(midi, intensity);
  }

  /**
   * 音楽データ形式→ハプティック再生（安定性向上版）
   */
  async playMusicData(musicData, options = {}) {
    if (!Array.isArray(musicData) || musicData.length === 0) {
      throw new Error('無効な音楽データです');
    }

    if (this.isPlaying) {
      throw new Error('既に再生中です');
    }

    if (!this.core.getDeviceStatus().hidConnected) {
      throw new Error('HIDデバイスが接続されていません');
    }

    this.isPlaying = true;
    this.stopRequested = false;
    this.currentPattern = [];
    this.currentIndex = 0;
    this.counter = 0;
    this.consecutiveErrors = 0;

    // オプション設定
    const intensity = options.intensity || 100;
    const bpm = options.bpm || 120;
    const beatIntervalMs = (60 / bpm) * 1000; // 1拍の間隔(ms)
    const useChunking = musicData.length > 100 || options.forceChunking; // 100ノート以上は自動的にチャンク分割
    
    console.log(`音楽データ再生開始: ${musicData.length}ノート, BPM=${bpm}, 拍間隔=${beatIntervalMs.toFixed(1)}ms, チャンク分割: ${useChunking ? 'あり' : 'なし'}`);

    // タイムアウト設定（長い楽曲用に調整）
    const estimatedDuration = musicData.length * beatIntervalMs;
    const timeoutMs = options.timeoutMs || Math.max(30000, estimatedDuration + 10000);
    
    this.timeout = setTimeout(() => {
      console.warn('再生タイムアウト。停止します。');
      this.stop();
    }, timeoutMs);

    let result;
    try {
      if (useChunking) {
        // チャンク分割再生（長時間・大容量データ用）
        const notesPlayed = await this.playMusicInChunks(musicData, {
          ...options,
          beatIntervalMs,
          intensity,
          chunkSize: options.chunkSize || 150,
          chunkPause: options.chunkPause || 100
        });
        
        result = {
          notesPlayed,
          totalNotes: musicData.length,
          duration: notesPlayed * beatIntervalMs,
          method: 'chunked'
        };
      } else {
        // 通常再生（短時間データ用）
        this.currentPattern = musicData.map(noteData => {
          if (noteData.pianoKey) {
            return this.pianoKeyToHapticPattern(noteData.pianoKey, intensity);
          } else if (noteData.note) {
            return this.noteToHapticPattern(noteData.note, intensity);
          } else {
            // 無音
            return [0x00, 0x01, 0x40, 0x40]; // 無音パターン
          }
        });

        await this.playMusicLoop(musicData, beatIntervalMs);
        
        result = {
          notesPlayed: this.currentIndex,
          totalNotes: musicData.length,
          duration: this.currentIndex * beatIntervalMs,
          method: 'direct'
        };
      }
    } catch (err) {
      console.error('音楽データ再生中にエラーが発生:', err);
      throw err;
    } finally {
      // クリーンアップ
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
    }

    console.log(`音楽データ再生結果:`, result);
    return result;
  }

  /**
   * 音楽データ再生ループ（安定性向上版）
   */
  async playMusicLoop(musicData, beatIntervalMs) {
    const startTime = Date.now();
    let lastSuccessTime = startTime;
    let skipCount = 0;

    for (let i = 0; i < musicData.length && this.isPlaying && !this.stopRequested; i++) {
      const targetTime = startTime + (i * beatIntervalMs);
      const currentTime = Date.now();
      
      // タイミング調整（最大50msまでの遅延を許容）
      const delay = targetTime - currentTime;
      if (delay > 0 && delay <= 50) {
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (delay < -100) {
        // 大幅な遅延が発生した場合はスキップ
        skipCount++;
        console.warn(`タイミング遅延によりスキップ: ${i+1}/${musicData.length} (遅延: ${-delay}ms)`);
        continue;
      }

      // 停止要求・接続状態チェック
      if (!this.isPlaying || this.stopRequested) {
        break;
      }
      
      if (!this.core.getDeviceStatus().hidConnected) {
        console.error('デバイス切断を検出。再生を停止します。');
        break;
      }

      // ハプティックデータ送信（リトライ機能強化）
      let success = false;
      let lastError = null;
      
      for (let retry = 0; retry < this.maxRetries && !success; retry++) {
        try {
          const hapticPattern = this.currentPattern[i];
          if (!hapticPattern) {
            console.warn(`無効なパターン (${i+1}/${musicData.length}): パターンをスキップ`);
            success = true; // スキップとして処理
            break;
          }
          
          const report = this.core.createHapticReport(hapticPattern, this.counter);
          await this.core.sendHidData(report);
          
          success = true;
          this.consecutiveErrors = 0;
          lastSuccessTime = Date.now();
          
          // ログ出力（詳細度を調整）
          if (i % 10 === 0 || this.consecutiveErrors > 0) {
            console.log(`♪ ${i+1}/${musicData.length}: 鍵盤${musicData[i].pianoKey || 'N/A'} (リトライ: ${retry})`);
          }
          
        } catch (err) {
          lastError = err;
          
          if (err.message.includes('disconnected') || err.message.includes('device')) {
            console.error('デバイス切断を検出。再生を停止します。');
            this.stop();
            return;
          }
          
          // リトライ前の待機（指数バックオフ）
          if (retry < this.maxRetries - 1) {
            const backoffMs = Math.min(50, 5 * Math.pow(2, retry));
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      }

      if (!success) {
        this.consecutiveErrors++;
        console.error(`ハプティック送信失敗 (${i+1}/${musicData.length}, 連続エラー: ${this.consecutiveErrors}):`, lastError?.message);
        
        // 連続エラー上限チェック
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          console.error('連続エラー上限に達しました。再生を停止します。');
          break;
        }
        
        // 長時間エラーが続く場合は短時間休憩
        if (Date.now() - lastSuccessTime > 5000) {
          console.warn('長時間エラーが継続。500ms休憩します。');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        this.currentIndex = i + 1;
        this.counter = (this.counter + 1) & 0x0F;
      }

      // CPU負荷軽減とガベージコレクション促進
      if (i % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 2));
        
        // メモリ使用状況の監視（開発環境のみ）
        if (typeof performance !== 'undefined' && performance.memory) {
          const memUsed = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
          if (memUsed > 100) { // 100MB以上の場合
            console.log(`メモリ使用量: ${memUsed}MB (${i+1}/${musicData.length})`);
          }
        }
      }
    }

    console.log(`音楽ハプティック再生完了: ${this.currentIndex}/${musicData.length}ノート (スキップ: ${skipCount})`);
  }

  /**
   * 音楽データを最適化されたハプティックパターンに変換
   * 音楽的表現力とパフォーマンスを向上
   */
  optimizeMusicForHaptics(musicData, options = {}) {
    const { 
      sustainNotes = true,           // ノートの持続
      silenceBetweenNotes = true,    // ノート間の無音
      dynamicIntensity = true,       // 動的な強度調整
      maxContinuousNotes = 100       // 連続再生の最大ノート数
    } = options;

    const optimizedPattern = [];
    let lastPianoKey = null;
    let sustainCount = 0;

    for (let i = 0; i < musicData.length; i++) {
      const noteData = musicData[i];
      const currentPianoKey = noteData.pianoKey;

      // 同じ鍵盤の連続は振動強度を調整
      if (currentPianoKey === lastPianoKey && sustainNotes) {
        sustainCount++;
        // 持続音は徐々に弱くする
        const intensity = Math.max(0.3, 1.0 - (sustainCount * 0.1));
        optimizedPattern.push(this.pianoKeyToHapticPattern(currentPianoKey, intensity * 100));
      } else {
        sustainCount = 0;
        
        // 新しいノートは通常の強度
        const baseIntensity = dynamicIntensity ? 
          this.calculateDynamicIntensity(noteData, musicData, i) : 1.0;
        optimizedPattern.push(this.pianoKeyToHapticPattern(currentPianoKey, baseIntensity * 100));
        
        // ノート間の無音期間を追加（音楽的表現）
        if (silenceBetweenNotes && i < musicData.length - 1) {
          const nextNote = musicData[i + 1];
          const timeDiff = nextNote.time - noteData.time;
          
          // 時間差が大きい場合は無音期間を挿入
          if (timeDiff > 0.2) { // 200ms以上の間隔
            optimizedPattern.push([0x00, 0x01, 0x40, 0x40]); // 無音パターン
          }
        }
      }

      lastPianoKey = currentPianoKey;

      // 長すぎるパターンはチャンクに分割
      if (optimizedPattern.length >= maxContinuousNotes) {
        break;
      }
    }

    return optimizedPattern;
  }

  /**
   * 動的な強度計算（音楽的表現のため）
   */
  calculateDynamicIntensity(noteData, allData, currentIndex) {
    // 音量データがある場合はそれを使用
    if (noteData.volume !== undefined) {
      return Math.max(0.2, Math.min(1.0, noteData.volume));
    }

    // 鍵盤位置による強度調整（低音は強く、高音は軽く）
    const pianoKey = noteData.pianoKey || 44; // 中央C
    let intensity;
    
    if (pianoKey < 30) {
      intensity = 0.9; // 低音域は強め
    } else if (pianoKey < 60) {
      intensity = 0.7; // 中音域は標準
    } else {
      intensity = 0.5; // 高音域は軽め
    }

    // 周囲のノート密度による調整
    const windowSize = 5;
    const start = Math.max(0, currentIndex - windowSize);
    const end = Math.min(allData.length, currentIndex + windowSize);
    const density = (end - start) / (windowSize * 2);
    
    // 密度が高い部分は少し抑制
    intensity *= (1.0 - density * 0.2);
    
    return Math.max(0.2, Math.min(1.0, intensity));
  }

  /**
   * チャンク分割による長時間音楽再生（改良版）
   */
  async playMusicInChunks(musicData, options = {}) {
    const chunkSize = options.chunkSize || 150; // 少し小さめのチャンクサイズ
    const chunkPause = options.chunkPause || 100; // チャンク間の休憩を増加
    const maxRetryPerChunk = 2; // チャンク単位でのリトライ
    
    console.log(`チャンク分割再生開始: ${musicData.length}ノート, チャンクサイズ: ${chunkSize}`);
    
    let totalNotesPlayed = 0;
    let chunkIndex = 0;
    
    for (let i = 0; i < musicData.length && this.isPlaying && !this.stopRequested; i += chunkSize) {
      chunkIndex++;
      const chunk = musicData.slice(i, i + chunkSize);
      let chunkSuccess = false;
      
      // チャンク単位でのリトライ
      for (let retryCount = 0; retryCount < maxRetryPerChunk && !chunkSuccess; retryCount++) {
        try {
          // 接続状態チェック
          if (!this.core.getDeviceStatus().hidConnected) {
            console.error(`チャンク ${chunkIndex}: デバイス切断のため停止`);
            return totalNotesPlayed;
          }
          
          // ハプティックパターン最適化
          const optimizedChunk = this.optimizeMusicForHaptics(chunk, {
            ...options,
            maxContinuousNotes: Math.min(chunkSize, 100) // チャンクサイズに応じて調整
          });
          
          console.log(`チャンク ${chunkIndex}: ${chunk.length}ノート → ${optimizedChunk.length}パターン (試行: ${retryCount + 1})`);
          
          // エラーカウンターリセット
          this.consecutiveErrors = 0;
          
          // チャンク再生
          this.currentPattern = optimizedChunk;
          await this.playMusicLoop(chunk, options.beatIntervalMs || 400);
          
          chunkSuccess = true;
          totalNotesPlayed += chunk.length;
          
        } catch (err) {
          console.error(`チャンク ${chunkIndex} 再生エラー (試行 ${retryCount + 1}):`, err);
          
          if (retryCount < maxRetryPerChunk - 1) {
            const waitMs = 200 * (retryCount + 1); // 指数バックオフ
            console.log(`チャンク ${chunkIndex}: ${waitMs}ms後にリトライします`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
          }
        }
      }
      
      if (!chunkSuccess) {
        console.error(`チャンク ${chunkIndex}: 最大リトライ回数に達しました。スキップして続行`);
      }
      
      // チャンク間の休憩とメモリクリーンアップ
      if (i + chunkSize < musicData.length && this.isPlaying) {
        console.log(`チャンク間休憩: ${chunkPause}ms`);
        
        // 明示的なガベージコレクション促進
        this.currentPattern = null;
        await new Promise(resolve => setTimeout(resolve, chunkPause));
        
        // 接続状態の再確認
        if (!this.core.getDeviceStatus().hidConnected) {
          console.error('デバイス切断を検出。チャンク再生を停止します。');
          break;
        }
      }
    }
    
    console.log(`チャンク分割再生完了: ${totalNotesPlayed}/${musicData.length}ノート (${chunkIndex}チャンク)`);
    return totalNotesPlayed;
  }

  /**
   * 音量ベース振動パターン再生（シンプル版）
   * @param {Array} volumeData - 音量データ配列
   * @param {Object} options - 再生オプション
   */
  async playVolumeBasedPattern(volumeData, options = {}) {
    if (this.isPlaying) {
      console.warn('既に再生中です');
      return { success: false, reason: 'already_playing' };
    }

    if (!this.core.getDeviceStatus().hidConnected) {
      throw new Error('Nintendo Switch Pro Controllerが接続されていません');
    }

    if (!volumeData || !volumeData.volumePoints || volumeData.volumePoints.length === 0) {
      throw new Error('音量データが無効です');
    }

    const volumePoints = volumeData.volumePoints;
    const intervalMs = options.intervalMs || volumeData.windowMs || 50;
    const intensityMultiplier = options.intensityMultiplier || 1.0;
    const timeoutMs = options.timeoutMs || 60000;

    console.log(`音量ベース振動開始: ${volumePoints.length}ポイント, 間隔=${intervalMs}ms`);

    this.isPlaying = true;
    this.stopRequested = false;
    this.consecutiveErrors = 0;
    
    // タイムアウト設定
    this.timeout = setTimeout(() => {
      console.warn('音量ベース振動タイムアウト');
      this.stop();
    }, timeoutMs);

    let pointsPlayed = 0;
    const startTime = Date.now();

    try {
      for (let i = 0; i < volumePoints.length && !this.stopRequested; i++) {
        const point = volumePoints[i];
        const targetTime = point.time * 1000; // 秒をミリ秒に
        const currentTime = Date.now() - startTime;

        // タイミング調整
        if (currentTime < targetTime) {
          await new Promise(resolve => setTimeout(resolve, targetTime - currentTime));
        }

        // 振動強度を計算
        const intensity = Math.round(point.intensity * intensityMultiplier);
        const hapticData = this.intensityToHapticData(intensity);

        // 振動パターン送信
        const success = await this.sendVolumeHaptic(hapticData, i);
        
        if (success) {
          pointsPlayed++;
          this.consecutiveErrors = 0;
        } else {
          this.consecutiveErrors++;
          if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            console.error('連続エラー上限に達しました');
            break;
          }
        }

        // 進捗表示（100ポイントごと）
        if (i % 100 === 0) {
          console.log(`音量ベース振動進捗: ${i}/${volumePoints.length} (${(i/volumePoints.length*100).toFixed(1)}%)`);
        }

        // CPU負荷軽減
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      console.log(`音量ベース振動完了: ${pointsPlayed}/${volumePoints.length}ポイント再生`);
      
      return {
        success: true,
        pointsPlayed,
        totalPoints: volumePoints.length,
        duration: (Date.now() - startTime) / 1000
      };

    } catch (error) {
      console.error('音量ベース振動エラー:', error);
      throw error;
    } finally {
      this.isPlaying = false;
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
    }
  }

  /**
   * 音量ハプティックデータ送信
   */
  async sendVolumeHaptic(hapticData, counter) {
    if (!this.core.getDeviceStatus().hidConnected) {
      return false;
    }

    try {
      const report = this.core.createHapticReport(hapticData, counter);
      await this.core.sendHidData(report);
      return true;
    } catch (err) {
      console.warn('音量ハプティック送信エラー:', err);
      this.consecutiveErrors++;
      return false;
    }
  }

  /**
   * ランブルデータ送信（音楽同期用）
   */
  async sendRumbleData(rumblePattern) {
    if (!this.core.getDeviceStatus().hidConnected || !rumblePattern) {
      return false;
    }

    try {
      let hapticData;
      
      // パターンの種類に応じて処理
      if (rumblePattern.leftMotor && rumblePattern.rightMotor) {
        // 左右モーター別指定
        hapticData = [
          ...rumblePattern.leftMotor,
          ...rumblePattern.rightMotor
        ];
      } else if (Array.isArray(rumblePattern)) {
        // 配列形式
        hapticData = rumblePattern;
      } else {
        // デフォルト処理
        console.warn('不正なランブルパターン:', rumblePattern);
        return false;
      }

      const report = this.core.createHapticReport(hapticData, this.counter);
      await this.core.sendHidData(report);
      
      this.counter = (this.counter + 1) & 0x0F;
      return true;
      
    } catch (err) {
      console.warn('ランブルデータ送信エラー:', err);
      this.consecutiveErrors++;
      return false;
    }
  }

  /**
   * 停止要求フラグ
   */
  setStopRequested(value) {
    this.stopRequested = value;
  }

  /**
   * 現在の状態取得
   */
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      currentPattern: this.currentPattern ? 'playing' : null,
      currentIndex: this.currentIndex,
      totalPackets: this.currentPattern ? this.currentPattern.length : 0,
      intervalMs: this.intervalMs,
      consecutiveErrors: this.consecutiveErrors,
      deviceConnected: this.core.getDeviceStatus().hidConnected
    };
  }

  /**
   * 利用可能なパターン一覧
   */
  getAvailablePatterns() {
    return Object.keys(this.presetPatterns).filter(name => name !== 'custom');
  }

  /**
   * パターン登録
   */
  registerPattern(name, pattern) {
    if (!Array.isArray(pattern)) {
      throw new Error('パターンは配列である必要があります');
    }
    
    this.presetPatterns[name] = pattern;
  }

  /**
   * 診断情報の取得
   */
  getDiagnostics() {
    const deviceStatus = this.core.getDeviceStatus();
    
    return {
      // ハプティック状態
      haptic: {
        isPlaying: this.isPlaying,
        stopRequested: this.stopRequested,
        currentIndex: this.currentIndex,
        totalPackets: this.currentPattern ? this.currentPattern.length : 0,
        consecutiveErrors: this.consecutiveErrors,
        intervalMs: this.intervalMs,
        counter: this.counter
      },
      
      // デバイス状態
      device: deviceStatus,
      
      // システム情報
      system: {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        memory: typeof performance !== 'undefined' && performance.memory ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        } : null
      }
    };
  }

  /**
   * 接続テスト
   */
  async runConnectionTest() {
    console.log('=== ProCon2 接続テスト開始 ===');
    
    const diagnostics = this.getDiagnostics();
    console.log('診断情報:', diagnostics);
    
    if (!diagnostics.device.hidConnected) {
      console.error('❌ HIDデバイスが接続されていません');
      return { success: false, error: 'デバイス未接続' };
    }
    
    if (this.isPlaying) {
      console.error('❌ 既に再生中です');
      return { success: false, error: '既に再生中' };
    }
    
    try {
      // 短いテストパターンで接続テスト
      console.log('🔧 テストパターン送信中...');
      await this.playPattern('simple', { timeoutMs: 5000 });
      
      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (this.consecutiveErrors === 0) {
        console.log('✅ 接続テスト成功');
        return { success: true, diagnostics };
      } else {
        console.warn(`⚠️ 接続テスト完了（エラー発生: ${this.consecutiveErrors}回）`);
        return { success: false, error: `${this.consecutiveErrors}回のエラー`, diagnostics };
      }
      
    } catch (err) {
      console.error('❌ 接続テスト失敗:', err);
      return { success: false, error: err.message, diagnostics };
    } finally {
      this.stop();
      console.log('=== ProCon2 接続テスト終了 ===');
    }
  }

  /**
   * パフォーマンス測定
   */
  async measurePerformance(sampleCount = 50) {
    if (!this.core.getDeviceStatus().hidConnected) {
      throw new Error('HIDデバイスが接続されていません');
    }
    
    console.log(`パフォーマンス測定開始: ${sampleCount}サンプル`);
    
    const results = [];
    const testPattern = [0x93, 0x35, 0x36, 0x1c];
    
    for (let i = 0; i < sampleCount; i++) {
      const startTime = performance.now();
      
      try {
        const report = this.core.createHapticReport(testPattern, i & 0x0F);
        await this.core.sendHidData(report);
        
        const endTime = performance.now();
        results.push(endTime - startTime);
        
      } catch (err) {
        results.push(-1); // エラーマーク
      }
      
      // 少し間隔を空ける
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const validResults = results.filter(time => time >= 0);
    const stats = {
      total: results.length,
      successful: validResults.length,
      failed: results.length - validResults.length,
      avgTime: validResults.length > 0 ? validResults.reduce((a, b) => a + b, 0) / validResults.length : 0,
      minTime: validResults.length > 0 ? Math.min(...validResults) : 0,
      maxTime: validResults.length > 0 ? Math.max(...validResults) : 0
    };
    
    console.log('パフォーマンス測定結果:', stats);
    return stats;
  }
}

// グローバルエクスポート
window.ProCon2Haptic = ProCon2Haptic;
