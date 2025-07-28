// updateEditor.js: update.json編集プラグイン
class UpdateJsonEditor {
    constructor(containerId = 'main-content') {
        this.container = document.getElementById(containerId);
        this.data = null;
        this.rendered = false;
        this.msgHub = new MessageHub();
        this.load();
    }

    async load() {
        try {
            const response = await fetch('../../../updates.json');
            this.data = await response.json();
            this.render();
        } catch (e) {
            this.container.innerHTML = '<p>更新履歴データの取得に失敗しました。</p>';
        }
    }

    render() {
        if (!this.data) return;
        // 通知表示用divがなければ追加
        let updatesListDiv = document.getElementById('updates-list');
        if (!updatesListDiv) {
            updatesListDiv = document.createElement('div');
            updatesListDiv.id = 'updates-list';
            updatesListDiv.style.zIndex = '9999';
            updatesListDiv.style.position = 'relative';
            this.container.prepend(updatesListDiv);
        }
        // 通知用div以外をクリア
        Array.from(this.container.children).forEach(child => {
            if (child.id !== 'updates-list') this.container.removeChild(child);
        });
        // --- カテゴリ選択ドロップダウン追加 ---
        let selectedCatIdx = this.selectedCatIdx ?? 0;
        // select生成
        let selectHtml = `<label class="mainpage-cat-label" title="表示するカテゴリを選択します">カテゴリ選択: <select id="cat-filter-select" class="mainpage-cat-select" title="表示するカテゴリを選択します">`;
        this.data.categories.forEach((cat, idx) => {
            selectHtml += `<option value="${idx}"${idx===selectedCatIdx?' selected':''}>${cat.name}</option>`;
        });
        selectHtml += `</select></label>`;
        // ツールバーUI（カテゴリ選択＋新規追加）
        let toolbarHtml = `<div class="mainpage-toolbar">
            ${selectHtml}
            <input type="text" id="new-cat-name" class="mainpage-cat-input" placeholder="新しいカテゴリ名" required title="追加するカテゴリ名を入力してください" />
            <button type="button" class="add-cat-btn" title="新しいカテゴリを追加します">カテゴリ追加</button>
        </div>`;
        this.container.insertAdjacentHTML('beforeend', `
            <style>
                .mainpage-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 1.2em;
                    background: #e3f2fd;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(25,118,210,0.07);
                    padding: 1em 1.5em;
                    margin-bottom: 2em;
                    flex-wrap: wrap;
                }
                .mainpage-cat-label {
                    font-weight: bold;
                    font-size: 1.15em;
                    color: #1976d2;
                    background: none;
                    padding: 0;
                    border-radius: 0;
                    margin-right: 0.5em;
                    display: inline-block;
                }
                .mainpage-cat-select {
                    font-size: 1em;
                    padding: 0.35em 1.2em 0.35em 0.7em;
                    border-radius: 6px;
                    border: 1.5px solid #90caf9;
                    background: #f7fbff;
                    color: #1976d2;
                    font-weight: bold;
                    margin-left: 0.5em;
                    box-shadow: 0 1px 4px rgba(25,118,210,0.07);
                    transition: border-color .2s, box-shadow .2s;
                }
                .mainpage-cat-select:focus, .mainpage-cat-select:hover {
                    border-color: #1976d2;
                    box-shadow: 0 2px 8px rgba(25,118,210,0.12);
                }
                .mainpage-cat-input {
                    font-size: 1em;
                    border: 1px solid #90caf9;
                    background: #f7fbff;
                    border-radius: 6px;
                    padding: 0.4em 1em;
                    margin-left: 0.5em;
                    margin-right: 0.5em;
                    min-width: 160px;
                }
                .add-cat-btn {
                    background: linear-gradient(90deg, #1976d2 60%, #42a5f5 100%);
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    padding: 0.6em 1.2em;
                    cursor: pointer;
                    font-size: 1em;
                    box-shadow: 0 1px 4px rgba(25,118,210,0.07);
                    transition: background .2s, box-shadow .2s;
                }
                .add-cat-btn:hover {
                    background: linear-gradient(90deg, #1565c0 60%, #1976d2 100%);
                    box-shadow: 0 2px 8px rgba(25,118,210,0.12);
                }
                @media (max-width: 600px) {
                    .mainpage-toolbar { flex-direction: column; gap: 0.7em; padding: 0.7em 0.5em; }
                    .mainpage-cat-label { font-size: 1em; }
                    .mainpage-cat-select, .mainpage-cat-input, .add-cat-btn { font-size: 0.95em; padding: 0.3em 0.7em; }
                }
                .update-edit-section { margin-bottom: 2rem; padding: 1.5rem; background: #f4f8fb; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
                .update-edit-section h3 { margin-top: 0; color: #1976d2; font-size: 1.2rem; }
                .update-edit-form { display: flex; flex-direction: column; gap: 0.7rem; margin-bottom: 1.2rem; background: #fff; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
                .update-edit-form label { font-weight: bold; color: #333; margin-bottom: 0.2rem; }
                .update-edit-form input, .update-edit-form textarea { width: 100%; padding: 0.4rem; border-radius: 6px; border: 1px solid #bcdffb; background: #f7fbff; font-size: 1rem; }
                .update-edit-form textarea { min-height: 60px; resize: vertical; }
                .save-btn, .delete-btn, .add-btn, .delete-cat-btn {
                    background: linear-gradient(90deg, #1976d2 60%, #42a5f5 100%);
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    padding: 0.6rem 1.2rem;
                    cursor: pointer;
                    margin-right: 0.5rem;
                    font-size: 1rem;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.07);
                    transition: background .2s, box-shadow .2s;
                }
                .save-btn:hover, .add-btn:hover {
                    background: linear-gradient(90deg, #1565c0 60%, #1976d2 100%);
                    box-shadow: 0 2px 8px rgba(25,118,210,0.12);
                }
                .delete-btn, .delete-cat-btn {
                    background: linear-gradient(90deg, #d32f2f 60%, #ff5252 100%);
                }
                .delete-btn:hover, .delete-cat-btn:hover {
                    background: linear-gradient(90deg, #b71c1c 60%, #d32f2f 100%);
                    box-shadow: 0 2px 8px rgba(211,47,47,0.12);
                }
            </style>
            <h2>更新履歴編集</h2>
            ${toolbarHtml}
        `);
        // カテゴリ追加フォームのイベント
        setTimeout(() => {
            const addCatBtn = this.container.querySelector('.add-cat-btn');
            addCatBtn.onclick = () => this.addCategory();
            // カテゴリ選択イベント
            const catSelect = this.container.querySelector('#cat-filter-select');
            if (catSelect) {
                catSelect.onchange = e => {
                    this.selectedCatIdx = Number(e.target.value);
                    this.render();
                };
            }
        }, 0);
        // 選択カテゴリのみ表示
        const cat = this.data.categories[selectedCatIdx];
        if (cat) {
            const idx = selectedCatIdx;
            const section = document.createElement('section');
            section.className = 'update-edit-section';
            section.innerHTML = `<h3>${cat.name}</h3>`;
            // カテゴリ削除ボタン
            const delCatBtn = document.createElement('button');
            delCatBtn.className = 'delete-cat-btn';
            delCatBtn.textContent = 'カテゴリ削除';
            delCatBtn.onclick = () => this.deleteCategory(idx);
            section.appendChild(delCatBtn);
            // 新規追加ボタン
            const addBtn = document.createElement('button');
            addBtn.className = 'add-btn';
            addBtn.textContent = '新規追加';
            addBtn.onclick = () => this.addUpdate(idx);
            section.appendChild(addBtn);
            cat.updates.forEach((upd, uidx) => {
                const form = document.createElement('form');
                form.className = 'update-edit-form';
                form.innerHTML = `
                    <label>日付: <input type="date" name="date" value="${upd.date || ''}" /></label>
                    <label>バージョン: <input type="text" name="version" value="${upd.version || ''}" /></label>
                    <label>説明: <textarea name="description">${upd.description || ''}</textarea></label>
                    <div>
                        <button type="button" class="save-btn">保存</button>
                        <button type="button" class="delete-btn">削除</button>
                    </div>
                `;
                form.querySelector('.save-btn').onclick = () => this.save(idx, uidx, form);
                form.querySelector('.delete-btn').onclick = () => this.deleteUpdate(idx, uidx);
                section.appendChild(form);
            });
            this.container.appendChild(section);
        }
    }

    async save(catIdx, updIdx, form) {
        const fd = new FormData(form);
        const update = {
            date: fd.get('date'),
            version: fd.get('version'),
            description: fd.get('description')
        };
        this.data.categories[catIdx].updates[updIdx] = update;
        await this.copyToClipboard();
        this.msgHub.showMessage('info', '更新データをクリップボードにコピーしました。');
        this.render();
    }

    async deleteUpdate(catIdx, updIdx) {
        this.data.categories[catIdx].updates.splice(updIdx, 1);
        await this.copyToClipboard();
        this.msgHub.showMessage('info', '選択した更新履歴を削除し、クリップボードにコピーしました。');
        this.render();
    }

    async addUpdate(catIdx) {
        // 最新バージョンを取得
        const updates = this.data.categories[catIdx].updates;
        let nextVersion = 'v0.0.1';
        if (updates.length > 0) {
            const latest = updates[0].version || 'v0.0.1';
            // vX.Y.Z形式を分割してインクリメント
            const match = latest.match(/v(\d+)\.(\d+)\.(\d+)/);
            if (match) {
                let [major, minor, patch] = match.slice(1).map(Number);
                patch++;
                nextVersion = `v${major}.${minor}.${patch}`;
            }
        }
        // 本日の日付を取得
        const today = new Date().toISOString().slice(0, 10);
        // 新規履歴は先頭に追加
        updates.unshift({ date: today, version: nextVersion, description: '' });
        await this.copyToClipboard();
        this.msgHub.showMessage('info', '新規履歴を追加し、クリップボードにコピーしました。');
        this.render();
    }

    async addCategory() {
        const input = this.container.querySelector('#new-cat-name');
        const name = input.value.trim();
        if (!name) {
            this.msgHub.showMessage('error', 'カテゴリ名を入力してください');
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        this.data.categories.push({ name, updates: [{ date: today, version: 'v0.0.1', description: '' }] });
        input.value = '';
        await this.copyToClipboard();
        this.msgHub.showMessage('info', '新しいカテゴリを追加し、クリップボードにコピーしました。');
        this.render();
    }

    async deleteCategory(idx) {
        if (!confirm('本当にこのカテゴリを削除しますか？')) return;
        this.data.categories.splice(idx, 1);
        await this.copyToClipboard();
        this.msgHub.showMessage('info', 'カテゴリを削除し、クリップボードにコピーしました。');
        this.render();
    }

    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(JSON.stringify(this.data, null, 2));
        } catch(e) {
            this.msgHub.showMessage('error', 'クリップボードへのコピーに失敗しました。');
        }
    }
}

// プラグイン起動
(function(){
    new UpdateJsonEditor();
})();
