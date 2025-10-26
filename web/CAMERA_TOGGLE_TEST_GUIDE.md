# Camera Toggle Test Guide

## What Was Fixed

### Issue 1: Remote User Sees Black Screen
When you turn off your camera, the remote user now sees a placeholder with your avatar instead of a black screen.

**Technical Fix:**
- Changed detection to use both `videoTrack.enabled` AND `videoTrack.muted` properties
- Added event listeners for `mute` and `unmute` events on the video track
- Added polling as a backup mechanism (200ms intervals)
- The `mute` event fires when a track stops sending data, which happens when `enabled = false`

### Issue 2: Local Preview Doesn't Restore
When you turn the camera back on, your local preview now properly shows your video again.

**Technical Fix:**
- Force refresh the video element by temporarily clearing and resetting `srcObject`
- Added 50ms delay to ensure the browser processes the change
- Explicitly call `play()` after restoring the stream

## How to Test

### Prerequisites
1. Start the backend server (port 3001)
2. Start the web frontend (port 3000)
3. Open two browser windows/tabs (or use two devices)

### Test Steps

#### Test 1: Local Preview Placeholder
1. Start a video call between User A and User B
2. On User A's side, click the camera toggle button (turn camera OFF)
3. **Expected:** User A's local preview (small overlay) shows:
   - Their avatar with initials
   - A camera-off icon
   - Gradient background
4. Click the camera toggle button again (turn camera ON)
5. **Expected:** User A's local preview shows their video feed again

#### Test 2: Remote User Sees Placeholder
1. Start a video call between User A and User B
2. On User A's side, turn camera OFF
3. **Expected:** User B sees (on the main screen):
   - User A's avatar with initials
   - User A's username
   - "Camera is off" message with icon
   - Gradient background
4. On User A's side, turn camera ON
5. **Expected:** User B sees User A's video feed resume

#### Test 3: Console Logs Verification
Open browser console and watch for these logs:

**When turning camera OFF:**
```
📹 Video disabled
📺 Remote video track MUTED event fired
📺 Remote video state changed (poll): enabled=false, muted=true, showing=false
```

**When turning camera ON:**
```
📹 Video enabled
📹 Local video state changed - isVideoOff: false, track.enabled: true
📹 Refreshing local video preview...
📹 Local video preview restored
📺 Remote video track UNMUTED event fired
📺 Remote video state changed (poll): enabled=true, muted=false, showing=true
```

### Test Matrix

| Scenario | User A Action | User A Local Preview | User B Remote View |
|----------|---------------|---------------------|-------------------|
| 1 | Turn camera OFF | Shows avatar + icon | Shows avatar + "Camera is off" |
| 2 | Turn camera ON | Shows video feed | Shows video feed |
| 3 | Toggle OFF → ON → OFF | Transitions correctly | Transitions correctly |
| 4 | Multiple rapid toggles | Handles without breaking | Handles without breaking |

### Browser Testing

Test on multiple browsers:
- [ ] Chrome/Chromium (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Safari (iOS)
- [ ] Chrome (Android)

### Known Behaviors

1. **Mute vs Enabled:**
   - `track.enabled = false` tells WebRTC to stop sending video data
   - This triggers the `mute` event on the remote track
   - The track is still "live" but sends no frames (appears black if not handled)

2. **Event Firing:**
   - The `mute` event should fire immediately when remote user toggles camera off
   - Polling provides backup in case events don't fire (browser differences)

3. **Video Element Refresh:**
   - Some browsers cache the last frame when a track is disabled
   - Clearing and resetting `srcObject` forces the element to refresh

## Debugging

If the placeholder doesn't show:

1. **Check Console Logs:**
   ```javascript
   // Look for these patterns
   "📺 Remote video state changed"
   "📺 Remote video track MUTED event fired"
   ```

2. **Check Track State:**
   ```javascript
   // In browser console on receiver side
   const videoTrack = remoteStream.getVideoTracks()[0]
   console.log({
     enabled: videoTrack.enabled,
     muted: videoTrack.muted,
     readyState: videoTrack.readyState
   })
   ```

3. **Verify Polling:**
   - Polling runs every 200ms
   - Should catch state changes even if events don't fire

If local preview doesn't restore:

1. **Check Console Logs:**
   ```javascript
   "📹 Refreshing local video preview..."
   "📹 Local video preview restored"
   ```

2. **Check Video Element:**
   ```javascript
   // In browser console
   const video = localVideoRef.current
   console.log({
     srcObject: video.srcObject,
     paused: video.paused,
     readyState: video.readyState
   })
   ```

## Code Changes Summary

### Files Modified:
1. `components/VideoCallModal.tsx`
   - Enhanced remote video track monitoring (lines 104-158)
   - Added mute/unmute event listeners
   - Improved local video refresh logic (lines 76-102)
   - Added comprehensive logging

2. `app/chat/page.tsx`
   - Pass `currentUserId` to VideoCallModal (line 1151)

### Key Functions:
- **Remote Detection:** Uses `mute`/`unmute` events + polling
- **Local Refresh:** Clears and resets `srcObject` with 50ms delay
- **State Management:** Uses `setIsRemoteVideoEnabled` and `isVideoOff`

## Rollback Instructions

If issues occur, revert these commits:
```bash
git log --oneline -3  # Find the commit hash
git revert <commit-hash>
```

Or manually revert by checking out the previous version:
```bash
git checkout HEAD~1 -- components/VideoCallModal.tsx app/chat/page.tsx
```
