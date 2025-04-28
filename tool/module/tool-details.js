let toolsData = {};
let currentFilteredTools = [];
let currentPage = 1;
const itemsPerPage = 8;

async function getToolJson() {
  try {
    const response = await fetch("./module/tools.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid JSON data format received.");
    }
    return data;
  } catch (err) {
    console.error("tools.json の読み込みまたは解析に失敗しました:", err);
    const toolGrid = document.querySelector(".tool-grid");
    if (toolGrid) {
      toolGrid.innerHTML =
        '<p style="color: red; text-align: center; grid-column: 1 / -1; padding: 2em;">ツールの読み込みに失敗しました。データ形式を確認するか、ページを再読み込みしてください。</p>';
    }
    const paginationContainer = document.querySelector(".pagination");
    if (paginationContainer) paginationContainer.innerHTML = "";
    return {};
  }
}

function getToolDetails(id) {
  return toolsData[id] || null;
}

window.toolsRepository = {
  getToolDetails: getToolDetails,
  getAllTools: function () {
    if (Object.keys(toolsData).length === 0) {
      console.warn(
        "getAllTools called before toolsData was populated or fetch failed."
      );
      return [];
    }

    return Object.keys(toolsData).map((key) => ({
      id: key,
      ...toolsData[key],
    }));
  },
};

let platformModal = null;
let currentToolDataForMainModal = null;

function ensurePlatformModalExists() {
  if (platformModal) return;

  platformModal = document.createElement("div");
  platformModal.id = "platform-modal";
  platformModal.classList.add("modal");

  platformModal.style.display = "none";
  platformModal.style.position = "fixed";
  platformModal.style.left = "0";
  platformModal.style.top = "0";
  platformModal.style.width = "100%";
  platformModal.style.height = "100%";
  platformModal.style.backgroundColor = "rgba(0,0,0,0.6)";
  platformModal.style.zIndex = "1050";
  platformModal.style.display = "flex";
  platformModal.style.alignItems = "center";
  platformModal.style.justifyContent = "center";
  platformModal.style.visibility = "hidden";
  platformModal.style.opacity = "0";
  platformModal.style.transition =
    "visibility 0s linear 0.2s, opacity 0.2s linear";

  const modalContent = document.createElement("div");
  modalContent.classList.add("modal-container");
  modalContent.style.background = "var(--background-color, #fff)";
  modalContent.style.color = "var(--text-color, #333)";
  modalContent.style.maxWidth = "400px";
  modalContent.style.width = "90%";
  modalContent.style.padding = "2em";
  modalContent.style.borderRadius = "8px";
  modalContent.style.position = "relative";
  modalContent.style.boxShadow = "0 5px 15px rgba(0,0,0,0.2)";
  modalContent.style.textAlign = "center";

  modalContent.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 1.5em;">プラットフォームを選択</h3>
        <div id="platform-btns" style="width: 100%; display: grid; gap: 0.75em;">
            <!-- Platform buttons will be added here -->
        </div>
        <button id="platform-modal-close" class="btn btn-secondary" style="margin-top: 1.5em; cursor: pointer;">閉じる</button>
    `;
  platformModal.appendChild(modalContent);
  document.body.appendChild(platformModal);

  const closeButton = platformModal.querySelector("#platform-modal-close");
  closeButton.onclick = hidePlatformModal;

  platformModal.addEventListener("click", (e) => {
    if (e.target === platformModal) {
      hidePlatformModal();
    }
  });
}

function hidePlatformModal() {
  if (platformModal) {
    platformModal.style.visibility = "hidden";
    platformModal.style.opacity = "0";
    platformModal.style.transition =
      "visibility 0s linear 0.2s, opacity 0.2s linear";

    const btnsDiv = platformModal.querySelector("#platform-btns");
    if (btnsDiv) btnsDiv.innerHTML = "";
  }
}

function showPlatformSelectionModal(toolData) {
  ensurePlatformModalExists();

  if (!toolData) {
    console.error("showPlatformSelectionModal: toolData is missing.");
    return;
  }

  const platformUrls = Object.entries(toolData)
    .filter(([key, val]) => key.startsWith("downloadUrl_") && val)
    .map(([key, val]) => {
      const platform = key.replace("downloadUrl_", "");

      let platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
      if (platform.toLowerCase() === "macos") platformLabel = "macOS";
      if (platform.toLowerCase() === "linux") platformLabel = "Linux";
      if (platform.toLowerCase() === "windows") platformLabel = "Windows";

      return { platform: platformLabel, url: val };
    });

  if (platformUrls.length === 0) {
    console.warn(
      `No platform-specific download URLs found for tool: ${toolData.title}`
    );

    alert(
      `「${toolData.title}」には、選択可能なプラットフォーム別ダウンロードリンクがありません。`
    );
    return;
  }

  const btnsDiv = platformModal.querySelector("#platform-btns");
  const modalTitleEl = platformModal.querySelector("h3");

  if (!btnsDiv || !modalTitleEl) {
    console.error("Platform modal elements (#platform-btns or h3) not found!");
    return;
  }

  modalTitleEl.textContent = `「${toolData.title}」のプラットフォームを選択`;
  btnsDiv.innerHTML = "";

  platformUrls.forEach(({ platform, url }) => {
    const btn = document.createElement("a");
    btn.href = url;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.textContent = `${platform} 版ダウンロード`;
    btn.classList.add("btn", "btn-primary");
    btn.style.display = "block";
    btn.style.marginBottom = "0.5em";
    btn.style.textDecoration = "none";

    btn.onclick = () => {};
    btnsDiv.appendChild(btn);
  });

  platformModal.style.visibility = "visible";
  platformModal.style.opacity = "1";
  platformModal.style.transition =
    "visibility 0s linear 0s, opacity 0.2s linear";
}

document.addEventListener("DOMContentLoaded", async function () {
  const data = await getToolJson();

  if (
    Object.keys(data).length === 0 &&
    !document.querySelector('.tool-grid p[style*="color: red"]')
  ) {
    console.error(
      "Tool data is empty after fetching. Aborting initialization."
    );

    const toolGrid = document.querySelector(".tool-grid");
    if (toolGrid && !toolGrid.innerHTML.includes("失敗")) {
      toolGrid.innerHTML =
        '<p style="color: orange; text-align: center; grid-column: 1 / -1; padding: 2em;">ツールデータが見つかりませんでした。</p>';
    }
    const paginationContainer = document.querySelector(".pagination");
    if (paginationContainer) paginationContainer.innerHTML = "";
    return;
  }
  toolsData = data;

  ensurePlatformModalExists();
  initializeToolModals();
  initializeFiltersAndPagination();
});

function initializeToolModals() {
  const toolGrid = document.querySelector(".tool-grid");
  const modal = document.getElementById("tool-detail-modal");
  const modalClose = document.getElementById("modal-close");

  const modalTitle = document.getElementById("modal-title");
  const modalImage = document.getElementById("modal-image");
  const modalDescription = document.getElementById("modal-description");
  const modalCategory = document.getElementById("modal-category");
  const modalVersion = document.getElementById("modal-version");
  const modalUpdated = document.getElementById("modal-updated");
  const modalDownloadBtn = document.getElementById("modal-download");
  const modalDocBtn = document.getElementById("modal-docs");

  if (toolGrid && modal && modalTitle) {
    toolGrid.addEventListener("click", function (e) {
      const card = e.target.closest(".tool-card");
      const downloadButton = e.target.closest(".download-btn");
      const docsButton = e.target.closest(".btn-outline");

      if (downloadButton || docsButton) {
        return;
      }

      if (card) {
        const toolId = card.getAttribute("data-id");
        const toolData = window.toolsRepository.getToolDetails(toolId);
        currentToolDataForMainModal = toolData;

        if (toolData) {
          modalTitle.textContent = toolData.title || "ツール詳細";
          modalImage.src =
            toolData.imageLarge ||
            toolData.image ||
            "../lib/Assets/images/placeholder.png";
          modalImage.alt = toolData.title || "ツール画像";
          modalDescription.innerHTML =
            toolData.detailedDescription ||
            toolData.description ||
            "<p>詳細情報はありません。</p>";

          const setText = (el, value, fallback = "N/A") => {
            if (el) el.textContent = value || fallback;
          };
          setText(modalCategory, toolData.category);
          setText(modalVersion, toolData.version);
          setText(modalUpdated, toolData.updated);

          const hasPlatformUrls = Object.keys(toolData).some(
            (key) => key.startsWith("downloadUrl_") && toolData[key]
          );

          modalDownloadBtn.href = "#";
          modalDownloadBtn.style.display = "none";
          modalDownloadBtn.removeAttribute("data-requires-platform-selection");
          modalDownloadBtn.classList.remove("disabled");
          modalDownloadBtn.onclick = null;

          if (toolData.downloadUrl) {
            modalDownloadBtn.href = toolData.downloadUrl;
            modalDownloadBtn.style.display = "inline-flex";
            modalDownloadBtn.target = "_blank";
            modalDownloadBtn.rel = "noopener noreferrer";
          } else if (hasPlatformUrls) {
            modalDownloadBtn.style.display = "inline-flex";
            modalDownloadBtn.setAttribute(
              "data-requires-platform-selection",
              "true"
            );

            modalDownloadBtn.onclick = function (event) {
              event.preventDefault();
              if (currentToolDataForMainModal) {
                showPlatformSelectionModal(currentToolDataForMainModal);
              } else {
                console.error(
                  "Platform selection needed, but tool data is missing for the main modal."
                );
                alert(
                  "エラーが発生しました。プラットフォームを選択できません。"
                );
              }
            };
          } else {
            modalDownloadBtn.style.display = "none";
            modalDownloadBtn.classList.add("disabled");
            modalDownloadBtn.ariaDisabled = "true";
          }

          if (toolData.docsUrl) {
            modalDocBtn.href = toolData.docsUrl;
            modalDocBtn.style.display = "inline-flex";
            modalDocBtn.target = "_blank";
            modalDocBtn.rel = "noopener noreferrer";
          } else {
            modalDocBtn.style.display = "none";
          }

          modal.classList.add("show");
          document.body.style.overflow = "hidden";
        } else {
          console.error(`Tool data not found for ID: ${toolId}`);
          alert("ツールの詳細情報を読み込めませんでした。");
          currentToolDataForMainModal = null;
        }
      }
    });
  } else {
    console.warn(
      "Tool grid, main modal, or modal title element not found. Main modal functionality may be limited or disabled."
    );
  }

  const closeMainModal = () => {
    if (modal) {
      modal.classList.remove("show");
      document.body.style.overflow = "";
      currentToolDataForMainModal = null;
    }
  };

  if (modalClose) {
    modalClose.addEventListener("click", closeMainModal);
  }

  window.addEventListener("click", function (e) {
    if (
      platformModal &&
      (platformModal.style.visibility === "visible" ||
        platformModal.style.display === "flex")
    ) {
      return;
    }

    if (e.target === modal) {
      closeMainModal();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (
        platformModal &&
        (platformModal.style.visibility === "visible" ||
          platformModal.style.display === "flex")
      ) {
        hidePlatformModal();
      } else if (modal && modal.classList.contains("show")) {
        closeMainModal();
      }
    }
  });
}

function initializeFiltersAndPagination() {
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

  const getCurrentUiFilters = () => ({
    search: toolSearch ? toolSearch.value.trim().toLowerCase() : "",

    category: categoryFilter ? categoryFilter.value : "",
    platform: platformFilter ? platformFilter.value : "",
    sort: sortFilter ? sortFilter.value : "latest",
  });

  const getActiveNavCategory = () => {
    const activeLink = document.querySelector(".category-nav a.active");
    if (activeLink) {
      const category = activeLink.getAttribute("href").replace("#", "");
      return category === "all" ? "" : category;
    }
    return "";
  };

  if (categoryNavLinks.length > 0) {
    const allLink = Array.from(categoryNavLinks).find(
      (link) => link.getAttribute("href") === "#all"
    );
    if (allLink && !document.querySelector(".category-nav a.active")) {
      categoryNavLinks.forEach((link) => link.classList.remove("active"));
      allLink.classList.add("active");
    }

    filterAndDisplayTools({ sort: "latest", category: getActiveNavCategory() });
  } else {
    filterAndDisplayTools({ sort: "latest" });
  }

  if (filterToggle && filterContent) {
    let isFilterContentVisible = !filterContent.classList.contains("hidden");

    const updateFilterToggleState = (isVisible) => {
      const icon = filterToggle.querySelector("i");
      if (isVisible) {
        filterContent.classList.remove("hidden");
        filterContent.style.display = "";
        if (icon) icon.classList.replace("fa-chevron-down", "fa-chevron-up");
        filterToggle.setAttribute("aria-expanded", "true");
        filterContent.setAttribute("aria-hidden", "false");
      } else {
        filterContent.classList.add("hidden");
        filterContent.style.display = "none";
        if (icon) icon.classList.replace("fa-chevron-up", "fa-chevron-down");
        filterToggle.setAttribute("aria-expanded", "false");
        filterContent.setAttribute("aria-hidden", "true");
      }
    };

    updateFilterToggleState(isFilterContentVisible);

    filterToggle.addEventListener("click", function () {
      isFilterContentVisible = !isFilterContentVisible;
      updateFilterToggleState(isFilterContentVisible);
    });
  }

  categoryNavLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      categoryNavLinks.forEach((l) => l.classList.remove("active"));
      this.classList.add("active");

      const clickedCategory = this.getAttribute("href").replace("#", "");
      const categoryToFilter = clickedCategory === "all" ? "" : clickedCategory;

      const currentUiState = getCurrentUiFilters();
      filterAndDisplayTools({
        ...currentUiState,
        category: categoryToFilter,
      });

      if (categoryFilter) categoryFilter.value = categoryToFilter;
    });
  });

  if (toolSearch) {
    toolSearch.addEventListener("input", function () {
      const currentUiState = getCurrentUiFilters();
      filterAndDisplayTools({
        ...currentUiState,
        search: this.value.trim().toLowerCase(),

        category: getActiveNavCategory(),
      });
    });
  }

  if (applyFilterBtn) {
    applyFilterBtn.addEventListener("click", function () {
      const filtersFromUi = getCurrentUiFilters();

      const categoryToUse = filtersFromUi.category || getActiveNavCategory();

      filterAndDisplayTools({
        ...filtersFromUi,
        category: categoryToUse,
      });

      categoryNavLinks.forEach((l) => l.classList.remove("active"));

      const targetNavLink = document.querySelector(
        `.category-nav a[href="#${categoryToUse || "all"}"]`
      );
      if (targetNavLink) targetNavLink.classList.add("active");
    });
  }

  if (resetFilterBtn) {
    resetFilterBtn.addEventListener("click", function () {
      if (toolSearch) toolSearch.value = "";
      if (categoryFilter) categoryFilter.value = "";
      if (platformFilter) platformFilter.value = "";
      if (sortFilter) sortFilter.value = "latest";

      categoryNavLinks.forEach((l) => l.classList.remove("active"));
      const allLink = Array.from(categoryNavLinks).find(
        (link) => link.getAttribute("href") === "#all"
      );
      if (allLink) allLink.classList.add("active");

      filterAndDisplayTools({
        search: "",
        category: "",
        platform: "",
        sort: "latest",
      });
    });
  }

  function filterAndDisplayTools(filters = {}) {
    if (!toolGrid) {
      console.error(
        "Tool grid element (.tool-grid) not found. Cannot display tools."
      );
      return;
    }

    const allTools = window.toolsRepository.getAllTools();
    if (!allTools || allTools.length === 0) {
      console.warn("No tools available from repository to filter or display.");
      toolGrid.innerHTML =
        '<p style="text-align: center; grid-column: 1 / -1; padding: 2em;">利用可能なツールはありません。</p>';
      if (paginationContainer) paginationContainer.innerHTML = "";
      return;
    }

    const defaultFilters = {
      search: "",
      category: "",
      platform: "",
      sort: "latest",
    };
    const effectiveFilters = { ...defaultFilters, ...filters };

    currentFilteredTools = allTools.filter((tool) => {
      if (!tool) return false;

      const searchLower = effectiveFilters.search;
      const titleMatch =
        !searchLower ||
        (tool.title && tool.title.toLowerCase().includes(searchLower));
      const descMatch =
        !searchLower ||
        (tool.description &&
          tool.description.toLowerCase().includes(searchLower));
      const searchMatch = titleMatch || descMatch;

      const categoryMatch =
        !effectiveFilters.category ||
        (tool.category &&
          tool.category.toLowerCase() ===
            effectiveFilters.category.toLowerCase());

      let platformMatch = !effectiveFilters.platform;
      if (effectiveFilters.platform) {
        const toolPlatforms = tool.platform
          ? tool.platform.split(",").map((p) => p.trim().toLowerCase())
          : [];
        const filterPlatformLower = effectiveFilters.platform.toLowerCase();
        const platformFieldMatch = toolPlatforms.includes(filterPlatformLower);

        const platformUrlKey = `downloadUrl_${filterPlatformLower}`;
        const platformUrlMatch = tool[platformUrlKey];

        platformMatch = platformFieldMatch || platformUrlMatch;
      }

      return searchMatch && categoryMatch && platformMatch;
    });

    currentFilteredTools.sort((a, b) => {
      if (!a || !b) return 0;

      switch (effectiveFilters.sort) {
        case "latest":
          const dateA = a.updated ? new Date(a.updated) : null;
          const dateB = b.updated ? new Date(b.updated) : null;

          const timeA = dateA && !isNaN(dateA.getTime()) ? dateA.getTime() : 0;
          const timeB = dateB && !isNaN(dateB.getTime()) ? dateB.getTime() : 0;

          if (timeA === 0 && timeB === 0) return 0;
          if (timeA === 0) return 1;
          if (timeB === 0) return -1;
          return timeB - timeA;

        case "name":
          const titleA = a.title || "";
          const titleB = b.title || "";

          return titleA.localeCompare(titleB, "ja", { sensitivity: "base" });

        case "popular":
          const popA = a.popularity || 0;
          const popB = b.popularity || 0;
          return popB - popA;

        default:
          return 0;
      }
    });

    currentPage = 1;
    renderToolGridPage(currentPage);
    renderPagination();
  }

  function renderToolGridPage(pageNumber) {
    if (!toolGrid) return;
    toolGrid.innerHTML = "";
    currentPage = pageNumber;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    const paginatedTools = currentFilteredTools.slice(startIndex, endIndex);

    if (currentFilteredTools.length === 0) {
      toolGrid.innerHTML = `
                 <div class="no-results" style="text-align: center; padding: 3em 1em; grid-column: 1 / -1; color: var(--text-color-secondary);">
                     <i class="fas fa-ghost fa-3x" style="margin-bottom: 0.5em; opacity: 0.7;"></i>
                     <h3>一致するツールが見つかりませんでした</h3>
                     <p>検索条件やフィルタを変更して、もう一度お試しください。</p>
                 </div>
             `;
      return;
    }

    if (paginatedTools.length === 0 && currentPage > 1) {
      console.warn(
        `Requested page ${currentPage}, but it's empty. Showing page 1 instead.`
      );

      renderToolGridPage(1);
      return;
    }

    const fragment = document.createDocumentFragment();
    paginatedTools.forEach((tool) => {
      if (!tool) return;

      const toolCard = document.createElement("article");
      toolCard.className = "tool-card";
      toolCard.setAttribute("data-id", tool.id);

      const platformUrls = Object.entries(tool)
        .filter(([key, value]) => key.startsWith("downloadUrl_") && value)
        .map(([key, url]) => ({
          platform: key.substring("downloadUrl_".length),
          url,
        }));

      let primaryDownloadUrl = tool.downloadUrl || "#";
      let requiresPlatformSelection =
        !tool.downloadUrl && platformUrls.length > 0;
      let isDownloadDisabled = !tool.downloadUrl && platformUrls.length === 0;

      const docsButtonHtml = tool.docsUrl
        ? `
                <a href="${tool.docsUrl}" class="btn btn-outline" target="_blank" rel="noopener noreferrer">
                    <i class="fas fa-book"></i> 詳細
                </a>`
        : "";

      toolCard.innerHTML = `
                <div class="tool-image">
                    ${
                      tool.category
                        ? `<span class="tool-category">${tool.category}</span>`
                        : ""
                    }
                    <img src="${
                      tool.image || "../lib/Assets/images/placeholder.png"
                    }" alt="${tool.title || "ツール画像"}" loading="lazy">
                </div>
                <div class="tool-content">
                    <h3 class="tool-title">${tool.title || "無題のツール"}</h3>
                    <div class="tool-meta">
                        ${
                          tool.version
                            ? `<div><i class="fas fa-code-branch"></i> <span>${tool.version}</span></div>`
                            : ""
                        }
                        ${
                          tool.updated
                            ? `<div><i class="fas fa-calendar-alt"></i> <span>${tool.updated}</span></div>`
                            : ""
                        }
                    </div>
                    <p class="tool-description">${
                      tool.description || "説明はありません。"
                    }</p>
                    <div class="tool-actions">
                        <a href="${primaryDownloadUrl}"
                           class="btn btn-primary download-btn ${
                             isDownloadDisabled ? "disabled" : ""
                           }"
                           ${
                             requiresPlatformSelection
                               ? 'data-requires-platform-selection="true"'
                               : ""
                           }
                           ${isDownloadDisabled ? 'aria-disabled="true"' : ""}
                           ${
                             tool.downloadUrl && !isDownloadDisabled
                               ? 'target="_blank" rel="noopener noreferrer"'
                               : ""
                           } /* Target blank only for direct downloads */
                           >
                            <i class="fas fa-download"></i> ダウンロード
                        </a>
                        ${docsButtonHtml}
                    </div>
                </div>
            `;

      const downloadBtn = toolCard.querySelector(".download-btn");
      if (downloadBtn) {
        if (requiresPlatformSelection) {
          downloadBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();

            const cardElement = e.target.closest(".tool-card");
            const toolId = cardElement.getAttribute("data-id");
            const toolDataForPlatform =
              window.toolsRepository.getToolDetails(toolId);
            if (toolDataForPlatform) {
              showPlatformSelectionModal(toolDataForPlatform);
            } else {
              console.error(
                "Could not find tool data for platform selection from card click."
              );
              alert("プラットフォーム選択に必要な情報を読み込めませんでした。");
            }
          });
        } else if (isDownloadDisabled) {
          downloadBtn.addEventListener("click", (e) => e.preventDefault());
        } else {
          downloadBtn.addEventListener("click", (e) => e.stopPropagation());
        }
      }

      const docsBtn = toolCard.querySelector(".btn-outline");
      if (docsBtn) {
        docsBtn.addEventListener("click", (e) => e.stopPropagation());
      }

      fragment.appendChild(toolCard);
    });
    toolGrid.appendChild(fragment);
  }

  function renderPagination() {
    if (!paginationContainer) {
      console.warn("Pagination container element (.pagination) not found.");
      return;
    }
    paginationContainer.innerHTML = "";

    const totalItems = currentFilteredTools.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) {
      return;
    }

    const createPageLink = (
      page,
      text,
      isActive,
      isDisabled,
      isControl = false,
      ariaLabel = ""
    ) => {
      const element = isActive || isDisabled ? "span" : "a";
      const link = document.createElement(element);

      link.innerHTML = text;

      if (element === "a") {
        link.href = "#";
        link.addEventListener("click", (e) => {
          e.preventDefault();
          let targetPage;
          if (typeof page === "string") {
            targetPage = page === "prev" ? currentPage - 1 : currentPage + 1;
          } else {
            targetPage = page;
          }

          if (
            targetPage >= 1 &&
            targetPage <= totalPages &&
            targetPage !== currentPage
          ) {
            renderToolGridPage(targetPage);
            renderPagination();

            toolGrid.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }

      if (isControl) link.classList.add(page === "prev" ? "prev" : "next");
      if (isActive) link.classList.add("active");
      if (isDisabled) link.classList.add("disabled");

      link.setAttribute(
        "aria-label",
        ariaLabel ||
          (isControl ? text.replace(/<[^>]*>/g, "").trim() : `ページ ${page}`)
      );
      if (isDisabled) link.setAttribute("aria-disabled", "true");
      if (isActive) link.setAttribute("aria-current", "page");

      return link;
    };

    paginationContainer.appendChild(
      createPageLink(
        "prev",
        '<i class="fas fa-chevron-left"></i> 前へ',
        false,
        currentPage === 1,
        true,
        "前のページ"
      )
    );

    const maxVisiblePages = 5;
    const pageBuffer = Math.floor((maxVisiblePages - 1) / 2);

    let startPage = Math.max(1, currentPage - pageBuffer);
    let endPage = Math.min(totalPages, currentPage + pageBuffer);

    if (currentPage - pageBuffer <= 1) {
      endPage = Math.min(totalPages, maxVisiblePages);
    }
    if (currentPage + pageBuffer >= totalPages) {
      startPage = Math.max(1, totalPages - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      paginationContainer.appendChild(
        createPageLink(1, "1", false, false, false, "最初のページ")
      );
      if (startPage > 2) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        ellipsis.classList.add("ellipsis");
        paginationContainer.appendChild(ellipsis);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      paginationContainer.appendChild(
        createPageLink(i, i.toString(), i === currentPage, false)
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        ellipsis.classList.add("ellipsis");
        paginationContainer.appendChild(ellipsis);
      }
      paginationContainer.appendChild(
        createPageLink(
          totalPages,
          totalPages.toString(),
          false,
          false,
          false,
          "最後のページ"
        )
      );
    }

    paginationContainer.appendChild(
      createPageLink(
        "next",
        '次へ <i class="fas fa-chevron-right"></i>',
        false,
        currentPage === totalPages,
        true,
        "次のページ"
      )
    );
  }
}
