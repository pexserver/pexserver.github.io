/**
 * ProCon2Audio.js - Nintendo Switch ProController 2 オーディオ処理API
 * 音楽ファイルの読み込み、解析、再生を担当
 */

class ProCon2Audio {
  constructor() {
    this.audioContext = null;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.gainNode = null;
    
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    
    // 分析用データ
    this.frequencyData = null;
    this.timeData = null;
    
    // 設定
    this.volume = 0.7;
    this.headphoneOutput = false;
    
    // 初期化
    this.initializeAudioContext();
  }

  /**
   * Web Audio API初期化
   */
  initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // アナライザーノード作成
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.3;
      
      // ゲインノード作成
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.volume;
      
      // ノード接続
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      
      // 分析用配列初期化
      this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyserNode.frequencyBinCount);
      
      console.log('Audio Context 初期化完了');
    } catch (err) {
      console.error('Audio Context 初期化エラー:', err);
      throw new Error(`オーディオシステムの初期化に失敗しました: ${err.message}`);
    }
  }

  /**
   * オーディオファイル読み込み
   */
  async loadFile(file) {
    if (!file) {
      throw new Error('ファイルが指定されていません');
    }

    try {
      console.log('音楽ファイル読み込み開始:', file.name);
      
      // ファイルをArrayBufferに変換
      const arrayBuffer = await this.fileToArrayBuffer(file);
      
      // オーディオデータをデコード
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.duration = this.audioBuffer.duration;
      
      console.log(`音楽ファイル読み込み完了: ${file.name} (${this.duration.toFixed(2)}秒)`);
      
      return {
        success: true,
        fileName: file.name,
        duration: this.duration,
        sampleRate: this.audioBuffer.sampleRate,
        channels: this.audioBuffer.numberOfChannels,
        // UI互換性のためのfileInfo追加
        fileInfo: {
          name: file.name,
          duration: this.duration,
          extension: file.name.split('.').pop().toLowerCase(),
          size: file.size
        },
        // UI互換性のためのaudioBuffer情報追加
        audioBuffer: this.audioBuffer ? 'loaded' : null
      };
      
    } catch (err) {
      console.error('ファイル読み込みエラー:', err);
      throw new Error(`ファイルの読み込みに失敗しました: ${err.message}`);
    }
  }

  /**
   * FileをArrayBufferに変換
   */
  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        resolve(event.target.result);
      };
      
      reader.onerror = (event) => {
        reject(new Error('ファイル読み込みエラー'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 音楽再生
   */
  async play(startTime = 0) {
    if (!this.audioBuffer) {
      throw new Error('音楽ファイルが読み込まれていません');
    }

    try {
      // 既存の再生を停止
      this.stop();
      
      // AudioContextの状態確認
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // ソースノード作成
      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.buffer = this.audioBuffer;
      
      // ノード接続
      this.sourceNode.connect(this.analyserNode);
      
      // 再生終了時のイベント
      this.sourceNode.onended = () => {
        this.isPlaying = false;
        this.currentTime = 0;
        console.log('音楽再生終了');
      };
      
      // 再生開始
      this.sourceNode.start(0, startTime);
      this.isPlaying = true;
      this.currentTime = startTime;
      
      console.log('音楽再生開始');
      
      return { success: true, startTime };
      
    } catch (err) {
      console.error('再生エラー:', err);
      throw new Error(`音楽の再生に失敗しました: ${err.message}`);
    }
  }

  /**
   * 音楽停止
   */
  stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
        this.sourceNode = null;
      } catch (err) {
        console.warn('停止処理エラー:', err);
      }
    }
    
    this.isPlaying = false;
    this.currentTime = 0;
    console.log('音楽停止');
  }

  /**
   * 一時停止
   */
  pause() {
    if (this.isPlaying) {
      this.stop();
      console.log('音楽一時停止');
    }
  }

  /**
   * 音量設定
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
    console.log(`音量設定: ${Math.round(this.volume * 100)}%`);
  }

  /**
   * ヘッドフォン出力設定
   */
  setHeadphoneOutput(enabled) {
    this.headphoneOutput = enabled;
    console.log(`ヘッドフォン出力: ${enabled ? '有効' : '無効'}`);
    // 実際のヘッドフォン出力制御は、コントローラー側で実装
  }

  /**
   * 音楽解析データ取得
   */
  getAnalysisData() {
    if (!this.analyserNode || !this.isPlaying) {
      return {
        frequency: new Uint8Array(1024),
        time: new Uint8Array(1024),
        volume: 0,
        bass: 0,
        mid: 0,
        treble: 0
      };
    }

    // 周波数データ取得
    this.analyserNode.getByteFrequencyData(this.frequencyData);
    this.analyserNode.getByteTimeDomainData(this.timeData);

    // 音量レベル計算
    const volume = this.calculateVolume(this.timeData);
    
    // 周波数帯域別音量計算
    const bass = this.calculateBandVolume(this.frequencyData, 0, 85);     // 低音域
    const mid = this.calculateBandVolume(this.frequencyData, 85, 255);    // 中音域
    const treble = this.calculateBandVolume(this.frequencyData, 255, 1024); // 高音域

    return {
      frequency: this.frequencyData,
      time: this.timeData,
      volume,
      bass,
      mid,
      treble
    };
  }

  /**
   * 音量レベル計算
   */
  calculateVolume(timeData) {
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const sample = (timeData[i] - 128) / 128;
      sum += sample * sample;
    }
    return Math.sqrt(sum / timeData.length);
  }

  /**
   * 指定周波数帯域の音量計算
   */
  calculateBandVolume(frequencyData, startIndex, endIndex) {
    let sum = 0;
    const count = Math.min(endIndex, frequencyData.length) - startIndex;
    
    for (let i = startIndex; i < Math.min(endIndex, frequencyData.length); i++) {
      sum += frequencyData[i];
    }
    
    return count > 0 ? sum / count / 255 : 0;
  }

  /**
   * BPM（ビート・パー・ミニット）検出
   */
  detectBPM() {
    if (!this.audioBuffer) {
      return null;
    }

    try {
      // 簡易BPM検出アルゴリズム
      const channelData = this.audioBuffer.getChannelData(0);
      const sampleRate = this.audioBuffer.sampleRate;
      
      // ピーク検出
      const peaks = this.detectPeaks(channelData, sampleRate);
      
      // BPM計算
      const bpm = this.calculateBPMFromPeaks(peaks);
      
      console.log(`BPM検出完了: ${bpm}`);
      return bpm;
      
    } catch (err) {
      console.warn('BPM検出エラー:', err);
      return null;
    }
  }

  /**
   * ピーク検出
   */
  detectPeaks(channelData, sampleRate) {
    const peaks = [];
    const minPeakDistance = Math.floor(sampleRate * 0.1); // 最小ピーク間隔（100ms）
    const threshold = 0.3; // ピーク閾値
    
    for (let i = minPeakDistance; i < channelData.length - minPeakDistance; i++) {
      const current = Math.abs(channelData[i]);
      
      if (current > threshold) {
        let isPeak = true;
        
        // 周辺サンプルと比較
        for (let j = i - minPeakDistance; j < i + minPeakDistance; j++) {
          if (Math.abs(channelData[j]) > current) {
            isPeak = false;
            break;
          }
        }
        
        if (isPeak) {
          peaks.push(i / sampleRate); // 時間に変換
          i += minPeakDistance; // 次のピーク探索位置を進める
        }
      }
    }
    
    return peaks;
  }

  /**
   * ピークからBPM計算
   */
  calculateBPMFromPeaks(peaks) {
    if (peaks.length < 2) {
      return 120; // デフォルトBPM
    }

    // ピーク間隔の計算
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    // 平均間隔の計算
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // BPMに変換（60秒 / 平均間隔）
    const bpm = Math.round(60 / avgInterval);
    
    // 妥当な範囲に制限
    return Math.max(60, Math.min(200, bpm));
  }

  /**
   * オーディオシステム状態取得
   */
  getStatus() {
    return {
      initialized: !!this.audioContext,
      hasLoadedFile: !!this.audioBuffer,
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      headphoneOutput: this.headphoneOutput,
      audioContextState: this.audioContext?.state || 'unknown',
      sampleRate: this.audioContext?.sampleRate || 0
    };
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    try {
      this.stop();
      
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
      
      this.audioContext = null;
      this.audioBuffer = null;
      this.frequencyData = null;
      this.timeData = null;
      
      console.log('Audio システムクリーンアップ完了');
      
    } catch (err) {
      console.warn('Audio クリーンアップエラー:', err);
    }
  }
}

// グローバルエクスポート
window.ProCon2Audio = ProCon2Audio;
