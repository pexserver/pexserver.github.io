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

    constructor() {
        this.originalCanvas = document.getElementById('originalCanvas') as HTMLCanvasElement;
        this.resultCanvas = document.getElementById('resultCanvas') as HTMLCanvasElement;
        this.originalCtx = this.originalCanvas.getContext('2d')!;
        this.resultCtx = this.resultCanvas.getContext('2d')!;
        this.detectMobileDevice();
        this.initializeEventListeners();
        this.setupDeviceMotion();
        this.loadSampleImage();
        this.setupFullscreen();
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
            // 10fps（100ms間隔）で間引き
            const now = Date.now();
            if (now - lastUpdate < 100) return;
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
            // ノイズ除去（小さい揺れは無視）
            if (Math.abs(deltaX) < 0.5) deltaX = 0;
            if (Math.abs(deltaY) < 0.5) deltaY = 0;
            // 端末傾きの物理的な最大値を考慮し、よりリアルなスケーリング
            this.tiltX = Math.max(-30, Math.min(30, deltaX * 0.7));
            this.tiltY = Math.max(-30, Math.min(30, deltaY * 1.1));
            // 慣性効果（前回値との補間で滑らかに）
            this.tiltX = this.tiltX * 0.7 + (this.tiltX || 0) * 0.3;
            this.tiltY = this.tiltY * 0.7 + (this.tiltY || 0) * 0.3;
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
        document.getElementById('fullscreenSpatial')?.addEventListener('click', () => {
            // setupFullscreenで処理
        });

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
        // this.stopDeviceMotion(); // ←イベント解除はしない
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

        // iOS26風：マウス操作を端末の傾きに変換（斜め方向対応）
        this.tiltX += deltaY * 0.3;
        this.tiltY += deltaX * 0.3;

        // 傾き制限（斜め方向も自然な範囲内）
        this.tiltX = Math.max(-45, Math.min(45, this.tiltX));
        this.tiltY = Math.max(-45, Math.min(45, this.tiltY));

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

    // iOS26風：AI解析による深度推定（被写体セグメンテーション+高度な深度推定）
    private analyzeDepthFromImage(imageData: ImageData): ImageData {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        // 第1段階：被写体検出（簡易セグメンテーション）
        const subjectMask = this.detectSubjectRegions(imageData);
        // 第2段階：深度マップ生成
        const depthData = new ImageData(width, height);
        const depth = depthData.data;
        const tempDepth = new Float32Array(width * height);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                const linearIdx = y * width + x;
                // 現在のピクセルの明度・色相・コントラスト
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
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
                // コントラスト（近傍との明度差）
                const getGray = (xx: number, yy: number) => {
                    const i = (yy * width + xx) * 4;
                    return (data[i] + data[i + 1] + data[i + 2]) / 3;
                };
                let localContrast = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        localContrast += Math.abs(brightness - getGray(x + dx, y + dy));
                    }
                }
                localContrast /= 8;
                // テクスチャ変化（Sobelエッジ）
                const edgeX = this.getSimpleEdgeX(data, x, y, width);
                const edgeY = this.getSimpleEdgeY(data, x, y, width);
                const edgeMagnitude = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
                // 中央重要度
                const centerX = width / 2;
                const centerY = height / 2;
                const distFromCenter = Math.sqrt((x - centerX) * (x - centerX) + (y - centerY) * (y - centerY));
                const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
                const centralityScore = 1 - (distFromCenter / maxDist);
                // 被写体マスクの影響
                const isSubject = subjectMask[linearIdx];
                // 深度計算：よりリアルな3D効果
                let depthValue = 128; // 基準値
                if (isSubject) {
                    depthValue = 210; // 手前
                    // 被写体内でも明度・コントラスト・テクスチャで微調整
                    depthValue += (brightness - 128) * 0.18;
                    depthValue += Math.min(40, edgeMagnitude * 0.18);
                    depthValue += localContrast * 0.25;
                } else {
                    depthValue = 70; // 奥
                    // 背景でも色相・明度・テクスチャで距離感
                    depthValue += (hue > 180 ? (hue - 180) : 0) * 0.08; // 青系は奥
                    depthValue += (128 - brightness) * 0.08;
                    depthValue += centralityScore * 18;
                    depthValue += localContrast * 0.12;
                }
                // 境界付近で深度の急変を強調
                if (edgeMagnitude > 30) {
                    depthValue += isSubject ? 10 : -10;
                }
                // 中央重要度で全体調整
                depthValue += centralityScore * 12;
                // 0-255の範囲にクランプ
                tempDepth[linearIdx] = Math.max(0, Math.min(255, depthValue));
            }
        }
        // 第3段階：ガウシアンブラーで滑らかに（境界はやや強め）
        const blurredDepth = this.applyGaussianBlur(tempDepth, width, height, 2.2);
        // 境界ブレンド
        for (let i = 0; i < width * height; i++) {
            const pixelIdx = i * 4;
            let depthVal = Math.round(blurredDepth[i]);
            // 境界付近は深度を滑らかに補間
            if (i > width && i < width * (height - 1)) {
                const diff = Math.abs(blurredDepth[i] - blurredDepth[i - 1]) + Math.abs(blurredDepth[i] - blurredDepth[i + 1]);
                if (diff > 20) {
                    depthVal = Math.round((blurredDepth[i] + blurredDepth[i - 1] + blurredDepth[i + 1]) / 3);
                }
            }
            depth[pixelIdx] = depthVal;
            depth[pixelIdx + 1] = depthVal;
            depth[pixelIdx + 2] = depthVal;
            depth[pixelIdx + 3] = 255;
        }
        return depthData;
    }

    // iOS26風：被写体領域検出（簡易セグメンテーション）
    private detectSubjectRegions(imageData: ImageData): boolean[] {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const mask = new Array(width * height).fill(false);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const linearIdx = y * width + x;

                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // 肌色検出（人物被写体）
                const isSkinTone = this.isSkinColor(r, g, b);

                // 鮮やかな色検出（物体被写体）
                const saturation = this.getColorSaturation(r, g, b);
                const isVividColor = saturation > 50;

                // 中央重要度
                const centerX = width / 2;
                const centerY = height / 2;
                const distFromCenter = Math.sqrt((x - centerX) * (x - centerX) + (y - centerY) * (y - centerY));
                const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
                const isCentral = (distFromCenter / maxDist) < 0.6;

                // 被写体判定
                mask[linearIdx] = (isSkinTone || (isVividColor && isCentral));
            }
        }

        // モルフォロジー処理で雑音除去
        return this.morphologyClose(mask, width, height);
    }

    // 肌色判定
    private isSkinColor(r: number, g: number, b: number): boolean {
        // HSV変換による肌色判定
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        if (max === 0) return false;

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

        // 肌色の範囲：色相10-40度、彩度20-80%、明度30-90%
        return (hue >= 10 && hue <= 40) &&
            (saturation >= 20 && saturation <= 80) &&
            (value >= 30 && value <= 90);
    }

    // 色彩度計算
    private getColorSaturation(r: number, g: number, b: number): number {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return max === 0 ? 0 : ((max - min) / max) * 100;
    }

    // モルフォロジークロージング（簡易版）
    private morphologyClose(mask: boolean[], width: number, height: number): boolean[] {
        // 膨張→収縮でノイズ除去と穴埋め
        const dilated = this.morphologyDilate(mask, width, height);
        return this.morphologyErode(dilated, width, height);
    }

    private morphologyDilate(mask: boolean[], width: number, height: number): boolean[] {
        const result = new Array(width * height).fill(false);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                result[idx] = mask[idx] ||
                    mask[idx - 1] || mask[idx + 1] ||
                    mask[idx - width] || mask[idx + width];
            }
        }
        return result;
    }

    private morphologyErode(mask: boolean[], width: number, height: number): boolean[] {
        const result = new Array(width * height).fill(false);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                result[idx] = mask[idx] &&
                    mask[idx - 1] && mask[idx + 1] &&
                    mask[idx - width] && mask[idx + width];
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

    // iOS26風：空間シーンレンダリング
    private renderSpatialScene(): void {
        this.logDebug('[renderSpatialScene] tiltX:', this.tiltX, 'tiltY:', this.tiltY);
        if (!this.currentImage || !this.depthMap) return;

        this.resultCtx.clearRect(0, 0, this.resultCanvas.width, this.resultCanvas.height);

        const intensity = (document.getElementById('spatialIntensity') as HTMLInputElement)?.valueAsNumber ?? 50;
        // 端切れ防止：画像を自動拡大（パララックス最大シフト量の1.15倍）
        const scaleMargin = 1.15;
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = Math.round(this.currentImage.width * scaleMargin);
        sourceCanvas.height = Math.round(this.currentImage.height * scaleMargin);
        const sourceCtx = sourceCanvas.getContext('2d')!;
        sourceCtx.drawImage(
            this.currentImage,
            (sourceCanvas.width - this.currentImage.width) / 2,
            (sourceCanvas.height - this.currentImage.height) / 2,
            this.currentImage.width,
            this.currentImage.height
        );
        const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const scaleX = this.resultCanvas.width / sourceCanvas.width;
        const scaleY = this.resultCanvas.height / sourceCanvas.height;
        this.renderParallaxEffect(sourceImageData, this.depthMap, scaleX, scaleY, intensity);
    }

    // iOS26風：視差効果レンダリング（逆写像・高画質・イージング強化）
    private renderParallaxEffect(sourceImageData: ImageData, depthMap: ImageData, scaleX: number, scaleY: number, intensity: number): void {
        const width = sourceImageData.width;
        const height = sourceImageData.height;
        const outW = this.resultCanvas.width;
        const outH = this.resultCanvas.height;
        const outImage = this.resultCtx.createImageData(outW, outH);
        const outData = outImage.data;
        const tiltX = this.tiltX;
        const tiltY = this.tiltY;
        const recommendedMax = 40;
        const maxIntensity = 60;
        const safeIntensity = Math.min(intensity, maxIntensity);
        // sigmoidイージング+三次イージングで奥行き感を強調
        const ease = (v: number) => {
            const s = 1 / (1 + Math.exp(-6 * (v - 0.5)));
            return s * s * (3 - 2 * s); // sigmoid × cubic
        };
        const maxShiftX = width * 0.05;
        const maxShiftY = height * 0.05;
        for (let outY = 0; outY < outH; outY++) {
            for (let outX = 0; outX < outW; outX++) {
                const xNorm = outX / scaleX;
                const yNorm = outY / scaleY;
                let srcX = xNorm;
                let srcY = yNorm;
                if (safeIntensity !== 0 || tiltX !== 0 || tiltY !== 0) {
                    const centerX = width / 2;
                    const centerY = height / 2;
                    const ix = Math.round(srcX);
                    const iy = Math.round(srcY);
                    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
                    const safeIx = clamp(ix, 0, width - 1);
                    const safeIy = clamp(iy, 0, height - 1);
                    const depthIndex = (safeIy * width + safeIx) * 4;
                    let depth = depthMap.data[depthIndex] / 255;
                    depth = ease(depth);
                    const normalizedDepth = (depth - 0.5) * 2;
                    const persp = 1 + normalizedDepth * safeIntensity * 0.008;
                    const parallaxX = clamp(normalizedDepth * safeIntensity * 0.18 * (tiltY / 45), -maxShiftX, maxShiftX);
                    const parallaxY = clamp(normalizedDepth * safeIntensity * 0.13 * (tiltX / 45), -maxShiftY, maxShiftY);
                    const diagonalEffect = Math.sqrt(tiltX * tiltX + tiltY * tiltY) / 45;
                    const extraDepthShift = clamp(normalizedDepth * diagonalEffect * safeIntensity * 0.05, -maxShiftX, maxShiftX);
                    srcX = ((xNorm - parallaxX) - centerX) / persp + centerX;
                    srcY = ((yNorm - parallaxY) - centerY) / persp + centerY;
                    srcX += extraDepthShift * (tiltY / 45) * 0.5;
                    srcY += extraDepthShift * (tiltX / 45) * 0.3;
                }
                const sx = Math.round(Math.max(0, Math.min(width - 1, srcX)));
                const sy = Math.round(Math.max(0, Math.min(height - 1, srcY)));
                const srcIdx = (sy * width + sx) * 4;
                const outIdx = (outY * outW + outX) * 4;
                let shadow = 1.0 - (depthMap.data[(sy * width + sx) * 4] / 255) * 0.13;
                outData[outIdx] = Math.max(0, Math.min(255, sourceImageData.data[srcIdx] * shadow));
                outData[outIdx + 1] = Math.max(0, Math.min(255, sourceImageData.data[srcIdx + 1] * shadow));
                outData[outIdx + 2] = Math.max(0, Math.min(255, sourceImageData.data[srcIdx + 2] * shadow));
                outData[outIdx + 3] = sourceImageData.data[srcIdx + 3];
            }
        }
        this.resultCtx.putImageData(outImage, 0, 0);
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

    // サンプル画像を生成して表示
    private loadSampleImage(): void {
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
        // 幾何学的図形
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
        // 画像化
        const img = new Image();
        img.onload = () => {
            this.currentImage = img;
            this.drawOriginalImage();
            this.updateSpatialDisplay();
        };
        img.src = canvas.toDataURL();
    }

    // 結果キャンバスを画像として保存
    private saveResult(): void {
        if (!this.currentImage) return;
        const link = document.createElement('a');
        link.download = 'spatial_scene_result.png';
        link.href = this.resultCanvas.toDataURL();
        link.click();
        this.logDebug('[saveResult] 空間シーン結果を保存しました');
    }

    // フルスクリーン切替（test.html対応）
    private setupFullscreen(): void {
        const btn = document.getElementById('fullscreenSpatial');
        if (!btn && document.getElementById('resultCanvas')) {
            // test.html用にボタンを動的追加
            const testBtn = document.createElement('button');
            testBtn.id = 'fullscreenSpatial';
            testBtn.textContent = '🖥️ フルスクリーン';
            testBtn.className = 'ios-button';
            testBtn.style.margin = '8px 0';
            document.getElementById('resultCanvas')!.parentElement?.insertBefore(testBtn, document.getElementById('resultCanvas'));
        }
        const fsBtn = document.getElementById('fullscreenSpatial');
        if (!fsBtn) return;
        fsBtn.addEventListener('click', () => {
            const elem = this.resultCanvas as any;
            const isWebkitFs = (document as any).webkitFullscreenElement;
            if (!document.fullscreenElement && !isWebkitFs) {
                if (elem.requestFullscreen) {
                    elem.requestFullscreen();
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen(); // iOS Safari
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if ((document as any).webkitExitFullscreen) {
                    (document as any).webkitExitFullscreen(); // iOS Safari
                }
            }
        });
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement === this.resultCanvas) {
                fsBtn.textContent = '⏹️ フルスクリーン解除';
                fsBtn.classList.add('spatial-active');
            } else {
                fsBtn.textContent = '🖥️ フルスクリーン';
                fsBtn.classList.remove('spatial-active');
            }
        });
        // iOS Safari用: webkitfullscreenchangeイベントも監視
        document.addEventListener('webkitfullscreenchange', () => {
            const isFs = document.fullscreenElement === this.resultCanvas || (document as any).webkitFullscreenElement === this.resultCanvas;
            if (isFs) {
                fsBtn.textContent = '⏹️ フルスクリーン解除';
                fsBtn.classList.add('spatial-active');
            } else {
                fsBtn.textContent = '🖥️ フルスクリーン';
                fsBtn.classList.remove('spatial-active');
            }
        });
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
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    new SpatialSceneConverter();
});