// Backend API communication utilities

const API_BASE_URL = 'http://localhost:3000';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sendEvents(sessionId, participantId, taskId, events) {
    const payload = {
        session_id: sessionId,
        participant_id: participantId,
        task_id: taskId,
        events: events
    };

    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`[API] Successfully sent ${events.length} events`);
            return { success: true, result };

        } catch (error) {
            lastError = error;
            console.error(`[API] Attempt ${attempt + 1} failed:`, error.message);

            if (attempt < MAX_RETRIES - 1) {
                const delay = RETRY_DELAY_MS * Math.pow(2, attempt); // Exponential backoff
                console.log(`[API] Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    console.error(`[API] All ${MAX_RETRIES} attempts failed`);
    return {
        success: false,
        error: lastError.message,
        events: events // Return events for local storage
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// Functions are now globally accessible
