/**
 * 3DS風立体視ビューアー TypeScript版
 * 画像・動画両対応、UIバグ修正、動画再生/停止制御
 */
interface StereoscopicSettings {
    depthOffset: number;
    convergence: number;
    scale: number;
    eyeComfortMode: boolean;
}

type MediaType = 'image' | 'video';

class StereoscopicViewer {
    private mediaType: MediaType = 'image';
    private image: HTMLImageElement | null = null;
    private video: HTMLVideoElement | null = null;
    private videoFrameCanvas: HTMLCanvasElement;
    private settings: StereoscopicSettings = {
        depthOffset: 10,
        convergence: 0,
        scale: 1.0,
        eyeComfortMode: false
    };
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private videoElement: HTMLVideoElement;

    constructor() {
        this.canvas = document.getElementById('anaglyphCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.videoElement = document.getElementById('anaglyphVideo') as HTMLVideoElement;
        this.videoFrameCanvas = document.createElement('canvas');
        this.initEventListeners();
        window.addEventListener('resize', this._resizeViewerHandler);
    }

    private initEventListeners() {
        const mediaInput = document.getElementById('mediaInput') as HTMLInputElement;
        const showImageBtn = document.getElementById('showImageBtn') as HTMLButtonElement;
        const showVideoBtn = document.getElementById('showVideoBtn') as HTMLButtonElement;
        if (mediaInput) {
            mediaInput.addEventListener('change', (e) => this.handleMediaUpload(e));
        }
        if (showImageBtn) {
            showImageBtn.addEventListener('click', () => this.switchMode('image'));
        }
        if (showVideoBtn) {
            showVideoBtn.addEventListener('click', () => this.switchMode('video'));
        }
        // 動画再生/停止制御
        this.videoElement.addEventListener('play', () => this.playAnaglyphVideo());
        this.videoElement.addEventListener('pause', () => {/* 停止時は何もしない */});

        // --- 動画コントロールUI追加 ---
        this.addVideoControls();
    }

    private addVideoControls() {
        // すでに追加済みなら何もしない
        if (document.getElementById('videoControlBar')) return;
        const viewer = document.getElementById('stereoscopicViewer');
        if (!viewer) return;
        const bar = document.createElement('div');
        bar.id = 'videoControlBar';
        bar.style.display = 'flex';
        bar.style.justifyContent = 'center';
        bar.style.alignItems = 'center';
        bar.style.gap = '12px';
        bar.style.margin = '0 auto 8px auto';
        bar.style.userSelect = 'none';
        bar.style.position = 'absolute';
        bar.style.left = '50%';
        bar.style.bottom = '12px';
        bar.style.transform = 'translateX(-50%)';
        bar.style.zIndex = '30';
        bar.style.background = 'rgba(30,44,80,0.85)';
        bar.style.borderRadius = '8px';
        bar.style.padding = '8px 10px';
        bar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)';
        bar.style.width = 'calc(100% - 32px)';
        bar.style.maxWidth = '900px';
        bar.style.pointerEvents = 'auto';

        // 再生/停止
        const playBtn = document.createElement('button');
        playBtn.textContent = '▶️';
        playBtn.title = '再生';
        playBtn.onclick = () => { this.videoElement.play(); };
        const pauseBtn = document.createElement('button');
        pauseBtn.textContent = '⏸️';
        pauseBtn.title = '一時停止';
        pauseBtn.onclick = () => { this.videoElement.pause(); };
        // 巻き戻し/早送り
        const rewindBtn = document.createElement('button');
        rewindBtn.textContent = '⏪ 5s';
        rewindBtn.title = '5秒戻す';
        rewindBtn.onclick = () => { this.videoElement.currentTime = Math.max(0, this.videoElement.currentTime - 5); };
        const forwardBtn = document.createElement('button');
        forwardBtn.textContent = '5s ⏩';
        forwardBtn.title = '5秒進める';
        forwardBtn.onclick = () => { this.videoElement.currentTime = Math.min(this.videoElement.duration, this.videoElement.currentTime + 5); };
        // シークバー
        const seek = document.createElement('input');
        seek.type = 'range';
        seek.min = '0';
        seek.max = '1000';
        seek.value = '0';
        seek.style.width = '180px';
        seek.oninput = () => {
            if (this.videoElement.duration) {
                this.videoElement.currentTime = (parseFloat(seek.value) / 1000) * this.videoElement.duration;
            }
        };
        this.videoElement.addEventListener('timeupdate', () => {
            if (this.videoElement.duration) {
                seek.value = String(Math.floor((this.videoElement.currentTime / this.videoElement.duration) * 1000));
            }
        });
        // 音量
        const volume = document.createElement('input');
        volume.type = 'range';
        volume.min = '0';
        volume.max = '1';
        volume.step = '0.01';
        volume.value = String(this.videoElement.volume);
        volume.style.width = '80px';
        volume.title = '音量';
        volume.oninput = () => {
            this.videoElement.volume = parseFloat(volume.value);
        };
        this.videoElement.addEventListener('volumechange', () => {
            volume.value = String(this.videoElement.volume);
        });
        // フルスクリーン
        const fsBtn = document.createElement('button');
        fsBtn.textContent = '⛶';
        fsBtn.title = 'フルスクリーン';
        fsBtn.onclick = () => {
            if (viewer.requestFullscreen) viewer.requestFullscreen();
            else if ((viewer as any).webkitRequestFullscreen) (viewer as any).webkitRequestFullscreen();
        };
        // バーに追加
        bar.appendChild(rewindBtn);
        bar.appendChild(playBtn);
        bar.appendChild(pauseBtn);
        bar.appendChild(forwardBtn);
        bar.appendChild(seek);
        bar.appendChild(volume);
        bar.appendChild(fsBtn);
        // 既存のvideoの下ではなくcanvas-area内の一番上に追加
        viewer.appendChild(bar);
        // フルスクリーン時に動画サイズを最大化
        document.addEventListener('fullscreenchange', () => this.handleFullscreenResize());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenResize());
        // 動画モードのみ表示
        const updateBar = () => {
            bar.style.display = this.mediaType === 'video' ? 'flex' : 'none';
        };
        updateBar();
        // モード切替時に表示/非表示を更新
        const origSwitchMode = this.switchMode.bind(this);
        this.switchMode = (type: MediaType) => {
            origSwitchMode(type);
            updateBar();
        };
    }

    private switchMode(type: MediaType) {
        this.mediaType = type;
        document.getElementById('showImageBtn')?.classList.toggle('active', type === 'image');
        document.getElementById('showVideoBtn')?.classList.toggle('active', type === 'video');
        if (type === 'image') {
            this.canvas.style.display = '';
            this.videoElement.style.display = 'none';
            if (this.image) this.drawAnaglyphImage();
        } else {
            this.canvas.style.display = '';
            this.videoElement.style.display = '';
            if (this.video) this.playAnaglyphVideo();
        }
    }

    private handleMediaUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        if (file.type.startsWith('image/')) {
            this.loadImage(file);
            this.switchMode('image');
        } else if (file.type.startsWith('video/')) {
            this.loadVideo(file);
            this.switchMode('video');
        }
    }

    private loadImage(file: File) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.resizeViewer();
                this.drawAnaglyphImage();
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    }

    private loadVideo(file: File) {
        const url = URL.createObjectURL(file);
        this.videoElement.src = url;
        this.videoElement.currentTime = 0;
        this.videoElement.muted = true;
        this.videoElement.onloadedmetadata = () => {
            this.resizeViewer();
            this.playAnaglyphVideo();
        };
        this.video = this.videoElement;
    }

    private resizeViewer() {
        let w = 900, h = 480;
        if (this.mediaType === 'image' && this.image) {
            const aspect = this.image.width / this.image.height;
            w = Math.min(900, window.innerWidth - 40);
            h = w / aspect;
            if (h > 480) { h = 480; w = h * aspect; }
        } else if (this.mediaType === 'video' && this.video) {
            const aspect = this.video.videoWidth / this.video.videoHeight;
            w = Math.min(900, window.innerWidth - 40);
            h = w / aspect;
            if (h > 480) { h = 480; w = h * aspect; }
        }
        this.canvas.width = w;
        this.canvas.height = h;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.videoElement.width = w;
        this.videoElement.height = h;
        this.videoElement.style.width = w + 'px';
        this.videoElement.style.height = h + 'px';
    }

    private drawAnaglyphImage() {
        if (!this.image) return;
        const w = this.canvas.width, h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);
        // 左目
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.drawImage(this.image, -this.settings.depthOffset, 0, w, h);
        let left = this.ctx.getImageData(0, 0, w, h);
        // 右目
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.drawImage(this.image, this.settings.depthOffset, 0, w, h);
        let right = this.ctx.getImageData(0, 0, w, h);
        // アナグリフ合成
        for (let i = 0; i < left.data.length; i += 4) {
            left.data[i] = left.data[i]; // R:左
            left.data[i+1] = right.data[i+1]; // G:右
            left.data[i+2] = right.data[i+2]; // B:右
        }
        this.ctx.putImageData(left, 0, 0);
    }

    private playAnaglyphVideo() {
        if (!this.video) return;
        const w = this.canvas.width, h = this.canvas.height;
        this.videoFrameCanvas.width = w;
        this.videoFrameCanvas.height = h;
        const vctx = this.videoFrameCanvas.getContext('2d')!;
        const render = () => {
            if (this.mediaType !== 'video' || this.video!.paused || this.video!.ended) return;
            vctx.clearRect(0, 0, w, h);
            // 左目
            vctx.drawImage(this.video!, -this.settings.depthOffset, 0, w, h);
            let left = vctx.getImageData(0, 0, w, h);
            // 右目
            vctx.clearRect(0, 0, w, h);
            vctx.drawImage(this.video!, this.settings.depthOffset, 0, w, h);
            let right = vctx.getImageData(0, 0, w, h);
            // アナグリフ合成
            for (let i = 0; i < left.data.length; i += 4) {
                left.data[i] = left.data[i];
                left.data[i+1] = right.data[i+1];
                left.data[i+2] = right.data[i+2];
            }
            this.ctx.putImageData(left, 0, 0);
            requestAnimationFrame(render);
        };
        this.video!.play();
        render();
    }

    private handleFullscreenResize() {
        const viewer = document.getElementById('stereoscopicViewer');
        if (!viewer) return;
        // フルスクリーン中かどうかを判定
        const isFullscreen = document.fullscreenElement === viewer || (document as any).webkitFullscreenElement === viewer;
        if (isFullscreen) {
            // サイズを最大化
            viewer.style.width = '100vw';
            viewer.style.height = '100vh';
            this.canvas.style.width = '100vw';
            this.canvas.style.height = '100vh';
            this.videoElement.style.width = '100vw';
            this.videoElement.style.height = '100vh';
            // resizeViewerの自動呼び出しを一時的に無効化
            window.removeEventListener('resize', this._resizeViewerHandler);
        } else {
            // 通常時: スタイルをリセット
            viewer.style.width = '';
            viewer.style.height = '';
            this.canvas.style.width = '';
            this.canvas.style.height = '';
            this.videoElement.style.width = '';
            this.videoElement.style.height = '';
            // resizeViewerの自動呼び出しを復活
            window.addEventListener('resize', this._resizeViewerHandler);
            this.resizeViewer();
        }
    }

    // resizeViewerのイベントハンドラをプロパティ化
    private _resizeViewerHandler = () => this.resizeViewer();
}

declare global {
    interface Window {
        viewer: StereoscopicViewer;
    }
}
export {};

window.addEventListener('DOMContentLoaded', () => {
    window.viewer = new StereoscopicViewer();
});