// グローバル変数宣言
let toolsData = {};
let currentFilteredTools = [];
let currentPage = 1;
const itemsPerPage = 8; // 1ページあたりの表示件数
let platformModal = null;
let currentToolDataForMainModal = null;

// --- クッキー管理 ---
const CookieManager = {
    set: function (name, value, days = 365) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
    },
    get: function (name) {
        return document.cookie.split('; ').reduce((r, v) => {
            const parts = v.split('=');
            return parts[0] === encodeURIComponent(name) ? decodeURIComponent(parts[1]) : r;
        }, '');
    },
    remove: function (name) {
        this.set(name, '', -1);
    }
};

// --- お気に入り管理 ---
const FAVORITE_KEY = 'pex_favorites';
function getFavorites() {
    const raw = CookieManager.get(FAVORITE_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}
function setFavorites(arr) {
    CookieManager.set(FAVORITE_KEY, JSON.stringify(arr));
}
function isFavorite(toolId) {
    return getFavorites().includes(toolId);
}
function addFavorite(toolId) {
    const favs = getFavorites();
    if (!favs.includes(toolId)) {
        favs.push(toolId);
        setFavorites(favs);
    }
}
function removeFavorite(toolId) {
    let favs = getFavorites();
    favs = favs.filter(id => id !== toolId);
    setFavorites(favs);
}

// --- ユーティリティ関数 ---

/**
 * tools.json を非同期で取得する関数
 */
async function getToolJson() {
  try {
    const response = await fetch("./module/tools.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // データがオブジェクト形式か基本的なチェック
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid JSON data format received.");
    }
    return data;
  } catch (err) {
    console.error("tools.json の読み込みまたは解析に失敗しました:", err);
    // エラーメッセージをUIに表示
    const toolGrid = document.querySelector(".tool-grid");
    if (toolGrid) {
      toolGrid.innerHTML =
        '<p style="color: red; text-align: center; grid-column: 1 / -1; padding: 2em;">ツールの読み込みに失敗しました。データ形式を確認するか、ページを再読み込みしてください。</p>';
    }
    const paginationContainer = document.querySelector(".pagination");
    if (paginationContainer) paginationContainer.innerHTML = ""; // ページネーションもクリア
    return {}; // 空のオブジェクトを返す
  }
}

/**
 * ツールIDに基づいて詳細データを取得
 */
function getToolDetails(id) {
  return toolsData[id] || null;
}

// --- グローバルリポジトリ (外部からアクセス可能にする場合) ---
window.toolsRepository = {
  getToolDetails: getToolDetails,
  getAllTools: function () {
    if (Object.keys(toolsData).length === 0) {
      console.warn("getAllTools called before toolsData was populated or fetch failed.");
      return [];
    }
    // IDも含めて配列にして返す
    return Object.keys(toolsData).map((key) => ({
      id: key,
      ...toolsData[key],
    }));
  },
};


// --- プラットフォーム選択モーダル関連 ---

/**
 * プラットフォーム選択モーダルのDOM要素を作成（まだなければ）
 */
function ensurePlatformModalExists() {
  if (platformModal) return;

  platformModal = document.createElement("div");
  platformModal.id = "platform-modal";
  platformModal.classList.add("modal"); // modal.css のスタイルを適用

  // スタイル設定（modal.css でカバーされている部分や上書き）
  platformModal.style.display = "none"; // 初期状態は非表示
  platformModal.style.position = "fixed";
  platformModal.style.left = "0";
  platformModal.style.top = "0";
  platformModal.style.width = "100%";
  platformModal.style.height = "100%";
  platformModal.style.backgroundColor = "rgba(0,0,0,0.6)";
  platformModal.style.zIndex = "1050"; // 詳細モーダルより手前に表示する場合
  platformModal.style.display = "flex";
  platformModal.style.alignItems = "center";
  platformModal.style.justifyContent = "center";
  platformModal.style.visibility = "hidden";
  platformModal.style.opacity = "0";
  platformModal.style.transition = "visibility 0s linear 0.2s, opacity 0.2s linear";

  const modalContent = document.createElement("div");
  modalContent.classList.add("modal-container"); // modal.css のスタイルを適用
  modalContent.style.maxWidth = "400px"; // 必要に応じて調整
  modalContent.style.width = "90%";
  modalContent.style.padding = "2em";
  modalContent.style.textAlign = "center";
  // modal.css で背景色や文字色が定義されているはずなので、ここでは指定しない
  // modalContent.style.background = "var(--background-color, #fff)";
  // modalContent.style.color = "var(--text-color, #333)";

  modalContent.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 1.5em;">プラットフォームを選択</h3>
        <div id="platform-btns" style="width: 100%; display: grid; gap: 0.75em;">
            <!-- Platform buttons will be added here -->
        </div>
        <button id="platform-modal-close" class="btn btn-outline" style="margin-top: 1.5em; cursor: pointer;"><i class="fas fa-times"></i> 閉じる</button>
    `;
  platformModal.appendChild(modalContent);
  document.body.appendChild(platformModal);

  // イベントリスナーの設定
  const closeButton = platformModal.querySelector("#platform-modal-close");
  closeButton.onclick = hidePlatformModal;

  // モーダル外クリックで閉じる
  platformModal.addEventListener("click", (e) => {
    if (e.target === platformModal) {
      hidePlatformModal();
    }
  });
}

/**
 * プラットフォーム選択モーダルを非表示にする
 */
function hidePlatformModal() {
  if (platformModal) {
    platformModal.style.visibility = "hidden";
    platformModal.style.opacity = "0";
    platformModal.style.transition = "visibility 0s linear 0.2s, opacity 0.2s linear";

    // 中身をクリア
    const btnsDiv = platformModal.querySelector("#platform-btns");
    if (btnsDiv) btnsDiv.innerHTML = "";
  }
}

/**
 * プラットフォーム選択モーダルを表示する
 */
function showPlatformSelectionModal(toolData) {
  ensurePlatformModalExists(); // モーダルがなければ作成

  if (!toolData) {
    console.error("showPlatformSelectionModal: toolData is missing.");
    alert("エラーが発生しました。プラットフォームを選択できません。");
    return;
  }

  // downloadUrl_xxx 形式のキーを持つエントリを抽出
  const platformUrls = Object.entries(toolData)
    .filter(([key, val]) => key.startsWith("downloadUrl_") && val)
    .map(([key, val]) => {
      const platform = key.replace("downloadUrl_", "");
      // 表示名の調整
      let platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
      if (platform.toLowerCase() === "macos") platformLabel = "macOS";
      if (platform.toLowerCase() === "linux") platformLabel = "Linux";
      if (platform.toLowerCase() === "windows") platformLabel = "Windows";
      // 必要であれば他のプラットフォーム名も調整
      return { platform: platformLabel, url: val };
    });

  // プラットフォーム別URLがない場合
  if (platformUrls.length === 0) {
    console.warn(`No platform-specific download URLs found for tool: ${toolData.title}`);
    alert(`「${toolData.title}」には、選択可能なプラットフォーム別ダウンロードリンクがありません。`);
    return;
  }

  // モーダルの要素を取得
  const btnsDiv = platformModal.querySelector("#platform-btns");
  const modalTitleEl = platformModal.querySelector("h3");

  if (!btnsDiv || !modalTitleEl) {
    console.error("Platform modal elements (#platform-btns or h3) not found!");
    return;
  }

  // モーダルの中身を設定
  modalTitleEl.textContent = `「${toolData.title}」のプラットフォームを選択`;
  btnsDiv.innerHTML = ""; // 既存のボタンをクリア

  // プラットフォームごとのダウンロードボタンを作成
  platformUrls.forEach(({ platform, url }) => {
    const btn = document.createElement("a");
    btn.href = url;
    btn.target = "_blank"; // 新しいタブで開く
    btn.rel = "noopener noreferrer";
    btn.textContent = `${platform} 版ダウンロード`;
    btn.classList.add("btn", "btn-primary");
    btn.style.display = "block";
    btn.style.textDecoration = "none";
    // btn.style.marginBottom = "0.5em"; // gap で設定しているので不要かも

    // クリックしたらモーダルを閉じる（任意）
    btn.onclick = () => {
      // hidePlatformModal(); // ダウンロードリンククリックで閉じなくても良いかも
    };
    btnsDiv.appendChild(btn);
  });

  // モーダルを表示
  platformModal.style.visibility = "visible";
  platformModal.style.opacity = "1";
  platformModal.style.transition = "visibility 0s linear 0s, opacity 0.2s linear";
}

// --- ツール詳細モーダル関連 ---

/**
 * ツール詳細モーダルのイベントリスナーなどを初期化
 */
function initializeToolModals() {
  const toolGrid = document.querySelector(".tool-grid");
  const modal = document.getElementById("tool-detail-modal");
  const modalClose = document.getElementById("modal-close");

  // モーダル内の要素を取得
  const modalTitle = document.getElementById("modal-title");
  const modalImage = document.getElementById("modal-image");
  const modalDescription = document.getElementById("modal-description");
  const modalCategory = document.getElementById("modal-category");
  const modalVersion = document.getElementById("modal-version");
  const modalUpdated = document.getElementById("modal-updated");
  const modalDownloadBtn = document.getElementById("modal-download");
  const modalDocBtn = document.getElementById("modal-docs");
  const modalFavoriteBtn = document.getElementById("modal-favorite-btn");

  // 要素が存在するか確認
  if (!toolGrid || !modal || !modalClose || !modalTitle || !modalImage || !modalDescription || !modalCategory || !modalVersion || !modalUpdated || !modalDownloadBtn || !modalDocBtn) {
    console.warn("One or more elements for the tool detail modal are missing. Modal functionality might be incomplete.");
    return; // 必要な要素がなければ初期化中断
  }

  // ツールカードクリックでモーダル表示
  toolGrid.addEventListener("click", function (e) {
    const card = e.target.closest(".tool-card");
    // カード内のボタンクリックはモーダル表示をトリガーしない
    const isButtonClick = e.target.closest(".btn");

    if (card && !isButtonClick) {
      const toolId = card.getAttribute("data-id");
      const toolData = window.toolsRepository.getToolDetails(toolId);
      currentToolDataForMainModal = toolData; // 現在表示中のツールデータを保持

      if (toolData) {
        // モーダルにデータを設定
        modalTitle.textContent = toolData.title || "ツール詳細";
        modalImage.src = toolData.imageLarge || toolData.image || "../libs/Assets/images/placeholder.png"; // 大きい画像があれば優先
        modalImage.alt = toolData.title || "ツール画像";
        // 画像が見つからない場合は404.pngを表示
        modalImage.onerror = function() {
          this.onerror = null;
          this.src = './module/404.png';
        };
        modalDescription.innerHTML = toolData.detailedDescription || toolData.description || "<p>詳細情報はありません。</p>";

        // メタ情報の設定 (存在しない場合は 'N/A' など表示)
        const setText = (el, value, fallback = "N/A") => {
          if (el) el.textContent = value || fallback;
        };
        setText(modalCategory, toolData.categoryType);
        setText(modalVersion, toolData.version);
        setText(modalUpdated, toolData.updated);

        // ダウンロードボタンの設定
        const hasPlatformUrls = Object.keys(toolData).some(key => key.startsWith("downloadUrl_") && toolData[key]);
        modalDownloadBtn.style.display = "none"; // 一旦非表示
        modalDownloadBtn.href = "#";
        modalDownloadBtn.removeAttribute("target");
        modalDownloadBtn.removeAttribute("rel");
        modalDownloadBtn.onclick = null; // クリックイベントをリセット
        modalDownloadBtn.classList.remove("disabled");
        modalDownloadBtn.removeAttribute("aria-disabled");
        modalDownloadBtn.removeAttribute("data-requires-platform-selection");

        if (toolData.downloadUrl) { // 直接のダウンロードURLがある場合
          modalDownloadBtn.href = toolData.downloadUrl;
          modalDownloadBtn.target = "_blank";
          modalDownloadBtn.rel = "noopener noreferrer";
          modalDownloadBtn.style.display = "inline-flex";
        } else if (hasPlatformUrls) { // プラットフォーム別URLがある場合
          modalDownloadBtn.style.display = "inline-flex";
          modalDownloadBtn.setAttribute("data-requires-platform-selection", "true");
          // クリック時にプラットフォーム選択モーダルを開く
          modalDownloadBtn.onclick = function (event) {
            event.preventDefault();
            if (currentToolDataForMainModal) {
              showPlatformSelectionModal(currentToolDataForMainModal);
            } else {
              console.error("Platform selection needed, but tool data is missing for the main modal.");
              alert("エラーが発生しました。プラットフォームを選択できません。");
            }
          };
        } else { // ダウンロードURLがない場合
          modalDownloadBtn.style.display = "none"; // 表示しない or disabled 状態にする
          // modalDownloadBtn.classList.add("disabled");
          // modalDownloadBtn.setAttribute("aria-disabled", "true");
        }

        // ドキュメントボタンの設定
        if (toolData.docsUrl) {
          modalDocBtn.href = toolData.docsUrl;
          modalDocBtn.target = "_blank";
          modalDocBtn.rel = "noopener noreferrer";
          modalDocBtn.style.display = "inline-flex";
        } else {
          modalDocBtn.style.display = "none";
        }

        // お気に入りボタンの状態反映
        if (modalFavoriteBtn) {
          if (isFavorite(toolId)) {
            modalFavoriteBtn.classList.add('active');
            modalFavoriteBtn.innerHTML = '<i class="fa fa-star"></i> お気に入り解除';
          } else {
            modalFavoriteBtn.classList.remove('active');
            modalFavoriteBtn.innerHTML = '<i class="fa fa-star"></i> お気に入り追加';
          }
          modalFavoriteBtn.onclick = function() {
            if (isFavorite(toolId)) {
              removeFavorite(toolId);
              modalFavoriteBtn.classList.remove('active');
              modalFavoriteBtn.innerHTML = '<i class="fa fa-star"></i> お気に入り追加';
            } else {
              addFavorite(toolId);
              modalFavoriteBtn.classList.add('active');
              modalFavoriteBtn.innerHTML = '<i class="fa fa-star"></i> お気に入り解除';
            }
            // お気に入りカテゴリが選択中なら即時反映
            const activeCat = document.querySelector('.category-nav a.active');
            if (activeCat && activeCat.getAttribute('href') === '#favorite') {
              filterAndDisplayTools({ category: 'favorite' });
            }
          };
        }

        // モーダル表示
        modal.classList.add("show");
        document.body.style.overflow = "hidden"; // 背景スクロール禁止
      } else {
        console.error(`Tool data not found for ID: ${toolId}`);
        alert("ツールの詳細情報を読み込めませんでした。");
        currentToolDataForMainModal = null;
      }
    }
  });

  // モーダルを閉じる関数
  const closeMainModal = () => {
    if (modal) {
      modal.classList.remove("show");
      document.body.style.overflow = ""; // 背景スクロール許可
      currentToolDataForMainModal = null; // 保持していたデータをクリア
    }
  };

  // 閉じるボタンでモーダルを閉じる
  modalClose.addEventListener("click", closeMainModal);

  // モーダル外クリックで閉じる (プラットフォーム選択モーダル表示中は除く)
  window.addEventListener("click", function (e) {
    // プラットフォームモーダルが表示されているかチェック
    const isPlatformModalVisible = platformModal && platformModal.style.visibility === 'visible';
    if (!isPlatformModalVisible && e.target === modal) {
      closeMainModal();
    }
  });

  // Escapeキーでモーダルを閉じる
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      // プラットフォームモーダルが開いていればそちらを優先して閉じる
      if (platformModal && platformModal.style.visibility === 'visible') {
        hidePlatformModal();
      } else if (modal && modal.classList.contains("show")) { // 詳細モーダルが開いていれば閉じる
        closeMainModal();
      }
    }
  });
}


// --- フィルタリング、ページネーション、表示関連 ---

/**
 * フィルタ、ソート、ページネーションのUIとロジックを初期化
 */
function initializeFiltersAndPagination() {
  // UI要素を取得
  const toolSearch = document.getElementById("tool-search");
  const categoryFilter = document.getElementById("category-filter");
  const platformFilter = document.getElementById("platform-filter");
  const sortFilter = document.getElementById("sort-filter");
  const applyFilterBtn = document.getElementById("apply-filter");
  const resetFilterBtn = document.getElementById("reset-filter");
  const filterToggle = document.getElementById("filter-toggle");
  const filterContent = document.getElementById("filter-content");
  const categoryNavLinks = document.querySelectorAll(".category-nav a");
  const toolGrid = document.querySelector(".tool-grid");
  const paginationContainer = document.querySelector(".pagination");
  const sectionTitle = document.querySelector(".section-title"); // セクションタイトル要素

  // UI要素の存在チェック
  if (!toolSearch || !categoryFilter || !platformFilter || !sortFilter || !applyFilterBtn || !resetFilterBtn || !filterToggle || !filterContent || categoryNavLinks.length === 0 || !toolGrid || !paginationContainer || !sectionTitle) {
    console.warn("One or more elements for filtering/pagination are missing. Functionality might be incomplete.");
    // フィルタリングなしで全ツール表示を試みる (toolsDataがあれば)
    if (Object.keys(toolsData).length > 0) {
      console.warn("Attempting to display all tools without filters.");
      currentFilteredTools = window.toolsRepository.getAllTools(); // フィルタせず全ツール
      currentFilteredTools.sort((a, b) => { // デフォルトで最新順ソート
        const dateA = a.updated ? new Date(a.updated) : null;
        const dateB = b.updated ? new Date(b.updated) : null;
        const timeA = dateA && !isNaN(dateA.getTime()) ? dateA.getTime() : 0;
        const timeB = dateB && !isNaN(dateB.getTime()) ? dateB.getTime() : 0;
        if (timeA === 0 && timeB === 0) return 0;
        if (timeA === 0) return 1;
        if (timeB === 0) return -1;
        return timeB - timeA;
      });
      currentPage = 1;
      renderToolGridPage(currentPage);
      renderPagination();
    }
    return; // 初期化中断
  }

  // 現在のUI上のフィルタ値を取得するヘルパー関数
  const getCurrentUiFilters = () => ({
    search: toolSearch.value.trim().toLowerCase(),
    category: categoryFilter.value, // <select> の value
    platform: platformFilter.value, // <select> の value
    sort: sortFilter.value,      // <select> の value
  });

  // 現在アクティブなカテゴリナビゲーションのカテゴリを取得するヘルパー関数
  const getActiveNavCategory = () => {
    const activeLink = document.querySelector(".category-nav a.active");
    if (activeLink) {
      const category = activeLink.getAttribute("href").replace("#", "");
      return category === "all" ? "" : category; // 'all' は空文字として扱う
    }
    return ""; // アクティブなものがなければ空文字
  };

  // --- フィルタ詳細表示/非表示トグル ---
  let isFilterContentVisible = !filterContent.classList.contains('hidden'); // 初期状態を確認
  const updateFilterToggleState = (isVisible) => {
    const icon = filterToggle.querySelector("i");
    if (isVisible) {
      filterContent.classList.remove("hidden");
      filterContent.style.display = ""; // 表示
      if (icon) icon.classList.replace("fa-chevron-down", "fa-chevron-up");
      filterToggle.setAttribute("aria-expanded", "true");
      filterContent.setAttribute("aria-hidden", "false");
    } else {
      filterContent.classList.add("hidden");
      filterContent.style.display = "none"; // 非表示
      if (icon) icon.classList.replace("fa-chevron-up", "fa-chevron-down");
      filterToggle.setAttribute("aria-expanded", "false");
      filterContent.setAttribute("aria-hidden", "true");
    }
  };
  // 初期状態を反映
  updateFilterToggleState(isFilterContentVisible);
  // トグルボタンのクリックイベント
  filterToggle.addEventListener("click", function () {
    isFilterContentVisible = !isFilterContentVisible;
    updateFilterToggleState(isFilterContentVisible);
  });

  // --- イベントリスナーの設定 ---

  // カテゴリナビゲーションのクリック
  categoryNavLinks.forEach(link => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      // アクティブクラスの切り替え
      categoryNavLinks.forEach(l => l.classList.remove("active"));
      this.classList.add("active");

      const clickedCategory = this.getAttribute("href").replace("#", "");
      let categoryToFilter = clickedCategory === "all" ? "" : clickedCategory;
      // お気に入りカテゴリの場合は特別扱い
      if (clickedCategory === "favorite") {
        categoryToFilter = "favorite";
      }

      // カテゴリフィルタのセレクトボックスも同期（任意）
      categoryFilter.value = categoryToFilter;

      // 現在の他のフィルタ（検索、プラットフォーム、ソート）と組み合わせてフィルタリング実行
      const currentUiState = getCurrentUiFilters();
      filterAndDisplayTools({
        ...currentUiState, // 他のフィルタはUIの状態を維持
        category: categoryToFilter, // カテゴリはクリックされたものを使用
      });
      // セクションタイトル更新
      updateSectionTitle(categoryToFilter);
    });
  });

  // 検索バーの入力
  toolSearch.addEventListener("input", function () {
    // 入力ごとにリアルタイムでフィルタリング（カテゴリはナビゲーションを優先）
    const currentUiState = getCurrentUiFilters();
    filterAndDisplayTools({
      ...currentUiState, // プラットフォーム、ソートはUIの状態を維持
      search: this.value.trim().toLowerCase(), // 検索語は入力値
      category: getActiveNavCategory(), // カテゴリはナビゲーションの状態
    });
  });

  // フィルタ適用ボタンのクリック
  applyFilterBtn.addEventListener("click", function () {
    // UIの全てのフィルタオプションを適用
    const filtersFromUi = getCurrentUiFilters();

    // カテゴリについては、もしUIでカテゴリが選択されていたらそれを優先、
    // されていなければナビゲーションの状態を使う（または常にUIを優先するなど、仕様による）
    // ここではUIを優先する例:
    const categoryToUse = filtersFromUi.category;

    filterAndDisplayTools(filtersFromUi); // UIの状態をそのまま渡す

    // カテゴリナビゲーションのアクティブ状態をUIの選択に合わせる
    categoryNavLinks.forEach(l => l.classList.remove("active"));
    const targetNavLink = document.querySelector(`.category-nav a[href="#${categoryToUse || 'all'}"]`);
    if (targetNavLink) targetNavLink.classList.add("active");

    // セクションタイトル更新
    updateSectionTitle(categoryToUse);
  });

  // リセットボタンのクリック
  resetFilterBtn.addEventListener("click", function () {
    // UIをリセット
    toolSearch.value = "";
    categoryFilter.value = ""; // 「すべて」に対応する値
    platformFilter.value = ""; // 「すべて」に対応する値
    sortFilter.value = "latest"; // デフォルトのソート順

    // カテゴリナビゲーションを「すべて」に
    categoryNavLinks.forEach(l => l.classList.remove("active"));
    const allLink = document.querySelector(".category-nav a[href='#all']");
    if (allLink) allLink.classList.add("active");

    // リセット後の状態でフィルタリング実行
    filterAndDisplayTools({
      search: "",
      category: "",
      platform: "",
      sort: "latest",
    });
    // セクションタイトルを「すべてのツール」に戻す
    updateSectionTitle("");
  });

  // --- 初期表示 ---
  // ページ読み込み時にデフォルトのフィルタ（最新順、全カテゴリ）で表示
  const initialCategory = getActiveNavCategory(); // 初期アクティブなカテゴリがあればそれを使う
  filterAndDisplayTools({
    search: "",
    category: initialCategory,
    platform: "",
    sort: "latest", // デフォルトは最新順
  });
  // 初期セクションタイトル設定
  updateSectionTitle(initialCategory);

}

/**
 * 指定されたフィルタに基づいてツールをフィルタリングし、表示する
 */
function filterAndDisplayTools(filters = {}) {
  const toolGrid = document.querySelector(".tool-grid");
  const paginationContainer = document.querySelector(".pagination");

  if (!toolGrid || !paginationContainer) {
    console.error("Tool grid or pagination container not found. Cannot display tools.");
    return;
  }

  const allTools = window.toolsRepository.getAllTools();
  if (!allTools || allTools.length === 0) {
    // tools.json 読み込み失敗時のメッセージは getToolJson 内で表示済みのはず
    // ここでは、データはあるがフィルタ結果が0件の場合などのメッセージ
    // ただし、allTools自体が空なら読み込み失敗の可能性が高い
    if (Object.keys(toolsData).length > 0) { // toolsData自体はある場合
      toolGrid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1; padding: 2em;">利用可能なツールはありません。</p>';
    }
    paginationContainer.innerHTML = ""; // ページネーションもクリア
    currentFilteredTools = []; // フィルタ結果も空にする
    return;
  }

  // デフォルトフィルタと渡されたフィルタをマージ
  const defaultFilters = { search: "", category: "", platform: "", sort: "latest" };
  const effectiveFilters = { ...defaultFilters, ...filters };

  // フィルタリング実行
  currentFilteredTools = allTools.filter(tool => {
    if (!tool) return false; // 無効なツールデータは除外

    // お気に入りカテゴリの場合
    if (effectiveFilters.category === 'favorite') {
      return isFavorite(tool.id);
    }

    // 検索フィルタ (タイトル or 説明に部分一致)
    const searchLower = effectiveFilters.search;
    const titleMatch = !searchLower || (tool.title && tool.title.toLowerCase().includes(searchLower));
    const descMatch = !searchLower || (tool.description && tool.description.toLowerCase().includes(searchLower));
    const searchMatch = titleMatch || descMatch;

    // カテゴリフィルタ (完全一致)
    const filterCategoryValue = effectiveFilters.category.trim().toLowerCase(); // HTMLのvalue (例: "development")
    const categoryMatch = !filterCategoryValue ||
      (tool.categoryType && tool.categoryType.trim().toLowerCase() === filterCategoryValue);

    // プラットフォームフィルタ
    let platformMatch = !effectiveFilters.platform; // プラットフォーム指定なしなら常に true
    if (effectiveFilters.platform) {
      const filterPlatformLower = effectiveFilters.platform.toLowerCase();
      // 1. `platform` フィールド (カンマ区切り) に含まれるか
      const toolPlatforms = tool.platform ? tool.platform.split(',').map(p => p.trim().toLowerCase()) : [];
      const platformFieldMatch = toolPlatforms.includes(filterPlatformLower);
      // 2. `downloadUrl_プラットフォーム名` が存在するか
      const platformUrlKey = `downloadUrl_${filterPlatformLower}`;
      const platformUrlMatch = !!tool[platformUrlKey]; // キーが存在し、値がtruthyか
      // 3. Webベースの場合の特殊処理（platform: 'web' でフィルタ）
      const isWebBased = tool.platform && tool.platform.toLowerCase().split(',').map(p => p.trim()).includes('web');
      const webMatch = filterPlatformLower === 'web' && isWebBased;


      // 上記のいずれかが一致すればOK
      platformMatch = platformFieldMatch || platformUrlMatch || webMatch;
    }

    return searchMatch && categoryMatch && platformMatch;
  });

  // ソート実行
  currentFilteredTools.sort((a, b) => {
    if (!a || !b) return 0;

    switch (effectiveFilters.sort) {
      case "latest":
        // updatedの日付で降順ソート (新しいものが先頭)
        const dateA = a.updated ? new Date(a.updated) : null;
        const dateB = b.updated ? new Date(b.updated) : null;
        // 無効な日付は最後に配置する
        const timeA = dateA && !isNaN(dateA.getTime()) ? dateA.getTime() : 0;
        const timeB = dateB && !isNaN(dateB.getTime()) ? dateB.getTime() : 0;
        if (timeA === 0 && timeB === 0) return 0; // 両方無効なら順序維持
        if (timeA === 0) return 1;  // Aが無効ならBより後
        if (timeB === 0) return -1; // Bが無効ならAより後
        return timeB - timeA; // 通常は新しい方(timeが大きい方)が前

      case "name":
        // タイトルで昇順ソート (日本語対応)
        const titleA = a.title || "";
        const titleB = b.title || "";
        return titleA.localeCompare(titleB, 'ja', { sensitivity: 'base' });

      case "popular":
        // popularity フィールドで降順ソート (人気が高いものが先頭)
        // popularity がない場合は 0 として扱う
        const popA = a.popularity || 0;
        const popB = b.popularity || 0;
        return popB - popA;

      default:
        return 0; // 未知のソート順なら順序維持
    }
  });

  // ページネーションをリセットして1ページ目を表示
  currentPage = 1;
  renderToolGridPage(currentPage);
  renderPagination(); // ページネーションUIを再描画
}

/**
 * 指定されたページのツールをグリッドにレンダリングする
 */
function renderToolGridPage(pageNumber) {
  const toolGrid = document.querySelector(".tool-grid");
  if (!toolGrid) return;

  toolGrid.innerHTML = ""; // グリッドをクリア
  currentPage = pageNumber;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTools = currentFilteredTools.slice(startIndex, endIndex);

  // フィルタ結果が0件の場合のメッセージ
  if (currentFilteredTools.length === 0) {
    toolGrid.innerHTML = `
            <div class="no-results" style="text-align: center; padding: 3em 1em; grid-column: 1 / -1; color: var(--text-color-secondary);">
                <i class="fas fa-ghost fa-3x" style="margin-bottom: 0.5em; opacity: 0.7;"></i>
                <h3>一致するツールが見つかりませんでした</h3>
                <p>検索条件やフィルタを変更して、もう一度お試しください。</p>
            </div>
        `;
    return; // これ以上処理しない
  }

  // 指定ページが存在しない場合（フィルタ変更などでページ数が減った場合など）は1ページ目を表示
  if (paginatedTools.length === 0 && currentPage > 1) {
    console.warn(`Requested page ${currentPage}, but it's empty. Showing page 1 instead.`);
    renderToolGridPage(1); // 1ページ目を再帰的に呼び出す
    return;
  }

  // ツールカードを生成して追加
  const fragment = document.createDocumentFragment();
  paginatedTools.forEach(tool => {
    if (!tool) return; // 無効なデータはスキップ

    const toolCard = document.createElement("article");
    toolCard.className = "tool-card";
    toolCard.setAttribute("data-id", tool.id); // 詳細表示やプラットフォーム選択で使用

    // プラットフォーム別ダウンロードURLがあるかチェック
    const platformUrls = Object.entries(tool)
      .filter(([key, value]) => key.startsWith("downloadUrl_") && value)
      .map(([key, url]) => ({ platform: key.substring("downloadUrl_".length), url: url }));

    let primaryDownloadUrl = tool.downloadUrl || "#"; // 直接URL or ダミー
    let requiresPlatformSelection = !tool.downloadUrl && platformUrls.length > 0;
    let isDownloadDisabled = !tool.downloadUrl && platformUrls.length === 0;

    // ドキュメントボタンHTML
    const docsButtonHtml = tool.docsUrl
      ? `<a href="${tool.docsUrl}" class="btn btn-outline" target="_blank" rel="noopener noreferrer" data-action="docs"><i class="fas fa-book"></i> 詳細</a>`
      : "";

    // カードのHTML構造（画像が見つからない場合は404.pngを表示）
    toolCard.innerHTML = `
            <div class="tool-image">
                ${tool.category ? `<span class="tool-category">${tool.category}</span>` : ''}
                <img src="${tool.image || '../libs/Assets/images/placeholder.png'}" alt="${tool.title || 'ツール画像'}" loading="lazy" onerror="this.onerror=null;this.src='./module/404.png';">
            </div>
            <div class="tool-content">
                <h3 class="tool-title">${tool.title || '無題のツール'}</h3>
                <div class="tool-meta">
                    ${tool.version ? `<div><i class="fas fa-code-branch"></i> <span>${tool.version}</span></div>` : ''}
                    ${tool.updated ? `<div><i class="fas fa-calendar-alt"></i> <span>${tool.updated}</span></div>` : ''}
                </div>
                <p class="tool-description">${tool.description || '説明はありません。'}</p>
                <div class="tool-actions">
                    <a href="${primaryDownloadUrl}"
                       class="btn btn-primary download-btn ${isDownloadDisabled ? 'disabled' : ''}"
                       ${requiresPlatformSelection ? 'data-requires-platform-selection="true"' : ''}
                       ${isDownloadDisabled ? 'aria-disabled="true"' : ''}
                       ${tool.downloadUrl && !isDownloadDisabled ? 'target="_blank" rel="noopener noreferrer"' : ''}
                       data-action="download">
                        <i class="fas fa-download"></i> ダウンロード
                    </a>
                    ${docsButtonHtml}
                </div>
            </div>
        `;

    // カード内のダウンロードボタンにイベントリスナーを追加（プラットフォーム選択が必要な場合）
    const downloadBtn = toolCard.querySelector(".download-btn[data-requires-platform-selection='true']");
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function (e) {
        e.preventDefault(); // デフォルトのリンク遷移を阻止
        e.stopPropagation(); // カード全体のクリックイベント（モーダル表示）が発火しないように
        const cardElement = e.target.closest('.tool-card');
        const toolId = cardElement.getAttribute('data-id');
        const toolDataForPlatform = window.toolsRepository.getToolDetails(toolId);
        if (toolDataForPlatform) {
          showPlatformSelectionModal(toolDataForPlatform);
        } else {
          console.error("Could not find tool data for platform selection from card click.");
          alert("プラットフォーム選択に必要な情報を読み込めませんでした。");
        }
      });
    }

    // 無効化されたダウンロードボタンのクリックを無効化
    const disabledDownloadBtn = toolCard.querySelector(".download-btn.disabled");
    if (disabledDownloadBtn) {
      disabledDownloadBtn.addEventListener('click', e => e.preventDefault());
    }

    // ドキュメントボタンのクリックイベント伝播を停止（カード全体のクリックを抑制）
    const docsBtn = toolCard.querySelector(".btn-outline[data-action='docs']");
    if (docsBtn) {
      docsBtn.addEventListener('click', e => e.stopPropagation());
    }
    // 直接ダウンロードボタンも同様に伝播停止
    const directDownloadBtn = toolCard.querySelector(".download-btn:not([data-requires-platform-selection='true']):not(.disabled)");
    if (directDownloadBtn) {
      directDownloadBtn.addEventListener('click', e => e.stopPropagation());
    }


    fragment.appendChild(toolCard);
  });
  toolGrid.appendChild(fragment);
}

/**
 * ページネーションのUIを描画する
 */
function renderPagination() {
  const paginationContainer = document.querySelector(".pagination");
  if (!paginationContainer) {
    console.warn("Pagination container element (.pagination) not found.");
    return;
  }
  paginationContainer.innerHTML = ""; // クリア

  const totalItems = currentFilteredTools.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // 1ページしかない場合はページネーション不要
  if (totalPages <= 1) {
    return;
  }

  // ページリンク生成ヘルパー
  const createPageLink = (page, text, isActive, isDisabled, isControl = false, ariaLabel = "") => {
    const element = (isActive || isDisabled) ? "span" : "a"; // アクティブ or 無効なら span, それ以外は a
    const link = document.createElement(element);
    link.innerHTML = text; // アイコンも含める

    if (element === "a") {
      link.href = "#"; // ダミーリンク
      link.addEventListener("click", (e) => {
        e.preventDefault();
        let targetPage;
        if (typeof page === 'string') { // "prev" or "next"
          targetPage = (page === 'prev') ? currentPage - 1 : currentPage + 1;
        } else { // 数字
          targetPage = page;
        }

        // 有効なページ番号の場合のみ処理
        if (targetPage >= 1 && targetPage <= totalPages && targetPage !== currentPage) {
          renderToolGridPage(targetPage); // ページ内容更新
          renderPagination(); // ページネーション自体も更新
          // ページ上部にスクロール（任意）
          const toolGrid = document.querySelector(".tool-grid");
          if (toolGrid) {
            // toolGrid.scrollIntoView({ behavior: "smooth", block: "start" });
            window.scrollTo({ top: toolGrid.offsetTop - 80, behavior: 'smooth' }); // ヘッダー高さを考慮
          }
        }
      });
    }

    // クラス設定
    if (isControl) link.classList.add(page === 'prev' ? 'prev' : 'next');
    if (isActive) link.classList.add('active');
    if (isDisabled) link.classList.add('disabled'); // CSSで見た目を調整

    // アクセシビリティ属性
    link.setAttribute('aria-label', ariaLabel || (isControl ? text.replace(/<[^>]*>/g, '').trim() : `ページ ${page}`));
    if (isDisabled) link.setAttribute('aria-disabled', 'true');
    if (isActive) link.setAttribute('aria-current', 'page');

    return link;
  };

  // 「前へ」ボタン
  paginationContainer.appendChild(
    createPageLink('prev', '<i class="fas fa-chevron-left"></i> 前へ', false, currentPage === 1, true, '前のページ')
  );

  // ページ番号リンク
  const maxVisiblePages = 5; // 表示する最大ページ番号数（奇数が望ましい）
  const pageBuffer = Math.floor((maxVisiblePages - 1) / 2); // 現在ページの前後に表示する数

  let startPage = Math.max(1, currentPage - pageBuffer);
  let endPage = Math.min(totalPages, currentPage + pageBuffer);

  // 表示範囲の調整（端に寄っている場合）
  if (currentPage - pageBuffer <= 1) { // 左端に寄っている場合
    endPage = Math.min(totalPages, maxVisiblePages);
  }
  if (currentPage + pageBuffer >= totalPages) { // 右端に寄っている場合
    startPage = Math.max(1, totalPages - maxVisiblePages + 1);
  }

  // 省略記号 (...) の表示 (最初)
  if (startPage > 1) {
    paginationContainer.appendChild(createPageLink(1, '1', false, false, false, '最初のページ'));
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.classList.add('ellipsis');
      paginationContainer.appendChild(ellipsis);
    }
  }

  // 中心のページ番号
  for (let i = startPage; i <= endPage; i++) {
    paginationContainer.appendChild(
      createPageLink(i, i.toString(), i === currentPage, false)
    );
  }

  // 省略記号 (...) の表示 (最後)
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.classList.add('ellipsis');
      paginationContainer.appendChild(ellipsis);
    }
    paginationContainer.appendChild(createPageLink(totalPages, totalPages.toString(), false, false, false, '最後のページ'));
  }

  // 「次へ」ボタン
  paginationContainer.appendChild(
    createPageLink('next', '次へ <i class="fas fa-chevron-right"></i>', false, currentPage === totalPages, true, '次のページ')
  );
}


// --- セクションタイトル更新関数 ---
function updateSectionTitle(category) {
    const sectionTitle = document.querySelector('.section-title');
    if (!sectionTitle) return;
    // カテゴリnavから該当カテゴリのa要素を取得
    let navLink = null;
    if (category) {
        navLink = document.querySelector(`.category-nav a[href="#${category}"]`);
    }
    if (!navLink) {
        navLink = document.querySelector('.category-nav a[href="#all"]');
    }
    if (navLink) {
        // アイコンとラベルを抽出
        const iconHtml = navLink.querySelector('i') ? navLink.querySelector('i').outerHTML : '';
        // テキストノードのみ抽出（アイコン以外）
        let label = '';
        navLink.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                label += node.textContent.trim();
            }
        });
        sectionTitle.innerHTML = `${iconHtml}${label ? label : 'Loading...'}`;
    } else {
        sectionTitle.innerHTML = '<i class="fas fa-tools"></i>Loading...';
    }
}


// --- DOMContentLoaded イベントリスナー ---
document.addEventListener("DOMContentLoaded", async function () {

  // --- テーマ切り替え機能 (旧 tool.js) ---
  const themeToggle = document.getElementById("theme-toggle");
  const body = document.body;
  if (themeToggle && body) {
    // テーマ切り替えボタンのクリックイベント
    themeToggle.addEventListener("click", function () {
      const currentTheme = body.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      body.setAttribute("data-theme", newTheme);

      // アイコンの切り替え
      const icon = themeToggle.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-sun", newTheme === "light");
        icon.classList.toggle("fa-moon", newTheme === "dark");
      }
      // 設定をローカルストレージに保存
      localStorage.setItem("theme", newTheme);
    });

    // 初期テーマの設定（ローカルストレージ or OS設定）
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
    body.setAttribute("data-theme", initialTheme);

    // 初期アイコンの設定
    const initialIcon = themeToggle.querySelector("i");
    if (initialIcon) {
      initialIcon.classList.toggle("fa-sun", initialTheme === "light");
      initialIcon.classList.toggle("fa-moon", initialTheme === "dark");
    }
  }

  // --- スクロールトップボタン機能 (旧 tool.js) ---
  const scrollTopBtn = document.getElementById("scroll-top");
  if (scrollTopBtn) {
    // スクロールイベントで表示/非表示を切り替え
    window.addEventListener("scroll", function () {
      if (window.pageYOffset > 300) { // 300pxスクロールしたら表示
        scrollTopBtn.classList.add("visible");
      } else {
        scrollTopBtn.classList.remove("visible");
      }
    });
    // クリックでトップへスクロール
    scrollTopBtn.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: "smooth", // スムーズスクロール
      });
    });
  }

  // --- ツールデータの読み込みと初期化 (旧 tool-details.js) ---
  try {
    const data = await getToolJson(); // JSONデータを非同期で取得
    // 取得したデータをグローバル変数に格納
    toolsData = data;

    // JSON読み込み成功後、各種初期化処理を実行
    if (Object.keys(toolsData).length > 0) {
      ensurePlatformModalExists();      // プラットフォーム選択モーダル準備
      initializeToolModals();           // 詳細モーダルのイベント設定
      initializeFiltersAndPagination(); // フィルタ、ソート、ページネーション、初期表示
    } else {
      // getToolJson内ですでにエラーメッセージ表示済みのはずだが、念のため
      console.warn("Tool data is empty after fetch, skipping further initialization.");
      // ここで追加のエラー処理やメッセージ表示を行ってもよい
    }

  } catch (error) {
    // getToolJson 内で catch されなかった予期せぬエラーなど
    console.error("Error during initialization process:", error);
    const toolGrid = document.querySelector(".tool-grid");
    if (toolGrid && !toolGrid.innerHTML.includes('失敗')) { // エラーメッセージが重複しないように
      toolGrid.innerHTML = '<p style="color: red; text-align: center; grid-column: 1 / -1; padding: 2em;">ページの初期化中に予期せぬエラーが発生しました。</p>';
    }
    const paginationContainer = document.querySelector(".pagination");
    if (paginationContainer) paginationContainer.innerHTML = "";
  }
});