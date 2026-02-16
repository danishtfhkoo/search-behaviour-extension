# Debugging Checklist - Events Not Recording

Please check the following in order and tell me what you see:

## 1. Service Worker Console

Go to `chrome://extensions/` → Click "service worker" link

**What do you see?**
- [ ] `[Background] Utils loaded successfully`
- [ ] `[Background] All utility functions verified`
- [ ] `[Background] Service worker initialized`
- [ ] Any RED error messages?

**Copy all the text from the service worker console here:**
```
[paste here]
```

---

## 2. Start Session Test

With service worker console still open:

1. Click extension icon
2. Enter `TEST001` and `DEMO`
3. Click "Start Session"

**What happens?**
- [ ] Popup shows "Session Active" view
- [ ] Timer starts counting
- [ ] Service worker console shows: `[Background] Received message: START_SESSION`
- [ ] Service worker console shows: `[Background] Session started: ...`

**Any errors?**
```
[paste here]
```

---

## 3. Popup Console

RIGHT-CLICK the extension icon → "Inspect Popup"

This opens DevTools for the popup.

**What do you see in the Console tab?**
```
[paste here]
```

---

## 4. Chrome Storage Check

In the popup DevTools console, type:

```javascript
chrome.storage.local.get(null, (data) => console.log(data))
```

**What does it print?**
```
[paste here]
```

---

## 5. Manual Session Start Test

In the **service worker console**, type:

```javascript
handleStartSession({ participantId: 'TEST', taskId: 'DEBUG' })
```

**What does it return?**
```
[paste here]
```

---

## 6. Check Function Availability

In the **service worker console**, type each command:

```javascript
typeof generateId
typeof getSessionState  
typeof sendEvents
```

**Results:**
- generateId: `[result]`
- getSessionState: `[result]`
- sendEvents: `[result]`

(Should all say "function")

---

## 7. Google Images Page Console

1. Open Google Images: https://www.google.com/search?q=test&tbm=isch
2. Open DevTools (F12) → Console tab

**What do you see?**
```
[paste here]
```

---

Please share the results and I'll tell you exactly where the issue is!
