# Backend Server for Image Search Behaviour Logger

Simple Express.js server for receiving and storing event logs from the Chrome extension.

## Quick Start

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

## Data Storage

All data is stored in JSON files:
- `data/sessions.json` - Session metadata
- `data/events.json` - All logged events

## API Endpoints

### Health Check
```
GET /health
```

### Log Events (Used by Extension)
```
POST /api/log
Content-Type: application/json

{
  "session_id": "uuid",
  "participant_id": "P001",
  "task_id": "TASK1",
  "events": [...]
}
```

### Get All Sessions
```
GET /api/sessions
```

### Get Specific Session
```
GET /api/session/:sessionId
```

### Export Data

**CSV Export:**
```
GET /api/export/csv
```

**JSON Export:**
```
GET /api/export/json
```

## Example Usage

```bash
# Start server
npm start

# View all sessions
curl http://localhost:3000/api/sessions

# Export as CSV
curl http://localhost:3000/api/export/csv -o events.csv

# Export as JSON
curl http://localhost:3000/api/export/json -o export.json
```

## Development

```bash
# Install dev dependencies
npm install

# Run with auto-reload
npm run dev
```
