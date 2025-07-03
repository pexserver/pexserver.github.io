/**
 * ProCon2Main.js - Nintendo Switch ProController 2 メインAPI
 * 全コンポーネントの統合管理とアプリケーション初期化
 */

class ProCon2Main {
  constructor() {
    this.core = null;
    this.haptic = null;
    this.audio = null;
    this.music = null;
    this.ui = null;
    
    this.initialized = false;
    this.initializationError = null;
  }

  /**
   * アプリケーション初期化
   */
  async initialize() {
    if (this.initialized) {
      return this.getAPI();
    }

    try {
      console.log('ProCon2 システム初期化開始...');

      // コアAPI初期化
      this.core = new ProCon2Core();
      console.log('✓ CoreAPI初期化完了');

      // ハプティックAPI初期化
      this.haptic = new ProCon2Haptic(this.core);
      console.log('✓ HapticAPI初期化完了');

      // オーディオAPI初期化
      this.audio = new ProCon2Audio();
      console.log('✓ AudioAPI初期化完了');

      // 音楽API初期化
      this.music = new ProCon2Music(this.core, this.haptic, this.audio);
      console.log('✓ MusicAPI初期化完了');

      // UI API初期化
      this.ui = new ProCon2UI(this.core, this.haptic, this.audio, this.music);
      this.ui.initialize();
      console.log('✓ UI API初期化完了');

      this.initialized = true;
      console.log('🎮 ProCon2 システム初期化完了');

      // 初期化完了をUIに通知
      this.ui.log('ProCon2 システム初期化完了');
      this.ui.log('Nintendo Switch Pro Controller 2に接続してください');

      return this.getAPI();

    } catch (err) {
      this.initializationError = err;
      console.error('ProCon2 初期化エラー:', err);
      throw err;
    }
  }

  /**
   * 統合APIオブジェクト取得
   */
  getAPI() {
    if (!this.initialized) {
      throw new Error('ProCon2が初期化されていません');
    }

    return {
      // コンポーネントアクセス
      core: this.core,
      haptic: this.haptic,
      audio: this.audio,
      music: this.music,
      ui: this.ui,

      // 便利メソッド
      connect: () => this.core.connect(),
      connectUSB: () => this.core.connectUsb(),
      connectHID: () => this.core.connectHid(),
      disconnect: () => this.core.disconnect(),
      
      playHaptic: (pattern = 'test', options = {}) => this.haptic.playPattern(pattern, options),
      stopHaptic: () => this.haptic.stop(),
      
      loadAudioFile: (file) => this.audio.loadFile(file),
      playMusic: (options = {}) => this.music.playFromFile(options),
      playDemo: (options = {}) => this.music.playDemo(options),
      stopMusic: () => this.music.stop(),
      testConnection: () => this.music.testHapticConnection(),
      showVolumePreview: () => this.music.showVolumePreview(),
      
      log: (message) => this.ui.log(message),
      getStatus: () => this.getSystemStatus(),
      showDebug: () => this.ui.showDebugInfo(),
      
      // 設定（シンプル化）
      settings: {
        setIntensity: (value) => this.music.setIntensity(value),
        setVolumeSensitivity: (value) => this.music.setVolumeSensitivity(value),
        setHeadphoneOutput: (enabled) => this.music.setHeadphoneOutput(enabled),
        setSmoothing: (value) => this.music.setSmoothing(value),
        setHapticInterval: (ms) => this.haptic.setInterval(ms)
      }
    };
  }

  /**
   * システム全体の状態取得
   */
  getSystemStatus() {
    if (!this.initialized) {
      return { 
        initialized: false, 
        error: this.initializationError?.message || null 
      };
    }

    return {
      initialized: true,
      device: this.core.getDeviceStatus(),
      haptic: this.haptic.getStatus(),
      audio: this.audio.getStatus(),
      music: this.music.getStatus(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 緊急停止（すべての動作を停止）
   */
  emergencyStop() {
    try {
      if (this.haptic?.isPlaying) {
        this.haptic.stop();
      }
      if (this.music?.isPlayingMusic()) {
        this.music.stop();
      }
      this.ui?.log('緊急停止実行');
    } catch (err) {
      console.error('緊急停止エラー:', err);
    }
  }

  /**
   * システム全体のクリーンアップ
   */
  async cleanup() {
    try {
      this.emergencyStop();
      
      if (this.ui) {
        this.ui.cleanup();
        this.ui = null;
      }
      
      if (this.music) {
        this.music.cleanup();
        this.music = null;
      }
      
      if (this.audio) {
        this.audio.cleanup();
        this.audio = null;
      }
      
      if (this.haptic) {
        this.haptic = null;
      }
      
      if (this.core) {
        await this.core.disconnect();
        this.core = null;
      }
      
      this.initialized = false;
      console.log('ProCon2 システムクリーンアップ完了');
      
    } catch (err) {
      console.error('クリーンアップエラー:', err);
    }
  }

  /**
   * 詳細システム診断
   */
  runDetailedDiagnostics() {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      systemStatus: 'checking',
      components: {},
      errors: [],
      warnings: []
    };

    try {
      // 初期化状態チェック
      diagnostics.components.initialized = this.initialized;
      
      // 各コンポーネントの存在確認
      diagnostics.components.core = !!this.core;
      diagnostics.components.haptic = !!this.haptic;
      diagnostics.components.audio = !!this.audio;
      diagnostics.components.music = !!this.music;
      diagnostics.components.ui = !!this.ui;
      
      // APIメソッドの存在確認
      const apiMethods = [
        'connect', 'connectUSB', 'connectHID', 'disconnect',
        'loadAudioFile', 'playMusic', 'stopMusic', 'playDemo',
        'playHaptic', 'stopHaptic', 'testConnection'
      ];
      
      const api = this.getAPI();
      diagnostics.components.apiMethods = {};
      
      for (const method of apiMethods) {
        const exists = typeof api[method] === 'function';
        diagnostics.components.apiMethods[method] = exists;
        if (!exists) {
          diagnostics.errors.push(`APIメソッド ${method} が存在しません`);
        }
      }
      
      // ブラウザサポートチェック
      diagnostics.components.browserSupport = {
        webUSB: 'usb' in navigator,
        webHID: 'hid' in navigator,
        webAudio: !!(window.AudioContext || window.webkitAudioContext),
        fileAPI: !!(window.File && window.FileReader && window.FileList && window.Blob)
      };
      
      // サポートされていない機能の警告
      if (!diagnostics.components.browserSupport.webUSB) {
        diagnostics.warnings.push('WebUSB APIがサポートされていません');
      }
      if (!diagnostics.components.browserSupport.webHID) {
        diagnostics.warnings.push('WebHID APIがサポートされていません');
      }
      if (!diagnostics.components.browserSupport.webAudio) {
        diagnostics.errors.push('Web Audio APIがサポートされていません');
      }
      
      // デバイス状態チェック（初期化済みの場合）
      if (this.initialized && this.core) {
        try {
          diagnostics.components.deviceStatus = this.core.getDeviceStatus();
        } catch (err) {
          diagnostics.errors.push(`デバイス状態取得エラー: ${err.message}`);
        }
      }
      
      // 全体的なシステム状態判定
      const hasErrors = diagnostics.errors.length > 0;
      const hasCriticalWarnings = diagnostics.warnings.some(w => 
        w.includes('WebHID') || w.includes('WebUSB')
      );
      
      if (hasErrors) {
        diagnostics.systemStatus = 'error';
      } else if (hasCriticalWarnings) {
        diagnostics.systemStatus = 'warning';
      } else {
        diagnostics.systemStatus = 'healthy';
      }
      
      console.log('=== ProCon2 詳細診断結果 ===');
      console.log('システム状態:', diagnostics.systemStatus);
      console.log('コンポーネント:', diagnostics.components);
      if (diagnostics.errors.length > 0) {
        console.error('エラー:', diagnostics.errors);
      }
      if (diagnostics.warnings.length > 0) {
        console.warn('警告:', diagnostics.warnings);
      }
      
      return diagnostics;
      
    } catch (err) {
      diagnostics.systemStatus = 'critical';
      diagnostics.errors.push(`診断実行エラー: ${err.message}`);
      console.error('診断実行エラー:', err);
      return diagnostics;
    }
  }

  /**
   * バージョン情報
   */
  getVersion() {
    return {
      version: '2.0.0',
      codeName: 'Modular Architecture',
      build: new Date().toISOString().split('T')[0],
      components: {
        core: 'ProCon2Core v1.0.0',
        haptic: 'ProCon2Haptic v1.0.0',
        audio: 'ProCon2Audio v1.0.0',
        music: 'ProCon2Music v2.0.0',
        ui: 'ProCon2UI v1.0.0'
      }
    };
  }

  /**
   * シンプル音楽再生テスト（開発者向け）
   */
  async testSimpleMusicPlayback() {
    try {
      console.log('=== シンプル音楽再生テスト開始 ===');
      
      // 1. システム状態確認
      const status = this.getSystemStatus();
      console.log('システム状態:', status);
      
      if (!status.initialized) {
        throw new Error('システムが初期化されていません');
      }
      
      // 2. デバイス接続確認
      if (!status.device.hidConnected) {
        throw new Error('Nintendo Switch Pro Controllerが接続されていません');
      }
      
      // 3. オーディオファイル確認
      if (!status.audio.hasLoadedFile) {
        throw new Error('音楽ファイルが読み込まれていません');
      }
      
      // 4. ハプティック接続テスト
      console.log('ハプティック接続テスト中...');
      await this.music.testHapticConnection();
      console.log('✓ ハプティック接続OK');
      
      // 5. 音量プレビュー表示
      console.log('音量データ解析中...');
      const preview = await this.music.showVolumePreview();
      console.log('✓ 音量データ解析完了');
      
      // 6. 実際の音楽再生
      console.log('音楽再生開始...');
      const result = await this.music.playFromFile({ mode: 'haptic' });
      console.log('✓ 音楽再生完了:', result);
      
      console.log('=== シンプル音楽再生テスト成功 ===');
      return { success: true, result, preview };
      
    } catch (error) {
      console.error('=== シンプル音楽再生テスト失敗 ===');
      console.error(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 段階的テスト（初心者向け）
   */
  async runStepByStepTest() {
    console.log('=== 段階的テスト開始 ===');
    
    const steps = [
      {
        name: 'システム初期化確認',
        test: () => this.initialized,
        fix: '画面をリフレッシュしてください'
      },
      {
        name: 'デバイス接続確認',
        test: () => this.core.getDeviceStatus().hidConnected,
        fix: 'Nintendo Switch Pro Controllerを接続してください'
      },
      {
        name: 'オーディオファイル確認',
        test: () => this.audio.getStatus().hasLoadedFile,
        fix: 'MP4音楽ファイルを読み込んでください'
      }
    ];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`ステップ ${i+1}: ${step.name}`);
      
      if (step.test()) {
        console.log(`✓ ${step.name} - 成功`);
      } else {
        console.log(`✗ ${step.name} - 失敗`);
        console.log(`対処法: ${step.fix}`);
        return { success: false, failedStep: i + 1, stepName: step.name, fix: step.fix };
      }
    }
    
    console.log('すべてのステップが成功しました！音楽再生が可能です。');
    return { success: true, message: '音楽再生準備完了' };
  }
}

// グローバル初期化関数
window.initializeProCon2 = async () => {
  if (window.proCon2Main) {
    return window.proCon2Main.getAPI();
  }

  window.proCon2Main = new ProCon2Main();
  const api = await window.proCon2Main.initialize();
  
  // デバッグ用にグローバルに公開
  window.proCon2API = api;
  
  return api;
};

// 自動初期化（DOMContentLoaded時）
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 必要なクラスが読み込まれるまで待機
    let attempts = 0;
    const maxAttempts = 50; // 5秒まで待機
    
    while (attempts < maxAttempts) {
      if (window.ProCon2Core && window.ProCon2Haptic && 
          window.ProCon2Audio && window.ProCon2Music && window.ProCon2UI) {
        console.log('✓ 必要なコンポーネント読み込み完了');
        break;
      }
      
      // デバッグ情報
      if (attempts % 10 === 0) {
        console.log('コンポーネント読み込み待機中...', {
          ProCon2Core: !!window.ProCon2Core,
          ProCon2Haptic: !!window.ProCon2Haptic,
          ProCon2Audio: !!window.ProCon2Audio,
          ProCon2Music: !!window.ProCon2Music,
          ProCon2UI: !!window.ProCon2UI,
          attempt: attempts
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('必要なコンポーネントの読み込みに失敗しました');
    }

    // ProCon2システム初期化
    await window.initializeProCon2();
    
  } catch (err) {
    console.error('ProCon2自動初期化エラー:', err);
    // エラーをUIに表示（可能であれば）
    const logElement = document.getElementById('log');
    if (logElement) {
      logElement.textContent += `[エラー] 初期化失敗: ${err.message}\n`;
    }
  }
});

// ページ終了時のクリーンアップ
window.addEventListener('beforeunload', () => {
  if (window.proCon2Main) {
    window.proCon2Main.cleanup();
  }
});

// グローバルエクスポート
window.ProCon2Main = ProCon2Main;

// 開発者向け簡単テスト関数（グローバル）
window.testSimpleMusic = async function() {
  if (!window.proCon2Main) {
    console.error('ProCon2システムが初期化されていません');
    return;
  }
  
  return await window.proCon2Main.testSimpleMusicPlayback();
};

window.checkSteps = async function() {
  if (!window.proCon2Main) {
    console.error('ProCon2システムが初期化されていません');
    return;
  }
  
  return await window.proCon2Main.runStepByStepTest();
};

window.quickDemo = async function() {
  if (!window.proCon2API) {
    console.error('ProCon2システムが初期化されていません');
    return;
  }
  
  try {
    console.log('クイックデモ開始...');
    const result = await window.proCon2API.playDemo();
    console.log('クイックデモ完了:', result);
    return result;
  } catch (error) {
    console.error('クイックデモエラー:', error);
    return { success: false, error: error.message };
  }
};

// 詳細診断機能（グローバル）
window.runDiagnostics = function() {
  if (!window.proCon2Main) {
    console.error('ProCon2 Main が初期化されていません');
    return { 
      systemStatus: 'critical', 
      errors: ['ProCon2 Main 未初期化'],
      timestamp: new Date().toISOString()
    };
  }
  
  return window.proCon2Main.runDetailedDiagnostics();
};

// システム情報取得（グローバル）
window.getSystemInfo = function() {
  console.log('=== ProCon2 システム情報 ===');
  
  if (window.proCon2Main) {
    console.log('バージョン情報:', window.proCon2Main.getVersion());
    console.log('ヘルスチェック:', window.proCon2Main.healthCheck());
    if (window.proCon2API) {
      console.log('システム状態:', window.proCon2API.getStatus());
    }
  } else {
    console.log('ProCon2 Main: 未初期化');
  }
  
  console.log('ブラウザサポート:', {
    webUSB: 'usb' in navigator,
    webHID: 'hid' in navigator,
    webAudio: !!(window.AudioContext || window.webkitAudioContext)
  });
};

// 簡易エラー診断
window.quickErrorCheck = function() {
  console.log('=== 簡易エラーチェック ===');
  
  const issues = [];
  
  // 基本的なAPIの存在確認
  if (!window.proCon2Main) issues.push('❌ ProCon2Main が未初期化');
  if (!window.proCon2API) issues.push('❌ ProCon2API が未初期化');
  
  // ブラウザサポート確認
  if (!('usb' in navigator)) issues.push('❌ WebUSB API サポートなし');
  if (!('hid' in navigator)) issues.push('❌ WebHID API サポートなし');
  if (!(window.AudioContext || window.webkitAudioContext)) issues.push('❌ Web Audio API サポートなし');
  
  if (issues.length === 0) {
    console.log('✅ 基本的な問題は見つかりませんでした');
    if (window.proCon2API) {
      console.log('💡 次のステップ: コントローラーを接続してください');
    }
  } else {
    console.log('発見された問題:');
    issues.forEach(issue => console.log(issue));
  }
  
  return issues;
};
