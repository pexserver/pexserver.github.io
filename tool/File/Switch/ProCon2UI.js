/**
 * ProCon2UI.js - Nintendo Switch ProController 2 UI管理API
 * ユーザーインターフェースの制御、イベント処理、状態表示を担当
 */

class ProCon2UI {
  constructor(core, haptic, audio, music) {
    this.core = core;
    this.haptic = haptic;
    this.audio = audio;
    this.music = music;
    
    // UI要素
    this.elements = {};
    this.initialized = false;
    
    // 状態管理
    this.updateInterval = null;
    this.logHistory = [];
    this.maxLogHistory = 1000;
    
    // 開発者モード状態
    this.isDeveloperMode = false;
  }

  /**
   * UI初期化
   */
  initialize() {
    if (this.initialized) return;

    this.bindElements();
    this.setupEventListeners();
    this.setupDeviceListeners();
    this.setupDeveloperMode();
    this.addDebugStyles(); // デバッグ用スタイル追加
    this.startStatusUpdates();
    
    // 開発者モードが有効な場合はデバッグコントロールを追加
    if (this.isDeveloperMode) {
      this.addDebugControls();
    }
    
    this.initialized = true;
    this.log('ProCon2 UI初期化完了');
  }

  /**
   * 開発者モード設定
   */
  setupDeveloperMode() {
    // Always enable developer mode
    this.isDeveloperMode = true;
    localStorage.setItem('proCon2DevMode', 'true');
    
    // Add debug controls since we're always in developer mode
    this.addDebugControls();
    
    // Initialize with developer features
    this.updateDeveloperModeUI();
    this.log('開発者モード: 有効');
  }

  /**
   * 開発者モード切り替え
   */
  toggleDeveloperMode(enabled) {
    this.isDeveloperMode = enabled;
    
    // ローカルストレージに保存
    localStorage.setItem('proCon2DevMode', enabled.toString());
    
    // UI更新
    this.updateDeveloperModeUI();
    
    // ログ出力
    this.log(`開発者モード: ${enabled ? '有効' : '無効'}`);
    
    // 設定API連携（存在する場合）
    if (window.ProCon2Config) {
      try {
        const config = new window.ProCon2Config();
        config.set('developerMode', enabled);
      } catch (err) {
        console.warn('ProCon2Config設定エラー:', err);
      }
    }
  }

  /**
   * 開発者モードUI更新
   */
  updateDeveloperModeUI() {
    document.body.setAttribute('data-devmode', this.isDeveloperMode.toString());
    
    const devModeToggle = document.getElementById('devModeToggle');
    if (devModeToggle) {
      devModeToggle.checked = this.isDeveloperMode;
    }
  }

  /**
   * 開発者モード状態取得
   */
  getDeveloperMode() {
    return this.isDeveloperMode;
  }

  /**
   * DOM要素のバインド
   */
  bindElements() {
    this.elements = {
      // ログとステータス
      log: document.getElementById('log'),
      usbStatusIndicator: document.getElementById('usbStatusIndicator'),
      usbStatusText: document.getElementById('usbStatusText'),
      hidStatusIndicator: document.getElementById('hidStatusIndicator'),
      hidStatusText: document.getElementById('hidStatusText'),
      
      // 接続ボタン
      connectUsbBtn: document.getElementById('connectUsbBtn'),
      connectHidBtn: document.getElementById('connectHidBtn'),
      
      // 開発者モード
      devModeToggle: document.getElementById('devModeToggle'),
      
      // ハプティック制御
      playHapticBtn: document.getElementById('playHapticBtn'),
      stopHapticBtn: document.getElementById('stopHapticBtn'),
      hapticStatus: document.getElementById('hapticStatus'),
      intervalSlider: document.getElementById('intervalSlider'),
      intervalDisplay: document.getElementById('intervalDisplay'),
      
      // 音楽制御
      playMusicBtn: document.getElementById('playMusicBtn'),
      stopMusicBtn: document.getElementById('stopMusicBtn'),
      demoMusicBtn: document.getElementById('demoMusicBtn'),
      
      // ファイル管理
      musicFileInput: document.getElementById('musicFileInput'),
      fileInfo: document.getElementById('fileInfo'),
      musicVideo: document.getElementById('musicVideo'),
      dragDropArea: document.getElementById('dragDropArea'),
      
      // 設定スライダー
      intensitySlider: document.getElementById('intensitySlider'),
      intensityValue: document.getElementById('intensityValue'),
      speedSlider: document.getElementById('speedSlider'),
      speedValue: document.getElementById('speedValue'),
      bassBoostSlider: document.getElementById('bassBoostSlider'),
      bassBoostValue: document.getElementById('bassBoostValue'),
      
      // BPM制御
      bpmSlider: document.getElementById('bpmSlider'),
      bpmValue: document.getElementById('bpmValue'),
      bpmAutoDetectToggle: document.getElementById('bpmAutoDetectToggle'),
      bpmAutoDetectValue: document.getElementById('bpmAutoDetectValue'),
      
      // トグル
      highToneModeToggle: document.getElementById('highToneModeToggle'),
      highToneModeValue: document.getElementById('highToneModeValue'),
      headphoneOutputToggle: document.getElementById('headphoneOutputToggle'),
      headphoneOutputValue: document.getElementById('headphoneOutputValue')
    };

    // 初期値設定
    this.initializeSliders();
  }

  /**
   * スライダーの初期値設定
   */
  initializeSliders() {
    // ハプティック間隔
    if (this.elements.intervalSlider && this.elements.intervalDisplay) {
      this.elements.intervalSlider.value = 100;
      this.elements.intervalSlider.min = 75;
      this.elements.intervalSlider.max = 100;
      this.elements.intervalDisplay.textContent = '100ms';
    }

    // 音楽設定の初期値
    const settings = this.music.getSettings();
    
    if (this.elements.intensitySlider && this.elements.intensityValue) {
      this.elements.intensitySlider.value = settings.intensity;
      this.elements.intensityValue.textContent = `${settings.intensity}%`;
    }
    
    if (this.elements.speedSlider && this.elements.speedValue) {
      this.elements.speedSlider.value = settings.speed;
      this.elements.speedValue.textContent = `${settings.speed}%`;
    }
    
    if (this.elements.bassBoostSlider && this.elements.bassBoostValue) {
      this.elements.bassBoostSlider.value = settings.bassBoost;
      this.elements.bassBoostValue.textContent = `${settings.bassBoost}%`;
    }

    // BPM設定
    if (this.elements.bpmSlider && this.elements.bpmValue) {
      this.elements.bpmSlider.value = settings.bpm || 120;
      this.elements.bpmValue.textContent = settings.bpm || 120;
    }

    if (this.elements.bpmAutoDetectToggle && this.elements.bpmAutoDetectValue) {
      const autoDetectEnabled = settings.bpmAutoDetect !== false;
      this.elements.bpmAutoDetectToggle.checked = autoDetectEnabled;
      this.elements.bpmAutoDetectValue.textContent = autoDetectEnabled ? 'ON' : 'OFF';
      
      // BPMスライダーの有効/無効状態を設定
      if (this.elements.bpmSlider) {
        this.elements.bpmSlider.disabled = autoDetectEnabled;
        this.elements.bpmSlider.style.opacity = autoDetectEnabled ? '0.5' : '1';
      }
    }
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // 接続ボタン
    this.elements.connectUsbBtn?.addEventListener('click', () => this.handleUsbConnect());
    this.elements.connectHidBtn?.addEventListener('click', () => this.handleHidConnect());
    
    // ハプティック制御
    this.elements.playHapticBtn?.addEventListener('click', () => this.handleHapticPlay());
    this.elements.stopHapticBtn?.addEventListener('click', () => this.handleHapticStop());
    this.elements.intervalSlider?.addEventListener('input', (e) => this.handleIntervalChange(e));
    
    // 音楽制御
    this.elements.playMusicBtn?.addEventListener('click', () => this.handleMusicPlay());
    this.elements.stopMusicBtn?.addEventListener('click', () => this.handleMusicStop());
    this.elements.demoMusicBtn?.addEventListener('click', () => this.handleDemoPlay());
    
    // ファイル操作
    this.elements.musicFileInput?.addEventListener('change', (e) => this.handleFileSelect(e));
    this.setupDragAndDrop();
    
    // 設定スライダー
    this.elements.intensitySlider?.addEventListener('input', (e) => this.handleIntensityChange(e));
    this.elements.speedSlider?.addEventListener('input', (e) => this.handleSpeedChange(e));
    this.elements.bassBoostSlider?.addEventListener('input', (e) => this.handleBassBoostChange(e));
    this.elements.bpmSlider?.addEventListener('input', (e) => this.handleBpmChange(e));
    this.elements.bpmAutoDetectToggle?.addEventListener('change', (e) => this.handleBpmAutoDetectChange(e));
    this.elements.highToneModeToggle?.addEventListener('change', (e) => this.handleHighToneModeChange(e));
    this.elements.headphoneOutputToggle?.addEventListener('change', (e) => this.handleHeadphoneOutputChange(e));
  }

  /**
   * ドラッグ&ドロップの設定
   */
  setupDragAndDrop() {
    if (!this.elements.dragDropArea) return;

    this.elements.dragDropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.dragDropArea.classList.add('dragover');
    });

    this.elements.dragDropArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.elements.dragDropArea.classList.remove('dragover');
    });

    this.elements.dragDropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.dragDropArea.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        this.handleFileLoad(files[0]);
      }
    });

    this.elements.dragDropArea.addEventListener('click', () => {
      this.elements.musicFileInput?.click();
    });
  }

  /**
   * デバイス切断リスナーの設定
   */
  setupDeviceListeners() {
    if ('usb' in navigator) {
      navigator.usb.addEventListener('disconnect', (event) => {
        if (event.device === this.core.currentUsbDevice) {
          this.log('USB device disconnected');
          this.updateDeviceStatus();
        }
      });
    }

    if ('hid' in navigator) {
      navigator.hid.addEventListener('disconnect', (event) => {
        if (event.device === this.core.currentHidDevice) {
          this.log('HID device disconnected');
          this.updateDeviceStatus();
          this.handleDeviceDisconnection();
        }
      });
    }
  }

  /**
   * イベントハンドラー
   */
  async handleUsbConnect() {
    try {
      await this.core.connectUsb();
      this.log('USB接続成功');
      this.updateDeviceStatus();
    } catch (err) {
      this.log(`USB接続エラー: ${err.message}`);
    }
  }

  async handleHidConnect() {
    try {
      await this.core.connectHid();
      this.log('HID接続成功');
      this.updateDeviceStatus();
    } catch (err) {
      this.log(`HID接続エラー: ${err.message}`);
    }
  }

  async handleHapticPlay() {
    try {
      const result = await this.haptic.playPattern('test', {
        intervalMs: parseInt(this.elements.intervalSlider?.value || 100)
      });
      this.log(`ハプティック再生開始: ${result.patternName}`);
      this.updateButtonStates();
    } catch (err) {
      this.log(`ハプティック再生エラー: ${err.message}`);
    }
  }

  handleHapticStop() {
    this.haptic.stop();
    this.log('ハプティック再生停止');
    this.updateButtonStates();
  }

  async handleMusicPlay() {
    try {
      this.log('音楽再生開始...');
      
      // デバッグ情報（開発者モード時）
      if (this.isDeveloperMode) {
        const audioStatus = this.audio.getStatus();
        const deviceStatus = this.core.getDeviceStatus();
        this.debugLog('再生前ステータス', {
          audioStatus,
          deviceStatus,
          musicSettings: this.music.getSettings(),
          hasAudioBuffer: !!this.audio.loadedBuffer,
          pianoSynthReady: !!this.music.pianoSynth
        });
      }
      
      const result = await this.music.playFromFile({ mode: 'auto' });
      
      if (result && result.success) {
        const details = [];
        if (result.mode) details.push(`モード: ${result.mode}`);
        if (result.actualDuration) details.push(`実行時間: ${result.actualDuration.toFixed(2)}秒`);
        if (result.notesPlayed) details.push(`ノート数: ${result.notesPlayed}`);
        if (result.hapticPacketsSent) details.push(`ハプティック送信: ${result.hapticPacketsSent}`);
        if (result.errors > 0) details.push(`エラー: ${result.errors}`);
        if (result.stopRequested) details.push('途中停止');
        
        this.log(`音楽再生完了 (${details.join(', ')})`);
        
        if (this.isDeveloperMode) {
          this.debugLog('再生結果詳細', result);
        }
      } else {
        this.log('音楽再生が異常終了しました', 'warn', result);
      }
      
      this.updateButtonStates();
    } catch (err) {
      this.log(`音楽再生エラー: ${err.message}`, 'error', err);
      if (this.isDeveloperMode) {
        console.error('詳細エラー情報:', err);
        console.error('エラースタック:', err.stack);
      }
    }
  }

  handleMusicStop() {
    try {
      this.music.stop();
      this.log('音楽再生停止');
      this.updateButtonStates();
    } catch (err) {
      this.log(`音楽停止エラー: ${err.message}`, 'error');
    }
  }

  async handleDemoPlay() {
    try {
      const result = await this.music.playDemo({ mode: 'auto' });
      this.log(`デモ再生完了: ${result.notesPlayed}ノート`);
      this.updateButtonStates();
    } catch (err) {
      this.log(`デモ再生エラー: ${err.message}`);
    }
  }

  handleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (file) {
      this.handleFileLoad(file);
    }
  }

  async handleFileLoad(file) {
    this.updateFileInfo('ファイル読み込み中...', 'loading');

    try {
      this.log(`ファイル読み込み開始: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      
      const result = await this.audio.loadFile(file);
      this.updateFileInfo(`読み込み完了: ${result.fileInfo.name}`, 'success');
      
      // 動画プレビュー
      if (result.fileInfo.extension === 'mp4' && this.elements.musicVideo) {
        const url = URL.createObjectURL(file);
        this.elements.musicVideo.src = url;
        this.elements.musicVideo.style.display = 'block';
      }
      
      this.log(`ファイル読み込み成功: ${result.fileInfo.name} (${result.fileInfo.duration.toFixed(2)}秒)`);
      
      // 事前変換の開始
      this.updateFileInfo('ピアノデータに変換中...', 'loading');
      this.log('音楽データの事前変換を開始...');
      
      try {
        const convertedData = await this.music.processLoadedFile();
        this.updateFileInfo(`変換完了: ${convertedData.totalNotes}ノート生成`, 'success');
        this.log(`事前変換完了: ${convertedData.totalNotes}ノート, 効率: ${(convertedData.totalNotes / (convertedData.originalDuration * 20)).toFixed(1)}%`);
        
        // 開発者モード時の詳細情報
        if (this.isDeveloperMode) {
          this.debugLog('変換結果詳細', {
            totalNotes: convertedData.totalNotes,
            originalDuration: convertedData.originalDuration,
            convertedDuration: convertedData.duration,
            settings: convertedData.settings
          });
        }
        
      } catch (conversionErr) {
        this.updateFileInfo(`変換エラー: ${conversionErr.message}`, 'error');
        this.log(`事前変換エラー: ${conversionErr.message}`, 'error');
      }
      
      this.updateButtonStates();
      
      // 開発者モード時のデバッグ情報
      if (this.isDeveloperMode) {
        this.debugLog('ファイル読み込み詳細', {
          fileInfo: result.fileInfo,
          audioBuffer: result.audioBuffer ? '読み込み済み' : '未読み込み',
          audioStatus: this.audio.getStatus()
        });
      }
    } catch (err) {
      this.updateFileInfo(`読み込み失敗: ${err.message}`, 'error');
      this.log(`ファイル読み込みエラー: ${err.message}`, 'error', err);
    }
  }

  handleIntervalChange(event) {
    const value = parseInt(event.target.value);
    this.haptic.setInterval(value);
    if (this.elements.intervalDisplay) {
      this.elements.intervalDisplay.textContent = `${value}ms`;
    }
  }

  handleIntensityChange(event) {
    const value = parseInt(event.target.value);
    this.music.setIntensity(value);
    if (this.elements.intensityValue) {
      this.elements.intensityValue.textContent = `${value}%`;
    }
  }

  handleSpeedChange(event) {
    const value = parseInt(event.target.value);
    this.music.setSpeed(value);
    if (this.elements.speedValue) {
      this.elements.speedValue.textContent = `${value}%`;
    }
  }

  handleBassBoostChange(event) {
    const value = parseInt(event.target.value);
    this.music.setBassBoost(value);
    if (this.elements.bassBoostValue) {
      this.elements.bassBoostValue.textContent = `${value}%`;
    }
  }

  handleHighToneModeChange(event) {
    const enabled = event.target.checked;
    this.music.setHighToneMode(enabled);
    if (this.elements.highToneModeValue) {
      this.elements.highToneModeValue.textContent = enabled ? 'ON' : 'OFF';
    }
    this.log(`高音モード: ${enabled ? 'ON' : 'OFF'}`);
  }

  handleHeadphoneOutputChange(event) {
    const enabled = event.target.checked;
    this.music.setHeadphoneOutput(enabled);
    if (this.elements.headphoneOutputValue) {
      this.elements.headphoneOutputValue.textContent = enabled ? 'ON' : 'OFF';
    }
    this.log(`ヘッドホン出力: ${enabled ? 'ON' : 'OFF'}`);
  }

  handleBpmChange(event) {
    const bpm = parseInt(event.target.value);
    this.music.setBpm(bpm);
    if (this.elements.bpmValue) {
      this.elements.bpmValue.textContent = bpm;
    }
    this.log(`BPM設定: ${bpm}`);
  }

  handleBpmAutoDetectChange(event) {
    const enabled = event.target.checked;
    this.music.setBpmAutoDetect(enabled);
    if (this.elements.bpmAutoDetectValue) {
      this.elements.bpmAutoDetectValue.textContent = enabled ? 'ON' : 'OFF';
    }
    
    // BPMスライダーの有効/無効切り替え
    if (this.elements.bpmSlider) {
      this.elements.bpmSlider.disabled = enabled;
      this.elements.bpmSlider.style.opacity = enabled ? '0.5' : '1';
    }
    
    this.log(`BPM自動検出: ${enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * UI更新メソッド
   */
  updateDeviceStatus() {
    const status = this.core.getDeviceStatus();
    
    // USB状態
    if (this.elements.usbStatusIndicator && this.elements.usbStatusText) {
      if (status.usbConnected) {
        this.elements.usbStatusIndicator.classList.add('connected');
        this.elements.usbStatusText.textContent = 'USB: Connected';
      } else {
        this.elements.usbStatusIndicator.classList.remove('connected');
        this.elements.usbStatusText.textContent = 'USB: Disconnected';
      }
    }
    
    // HID状態
    if (this.elements.hidStatusIndicator && this.elements.hidStatusText) {
      if (status.hidConnected) {
        this.elements.hidStatusIndicator.classList.add('connected');
        this.elements.hidStatusText.textContent = 'HID: Connected';
      } else {
        this.elements.hidStatusIndicator.classList.remove('connected');
        this.elements.hidStatusText.textContent = 'HID: Disconnected';
      }
    }

    this.updateButtonStates();
  }

  updateButtonStates() {
    const deviceStatus = this.core.getDeviceStatus();
    const hapticStatus = this.haptic.getStatus();
    const musicStatus = this.music.getStatus();
    const audioStatus = this.audio.getStatus();

    // ハプティックボタン
    if (this.elements.playHapticBtn) {
      this.elements.playHapticBtn.disabled = !deviceStatus.hidConnected || hapticStatus.isPlaying;
    }
    if (this.elements.stopHapticBtn) {
      this.elements.stopHapticBtn.disabled = !deviceStatus.hidConnected || !hapticStatus.isPlaying;
    }

    // 音楽ボタン
    if (this.elements.playMusicBtn) {
      this.elements.playMusicBtn.disabled = !audioStatus.hasLoadedFile || musicStatus.isPlaying;
    }
    if (this.elements.stopMusicBtn) {
      this.elements.stopMusicBtn.disabled = !musicStatus.isPlaying;
    }
    if (this.elements.demoMusicBtn) {
      this.elements.demoMusicBtn.disabled = musicStatus.isPlaying;
    }
  }

  updateFileInfo(text, className = '') {
    if (this.elements.fileInfo) {
      this.elements.fileInfo.textContent = text;
      this.elements.fileInfo.className = `file-info ${className}`;
    }
  }

  updateHapticStatus(text) {
    if (this.elements.hapticStatus) {
      this.elements.hapticStatus.textContent = text;
    }
  }

  /**
   * 定期的なステータス更新
   */
  startStatusUpdates() {
    this.updateInterval = setInterval(() => {
      this.updateDeviceStatus();
      
      // ハプティック状態更新
      const hapticStatus = this.haptic.getStatus();
      if (hapticStatus.isPlaying) {
        this.updateHapticStatus(`再生中: ${hapticStatus.currentIndex}/${hapticStatus.totalPackets}`);
      }
    }, 500);
  }

  /**
   * ログ管理・出力（開発者モード対応）
   */
  log(message, level, details) {
    level = level || 'info';
    const timestamp = new Date().toLocaleTimeString();
    let logMessage = `[${timestamp}] ${message}`;
    
    // 開発者モードの場合、詳細情報を追加
    if (this.isDeveloperMode && details) {
      logMessage += `\n詳細: ${JSON.stringify(details, null, 2)}`;
    }
    
    // コンソールログ（開発者モード時は詳細レベル）
    if (this.isDeveloperMode) {
      switch (level) {
        case 'error':
          console.error(logMessage, details || '');
          break;
        case 'warn':
          console.warn(logMessage, details || '');
          break;
        case 'debug':
          console.debug(logMessage, details || '');
          break;
        default:
          console.log(logMessage, details || '');
      }
    }
    
    this.logHistory.push(logMessage);
    if (this.logHistory.length > this.maxLogHistory) {
      this.logHistory.shift();
    }

    if (this.elements.log) {
      this.elements.log.textContent += logMessage + '\n';
      this.elements.log.scrollTop = this.elements.log.scrollHeight;
    }
  }

  /**
   * 開発者モード専用ログ
   */
  debugLog(message, data) {
    if (this.isDeveloperMode) {
      this.log(`[DEBUG] ${message}`, 'debug', data);
    }
  }

  clearLog() {
    this.logHistory = [];
    if (this.elements.log) {
      this.elements.log.textContent = '';
    }
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.initialized = false;
  }

  /**
   * デバッグ情報表示
   */
  showDebugInfo() {
    const info = {
      device: this.core.getDeviceStatus(),
      haptic: this.haptic.getStatus(),
      audio: this.audio.getStatus(),
      music: this.music.getStatus(),
      ui: {
        isDeveloperMode: this.isDeveloperMode,
        elementsLoaded: Object.keys(this.elements).length,
        updateInterval: this.updateInterval !== null
      }
    };

    this.log('=== デバッグ情報 ===');
    this.log(JSON.stringify(info, null, 2));
    this.log('==================');

    // 音楽再生に関する詳細情報
    if (this.isDeveloperMode) {
      this.log('=== 音楽再生詳細チェック ===');
      
      // オーディオバッファーの状態
      const audioBuffer = this.audio.loadedBuffer;
      if (audioBuffer) {
        this.debugLog('オーディオバッファー', {
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
          length: audioBuffer.length
        });
      } else {
        this.log('オーディオバッファーが読み込まれていません', 'warn');
      }
      
      // 音楽設定の確認
      this.debugLog('音楽設定', this.music.getSettings());
      
      // デバイス状態の詳細
      this.debugLog('デバイス詳細状態', {
        core: this.core.getDeviceStatus(),
        hapticReady: this.haptic.isReady(),
        webAudioReady: this.music.pianoSynth !== null
      });
      
      this.log('==========================');
    }

    return info;
  }

  /**
   * handheldlegend/procon2tool準拠のテスト機能
   */
  async testHapticConnection() {
    if (!this.core.getDeviceStatus().hidConnected) {
      this.log('HIDデバイスが接続されていません');
      return false;
    }

    try {
      this.log('ハプティック接続テスト開始...');
      
      // 簡単なテストパターンで接続確認
      await this.haptic.playPattern('simple', { intervalMs: 4 });
      
      this.log('ハプティック接続テスト成功');
      return true;
    } catch (err) {
      this.log(`ハプティック接続テストエラー: ${err.message}`);
      return false;
    }
  }

  /**
   * デバッグパネル関連の機能
   */
  
  /**
   * 診断情報の表示
   */
  showDiagnostics() {
    if (!this.haptic) return;
    
    const diagnostics = this.haptic.getDiagnostics();
    const infoDiv = document.getElementById('deviceInfo');
    
    if (infoDiv) {
      infoDiv.innerHTML = `
        <h3>🔧 診断情報</h3>
        <div class="diagnostics-section">
          <h4>ハプティック状態</h4>
          <pre>${JSON.stringify(diagnostics.haptic, null, 2)}</pre>
        </div>
        <div class="diagnostics-section">
          <h4>デバイス状態</h4>
          <pre>${JSON.stringify(diagnostics.device, null, 2)}</pre>
        </div>
        <div class="diagnostics-section">
          <h4>システム情報</h4>
          <pre>${JSON.stringify(diagnostics.system, null, 2)}</pre>
        </div>
      `;
    }
    
    this.log('診断情報を表示しました', diagnostics);
  }

  /**
   * 接続テストの実行
   */
  async runConnectionTest() {
    if (!this.haptic) {
      this.log('エラー: ハプティックシステムが初期化されていません', 'error');
      return;
    }
    
    try {
      this.log('接続テストを開始します...');
      const result = await this.haptic.runConnectionTest();
      
      if (result.success) {
        this.log('✅ 接続テスト成功', 'success');
      } else {
        this.log(`❌ 接続テスト失敗: ${result.error}`, 'error');
      }
      
      // 結果をUIに表示
      this.showDiagnostics();
      
    } catch (err) {
      this.log(`接続テストエラー: ${err.message}`, 'error');
    }
  }

  /**
   * パフォーマンス測定の実行
   */
  async runPerformanceTest() {
    if (!this.haptic) {
      this.log('エラー: ハプティックシステムが初期化されていません', 'error');
      return;
    }
    
    try {
      this.log('パフォーマンス測定を開始します...');
      const stats = await this.haptic.measurePerformance(30);
      
      this.log(`📊 パフォーマンス測定結果:
        成功: ${stats.successful}/${stats.total}
        平均時間: ${stats.avgTime.toFixed(2)}ms
        最小時間: ${stats.minTime.toFixed(2)}ms
        最大時間: ${stats.maxTime.toFixed(2)}ms`, 'info');
        
    } catch (err) {
      this.log(`パフォーマンス測定エラー: ${err.message}`, 'error');
    }
  }

  /**
   * デバッグコントロールパネルの追加
   */
  addDebugControls() {
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debugPanel';
    debugPanel.className = 'debug-panel';
    debugPanel.innerHTML = `
      <h3>🛠️ デバッグコントロール</h3>
      <div class="debug-buttons">
        <button id="btnShowDiagnostics" class="debug-btn">📋 診断情報</button>
        <button id="btnConnectionTest" class="debug-btn">🔗 接続テスト</button>
        <button id="btnPerformanceTest" class="debug-btn">⚡ パフォーマンス</button>
        <button id="btnClearLog" class="debug-btn">🗑️ ログクリア</button>
      </div>
      <div class="debug-options">
        <label>
          <input type="checkbox" id="verboseLogging"> 詳細ログ
        </label>
        <label>
          <input type="number" id="chunkSize" min="50" max="500" value="150" style="width: 80px;"> チャンクサイズ
        </label>
      </div>
    `;
    
    // 既存のコントロールパネルの後に追加
    const controlPanel = document.getElementById('controlPanel');
    if (controlPanel && controlPanel.parentNode) {
      controlPanel.parentNode.insertBefore(debugPanel, controlPanel.nextSibling);
    }
    
    // イベントリスナーを設定
    document.getElementById('btnShowDiagnostics')?.addEventListener('click', () => this.showDiagnostics());
    document.getElementById('btnConnectionTest')?.addEventListener('click', () => this.runConnectionTest());
    document.getElementById('btnPerformanceTest')?.addEventListener('click', () => this.runPerformanceTest());
    document.getElementById('btnClearLog')?.addEventListener('click', () => this.clearLog());
    
    this.log('デバッグコントロールパネルを追加しました');
  }

  /**
   * デバッグパネル用のスタイルを追加
   */
  addDebugStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .debug-panel {
        background: #1a1a1a;
        border: 2px solid #333;
        border-radius: 8px;
        padding: 15px;
        margin: 10px 0;
        font-family: 'Courier New', monospace;
      }
      
      .debug-panel h3 {
        color: #00ff88;
        margin-top: 0;
        border-bottom: 1px solid #333;
        padding-bottom: 8px;
      }
      
      .debug-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 10px 0;
      }
      
      .debug-btn {
        background: #2a2a2a;
        color: #00ff88;
        border: 1px solid #00ff88;
        border-radius: 4px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      }
      
      .debug-btn:hover {
        background: #00ff88;
        color: #1a1a1a;
      }
      
      .debug-options {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        margin-top: 10px;
        font-size: 12px;
      }
      
      .debug-options label {
        color: #ccc;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .debug-options input[type="checkbox"] {
        accent-color: #00ff88;
      }
      
      .debug-options input[type="number"] {
        background: #2a2a2a;
        color: #00ff88;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 2px 6px;
      }
      
      .diagnostics-section {
        margin: 15px 0;
        padding: 10px;
        background: #0a0a0a;
        border-radius: 4px;
        border-left: 3px solid #00ff88;
      }
      
      .diagnostics-section h4 {
        color: #00ff88;
        margin: 0 0 8px 0;
        font-size: 14px;
      }
      
      .diagnostics-section pre {
        color: #ccc;
        font-size: 11px;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }
    `;
    
    document.head.appendChild(style);
  }
}

// グローバルエクスポート
window.ProCon2UI = ProCon2UI;
