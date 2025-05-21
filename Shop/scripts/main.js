// グローバルshopインスタンスを生成
window.shop = new Shop();

// ネットワーク状態の監視
let isOnline = navigator.onLine;
const networkStatus = document.createElement('div');
networkStatus.className = 'network-status';
document.body.appendChild(networkStatus);

function updateNetworkStatus() {
    networkStatus.className = `network-status ${isOnline ? 'online' : 'offline'}`;
    networkStatus.textContent = isOnline ? 'オンライン' : 'オフライン';
    networkStatus.style.display = 'block';
    setTimeout(() => {
        networkStatus.style.display = 'none';
    }, 3000);

    const loginModal = document.getElementById('loginModal');
    if (!isOnline) {
        loginModal.classList.add('offline');
    } else {
        loginModal.classList.remove('offline');
    }
}

window.addEventListener('online', () => {
    isOnline = true;
    updateNetworkStatus();
    shop.checkLoginState(); // オンラインに戻ったらセッションを確認
});

window.addEventListener('offline', () => {
    isOnline = false;
    updateNetworkStatus();
});

// ページ読み込み時の初期化
window.addEventListener('load', async () => {
    try {
        updateNetworkStatus(); // 初期のネットワーク状態を表示

        const loginForm = document.getElementById('loginForm');
        const loginError = document.getElementById('loginError');
        const logoutBtn = document.getElementById('logoutBtn');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginBtn = loginForm.querySelector('button[type="submit"]');

        // 入力フィールドのバリデーション
        function validateInput(input) {
            const formGroup = input.closest('.form-group');
            if (input.value.trim() === '') {
                formGroup.classList.add('error');
                formGroup.classList.remove('success');
                return false;
            } else {
                formGroup.classList.remove('error');
                formGroup.classList.add('success');
                return true;
            }
        }

        // リアルタイムバリデーション
        usernameInput.addEventListener('input', () => validateInput(usernameInput));
        passwordInput.addEventListener('input', () => validateInput(passwordInput));

        // ログインフォームの処理
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // オフライン時は処理しない
            if (!navigator.onLine) {
                loginError.textContent = 'インターネット接続を確認してください';
                loginError.classList.add('visible');
                return;
            }

            // 入力値の検証
            const isUsernameValid = validateInput(usernameInput);
            const isPasswordValid = validateInput(passwordInput);

            if (!isUsernameValid || !isPasswordValid) {
                loginError.textContent = '全ての項目を入力してください';
                loginError.classList.add('visible');
                return;
            }

            // ログイン処理
            try {
                loginForm.classList.add('loading');
                loginBtn.disabled = true;
                loginError.classList.remove('visible');

                await shop.login(usernameInput.value, passwordInput.value);
                
                loginError.textContent = '';
                // ログイン後の初期化
                await initializeShop();
            } catch (error) {
                loginError.textContent = error.message;
                loginError.classList.add('visible');
            } finally {
                loginForm.classList.remove('loading');
                loginBtn.disabled = false;
            }
        });

        logoutBtn.addEventListener('click', () => {
            if (confirm('ログアウトしてもよろしいですか？')) {
                shop.logout();
                // フォームをリセット
                loginForm.reset();
                const formGroups = loginForm.querySelectorAll('.form-group');
                formGroups.forEach(group => {
                    group.classList.remove('error', 'success');
                });
                loginError.classList.remove('visible');
            }
        });

        // すでにログインしている場合は初期化
        if (shop.currentUser) {
            await initializeShop();
        }
    } catch (error) {
        console.error('初期化エラー:', error);
    }
});

// ショップの初期化処理
async function initializeShop() {
    try {
        // items.jsonからデータを読み込む
        const response = await fetch('items.json');
        if (!response.ok) {
            throw new Error('商品データの読み込みに失敗しました');
        }
        const items = await response.json();

        // アイテムデータの検証と追加
        if (!Array.isArray(items)) {
            throw new Error('無効な商品データ形式です');
        }

        // 商品をショップに追加
        items.forEach((item, index) => {
            // 必須フィールドの検証
            if (!item.id || !item.name || !item.price) {
                console.warn(`商品データが不完全です (インデックス: ${index})`);
                return;
            }
            shop.addItem(item);
        });

        // カテゴリーリストの更新
        updateCategoryList();

        // 商品一覧の表示
        displayItems();

        // 残高の表示を更新
        shop.fetchBalance();

        // 検索機能の初期化
        initializeSearch();

        // イベントリスナーの設定
        setupEventListeners();
    } catch (error) {
        console.error('ショップ初期化エラー:', error);
        alert('ショップの初期化中にエラーが発生しました。ページを再読み込みしてください。');
    }
}

// イベントリスナーの設定
function setupEventListeners() {
  const cartBtn = document.getElementById('cartBtn');
  const historyBtn = document.getElementById('historyBtn');
  const checkoutBtn = document.getElementById('checkoutBtn');

  // カートボタンのクリックイベント
  cartBtn.addEventListener('click', () => {
    const cartModal = document.getElementById('cartModal');
    cartModal.classList.add('visible');
  });

  // 履歴ボタンのクリックイベント
  historyBtn.addEventListener('click', async () => {
    const historyModal = document.getElementById('historyModal');
    const historyContainer = document.getElementById('purchaseHistory');
    
    // 履歴データを取得
    const history = await shop.getPurchaseHistory();
    
    // 履歴の表示を更新
    historyContainer.innerHTML = history.map(entry => `
      <div class="history-item">
        <div class="history-header">
          <span class="history-date">${new Date(entry.data.timestamp).toLocaleString()}</span>
          <span class="history-total">${entry.data.total}コイン</span>
        </div>
        <div class="history-items">
          ${entry.data.items.map(item => `
            <div class="history-item-detail">
              <span>${item.name}</span>
              <span>${item.quantity}個</span>
              <span>${item.price * item.quantity}コイン</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('') || '<p>購入履歴がありません</p>';
    
    historyModal.classList.add('visible');
  });

  // 購入ボタンのクリックイベント
  checkoutBtn.addEventListener('click', async () => {
    const result = await shop.checkout();
    if (result.success) {
      alert('購入が完了しました！');
      closeModal(document.getElementById('cartModal'));
    } else {
      alert(result.error);
    }
  });

  // モーダルの外側クリックで閉じる
  document.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('modal')) {
      const modal = e.target;
      if (modal.classList.contains('visible')) {
        closeModal(modal);
      }
    }
  });

  // ESCキーでモーダルを閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
      const cartModal = document.getElementById('cartModal');
      const historyModal = document.getElementById('historyModal');

      if (cartModal.classList.contains('visible')) {
        closeModal(cartModal);
      } else if (historyModal.classList.contains('visible')) {
        closeModal(historyModal);
      }
    }
  });
}

// 検索機能の初期化
function initializeSearch() {
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const items = shop.items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
    );
    displayItems(items);
  });
}

// カテゴリーリストを更新
function updateCategoryList() {
  const categoryList = document.getElementById("categoryList");
  const categories = ["全て", ...Array.from(shop.categories)];

  categoryList.innerHTML = categories
    .map(
      (category) => `
        <li onclick="filterByCategory('${category}')" class="category-item">
            ${category}
            <span class="category-count">${
              category === "全て"
                ? shop.items.length
                : shop.items.filter((item) => item.category === category).length
            }</span>
        </li>
    `
    )
    .join("");
}

// カテゴリーでフィルター
function filterByCategory(category) {
  const items =
    category === "全て"
      ? shop.items
      : shop.items.filter((item) => item.category === category);
  displayItems(items);

  // アクティブなカテゴリーを視覚的に表示
  document.querySelectorAll(".category-item").forEach((item) => {
    item.classList.remove("active");
    if (item.textContent.includes(category)) {
      item.classList.add("active");
    }
  });
}

// 商品一覧を表示
function displayItems(items = shop.items) {
  const container = document.getElementById("itemsContainer");
  container.innerHTML = items
    .map((item, index) => {
      const stock = shop.getStock(item.id);
      const isOutOfStock = stock <= 0;
      const isLowStock = stock < 10;

      return `
            <div class="shop-item ${isOutOfStock ? "out-of-stock" : ""}"
                role="article"
                aria-label="${item.name}"
                style="animation-delay: ${index * 0.1}s">
                <div class="item-image-container">
                    <img src="${item.image}" alt="${item.name}の画像">
                    ${
                      isLowStock
                        ? `
                        <span class="stock-warning" role="status" aria-live="polite">
                            残り${stock}個
                        </span>
                    `
                        : ""
                    }
                </div>
                <h3 class="item-title">${item.name}</h3>
                <p class="item-description">${item.description}</p>
                <div class="item-details">
                    <div class="item-price" aria-label="価格: ${
                      item.price
                    }コイン">
                        <span class="price-icon">💰</span>
                        ${item.price} コイン
                    </div>
                    <div class="item-stock" aria-label="在庫: ${stock}個">
                        <span class="stock-icon">📦</span>
                        在庫: ${stock}
                    </div>
                </div>
                <button 
                    class="add-to-cart-btn ${isOutOfStock ? "disabled" : ""}"
                    onclick="shop.addToCart('${item.id}')"
                    ${isOutOfStock ? "disabled" : ""}
                    aria-disabled="${isOutOfStock}"
                    aria-label="${
                      isOutOfStock ? "在庫切れ" : item.name + "をカートに追加"
                    }">
                    <span class="btn-icon">${isOutOfStock ? "❌" : "🛒"}</span>
                    <span class="btn-text">${
                      isOutOfStock ? "在庫切れ" : "カートに追加"
                    }</span>
                </button>
            </div>
        `;
    })
    .join("");
}

// 商品検索
function searchItems(query) {
  const items = query ? shop.searchItems(query) : shop.items;
  displayItems(items);
}

// モーダルを開く関数
function openModal(modal) {
  modal.style.display = "block";
  document.body.style.overflow = "hidden"; // スクロール防止
  requestAnimationFrame(() => {
    modal.classList.add("visible");
  });
}

// モーダルを閉じる関数
function closeModal(modal) {
  modal.classList.remove("visible");
  setTimeout(() => {
    modal.style.display = "none";
    document.body.style.overflow = ""; // スクロール再開
  }, 300);
}

// カートの表示/非表示を切り替え
function toggleCart(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const modal = document.getElementById("cartModal");

  if (!modal.classList.contains("visible")) {
    openModal(modal);
  } else {
    closeModal(modal);
  }
}

// 購入履歴の表示/非表示を切り替え
function toggleHistory(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const modal = document.getElementById("historyModal");    if (!modal.classList.contains("visible")) {
        const historyContainer = document.getElementById("purchaseHistory");
        historyContainer.innerHTML = renderPurchaseHistory();
        openModal(modal);
    } else {
        closeModal(modal);
    }
}

// 購入履歴をレンダリング
function renderPurchaseHistory() {
  const history = dataManager.getPurchaseHistory();
  if (history.length === 0) {
    return "<p>購入履歴がありません</p>";
  }

  return history
    .map(
      (purchase) => `
        <div class="purchase-history-item">
            <div class="purchase-header">
                <span class="purchase-date">
                    ${new Date(purchase.timestamp).toLocaleString("ja-JP")}
                </span>
                <span class="purchase-total">
                    合計: ${purchase.total}コイン
                </span>
            </div>
            <div class="purchase-items">
                ${purchase.items
                  .map(
                    (item) => `
                    <div class="purchase-item">
                        <span class="item-name">${item.name}</span>
                        <span class="item-quantity">x${item.quantity}</span>
                        <span class="item-price">${
                          item.price * item.quantity
                        }コイン</span>
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>
    `
    )
    .join("");
}

// イベントリスナーの設定
document.addEventListener("DOMContentLoaded", () => {
  // カートアイコンのクリックイベント
  const cartIcon = document.querySelector(".cart-icon");
  if (cartIcon) {
    cartIcon.addEventListener("click", toggleCart);
  }

  // 履歴ボタンのクリックイベント
  const historyBtn = document.querySelector(".history-btn");
  if (historyBtn) {
    historyBtn.addEventListener("click", toggleHistory);
  }

  // モーダルの外側クリックで閉じる
  document.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("modal")) {
      const modal = e.target;
      if (modal.classList.contains("visible")) {
        closeModal(modal);
      }
    }
  });

  // ESCキーでモーダルを閉じる
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const cartModal = document.getElementById("cartModal");
      const historyModal = document.getElementById("historyModal");

      if (cartModal.classList.contains("visible")) {
        closeModal(cartModal);
      } else if (historyModal.classList.contains("visible")) {
        closeModal(historyModal);
      }
    }
  });
});

// 購入履歴をクリア
function clearHistory() {
  if (
    confirm("購入履歴を削除してもよろしいですか？\nこの操作は取り消せません。")
  ) {
    dataManager.clearPurchaseHistory();
    const historyContainer = document.getElementById("purchaseHistory");
    historyContainer.innerHTML = "<p>購入履歴がありません</p>";
    showNotification("購入履歴を削除しました", "success");
  }
}

// 通知を表示
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // アニメーション用のクラスを追加
  setTimeout(() => notification.classList.add("show"), 10);

  // 3秒後に非表示
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
