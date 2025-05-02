


const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzEWWAZhg9XuM0B3Mi3Pd8XaZlxBoYcnC8nxCziLMBGiiQHBETjKuSjFvnsUJ89Z1EXwQ/exec';
const MAX_FILE_SIZE_MB = 100;
const EXPIRATION_MINUTES = 30;
const MAX_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;


const BASE_FILE_SIZE_BYTES = 2074332;
const BASE_SERVER_DURATION_SECONDS = 6.69;
const ESTIMATED_SERVER_SPEED_BPS = BASE_SERVER_DURATION_SECONDS > 0.1 ? BASE_FILE_SIZE_BYTES / BASE_SERVER_DURATION_SECONDS : 150 * 1024;
const SIMULATION_INTERVAL_MS = 200;
const MIN_SIMULATION_DURATION_MS = 500;



const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const fileInputLabel = document.getElementById('fileInputLabel');
const uploadButton = document.getElementById('uploadButton');
const buttonText = document.getElementById('buttonText');
const buttonSpinner = document.getElementById('buttonSpinner');
const progressBarContainer = document.getElementById('progressBarContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const resultDiv = document.getElementById('result');
const fileSizeWarning = document.getElementById('fileSizeWarning');
const maxFileSizeText = document.getElementById('maxFileSizeText');
const expirationMinutesText = document.getElementById('expirationMinutesText');


let currentFileReader = null;
let progressInterval = null;


if (maxFileSizeText) maxFileSizeText.textContent = `${MAX_FILE_SIZE_MB}MB`;
if (expirationMinutesText) expirationMinutesText.textContent = `約${EXPIRATION_MINUTES}分間`;
if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL === 'gasUrl') {
    showAlert('<strong>設定エラー:</strong> script.js 内の GAS_WEB_APP_URL が設定されていません', 'error');
    if (uploadButton) uploadButton.disabled = true;
    if (fileInput) fileInput.disabled = true;
}



if (fileInput) {
    fileInput.addEventListener('change', function (e) {
        if (resultDiv) resultDiv.innerHTML = '';


        if (uploadButton) uploadButton.disabled = true;
        if (fileSizeWarning) fileSizeWarning.textContent = '';

        if (this.files && this.files[0]) {
            const file = this.files[0];
            const fileSize = file.size;
            if (fileInputLabel) fileInputLabel.textContent = file.name;

            if (fileSize === 0) {
                if (fileSizeWarning) fileSizeWarning.textContent = `ファイルが空か、読み込めません。`;

                fileInput.style.borderColor = 'red';
            } else if (fileSize > MAX_SIZE_BYTES) {
                if (fileSizeWarning) fileSizeWarning.textContent = `ファイルサイズが上限 (${MAX_FILE_SIZE_MB}MB) を超えています (${(fileSize / 1024 / 1024).toFixed(2)}MB)。`;

                fileInput.style.borderColor = 'red';
            } else {
                fileInput.style.borderColor = '';
                if (uploadButton && GAS_WEB_APP_URL && GAS_WEB_APP_URL !== 'gasUrl') {
                    uploadButton.disabled = false;
                }
            }
        } else {
            if (fileInputLabel) fileInputLabel.textContent = 'ファイルを選択してください...';
            fileInput.style.borderColor = '';
        }
    });
}

if (uploadForm) {
    uploadForm.addEventListener('submit', function (e) {
        e.preventDefault();

        if (!fileInput || !fileInput.files || fileInput.files.length === 0 || (uploadButton && uploadButton.disabled)) {
            showAlert('ファイルを選択し、サイズを確認してください。', 'warning');
            return;
        }
        if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL === 'gasUrl') {
            showAlert('<strong>設定エラー:</strong> script.js 内の GAS_WEB_APP_URL を設定してください。', 'error');
            return;
        }

        const file = fileInput.files[0];
        setUploadingState(true);
        if (resultDiv) resultDiv.innerHTML = '';

        currentFileReader = new FileReader();

        currentFileReader.onloadstart = () => {
            updateProgress(0, 'ファイルを読み込み中...');
            if (progressBarContainer) progressBarContainer.style.display = 'block';
        };

        currentFileReader.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentLoaded = Math.round((event.loaded / event.total) * 50);
                updateProgress(percentLoaded, 'ファイルを読み込み中...');
            }
        };

        currentFileReader.onload = (event) => {
            updateProgress(50, 'サーバーへ送信中...');

            const requestData = {
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                data: event.target.result
            };

            simulateServerProgress(file.size);


            $.ajax({
                url: GAS_WEB_APP_URL,
                type: 'POST',
                data: requestData,
                dataType: 'json',
                success: function (response) {
                    clearProgressInterval();
                    if (response && response.success) {
                        handleUploadSuccess(response);
                    } else {
                        handleUploadFailure(new Error(response.message || 'サーバー側で処理が失敗しました。'));
                    }
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    clearProgressInterval();
                    console.error("AJAX Error:", textStatus, errorThrown, jqXHR.responseText);
                    let errorMsg = `AJAXリクエスト失敗: ${textStatus}`;
                    if (errorThrown) errorMsg += ` - ${errorThrown}`;
                    if (jqXHR.status === 0 && textStatus === 'error' && !errorThrown) {
                        errorMsg += ` (CORSエラーまたはネットワークエラーの可能性)`;
                    } else if (jqXHR.responseText) {
                        try {
                            const errorData = JSON.parse(jqXHR.responseText);
                            if (errorData && errorData.message) {
                                errorMsg = `サーバーエラー: ${errorData.message}`;
                            } else if (errorData && errorData.error && errorData.error.message) {
                                errorMsg = `サーバーエラー: ${errorData.error.message}`;
                            } else if (jqXHR.status) {
                                errorMsg += ` (HTTP ${jqXHR.status})`;
                            }
                        } catch (e) {
                            if (jqXHR.responseText.length < 200 && jqXHR.responseText.length > 0) {
                                errorMsg += `\nサーバー応答: ${escapeHtml(jqXHR.responseText)}`;
                            } else if (jqXHR.status) {
                                errorMsg += ` (HTTP ${jqXHR.status})`;
                            } else {
                                errorMsg += ` (サーバー応答解析不能)`;
                            }
                        }
                    } else if (jqXHR.status) {
                        errorMsg += ` (HTTP ${jqXHR.status})`;
                    }
                    handleUploadFailure(new Error(errorMsg));
                }
            });
        };

        currentFileReader.onerror = (event) => {
            console.error("FileReader Error:", event.target.error);
            handleUploadFailure(new Error("ファイルの読み込み中にエラーが発生しました。"));
            setUploadingState(false);
            if (progressBarContainer) progressBarContainer.style.display = 'none';
        };

        currentFileReader.readAsDataURL(file);
    });
}




function simulateServerProgress(fileSize) {
    clearInterval(progressInterval);

    const estimatedServerDurationSeconds = BASE_FILE_SIZE_BYTES > 0
        ? (fileSize / BASE_FILE_SIZE_BYTES) * BASE_SERVER_DURATION_SECONDS
        : (fileSize / (150 * 1024));

    let estimatedDurationMs = Math.max(MIN_SIMULATION_DURATION_MS, estimatedServerDurationSeconds * 1000);

    const progressStart = 0;
    const progressEnd = 98;
    const progressRange = progressEnd - progressStart;

    let currentProgress = progressStart;
    const totalSteps = Math.max(1, Math.ceil(estimatedDurationMs / SIMULATION_INTERVAL_MS));
    const progressIncrement = progressRange / totalSteps;

    console.log(`Simulating server progress: ${fileSize} bytes, Estimated duration: ${estimatedDurationMs.toFixed(0)} ms (based on ${BASE_FILE_SIZE_BYTES} bytes in ${BASE_SERVER_DURATION_SECONDS}s TTFB), Steps: ${totalSteps}, Increment: ${progressIncrement.toFixed(2)}%`);

    progressInterval = setInterval(() => {
        currentProgress += progressIncrement;
        if (currentProgress >= progressEnd) {
            currentProgress = progressEnd;
        }
        updateProgress(Math.round(currentProgress), 'サーバーで処理中...');
    }, SIMULATION_INTERVAL_MS);
}

function handleUploadSuccess(response) {
    clearProgressInterval();
    updateProgress(100, '完了');
    if (resultDiv) {

        resultDiv.innerHTML = `
        <div class="message success-message" style="margin-top: 1rem; padding: 1rem; border: 1px solid green; background-color: #d4edda; color: #155724; border-radius: 4px;">
          <h4>アップロード成功！</h4>
          <p>ファイル名: <strong>${escapeHtml(response.fileName)}</strong></p>
          <p>以下のリンクでファイルをダウンロードできます (約 ${EXPIRATION_MINUTES}分間有効):</p>
          <div style="display: flex; margin-bottom: 1rem;">
            <input type="text" id="downloadLinkInput" style="flex-grow: 1; padding: 0.375rem 0.75rem; border: 1px solid #ced4da; border-radius: 0.25rem;" value="${response.downloadUrl}" readonly>
            <button class="copy-button" type="button" onclick="copyLink(this)" style="margin-left: 0.5rem; padding: 0.375rem 0.75rem; border: 1px solid #6c757d; background-color: #f8f9fa; border-radius: 0.25rem; cursor: pointer;" title="リンクをコピー">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
              </svg>
            </button>
          </div>
          <p style="font-size: 0.875em; color: #6c757d;">削除予定時刻: ${response.deleteAt || '不明'}</p>
          <button onclick="this.parentElement.remove()" style="position: absolute; top: 0.5rem; right: 0.5rem; background: none; border: none; font-size: 1.2rem; cursor: pointer;">×</button>
        </div>
      `;
    }
    setUploadingState(false);
    setTimeout(() => {
        if (progressBarContainer) progressBarContainer.style.display = 'none';
        if (uploadForm) uploadForm.reset();
        if (fileInputLabel) fileInputLabel.textContent = 'ファイルを選択してください...';
        fileInput.style.borderColor = '';
        if (uploadButton) uploadButton.disabled = true;
        updateProgress(0, '');
    }, 1500);
}

function handleUploadFailure(error) {
    clearProgressInterval();
    console.error("Upload Failure:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    let displayMessage = `<strong>エラー:</strong> ${escapeHtml(errorMessage)}`;

    if (errorMessage.toLowerCase().includes('networkerror') || errorMessage.toLowerCase().includes('failed to fetch') || errorMessage.toLowerCase().includes('cors') || (errorMessage.toLowerCase().includes('ajaxリクエスト失敗') && !errorMessage.toLowerCase().includes('http'))) {
        displayMessage += `<br><small>ネットワーク接続、GAS Web AppのURL、またはGAS側のCORS設定を確認してください。</small>`;
    } else if (errorMessage.includes('サーバーエラー') || errorMessage.includes('スクリプトの実行中にエラーが発生しました') || errorMessage.includes('HTTP 5') || errorMessage.includes('タイムアウト') || errorMessage.includes('exceeded maximum execution time')) {
        displayMessage += `<br><small>GASスクリプトの実行ログを確認してください (リクエストサイズ超過、タイムアウト、スクリプトエラー等)。</small>`;
    } else if (errorMessage.includes('上限') && errorMessage.includes('超えています')) {
        displayMessage = `<strong>ファイルサイズエラー:</strong> ${escapeHtml(errorMessage)}`;
    } else if (errorMessage.includes('HTTP 4')) {
        displayMessage += `<br><small>リクエストに問題がある可能性があります (例: URL間違い、認証エラー)。</small>`;
    }

    showAlert(displayMessage, 'error');
    setUploadingState(false);
    if (progressBarContainer) progressBarContainer.style.display = 'none';
    updateProgress(0, '');
}

function setUploadingState(isUploading) {
    if (uploadButton) uploadButton.disabled = isUploading;
    if (fileInput) fileInput.disabled = isUploading;
    if (isUploading) {
        if (buttonText) buttonText.textContent = '処理中';
        if (buttonSpinner) buttonSpinner.style.display = 'inline-block';
    } else {
        if (buttonText) buttonText.textContent = 'アップロード';
        if (buttonSpinner) buttonSpinner.style.display = 'none';
    }
}

function updateProgress(percent, text) {
    if (progressBar) {
        const p = Math.max(0, Math.min(100, Math.round(percent)));
        progressBar.style.width = p + '%';

        progressBar.setAttribute('aria-valuenow', p);
        progressBar.textContent = p + '%';
    }
    if (progressText) progressText.textContent = text;
}

function clearProgressInterval() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
        console.log("Progress interval cleared.");
    }
}


function showAlert(message, type = 'error') {
    if (resultDiv) {

        resultDiv.innerHTML = '';

        const alertDiv = document.createElement('div');
        alertDiv.className = `message ${type}-message`;

        alertDiv.style.padding = '1rem';
        alertDiv.style.marginTop = '1rem';
        alertDiv.style.border = '1px solid';
        alertDiv.style.borderRadius = '4px';
        alertDiv.style.position = 'relative';

        if (type === 'error') {
            alertDiv.style.borderColor = 'red';
            alertDiv.style.backgroundColor = '#f8d7da';
            alertDiv.style.color = '#721c24';
        } else if (type === 'success') {
            alertDiv.style.borderColor = 'green';
            alertDiv.style.backgroundColor = '#d4edda';
            alertDiv.style.color = '#155724';
        } else if (type === 'warning') {
            alertDiv.style.borderColor = '#ffc107';
            alertDiv.style.backgroundColor = '#fff3cd';
            alertDiv.style.color = '#856404';
        } else {
            alertDiv.style.borderColor = '#bee5eb';
            alertDiv.style.backgroundColor = '#d1ecf1';
            alertDiv.style.color = '#0c5460';
        }

        alertDiv.innerHTML = message;


        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '0.5rem';
        closeButton.style.right = '0.5rem';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.fontSize = '1.2rem';
        closeButton.style.cursor = 'pointer';
        closeButton.style.lineHeight = '1';
        closeButton.style.padding = '0';
        closeButton.onclick = function () {
            alertDiv.remove();
        };
        alertDiv.appendChild(closeButton);

        resultDiv.appendChild(alertDiv);
    }
}



window.copyLink = function (buttonElement) {
    const linkInput = document.getElementById('downloadLinkInput');
    if (!linkInput || !buttonElement) return;

    const originalButtonContent = buttonElement.innerHTML;
    const originalButtonStyle = {
        backgroundColor: buttonElement.style.backgroundColor,
        color: buttonElement.style.color,
        borderColor: buttonElement.style.borderColor
    };
    const originalTitle = buttonElement.title;

    navigator.clipboard.writeText(linkInput.value).then(() => {

        buttonElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-lg" viewBox="0 0 16 16">
               <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022z"/>
            </svg>
            <span style="margin-left: 4px;">コピー完了</span>`;
        buttonElement.title = 'コピーしました！';
        buttonElement.style.backgroundColor = '#28a745';
        buttonElement.style.color = 'white';
        buttonElement.style.borderColor = '#28a745';
        buttonElement.disabled = true;


        setTimeout(() => {
            buttonElement.innerHTML = originalButtonContent;
            buttonElement.title = originalTitle;
            buttonElement.style.backgroundColor = originalButtonStyle.backgroundColor;
            buttonElement.style.color = originalButtonStyle.color;
            buttonElement.style.borderColor = originalButtonStyle.borderColor;
            buttonElement.disabled = false;
        }, 2000);

    }).catch(err => {

        console.error('クリップボードへのコピーに失敗しました:', err);
        const originalText = buttonElement.textContent || "コピー";
        buttonElement.textContent = 'コピー失敗';
        buttonElement.title = 'コピーに失敗しました';
        buttonElement.style.backgroundColor = '#dc3545';
        buttonElement.style.color = 'white';
        buttonElement.style.borderColor = '#dc3545';
        buttonElement.disabled = true;

        setTimeout(() => {
            buttonElement.innerHTML = originalButtonContent;
            buttonElement.title = originalTitle;
            buttonElement.style.backgroundColor = originalButtonStyle.backgroundColor;
            buttonElement.style.color = originalButtonStyle.color;
            buttonElement.style.borderColor = originalButtonStyle.borderColor;
            buttonElement.disabled = false;
        }, 2500);
    });


    if (window.getSelection) window.getSelection().removeAllRanges();
    else if (document.selection) document.selection.empty();
};


function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
