const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

async function initializeDataFiles() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });

        // Initialize sessions file if it doesn't exist
        try {
            await fs.access(SESSIONS_FILE);
        } catch {
            await fs.writeFile(SESSIONS_FILE, JSON.stringify([], null, 2));
        }

        // Initialize events file if it doesn't exist
        try {
            await fs.access(EVENTS_FILE);
        } catch {
            await fs.writeFile(EVENTS_FILE, JSON.stringify([], null, 2));
        }

        console.log('[Server] Data files initialized');
    } catch (error) {
        console.error('[Server] Failed to initialize data files:', error);
    }
}

// Helper functions
async function readJSON(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`[Server] Error reading ${filePath}:`, error);
        return [];
    }
}

async function writeJSON(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`[Server] Error writing ${filePath}:`, error);
        return false;
    }
}

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Log events
app.post('/api/log', async (req, res) => {
    try {
        const { session_id, participant_id, task_id, events } = req.body;

        if (!session_id || !participant_id || !task_id || !Array.isArray(events)) {
            return res.status(400).json({
                error: 'Missing required fields: session_id, participant_id, task_id, events'
            });
        }

        console.log(`[Server] Received ${events.length} events from session ${session_id}`);

        // Read existing sessions
        const sessions = await readJSON(SESSIONS_FILE);

        // Check if session exists
        let session = sessions.find(s => s.session_id === session_id);

        if (!session) {
            // Create new session record
            session = {
                session_id,
                participant_id,
                task_id,
                start_time: new Date().toISOString(),
                last_update: new Date().toISOString(),
                event_count: 0
            };
            sessions.push(session);
        }

        // Update session
        session.last_update = new Date().toISOString();
        session.event_count += events.length;

        // Save sessions
        await writeJSON(SESSIONS_FILE, sessions);

        // Append events
        const allEvents = await readJSON(EVENTS_FILE);

        // Add session metadata to each event
        const enrichedEvents = events.map(event => ({
            ...event,
            session_id,
            participant_id,
            task_id,
            received_at: new Date().toISOString()
        }));

        allEvents.push(...enrichedEvents);

        // Save events
        await writeJSON(EVENTS_FILE, allEvents);

        console.log(`[Server] Saved ${events.length} events. Total events: ${allEvents.length}`);

        res.json({
            success: true,
            received: events.length,
            total_events: allEvents.length,
            session_id
        });

    } catch (error) {
        console.error('[Server] Error processing log request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get session data
app.get('/api/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const sessions = await readJSON(SESSIONS_FILE);
        const session = sessions.find(s => s.session_id === sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Get events for this session
        const allEvents = await readJSON(EVENTS_FILE);
        const sessionEvents = allEvents.filter(e => e.session_id === sessionId);

        res.json({
            session,
            events: sessionEvents,
            event_count: sessionEvents.length
        });

    } catch (error) {
        console.error('[Server] Error fetching session:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await readJSON(SESSIONS_FILE);
        res.json({ sessions, count: sessions.length });
    } catch (error) {
        console.error('[Server] Error fetching sessions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export all data as CSV
app.get('/api/export/csv', async (req, res) => {
    try {
        const allEvents = await readJSON(EVENTS_FILE);

        if (allEvents.length === 0) {
            return res.status(404).json({ error: 'No events to export' });
        }

        // Generate CSV
        const headers = [
            'event_id',
            'session_id',
            'participant_id',
            'task_id',
            'event_type',
            'timestamp',
            'query_id',
            'received_at',
            'data'
        ];

        const rows = allEvents.map(event => {
            return [
                event.event_id || '',
                event.session_id || '',
                event.participant_id || '',
                event.task_id || '',
                event.event_type || '',
                event.timestamp || '',
                event.query_id || '',
                event.received_at || '',
                JSON.stringify(event.data || {})
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=events.csv');
        res.send(csv);

    } catch (error) {
        console.error('[Server] Error exporting CSV:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export all data as JSON
app.get('/api/export/json', async (req, res) => {
    try {
        const sessions = await readJSON(SESSIONS_FILE);
        const events = await readJSON(EVENTS_FILE);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=export.json');
        res.json({ sessions, events });

    } catch (error) {
        console.error('[Server] Error exporting JSON:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
async function startServer() {
    await initializeDataFiles();

    app.listen(PORT, () => {
        console.log('='.repeat(60));
        console.log(`[Server] Image Search Behaviour Logger Backend`);
        console.log(`[Server] Running on http://localhost:${PORT}`);
        console.log(`[Server] Data directory: ${DATA_DIR}`);
        console.log('='.repeat(60));
        console.log(`[Server] Endpoints:`);
        console.log(`  - POST /api/log               (Log events)`);
        console.log(`  - GET  /api/sessions          (List all sessions)`);
        console.log(`  - GET  /api/session/:id       (Get session data)`);
        console.log(`  - GET  /api/export/csv        (Export as CSV)`);
        console.log(`  - GET  /api/export/json       (Export as JSON)`);
        console.log(`  - GET  /health                (Health check)`);
        console.log('='.repeat(60));
    });
}

startServer();
