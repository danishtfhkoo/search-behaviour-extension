// Chrome storage API wrapper utilities

async function getSessionState() {
    const { sessionState } = await chrome.storage.local.get('sessionState');
    return sessionState || null;
}

async function setSessionState(state) {
    await chrome.storage.local.set({ sessionState: state });
}

async function clearSessionState() {
    await chrome.storage.local.remove('sessionState');
}

async function getEventQueue() {
    const { eventQueue } = await chrome.storage.local.get('eventQueue');
    return eventQueue || [];
}

async function addToQueue(event) {
    const queue = await getEventQueue();
    queue.push(event);
    await chrome.storage.local.set({ eventQueue: queue });
    return queue.length;
}

async function clearEventQueue() {
    await chrome.storage.local.set({ eventQueue: [] });
}

async function getSessionStats() {
    const { sessionStats } = await chrome.storage.local.get('sessionStats');
    return sessionStats || {
        queries: 0,
        saves: 0,
        clicks: 0,
        totalEvents: 0
    };
}

async function updateSessionStats(stats) {
    await chrome.storage.local.set({ sessionStats: stats });
}

async function incrementStat(statName) {
    const stats = await getSessionStats();
    stats[statName] = (stats[statName] || 0) + 1;
    stats.totalEvents = (stats.totalEvents || 0) + 1;
    await updateSessionStats(stats);

    // NotifyREMAINDERpopup of stats update
    chrome.runtime.sendMessage({ action: 'STATS_UPDATE' }).catch(() => {
        // Popup might not be open
    });
}

async function resetSessionStats() {
    await chrome.storage.local.set({
        sessionStats: {
            queries: 0,
            saves: 0,
            clicks: 0,
            totalEvents: 0
        }
    });
}


// Functions are now globally accessible in service worker context
