/**
 * ProCon2Config.js - Nintendo Switch ProController 2 設定管理API
 * アプリケーション設定の保存、読み込み、管理を担当
 */

class ProCon2Config {
  constructor() {
    this.storageKey = 'procon2_settings';
    this.defaultSettings = {
      // 音楽設定
      music: {
        intensity: 100,
        speed: 100,
        bassBoost: 100,
        highToneMode: false,
        windowSec: 1.0,
        stepSec: 0.4
      },
      
      // ハプティック設定
      haptic: {
        intervalMs: 100,
        maxRetries: 3,
        timeoutMs: 30000
      },
      
      // オーディオ設定
      audio: {
        analysisPreset: 'balanced' // fast, balanced, detailed, precise
      },
      
      // UI設定
      ui: {
        autoConnect: false,
        showDebugInfo: false,
        logLevel: 'info' // debug, info, warn, error
      },
      
      // デバイス設定
      device: {
        autoReconnect: true,
        connectionTimeout: 10000
      }
    };
    
    this.currentSettings = this.loadSettings();
  }

  /**
   * 設定の読み込み
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return this.mergeSettings(this.defaultSettings, parsed);
      }
    } catch (err) {
      console.warn('設定読み込みエラー:', err);
    }
    
    return this.deepClone(this.defaultSettings);
  }

  /**
   * 設定の保存
   */
  saveSettings(settings = null) {
    try {
      const toSave = settings || this.currentSettings;
      localStorage.setItem(this.storageKey, JSON.stringify(toSave));
      return true;
    } catch (err) {
      console.error('設定保存エラー:', err);
      return false;
    }
  }

  /**
   * 設定の取得
   */
  get(path) {
    const keys = path.split('.');
    let value = this.currentSettings;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * 設定の更新
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.currentSettings;
    
    // パスを辿って対象オブジェクトまで移動
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    target[lastKey] = value;
    this.saveSettings();
    
    return true;
  }

  /**
   * 設定のリセット
   */
  reset(section = null) {
    if (section) {
      this.currentSettings[section] = this.deepClone(this.defaultSettings[section]);
    } else {
      this.currentSettings = this.deepClone(this.defaultSettings);
    }
    
    this.saveSettings();
    return true;
  }

  /**
   * 全設定の取得
   */
  getAll() {
    return this.deepClone(this.currentSettings);
  }

  /**
   * 設定の一括更新
   */
  updateAll(settings) {
    this.currentSettings = this.mergeSettings(this.currentSettings, settings);
    this.saveSettings();
    return true;
  }

  /**
   * 設定の検証
   */
  validate(settings = null) {
    const toValidate = settings || this.currentSettings;
    const errors = [];

    // 音楽設定の検証
    const music = toValidate.music;
    if (music) {
      if (music.intensity < 10 || music.intensity > 200) {
        errors.push('音楽強度は10-200%の範囲で設定してください');
      }
      if (music.speed < 50 || music.speed > 200) {
        errors.push('再生速度は50-200%の範囲で設定してください');
      }
      if (music.windowSec < 0.1 || music.windowSec > 3.0) {
        errors.push('解析ウィンドウは0.1-3.0秒の範囲で設定してください');
      }
    }

    // ハプティック設定の検証
    const haptic = toValidate.haptic;
    if (haptic) {
      if (haptic.intervalMs < 50 || haptic.intervalMs > 1000) {
        errors.push('ハプティック間隔は50-1000msの範囲で設定してください');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 設定のエクスポート
   */
  export() {
    return {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      settings: this.getAll()
    };
  }

  /**
   * 設定のインポート
   */
  import(data) {
    try {
      if (!data.settings) {
        throw new Error('無効な設定データです');
      }

      const validation = this.validate(data.settings);
      if (!validation.valid) {
        throw new Error(`設定検証エラー: ${validation.errors.join(', ')}`);
      }

      this.currentSettings = this.mergeSettings(this.defaultSettings, data.settings);
      this.saveSettings();
      
      return { success: true };
      
    } catch (err) {
      return { 
        success: false, 
        error: err.message 
      };
    }
  }

  /**
   * プリセット設定
   */
  getPresets() {
    return {
      default: this.deepClone(this.defaultSettings),
      
      gentle: {
        ...this.deepClone(this.defaultSettings),
        music: {
          ...this.defaultSettings.music,
          intensity: 60,
          speed: 80
        },
        haptic: {
          ...this.defaultSettings.haptic,
          intervalMs: 120
        }
      },
      
      powerful: {
        ...this.deepClone(this.defaultSettings),
        music: {
          ...this.defaultSettings.music,
          intensity: 150,
          bassBoost: 150,
          speed: 120
        },
        haptic: {
          ...this.defaultSettings.haptic,
          intervalMs: 75
        }
      },
      
      precise: {
        ...this.deepClone(this.defaultSettings),
        music: {
          ...this.defaultSettings.music,
          windowSec: 0.5,
          stepSec: 0.2
        },
        audio: {
          analysisPreset: 'precise'
        }
      }
    };
  }

  /**
   * プリセットの適用
   */
  applyPreset(presetName) {
    const presets = this.getPresets();
    if (!presets[presetName]) {
      return { success: false, error: '存在しないプリセットです' };
    }

    this.currentSettings = this.deepClone(presets[presetName]);
    this.saveSettings();
    
    return { success: true };
  }

  /**
   * 設定変更の監視
   */
  onChange(callback) {
    if (typeof callback !== 'function') {
      throw new Error('コールバック関数が必要です');
    }

    // StorageEventを使用して他のタブからの変更も検出
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey) {
        this.currentSettings = this.loadSettings();
        callback(this.currentSettings);
      }
    });

    // 内部変更の検出用（簡易実装）
    if (!this._changeCallbacks) {
      this._changeCallbacks = [];
    }
    this._changeCallbacks.push(callback);
  }

  /**
   * ユーティリティメソッド
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  mergeSettings(target, source) {
    const result = this.deepClone(target);
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.mergeSettings(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * 設定の概要取得
   */
  getSummary() {
    return {
      totalSettings: this.countSettings(this.currentSettings),
      isDefault: JSON.stringify(this.currentSettings) === JSON.stringify(this.defaultSettings),
      lastModified: localStorage.getItem(this.storageKey + '_timestamp') || 'unknown'
    };
  }

  countSettings(obj, count = 0) {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        count = this.countSettings(obj[key], count);
      } else {
        count++;
      }
    }
    return count;
  }
}

// グローバルエクスポート
window.ProCon2Config = ProCon2Config;
