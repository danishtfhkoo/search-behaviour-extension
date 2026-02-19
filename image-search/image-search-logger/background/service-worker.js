// Background service worker - manages session state and event queue

// Import utilities (service workers use import instead of require)
try {
    importScripts('../utils/storage.js', '../utils/logger.js');
    console.log('[Background] Utils loaded successfully');

    // Verify functions are available
    if (typeof generateId === 'undefined') {
        console.error('[Background] ERROR: generateId not defined!');
    }
    if (typeof getSessionState === 'undefined') {
        console.error('[Background] ERROR: getSessionState not defined!');
    }
    // sendEvents not needed anymore

    console.log('[Background] All utility functions verified');
} catch (error) {
    console.error('[Background] Failed to load utils:', error);
}

// Batch constants removed
let currentQueryId = 0;

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Background] Extension installed');
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Received message:', message.action);

    try {
        switch (message.action) {
            case 'START_SESSION':
                handleStartSession(message.data).then(sendResponse).catch(err => {
                    console.error('[Background] START_SESSION error:', err);
                    sendResponse({ success: false, error: err.message });
                });
                return true; // Keep channel open for async response

            case 'END_SESSION':
                handleEndSession().then(sendResponse).catch(err => {
                    console.error('[Background] END_SESSION error:', err);
                    sendResponse({ success: false, error: err.message });
                });
                return true;

            case 'LOG_EVENT':
                handleLogEvent(message.event).then(sendResponse).catch(err => {
                    console.error('[Background] LOG_EVENT error:', err);
                    sendResponse({ success: false, error: err.message });
                });
                return true;

            case 'EXPORT_LOGS':
                handleExportLogs().then(sendResponse).catch(err => {
                    console.error('[Background] EXPORT_LOGS error:', err);
                    sendResponse({ success: false, error: err.message });
                });
                return true;

            case 'GET_QUERY_ID':
                handleGetQueryId().then(sendResponse).catch(err => {
                    console.error('[Background] GET_QUERY_ID error:', err);
                    sendResponse({ success: false, error: err.message });
                });
                return true;

            case 'INCREMENT_QUERY_ID':
                handleIncrementQueryId(message.data).then(sendResponse).catch(err => {
                    console.error('[Background] INCREMENT_QUERY_ID error:', err);
                    sendResponse({ success: false, error: err.message });
                });
                return true;

            case 'STATS_UPDATE':
                // Just a notification, no response needed
                return false;

            default:
                console.warn('[Background] Unknown action:', message.action);
                sendResponse({ success: false, error: 'Unknown action: ' + message.action });
                return false;
        }
    } catch (error) {
        console.error('[Background] Message handler error:', error);
        sendResponse({ success: false, error: error.message });
        return false;
    }
});

// Start session
async function handleStartSession({ participantId, taskId }) {
    try {
        const sessionId = generateId();
        const startTime = Date.now();

        const sessionState = {
            isActive: true,
            sessionId,
            participantId,
            taskId,
            startTime,
            queryId: 0,
            currentQuery: null,
            lastFilterState: ''
        };

        await setSessionState(sessionState);
        await resetSessionStats();
        await clearEventQueue();

        currentQueryId = 0;

        // Start batch timer
        // Batch timer removed

        console.log('[Background] Session started:', sessionId);

        return {
            success: true,
            sessionState,
            message: 'Session started successfully'
        };
    } catch (error) {
        console.error('[Background] Failed to start session:', error);
        return { success: false, error: error.message };
    }
}

// End session
async function handleEndSession() {
    try {
        const sessionState = await getSessionState();

        if (!sessionState || !sessionState.isActive) {
            return { success: false, error: 'No active session' };
        }

        // Get all data for export
        const eventQueue = await getEventQueue();
        const stats = await getSessionStats();

        const exportData = {
            session_id: sessionState.sessionId,
            participant_id: sessionState.participantId,
            task_id: sessionState.taskId,
            start_time: new Date(sessionState.startTime).toISOString(),
            end_time: new Date().toISOString(),
            statistics: stats,
            events: eventQueue
        };

        // Clear session
        await clearSessionState();
        await resetSessionStats();
        await clearEventQueue();

        console.log('[Background] Session ended:', sessionState.sessionId);

        return {
            success: true,
            data: exportData,
            message: 'Session ended successfully'
        };
    } catch (error) {
        console.error('[Background] Failed to end session:', error);
        return { success: false, error: error.message };
    }
}

// Log event
async function handleLogEvent(event) {
    try {
        const sessionState = await getSessionState();

        if (!sessionState || !sessionState.isActive) {
            console.warn('[Background] Ignoring event - no active session');
            return { success: false, error: 'No active session' };
        }

        // Add to queue
        const queueLength = await addToQueue(event);

        // Update stats based on event type
        if (event.event_type === 'query') {
            await incrementStat('queries');
        } else if (event.event_type === 'save') {
            await incrementStat('saves');
        } else if (event.event_type === 'image_click') {
            await incrementStat('clicks');
        } else if (event.event_type === 'filter_click') {
            await incrementStat('filter_changes');
        }

        console.log(`[Background] Event logged: ${event.event_type} (queue: ${queueLength})`);

        // Flush logic removed

        return { success: true, queueLength };
    } catch (error) {
        console.error('[Background] Failed to log event:', error);
        return { success: false, error: error.message };
    }
}

// Export logs as JSON
async function handleExportLogs() {
    try {
        const sessionState = await getSessionState();
        const eventQueue = await getEventQueue();
        const stats = await getSessionStats();

        if (!sessionState) {
            return { success: false, error: 'No session data available' };
        }

        const exportData = {
            session_id: sessionState.sessionId,
            participant_id: sessionState.participantId,
            task_id: sessionState.taskId,
            start_time: new Date(sessionState.startTime).toISOString(),
            end_time: sessionState.isActive ? null : new Date().toISOString(),
            statistics: stats,
            events: eventQueue
        };

        console.log('[Background] Exporting logs:', eventQueue.length, 'events');

        return {
            success: true,
            data: exportData
        };
    } catch (error) {
        console.error('[Background] Failed to export logs:', error);
        return { success: false, error: error.message };
    }
}

// Get current query ID
async function handleGetQueryId() {
    try {
        const sessionState = await getSessionState();
        if (!sessionState) {
            return { success: false, error: 'No active session' };
        }
        return {
            success: true,
            queryId: sessionState.queryId,
            currentQuery: sessionState.currentQuery,
            lastFilterState: sessionState.lastFilterState
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Flush and batch timer functions removed


// Increment query ID
async function handleIncrementQueryId() {
    try {
        const sessionState = await getSessionState();
        if (sessionState) {
            sessionState.queryId++;
            if (messageData) {
                if (messageData.currentQuery !== undefined) sessionState.currentQuery = messageData.currentQuery;
                if (messageData.lastFilterState !== undefined) sessionState.lastFilterState = messageData.lastFilterState;
            }
            await setSessionState(sessionState);
            return { success: true, queryId: sessionState.queryId };
        } else {
            return { success: false, error: 'No active session' };
        }
    } catch (error) {
        console.error('[Background] Failed to increment query ID:', error);
        return { success: false, error: error.message };
    }
}


console.log('[Background] Service worker initialized');
