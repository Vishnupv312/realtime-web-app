# Session Expiration Fix

## Problem
When users leave the tab open for several hours, the JWT token and Redis session expire. When the socket tries to reconnect, it receives an error: `"Guest session not found or expired"`. The system didn't handle this gracefully, leaving users with a broken connection.

## Root Cause
The socket error handler only checked for the exact message `"Token has expired"`, but the backend middleware returns `"Guest session not found or expired"` when the Redis session expires. This mismatch meant the automatic session regeneration logic was never triggered.

## Solution

### 1. **Backend - Session Validation on Reconnection** (`backend/src/socket/socketHandlers.js`)
Added validation when users reconnect to check if their chat partner is still online:

```javascript
// Check if guest session has a connected user but that user is no longer online
const guestSession = await getGuestBySessionId(sessionId);
if (guestSession && guestSession.connectedUser) {
  const connectedUserSocketId = userSockets.get(guestSession.connectedUser);
  
  if (!connectedUserSocketId) {
    // Notify the reconnecting user that their chat has closed
    socket.emit('room:closed', {
      userId: guestSession.connectedUser,
      username: 'Your chat partner',
      message: 'The other user has left. Room closed.',
      reason: 'partner_offline'
    });
    
    // Clear the connection in the database
    await updateGuestPresence(sessionId, {
      connectedUser: null,
      inChat: false
    });
  }
}
```

### 2. **Frontend - Enhanced Error Detection** (`web/lib/socket.ts`)
Updated the `connect_error` and `reconnect_error` handlers to detect multiple expiration scenarios:

```typescript
// Handle token/session expiration - check for both JWT expiration and session not found
const isExpiredToken = error.message === "Token has expired"
const isExpiredSession = error.message === "Guest session not found or expired" || 
                        error.message.includes("session not found") ||
                        error.message.includes("expired")

if ((isExpiredToken || isExpiredSession) && !this.isRegeneratingToken) {
  console.log("🔄 Detected expired token/session, regenerating...", error.message)
  await this.handleTokenExpiration()
}
```

### 3. **Automatic Session Regeneration** (`web/lib/socket.ts`)
Enhanced the `handleTokenExpiration()` method:
- Clears all expired session data (token, user session, chat state)
- Creates a new guest session with a fresh JWT token
- Automatically reconnects the socket with the new credentials
- Emits custom events for UI updates
- Falls back to redirecting to home page if regeneration fails

### 4. **UI Notification System** (`web/contexts/GuestSessionContext.tsx`)
Added event listeners to show regeneration status:
- `guest:session:expired` - Sets loading state
- `guest:session:regenerated` - Updates guest user and clears loading state

### 5. **Stale Chat Cleanup** (`web/contexts/ChatContext.tsx`)
Reduced the stale session timeout from 30 seconds to 10 seconds for faster cleanup when returning from sleep/tab switch.

## User Experience

### Before Fix
- User leaves tab open for hours
- Token expires
- Socket fails to reconnect with cryptic error
- User is stuck with broken connection
- Manual page refresh required

### After Fix
- User leaves tab open for hours
- Token expires
- Socket automatically detects expiration
- New session created in background (< 1 second)
- Socket reconnects automatically
- User sees brief "Regenerating session..." message
- Everything continues working seamlessly

## Testing

To test this fix:

1. **Manual Testing:**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend
   cd web && npm run dev
   ```

2. **Simulate Token Expiration:**
   - Open the app and create a guest session
   - Open browser DevTools > Application > Session Storage
   - Delete the `guestAuthToken` item
   - Wait for socket to try reconnecting (or refresh)
   - Should automatically create new session

3. **Simulate Long Idle:**
   - Set `JWT_EXPIRES_IN=1m` in backend `.env` (1 minute expiry)
   - Restart backend
   - Create guest session
   - Wait 2 minutes
   - Socket should auto-regenerate session

## Files Modified

### Backend
- `backend/src/socket/socketHandlers.js` - Added connection validation

### Frontend
- `web/lib/socket.ts` - Enhanced error detection and regeneration
- `web/contexts/GuestSessionContext.tsx` - Added UI event listeners
- `web/contexts/ChatContext.tsx` - Reduced stale session timeout

## Configuration

Default JWT expiration is 7 days (configured in `.env`):
```env
JWT_EXPIRES_IN=7d
```

For production, consider:
- Longer expiration for better UX: `JWT_EXPIRES_IN=30d`
- Session refresh tokens for security
- Persistent Redis storage with longer TTL
