// toolCards.js: 編集ツールカードUI管理
const toolList = [
    { name: '更新履歴編集', desc: 'update.jsonを編集', file: 'updateEditor.js' }
];

function renderToolCards() {
    const list = document.getElementById('tool-card-list');
    list.innerHTML = '';
    toolList.forEach(tool => {
        const card = document.createElement('div');
        card.className = 'tool-card';
        card.innerHTML = `<h3>${tool.name}</h3><p>${tool.desc}</p>`;
        card.onclick = () => loadPlugin(tool.file);
        list.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', renderToolCards);
// loadPluginはpluginLoader.jsで定義済み
