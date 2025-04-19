document.addEventListener('DOMContentLoaded', function () {
    // Theme toggling functionality
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const scrollTopBtn = document.getElementById('scroll-top');

    // Get modal elements
    const modal = document.getElementById('tool-detail-modal');
    const modalContent = document.getElementById('modal-content');
    const modalClose = document.getElementById('modal-close');
    const modalTitle = document.getElementById('modal-title');
    const modalImage = document.getElementById('modal-image');
    const modalDescription = document.getElementById('modal-description');
    const modalCategory = document.getElementById('modal-category');
    const modalVersion = document.getElementById('modal-version');
    const modalUpdated = document.getElementById('modal-updated');
    const modalDownloadBtn = document.getElementById('modal-download');
    const modalDocBtn = document.getElementById('modal-docs');

    // Theme toggle functionality
    themeToggle.addEventListener('click', function () {
        const currentTheme = body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        body.setAttribute('data-theme', newTheme);

        themeToggle.innerHTML = newTheme === 'dark'
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';

        localStorage.setItem('theme', newTheme);
    });

    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.setAttribute('data-theme', savedTheme);
        themeToggle.innerHTML = savedTheme === 'dark'
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
    }

    // Scroll to top button functionality
    if (scrollTopBtn) {
        window.addEventListener('scroll', function () {
            if (window.pageYOffset > 300) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        });

        scrollTopBtn.addEventListener('click', function () {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Handle pagination
    const paginationLinks = document.querySelectorAll('.pagination a');
    if (paginationLinks.length > 0) {
        paginationLinks.forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();

                paginationLinks.forEach(l => l.classList.remove('active'));

                this.classList.add('active');
                const toolGrid = document.querySelector('.tool-grid');
                if (toolGrid) {
                    toolGrid.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    // Open modal when a tool card is clicked
    document.querySelectorAll('.tool-card').forEach(card => {
        card.addEventListener('click', function (e) {
            if (e.target.closest('.btn')) {
                return;
            }

            const toolId = this.getAttribute('data-id');
            const toolData = getToolDetails(toolId);

            if (toolData) {
                populateModal(toolData);
                openModal();
            }
        });
    });

    // Close modal when clicking the close button
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    // Close modal when clicking outside of it
    window.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Close modal with ESC key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closeModal();
        }
    });

    // Open modal function
    function openModal() {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    // Close modal function
    function closeModal() {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    // Populate modal with tool data
    function populateModal(tool) {
        modalTitle.textContent = tool.title;
        modalImage.src = tool.imageLarge || tool.image;
        modalImage.alt = tool.title;
        modalDescription.innerHTML = tool.detailedDescription || tool.description;
        modalCategory.textContent = tool.category;
        modalVersion.textContent = tool.version;
        modalUpdated.textContent = tool.updated;

        modalDownloadBtn.href = tool.downloadUrl;

        if (tool.docsUrl) {
            modalDocBtn.href = tool.docsUrl;
            modalDocBtn.style.display = 'inline-flex';
        } else {
            modalDocBtn.style.display = 'none';
        }
    }

    // Mock function to get tool details
    function getToolDetails(id) {
        const tools = {};

        return tools[id];
    }
});