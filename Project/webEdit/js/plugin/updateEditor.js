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
        this.container.insertAdjacentHTML('beforeend', `
            <style>
                .update-edit-section { margin-bottom: 2rem; padding: 1.5rem; background: #f4f8fb; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
                .update-edit-section h3 { margin-top: 0; color: #1976d2; font-size: 1.2rem; }
                .update-edit-form { display: flex; flex-direction: column; gap: 0.7rem; margin-bottom: 1.2rem; background: #fff; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
                .update-edit-form label { font-weight: bold; color: #333; margin-bottom: 0.2rem; }
                .update-edit-form input, .update-edit-form textarea { width: 100%; padding: 0.4rem; border-radius: 6px; border: 1px solid #bcdffb; background: #f7fbff; font-size: 1rem; }
                .update-edit-form textarea { min-height: 60px; resize: vertical; }
                .save-btn, .delete-btn, .add-btn, .add-cat-btn, .delete-cat-btn {
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
                .save-btn:hover, .add-btn:hover, .add-cat-btn:hover {
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
                .cat-add-form {
                    display: flex;
                    gap: 0.7rem;
                    align-items: center;
                    margin-bottom: 2rem;
                    background: #e3f2fd;
                    border-radius: 8px;
                    padding: 0.7rem 1rem;
                }
                .cat-add-form input {
                    font-size: 1rem;
                    border: 1px solid #90caf9;
                    background: #f7fbff;
                    border-radius: 6px;
                    padding: 0.4rem;
                }
                @media (max-width: 600px) {
                    .update-edit-section, .update-edit-form, .cat-add-form { padding: 0.5rem; }
                    .save-btn, .delete-btn, .add-btn, .add-cat-btn, .delete-cat-btn { font-size: 0.9rem; padding: 0.4rem 0.7rem; }
                }
            </style>
            <h2>更新履歴編集</h2>
            <form class="cat-add-form">
                <input type="text" id="new-cat-name" placeholder="新しいカテゴリ名" required />
                <button type="button" class="add-cat-btn">カテゴリ追加</button>
            </form>
        `);
        // カテゴリ追加フォームのイベント
        setTimeout(() => {
            const addCatBtn = this.container.querySelector('.add-cat-btn');
            addCatBtn.onclick = () => this.addCategory();
        }, 0);
        this.data.categories.forEach((cat, idx) => {
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
        });
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
