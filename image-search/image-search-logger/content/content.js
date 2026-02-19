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
let lastFilterState = '';
let lastSentDepth = 0;

// Helper for reformulation type
function getReformulationType(current, previous) {
    if (!previous) return 'new';

    // Normalize
    const normalize = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const curr = normalize(current);
    const prev = normalize(previous);

    if (curr === prev) return 'repeat';

    // Word-based check
    const currWords = curr.split(' ').filter(w => w.length > 0);
    const prevWords = prev.split(' ').filter(w => w.length > 0);

    // Additive: all prev words in curr
    const isAdditive = prevWords.every(w => currWords.includes(w));
    if (isAdditive && currWords.length > prevWords.length) return 'additive';

    // Subtractive: all curr words in prev
    const isSubtractive = currWords.every(w => prevWords.includes(w));
    if (isSubtractive && currWords.length < prevWords.length) return 'subtractive';

    return 'rewrite';
}

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

        // Setup filter tracking
        setupFilterTracking();
    } else {
        console.log('[Content] No active session');
    }
}

// Track query
async function trackQuery() {
    const url = new URL(window.location.href);
    const queryText = url.searchParams.get('q') || '';

    // Clean query text for comparison
    const cleanQuery = (queryText || '').trim();

    // Check filter state (tbs/udm/chips)
    const filterState = ['tbs', 'udm', 'tbm', 'chips'].map(k => url.searchParams.get(k)).join('|');

    if (cleanQuery === currentQuery && filterState === lastFilterState) {
        console.log('[Content] Query/Filter unchanged, skipping');
        return;
    }

    let reformulationType = 'new';
    if (currentQuery != null) { // Only if not first query
        if (cleanQuery === currentQuery && filterState !== lastFilterState) {
            reformulationType = 'filter_change';
        } else {
            reformulationType = getReformulationType(cleanQuery, currentQuery);
        }
    }

    previousQuery = currentQuery;
    currentQuery = cleanQuery;
    lastFilterState = filterState;

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
                reformulation_type: reformulationType,
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
        lastSentDepth = 0;
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
        const eventTarget = event && event.target instanceof Element ? event.target : null;

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

        // Look for /imgres link
        const link = (eventTarget && eventTarget.closest('a[href*="/imgres?"]')) ||
            element.closest('a[href*="/imgres?"]') ||
            element.closest('a');

        if (link && link.href) {
            try {
                const url = new URL(link.href, window.location.origin);
                if (url.searchParams.has('imgurl')) {
                    imageUrl = url.searchParams.get('imgurl');
                    sourcePageUrl = url.searchParams.get('imgrefurl');

                    if (sourcePageUrl) {
                        try {
                            domain = new URL(sourcePageUrl).hostname;
                        } catch (e) {
                            domain = null;
                        }
                    }
                }
            } catch (e) {
                // Ignore URL parse errors
            }
        }

        if (imageUrl || thumbnailUrl || sourcePageUrl) {
            return {
                image_url: imageUrl,
                thumbnail_url: thumbnailUrl,
                source_page_url: sourcePageUrl,
                domain: domain
            };
        }

        return null;
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
        // Find the preview panel (side panel or dialog)
        const previewPanel = document.querySelector('[data-ved][role="dialog"]') ||
            document.querySelector('.irc_c') ||
            document.querySelector('#islsp') ||
            document.querySelector('#Sva75c'); // Common ID for side panel

        if (!previewPanel) {
            console.error('[Content] Preview panel not found');
            return null;
        }

        // Extract main image
        // Strategy: Look for images with http(s) src (not data URI) and reasonable size
        const images = Array.from(previewPanel.querySelectorAll('img'));
        let mainImg = null;
        let largestArea = 0;

        for (const img of images) {
            if (!img.src || img.src.startsWith('data:')) continue;

            // Check dimensions if available (naturalWidth/Height often 0 if not fully loaded, but clientWidth works)
            const width = img.naturalWidth || img.clientWidth || 0;
            const height = img.naturalHeight || img.clientHeight || 0;
            const area = width * height;

            // Heuristic: Main image is usually the largest
            if (area > largestArea) {
                largestArea = area;
                mainImg = img;
            }
        }

        // If no large image found, fallback to specific classes or first http image
        if (!mainImg) {
            mainImg = previewPanel.querySelector('img.n3VNCb') ||
                previewPanel.querySelector('img[src^="http"]');
        }

        let imageUrl = mainImg ? mainImg.src : null;
        let imageWidth = mainImg ? (mainImg.naturalWidth || mainImg.width) : null;
        let imageHeight = mainImg ? (mainImg.naturalHeight || mainImg.height) : null;
        let altText = mainImg ? mainImg.alt : null;

        // Extract title/caption
        let captionText = null;
        const titleElement = previewPanel.querySelector('h1, h2, h3, [role="heading"]');
        if (titleElement) {
            captionText = titleElement.textContent.trim();
        }

        // Extract source page URL and domain
        let sourcePageUrl = null;
        let domain = null;
        let resultTitle = null;
        let siteName = null;

        // Look for the "Visit" button or similar links
        const links = Array.from(previewPanel.querySelectorAll('a'));
        const visitLink = links.find(a => a.href && a.href.includes('imgrefurl')) ||
            links.find(a => a.textContent.toLowerCase().includes('visit'));

        if (visitLink) {
            try {
                const urlObj = new URL(visitLink.href);
                // If it's a google redirect, parse it
                if (urlObj.href.includes('imgrefurl')) {
                    sourcePageUrl = urlObj.searchParams.get('imgrefurl');
                } else {
                    sourcePageUrl = visitLink.href;
                }

                if (sourcePageUrl) {
                    domain = new URL(sourcePageUrl).hostname;
                }
            } catch (e) { }

            // Site name is often the text of the visit link or a nearby element
            siteName = visitLink.textContent.trim();
        }

        return {
            image_url: imageUrl,
            thumbnail_url: imageUrl,
            source_page_url: sourcePageUrl,
            domain: domain,
            alt_text: altText,
            caption_text: captionText,
            result_title: captionText,
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

        scrollTimeout = setTimeout(async () => {
            const docHeight = document.documentElement.scrollHeight;
            const winHeight = window.innerHeight;

            if (docHeight <= winHeight) return;

            const scrollPercent = Math.min(100, Math.max(0, (window.scrollY / (docHeight - winHeight)) * 100));

            if (scrollPercent > maxScrollDepth) {
                maxScrollDepth = scrollPercent;

                // Stick to 10% increments
                if (maxScrollDepth - lastSentDepth >= 10 || maxScrollDepth > 99) {
                    // Update checkpoint
                    lastSentDepth = maxScrollDepth;

                    await safeSendMessage({
                        action: 'LOG_EVENT',
                        event: {
                            event_id: crypto.randomUUID(),
                            event_type: 'scroll',
                            timestamp: new Date().toISOString(),
                            query_id: currentQueryId,
                            data: { max_scroll_depth: Math.round(maxScrollDepth) }
                        }
                    });

                    console.log('[Content] Scroll logged:', Math.round(maxScrollDepth) + '%');
                }
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

            // Reset
            imageClickStartTime = null;
            lastClickedUrl = null;
            saveButtonInjected = false;
        }
    });

    console.log('[Content] Visibility tracking enabled');
}

// Filter tracking
function setupFilterTracking() {
    console.log('[Content] Setting up filter tracking');

    // Use event delegation for filter clicks
    document.addEventListener('click', async (e) => {
        if (!sessionActive) return;

        // Heuristic: Filter elements usually are in the top bar or have specific classes/roles
        // We look for typical Google filter structures
        const filterElement = e.target.closest('a[href*="tbs="]') ||
            e.target.closest('a[role="button"]') ||
            e.target.closest('div[role="listitem"]'); // Filter chips

        if (!filterElement) return;

        // Check if it's likely a filter
        const isFilter = filterElement.href && filterElement.href.includes('tbs=') ||
            filterElement.closest('#hdtb-msb') || // Desktop tabs
            filterElement.closest('.chip-container') || // Chips
            filterElement.getAttribute('role') === 'listitem';

        if (isFilter) {
            console.log('[Content] Filter clicked');

            // Detect filter type more precisely
            let filterType = filterElement.getAttribute('aria-label') || 'unknown';

            if (filterElement.href) {
                try {
                    const url = new URL(filterElement.href, window.location.origin);
                    const tbs = url.searchParams.get('tbs');

                    if (tbs) {
                        if (tbs.includes('isz:')) filterType = 'size';
                        else if (tbs.includes('ic:') || tbs.includes('isc:')) filterType = 'color';
                        else if (tbs.includes('itp:')) filterType = 'type';
                        else if (tbs.includes('qdr:') || tbs.includes('cdr:')) filterType = 'time';
                        else if (tbs.includes('sur:') || tbs.includes('il:')) filterType = 'usage_rights';
                        else filterType = 'tools_filter';
                    } else if (url.searchParams.has('chips')) {
                        filterType = 'chip';
                    }
                } catch (err) {
                    console.error('[Content] Error parsing filter URL:', err);
                }
            }

            // Fallback heuristics based on context
            if (filterType === 'unknown' || filterType === 'tools_filter') {
                if (filterElement.closest('#hdtb-msb')) {
                    filterType = 'search_tab';
                } else if (filterElement.closest('.chip-container') || filterElement.closest('[role="listitem"]')) {
                    filterType = 'chip';
                }
            }

            const filterEvent = {
                event_id: crypto.randomUUID(),
                event_type: 'filter_click',
                timestamp: new Date().toISOString(),
                query_id: currentQueryId,
                data: {
                    filter_text: filterElement.textContent.trim(),
                    filter_type: filterType
                }
            };

            await safeSendMessage({
                action: 'LOG_EVENT',
                event: filterEvent
            });
        }
    }, true);
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
