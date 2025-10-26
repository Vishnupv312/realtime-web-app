# Test Suite Documentation

This document describes the unit and integration tests for the WebRTC listener management system.

## Overview

The test suite validates the integration between `SocketService` and the `useWebRTC` hook, focusing on how WebRTC event listeners are managed across socket connections and reconnections.

## Test Files

### 1. `lib/__tests__/socket.test.ts`
**SocketService Unit Tests**

Tests the `SocketService` class focusing on WebRTC listener management functionality.

#### Test Cases

**setWebRTCListenersSetup Method**
- ✓ Stores the provided setup function correctly
- ✓ Does NOT call setup function immediately when socket is not connected
- ✓ Calls setup function immediately when socket is already connected
- ✓ Replaces previous setup function with new one

**WebRTC Listeners on Socket Connect**
- ✓ Calls registered setup function when socket connects
- ✓ Calls registered setup function on reconnect
- ✓ Does NOT call setup function if it was not registered (no errors thrown)
- ✓ Calls setup function multiple times on multiple reconnects

**WebRTC Listeners Lifecycle**
- ✓ Preserves setup function after disconnect
- ✓ Calls setup function after reconnecting following a disconnect

**Integration with Socket Events**
- ✓ Sets up connect event handler that calls WebRTC setup
- ✓ Works correctly when setup function is registered before connect
- ✓ Works correctly when setup function is registered after connect

### 2. `hooks/__tests__/useWebRTC.integration.test.tsx`
**useWebRTC Integration Tests**

Tests the integration between the `useWebRTC` hook and `SocketService`.

#### Test Cases

**WebRTC Listener Registration**
- ✓ Registers `setupSocketListeners` with SocketService on mount
- ✓ Registers all WebRTC event listeners through setupSocketListeners
- ✓ Does not re-register listeners unnecessarily when hook re-renders

**Socket Reconnection Handling**
- ✓ Re-establishes WebRTC listeners after socket reconnects
- ✓ Maintains the same setup function across reconnects
- ✓ Handles multiple reconnect cycles correctly

**WebRTC Event Handler Functionality**
- ✓ Handles webrtc:offer event after registration
- ✓ Handles webrtc:call-end event after registration

**Cleanup and Lifecycle**
- ✓ Does NOT remove WebRTC listeners when hook unmounts (listeners persist)
- ✓ Preserves setup function in SocketService after unmount

**Edge Cases**
- ✓ Handles registration when socket is already connected
- ✓ Handles multiple hook instances gracefully

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test lib/__tests__/socket.test.ts
npm test hooks/__tests__/useWebRTC.integration.test.tsx
```

## Test Coverage

The test suite covers the following scenarios that were causing issues:

1. **SocketService.setWebRTCListenersSetup** correctly stores the provided setup function
2. **SocketService.setWebRTCListenersSetup** immediately calls the setup function if the socket is already connected
3. The registered WebRTC listener setup function is called when the socket connects or reconnects
4. The `useWebRTC` hook successfully registers its `setupSocketListeners` with `SocketService`
5. WebRTC listeners are correctly re-established after a socket reconnection

## Key Testing Patterns

### Mocking Socket.IO
```typescript
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
  id: 'test-socket-id',
}

;(io as jest.Mock).mockReturnValue(mockSocket)
```

### Testing Socket Event Handlers
```typescript
// Get the socket instance that was created
const socketInstance = (socketService as any).socket

// Find the connect handler
const connectHandler = socketInstance.on.mock.calls.find(
  (call: any[]) => call[0] === 'connect'
)?.[1]

// Simulate the event
socketService.isConnected = true
connectHandler()
```

### Testing React Hooks
```typescript
import { renderHook, act } from '@testing-library/react'

const { result } = renderHook(() => useWebRTC())

// Access hook return values
expect(result.current.isCallActive).toBe(false)
```

## Configuration

### Jest Configuration
- `jest.config.js` - Main Jest configuration with Next.js support
- `jest.setup.js` - Global test setup and mocks

### Key Mocks
- Socket.IO client
- js-cookie
- localStorage/sessionStorage
- MediaUtils (to prevent actual media device access)
- useCallLogs hook

## Troubleshooting

### Common Issues

1. **Module not found errors**: Ensure all dependencies are installed with `npm install --legacy-peer-deps`

2. **Authentication errors in tests**: Make sure localStorage mock has the `authToken` set:
   ```typescript
   localStorageMock.setItem('authToken', 'test-auth-token')
   ```

3. **Socket instance not found**: Access the socket through the private property:
   ```typescript
   const socketInstance = (socketService as any).socket
   ```

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Mock external dependencies appropriately
3. Test both success and error cases
4. Ensure tests are isolated and don't depend on execution order
5. Document any non-obvious test patterns or workarounds
