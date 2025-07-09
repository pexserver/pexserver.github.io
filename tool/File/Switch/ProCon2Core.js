/**
 * ProCon2Core.js - Nintendo Switch ProController 2 コアAPI
 * デバイス接続、基本通信、ハプティック制御の基盤機能を提供
 */

class ProCon2Core {
  constructor() {
    // デバイス定数
    this.VENDOR_ID = 0x057E;
    this.PRODUCT_ID_JOYCON2_R = 0x2066;
    this.PRODUCT_ID_JOYCON2_L = 0x2067;
    this.PRODUCT_ID_PROCON2 = 0x2069;
    this.PRODUCT_ID_GCNSO = 0x2073;
    this.USB_INTERFACE_NUMBER = 1;

    // デバイス状態
    this.currentUsbDevice = null;
    this.currentUsbEndpoint = null;
    this.currentHidDevice = null;

    // 初期化コマンドの定義
    this.initializeCommands();
  }

  /**
   * Nintendo Switch Controller初期化コマンドの定義
   */
  initializeCommands() {
    this.INIT_COMMAND_0x03 = new Uint8Array([
      0x03, 0x91, 0x00, 0x0d, 0x00, 0x08,
      0x00, 0x00, 0x01, 0x00,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF
    ]);

    this.UNKNOWN_COMMAND_0x07 = new Uint8Array([
      0x07, 0x91, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x00
    ]);

    this.UNKNOWN_COMMAND_0x16 = new Uint8Array([
      0x16, 0x91, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x00
    ]);

    this.REQUEST_CONTROLLER_MAC = new Uint8Array([
      0x15, 0x91, 0x00, 0x01, 0x00, 0x0e,
      0x00, 0x00, 0x00, 0x02,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF
    ]);

    this.LTK_REQUEST = new Uint8Array([
      0x15, 0x91, 0x00, 0x02, 0x00, 0x11,
      0x00, 0x00, 0x00,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF
    ]);

    this.ENABLE_HAPTICS = new Uint8Array([
      0x03, 0x91, 0x00, 0x0a, 0x00, 0x04,
      0x00, 0x00, 0x09,
      0x00, 0x00, 0x00
    ]);

    this.SET_PLAYER_LED = new Uint8Array([
      0x09, 0x91, 0x00, 0x07, 0x00, 0x08,
      0x00, 0x00, 
      0x01,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
  }

  /**
   * USB接続
   */
  async connectUsb() {
    try {
      const device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: this.VENDOR_ID, productId: this.PRODUCT_ID_JOYCON2_L },
          { vendorId: this.VENDOR_ID, productId: this.PRODUCT_ID_JOYCON2_R },
          { vendorId: this.VENDOR_ID, productId: this.PRODUCT_ID_PROCON2 },
          { vendorId: this.VENDOR_ID, productId: this.PRODUCT_ID_GCNSO }
        ]
      });

      console.log('USBデバイス選択:', device.productName, `(PID: 0x${device.productId.toString(16)})`);

      await device.open();
      console.log('USBデバイス開放成功');
      
      if (!device.configuration) {
        await device.selectConfiguration(1);
        console.log('USB設定選択完了');
      }

      await device.claimInterface(this.USB_INTERFACE_NUMBER);
      console.log('USBインターフェース要求完了');

      const iface = device.configuration.interfaces[this.USB_INTERFACE_NUMBER];
      const endpointOut = iface.alternate.endpoints.find(
        ep => ep.direction === 'out' && ep.type === 'bulk'
      );

      if (!endpointOut) {
        throw new Error('No bulk OUT endpoint found');
      }

      this.currentUsbDevice = device;
      this.currentUsbEndpoint = endpointOut;

      console.log('USB接続完了:', {
        vendorId: `0x${device.vendorId.toString(16)}`,
        productId: `0x${device.productId.toString(16)}`,
        productName: device.productName,
        endpointNumber: endpointOut.endpointNumber
      });

      // 初期化シーケンス実行
      console.log('初期化シーケンス開始...');
      await this.sendInitializationSequence();
      console.log('初期化シーケンス完了');

      return device;
    } catch (err) {
      this.currentUsbDevice = null;
      this.currentUsbEndpoint = null;
      console.error('USB接続詳細エラー:', err);
      throw err;
    }
  }

  /**
   * HID接続
   */
  async connectHid() {
    try {
      const devices = await navigator.hid.requestDevice({
        filters: [
          { vendorId: this.VENDOR_ID, productId: this.PRODUCT_ID_JOYCON2_R },
          { vendorId: this.VENDOR_ID, productId: this.PRODUCT_ID_JOYCON2_L },
          { vendorId: this.VENDOR_ID, productId: this.PRODUCT_ID_PROCON2 },
          { vendorId: this.VENDOR_ID, productId: this.PRODUCT_ID_GCNSO }
        ]
      });

      if (devices.length === 0) {
        throw new Error('No HID device selected');
      }

      const device = devices[0];
      console.log('HIDデバイス選択:', device.productName, `(PID: 0x${device.productId.toString(16)})`);

      if (!device.opened) {
        await device.open();
        console.log('HIDデバイス開放成功');
      }

      this.currentHidDevice = device;
      
      // デバイス情報をログ出力
      console.log('HID接続完了:', {
        vendorId: `0x${device.vendorId.toString(16)}`,
        productId: `0x${device.productId.toString(16)}`,
        productName: device.productName,
        opened: device.opened
      });
      
      return device;
    } catch (err) {
      this.currentHidDevice = null;
      console.error('HID接続詳細エラー:', err);
      throw err;
    }
  }

  /**
   * 初期化シーケンス送信
   */
  async sendInitializationSequence() {
    const commands = [
      this.INIT_COMMAND_0x03,
      this.UNKNOWN_COMMAND_0x07,
      this.UNKNOWN_COMMAND_0x16,
      this.REQUEST_CONTROLLER_MAC,
      this.LTK_REQUEST,
      this.ENABLE_HAPTICS,
      this.SET_PLAYER_LED
    ];

    for (const command of commands) {
      await this.sendUsbData(command);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * USBデータ送信
   */
  async sendUsbData(data) {
    if (!this.currentUsbDevice || !this.currentUsbEndpoint) {
      throw new Error('USBデバイスが接続されていません');
    }

    const writeResult = await this.currentUsbDevice.transferOut(
      this.currentUsbEndpoint.endpointNumber, 
      data
    );

    await new Promise(resolve => setTimeout(resolve, 10));

    let readResult = null;
    try {
      readResult = await this.currentUsbDevice.transferIn(
        this.currentUsbEndpoint.endpointNumber, 
        32
      );
    } catch (readError) {
      // 読み取りエラーは無視（一部のコマンドは応答なし）
    }

    return { writeResult, readResult };
  }

  /**
   * HIDデータ送信（handheldlegend.github.io/procon2tool/ 準拠）
   */
  async sendHidData(data) {
    if (!this.currentHidDevice) {
      throw new Error('HIDデバイスが接続されていません');
    }

    // デバイスが開かれているか確認
    if (!this.currentHidDevice.opened) {
      throw new Error('HIDデバイスが開かれていません');
    }

    // データが配列の場合はUint8Arrayに変換
    let processedData;
    if (Array.isArray(data)) {
      processedData = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      processedData = data;
    } else {
      throw new Error(`無効なデータ型: ${typeof data}`);
    }

    console.log('HIDデータ送信:', processedData);

    try {
      const reportId = processedData[0];
      const reportData = processedData.slice(1);

      // handheldlegend/procon2tool と同じレポートID（0x02）を使用
      if (reportId !== 0x02 && reportId !== 0x10 && reportId !== 0x01) {
        console.warn(`非対応レポートID: 0x${reportId.toString(16).padStart(2, '0')}, 0x02に修正`);
        processedData[0] = 0x02;
      }

      // sendReportメソッドを正しい形式で使用
      await this.currentHidDevice.sendReport(processedData[0], reportData);
      
      return { status: 'ok', bytesWritten: processedData.length };
    } catch (err) {
      console.error('HID送信詳細エラー:', err);
      
      // エラー詳細に基づく対応
      if (err.name === 'NotAllowedError') {
        throw new Error(`HIDデバイスへの書き込み権限がありません: ${err.message}`);
      } else if (err.name === 'NetworkError') {
        throw new Error(`HIDデバイスが切断されました: ${err.message}`);
      } else if (err.name === 'InvalidStateError') {
        throw new Error(`HIDデバイスの状態が無効です: ${err.message}`);
      } else {
        throw new Error(`HID送信エラー: ${err.message}`);
      }
    }
  }

  /**
   * ハプティックレポート作成（handheldlegend/procon2tool 準拠）
   */
  createHapticReport(hapticData, counter) {
    // handheldlegend/procon2tool と同じ64バイト形式を使用
    const report = new Uint8Array(64);
    
    // Header - handheldlegend/procon2tool 準拠
    report[0] = 0x02; // Report ID (重要: 0x02を使用)
    report[1] = 0x50 | ((counter || 0) & 0x0F); // 0x5X where X increments 0-F
    report[17] = report[1]; // 位置17にも同じ値を設定
    
    let leftRumble, rightRumble;
    
    if (hapticData && Array.isArray(hapticData) && hapticData.length >= 4) {
      // カスタムHD Rumbleデータが提供された場合
      leftRumble = hapticData.slice(0, 4);
      rightRumble = hapticData.length >= 8 ? hapticData.slice(4, 8) : hapticData.slice(0, 4);
    } else if (hapticData && hapticData.length >= 5) {
      // 5バイト形式のテストパターン（handheldlegend/procon2tool形式）
      leftRumble = hapticData.slice(0, 4);
      rightRumble = hapticData.slice(0, 4);
    } else if (hapticData && typeof hapticData === 'object') {
      // 音楽ノート形式のデータから生成
      const { frequency = 320, amplitude = 0.5, leftAmp = null, rightAmp = null } = hapticData;
      leftRumble = this.encodeHDRumble(frequency, leftAmp || amplitude);
      rightRumble = this.encodeHDRumble(frequency, rightAmp || amplitude);
    } else {
      // デフォルト（振動なし）
      leftRumble = [0x00, 0x01, 0x40, 0x40];
      rightRumble = [0x00, 0x01, 0x40, 0x40];
    }
    
    // Left HD Rumble (4 bytes) - handheldlegend/procon2tool位置
    for (let i = 0; i < 4 && i < leftRumble.length; i++) {
      report[2 + i] = leftRumble[i];
      report[18 + i] = leftRumble[i]; // 位置18-21にも同じデータ
    }
    
    // Right HD Rumble (4 bytes) - handheldlegend/procon2tool位置  
    for (let i = 0; i < 4 && i < rightRumble.length; i++) {
      report[6 + i] = rightRumble[i];
      report[22 + i] = rightRumble[i]; // 位置22-25にも同じデータ
    }
    
    // 残りは既に0で初期化済み
    
    return report;
  }

  /**
   * HD Rumble エンコーディング（Nintendo Switch公式仕様）
   * handheldlegend/procon2tool の実装に基づく正式アルゴリズム
   * @param {number} frequency - 周波数 (Hz) 81.75-1252.27推奨
   * @param {number} amplitude - 振幅 0.0-1.0
   * @returns {number[]} 4バイトのHD Rumbleデータ
   */
  encodeHDRumble(frequency = 320, amplitude = 0.5) {
    // 周波数の正規化 (Nintendo Switch公式範囲)
    const clampedFreq = Math.max(81.75, Math.min(1252.27, frequency));
    
    // 振幅の正規化 (0.0-1.0)
    const clampedAmp = Math.max(0, Math.min(1, amplitude));
    
    // 低周波数エンコーディング（Nintendo公式アルゴリズム）
    const hf = (clampedFreq - 81.75) / (1252.27 - 81.75);
    const hf_b0 = Math.round(hf * 0x60);
    const hf_b1 = 0x01;
    
    // 高周波数エンコーディング（Nintendo公式アルゴリズム）
    let hf_b2, hf_b3;
    
    if (clampedAmp === 0) {
      // 振動停止
      hf_b2 = 0x40;
      hf_b3 = 0x40;
    } else {
      // 振幅計算（Nintendo Switch公式仕様）
      // 対数スケールで振幅を計算
      const amp_log = Math.log2(clampedAmp * 100 + 1) / Math.log2(101);
      const amp_encoded = Math.round(amp_log * 0x6A) + 0x64;
      const hf_encoded = Math.round(hf * 0x20) + 0x40;
      
      hf_b2 = Math.min(0xFF, hf_encoded);
      hf_b3 = Math.min(0xFF, amp_encoded);
    }
    
    return [
      hf_b0 & 0xFF,
      hf_b1 & 0xFF,
      hf_b2 & 0xFF,
      hf_b3 & 0xFF
    ];
  }

  /**
   * プリセットHD Rumbleパターン生成（Nintendo Switch公式）
   * handheldlegend/procon2tool で確認された動作パターン
   */
  createPresetRumble(preset = 'off') {
    const presets = {
      off: [0x00, 0x01, 0x40, 0x40],
      weak: [0x32, 0x01, 0x64, 0x72],
      medium: [0x50, 0x01, 0x7A, 0x88],
      strong: [0x60, 0x01, 0x8A, 0x9A],
      // 音楽用プリセット
      piano_low: [0x1A, 0x01, 0x50, 0x68],   // 低音域
      piano_mid: [0x30, 0x01, 0x60, 0x78],   // 中音域
      piano_high: [0x48, 0x01, 0x70, 0x88],  // 高音域
      // 従来のテストパターン（後方互換性）
      test: [0x3f, 0x01, 0xf0, 0x19],
      legacy_medium: [0x93, 0x35, 0x36, 0x1c],
      legacy_strong: [0xa8, 0x29, 0xc5, 0xdc]
    };
    
    return presets[preset] || presets.off;
  }

  /**
   * デバイス状態確認
   */
  getDeviceStatus() {
    return {
      usbConnected: !!this.currentUsbDevice,
      hidConnected: !!this.currentHidDevice,
      canSendHaptic: !!this.currentHidDevice
    };
  }

  /**
   * デバイス切断
   */
  async disconnect() {
    if (this.currentUsbDevice) {
      try {
        await this.currentUsbDevice.releaseInterface(this.USB_INTERFACE_NUMBER);
        await this.currentUsbDevice.close();
      } catch (err) {
        console.warn('USB切断エラー:', err);
      }
      this.currentUsbDevice = null;
      this.currentUsbEndpoint = null;
    }

    if (this.currentHidDevice) {
      try {
        await this.currentHidDevice.close();
      } catch (err) {
        console.warn('HID切断エラー:', err);
      }
      this.currentHidDevice = null;
    }
  }

  /**
   * 統一接続メソッド（USB + HID）
   */
  async connect() {
    try {
      console.log('Nintendo Switch Pro Controller 接続開始...');
      
      // HID接続を試行
      try {
        await this.connectHid();
        console.log('✓ HID接続成功');
      } catch (hidErr) {
        console.warn('HID接続失敗:', hidErr.message);
      }
      
      // USB接続を試行
      try {
        await this.connectUsb();
        console.log('✓ USB接続成功');
      } catch (usbErr) {
        console.warn('USB接続失敗:', usbErr.message);
      }
      
      // 少なくとも一つの接続が成功していることを確認
      const status = this.getDeviceStatus();
      if (!status.usbConnected && !status.hidConnected) {
        throw new Error('USB/HID両方の接続に失敗しました');
      }
      
      console.log('Nintendo Switch Pro Controller 接続完了');
      return status;
      
    } catch (err) {
      console.error('接続エラー:', err);
      throw err;
    }
  }
}

// グローバルエクスポート
window.ProCon2Core = ProCon2Core;
