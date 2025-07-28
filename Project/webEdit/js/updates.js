// updates.js: HUB用 汎用通知・メッセージ表示モジュール
class MessageHub {
    constructor(containerId = 'updates-list') {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        // モーダル用CSSを一度だけ追加
        if (!document.getElementById('msg-modal-style')) {
            const style = document.createElement('style');
            style.id = 'msg-modal-style';
            style.textContent = `
                .system-message-modal {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    min-width: 280px;
                    max-width: 90vw;
                    background: #fff;
                    color: #222;
                    border-radius: 12px;
                    box-shadow: 0 4px 24px rgba(25,118,210,0.18);
                    padding: 1.2rem 2rem;
                    font-size: 1.15rem;
                    z-index: 99999;
                    text-align: center;
                    opacity: 0;
                    animation: msgFadeIn 0.3s forwards, msgFadeOut 0.5s 4.5s forwards;
                }
                .system-message-modal.info { border-left: 6px solid #1976d2; }
                .system-message-modal.error { border-left: 6px solid #d32f2f; }
                .system-message-modal.success { border-left: 6px solid #388e3c; }
                .system-message-modal.notice { border-left: 6px solid #ffa000; }
                @keyframes msgFadeIn { to { opacity: 1; } }
                @keyframes msgFadeOut { to { opacity: 0; } }
            `;
            document.head.appendChild(style);
        }
    }

    showMessage(type, message) {
        // 通知表示用divがなければ動的に作成
        let container = document.getElementById(this.containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = this.containerId;
            container.style.zIndex = '9999';
            container.style.position = 'relative';
            // main-contentがあればそこに追加、なければbody
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.prepend(container);
            } else {
                document.body.appendChild(container);
            }
        }
        this.container = container;
        // モーダルUI
        const msgDiv = document.createElement('div');
        msgDiv.className = `system-message-modal ${type}`;
        msgDiv.textContent = message;
        this.container.appendChild(msgDiv);
        setTimeout(() => msgDiv.remove(), 3000); // 5秒後に自動消去
    }

    clearMessages() {
        let container = document.getElementById(this.containerId);
        if (container) container.innerHTML = '';
    }

    // 今後: サーバーやプラグインからの通知を受け取るAPI例
    showSystemNotice(message) {
        this.showMessage('notice', message);
    }
    showError(message) {
        this.showMessage('error', message);
    }
    showSuccess(message) {
        this.showMessage('success', message);
    }
}

// 例: DOMContentLoaded時にウェルカムメッセージ表示
function initialize() {
    const msgHub = new MessageHub();
    msgHub.showMessage('info', 'Web編集ツール HUBへようこそ！');
    // msgHub.showSystemNotice('新しいプラグインが追加されました！');
    // msgHub.showError('エラーが発生しました');
    // msgHub.showSuccess('保存が完了しました');
}

document.addEventListener('DOMContentLoaded', initialize);

