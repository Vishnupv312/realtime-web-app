# Token Expiration Fix - Test Documentation

## Test Files Created

### 1. Socket Service Token Expiration Tests
**File**: `web/lib/__tests__/socket.token-expiration.test.ts`

Comprehensive unit tests for the socket service's token expiration handling.

#### Test Coverage

**Token Expiration Detection (3 tests)**
- ✓ Detects "Token has expired" error on connect_error
- ✓ Clears expired token and session data
- ✓ Does NOT trigger regeneration for non-expiration errors

**Token Regeneration (3 tests)**
- ✓ Generates new username with correct format (AdjectiveNounNumber)
- ✓ Reconnects socket after successful regeneration
- ✓ Updates currentUser with new credentials

**Regeneration Loop Prevention (2 tests)**
- ✓ Prevents concurrent regeneration attempts
- ✓ Resets regeneration flag after completion

**Regeneration Failure Handling (3 tests)**
- ✓ Handles API failure gracefully
- ✓ Handles invalid API response
- ✓ Handles missing API response token

**Device ID Persistence (2 tests)**
- ✓ Uses existing device ID during regeneration
- ✓ Handles missing device ID gracefully

**Total: 13 tests**

---

### 2. GuestSessionContext Token Validation Tests
**File**: `web/contexts/__tests__/GuestSessionContext.token-validation.test.tsx`

Tests for token validation on page load and session synchronization.

#### Test Coverage

**Token Expiration Validation on Load (5 tests)**
- ✓ Restores valid session with non-expired token
- ✓ Clears expired token and does not restore session
- ✓ Detects token expiring soon (within 1 minute)
- ✓ Handles malformed JWT token gracefully
- ✓ Handles JWT with invalid payload structure

**Incomplete Session Data Cleanup (3 tests)**
- ✓ Clears session if token exists but session data is missing
- ✓ Clears token if session data exists but token is missing
- ✓ Handles corrupted session data JSON

**Session Synchronization (1 test)**
- ✓ Syncs guest user when session changes in storage (from socket regeneration)

**Session Creation (2 tests)**
- ✓ Creates new session when none exists
- ✓ Stores token in sessionStorage after creation

**Clear Session (1 test)**
- ✓ Clears both token and session data

**Total: 12 tests**

---

## Running the Tests

### Run All Token Expiration Tests

```bash
cd web

# Run socket service token tests
npm test -- socket.token-expiration.test.ts

# Run context token validation tests
npm test -- GuestSessionContext.token-validation.test.tsx

# Run all tests with coverage
npm test -- --coverage --collectCoverageFrom="lib/socket.ts" --collectCoverageFrom="contexts/GuestSessionContext.tsx"
```

### Run Tests in Watch Mode

```bash
# Watch socket tests
npm test -- socket.token-expiration.test.ts --watch

# Watch context tests
npm test -- GuestSessionContext.token-validation.test.tsx --watch
```

### Run Tests with Verbose Output

```bash
npm test -- socket.token-expiration.test.ts --verbose
npm test -- GuestSessionContext.token-validation.test.tsx --verbose
```

---

## Test Structure

### Socket Service Tests

```typescript
describe('SocketService - Token Expiration Handling', () => {
  describe('Token Expiration Detection', () => { ... })
  describe('Token Regeneration', () => { ... })
  describe('Regeneration Loop Prevention', () => { ... })
  describe('Regeneration Failure Handling', () => { ... })
  describe('Device ID Persistence', () => { ... })
})
```

### Context Tests

```typescript
describe('GuestSessionContext - Token Validation', () => {
  describe('Token Expiration Validation on Load', () => { ... })
  describe('Incomplete Session Data Cleanup', () => { ... })
  describe('Session Synchronization', () => { ... })
  describe('Session Creation', () => { ... })
  describe('Clear Session', () => { ... })
})
```

---

## Key Test Utilities

### Mock JWT Token Generator

```typescript
const createMockToken = (expiresInSeconds: number): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    userId: 'guest_test_123',
    username: 'TestUser',
    isGuest: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }))
  const signature = 'mock-signature'
  return `${header}.${payload}.${signature}`
}
```

**Usage:**
- `createMockToken(7200)` - Valid token (2 hours)
- `createMockToken(-3600)` - Expired token (1 hour ago)
- `createMockToken(30)` - Expiring soon (30 seconds)

### Storage Mocks

```typescript
const createStorageMock = () => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value }),
    removeItem: jest.fn((key: string) => { delete store[key] }),
    clear: jest.fn(() => { store = {} }),
    get store() { return store },
    set store(value: Record<string, string>) { store = value },
  }
}
```

---

## Manual Testing Scenarios

### Scenario 1: Expired Token on Page Load

1. Open DevTools → Application → Session Storage
2. Find `guestAuthToken` and `guest_user_session`
3. Edit the token to set expiration to the past:
   ```javascript
   // Decode current token
   const parts = sessionStorage.getItem('guestAuthToken').split('.')
   const payload = JSON.parse(atob(parts[1]))
   
   // Create expired token
   payload.exp = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
   const newPayload = btoa(JSON.stringify(payload))
   const expiredToken = `${parts[0]}.${newPayload}.${parts[2]}`
   
   // Store expired token
   sessionStorage.setItem('guestAuthToken', expiredToken)
   ```
4. Reload the page
5. **Expected**: Session is cleared, new session created automatically

### Scenario 2: Token Expires During Socket Connection

1. Create a guest session
2. Wait for token to expire (or manually expire it)
3. Disconnect and reconnect network
4. **Expected**: Socket detects expired token, regenerates session, reconnects

### Scenario 3: Concurrent Expiration Handling

1. Modify backend to return expired token error
2. Trigger multiple operations simultaneously (match, send message, etc.)
3. **Expected**: Only one regeneration attempt, all operations retry with new token

---

## Coverage Goals

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| `lib/socket.ts` | > 85% | > 80% | > 85% | > 85% |
| `contexts/GuestSessionContext.tsx` | > 80% | > 75% | > 80% | > 80% |

---

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Token Expiration Tests
  run: |
    cd web
    npm test -- socket.token-expiration.test.ts
    npm test -- GuestSessionContext.token-validation.test.tsx
```

---

## Troubleshooting Tests

### Issue: Tests timeout

**Solution**: Increase Jest timeout in test file:
```typescript
jest.setTimeout(10000) // 10 seconds
```

### Issue: Storage mocks not working

**Solution**: Ensure mocks are defined before importing modules:
```typescript
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock })
// THEN import modules
import socketService from '../socket'
```

### Issue: Async operations not completing

**Solution**: Use `await waitFor()` for async state changes:
```typescript
await waitFor(() => {
  expect(result.current.guestUser).toBeTruthy()
}, { timeout: 3000 })
```

---

## Next Steps

1. **Run Tests**: Execute both test suites to verify functionality
2. **Check Coverage**: Ensure coverage meets goals
3. **Manual Testing**: Test scenarios in browser
4. **Integration Testing**: Test with real backend
5. **Monitor Production**: Watch for token expiration errors in logs
