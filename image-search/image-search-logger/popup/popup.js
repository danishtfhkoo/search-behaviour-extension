// DOM Elements
const setupView = document.getElementById('setupView');
const activeView = document.getElementById('activeView');
const participantIdInput = document.getElementById('participantId');
const taskIdInput = document.getElementById('taskId');
const startBtn = document.getElementById('startBtn');
const endBtn = document.getElementById('endBtn');
const exportBtn = document.getElementById('exportBtn');
const sessionTimer = document.getElementById('sessionTimer');
const activeParticipant = document.getElementById('activeParticipant');
const activeTask = document.getElementById('activeTask');
const eventCount = document.getElementById('eventCount');

let timerInterval = null;

// Initialize popup
async function init() {
    // Check if session is active
    const { sessionState } = await chrome.storage.local.get('sessionState');

    if (sessionState && sessionState.isActive) {
        showActiveView(sessionState);
    } else {
        showSetupView();
    }

    // Load saved participant/task IDs
    const { participantId, taskId } = await chrome.storage.local.get(['participantId', 'taskId']);
    if (participantId) participantIdInput.value = participantId;
    if (taskId) taskIdInput.value = taskId;
}

// Show setup view
function showSetupView() {
    setupView.classList.remove('hidden');
    activeView.classList.add('hidden');
    stopTimer();
}

// Show active session view
function showActiveView(sessionState) {
    setupView.classList.add('hidden');
    activeView.classList.remove('hidden');

    activeParticipant.textContent = sessionState.participantId;
    activeTask.textContent = sessionState.taskId;

    startTimer(sessionState.startTime);
    updateStats();
}

// Start session
startBtn.addEventListener('click', async () => {
    const participantId = participantIdInput.value.trim();
    const taskId = taskIdInput.value.trim();

    if (!participantId || !taskId) {
        alert('Please enter both Participant ID and Task ID');
        return;
    }

    // Save IDs for next time
    await chrome.storage.local.set({ participantId, taskId });

    // Send message to background to start session
    chrome.runtime.sendMessage({
        action: 'START_SESSION',
        data: { participantId, taskId }
    }, (response) => {
        // Check for runtime errors
        if (chrome.runtime.lastError) {
            console.error('[Popup] Runtime error:', chrome.runtime.lastError);
            alert('Error connecting to extension: ' + chrome.runtime.lastError.message);
            return;
        }

        if (!response) {
            console.error('[Popup] No response from background');
            alert('No response from background service worker. Try reloading the extension.');
            return;
        }

        if (response.success) {
            console.log('[Popup] Session started successfully');
            showActiveView(response.sessionState);
        } else {
            console.error('[Popup] Session start failed:', response.error);
            alert('Failed to start session: ' + response.error);
        }
    });
});

// End session
endBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to end this session? You will be prompted to save the session logs.')) {
        return;
    }

    chrome.runtime.sendMessage({
        action: 'END_SESSION'
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[Popup] Runtime error:', chrome.runtime.lastError);
            alert('Error: ' + chrome.runtime.lastError.message);
            return;
        }

        if (!response) {
            console.error('[Popup] No response from background');
            alert('No response from background. Events may not have been sent.');
            showSetupView();
            return;
        }

        if (response.success) {
            console.log('[Popup] Session ended. Exporting data...');

            // Auto-export data
            const data = response.data;
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `session-logs-${data.session_id}-${timestamp}.json`;

            chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            });

            showSetupView();
            // alert('Session ended. Please save the log file.');
        } else {
            console.error('[Popup] Session end failed:', response.error);
            alert('Failed to end session: ' + response.error);
        }
    });
});

// Export logs as JSON
exportBtn.addEventListener('click', async () => {
    chrome.runtime.sendMessage({
        action: 'EXPORT_LOGS'
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[Popup] Runtime error:', chrome.runtime.lastError);
            alert('Error: ' + chrome.runtime.lastError.message);
            return;
        }

        if (!response) {
            alert('No response from background');
            return;
        }

        if (response.success) {
            // Create download
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `session-logs-${response.data.session_id}-${timestamp}.json`;

            chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            });
        } else {
            alert('Failed to export logs: ' + response.error);
        }
    });
});

// Timer functions
function startTimer(startTime) {
    stopTimer();

    function updateTimer() {
        const elapsed = Date.now() - startTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        sessionTimer.textContent =
            String(hours).padStart(2, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(seconds).padStart(2, '0');
    }

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Update stats
async function updateStats() {
    const { sessionStats } = await chrome.storage.local.get('sessionStats');

    if (sessionStats) {
        eventCount.textContent = sessionStats.totalEvents || 0;
    }
}

// Listen for stat updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'STATS_UPDATE') {
        updateStats();
    }
});

// Input validation
function validateInputs() {
    const participantId = participantIdInput.value.trim();
    const taskId = taskIdInput.value.trim();
    startBtn.disabled = !participantId || !taskId;
}

participantIdInput.addEventListener('input', validateInputs);
taskIdInput.addEventListener('input', validateInputs);

// Initialize
init();
validateInputs();
