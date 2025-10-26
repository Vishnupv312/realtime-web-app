# Socket Handler Tests

Comprehensive test suite for the Socket.IO event handlers in the realtime chat backend.

## Overview

This test suite covers all major socket event handlers with focus on:
- Connection lifecycle management
- User matching and room creation
- Chat messaging (text, file, voice)
- WebRTC signaling (offer, answer, ICE candidates)
- Error handling and edge cases

## Test Files

### `socketHandlers.connection.test.js`
Tests for connection management:
- **Connection establishment**: Socket connection, presence updates, stats broadcasting
- **Disconnection handling**: Cleanup, room closure notifications, file cleanup
- **User matching**: Pairing algorithm, availability checks, edge cases
- **Match cancellation**: Stopping search, state updates
- **Statistics broadcasting**: Real-time stats to all clients

**Coverage:**
- `handleConnection()`
- `handleDisconnection()`
- `handleUserMatch()`
- `handleCancelMatch()`
- `broadcastUserStats()`

### `socketHandlers.messaging.test.js`
Tests for messaging and WebRTC:
- **Chat messages**: Text, file, and voice message sending
- **Message validation**: Format checking, content validation
- **Chat clearing**: Room cleanup, file deletion, user notifications
- **WebRTC signaling**: Offer, answer, ICE candidate exchange
- **Call lifecycle**: Call end, reject, timeout handling
- **Edge cases**: Rapid messaging, race conditions, concurrent operations

**Coverage:**
- `handleChatMessage()`
- `handleChatClear()`
- `handleWebRTCOffer()`
- `handleWebRTCAnswer()`
- `handleICECandidate()`
- `handleWebRTCCallEnd()`
- `handleWebRTCCallReject()`
- `handleWebRTCCallTimeout()`

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Socket Tests Only
```bash
npm run test:socket
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Structure

Each test file follows this structure:

```javascript
describe('Handler Group', () => {
  beforeEach(() => {
    // Setup mocks and test state
  });

  describe('specificHandler', () => {
    test('should handle success case', async () => {
      // Arrange
      // Act
      // Assert
    });

    test('should handle error case', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Mocked Dependencies

All tests mock the following modules:
- `../../config/logger` - Winston logger
- `../../middleware/validation` - Message validation
- `../../utils/tempFileStorage` - File storage operations
- `../../controllers/guestController` - Guest user operations
- `../../utils/redisGuestManager` - Redis operations

This ensures tests are:
- **Fast**: No actual I/O operations
- **Isolated**: Each test is independent
- **Reliable**: No external dependencies

## Key Test Scenarios

### Connection Management
- ✅ Successful connection establishment
- ✅ Connection error handling
- ✅ Multiple concurrent connections
- ✅ Disconnection cleanup
- ✅ Disconnection during active chat
- ✅ Temporary file cleanup

### User Matching
- ✅ Successful match between two users
- ✅ No available users scenario
- ✅ Self-matching prevention
- ✅ Already-connected user filtering
- ✅ Socket availability validation
- ✅ Match cancellation

### Messaging
- ✅ Text message sending
- ✅ File message sending
- ✅ Voice message sending
- ✅ Invalid message rejection
- ✅ Disconnected user handling
- ✅ Rapid message sending
- ✅ Message validation

### WebRTC Signaling
- ✅ Offer transmission (audio/video)
- ✅ Answer transmission
- ✅ ICE candidate exchange
- ✅ Multiple ICE candidates
- ✅ Call end notification
- ✅ Call rejection
- ✅ Call timeout
- ✅ Race condition handling

### Error Handling
- ✅ Redis connection errors
- ✅ Guest session not found
- ✅ Socket not available
- ✅ Invalid data formats
- ✅ Concurrent operation conflicts

## Coverage Goals

Target coverage metrics:
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

## Adding New Tests

When adding new socket handlers:

1. **Create test cases** for all success paths
2. **Add error scenarios** for each handler
3. **Test edge cases** (race conditions, rapid calls)
4. **Mock external dependencies** properly
5. **Update this README** with new test descriptions

### Example Test Template

```javascript
describe('handleNewFeature', () => {
  beforeEach(() => {
    // Setup test data
    getGuestBySessionId.mockResolvedValue({
      id: 'guest_user-123',
      username: 'TestUser',
      sessionId: 'session-123',
      connectedUser: 'guest_user-456',
    });
  });

  test('should successfully perform action', async () => {
    const testData = { /* ... */ };
    
    await handlers.handleNewFeature(mockSocket, testData);
    
    expect(mockIo.to).toHaveBeenCalledWith('socket-456');
    expect(mockSocket.emit).toHaveBeenCalledWith('success', expect.any(Object));
  });

  test('should handle error when user not connected', async () => {
    getGuestBySessionId.mockResolvedValue({
      id: 'guest_user-123',
      connectedUser: null,
    });

    await handlers.handleNewFeature(mockSocket, {});
    
    expect(mockSocket.emit).toHaveBeenCalledWith('error', {
      message: 'You are not connected to any user',
    });
  });
});
```

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```bash
# GitHub Actions, GitLab CI, etc.
npm ci
npm run test:coverage
```

## Troubleshooting

### Tests Failing After Code Changes
1. Check mock implementations match new function signatures
2. Update test data structures if models changed
3. Verify all async operations are properly awaited

### Mock Issues
1. Ensure mocks are cleared between tests with `jest.clearAllMocks()`
2. Check that mocked return values match expected types
3. Verify mock function paths are correct

### Coverage Gaps
1. Run `npm run test:coverage` to see uncovered lines
2. Add tests for missing branches
3. Test error paths and edge cases

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Socket.IO Testing Guide](https://socket.io/docs/v4/testing/)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices#-testing-and-overall-quality-practices)
