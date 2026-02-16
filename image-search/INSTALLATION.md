# Installation & Testing Guide

## Quick Start

### 1. Start the Backend Server

```bash
cd image-search-backend
node server.js
```

You should see:
```
============================================================
[Server] Image Search Behaviour Logger Backend
[Server] Running on http://localhost:3000
...
============================================================
```

Keep this terminal window open.

---

### 2. Install the Chrome Extension

1. Open Chrome and go to: `chrome://extensions/`
2. Toggle **"Developer mode"** ON (top-right corner)
3. Click **"Load unpacked"**
4. Navigate to and select: `/Users/danish/.gemini/antigravity/scratch/image-search-logger`
5. The extension should now appear in your extensions list

---

### 3. Enable Incognito Mode (IMPORTANT)

1. In `chrome://extensions/`, find **"Image Search Behaviour Logger"**
2. Click **"Details"**
3. Scroll down to **"Allow in incognito"** and enable it
4. This ensures clean, isolated testing sessions

---

### 4. Test the Extension

#### A. Start a Session

1. Click the extension icon in Chrome toolbar
2. Enter test credentials:
   - **Participant ID**: `TEST001`
   - **Task ID**: `DEMO`
3. Click **"Start Session"**
4. You should see:
   - Session status: "Active"
   - Timer starts counting
   - Stats show: 0 queries, 0 saves, 0 events

#### B. Navigate to Google Images

1. Open a new tab
2. Go to: https://www.google.com/search?q=modern+architecture&tbm=isch
3. Check browser console (F12) - you should see:
   ```
   [Content] On Google Images, initializing...
   [Content] Session is active
   [Content] Query logged: modern architecture
   ```

#### C. Click an Image

1. Click on any image in the grid
2. Check console - you should see:
   ```
   [Content] Image clicked: {...}
   ```

#### D. Use Save Feature

**Option 1: Save Button**
1. When image preview opens, look for purple "Save (S)" button (top-right)
2. Click it
3. You should see a green notification: "Image saved!"

**Option 2: Keyboard Shortcut**
1. With image preview open, press the **S** key
2. You should see the same green notification

#### E. Check Extension Popup

1. Click extension icon again
2. You should see updated stats:
   - Queries: 1+
   - Saves: 1+ (if you used save)
   - Events: 3+ (query + clicks + saves)
   - Timer still running

#### F. End Session

1. In popup, click **"End Session"**
2. Confirm the dialog
3. You should see: "Session ended successfully. X events were sent to the server."

---

### 5. Verify Backend Received Data

#### Check Server Console

Look at the server terminal - you should see:
```
[Server] Received X events from session ...
[Server] Saved X events. Total events: X
```

#### Check Data Files

```bash
cd image-search-backend/data
cat sessions.json
cat events.json
```

You should see:
- `sessions.json`: Your session metadata
- `events.json`: All logged events (query, image_click, save, etc.)

#### Use API Endpoints

```bash
# Get all sessions
curl http://localhost:3000/api/sessions

# Get specific session (copy session_id from above)
curl http://localhost:3000/api/session/YOUR_SESSION_ID

# Export as CSV
curl http://localhost:3000/api/export/csv -o test-export.csv

# Export as JSON
curl http://localhost:3000/api/export/json -o test-export.json
```

---

### 6. Test Export Feature

1. Start another session in the extension
2. Do some searches and saves
3. In the popup, click **"Export Logs"**
4. A JSON file will download: `session-logs-{id}-{timestamp}.json`
5. Open it to verify all events are captured

---

## Troubleshooting

### Extension not appearing after load
- Make sure you selected the `image-search-logger` folder (not a parent folder)
- Check for errors in `chrome://extensions/`
- Reload the extension

### Save button not showing
- Make sure you've started a session
- Ensure you're on a Google Images page (`tbm=isch` in URL)
- Try pressing **S** key instead
- Check browser console for errors

### Backend not receiving events
- Verify server is running on port 3000
- Check server console for errors
- Events are batched every 30 seconds or when 50 events accumulate
- Try ending the session to force a flush

### Console errors
- Open DevTools (F12) → Console tab
- Check for JavaScript errors
- Common issues:
  - CORS errors → server not running
  - Permission errors → not on Google domain
  - Undefined errors → check session is active

---

## Testing Checklist

Use this checklist for thorough testing:

- [ ] Backend server starts without errors
- [ ] Extension loads in Chrome
- [ ] Incognito mode enabled
- [ ] Can start session with participant/task IDs
- [ ] Timer starts counting
- [ ] Navigate to Google Images (URL has `tbm=isch`)
- [ ] Query is automatically logged (check console)
- [ ] Clicking images logs events
- [ ] Save button appears on preview
- [ ] Save button click works
- [ ] Keyboard shortcut (S) works
- [ ] Green notification shows on save
- [ ] Popup stats update in real-time
- [ ] Can end session successfully
- [ ] Backend receives events (check server console)
- [ ] Data files created (`sessions.json`, `events.json`)
- [ ] Can export logs as JSON from popup
- [ ] API endpoints work (curl tests)

---

## Next Steps

Once everything works:

1. **Icon Generation** (if needed):
   ```bash
   cd image-search-logger
   brew install librsvg
   rsvg-convert -w 128 -h 128 icons/icon.svg > icons/icon128.png
   rsvg-convert -w 48 -h 48 icons/icon.svg > icons/icon48.png
   rsvg-convert -w 16 -h 16 icons/icon.svg > icons/icon16.png
   ```

2. **Prepare for Real Study**:
   - Test with actual participants (pilot study)
   - Verify all event types are captured
   - Check data quality in exported CSV/JSON
   - Ensure ethics approval and informed consent

3. **Future Enhancements (v2)**:
   - Impression tracking (IntersectionObserver)
   - Enhanced scroll depth tracking
   - More detailed rank estimation
   - UI improvements based on feedback
