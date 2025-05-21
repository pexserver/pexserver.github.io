class ShopAdmin {
    constructor() {
        this.shop = new Shop();
        this.initializeUI();
        this.loadData();
    }

    initializeUI() {
        // UIイベントハンドラーの設定
        document.getElementById('addUserBtn').addEventListener('click', () => this.showUserModal());
        document.getElementById('addItemBtn').addEventListener('click', () => this.showItemModal());
        document.getElementById('saveUserBtn').addEventListener('click', () => this.saveUser());
        document.getElementById('saveItemBtn').addEventListener('click', () => this.saveItem());

        // モーダルの初期化
        this.userModal = new bootstrap.Modal(document.getElementById('userModal'));
        this.itemModal = new bootstrap.Modal(document.getElementById('itemModal'));
    }

    async loadData() {
        await this.loadUsers();
        await this.loadItems();
        await this.loadTransactions();
    }

    async loadUsers() {
        try {
            const users = await this.shop.callJsonDbApi('findItems', {
                query: { type: 'user' }
            });
            
            const tbody = document.getElementById('userTableBody');
            tbody.innerHTML = '';
            
            users.forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.data.name}</td>
                    <td>${user.data.balance || 0}円</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="shopAdmin.editUser('${user.id}')">編集</button>
                        <button class="btn btn-sm btn-danger" onclick="shopAdmin.deleteUser('${user.id}')">削除</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('ユーザー一覧の読み込みに失敗しました:', error);
            alert('ユーザー一覧の読み込みに失敗しました。');
        }
    }

    async loadItems() {
        try {
            const items = await this.shop.callJsonDbApi('findItems', {
                query: { type: 'item' }
            });
            
            const tbody = document.getElementById('itemTableBody');
            tbody.innerHTML = '';
            
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.data.name}</td>
                    <td>${item.data.price}円</td>
                    <td>${item.data.stock}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="shopAdmin.editItem('${item.id}')">編集</button>
                        <button class="btn btn-sm btn-danger" onclick="shopAdmin.deleteItem('${item.id}')">削除</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('アイテム一覧の読み込みに失敗しました:', error);
            alert('アイテム一覧の読み込みに失敗しました。');
        }
    }

    async loadTransactions() {
        try {
            const transactions = await this.shop.callJsonDbApi('findItems', {
                query: { type: 'transaction' }
            });
            
            const tbody = document.getElementById('transactionTableBody');
            tbody.innerHTML = '';
            
            transactions.forEach(transaction => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(transaction.data.date).toLocaleString()}</td>
                    <td>${transaction.data.userName || ''}</td>
                    <td>${transaction.data.itemName || ''}</td>
                    <td>${transaction.data.amount}円</td>
                    <td>${transaction.data.type}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('取引履歴の読み込みに失敗しました:', error);
            alert('取引履歴の読み込みに失敗しました。');
        }
    }

    showUserModal(userId = null) {
        document.getElementById('userId').value = userId || '';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('balance').value = '0';
        
        if (userId) {
            this.loadUserData(userId);
        }
        
        this.userModal.show();
    }

    async loadUserData(userId) {
        try {
            const user = await this.shop.callJsonDbApi('findItems', {
                query: { id: userId }
            });
            
            if (user && user.length > 0) {
                const userData = user[0];
                document.getElementById('username').value = userData.data.name;
                document.getElementById('balance').value = userData.data.balance || 0;
            }
        } catch (error) {
            console.error('ユーザー情報の読み込みに失敗しました:', error);
            alert('ユーザー情報の読み込みに失敗しました。');
        }
    }

    async saveUser() {
        try {
            const userId = document.getElementById('userId').value;
            const userData = {
                name: document.getElementById('username').value,
                password: document.getElementById('password').value,
                balance: parseInt(document.getElementById('balance').value),
                type: 'user'
            };

            if (userId) {
                // 既存ユーザーの編集
                if (!userData.password) {
                    delete userData.password;
                }
                await this.shop.callJsonDbApi('updateItem', {
                    query: { id: userId },
                    update: userData
                });
            } else {
                // 新規ユーザーの作成
                userData.id = crypto.randomUUID();
                await this.shop.callJsonDbApi('insertItem', {
                    item: userData
                });
            }

            this.userModal.hide();
            await this.loadUsers();
        } catch (error) {
            console.error('ユーザーの保存に失敗しました:', error);
            alert('ユーザーの保存に失敗しました。');
        }
    }

    showItemModal(itemId = null) {
        document.getElementById('itemId').value = itemId || '';
        document.getElementById('itemName').value = '';
        document.getElementById('itemPrice').value = '';
        document.getElementById('itemStock').value = '';
        
        if (itemId) {
            this.loadItemData(itemId);
        }
        
        this.itemModal.show();
    }

    async loadItemData(itemId) {
        try {
            const item = await this.shop.callJsonDbApi('findItems', {
                query: { id: itemId }
            });
            
            if (item && item.length > 0) {
                const itemData = item[0];
                document.getElementById('itemName').value = itemData.data.name;
                document.getElementById('itemPrice').value = itemData.data.price;
                document.getElementById('itemStock').value = itemData.data.stock;
            }
        } catch (error) {
            console.error('アイテム情報の読み込みに失敗しました:', error);
            alert('アイテム情報の読み込みに失敗しました。');
        }
    }

    async saveItem() {
        try {
            const itemId = document.getElementById('itemId').value;
            const itemData = {
                name: document.getElementById('itemName').value,
                price: parseInt(document.getElementById('itemPrice').value),
                stock: parseInt(document.getElementById('itemStock').value),
                type: 'item'
            };

            if (itemId) {
                // 既存アイテムの編集
                await this.shop.callJsonDbApi('updateItem', {
                    query: { id: itemId },
                    update: itemData
                });
            } else {
                // 新規アイテムの作成
                itemData.id = crypto.randomUUID();
                await this.shop.callJsonDbApi('insertItem', {
                    item: itemData
                });
            }

            this.itemModal.hide();
            await this.loadItems();
        } catch (error) {
            console.error('アイテムの保存に失敗しました:', error);
            alert('アイテムの保存に失敗しました。');
        }
    }

    async deleteUser(userId) {
        if (confirm('このユーザーを削除してもよろしいですか？')) {
            try {
                await this.shop.callJsonDbApi('deleteItem', {
                    query: { id: userId }
                });
                await this.loadUsers();
            } catch (error) {
                console.error('ユーザーの削除に失敗しました:', error);
                alert('ユーザーの削除に失敗しました。');
            }
        }
    }

    async deleteItem(itemId) {
        if (confirm('このアイテムを削除してもよろしいですか？')) {
            try {
                await this.shop.callJsonDbApi('deleteItem', {
                    query: { id: itemId }
                });
                await this.loadItems();
            } catch (error) {
                console.error('アイテムの削除に失敗しました:', error);
                alert('アイテムの削除に失敗しました。');
            }
        }
    }

    editUser(userId) {
        this.showUserModal(userId);
    }

    editItem(itemId) {
        this.showItemModal(itemId);
    }
}

// グローバルインスタンスの作成
const shopAdmin = new ShopAdmin();

// ShopクラスのcallJsonDbApiがform-style POSTに統一されたため、admin.js側はそのまま利用可能
