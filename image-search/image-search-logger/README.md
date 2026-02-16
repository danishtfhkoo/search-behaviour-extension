# Image Search Behaviour Logger

A Chrome extension for logging user behavior during Google Images search sessions, designed for doctoral/MSc thesis research.

## Features

- **Session Management**: Track research sessions with participant and task IDs
- **Query Logging**: Automatically log search queries and reformulations
- **Image Interaction Tracking**: Record clicks, opens, and interactions with images
- **Save Mechanism**: Custom save button + keyboard shortcut (S key) to mark important images
- **Dwell Time Tracking**: Measure time spent viewing images
- **Scroll Depth**: Track how far users scroll in results
- **Backend Integration**: Batch send events to backend server
- **Local Export**: Download session logs as JSON if backend is unavailable

## Installation

### 1. Install the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `image-search-logger` directory
5. The extension icon should appear in your toolbar

### 2. Enable Incognito Mode (Required for Research)

1. Go to `chrome://extensions/`
2. Find "Image Search Behaviour Logger"
3. Click "Details"
4. Scroll down and enable "Allow in incognito"

### 3. Start the Backend Server

```bash
cd image-search-backend
node server.js
```

The server will start on `http://localhost:3000`

## Usage

### For Participants

1. **Open the extension popup** (click the icon in toolbar)
2. **Enter your details**:
   - Participant ID (e.g., `P001`)
   - Task/Condition ID (e.g., `TASK1`)
3. **Click "Start Session"**
4. **Navigate to Google Images** and perform your search tasks
5. **Use the Save feature**:
   - Click the purple "Save" button that appears on image previews, OR
   - Press the `S` key while viewing an image
6. **End the session** when complete:
   - Click "End Session" in the popup
   - All data will be automatically sent to the server
7. **(Optional) Export logs**:
   - Click "Export Logs" to download a local JSON file

### For Researchers

#### View Live Statistics

Open the extension popup during an active session to see:
- Number of queries
- Number of saves
- Total events logged
- Session duration

#### Access Backend Data

The backend server stores data in two files:
- `image-search-backend/data/sessions.json` - Session metadata
- `image-search-backend/data/events.json` - All logged events

#### Export Data

**CSV Export:**
```bash
curl http://localhost:3000/api/export/csv -o events.csv
```

**JSON Export:**
```bash
curl http://localhost:3000/api/export/json -o export.json
```

**Or visit in browser:**
- http://localhost:3000/api/export/csv
- http://localhost:3000/api/export/json

#### API Endpoints

- `GET /health` - Health check
- `POST /api/log` - Log events (used by extension)
- `GET /api/sessions` - List all sessions
- `GET /api/session/:id` - Get specific session data
- `GET /api/export/csv` - Export all data as CSV
- `GET /api/export/json` - Export all data as JSON

## Event Types

The extension logs the following event types:

### Query Event
```json
{
  "event_type": "query",
  "query_id": 1,
  "data": {
    "query_text": "modern architecture",
    "query_length_char": 19,
    "query_length_tokens": 2,
    "previous_query": null
  }
}
```

### Image Click Event
```json
{
  "event_type": "image_click",
  "query_id": 1,
  "data": {
    "image_url": "https://example.com/image.jpg",
    "thumbnail_url": "...",
    "source_page_url": "https://example.com",
    "domain": "example.com",
    "rank_index": 5
  }
}
```

### Save Event
```json
{
  "event_type": "save",
  "query_id": 1,
  "data": {
    "query_text": "modern architecture",
    "image_url": "...",
    "source_page_url": "...",
    "domain": "...",
    "rank_index": 5,
    "alt_text": "...",
    "result_title": "..."
  }
}
```

### Dwell Event
```json
{
  "event_type": "dwell",
  "query_id": 1,
  "data": {
    "url": "https://example.com",
    "dwell_time_ms": 5432
  }
}
```

## Data Structure

All events are sent in batches:

```json
{
  "session_id": "uuid",
  "participant_id": "P001",
  "task_id": "TASK1",
  "events": [...]
}
```

## Privacy & Ethics

This extension:
- ✅ Only tracks Google Images interactions
- ✅ Does NOT collect keystrokes outside Google domains
- ✅ Does NOT download image files
- ✅ Does NOT log unrelated browsing
- ✅ Requires explicit session start (informed consent)
- ✅ Allows local export if backend fails

## Troubleshooting

**Extension not tracking:**
- Ensure you've started a session via the popup
- Check that you're on a Google Images page (URL should contain `tbm=isch`)
- Check browser console for errors

**Save button not appearing:**
- Make sure an image preview is open
- Try pressing the `S` keyboard shortcut instead
- Check that session is active

**Backend not receiving data:**
- Ensure backend server is running (`node server.js`)
- Check that server is on `http://localhost:3000`
- Events are batched every 30 seconds or 50 events
- Export logs manually if backend is unavailable

**Icons not displaying:**
- If you see placeholder icons, generate PNGs from the SVG:
  - Install librsvg: `brew install librsvg`
  - Run the icon generation command in the README

## Development

### Project Structure

```
image-search-logger/
├── manifest.json              # Extension configuration
├── popup/                     # Session management UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/                   # Google Images tracking
│   ├── content.js
│   └── content.css
├── background/                # Service worker
│   └── service-worker.js
├── utils/                     # Shared utilities
│   ├── logger.js
│   ├── storage.js
│   └── api.js
└── icons/                     # Extension icons
    ├── icon.svg
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Backend Structure

```
image-search-backend/
├── server.js                  # Express server
├── data/                      # Data storage
│   ├── sessions.json
│   └── events.json
└── package.json
```

## License

This is research software. Please ensure you have proper ethics approval and informed consent before collecting data.

## Support

For issues or questions, please contact the research team.
