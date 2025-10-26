/**
 * Socket Handlers Connection Tests
 * 
 * Tests for socket connection, disconnection, and user matching handlers:
 * 1. Connection establishment and cleanup
 * 2. Disconnection and room cleanup
 * 3. User matching algorithm
 * 4. Match cancellation
 */

const { createSocketHandlers, connectedUsers, userSockets } = require('../socketHandlers');

// Mock dependencies
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../middleware/validation', () => ({
  validateMessage: {
    text: jest.fn(() => true),
    file: jest.fn(() => true),
    voice: jest.fn(() => true),
  },
}));

jest.mock('../../utils/tempFileStorage', () => ({
  deleteRoomFiles: jest.fn(() => 2),
}));

jest.mock('../../controllers/guestController', () => ({
  updateGuestPresence: jest.fn(),
  getGuestBySessionId: jest.fn(),
  getAllOnlineGuests: jest.fn(),
  getGuestStats: jest.fn(() => ({
    totalUsers: 10,
    onlineUsers: 5,
    availableUsers: 2,
    connectedUsers: 3,
  })),
}));

jest.mock('../../utils/redisGuestManager', () => ({
  incrementActiveUserCount: jest.fn(() => Promise.resolve(5)),
  decrementActiveUserCount: jest.fn(() => Promise.resolve(4)),
  getActiveUserCount: jest.fn(() => Promise.resolve(5)),
}));

describe('Socket Handlers - Connection Management', () => {
  let mockIo;
  let mockSocket;
  let handlers;
  const tempFileStorage = require('../../utils/tempFileStorage');
  const {
    updateGuestPresence,
    getGuestBySessionId,
    getAllOnlineGuests,
  } = require('../../controllers/guestController');
  const redisGuestManager = require('../../utils/redisGuestManager');

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear connection maps
    connectedUsers.clear();
    userSockets.clear();

    // Create mock socket
    mockSocket = {
      id: 'socket-123',
      user: {
        username: 'TestUser',
        id: 'guest_user-123',
      },
      userId: 'guest_user-123',
      sessionId: 'session-123',
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn(() => mockSocket),
    };

    // Create mock io
    mockIo = {
      emit: jest.fn(),
      to: jest.fn(() => mockIo),
      sockets: {
        sockets: new Map([['socket-123', mockSocket]]),
      },
    };

    // Create handlers with mock io
    handlers = createSocketHandlers(mockIo);
  });

  describe('handleConnection', () => {
    test('should successfully establish connection and store mappings', async () => {
      await handlers.handleConnection(mockSocket);

      // Verify connection mappings
      expect(connectedUsers.get('socket-123')).toBe('guest_user-123');
      expect(userSockets.get('guest_user-123')).toBe('socket-123');

      // Verify guest presence updated
      expect(updateGuestPresence).toHaveBeenCalledWith('session-123', {
        isOnline: true,
        socketId: 'socket-123',
        connectedAt: expect.any(String),
      });

      // Verify socket joined user room
      expect(mockSocket.join).toHaveBeenCalledWith('guest_user-123');

      // Verify active user count incremented
      expect(redisGuestManager.incrementActiveUserCount).toHaveBeenCalled();

      // Verify connection established event emitted
      expect(mockSocket.emit).toHaveBeenCalledWith('connection:established', {
        userId: 'guest_user-123',
        username: 'TestUser',
        socketId: 'socket-123',
        isGuest: true,
        sessionId: 'session-123',
      });
    });

    test('should broadcast user stats after connection', async () => {
      getAllOnlineGuests.mockResolvedValue([
        {
          id: 'guest_user-123',
          username: 'TestUser',
          isOnline: true,
          isSearching: false,
          lastSeen: new Date().toISOString(),
          location: { country: 'US' },
          gender: 'other',
          language: 'en',
        },
      ]);

      await handlers.handleConnection(mockSocket);

      // Verify stats were broadcasted
      expect(mockIo.emit).toHaveBeenCalledWith(
        'realtime:stats',
        expect.objectContaining({
          stats: expect.any(Object),
          timestamp: expect.any(String),
        })
      );
    });

    test('should handle connection error gracefully', async () => {
      updateGuestPresence.mockRejectedValueOnce(new Error('Redis error'));

      await handlers.handleConnection(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Connection failed',
      });
    });

    test('should handle multiple concurrent connections', async () => {
      const mockSocket2 = {
        ...mockSocket,
        id: 'socket-456',
        userId: 'guest_user-456',
        sessionId: 'session-456',
        user: { username: 'TestUser2', id: 'guest_user-456' },
      };

      await handlers.handleConnection(mockSocket);
      await handlers.handleConnection(mockSocket2);

      expect(connectedUsers.size).toBe(2);
      expect(userSockets.size).toBe(2);
      expect(connectedUsers.get('socket-456')).toBe('guest_user-456');
    });
  });

  describe('handleDisconnection', () => {
    beforeEach(async () => {
      // Establish connection first
      await handlers.handleConnection(mockSocket);
      jest.clearAllMocks();
    });

    test('should clean up connection mappings on disconnection', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: null,
      });

      await handlers.handleDisconnection(mockSocket);

      // Verify mappings cleared
      expect(connectedUsers.has('socket-123')).toBe(false);
      expect(userSockets.has('guest_user-123')).toBe(false);

      // Verify presence updated to offline
      expect(updateGuestPresence).toHaveBeenCalledWith('session-123', {
        isOnline: false,
        socketId: null,
        inChat: false,
        connectedUser: null,
      });

      // Verify active user count decremented
      expect(redisGuestManager.decrementActiveUserCount).toHaveBeenCalled();
    });

    test('should notify connected user when guest disconnects during chat', async () => {
      const connectedUserId = 'guest_user-456';
      const connectedSocketId = 'socket-456';

      // Add connected user to maps
      userSockets.set(connectedUserId, connectedSocketId);

      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: connectedUserId,
      });

      await handlers.handleDisconnection(mockSocket);

      // Verify room:closed event sent to connected user
      expect(mockIo.to).toHaveBeenCalledWith(connectedSocketId);
      expect(mockIo.emit).toHaveBeenCalledWith(
        'room:closed',
        expect.objectContaining({
          userId: 'guest_user-123',
          username: 'TestUser',
          reason: 'user_disconnected',
        })
      );

      // Verify connected user's status updated
      expect(updateGuestPresence).toHaveBeenCalledWith('user-456', {
        connectedUser: null,
        inChat: false,
      });
    });

    test('should clean up temporary files when user disconnects from chat', async () => {
      const connectedUserId = 'guest_user-456';
      userSockets.set(connectedUserId, 'socket-456');

      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: connectedUserId,
      });

      await handlers.handleDisconnection(mockSocket);

      // Verify temp files deleted
      const expectedRoomId = ['guest_user-123', connectedUserId].sort().join('_');
      expect(tempFileStorage.deleteRoomFiles).toHaveBeenCalledWith(expectedRoomId);
    });

    test('should handle disconnection when guest session not found', async () => {
      getGuestBySessionId.mockResolvedValue(null);

      await handlers.handleDisconnection(mockSocket);

      // Should exit early without error
      expect(updateGuestPresence).not.toHaveBeenCalled();
    });

    test('should handle disconnection errors gracefully', async () => {
      getGuestBySessionId.mockRejectedValue(new Error('Database error'));

      await handlers.handleDisconnection(mockSocket);

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('handleUserMatch', () => {
    beforeEach(async () => {
      await handlers.handleConnection(mockSocket);
      jest.clearAllMocks();
    });

    test('should successfully match two available guests', async () => {
      const availableGuest = {
        id: 'guest_user-456',
        sessionId: 'session-456',
        username: 'TestUser2',
        isSearching: true,
        connectedUser: null,
        isOnline: true,
        location: { country: 'US' },
        gender: 'other',
        language: 'en',
      };

      userSockets.set('guest_user-456', 'socket-456');

      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        sessionId: 'session-123',
        username: 'TestUser',
        location: { country: 'UK' },
        gender: 'other',
        language: 'en',
      });

      getAllOnlineGuests.mockResolvedValue([availableGuest]);

      await handlers.handleUserMatch(mockSocket);

      // Verify searching status set
      expect(updateGuestPresence).toHaveBeenCalledWith('session-123', {
        isSearching: true,
      });

      // Verify both users updated to connected
      expect(updateGuestPresence).toHaveBeenCalledWith('session-123', {
        isSearching: false,
        inChat: true,
        connectedUser: 'guest_user-456',
      });

      expect(updateGuestPresence).toHaveBeenCalledWith('session-456', {
        isSearching: false,
        inChat: true,
        connectedUser: 'guest_user-123',
      });

      // Verify matched events emitted to both users
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'user:matched',
        expect.objectContaining({
          matchedUser: expect.objectContaining({
            id: 'guest_user-456',
            username: 'TestUser2',
          }),
          roomId: expect.any(String),
        })
      );
    });

    test('should emit no_users event when no matches available', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        sessionId: 'session-123',
        username: 'TestUser',
      });

      getAllOnlineGuests.mockResolvedValue([]);

      await handlers.handleUserMatch(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('user:match:no_users', {
        message: 'No users available for matching. Waiting for someone to join...',
      });
    });

    test('should not match user with themselves', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        sessionId: 'session-123',
        username: 'TestUser',
      });

      getAllOnlineGuests.mockResolvedValue([
        {
          id: 'guest_user-123', // Same as requesting user
          sessionId: 'session-123',
          username: 'TestUser',
          isSearching: true,
          connectedUser: null,
        },
      ]);

      await handlers.handleUserMatch(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'user:match:no_users',
        expect.any(Object)
      );
    });

    test('should not match already connected users', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        sessionId: 'session-123',
        username: 'TestUser',
      });

      getAllOnlineGuests.mockResolvedValue([
        {
          id: 'guest_user-456',
          sessionId: 'session-456',
          username: 'TestUser2',
          isSearching: true,
          connectedUser: 'guest_user-789', // Already connected
        },
      ]);

      await handlers.handleUserMatch(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'user:match:no_users',
        expect.any(Object)
      );
    });

    test('should handle matching error when guest session not found', async () => {
      getGuestBySessionId.mockResolvedValue(null);

      await handlers.handleUserMatch(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('user:match:error', {
        message: 'Guest session not found',
      });
    });

    test('should handle error when matched user socket not available', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        sessionId: 'session-123',
        username: 'TestUser',
      });

      getAllOnlineGuests.mockResolvedValue([
        {
          id: 'guest_user-456',
          sessionId: 'session-456',
          username: 'TestUser2',
          isSearching: true,
          connectedUser: null,
        },
      ]);

      // Don't add to userSockets map to simulate offline

      await handlers.handleUserMatch(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('user:match:error', {
        message: 'Selected user is no longer available',
      });
    });
  });

  describe('handleCancelMatch', () => {
    beforeEach(async () => {
      await handlers.handleConnection(mockSocket);
      jest.clearAllMocks();
    });

    test('should successfully cancel matching request', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        sessionId: 'session-123',
        username: 'TestUser',
        isSearching: true,
      });

      await handlers.handleCancelMatch(mockSocket);

      // Verify isSearching set to false
      expect(updateGuestPresence).toHaveBeenCalledWith('session-123', {
        isSearching: false,
      });

      // Verify cancel confirmation emitted
      expect(mockSocket.emit).toHaveBeenCalledWith('user:match:cancelled', {
        message: 'Matching cancelled',
      });
    });

    test('should handle cancel when guest session not found', async () => {
      getGuestBySessionId.mockResolvedValue(null);

      await handlers.handleCancelMatch(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('user:match:cancel:error', {
        message: 'Guest session not found',
      });
    });

    test('should handle cancel match errors gracefully', async () => {
      getGuestBySessionId.mockRejectedValue(new Error('Database error'));

      await handlers.handleCancelMatch(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('user:match:cancel:error', {
        message: 'Failed to cancel matching',
      });
    });
  });

  describe('broadcastUserStats', () => {
    test('should broadcast stats to all connected clients', async () => {
      getAllOnlineGuests.mockResolvedValue([
        {
          id: 'guest_user-123',
          username: 'TestUser',
          isOnline: true,
          isSearching: false,
          lastSeen: new Date().toISOString(),
          location: { country: 'US' },
          gender: 'other',
          language: 'en',
        },
      ]);

      await handlers.broadcastUserStats();

      expect(mockIo.emit).toHaveBeenCalledWith(
        'realtime:stats',
        expect.objectContaining({
          stats: expect.objectContaining({
            totalUsers: 10,
            onlineUsers: 5,
            activeUsers: 5,
            availableUsers: 2,
            connectedUsers: 3,
          }),
          onlineUsers: expect.any(Array),
          timestamp: expect.any(String),
        })
      );
    });

    test('should handle broadcast errors gracefully', async () => {
      getAllOnlineGuests.mockRejectedValue(new Error('Database error'));

      await handlers.broadcastUserStats();

      // Should not throw error
      expect(true).toBe(true);
    });
  });
});
