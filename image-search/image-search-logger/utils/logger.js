// Utility functions for creating structured event logs

function generateId() {
    return crypto.randomUUID();
}

function createQueryEvent(sessionId, queryId, queryData) {
    return {
        event_id: generateId(),
        event_type: 'query',
        timestamp: new Date().toISOString(),
        query_id: queryId,
        data: {
            query_text: queryData.queryText,
            query_length_char: queryData.queryText.length,
            reformulation_type: queryData.reformulationType || 'new',
            previous_query: queryData.previousQuery || null,
            referrer_query: queryData.referrerQuery || null
        }
    };
}

function createImageClickEvent(sessionId, queryId, imageData) {
    return {
        event_id: generateId(),
        event_type: 'image_click',
        timestamp: new Date().toISOString(),
        query_id: queryId,
        data: {
            image_url: imageData.imageUrl || null,
            thumbnail_url: imageData.thumbnailUrl || null,
            source_page_url: imageData.sourcePageUrl || null,
            domain: imageData.domain || null,
            rank_index: imageData.rankIndex || null
        }
    };
}

function createSaveEvent(sessionId, queryId, saveData) {
    return {
        event_id: generateId(),
        event_type: 'save',
        timestamp: new Date().toISOString(),
        query_id: queryId,
        data: {
            query_text: saveData.queryText || null,
            image_url: saveData.imageUrl || null,
            thumbnail_url: saveData.thumbnailUrl || null,
            source_page_url: saveData.sourcePageUrl || null,
            domain: saveData.domain || null,
            rank_index: saveData.rankIndex || null,
            alt_text: saveData.altText || null,
            caption_text: saveData.captionText || null,
            result_title: saveData.resultTitle || null,
            site_name: saveData.siteName || null,
            image_width: saveData.imageWidth || null,
            image_height: saveData.imageHeight || null
        }
    };
}

function createDwellEvent(sessionId, queryId, dwellData) {
    return {
        event_id: generateId(),
        event_type: 'dwell',
        timestamp: new Date().toISOString(),
        query_id: queryId,
        data: {
            url: dwellData.url,
            dwell_time_ms: dwellData.dwellTimeMs
        }
    };
}

function createScrollEvent(sessionId, queryId, scrollData) {
    return {
        event_id: generateId(),
        event_type: 'scroll',
        timestamp: new Date().toISOString(),
        query_id: queryId,
        data: {
            max_scroll_depth_percent: scrollData.maxScrollDepthPercent
        }
    };
}

function createImpressionEvent(sessionId, queryId, impressionData) {
    return {
        event_id: generateId(),
        event_type: 'image_impression',
        timestamp: new Date().toISOString(),
        query_id: queryId,
        data: {
            image_id: impressionData.imageId,
            thumbnail_url: impressionData.thumbnailUrl || null,
            rank_index: impressionData.rankIndex || null
        }
    };
}


// Functions are now globally accessible
