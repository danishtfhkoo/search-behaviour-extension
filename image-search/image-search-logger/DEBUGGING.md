# Quick Debugging Steps

## Step 1: Check Service Worker Status

1. Go to `chrome://extensions/`
2. Find "Image Search Behaviour Logger"
3. Look for **"service worker"** link (it should say "service worker" or "Inspect views: service worker")
4. Click on it to open the service worker console

**What to look for:**
- Should see: `[Background] Service worker initialized`
- If you see errors about `generateId is not defined` or `getSessionState is not defined`, the fix didn't work
- If the console is blank, the service worker might not have loaded

## Step 2: Test in Service Worker Console

In the service worker console, type these commands one by one:

```javascript
// Test if functions are defined
typeof generateId
// Should return: "function"

typeof getSessionState
// Should return: "function"

typeof sendEvents
// Should return: "function"
```

If any return `"undefined"`, the importScripts failed.

## Step 3: Check importScripts

In service worker console:

```javascript
// This shows what's in global scope
Object.keys(this).filter(k => k.includes('Session') || k.includes('Event') || k.includes('generate'))
```

Should see output like: `['getSessionState', 'setSessionState', 'generateId', ...]`

## Step 4: Manual Test

In service worker console, try manually starting a session:

```javascript
handleStartSession({ participantId: 'TEST', taskId: 'DEBUG' })
  .then(result => console.log('Result:', result))
```

Should return: `{ success: true, sessionState: {...} }`

## Step 5: Check Popup Console

1. Right-click the extension icon
2. Select "Inspect Popup"
3. This opens DevTools for the popup
4. Try starting a session
5. Look for errors in this console

## Common Errors & Fixes

### Error: "generateId is not defined"
**Problem:** importScripts didn't load utils properly  
**Fix:**
```javascript
// In service worker, manually define it:
function generateId() {
  return crypto.randomUUID();
}
```

### Error: "Cannot read property 'success' of undefined"
**Problem:** Message handler not responding  
**Check:** Service worker console for errors in handleStartSession

### Error: "Extension context invalidated"
**Problem:** Extension was reloaded while popup was open  
**Fix:** Close popup and open it again

### No response from background
**Problem:** Service worker might be inactive  
**Check:** Go to chrome://extensions and see if service worker shows "inactive"  
**Fix:** Click on the service worker link to wake it up

## Nuclear Option: Complete Reset

If nothing works:

1. **Remove extension:**
   - Go to `chrome://extensions/`
   - Click "Remove"

2. **Clear extension storage:**
   ```javascript
   // In browser console:
   chrome.storage.local.clear()
   ```

3. **Reload extension:**
   - Click "Load unpacked"
   - Select extension folder again

4. **Check service worker immediately:**
   - Click "service worker" link
   - Should see initialization message
