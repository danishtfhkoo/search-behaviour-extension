# CRITICAL: Extension Not Loading

## The Problem

The error `Cannot read properties of undefined (reading 'sendMessage')` means the Chrome extension API (`chrome.runtime`) is **not available** to the content script.

This is a **FUNDAMENTAL** problem - the extension isn't loading correctly.

## Debugging Steps

### 1. Check Extension Status

Go to `chrome://extensions/` and answer:

- [ ] Is "Image Search Behaviour Logger" visible?
- [ ] Is it **enabled** (blue toggle)?
- [ ] Does it show a **red "Errors" button**?
- [ ] Does it say "service worker (inactive)" or "service worker"?

**If there's a red "Errors" button, click it and copy ALL errors here.**

---

### 2. Check Icon Files Exist

The extension requires icon files. Check if they exist:

```bash
ls -la /Users/danish/.gemini/antigravity/scratch/image-search-logger/icons/
```

**Expected output:**
```
icon16.png
icon48.png
icon128.png
icon.svg
```

If the PNG files are **missing**, that's the problem!

---

### 3. Try Reloading Extension

1. Go to `chrome://extensions/`
2. Click **"Remove"** on "Image Search Behaviour Logger"
3. Click **"Load unpacked"**
4. Select: `/Users/danish/.gemini/antigravity/scratch/image-search-logger`

**Does it show an error?** If yes, copy the exact error message.

---

### 4. Check Service Worker Console

If extension loads:

1. Click "service worker" link
2. Look for these messages:
   ```
   [Background] Utils loaded successfully
   [Background] All utility functions verified
   [Background] Service worker initialized
   ```

**Do you see these?** Or do you see errors?

---

### 5. Test in Incognito (to rule out conflicts)

1. `chrome://extensions/`
2. Find "Image Search Behaviour Logger"
3. Click **"Details"**
4. Enable **"Allow in incognito"**
5. Open incognito window
6. Open diagnostic.html
7. Run tests

**Does it work in incognito?**

---

## Most Likely Causes

### Cause A: Missing Icon Files
**Solution:** The PNG icons might be missing. Run:
```bash
cd /Users/danish/.gemini/antigravity/scratch/image-search-logger/icons
ls -la
```

### Cause B: Extension Not Actually Loaded
**Solution:** Remove and reload the extension completely

### Cause C: Chrome Cache Issue
**Solution:** 
1. Close Chrome completely
2. Reopen Chrome
3. Load extension fresh

### Cause D: Conflicting Extension
**Solution:** Disable all other extensions temporarily

---

## Next Steps

Please run item **#1** and **#2** from above and tell me:
1. What you see in chrome://extensions
2. If icon PNG files exist
