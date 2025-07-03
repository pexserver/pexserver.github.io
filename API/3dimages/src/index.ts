interface Point2D {
    x: number;
    y: number;
}

class SpatialSceneConverter {
    private originalCanvas: HTMLCanvasElement;
    private resultCanvas: HTMLCanvasElement;
    private originalCtx: CanvasRenderingContext2D;
    private resultCtx: CanvasRenderingContext2D;
    private currentImage: HTMLImageElement | null = null;
    private spatialModeEnabled: boolean = false;
    private isDragging: boolean = false;
    private lastMousePos: Point2D = { x: 0, y: 0 };
    private tiltX: number = 0;
    private tiltY: number = 0;
    private depthMap: ImageData | null = null;
    private deviceMotionEnabled: boolean = false;
    private isMobile: boolean = false;
    private baseOrientation: { beta: number; gamma: number } | null = null;
    private deviceOrientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;
    private _lastRenderTime: number = 0;

    constructor() {
        this.originalCanvas = document.getElementById('originalCanvas') as HTMLCanvasElement;
        this.resultCanvas = document.getElementById('resultCanvas') as HTMLCanvasElement;
        
        this.originalCtx = this.originalCanvas.getContext('2d')!;
        this.resultCtx = this.resultCanvas.getContext('2d')!;
        
        this.detectMobileDevice();
        this.initializeEventListeners();
        this.setupDeviceMotion();
        this.loadSampleImage();
    }

    private detectMobileDevice(): void {
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.logDebug('[detectMobileDevice] isMobile:', this.isMobile);
    }

    private setupDeviceMotion(): void {
        if (!this.isMobile) return;
        
        // iOS 13+でpermission必要
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
            const btn = document.getElementById('enableDeviceMotion');
            if (btn) {
                btn.style.display = 'block';
                btn.addEventListener('click', async () => {
                    this.logDebug('[setupDeviceMotion] enableDeviceMotion button clicked');
                    try {
                        const permission = await (DeviceOrientationEvent as any).requestPermission();
                        this.logDebug('[setupDeviceMotion] requestPermission result:', permission);
                        if (permission === 'granted') {
                            this.startDeviceMotion();
                            btn.style.display = 'none';
                        } else {
                            this.logDebug('[setupDeviceMotion] Permission denied:', permission);
                        }
                    } catch (error) {
                        this.logDebug('[setupDeviceMotion] Permission error:', error);
                    }
                });
            }
        } else {
            // Android等、自動で開始
            this.startDeviceMotion();
        }
    }

    private startDeviceMotion(): void {
        if (this.deviceOrientationHandler) {
            window.removeEventListener('deviceorientation', this.deviceOrientationHandler);
            this.logDebug('[startDeviceMotion] Previous deviceorientation handler removed');
        }
        this.deviceMotionEnabled = true;
        let lastUpdate = 0;
        this.deviceOrientationHandler = (event: DeviceOrientationEvent) => {
            if (!this.spatialModeEnabled || !this.deviceMotionEnabled) return;
            // 高速連続イベントを間引き（16ms=約60fps）
            const now = Date.now();
            if (now - lastUpdate < 16) return;
            lastUpdate = now;
            // iOS/Android両対応で値を安定化
            let beta = typeof event.beta === 'number' ? event.beta : 0;
            let gamma = typeof event.gamma === 'number' ? event.gamma : 0;
            // iOSのLandscape時の値補正
            if (window.orientation === 90 || window.orientation === -90) {
                [beta, gamma] = [gamma, beta];
            }
            // 初回時はベース値として記録
            if (!this.baseOrientation) {
                this.baseOrientation = { beta, gamma };
                this.logDebug('[deviceorientation] baseOrientation set:', this.baseOrientation);
                return;
            }
            // ベース値からの差分を計算（斜め方向も含む）
            let deltaX = (beta - this.baseOrientation.beta);
            let deltaY = (gamma - this.baseOrientation.gamma);
            
            // ノイズ除去（小さい揺れは無視）- 閾値を大きく
            if (Math.abs(deltaX) < 1.0) deltaX = 0;
            if (Math.abs(deltaY) < 1.0) deltaY = 0;
            
            // 急激な変化を防止（前回値からの変化量を制限）
            const prevTiltX = this.tiltX;
            const prevTiltY = this.tiltY;
            
            // 端末傾きの物理的な最大値を考慮し、よりリアルなスケーリング
            // 係数を小さくして、より穏やかな動きに
            let newTiltX = Math.max(-30, Math.min(30, deltaX * 0.5));
            let newTiltY = Math.max(-30, Math.min(30, deltaY * 0.9));
            
            // 急激な変化を制限（最大変化量）
            const maxChange = 3.0; // 1フレームあたりの最大変化量
            if (Math.abs(newTiltX - prevTiltX) > maxChange) {
                newTiltX = prevTiltX + (maxChange * Math.sign(newTiltX - prevTiltX));
            }
            if (Math.abs(newTiltY - prevTiltY) > maxChange) {
                newTiltY = prevTiltY + (maxChange * Math.sign(newTiltY - prevTiltY));
            }
            
            // 慣性効果（前回値との補間で滑らかに）- より強いスムージング
            this.tiltX = newTiltX * 0.3 + (prevTiltX || 0) * 0.7;
            this.tiltY = newTiltY * 0.3 + (prevTiltY || 0) * 0.7;
            
            // 小数点以下を丸めて安定化
            this.tiltX = Math.round(this.tiltX * 10) / 10;
            this.tiltY = Math.round(this.tiltY * 10) / 10;
            this.logDebug('[deviceorientation] tiltX:', this.tiltX, 'tiltY:', this.tiltY);
            this.updateSpatialDisplay();
        };
        window.addEventListener('deviceorientation', this.deviceOrientationHandler);
        this.logDebug('[startDeviceMotion] Device motion enabled (リアル/効率化), handler registered');
    }

    private stopDeviceMotion(): void {
        if (this.deviceOrientationHandler) {
            window.removeEventListener('deviceorientation', this.deviceOrientationHandler);
            this.logDebug('[stopDeviceMotion] deviceorientation handler removed');
            this.deviceOrientationHandler = null;
        }
        this.deviceMotionEnabled = false;
        this.logDebug('[stopDeviceMotion] Device motion disabled');
    }

    private initializeEventListeners(): void {
        // 画像アップロード
        const imageInput = document.getElementById('imageInput') as HTMLInputElement;
        imageInput.addEventListener('change', (e) => this.handleImageUpload(e));

        // 結果キャンバスのインタラクション（空間シーン操作）
        this.resultCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.resultCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.resultCanvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.resultCanvas.addEventListener('mouseleave', () => this.handleMouseUp());

        // コントロール
        const spatialIntensity = document.getElementById('spatialIntensity') as HTMLInputElement;
        spatialIntensity.addEventListener('input', () => this.updateSpatialDisplay());

        // ボタン
        document.getElementById('enableSpatialMode')?.addEventListener('click', () => this.toggleSpatialMode());
        document.getElementById('loadSample')?.addEventListener('click', () => this.loadSampleImage());
        document.getElementById('saveResult')?.addEventListener('click', () => this.saveResult());
        document.getElementById('resetTilt')?.addEventListener('click', () => this.resetTilt());

        // 値の更新表示
        spatialIntensity.addEventListener('input', () => {
            document.getElementById('spatialValue')!.textContent = spatialIntensity.value;
        });
    }

    private resetTilt(): void {
        this.tiltX = 0;
        this.tiltY = 0;
        this.baseOrientation = null;
        this.updateSpatialDisplay();
        this.logDebug('[resetTilt] Tilt reset');
        this.stopDeviceMotion();
    }

    private handleMouseDown(event: MouseEvent): void {
        if (!this.spatialModeEnabled) return;
        
        this.isDragging = true;
        this.lastMousePos = { x: event.clientX, y: event.clientY };
        this.resultCanvas.style.cursor = 'grabbing';
    }

    private handleMouseMove(event: MouseEvent): void {
        if (!this.isDragging || !this.spatialModeEnabled) return;

        const deltaX = event.clientX - this.lastMousePos.x;
        const deltaY = event.clientY - this.lastMousePos.y;

        // 急激な変化を防ぐために、大きな動きを制限
        const maxDelta = 20;
        const clampedDeltaX = Math.max(-maxDelta, Math.min(maxDelta, deltaX));
        const clampedDeltaY = Math.max(-maxDelta, Math.min(maxDelta, deltaY));

        // iOS26風：マウス操作を端末の傾きに変換（スムージング強化）
        // 係数を小さくして、より穏やかな動きに
        this.tiltX += clampedDeltaY * 0.2;
        this.tiltY += clampedDeltaX * 0.2;

        // 傾き制限（斜め方向も自然な範囲内）
        this.tiltX = Math.max(-45, Math.min(45, this.tiltX));
        this.tiltY = Math.max(-45, Math.min(45, this.tiltY));

        // 小数点以下を丸めて安定化
        this.tiltX = Math.round(this.tiltX * 10) / 10;
        this.tiltY = Math.round(this.tiltY * 10) / 10;

        this.lastMousePos = { x: event.clientX, y: event.clientY };
        this.updateSpatialDisplay();
    }

    private handleMouseUp(): void {
        this.isDragging = false;
        this.resultCanvas.style.cursor = this.spatialModeEnabled ? 'grab' : 'default';
    }

    private toggleSpatialMode(): void {
        this.spatialModeEnabled = !this.spatialModeEnabled;
        
        if (this.spatialModeEnabled && this.currentImage) {
            this.generateDepthMapSpatial();
        }
        
        // UI更新
        this.updateSpatialModeUI();
        this.updateSpatialDisplay();
    }

    private updateSpatialModeUI(): void {
        const btn = document.getElementById('enableSpatialMode');
        const indicator = document.querySelector('.spatial-indicator') as HTMLElement;
        
        if (btn) {
            if (this.spatialModeEnabled) {
                btn.textContent = '🔮 空間シーンOFF';
                btn.className = 'ios-button spatial-active';
                if (indicator) indicator.style.display = 'block';
            } else {
                btn.textContent = '🌟 空間シーンモード';
                btn.className = 'ios-button primary';
                if (indicator) indicator.style.display = 'none';
            }
        }
    }

    private handleImageUpload(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            this.currentImage = img;
            this.drawOriginalImage();
            // 空間シーンモードがONの場合は深度マップを生成
            if (this.spatialModeEnabled) {
                this.generateDepthMapSpatial();
            }
            this.updateSpatialDisplay();
        };
        img.src = URL.createObjectURL(file);
    }

    private drawOriginalImage(): void {
        this.logDebug('[drawOriginalImage] called');
        if (!this.currentImage) return;

        this.originalCtx.clearRect(0, 0, this.originalCanvas.width, this.originalCanvas.height);
        
        // 画像を描画
        this.originalCtx.drawImage(
            this.currentImage,
            0, 0,
            this.originalCanvas.width,
            this.originalCanvas.height
        );
    }

    private updateSpatialDisplay(): void {
        this.logDebug('[updateSpatialDisplay] called, spatialMode:', this.spatialModeEnabled);
        if (!this.currentImage) return;
        
        // パフォーマンス最適化：レンダリングを間引く
        if (this._lastRenderTime && Date.now() - this._lastRenderTime < 50) { // 50ms（約20fps）で制限
            return;
        }
        this._lastRenderTime = Date.now();
        
        // メモリリーク防止：キャンバスサイズ上限
        const maxCanvasSize = 2000; // 2000x2000以上にはしない
        if (this.resultCanvas.width > maxCanvasSize || this.resultCanvas.height > maxCanvasSize) {
            const aspectRatio = this.currentImage.width / this.currentImage.height;
            if (aspectRatio >= 1) {
                this.resultCanvas.width = maxCanvasSize;
                this.resultCanvas.height = maxCanvasSize / aspectRatio;
            } else {
                this.resultCanvas.height = maxCanvasSize;
                this.resultCanvas.width = maxCanvasSize * aspectRatio;
            }
        }
        
        if (this.spatialModeEnabled) {
            this.renderSpatialScene();
        } else {
            // 通常表示：元画像をそのまま表示
            this.resultCtx.clearRect(0, 0, this.resultCanvas.width, this.resultCanvas.height);
            this.resultCtx.drawImage(
                this.currentImage,
                0, 0,
                this.resultCanvas.width,
                this.resultCanvas.height
            );
        }
    }

    // iOS26風：AI解析による深度マップ生成（簡易版）
    private generateDepthMapSpatial(): void {
        this.logDebug('[generateDepthMapSpatial] start');
        if (!this.currentImage) return;

        this.showProgressBar();
        
        const canvas = document.createElement('canvas');
        canvas.width = this.currentImage.width;
        canvas.height = this.currentImage.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(this.currentImage, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const depthData = this.analyzeDepthFromImage(imageData);
        
        this.depthMap = depthData;
        this.updateProgressBar(100);
        setTimeout(() => this.hideProgressBar(), 500);
        
        this.logDebug('[generateDepthMapSpatial] completed');
    }

    // iOS26風：AI解析による深度推定（高度なセグメンテーションと深度推定）
    private analyzeDepthFromImage(imageData: ImageData): ImageData {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        
        // 第1段階：高度な被写体検出
        const subjectMask = this.detectSubjectRegions(imageData);
        
        // 第2段階：深度マップ生成（複数特徴量の統合）
        const depthData = new ImageData(width, height);
        const depth = depthData.data;
        const tempDepth = new Float32Array(width * height);
        
        // 深度に寄与する特徴量を計算
        const edgeMap = new Float32Array(width * height);
        const blurMap = new Float32Array(width * height);
        const focusMap = new Float32Array(width * height);
        
        // エッジマップ計算
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const edgeX = this.getSimpleEdgeX(data, x, y, width);
                const edgeY = this.getSimpleEdgeY(data, x, y, width);
                const edgeMagnitude = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
                edgeMap[y * width + x] = Math.min(255, edgeMagnitude);
            }
        }
        
        // ぼけ推定マップ（局所的なコントラスト）
        const kernelSize = 3;
        const halfSize = Math.floor(kernelSize / 2);
        for (let y = halfSize; y < height - halfSize; y++) {
            for (let x = halfSize; x < width - halfSize; x++) {
                let sum = 0;
                let count = 0;
                let maxVal = 0;
                let minVal = 255;
                
                for (let ky = -halfSize; ky <= halfSize; ky++) {
                    for (let kx = -halfSize; kx <= halfSize; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                        sum += gray;
                        count++;
                        maxVal = Math.max(maxVal, gray);
                        minVal = Math.min(minVal, gray);
                    }
                }
                
                const avg = sum / count;
                const localContrast = maxVal - minVal;
                blurMap[y * width + x] = Math.min(255, localContrast);
            }
        }
        
        // 焦点距離マップ（中心からの距離）
        const centerX = width / 2;
        const centerY = height / 2;
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const distFromCenter = Math.sqrt((x - centerX) * (x - centerX) + (y - centerY) * (y - centerY));
                // シグモイド関数で中心に焦点があると仮定
                const normalizedDist = distFromCenter / maxDist;
                const focusWeight = 1 / (1 + Math.exp((normalizedDist - 0.5) * 5));
                focusMap[y * width + x] = focusWeight * 255;
            }
        }
        
        // マップの組み合わせで深度を計算
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const linearIdx = idx;
                const pixelIdx = idx * 4;
                
                const r = data[pixelIdx];
                const g = data[pixelIdx + 1];
                const b = data[pixelIdx + 2];
                const brightness = (r + g + b) / 3;
                
                // 色相（HSV変換）
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const delta = max - min;
                let hue = 0;
                if (delta !== 0) {
                    if (max === r) hue = ((g - b) / delta) % 6;
                    else if (max === g) hue = (b - r) / delta + 2;
                    else hue = (r - g) / delta + 4;
                    hue *= 60;
                    if (hue < 0) hue += 360;
                }
                
                // 被写体マスクの影響
                const isSubject = subjectMask[linearIdx];
                
                // 特徴量統合による深度計算
                let depthValue = isSubject ? 220 : 60; // 基本値（被写体：手前、背景：奥）
                
                // エッジに基づく調整（エッジが強いほど手前）
                const edgeWeight = 0.15;
                depthValue += edgeMap[linearIdx] * edgeWeight * (isSubject ? 1 : 0.3);
                
                // ぼけに基づく調整（ぼけていないほど手前）
                const blurWeight = 0.12;
                depthValue += blurMap[linearIdx] * blurWeight * (isSubject ? 1 : 0.4);
                
                // 焦点距離に基づく調整
                const focusWeight = 0.18;
                depthValue += focusMap[linearIdx] * focusWeight * (isSubject ? 0.5 : 0.3);
                
                // 色相に基づく調整（青系は遠く、赤系は近く）
                if (hue >= 180 && hue <= 270) { // 青系
                    depthValue -= 15 * (isSubject ? 0.3 : 1.0);
                } else if (hue >= 0 && hue <= 60) { // 赤〜黄系
                    depthValue += 10 * (isSubject ? 0.3 : 0.8);
                }
                
                // 明度に基づく調整（明るいほど手前）
                depthValue += (brightness - 128) * 0.1 * (isSubject ? 0.5 : 0.3);
                
                // 境界付近の処理
                if (edgeMap[linearIdx] > 40) {
                    if (isSubject) {
                        // 被写体の境界は少し強調
                        depthValue += 15;
                    } else {
                        // 背景の境界は少し奥に
                        depthValue -= 10;
                    }
                }
                
                // 0-255の範囲にクランプ
                tempDepth[linearIdx] = Math.max(0, Math.min(255, depthValue));
            }
        }
        
        // 第3段階：深度の平滑化（適応的ガウシアンブラー）
        const smoothedDepth = this.applyAdaptiveGaussianBlur(tempDepth, edgeMap, width, height);
        
        // 最終的な深度マップを作成
        for (let i = 0; i < width * height; i++) {
            const pixelIdx = i * 4;
            const depthVal = Math.round(smoothedDepth[i]);
            depth[pixelIdx] = depthVal;
            depth[pixelIdx + 1] = depthVal;
            depth[pixelIdx + 2] = depthVal;
            depth[pixelIdx + 3] = 255;
        }
        
        return depthData;
    }
    
    // 適応的ガウシアンブラー（エッジを保持しつつ平滑化）
    private applyAdaptiveGaussianBlur(data: Float32Array, edgeMap: Float32Array, width: number, height: number): Float32Array {
        const result = new Float32Array(width * height);
        const tempResult = new Float32Array(width * height);
        
        // エッジに応じたシグマ値を決定
        const sigmaMap = new Float32Array(width * height);
        for (let i = 0; i < width * height; i++) {
            const edgeStrength = edgeMap[i];
            // エッジが強いほどシグマ値を小さく（ブラーを弱く）
            sigmaMap[i] = Math.max(0.8, 3.0 - (edgeStrength / 255) * 2.5);
        }
        
        // 水平方向のブラー
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const sigma = sigmaMap[idx];
                const radius = Math.ceil(sigma * 2.5);
                
                let sum = 0;
                let weightSum = 0;
                
                for (let i = -radius; i <= radius; i++) {
                    const xi = Math.max(0, Math.min(width - 1, x + i));
                    const dist = i * i;
                    const weight = Math.exp(-dist / (2 * sigma * sigma));
                    
                    sum += data[y * width + xi] * weight;
                    weightSum += weight;
                }
                
                tempResult[idx] = sum / weightSum;
            }
        }
        
        // 垂直方向のブラー
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const sigma = sigmaMap[idx];
                const radius = Math.ceil(sigma * 2.5);
                
                let sum = 0;
                let weightSum = 0;
                
                for (let i = -radius; i <= radius; i++) {
                    const yi = Math.max(0, Math.min(height - 1, y + i));
                    const dist = i * i;
                    const weight = Math.exp(-dist / (2 * sigma * sigma));
                    
                    sum += tempResult[yi * width + x] * weight;
                    weightSum += weight;
                }
                
                result[idx] = sum / weightSum;
            }
        }
        
        return result;
    }

    // iOS26風：被写体領域検出（高度セグメンテーション）
    private detectSubjectRegions(imageData: ImageData): boolean[] {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const mask = new Array(width * height).fill(false);
        
        // 第1段階：ピクセルレベルの特性評価
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const linearIdx = y * width + x;
                
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                
                // 肌色検出（人物被写体）- より精密な範囲で検出
                const isSkinTone = this.isAdvancedSkinColor(r, g, b);
                
                // 鮮やかな色検出（物体被写体）
                const saturation = this.getColorSaturation(r, g, b);
                const brightness = (r + g + b) / 3;
                const isVividColor = saturation > 45 && brightness > 50;
                
                // 焦点距離に基づく中央重要度（シグモイド関数で自然な重み付け）
                const centerX = width / 2;
                const centerY = height / 2;
                const distFromCenter = Math.sqrt((x - centerX) * (x - centerX) + (y - centerY) * (y - centerY));
                const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
                const normalizedDist = distFromCenter / maxDist;
                const centralityWeight = 1 / (1 + Math.exp((normalizedDist - 0.5) * 10)); // シグモイド関数
                
                // エッジ検出（被写体の輪郭を強調）
                const hasStrongEdge = this.hasStrongEdgeAt(data, x, y, width, height);
                
                // 被写体スコア計算（複数要素の重み付け組み合わせ）
                let subjectScore = 0;
                if (isSkinTone) subjectScore += 0.7;
                if (isVividColor) subjectScore += 0.5;
                subjectScore += centralityWeight * 0.6;
                if (hasStrongEdge) subjectScore += 0.3;
                
                // スコアしきい値で被写体判定
                mask[linearIdx] = subjectScore > 0.6;
            }
        }
        
        // 第2段階：領域拡張法による被写体検出の強化
        const enhancedMask = this.enhanceSubjectDetection(mask, width, height, data);
        
        // 第3段階：モルフォロジー処理とノイズ除去
        return this.advancedMorphologyProcess(enhancedMask, width, height);
    }
    
    // 高度な肌色検出（YCbCr色空間を使用）
    private isAdvancedSkinColor(r: number, g: number, b: number): boolean {
        // RGB to YCbCr変換（写真業界標準の変換）
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        
        // 肌色の標準範囲（研究ベースの値）
        // Cb: 77-127, Cr: 133-173 が一般的な肌色範囲
        const isSkinYCbCr = (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173);
        
        // HSV変換による補助検証
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        let hue = 0;
        if (delta !== 0) {
            if (max === r) {
                hue = ((g - b) / delta) % 6;
            } else if (max === g) {
                hue = (b - r) / delta + 2;
            } else {
                hue = (r - g) / delta + 4;
            }
            hue *= 60;
            if (hue < 0) hue += 360;
        }
        
        const saturation = max === 0 ? 0 : (delta / max) * 100;
        const value = (max / 255) * 100;
        
        // 改良された肌色HSV範囲
        const isSkinHSV = (hue >= 0 && hue <= 50) && 
                        (saturation >= 10 && saturation <= 85) && 
                        (value >= 20 && value <= 95);
        
        // RGB比率チェック（肌色の特性：R>G>B）
        const isRGBRatioCorrect = (r > g) && (g > b) && (r - b > 20);
        
        // 複合判定（より高精度）
        return (isSkinYCbCr && (isSkinHSV || isRGBRatioCorrect)) || 
               (isSkinHSV && isRGBRatioCorrect);
    }
    
    // エッジ検出強化版
    private hasStrongEdgeAt(data: Uint8ClampedArray, x: number, y: number, width: number, height: number): boolean {
        if (x <= 1 || x >= width - 2 || y <= 1 || y >= height - 2) return false;
        
        // Sobelオペレータによるエッジ検出
        const gx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
        const gy = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
        
        let sumX = 0;
        let sumY = 0;
        
        for (let j = -1; j <= 1; j++) {
            for (let i = -1; i <= 1; i++) {
                const pixelX = x + i;
                const pixelY = y + j;
                if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) continue;
                
                const idx = (pixelY * width + pixelX) * 4;
                const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                
                sumX += gray * gx[j+1][i+1];
                sumY += gray * gy[j+1][i+1];
            }
        }
        
        const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
        return magnitude > 40; // しきい値調整
    }
    
    // 領域拡張法による被写体検出強化
    private enhanceSubjectDetection(mask: boolean[], width: number, height: number, data: Uint8ClampedArray): boolean[] {
        const result = [...mask];
        const visited = new Array(width * height).fill(false);
        const threshold = 30; // 類似度しきい値
        
        // 領域拡張（Flood Fill）アルゴリズム
        const floodFill = (startX: number, startY: number) => {
            const queue: [number, number][] = [[startX, startY]];
            const startIdx = (startY * width + startX) * 4;
            const startR = data[startIdx];
            const startG = data[startIdx + 1];
            const startB = data[startIdx + 2];
            
            while (queue.length > 0) {
                const [x, y] = queue.shift()!;
                const idx = y * width + x;
                
                if (visited[idx]) continue;
                visited[idx] = true;
                
                const pixelIdx = idx * 4;
                const r = data[pixelIdx];
                const g = data[pixelIdx + 1];
                const b = data[pixelIdx + 2];
                
                // 色の差が閾値より小さければ同じ領域と判断
                const colorDiff = Math.sqrt(
                    Math.pow(r - startR, 2) + 
                    Math.pow(g - startG, 2) + 
                    Math.pow(b - startB, 2)
                );
                
                if (colorDiff <= threshold) {
                    result[idx] = true;
                    
                    // 隣接ピクセルをキューに追加
                    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
                    for (const [dx, dy] of directions) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny * width + nx]) {
                            queue.push([nx, ny]);
                        }
                    }
                }
            }
        };
        
        // 強い被写体と判定されたピクセルから領域拡張
        for (let y = 0; y < height; y += 5) { // 処理を軽減するためステップを大きくする
            for (let x = 0; x < width; x += 5) {
                const idx = y * width + x;
                if (mask[idx] && !visited[idx]) {
                    floodFill(x, y);
                }
            }
        }
        
        return result;
    }
    
    // 高度なモルフォロジー処理
    private advancedMorphologyProcess(mask: boolean[], width: number, height: number): boolean[] {
        // 小さなノイズ除去（オープニング処理）
        let result = this.morphologyErode(mask, width, height);
        result = this.morphologyErode(result, width, height); // 二回適用で効果強化
        result = this.morphologyDilate(result, width, height);
        result = this.morphologyDilate(result, width, height);
        
        // 穴埋め処理（クロージング処理）
        result = this.morphologyDilate(result, width, height);
        result = this.morphologyDilate(result, width, height);
        result = this.morphologyErode(result, width, height);
        result = this.morphologyErode(result, width, height);
        
        // 境界を滑らかにする
        result = this.smoothBoundaries(result, width, height);
        
        return result;
    }
    
    // 境界平滑化
    private smoothBoundaries(mask: boolean[], width: number, height: number): boolean[] {
        const result = [...mask];
        
        for (let y = 2; y < height - 2; y++) {
            for (let x = 2; x < width - 2; x++) {
                const idx = y * width + x;
                
                // 3x3ウィンドウ内での被写体ピクセル数をカウント
                let count = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const neighborIdx = (y + dy) * width + (x + dx);
                        if (mask[neighborIdx]) count++;
                    }
                }
                
                // 多数決原理（閾値を調整可能）
                if (count >= 5) {
                    result[idx] = true;
                } else if (count <= 3) {
                    result[idx] = false;
                }
            }
        }
        
        return result;
    }

    // ガウシアンブラー
    private applyGaussianBlur(data: Float32Array, width: number, height: number, sigma: number): Float32Array {
        const radius = Math.ceil(sigma * 3);
        const kernel = this.generateGaussianKernel(sigma);
        const result = new Float32Array(width * height);
        
        // 水平方向
        const temp = new Float32Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let weightSum = 0;
                
                for (let i = -radius; i <= radius; i++) {
                    const xi = Math.max(0, Math.min(width - 1, x + i));
                    const weight = kernel[i + radius];
                    sum += data[y * width + xi] * weight;
                    weightSum += weight;
                }
                
                temp[y * width + x] = sum / weightSum;
            }
        }
        
        // 垂直方向
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let weightSum = 0;
                
                for (let i = -radius; i <= radius; i++) {
                    const yi = Math.max(0, Math.min(height - 1, y + i));
                    const weight = kernel[i + radius];
                    sum += temp[yi * width + x] * weight;
                    weightSum += weight;
                }
                
                result[y * width + x] = sum / weightSum;
            }
        }
        
        return result;
    }

    private generateGaussianKernel(sigma: number): number[] {
        const radius = Math.ceil(sigma * 3);
        const size = radius * 2 + 1;
        const kernel = new Array(size);
        const sigma2 = sigma * sigma;
        
        let sum = 0;
        for (let i = 0; i < size; i++) {
            const x = i - radius;
            kernel[i] = Math.exp(-(x * x) / (2 * sigma2));
            sum += kernel[i];
        }
        
        // 正規化
        for (let i = 0; i < size; i++) {
            kernel[i] /= sum;
        }
        
        return kernel;
    }

    // 簡易エッジ検出
    private getSimpleEdgeX(data: Uint8ClampedArray, x: number, y: number, width: number): number {
        const getGray = (x: number, y: number) => {
            const idx = (y * width + x) * 4;
            return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        };
        
        return getGray(x + 1, y) - getGray(x - 1, y);
    }

    private getSimpleEdgeY(data: Uint8ClampedArray, x: number, y: number, width: number): number {
        const getGray = (x: number, y: number) => {
            const idx = (y * width + x) * 4;
            return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        };
        
        return getGray(x, y + 1) - getGray(x, y - 1);
    }

    // 色彩度計算
    private getColorSaturation(r: number, g: number, b: number): number {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return max === 0 ? 0 : ((max - min) / max) * 100;
    }

    // モルフォロジー処理：膨張（Dilation）
    private morphologyDilate(mask: boolean[], width: number, height: number): boolean[] {
        const result = new Array(width * height).fill(false);
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0],  [0, 0],  [1, 0],
            [-1, 1],  [0, 1],  [1, 1]
        ];
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                
                // 近傍に被写体ピクセルがあれば真
                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        if (mask[ny * width + nx]) {
                            result[idx] = true;
                            break;
                        }
                    }
                }
            }
        }
        
        return result;
    }
    
    // モルフォロジー処理：収縮（Erosion）
    private morphologyErode(mask: boolean[], width: number, height: number): boolean[] {
        const result = new Array(width * height).fill(false);
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0],  [0, 0],  [1, 0],
            [-1, 1],  [0, 1],  [1, 1]
        ];
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                
                // すべての近傍が被写体ピクセルの場合のみ真
                let allNeighborsTrue = true;
                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height || !mask[ny * width + nx]) {
                        allNeighborsTrue = false;
                        break;
                    }
                }
                
                result[idx] = allNeighborsTrue;
            }
        }
        
        return result;
    }

    // iOS26風：視差効果レンダリング（高度な3D変換と視覚効果）
    private renderSpatialScene(): void {
        if (!this.currentImage || !this.depthMap) return;
        this.logDebug('[renderSpatialScene] tiltX:', this.tiltX, 'tiltY:', this.tiltY);

        this.resultCtx.clearRect(0, 0, this.resultCanvas.width, this.resultCanvas.height);

        const intensity = (document.getElementById('spatialIntensity') as HTMLInputElement).valueAsNumber;
        
        // 元画像データを取得
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = this.currentImage.width;
        sourceCanvas.height = this.currentImage.height;
        const sourceCtx = sourceCanvas.getContext('2d')!;
        sourceCtx.drawImage(this.currentImage, 0, 0);
        const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        
        const scaleX = this.resultCanvas.width / sourceCanvas.width;
        const scaleY = this.resultCanvas.height / sourceCanvas.height;
        
        // 高度な視差効果でよりリアルな3D表現
        this.renderAdvancedParallaxEffect(sourceImageData, this.depthMap, scaleX, scaleY, intensity);
    }

    // iOS26風：高度な視差効果レンダリング（物理ベースの3D変換）- 最適化版
    private renderAdvancedParallaxEffect(sourceImageData: ImageData, depthMap: ImageData, scaleX: number, scaleY: number, intensity: number): void {
        const width = sourceImageData.width;
        const height = sourceImageData.height;
        const outW = this.resultCanvas.width;
        const outH = this.resultCanvas.height;
        const outImage = this.resultCtx.createImageData(outW, outH);
        const outData = outImage.data;
        
        // 傾きの値を安定化（急激な変化を防止）
        const tiltX = this.tiltX;
        const tiltY = this.tiltY;
        
        // Step1: 強度の推奨上限と最大値の設定
        const recommendedMax = 45;
        const maxIntensity = 60; // 安定性のため少し控えめに
        const safeIntensity = Math.min(intensity, maxIntensity);
        
        // Step2: 高度なイージング関数（カスタムシグモイド）
        const advancedSigmoid = (v: number) => {
            // カスタムシグモイド関数（中間値付近を強調）
            const sharpness = 6.5; // 急峻さを少し抑える
            const offset = 0.5;    // オフセットを中心に
            return 1 / (1 + Math.exp(-sharpness * (v - offset)));
        };
        
        // Step3: 視差効果の最大シフト量（画像サイズに対する割合）- 控えめに設定
        const maxShiftX = width * 0.05;
        const maxShiftY = height * 0.045;
        
        // Step4: 物理ベースの3D変換パラメータ（安定性向上）
        const focalLength = 400; // 仮想的な焦点距離
        const basePlaneDepth = 450; // 基準深度面
        
        // 深度マップの前処理（パフォーマンス向上のためダウンサンプリング）
        const downsampleFactor = Math.min(width, height) > 800 ? 2 : 1; // 大きな画像の場合はダウンサンプリング
        let processedDepthMap;
        
        if (downsampleFactor === 1) {
            // 小〜中サイズ画像はバイラテラルフィルタを適用
            processedDepthMap = this.applyBilateralFilterToDepth(depthMap, width, height);
        } else {
            // 大きな画像は単純なブラーを適用（パフォーマンス向上）
            processedDepthMap = depthMap.data.slice();
        }
        
        // エッジ情報の事前計算（パフォーマンス向上）
        const edgeInfo = new Float32Array(width * height);
        for (let y = 1; y < height - 1; y += downsampleFactor) {
            for (let x = 1; x < width - 1; x += downsampleFactor) {
                const idx = (y * width + x) * 4;
                if (x % downsampleFactor === 0 && y % downsampleFactor === 0) {
                    const dx = (depthMap.data[idx] - depthMap.data[idx + 4]) / 255;
                    const dy = (depthMap.data[idx] - depthMap.data[(y+1) * width + x]) / 255;
                    edgeInfo[y * width + x] = Math.sqrt(dx * dx + dy * dy);
                }
            }
        }
        
        // 出力画像生成（最適化）
        const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
        const centerX = width / 2;
        const centerY = height / 2;
        
        for (let outY = 0; outY < outH; outY++) {
            for (let outX = 0; outX < outW; outX++) {
                const xNorm = outX / scaleX;
                const yNorm = outY / scaleY;
                let srcX = xNorm;
                let srcY = yNorm;
                
                if (safeIntensity !== 0 || tiltX !== 0 || tiltY !== 0) {
                    const ix = Math.min(width - 1, Math.max(0, Math.round(xNorm)));
                    const iy = Math.min(height - 1, Math.max(0, Math.round(yNorm)));
                    const depthIndex = (iy * width + ix) * 4;
                    
                    // 深度値取得と正規化
                    let depth = processedDepthMap[depthIndex] / 255;
                    
                    // 高度なイージング適用
                    depth = advancedSigmoid(depth);
                    const normalizedDepth = (depth - 0.5) * 2;
                    
                    // 視差効果（効率化）
                    const depthFactor = normalizedDepth * safeIntensity * 0.01;
                    
                    // 中心からの相対位置
                    const relX = xNorm - centerX;
                    const relY = yNorm - centerY;
                    
                    // パースペクティブ効果（奥行きによる拡大縮小）- 計算簡略化
                    const persp = 1 + depthFactor * 0.8;
                    const perspX = (relX / persp);
                    const perspY = (relY / persp);
                    
                    // 視差効果（視点移動による見え方の変化）
                    const parallaxX = clamp(tiltY / 45 * depthFactor * 800, -maxShiftX, maxShiftX);
                    const parallaxY = clamp(tiltX / 45 * depthFactor * 700, -maxShiftY, maxShiftY);
                    
                    // 最終的な座標計算
                    srcX = centerX + perspX + parallaxX;
                    srcY = centerY + perspY + parallaxY;
                    
                    // 斜め方向の効果（最適化）
                    if (Math.abs(tiltX) > 10 && Math.abs(tiltY) > 10) {
                        const diagonalFactor = Math.min(1, Math.sqrt(tiltX * tiltX + tiltY * tiltY) / 60);
                        const diagonalShift = diagonalFactor * safeIntensity * 0.06 * normalizedDepth;
                        
                        srcX += diagonalShift * (tiltY / Math.abs(tiltY + 0.001));
                        srcY += diagonalShift * (tiltX / Math.abs(tiltX + 0.001));
                    }
                }
                
                // 範囲外参照時は端の色で埋める
                const sx = Math.max(0, Math.min(width - 1, srcX));
                const sy = Math.max(0, Math.min(height - 1, srcY));
                
                // バイリニア補間による高品質サンプリング
                const x0 = Math.floor(sx);
                const y0 = Math.floor(sy);
                const x1 = Math.min(x0 + 1, width - 1);
                const y1 = Math.min(y0 + 1, height - 1);
                
                const wx = sx - x0;
                const wy = sy - y0;
                
                const idx00 = (y0 * width + x0) * 4;
                const idx01 = (y0 * width + x1) * 4;
                const idx10 = (y1 * width + x0) * 4;
                const idx11 = (y1 * width + x1) * 4;
                
                // 各チャンネルでバイリニア補間
                const outIdx = (outY * outW + outX) * 4;
                
                // 照明効果（最適化）
                const depthIdx = (Math.round(sy) * width + Math.round(sx)) * 4;
                const depthValue = depthMap.data[depthIdx] / 255;
                
                // 深度に応じた影効果（奥ほど暗く）- 軽量化
                const shadowIntensity = 0.12; // 影の強さを控えめに
                let shadow = 1.0 - (1.0 - depthValue) * shadowIntensity;
                
                // 照明効果の簡略化
                let lightEffect = 1.0;
                if (Math.abs(tiltX) > 5 || Math.abs(tiltY) > 5) {
                    const edgeValue = edgeInfo[Math.round(sy) * width + Math.round(sx)];
                    const lightDirX = -tiltY / 45; // 左右の傾きで光の方向が変化
                    const lightDirY = -tiltX / 45; // 上下の傾きで光の方向が変化
                    
                    // 簡略化した照明計算
                    lightEffect = Math.max(0.9, Math.min(1.1, 1 + (lightDirX + lightDirY) * edgeValue * 0.3));
                }
                
                // 色を計算（最適化）
                for (let c = 0; c < 3; c++) {
                    const c00 = sourceImageData.data[idx00 + c];
                    const c01 = sourceImageData.data[idx01 + c];
                    const c10 = sourceImageData.data[idx10 + c];
                    const c11 = sourceImageData.data[idx11 + c];
                    
                    const cx0 = c00 * (1 - wx) + c01 * wx;
                    const cx1 = c10 * (1 - wx) + c11 * wx;
                    const color = cx0 * (1 - wy) + cx1 * wy;
                    
                    // 照明効果を適用
                    outData[outIdx + c] = Math.max(0, Math.min(255, color * shadow * lightEffect));
                }
                
                // アルファチャンネルはそのままコピー
                outData[outIdx + 3] = 255;
            }
        }
        
        this.resultCtx.putImageData(outImage, 0, 0);
        
        // 強度が推奨上限を超えた場合は警告表示
        if (intensity > recommendedMax) {
            const warn = document.getElementById('spatialWarning');
            if (warn) {
                warn.style.display = 'block';
                warn.textContent = '※強度が高すぎると破綻する場合があります（推奨上限: ' + recommendedMax + '）';
            }
        } else {
            const warn = document.getElementById('spatialWarning');
            if (warn) warn.style.display = 'none';
        }
    }
    
    // バイラテラルフィルタによる深度マップの前処理
    private applyBilateralFilterToDepth(depthMap: ImageData, width: number, height: number): Uint8ClampedArray {
        const data = depthMap.data;
        const result = new Uint8ClampedArray(data.length);
        
        const spatialSigma = 3.0;  // 空間的な範囲
        const rangeSigma = 25.0;   // 値の範囲
        
        const spatialRadius = Math.ceil(spatialSigma * 2);
        const spatialKernel = new Array(spatialRadius * 2 + 1);
        
        // 空間カーネルの計算
        for (let i = 0; i <= spatialRadius * 2; i++) {
            const x = i - spatialRadius;
            spatialKernel[i] = Math.exp(-(x * x) / (2 * spatialSigma * spatialSigma));
        }
        
        // バイラテラルフィルタ適用
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const centerIdx = (y * width + x) * 4;
                const centerValue = data[centerIdx];
                
                let sum = 0;
                let totalWeight = 0;
                
                for (let dy = -spatialRadius; dy <= spatialRadius; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= height) continue;
                    
                    for (let dx = -spatialRadius; dx <= spatialRadius; dx++) {
                        const nx = x + dx;
                        if (nx < 0 || nx >= width) continue;
                        
                        const neighborIdx = (ny * width + nx) * 4;
                        const neighborValue = data[neighborIdx];
                        
                        // 空間的な重み
                        const spatialWeight = spatialKernel[dx + spatialRadius] * spatialKernel[dy + spatialRadius];
                        
                        // 値の差に基づく重み
                        const valueDiff = centerValue - neighborValue;
                        const rangeWeight = Math.exp(-(valueDiff * valueDiff) / (2 * rangeSigma * rangeSigma));
                        
                        // 総合的な重み
                        const weight = spatialWeight * rangeWeight;
                        
                        sum += neighborValue * weight;
                        totalWeight += weight;
                    }
                }
                
                // 結果を格納
                const filteredValue = Math.round(sum / totalWeight);
                result[centerIdx] = filteredValue;
                result[centerIdx + 1] = filteredValue;
                result[centerIdx + 2] = filteredValue;
                result[centerIdx + 3] = 255;
            }
        }
        
        return result;
    }

    // デバッグログをdebug-panelに出力
    private logDebug(...args: any[]): void {
        const logDiv = document.getElementById('debugLog');
        if (logDiv) {
            const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            const line = document.createElement('div');
            line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            logDiv.appendChild(line);
            while (logDiv.childNodes.length > 50) logDiv.removeChild(logDiv.firstChild!);
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        if (window.console) console.log(...args);
    }

    // 進捗バー表示
    private showProgressBar() {
        const bar = document.getElementById('progressBarContainer');
        if (bar) bar.style.display = 'block';
        this.updateProgressBar(0);
    }
    
    private updateProgressBar(percent: number) {
        const bar = document.getElementById('progressBar') as HTMLDivElement;
        if (bar) bar.style.width = `${percent}%`;
    }
    
    private hideProgressBar() {
        const bar = document.getElementById('progressBarContainer');
        if (bar) bar.style.display = 'none';
        this.updateProgressBar(0);
    }

    private saveResult(): void {
        if (!this.currentImage) return;

        // 結果キャンバスをダウンロード
        const link = document.createElement('a');
        link.download = 'spatial_scene_result.png';
        link.href = this.resultCanvas.toDataURL();
        link.click();
        
        this.logDebug('[saveResult] 空間シーン結果を保存しました');
    }

    private loadSampleImage(): void {
        // サンプル画像を生成（グラデーション）
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d')!;

        // グラデーション背景
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(0.5, '#4ecdc4');
        gradient.addColorStop(1, '#45b7d1');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 幾何学的図形を描画
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(canvas.width * 0.3, canvas.height * 0.3, 50, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ff9f43';
        ctx.fillRect(canvas.width * 0.6, canvas.height * 0.2, 80, 80);

        ctx.fillStyle = '#00d2d3';
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.2, canvas.height * 0.8);
        ctx.lineTo(canvas.width * 0.5, canvas.height * 0.6);
        ctx.lineTo(canvas.width * 0.35, canvas.height * 0.9);
        ctx.closePath();
        ctx.fill();

        // キャンバスから画像を作成
        const img = new Image();
        img.onload = () => {
            this.currentImage = img;
            this.drawOriginalImage();
            this.updateSpatialDisplay();
        };
        img.src = canvas.toDataURL();
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    new SpatialSceneConverter();
});