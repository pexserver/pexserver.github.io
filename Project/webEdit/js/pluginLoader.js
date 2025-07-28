// pluginLoader.js: プラグイン管理・動的ロード
// pluginListは廃止し、toolCards.jsのtoolListを参照
function loadPlugin(file) {
    // main-content領域をクリア
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.innerHTML = '';
    // 既存の同名scriptを削除（重複防止）
    const oldScript = document.querySelector(`script[src="js/plugin/${file}"]`);
    if (oldScript) oldScript.remove();
    // 新しいプラグインscriptをロード
    const script = document.createElement('script');
    script.src = `js/plugin/${file}`;
    script.defer = true;
    document.body.appendChild(script);
}
