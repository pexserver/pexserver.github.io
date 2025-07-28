// camera_fixed.js - CameraTesterクラス完全修正版
class CameraTester {
    // WebGLリソース解放
    _disposeWebGL() {
        if (this._gl) {
            const gl = this._gl;
            if (this._glTex0) gl.deleteTexture(this._glTex0);
            if (this._glTex1) gl.deleteTexture(this._glTex1);
            if (this._glCanvas && this._glCanvas.parentNode) this._glCanvas.parentNode.removeChild(this._glCanvas);
            // プログラムやバッファも解放したい場合はここで
            // gl.deleteProgram(...), gl.deleteBuffer(...) など
            this._gl = null;
            this._glTex0 = null;
            this._glTex1 = null;
            this._glCanvas = null;
        }
    }
    // --- WebGL差分用 ---
    _initWebGLDiff(w, h) {
        if (this._gl && this._gl.canvas.width === w && this._gl.canvas.height === h) return;
        const glCanvas = document.createElement('canvas');
        glCanvas.width = w;
        glCanvas.height = h;
        const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
        if (!gl) throw new Error('WebGL not supported');
        // 頂点シェーダ
        const vsSource = `attribute vec2 a;varying vec2 v;void main(){v=a*0.5+0.5;gl_Position=vec4(a,0,1);}`;
        // フラグメントシェーダ（RGB+輝度差分）
        const fsSource = `precision mediump float;uniform sampler2D t0;uniform sampler2D t1;varying vec2 v;void main(){vec4 c0=texture2D(t0,v),c1=texture2D(t1,v);float y0=dot(c0.rgb,vec3(0.299,0.587,0.114)),y1=dot(c1.rgb,vec3(0.299,0.587,0.114));float d=max(abs(y0-y1),max(abs(c0.r-c1.r),max(abs(c0.g-c1.g),abs(c0.b-c1.b))));gl_FragColor=vec4(d,d,d,1);}`;
        function compile(gl,src,type){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;}
        const vs=compile(gl,vsSource,gl.VERTEX_SHADER),fs=compile(gl,fsSource,gl.FRAGMENT_SHADER);
        const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);gl.useProgram(prog);
        // 頂点バッファ
        const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
        const loc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
        // テクスチャ2つ
        function createTex(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
        const tex0=createTex(),tex1=createTex();
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex0);
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tex1);
        gl.uniform1i(gl.getUniformLocation(prog,'t0'),0);
        gl.uniform1i(gl.getUniformLocation(prog,'t1'),1);
        this._gl = gl;
        this._glCanvas = glCanvas;
        this._glTex0 = tex0;
        this._glTex1 = tex1;
    }

    // WebGLで差分割合を計算
    _calcWebGLDiffRatio(img0, img1, w, h, threshold=10) {
        this._initWebGLDiff(w, h);
        const gl = this._gl;
        // img0, img1: Uint8ClampedArray (RGBA)
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._glTex0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, img0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._glTex1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, img1);
        gl.viewport(0,0,w,h);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
        // 差分画像を読む
        const diffPixels = new Uint8Array(w*h*4);
        gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,diffPixels);
        let diffCount = 0;
        for(let i=0;i<diffPixels.length;i+=4){
            if(diffPixels[i]>threshold) diffCount++;
        }
        return diffCount/(w*h);
    }
    // モニターのリフレッシュレート(FPS)を計測する
    async measureMonitorFps() {
        return new Promise(resolve => {
            let last = performance.now();
            let times = [];
            let count = 0;
            function step() {
                const now = performance.now();
                if (count > 0) times.push(now - last);
                last = now;
                count++;
                if (count < 60) {
                    requestAnimationFrame(step);
                } else {
                    const avg = times.reduce((a, b) => a + b, 0) / times.length;
                    const fps = avg ? 1000 / avg : 60;
                    resolve(Math.round(fps));
                }
            }
            requestAnimationFrame(step);
        });
    }
    constructor(listId, videoId, btnId) {
        this.cameraList = document.getElementById(listId);
        this.video = document.getElementById(videoId);
        this.testBtn = document.getElementById(btnId);
        this.infoBtn = document.getElementById('showInfoBtn');
        this.infoModal = document.getElementById('infoModal');
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.infoContent = document.getElementById('cameraInfoContent');
        // 設定モーダル
        this.settingsBtn = document.getElementById('showSettingsBtn');
        this.settingsModal = document.getElementById('settingsModal');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.settingsForm = document.getElementById('cameraSettingsForm');
        this.settingsWidth = document.getElementById('settingsWidth');
        this.settingsHeight = document.getElementById('settingsHeight');
        this.settingsFps = document.getElementById('settingsFps');
        this.currentStream = null;
        this.lastInfo = null;
        this._infoInterval = null;
        // FPS/遅延計測用
        this._frameTimes = [];
        this._lastFrameTime = null;
        this._dynamicFps = null;
        this._latency = null;
        this._rafId = null;
        // 設定値
        this._settingWidth = null;
        this._settingHeight = null;
        this._settingFps = null;
        // canvas要素を生成
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'cameraCanvas';
        this.canvas.style.display = 'block';
        this.canvas.style.background = '#000';
        this.canvas.style.maxWidth = '100%';
        this.canvas.style.borderRadius = '10px';
        this.canvas.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
        // videoの親にcanvasを追加
        const container = document.getElementById('videoContainer') || this.video.parentElement;
        if (container) {
            container.appendChild(this.canvas);
        }
        // videoは非表示
        this.video.style.display = 'none';
        this.init();
    }

    async init() {
        console.log('[CameraTester] init');
        this._monitorFps = null;
        this.measureMonitorFps().then(fps => {
            this._monitorFps = fps;
            if (this.infoModal && this.infoModal.style.display === 'block') {
                this.showInfoModal();
            }
        });
        await this.updateCameraList();
        this.testBtn.addEventListener('click', () => this.handleTestClick());
        if (navigator.mediaDevices) {
            navigator.mediaDevices.addEventListener('devicechange', () => {
                console.log('[CameraTester] devicechange event');
                this.updateCameraList();
            });
        }
        this.cameraList.addEventListener('mousedown', () => {
            console.log('[CameraTester] cameraList mousedown');
            this.updateCameraList();
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('[CameraTester] visibilitychange: visible');
                this.updateCameraList();
            }
        });
        if (this.infoBtn && this.infoModal && this.closeModalBtn && this.infoContent) {
            this.infoBtn.addEventListener('click', () => this.showInfoModal());
            this.closeModalBtn.addEventListener('click', () => this.hideInfoModal());
        }
        if (this.settingsBtn && this.settingsModal && this.closeSettingsBtn && this.settingsForm) {
            this.settingsBtn.addEventListener('click', () => this.showSettingsModal());
            this.closeSettingsBtn.addEventListener('click', () => this.hideSettingsModal());
            const resetBtn = document.getElementById('resetSettingsBtn');
            if (resetBtn) {
                resetBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.settingsWidth.value = '';
                    this.settingsHeight.value = '';
                    this.settingsFps.value = '';
                    this._settingWidth = null;
                    this._settingHeight = null;
                    this._settingFps = null;
                    const err = document.getElementById('settingsError');
                    if (err) err.style.display = 'none';
                });
            }
            this.settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const width = this.settingsWidth.value.trim();
                const height = this.settingsHeight.value.trim();
                const fps = this.settingsFps.value.trim();
                const err = document.getElementById('settingsError');
                let msg = '';
                if (width && (isNaN(width) || width < 1 || width > 7680)) msg = '幅は1～7680の数値で入力してください。';
                else if (height && (isNaN(height) || height < 1 || height > 4320)) msg = '高さは1～4320の数値で入力してください。';
                else if (fps && (isNaN(fps) || fps < 1 || fps > 240)) msg = 'FPSは1～240の数値で入力してください。';
                if (msg) {
                    if (err) { err.textContent = msg; err.style.display = 'block'; }
                    return;
                }
                this._settingWidth = width ? parseInt(width) : null;
                this._settingHeight = height ? parseInt(height) : null;
                this._settingFps = fps ? parseInt(fps) : null;
                if (err) err.style.display = 'none';
                this.hideSettingsModal();
            });
        }
    }

    _setupPiPButton() {
        // videoの親要素にPiPボタンを追加
        const container = document.getElementById('videoContainer') || this.video.parentElement;
        if (!container || document.getElementById('pipBtn')) return;
        const btn = document.createElement('button');
        btn.id = 'pipBtn';
        btn.title = 'ピクチャーインピクチャー';
        btn.innerHTML = 'PiP';
        btn.style.position = 'absolute';
        btn.style.top = '12px';
        btn.style.right = '16px';
        btn.style.zIndex = '20';
        btn.style.background = '#fff';
        btn.style.color = '#4285f4';
        btn.style.border = '1.2px solid #4285f4';
        btn.style.borderRadius = '7px';
        btn.style.padding = '0.3em 1em';
        btn.style.fontWeight = 'bold';
        btn.style.fontSize = '1em';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)';
        btn.style.userSelect = 'none';
        btn.style.opacity = '0.92';
        btn.style.transition = 'opacity 0.2s';
        btn.onmouseenter = () => btn.style.opacity = '1';
        btn.onmouseleave = () => btn.style.opacity = '0.92';
        container.style.position = 'relative';
        container.appendChild(btn);
        // PiP切り替えロジック
        btn.onclick = async () => {
            if (!document.pictureInPictureElement) {
                this.canvas.style.display = 'none';
                this.video.style.display = '';
                try {
                    await this.video.requestPictureInPicture();
                } catch (e) {
                    alert('PiP開始に失敗しました: ' + e.message);
                    this.canvas.style.display = '';
                    this.video.style.display = 'none';
                }
            } else {
                document.exitPictureInPicture();
            }
        };
        this.video.addEventListener('enterpictureinpicture', () => {
            btn.textContent = 'PiP解除';
        });
        this.video.addEventListener('leavepictureinpicture', () => {
            btn.textContent = 'PiP';
            this.canvas.style.display = '';
            this.video.style.display = 'none';
        });
    }

    // FPS(実測値)をWebGL差分の“完全一致”判定のみで推定（本来の動画fpsを検知）
    _startFpsMeasurement() {
        this._frameTimes = [];
        this._lastFrameTime = null;
        this._dynamicFps = null;
        this._latency = null;
        this._lastFrameData = null;
        this._fpsAutoSetTimer = null;
        if (this._rafId) cancelAnimationFrame(this._rafId);
        let lastFrameTime = null;
        let lastVideoTime = null;
        let frameTimes = [];
        let noChangeCount = 0;
        const NO_CHANGE_LIMIT = 30;
        const poll = () => {
            if (!this.video.srcObject || this.video.paused || this.video.ended) {
                this._rafId = requestAnimationFrame(poll);
                return;
            }
            const w = this.video.videoWidth;
            const h = this.video.videoHeight;
            if (!w || !h) {
                this._rafId = requestAnimationFrame(poll);
                return;
            }
            const currentVideoTime = this.video.currentTime;
            let frameUpdated = false;
            if (lastVideoTime !== null && currentVideoTime !== lastVideoTime) {
                frameUpdated = true;
            }
            lastVideoTime = currentVideoTime;

            if (frameUpdated) {
                const now = performance.now();
                if (lastFrameTime) {
                    const diff = now - lastFrameTime;
                    frameTimes.push(diff);
                    if (frameTimes.length > 30) frameTimes.shift();
                    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
                    this._dynamicFps = avg ? (1000 / avg) : null;
                    // 遅延(推定)は直近30フレームの最小値（最小フレーム間隔）を採用
                    const minFrame = Math.min(...frameTimes);
                    this._latency = isFinite(minFrame) ? minFrame : null;
                }
                lastFrameTime = now;
                noChangeCount = 0;
            } else {
                noChangeCount++;
                if (noChangeCount >= NO_CHANGE_LIMIT) {
                    this._dynamicFps = 0;
                    this._latency = null;
                }
            }
            this._rafId = requestAnimationFrame(poll);
        };
        this._rafId = requestAnimationFrame(poll);
    }

    getCameraInfo() {
        if (!this.currentStream) return null;
        const videoTrack = this.currentStream.getVideoTracks()[0];
        if (!videoTrack) return null;
        const settings = videoTrack.getSettings();
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        let maxFps = (capabilities.frameRate && capabilities.frameRate.max) ? capabilities.frameRate.max : null;
        let minFps = (capabilities.frameRate && capabilities.frameRate.min) ? capabilities.frameRate.min : null;
        let fps = settings.frameRate || maxFps;
        return {
            label: videoTrack.label,
            width: settings.width,
            height: settings.height,
            frameRate: fps,
            facingMode: settings.facingMode,
            deviceId: videoTrack.getSettings().deviceId,
            maxFps: maxFps,
            minFps: minFps,
            capabilities: capabilities,
            ...settings,
        };
    }

    showInfoModal() {
        const info = this.getCameraInfo();
        this.lastInfo = info;
        if (!info) {
            this.infoContent.innerHTML = '<div class="info-placeholder">カメラを起動して「詳細情報を表示」ボタンを押してください。</div>';
        } else {
            let maxFps = (typeof this._monitorFps === 'number') ? this._monitorFps : ((typeof info.maxFps === 'number') ? info.maxFps : '-');
            let minFps = (typeof info.minFps === 'number') ? info.minFps : '-';
            let outputFps = (typeof info.frameRate === 'number') ? info.frameRate : '-';
            let displayFps = '-';
            if (typeof this._dynamicFps === 'number') {
                displayFps = this._dynamicFps === 0 ? '0' : this._dynamicFps.toFixed(1);
            } else if (typeof info.maxFps === 'number') {
                displayFps = info.maxFps;
            }
            const latency = this._latency ? this._latency.toFixed(0) : '-';
            var html = '';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5em;">';
            html += '<span style="font-weight:600;font-size:1.08em;">カメラ情報</span>';
            html += '<button id="copyInfoBtn" style="padding:0.3em 0.9em;font-size:0.98em;border-radius:6px;border:1.2px solid #4285f4;background:#f7fafd;color:#4285f4;cursor:pointer;user-select:none;">コピー</button>';
            html += '</div>';
            html += '<table id="infoTable" style="width:100%;border-collapse:separate;border-spacing:0 0.3em;user-select:none;-webkit-user-select:none;">';
            // 追加情報取得
            let aspectRatio = (info.width && info.height) ? (info.width / info.height).toFixed(3) : '-';
            let videoStandard = (info.frameRate >= 50 && info.frameRate <= 61) ? 'NTSC' : (info.frameRate >= 24 && info.frameRate <= 31) ? '映画/シネマ' : (info.frameRate >= 23 && info.frameRate < 24) ? 'フィルム' : (info.frameRate >= 44 && info.frameRate <= 51) ? 'PAL' : '-';
            let bitrate = (typeof info.bitrate === 'number') ? (info.bitrate / 1000).toFixed(1) + ' kbps' : '-';
            let streamType = (this.currentStream && this.currentStream.active) ? 'ライブ' : '-';
            let webcamResolution = (info.width && info.height) ? (info.width + ' x ' + info.height) : '-';
            let webcamName = info.label || '-';
            html += '<tr><td style="color:#888;">ビデオ標準</td><td>' + videoStandard + '</td></tr>';
            html += '<tr><td style="color:#888;">アスペクト比</td><td>' + aspectRatio + '</td></tr>';
            html += '<tr><td style="color:#888;">ストリームタイプ</td><td>' + streamType + '</td></tr>';
            html += '<tr><td style="color:#888;">ウェブカメラの解像度</td><td>' + webcamResolution + '</td></tr>';
            html += '<tr><td style="color:#888;">ウェブカメラ名</td><td>' + webcamName + '</td></tr>';
            // 既存情報
            html += '<tr><td style="color:#888;">デバイス名</td><td>' + (info.label || '-') + '</td></tr>';
            html += '<tr><td style="color:#888;">解像度</td><td>' + (info.width || '-') + ' x ' + (info.height || '-') + '</td></tr>';
            html += '<tr><td style="color:#888;">出力FPS</td><td>' + outputFps + ' fps</td></tr>';
            html += '<tr><td style="color:#888;">FPS(実測値)</td><td>' + displayFps + ' fps</td></tr>';
            html += '<tr><td style="color:#888;">最大FPS(本来)</td><td>' + (maxFps !== null ? maxFps : '取得不可') + '</td></tr>';
            html += '<tr><td style="color:#888;">遅延(推定)</td><td>' + latency + ' ms</td></tr>';
            html += '<tr><td style="color:#888;">deviceId</td><td style="font-size:0.95em;max-width:220px;word-break:break-all;overflow-wrap:anywhere;">' + (info.deviceId || '-') + '</td></tr>';
            html += '</table>';
            html += '<details style="margin-top:0.7em;"><summary style="color:#4285f4;cursor:pointer;">capabilities生データを表示</summary>';
            html += '<pre style="font-size:0.95em;color:#444;background:#f7fafd;padding:0.7em 1em;border-radius:7px;overflow-x:auto;">' +
                JSON.stringify(info.capabilities, null, 2) + '</pre></details>';
            html += '<div style="margin-top:1em;color:#aaa;font-size:0.95em;">※出力FPSはカメラデバイスがOS/ブラウザに通知している理論値です。<br>最大FPSはcapabilities.frameRate.maxを表示。取得不可の場合は「-」や「取得不可」となります。<br>値はリアルタイムで取得されます。テーブルは選択不可。コピーは右上ボタンから</div>';
            this.infoContent.innerHTML = html;
            setTimeout(() => {
                const btn = document.getElementById('copyInfoBtn');
                if (btn) {
                    btn.onclick = () => {
                        const text =
                            `デバイス名\t${info.label || '-'}\n` +
                            `解像度\t${info.width || '-'} x ${info.height || '-'}\n` +
                            `FPS(設定値)\t${info.frameRate || '-'} fps\n` +
                            `FPS(実測値)\t${displayFps} fps\n` +
                            `最大FPS(本来)\t${maxFps !== null ? maxFps : '取得不可'}\n` +
                            `遅延(推定)\t${latency} ms\n` +
                            `deviceId\t${info.deviceId || '-'}\n`;
                        navigator.clipboard.writeText(text).then(() => {
                            btn.textContent = 'コピー済み!';
                            setTimeout(() => { btn.textContent = 'コピー'; }, 1200);
                        });
                    };
                }
            }, 0);
        }
        this.infoModal.style.display = 'block';
        if (this._infoInterval) clearInterval(this._infoInterval);
        this._infoInterval = setInterval(() => {
            const newInfo = this.getCameraInfo();
            const dynamicFps = this._dynamicFps ? this._dynamicFps.toFixed(1) : '-';
            const latency = this._latency ? this._latency.toFixed(0) : '-';
            if (JSON.stringify(newInfo) !== JSON.stringify(this.lastInfo) || this._lastDynamicFps !== dynamicFps || this._lastLatency !== latency) {
                this.lastInfo = newInfo;
                this._lastDynamicFps = dynamicFps;
                this._lastLatency = latency;
                this.showInfoModal();
            }
        }, 700);
    }

    hideInfoModal() {
        this.infoModal.style.display = 'none';
        if (this._infoInterval) clearInterval(this._infoInterval);
    }

    showSettingsModal() {
        this.settingsWidth.value = this._settingWidth || '';
        this.settingsHeight.value = this._settingHeight || '';
        this.settingsFps.value = this._settingFps || '';
        this.settingsModal.style.display = 'block';
    }

    hideSettingsModal() {
        this.settingsModal.style.display = 'none';
    }

    async updateCameraList() {
        try {
            let devices = await navigator.mediaDevices.enumerateDevices();
            let videoDevices = devices.filter(device => device.kind === 'videoinput');
            if (videoDevices.some(d => !d.label)) {
                try {
                    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    tempStream.getTracks().forEach(track => track.stop());
                    devices = await navigator.mediaDevices.enumerateDevices();
                    videoDevices = devices.filter(device => device.kind === 'videoinput');
                } catch (permErr) {
                    console.warn('[CameraTester] カメラ名取得のための権限リクエスト失敗:', permErr);
                }
            }
            console.log('[CameraTester] updateCameraList:', videoDevices.map(d => ({ id: d.deviceId, label: d.label })));
            const prevValue = this.cameraList.value;
            this.cameraList.innerHTML = '';
            videoDevices.forEach((device, idx) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `カメラ ${idx + 1}`;
                this.cameraList.appendChild(option);
            });
            if (videoDevices.length && prevValue) {
                this.cameraList.value = prevValue;
            }
        } catch (err) {
            console.error('[CameraTester] カメラ一覧の取得に失敗:', err);
            alert('カメラ一覧の取得に失敗しました: ' + err.message);
        }
    }

    async handleTestClick() {
        const deviceId = this.cameraList.value;
        console.log('[CameraTester] handleTestClick: deviceId=', deviceId);
        if (deviceId) {
            await this.startCamera(deviceId);
        }
    }

    async startCamera(deviceId) {
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('autoplay', '');
        this.video.setAttribute('muted', '');
        this.video.removeAttribute('disablePictureInPicture');
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            console.log('[CameraTester] 停止した前回のストリーム');
            this._disposeWebGL();
        }
        this._frameTimes = [];
        this._lastFrameTime = null;
        this._dynamicFps = null;
        this._latency = null;
        if (this._rafId) cancelAnimationFrame(this._rafId);
        try {
            console.log('[CameraTester] startCamera: deviceId=', deviceId);
            let stream = null;
            let tempStream = null;
            try {
                tempStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false });
            } catch (e) {
                console.warn('[CameraTester] capabilities取得用一時ストリーム失敗:', e);
            }
            let maxWidth = null, maxHeight = null, maxFps = null;
            if (tempStream) {
                const track = tempStream.getVideoTracks()[0];
                if (track && track.getCapabilities) {
                    const caps = track.getCapabilities();
                    maxWidth = caps.width && caps.width.max ? caps.width.max : null;
                    maxHeight = caps.height && caps.height.max ? caps.height.max : null;
                    maxFps = caps.frameRate && caps.frameRate.max ? caps.frameRate.max : null;
                }
                tempStream.getTracks().forEach(t => t.stop());
            }
            let videoConstraints = { deviceId: { exact: deviceId } };
            if (this._settingWidth) videoConstraints.width = { ideal: this._settingWidth };
            else if (maxWidth) videoConstraints.width = { ideal: maxWidth, max: maxWidth };
            if (this._settingHeight) videoConstraints.height = { ideal: this._settingHeight };
            else if (maxHeight) videoConstraints.height = { ideal: maxHeight, max: maxHeight };
            if (this._settingFps) videoConstraints.frameRate = { ideal: this._settingFps, max: this._settingFps };
            else if (maxFps) videoConstraints.frameRate = { ideal: maxFps, max: maxFps };
            else videoConstraints.frameRate = { ideal: 60, max: 240 };
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: videoConstraints,
                    audio: true
                });
            } catch (err1) {
                console.warn('[CameraTester] getUserMedia strict failed, fallback to loose constraint:', err1);
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: { exact: deviceId }, frameRate: { ideal: maxFps || 60, max: maxFps || 240 } },
                        audio: true
                    });
                } catch (err2) {
                    console.warn('[CameraTester] getUserMedia loose failed, fallback to deviceId only:', err2);
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            video: { deviceId }, audio: true
                        });
                    } catch (err3) {
                        console.error('[CameraTester] すべてのgetUserMedia失敗:', err3);
                        alert('カメラの起動に失敗しました: ' + err3.message);
                        return;
                    }
                }
            }
            this.video.srcObject = stream;
            this.currentStream = stream;
            this._setupPiPButton();
            const drawToCanvas = () => {
                if (!this.video.srcObject) return;
                const w = this.video.videoWidth;
                const h = this.video.videoHeight;
                if (w && h) {
                    this.canvas.width = w;
                    this.canvas.height = h;
                    const ctx = this.canvas.getContext('2d');
                    ctx.drawImage(this.video, 0, 0, w, h);
                }
                this._canvasAnimId = requestAnimationFrame(drawToCanvas);
            };
            if (this._canvasAnimId) cancelAnimationFrame(this._canvasAnimId);
            this.video.onloadedmetadata = () => {
                drawToCanvas();
            };
            if (this.video.readyState >= 1) drawToCanvas();
            if (this._videoResizeInterval) clearInterval(this._videoResizeInterval);
            this._videoResizeInterval = setInterval(() => {
                const w = this.video.videoWidth;
                const h = this.video.videoHeight;
                if (w && h) {
                    this.canvas.width = w;
                    this.canvas.height = h;
                }
            }, 1000);
            this.video.muted = false;
            this.video.play().catch(() => { });
            this._startFpsMeasurement();
            console.log('[CameraTester] カメラ起動成功');
        } catch (err) {
            console.error('[CameraTester] カメラの起動に失敗:', err);
            alert('カメラの起動に失敗しました: ' + err.message);
        }
    }
}

// DOMContentLoadedで初期化
window.addEventListener('DOMContentLoaded', () => {
    new CameraTester('cameraList', 'video', 'testBtn');
    // --- モーダルをドラッグ移動可能に（タイトルバーのみ） ---
    const modal = document.getElementById('infoModal');
    const modalContent = document.querySelector('.modal-content');
    const modalHeader = document.getElementById('modalHeader');
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    if (modal && modalContent && modalHeader) {
        modalHeader.addEventListener('mousedown', function (e) {
            if (e.target.classList.contains('close')) return;
            if (e.target.closest('table')) return;
            isDragging = true;
            const rect = modalContent.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            modalContent.classList.add('dragging');
            modalHeader.classList.add('dragging');
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            let x = e.clientX - dragOffsetX;
            let y = e.clientY - dragOffsetY;
            x = Math.max(0, Math.min(window.innerWidth - modalContent.offsetWidth, x));
            y = Math.max(0, Math.min(window.innerHeight - modalContent.offsetHeight, y));
            modalContent.style.left = x + 'px';
            modalContent.style.top = y + 'px';
            modalContent.style.transform = 'none';
        });
        document.addEventListener('mouseup', function () {
            if (isDragging) {
                isDragging = false;
                modalContent.classList.remove('dragging');
                modalHeader.classList.remove('dragging');
                document.body.style.userSelect = '';
            }
        });
        document.addEventListener('keydown', function (e) {
            if (modal.style.display === 'block' && (e.key === 'Escape' || e.key === 'Esc')) {
                const closeBtn = document.getElementById('closeModalBtn');
                if (closeBtn) closeBtn.click();
            }
        });
        const observer = new MutationObserver(() => {
            if (modal.style.display === 'block') {
                modalContent.style.left = '50%';
                modalContent.style.top = '120px';
                modalContent.style.transform = 'translate(-50%, 0)';
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    }
});
