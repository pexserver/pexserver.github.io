// main.js
// GUI以外のメインロジック（データ取得・OS判定・PWA案内・ユーティリティ等）

export function detectUserOS() {
    const ua = navigator.userAgent.toLowerCase();
    if (/android|iphone|ipad|ipod|mobile|windows phone/.test(ua)) {
        return 'mobile';
    } else if (/windows|macintosh|linux/.test(ua)) {
        return 'pc';
    }
    return 'none';
}

export function shouldShowIOSPWAModal() {
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isInStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const ignored = localStorage.getItem('ios-pwa-modal-ignore');
    return isIOS && !isInStandalone && !ignored;
}

export function showIOSPWAModal() {
    const modal = document.getElementById('ios-pwa-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('ios-pwa-close').onclick = () => {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    };
    document.getElementById('ios-pwa-ignore').onclick = () => {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    };
}

export function tryShowIOSPWAModal() {
    if (shouldShowIOSPWAModal()) {
        showIOSPWAModal();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // モーダルのクローズ・無視ボタンのイベントを必ず再登録
    const modal = document.getElementById('ios-pwa-modal');
    if (modal) {
        const closeBtn = document.getElementById('ios-pwa-close');
        const ignoreBtn = document.getElementById('ios-pwa-ignore');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.classList.add('hidden');
                document.body.style.overflow = 'auto';
            };
        }
        if (ignoreBtn) {
            ignoreBtn.onclick = () => {
                modal.classList.add('hidden');
                document.body.style.overflow = 'auto';
            };
        }
    }
    tryShowIOSPWAModal();
});
