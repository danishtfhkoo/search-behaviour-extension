// Content script for Google Images - tracks user interactions

console.log('[Content] Script loaded');

// Check if Chrome extension API is available
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.error('[Content] Chrome extension API not available! Extension may not be loaded properly.');
}

let sessionActive = false;
let currentQuery = null;
let currentQueryId = null;
let previousQuery = null;
let maxScrollDepth = 0;
let imageClickStartTime = null;
let lastClickedUrl = null;
let saveButtonInjected = false;

// Check if we're on Google Images
function isGoogleImages() {
    const url = new URL(window.location.href);
    const hasTbm = url.searchParams.has('tbm');
    const tbmValue = url.searchParams.get('tbm');
    const hasUdm = url.searchParams.has('udm');
    const udmValue = url.searchParams.get('udm');

    // Check for legacy parameter (tbm=isch) OR new parameter (udm=2)
    const isImages = (hasTbm && tbmValue === 'isch') || (hasUdm && udmValue === '2');

    console.log(`[Content] URL check: ${window.location.href}`);
    console.log(`[Content] tbm=isch: ${hasTbm && tbmValue === 'isch'}, udm=2: ${hasUdm && udmValue === '2'}, Is Images: ${isImages}`);

    return isImages;
}

// Helper to safely send messages
async function safeSendMessage(message) {
    // Check if chrome API is available
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        console.error('[Content] Chrome extension API not available. Is the extension loaded?');
        return null;
    }

    try {
        const response = await chrome.runtime.sendMessage(message);
        return response;
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            console.warn('[Content] Extension was reloaded. Please refresh the page.');
            sessionActive = false;
            return null;
        }
        console.error('[Content] Message error:', error);
        return null;
    }
}

// Initialize
async function init() {
    if (!isGoogleImages()) {
        console.log('[Content] Not on Google Images, exiting');
        return;
    }

    console.log('[Content] On Google Images, initializing...');

    // Check if session is active
    const response = await safeSendMessage({ action: 'GET_QUERY_ID' });

    if (response && response.success) {
        sessionActive = true;
        console.log('[Content] Session is active');

        // Track the current query
        await trackQuery();

        // Set up listeners
        setupImageClickListeners();
        setupScrollTracking();
        setupKeyboardShortcuts();
        setupVisibilityTracking();

        // Observe DOM changes (Google loads images dynamically)
        observeDOMChanges();
    } else {
        console.log('[Content] No active session');
    }
}

// Track query
async function trackQuery() {
    const url = new URL(window.location.href);
    const queryText = url.searchParams.get('q') || '';

    if (queryText === currentQuery) {
        console.log('[Content] Query unchanged, skipping');
        return;
    }

    previousQuery = currentQuery;
    currentQuery = queryText;

    // Increment query ID
    const response = await safeSendMessage({ action: 'INCREMENT_QUERY_ID' });

    if (response && response.success) {
        currentQueryId = response.queryId;

        // Create query event
        const queryEvent = {
            event_id: crypto.randomUUID(),
            event_type: 'query',
            timestamp: new Date().toISOString(),
            query_id: currentQueryId,
            data: {
                query_text: queryText,
                query_length_char: queryText.length,
                query_length_tokens: queryText.split(/\s+/).filter(t => t.length > 0).length,
                previous_query: previousQuery,
                referrer_query: null // Could extract from document.referrer if needed
            }
        };

        // Log event
        await safeSendMessage({
            action: 'LOG_EVENT',
            event: queryEvent
        });

        console.log('[Content] Query logged:', queryText);

        // Reset scroll depth
        maxScrollDepth = 0;
    }
}

// Set up image click listeners
function setupImageClickListeners() {
    console.log('[Content] Setting up click listeners');

    // Event delegation on the entire page
    document.addEventListener('click', async (e) => {
        if (!sessionActive) return;

        // Try to find image element
        const target = e.target;
        const imageElement = target.closest('a[href*="/imgres?"]') ||
            target.closest('div[data-ri]') ||
            target.closest('img');

        if (!imageElement) return;

        // Extract image data
        const imageData = extractImageData(imageElement, e);

        if (imageData) {
            console.log('[Content] Image clicked:', imageData);

            // Create click event
            const clickEvent = {
                event_id: crypto.randomUUID(),
                event_type: 'image_click',
                timestamp: new Date().toISOString(),
                query_id: currentQueryId,
                data: imageData
            };

            // Log event
            await safeSendMessage({
                action: 'LOG_EVENT',
                event: clickEvent
            });

            // Track dwell time
            imageClickStartTime = Date.now();
            lastClickedUrl = imageData.source_page_url;

            // Inject save button after a short delay (wait for preview to load)
            setTimeout(() => {
                injectSaveButton();
            }, 500);
        }
    }, true); // Use capture phase to catch events early
}

// Extract image data from clicked element
function extractImageData(element, event) {
    try {
        // Find the image grid item
        const gridItem = element.closest('div[data-ri]');
        let rankIndex = null;

        if (gridItem) {
            rankIndex = parseInt(gridItem.getAttribute('data-ri')) || null;
        }

        // Try to find image URLs
        let thumbnailUrl = null;
        let imageUrl = null;
        let sourcePageUrl = null;
        let domain = null;

        // Look for thumbnail
        const img = element.querySelector('img') || element.closest('img');
        if (img && img.src) {
            thumbnailUrl = img.src;
        }

        // Look for link to source page
        const link = element.closest('a[href*="/imgres?"]');
        if (link) {
            const href = new URL(link.href);
            imageUrl = href.searchParams.get('imgurl');
            sourcePageUrl = href.searchParams.get('imgrefurl');

            if (sourcePageUrl) {
                try {
                    domain = new URL(sourcePageUrl).hostname;
                } catch (e) {
                    domain = null;
                }
            }
        }

        return {
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl,
            source_page_url: sourcePageUrl,
            domain: domain,
            rank_index: rankIndex
        };
    } catch (error) {
        console.error('[Content] Error extracting image data:', error);
        return null;
    }
}

// Inject save button on image preview
function injectSaveButton() {
    if (saveButtonInjected) {
        return; // Already injected
    }

    // Find the preview panel (Google uses various selectors)
    const previewPanel = document.querySelector('[data-ved][role="dialog"]') ||
        document.querySelector('.irc_c') ||
        document.querySelector('#islsp');

    if (!previewPanel) {
        console.log('[Content] Preview panel not found');
        return;
    }

    // Check if button already exists
    if (document.getElementById('gis-save-btn')) {
        return;
    }

    // Create save button
    const saveBtn = document.createElement('button');
    saveBtn.id = 'gis-save-btn';
    saveBtn.className = 'gis-save-button';
    saveBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    <span>Save (S)</span>
  `;

    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await handleSave();
    });

    // Insert button
    previewPanel.appendChild(saveBtn);
    saveButtonInjected = true;

    console.log('[Content] Save button injected');
}

// Handle save action
async function handleSave() {
    if (!sessionActive || !currentQueryId) {
        console.warn('[Content] Cannot save - no active session');
        return;
    }

    console.log('[Content] Save triggered');

    // Extract data from current preview
    const saveData = extractSaveData();

    if (!saveData) {
        console.error('[Content] Failed to extract save data');
        showSaveNotification('Failed to save image data', false);
        return;
    }

    // Create save event
    const saveEvent = {
        event_id: crypto.randomUUID(),
        event_type: 'save',
        timestamp: new Date().toISOString(),
        query_id: currentQueryId,
        data: {
            query_text: currentQuery,
            ...saveData
        }
    };

    // Log event
    const response = await safeSendMessage({
        action: 'LOG_EVENT',
        event: saveEvent
    });

    if (response && response.success) {
        console.log('[Content] Save logged successfully');
        showSaveNotification('Image saved!', true);
    } else {
        console.error('[Content] Failed to log save');
        showSaveNotification('Failed to save', false);
    }
}

// Extract data for save action
function extractSaveData() {
    try {
        // Find the preview panel
        const previewPanel = document.querySelector('[data-ved][role="dialog"]') ||
            document.querySelector('.irc_c') ||
            document.querySelector('#islsp');

        if (!previewPanel) {
            console.error('[Content] Preview panel not found');
            return null;
        }

        // Extract image element
        const img = previewPanel.querySelector('img[src*="http"]');
        let imageUrl = img ? img.src : null;
        let imageWidth = img ? img.naturalWidth : null;
        let imageHeight = img ? img.naturalHeight : null;

        // Extract alt text / caption
        let altText = img ? img.alt : null;
        let captionText = null;

        // Try to find title/caption elements
        const titleElements = previewPanel.querySelectorAll('[role="heading"], h2, h3');
        if (titleElements.length > 0) {
            captionText = titleElements[0].textContent.trim();
        }

        // Extract source page URL and domain
        let sourcePageUrl = null;
        let domain = null;
        let resultTitle = null;
        let siteName = null;

        const visitLink = previewPanel.querySelector('a[href*="imgrefurl"]');
        if (visitLink) {
            const href = new URL(visitLink.href);
            sourcePageUrl = href.searchParams.get('imgrefurl');

            if (sourcePageUrl) {
                try {
                    const url = new URL(sourcePageUrl);
                    domain = url.hostname;
                } catch (e) {
                    domain = null;
                }
            }

            // Try to get site name
            siteName = visitLink.textContent.trim();
        }

        // Try to find result title
        const titleLink = previewPanel.querySelector('a[href*="imgrefurl"] div');
        if (titleLink) {
            resultTitle = titleLink.textContent.trim();
        }

        // Get thumbnail URL (fallback)
        let thumbnailUrl = imageUrl;

        // Try to get rank index from data attribute
        let rankIndex = null;
        const gridItem = document.querySelector('div[data-ri][class*="selected"]');
        if (gridItem) {
            rankIndex = parseInt(gridItem.getAttribute('data-ri')) || null;
        }

        return {
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl,
            source_page_url: sourcePageUrl,
            domain: domain,
            rank_index: rankIndex,
            alt_text: altText,
            caption_text: captionText,
            result_title: resultTitle,
            site_name: siteName,
            image_width: imageWidth,
            image_height: imageHeight
        };
    } catch (error) {
        console.error('[Content] Error extracting save data:', error);
        return null;
    }
}

// Show save notification
function showSaveNotification(message, success) {
    // Remove existing notification
    const existing = document.getElementById('gis-save-notification');
    if (existing) {
        existing.remove();
    }

    // Create notification
    const notification = document.createElement('div');
    notification.id = 'gis-save-notification';
    notification.className = `gis-notification ${success ? 'success' : 'error'}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto-remove after 2 seconds
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
        if (!sessionActive) return;

        // 'S' key for save (not in input fields)
        if (e.key === 's' || e.key === 'S') {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                await handleSave();
            }
        }
    });

    console.log('[Content] Keyboard shortcuts enabled');
}

// Scroll tracking
function setupScrollTracking() {
    let scrollTimeout = null;

    window.addEventListener('scroll', () => {
        if (!sessionActive) return;

        clearTimeout(scrollTimeout);

        scrollTimeout = setTimeout(() => {
            const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;

            if (scrollPercent > maxScrollDepth) {
                maxScrollDepth = scrollPercent;
                console.log('[Content] Max scroll depth:', maxScrollDepth.toFixed(2) + '%');
            }
        }, 500); // Throttle to every 500ms
    });

    console.log('[Content] Scroll tracking enabled');
}

// Visibility tracking for dwell time
function setupVisibilityTracking() {
    document.addEventListener('visibilitychange', async () => {
        if (!sessionActive || !imageClickStartTime) return;

        if (document.hidden) {
            // User switched away
            const dwellTime = Date.now() - imageClickStartTime;

            if (dwellTime > 1000) { // Only log if > 1 second
                const dwellEvent = {
                    event_id: crypto.randomUUID(),
                    event_type: 'dwell',
                    timestamp: new Date().toISOString(),
                    query_id: currentQueryId,
                    data: {
                        url: lastClickedUrl,
                        dwell_time_ms: dwellTime
                    }
                };

                await safeSendMessage({
                    action: 'LOG_EVENT',
                    event: dwellEvent
                });

                console.log('[Content] Dwell time logged:', dwellTime + 'ms');
            }

            // Reset
            imageClickStartTime = null;
            lastClickedUrl = null;
            saveButtonInjected = false;
        }
    });

    console.log('[Content] Visibility tracking enabled');
}

// Observe DOM changes
function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
        // Re-inject save button if preview panel appears
        if (sessionActive && !saveButtonInjected) {
            injectSaveButton();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[Content] DOM observer started');
}

// Listen for URL changes (SPA navigation)
let lastUrl = window.location.href;
setInterval(() => {
    const currentUrl = window.location.href;

    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('[Content] URL changed, reinitializing');

        if (isGoogleImages()) {
            trackQuery();
            saveButtonInjected = false;
        }
    }
}, 500);

// Initialize (only if on Google Images and Chrome API is available)
if (typeof chrome !== 'undefined' && chrome.runtime) {
    if (isGoogleImages()) {
        init();
    }

    // Re-check session status periodically
    setInterval(async () => {
        // Double-check chrome API is still available
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            console.error('[Content] Chrome API lost');
            return;
        }

        const response = await safeSendMessage({ action: 'GET_QUERY_ID' });

        if (response && response.success && !sessionActive) {
            sessionActive = true;
            console.log('[Content] Session activated');
            init();
        } else if ((!response || !response.success) && sessionActive) {
            sessionActive = false;
            console.log('[Content] Session deactivated');
        }
    }, 5000);
} else {
    console.error('[Content] Extension not loaded - Chrome API unavailable');
}
