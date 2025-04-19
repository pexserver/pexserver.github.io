document.addEventListener('DOMContentLoaded', () => {
    // --- Hamburger Menu Logic ---
    const hamburger = document.querySelector('.hamburger');
    const nav = document.querySelector('nav');

    if (hamburger && nav) {
        hamburger.addEventListener('click', () => {
            const isActive = hamburger.classList.toggle('active');
            hamburger.setAttribute('aria-expanded', isActive);
            nav.classList.toggle('active', isActive);
        });
    } else {
        console.error("Hamburger menu elements not found.");
    }

    // --- AI Service Status Check ---
    const aiStatusIndicator = document.getElementById('ai-status-indicator');
    const aiStatusText = document.getElementById('ai-status-text');
    const aiUpdateTime = document.getElementById('ai-update-time');
    const aiPingTime = document.getElementById('ai-ping-time'); // Ping表示要素を取得
    const aiPingDisplay = document.getElementById('ai-ping-display'); // Ping全体表示を制御する要素

    // Helper function to format date and time
    function getCurrentTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    async function checkAiServiceStatus() {
        const url = 'https://neuralai-jbwc.onrender.com/';
        let duration = null; // Track duration (ping)
        const startTime = performance.now(); // 計測開始
        let pingMeasured = false; // Pingが計測できたかのフラグ

        // UIを「確認中」状態にリセット
        if (aiStatusIndicator) aiStatusIndicator.className = 'status-indicator status-loading';
        if (aiStatusText) aiStatusText.textContent = '確認中...';
        if (aiPingDisplay) aiPingDisplay.style.display = 'none'; // 一旦隠す
        if (aiPingTime) aiPingTime.textContent = '-';
        if (aiUpdateTime) aiUpdateTime.textContent = '確認中...';

        try {
            // fetch を実行。CORSエラーなどで response オブジェクトが不完全でも構わない。
            // mode: 'cors' は fetch のデフォルトなので省略してもよいが、明示。
            const response = await fetch(url, { mode: 'cors' });
            const endTime = performance.now(); // 計測終了
            duration = Math.round(endTime - startTime); // 応答時間を計算
            pingMeasured = true; // 時間が計算できた => 計測成功

            // 応答内容 (response.ok) は判定には使わないが、ログには残す
            if (response.ok) {
                console.info(`AI Service responded OK: ${response.status}, Duration: ${duration}ms`);
            } else {
                console.warn(`AI Service responded but with non-OK status: ${response.status}, Duration: ${duration}ms`);
            }

        } catch (error) {
            // fetch 自体が失敗した場合 (ネットワークエラー、DNSエラー、CORSブロックなど)
            const errorEndTime = performance.now(); // エラー発生時刻
            duration = Math.round(errorEndTime - startTime); // エラーまでの時間を計算
            // durationが計算できれば、それも応答があった（試みた）証拠とみなす
            if (duration !== null && !isNaN(duration)) { // durationが有効な数値か確認
                pingMeasured = true; // 時間は計測できた
                console.error(`Error during AI Service check (but duration measured): ${error}. Duration: ${duration}ms`);
            } else {
                // duration の計算に失敗するような致命的なエラーの場合
                pingMeasured = false;
                console.error(`Critical error during AI Service check, duration could not be measured:`, error);
            }
        } finally {
            // finallyブロックで pingMeasured フラグに基づいて最終判断

            if (pingMeasured && duration !== null) {
                // Pingが計測できた (応答があった or エラーでも時間計算できた) => オンライン表示
                if (aiStatusIndicator) aiStatusIndicator.className = 'status-indicator status-online';
                if (aiStatusText) aiStatusText.textContent = 'オンライン'; // 応答内容に関わらずオンライン
                if (aiPingTime) aiPingTime.textContent = duration;
                if (aiPingDisplay) aiPingDisplay.style.display = 'inline'; // Ping表示を見せる
            } else {
                // Ping計測に失敗した場合 => オフライン表示
                if (aiStatusIndicator) aiStatusIndicator.className = 'status-indicator status-offline';
                if (aiStatusText) aiStatusText.textContent = 'オフライン';
                if (aiPingDisplay) aiPingDisplay.style.display = 'none'; // Ping表示は隠す
                if (aiPingTime) aiPingTime.textContent = '-';
            }

            // 最終更新時刻は常に更新
            if (aiUpdateTime) {
                aiUpdateTime.textContent = getCurrentTimestamp();
            }
        }
    }

    // Check status only if elements exist
    if (aiStatusIndicator && aiStatusText && aiUpdateTime && aiPingTime && aiPingDisplay) {
        checkAiServiceStatus(); // Initial check
        // Optional: Refresh status every 60 seconds
        // setInterval(checkAiServiceStatus, 60000);
    } else {
        console.error("One or more AI service status/time/ping elements not found in the DOM.");
    }
});