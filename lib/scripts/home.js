document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger');
    const nav = document.querySelector('header nav'); // Changed selector to be more specific
    if (hamburger && nav) {
        hamburger.addEventListener('click', () => {
            // Toggle ARIA attribute for accessibility
            const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', !isExpanded);
            // Toggle nav visibility using 'active' class
            nav.classList.toggle('active');
        });
    } else {
        // Use warn for non-critical issues
        console.warn('Hamburger menu or navigation not found.');
    }

    // --- Server Status Check Logic ---

    const statusCheckInterval = 60000; // Check interval in milliseconds (60 seconds)

    /**
     * Updates the display elements of a service status card.
     * @param {Element} cardElement - The server card element.
     * @param {string} status - The status ('online', 'offline', 'error', 'loading').
     * @param {number|string} ping - Ping time in ms or '-' if not applicable.
     * @param {string|null} [error=null - Optional error message.
     */
    function updateServiceDisplay(cardElement, status, ping, error = null) {
        const indicator = cardElement.querySelector('.status-indicator');
        const statusText = cardElement.querySelector('.status-text');
        const pingTimeEl = cardElement.querySelector('.ping-time');
        const updateTimeEl = cardElement.querySelector('.update-time');
        const pingDisplay = cardElement.querySelector('.ping-display'); // Element containing ping info

        if (!indicator || !statusText || !pingTimeEl || !updateTimeEl || !pingDisplay) {
            console.error('Required status elements not found in card:', cardElement);
            return;
        }

        // Reset classes and styles for clarity
        indicator.className = 'status-indicator'; // Remove previous status classes
        pingDisplay.style.display = 'none'; // Hide ping initially
        statusText.textContent = ''; // Clear previous text

        switch (status) {
            case 'online':
                indicator.classList.add('status-online');
                statusText.textContent = 'オンライン';
                pingTimeEl.textContent = ping;
                pingDisplay.style.display = 'inline'; // Show ping display block
                break;
            case 'offline':
                indicator.classList.add('status-offline');
                // Show specific error message if provided, otherwise default 'Offline'
                statusText.textContent = error || 'オフライン';
                pingTimeEl.textContent = '-';
                break;
            case 'error':
                indicator.classList.add('status-error');
                statusText.textContent = error || 'エラー';
                pingTimeEl.textContent = '-';
                break;
            case 'loading':
            default: // Default to loading state
                indicator.classList.add('status-loading');
                statusText.textContent = '確認中...';
                pingTimeEl.textContent = '-';
                break;
        }

        // Update last check time regardless of status
        const now = new Date();
        // Using toLocaleTimeString for a user-friendly time format
        updateTimeEl.textContent = now.toLocaleTimeString({ hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Checks the status of a service at the given URL.
     * Uses 'no-cors' mode and HEAD request for a lightweight check.
     * Implements a timeout using AbortController.
     * @param {string} serviceUrl - The URL of the service to check.
     * @returns {Promise<{status: string, ping: number|string, error?: string}>} - Resolves with status details.
     */
    async function checkServiceStatus(serviceUrl) {
        const startTime = performance.now();
        const controller = new AbortController(); // For implementing timeout
        const timeoutDuration = 5000; // 5-second timeout
        const timeoutId = setTimeout(() => {
            controller.abort(); // Abort the fetch request on timeout
            console.warn(`Service check timed out for ${serviceUrl} after ${timeoutDuration}ms`);
        }, timeoutDuration);
        try {
            // Using 'no-cors' mode: This allows the request to be made cross-origin
            // without requiring specific CORS headers from the server. However,
            // the response body and status code (always 0) are inaccessible.
            // A successful fetch (no error thrown) indicates network reachability.
            // Using 'HEAD' method is often lighter as it doesn't request the body.
            // 'cache: no-store' attempts to bypass browser caching for a fresh check.
            const response = await fetch(serviceUrl, {
                method: 'HEAD', // Use HEAD for potentially lighter request
                mode: 'no-cors',
                signal: controller.signal, // Link fetch to the AbortController
                cache: 'no-store' // Prevent caching
            });

            // In 'no-cors' mode, `response.ok` is always false and `response.status` is 0.
            // Success is determined by the fetch promise resolving without error.
            clearTimeout(timeoutId); // Cancel the timeout timer
            const endTime = performance.now();
            const ping = Math.round(endTime - startTime);
            // console.log(`Service check successful for ${serviceUrl}. Ping: ${ping}ms`);
            return { status: 'online', ping };
        } catch (error) {
            clearTimeout(timeoutId); // Cancel the timeout timer
            const endTime = performance.now();
            // Calculate duration even on error, might be useful for diagnostics
            const pingOnError = Math.round(endTime - startTime);

            if (error.name === 'AbortError') {
                // This specific error is thrown when controller.abort() is called (timeout)
                return { status: 'offline', ping: '-', error: 'タイムアウト' };
            } else {
                // Other errors (e.g., DNS lookup failure, connection refused, network down)
                // We categorize these generally as 'offline' or 'inaccessible'.
                console.warn(`Service check failed for ${serviceUrl}:`, error.message);
                // navigator.onLine only indicates if the *browser* has a network connection,
                // not if the specific *server* is reachable. So, it's not reliable here.
                return { status: 'offline', ping: '-', error: 'アクセス不能' };
            }
        }
    }

    /**
     * Finds all server cards, checks their status, and updates their display.
     */
    function checkAndUpdateAllServices() {
        // Use a more specific class if possible, e.g., 'server-status-card'
        const serviceCards = document.querySelectorAll('.server-card'); // Assuming '.server-card' is the container class

        if (serviceCards.length === 0) {
            console.warn("No server cards found with the class 'server-card'. Status checks stopped.");
            return; // Exit if no cards are found
        }

        console.log(`Checking status for ${serviceCards.length} services...`);

        serviceCards.forEach(async (card) => {
            const serviceUrl = card.dataset.serviceUrl;
            // Use a service ID from data attributes for better logging, if available
            const serviceId = card.dataset.serviceId || serviceUrl || 'unknown-service';

            if (!serviceUrl) {
                console.warn(`Service card '${serviceId}' is missing data-service-url attribute.`);
                updateServiceDisplay(card, 'error', '-', 'URL未設定');
                return; // Skip this card
            }

            // Set initial "loading" state before starting the async check
            updateServiceDisplay(card, 'loading', '-');
            try {
                // Await the status check result
                const { status, ping, error } = await checkServiceStatus(serviceUrl);
                // Update the card display based on the result
                updateServiceDisplay(card, status, ping, error);
                // Optional: Log successful update
                // console.log(`Status updated for ${serviceId}: ${status}`);
            } catch (err) {
                // Catch unexpected errors during the check/update process itself
                console.error(`Unexpected error updating status for ${serviceId}:`, err);
                updateServiceDisplay(card, 'error', '-', '内部エラー');
            }
        });
    }

    // --- Initial Check and Interval Setup ---

    checkAndUpdateAllServices(); // Perform the first check immediately on load

    // Set up periodic checks using setInterval
    setInterval(checkAndUpdateAllServices, statusCheckInterval);

    console.log(`Server status checks initialized. Interval: ${statusCheckInterval / 1000} seconds.`);
});
