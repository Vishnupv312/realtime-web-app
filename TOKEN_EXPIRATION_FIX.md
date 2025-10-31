# Token Expiration Fix

## Problem
When users closed the browser and reopened the website, they encountered a "Token has expired" error. The old JWT token remained in `sessionStorage`, and when the socket tried to reconnect with this expired token, the backend rejected the connection.

## Root Cause Analysis

1. **Token Storage**: JWT tokens were stored in `sessionStorage` and persisted across browser sessions
2. **Token Lifetime**: Guest tokens expire after 2 hours (set in `backend/src/controllers/guestController.js` line 49)
3. **No Validation on Load**: The frontend didn't validate token expiration before attempting to connect
4. **No Socket Error Handling**: Socket connection errors for expired tokens weren't handled, unlike HTTP API errors which had proper 401 handling

## Solution Implemented

### 1. Token Validation on Page Load (`web/contexts/GuestSessionContext.tsx`)

Added JWT token expiration check when restoring session from `sessionStorage`:
- Decodes the JWT token to extract the `exp` (expiration) claim
- Compares expiration time with current time
- Clears expired tokens automatically before attempting connection
- Only restores session if token is still valid

```typescript
// Check if token is expired by decoding the JWT
const tokenParts = storedToken.split('.')
if (tokenParts.length === 3) {
  const payload = JSON.parse(atob(tokenParts[1]))
  const expirationTime = payload.exp * 1000 // Convert to milliseconds
  const currentTime = Date.now()
  
  if (expirationTime < currentTime) {
    console.log('⚠️ Stored token has expired, clearing session')
    sessionStorage.removeItem('guest_user_session')
    sessionStorage.removeItem('guestAuthToken')
    return null
  }
}
```

### 2. Socket Connection Error Handling (`web/lib/socket.ts`)

Added automatic token regeneration when socket connection fails due to expired token:
- Detects "Token has expired" error from backend
- Automatically clears expired session data
- Creates a new guest session with fresh JWT token
- Reconnects socket with new credentials
- Prevents infinite loops with `isRegeneratingToken` flag

```typescript
this.socket.on("connect_error", async (error) => {
  // Handle token expiration
  if (error.message === "Token has expired" && !this.isRegeneratingToken) {
    console.log("🔄 Detected expired token on socket connection, regenerating...")
    await this.handleTokenExpiration()
  }
})
```

### 3. Session Synchronization (`web/contexts/GuestSessionContext.tsx`)

Added periodic session sync to ensure React state matches `sessionStorage`:
- Checks every 2 seconds if session data changed (e.g., from socket regeneration)
- Updates React state when socket service regenerates the session
- Maintains consistency between socket service and React context

## Benefits

1. **No More Token Errors**: Users won't see "Token has expired" errors on reconnection
2. **Seamless Experience**: Automatic session regeneration is transparent to users
3. **Faster Load**: Invalid tokens are detected before connection attempt
4. **Better UX**: New session is created automatically with minimal delay
5. **Consistent State**: React context stays in sync with socket service regeneration

## Testing Recommendations

1. **Manual Expiration Test**:
   - Create a guest session
   - Manually edit token expiration in sessionStorage to be in the past
   - Reload page and verify automatic session regeneration

2. **Browser Close Test**:
   - Create a guest session
   - Wait 2+ hours (or temporarily change token expiration to 1 minute)
   - Close and reopen browser
   - Verify new session is created automatically

3. **Connection Recovery**:
   - Start a chat session
   - Disconnect network
   - Change token expiration in sessionStorage
   - Reconnect network
   - Verify socket reconnects with new token

## Files Modified

1. `web/lib/socket.ts`:
   - Added `handleTokenExpiration()` method
   - Added token regeneration in `connect_error` handler
   - Added `isRegeneratingToken` flag

2. `web/contexts/GuestSessionContext.tsx`:
   - Added JWT expiration validation on page load
   - Added `checkSessionSync()` for periodic synchronization
   - Added `sessionSyncInterval` for automatic state updates

## Future Improvements

1. **Token Refresh**: Implement token refresh before expiration (proactive renewal)
2. **Expiration Warning**: Show user notification when token is about to expire
3. **Session Persistence**: Consider using refresh tokens for longer-lived sessions
4. **Background Sync**: Use Service Worker for background token validation
