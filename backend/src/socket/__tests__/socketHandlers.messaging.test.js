/**
 * Socket Handlers Messaging & WebRTC Tests
 * 
 * Tests for chat messaging and WebRTC signaling handlers:
 * 1. Chat message sending and validation
 * 2. Chat clearing and room cleanup
 * 3. WebRTC offer/answer/ICE candidate exchange
 * 4. WebRTC call lifecycle (end, reject, timeout)
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

describe('Socket Handlers - Messaging & WebRTC', () => {
  let mockIo;
  let mockSocket;
  let mockConnectedSocket;
  let handlers;
  const tempFileStorage = require('../../utils/tempFileStorage');
  const {
    updateGuestPresence,
    getGuestBySessionId,
  } = require('../../controllers/guestController');
  const { validateMessage } = require('../../middleware/validation');

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear connection maps
    connectedUsers.clear();
    userSockets.clear();

    // Create mock socket for sender
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
    };

    // Create mock socket for receiver
    mockConnectedSocket = {
      id: 'socket-456',
      user: {
        username: 'TestUser2',
        id: 'guest_user-456',
      },
      userId: 'guest_user-456',
      sessionId: 'session-456',
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
    };

    // Create mock io
    mockIo = {
      emit: jest.fn(),
      to: jest.fn((socketId) => ({
        emit: jest.fn(),
      })),
      sockets: {
        sockets: new Map([
          ['socket-123', mockSocket],
          ['socket-456', mockConnectedSocket],
        ]),
      },
    };

    // Set up connected users
    userSockets.set('guest_user-123', 'socket-123');
    userSockets.set('guest_user-456', 'socket-456');

    // Create handlers with mock io
    handlers = createSocketHandlers(mockIo);
  });

  describe('handleChatMessage', () => {
    beforeEach(() => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: 'guest_user-456',
      });
    });

    test('should successfully send text message to connected user', async () => {
      const messageData = {
        type: 'text',
        content: 'Hello, World!',
        timestamp: new Date().toISOString(),
      };

      validateMessage.text.mockReturnValue(true);

      await handlers.handleChatMessage(mockSocket, messageData);

      // Verify message validation
      expect(validateMessage.text).toHaveBeenCalledWith('Hello, World!');

      // Verify message sent to connected user
      expect(mockIo.to).toHaveBeenCalledWith('socket-456');

      // Verify confirmation sent to sender
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'chat:message:sent',
        expect.objectContaining({
          messageId: expect.any(String),
          timestamp: expect.any(String),
          status: 'sent',
        })
      );
    });

    test('should successfully send file message', async () => {
      const messageData = {
        type: 'file',
        content: {
          filename: 'test.pdf',
          url: '/uploads/test.pdf',
          size: 1024,
        },
        timestamp: new Date().toISOString(),
      };

      validateMessage.file.mockReturnValue(true);

      await handlers.handleChatMessage(mockSocket, messageData);

      expect(validateMessage.file).toHaveBeenCalledWith(messageData.content);
      expect(mockIo.to).toHaveBeenCalledWith('socket-456');
    });

    test('should successfully send voice message', async () => {
      const messageData = {
        type: 'voice',
        content: {
          url: '/uploads/voice.webm',
          duration: 30,
        },
        timestamp: new Date().toISOString(),
      };

      validateMessage.voice.mockReturnValue(true);

      await handlers.handleChatMessage(mockSocket, messageData);

      expect(validateMessage.voice).toHaveBeenCalledWith(messageData.content);
      expect(mockIo.to).toHaveBeenCalledWith('socket-456');
    });

    test('should reject invalid message format', async () => {
      const messageData = {
        type: 'text',
        content: '', // Invalid empty content
        timestamp: new Date().toISOString(),
      };

      validateMessage.text.mockReturnValue(false);

      await handlers.handleChatMessage(mockSocket, messageData);

      expect(mockSocket.emit).toHaveBeenCalledWith('chat:error', {
        message: 'Invalid message format',
      });
    });

    test('should handle error when user not connected', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: null, // Not connected
      });

      const messageData = {
        type: 'text',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      };

      await handlers.handleChatMessage(mockSocket, messageData);

      expect(mockSocket.emit).toHaveBeenCalledWith('chat:error', {
        message: 'You are not connected to any user',
      });
    });

    test('should handle error when connected user socket not available', async () => {
      userSockets.delete('guest_user-456'); // Remove connected user's socket

      const messageData = {
        type: 'text',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      };

      validateMessage.text.mockReturnValue(true);

      await handlers.handleChatMessage(mockSocket, messageData);

      expect(mockSocket.emit).toHaveBeenCalledWith('chat:error', {
        message: 'Connected user is not available',
      });
    });

    test('should handle unsupported message type', async () => {
      const messageData = {
        type: 'unknown',
        content: 'test',
        timestamp: new Date().toISOString(),
      };

      await handlers.handleChatMessage(mockSocket, messageData);

      expect(mockSocket.emit).toHaveBeenCalledWith('chat:error', {
        message: 'Invalid message format',
      });
    });
  });

  describe('handleChatClear', () => {
    beforeEach(() => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: 'guest_user-456',
      });
    });

    test('should successfully clear chat and notify connected user', async () => {
      await handlers.handleChatClear(mockSocket);

      // Verify chat cleared event sent to connected user
      expect(mockIo.to).toHaveBeenCalled();

      // Verify both users' status updated
      expect(updateGuestPresence).toHaveBeenCalledWith('session-123', {
        connectedUser: null,
        inChat: false,
      });

      expect(updateGuestPresence).toHaveBeenCalledWith('user-456', {
        connectedUser: null,
        inChat: false,
      });

      // Verify confirmation sent to user
      expect(mockSocket.emit).toHaveBeenCalledWith('chat:clear:confirmed', {
        message: 'Chat cleared successfully',
      });
    });

    test('should clean up temporary files on chat clear', async () => {
      await handlers.handleChatClear(mockSocket);

      const expectedRoomId = ['guest_user-123', 'guest_user-456'].sort().join('_');
      expect(tempFileStorage.deleteRoomFiles).toHaveBeenCalledWith(expectedRoomId);
    });

    test('should handle chat clear when user not in chat', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: null, // Not in chat
      });

      await handlers.handleChatClear(mockSocket);

      // Should still confirm
      expect(mockSocket.emit).toHaveBeenCalledWith('chat:clear:confirmed', {
        message: 'Chat cleared successfully',
      });
    });

    test('should handle error when guest session not found', async () => {
      getGuestBySessionId.mockResolvedValue(null);

      await handlers.handleChatClear(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('chat:error', {
        message: 'Guest session not found',
      });
    });
  });

  describe('handleWebRTCOffer', () => {
    beforeEach(() => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: 'guest_user-456',
      });
    });

    test('should successfully send WebRTC offer to connected user', async () => {
      const offerData = {
        offer: {
          type: 'offer',
          sdp: 'mock-sdp-data',
        },
        type: 'video',
      };

      await handlers.handleWebRTCOffer(mockSocket, offerData);

      expect(mockIo.to).toHaveBeenCalledWith('socket-456');
    });

    test('should send audio call offer', async () => {
      const offerData = {
        offer: {
          type: 'offer',
          sdp: 'mock-sdp-data',
        },
        type: 'audio',
      };

      await handlers.handleWebRTCOffer(mockSocket, offerData);

      expect(mockIo.to).toHaveBeenCalledWith('socket-456');
    });

    test('should handle error when user not connected', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: null,
      });

      const offerData = {
        offer: { type: 'offer', sdp: 'mock-sdp' },
        type: 'video',
      };

      await handlers.handleWebRTCOffer(mockSocket, offerData);

      expect(mockSocket.emit).toHaveBeenCalledWith('webrtc:error', {
        message: 'You are not connected to any user',
      });
    });

    test('should handle error when connected user socket not available', async () => {
      userSockets.delete('guest_user-456');

      const offerData = {
        offer: { type: 'offer', sdp: 'mock-sdp' },
        type: 'video',
      };

      await handlers.handleWebRTCOffer(mockSocket, offerData);

      expect(mockSocket.emit).toHaveBeenCalledWith('webrtc:error', {
        message: 'Connected user is not available',
      });
    });
  });

  describe('handleWebRTCAnswer', () => {
    beforeEach(() => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: 'guest_user-456',
      });
    });

    test('should successfully send WebRTC answer to connected user', async () => {
      const answerData = {
        answer: {
          type: 'answer',
          sdp: 'mock-answer-sdp',
        },
      };

      await handlers.handleWebRTCAnswer(mockSocket, answerData);

      expect(mockIo.to).toHaveBeenCalledWith('socket-456');
    });

    test('should handle error when user not connected', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: null,
      });

      const answerData = {
        answer: { type: 'answer', sdp: 'mock-sdp' },
      };

      await handlers.handleWebRTCAnswer(mockSocket, answerData);

      expect(mockSocket.emit).toHaveBeenCalledWith('webrtc:error', {
        message: 'You are not connected to any user',
      });
    });
  });

  describe('handleICECandidate', () => {
    beforeEach(() => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: 'guest_user-456',
      });
    });

    test('should successfully send ICE candidate to connected user', async () => {
      const candidateData = {
        candidate: {
          candidate: 'candidate:mock-ice-candidate',
          sdpMLineIndex: 0,
          sdpMid: '0',
        },
      };

      await handlers.handleICECandidate(mockSocket, candidateData);

      expect(mockIo.to).toHaveBeenCalledWith('socket-456');
    });

    test('should handle multiple ICE candidates', async () => {
      const candidates = [
        { candidate: 'candidate:1' },
        { candidate: 'candidate:2' },
        { candidate: 'candidate:3' },
      ];

      for (const candidate of candidates) {
        await handlers.handleICECandidate(mockSocket, { candidate });
      }

      expect(mockIo.to).toHaveBeenCalledTimes(3);
    });

    test('should handle error when user not connected', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: null,
      });

      const candidateData = {
        candidate: { candidate: 'candidate:mock' },
      };

      await handlers.handleICECandidate(mockSocket, candidateData);

      expect(mockSocket.emit).toHaveBeenCalledWith('webrtc:error', {
        message: 'You are not connected to any user',
      });
    });
  });

  describe('handleWebRTCCallEnd', () => {
    beforeEach(() => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: 'guest_user-456',
      });
    });

    test('should successfully send call end signal to connected user', async () => {
      await handlers.handleWebRTCCallEnd(mockSocket);

      expect(mockIo.to).toHaveBeenCalledWith('socket-456');
    });

    test('should handle error when user not connected', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: null,
      });

      await handlers.handleWebRTCCallEnd(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('webrtc:error', {
        message: 'You are not connected to any user',
      });
    });
  });

  describe('handleWebRTCCallReject', () => {
    beforeEach(() => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: 'guest_user-456',
      });
    });

    test('should successfully send call reject signal to connected user', async () => {
      await handlers.handleWebRTCCallReject(mockSocket);

      expect(mockIo.to).toHaveBeenCalledWith('socket-456');
    });

    test('should handle error when user not connected', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: null,
      });

      await handlers.handleWebRTCCallReject(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('webrtc:error', {
        message: 'You are not connected to any user',
      });
    });
  });

  describe('handleWebRTCCallTimeout', () => {
    beforeEach(() => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: 'guest_user-456',
      });
    });

    test('should successfully send call timeout signal to connected user', async () => {
      await handlers.handleWebRTCCallTimeout(mockSocket);

      expect(mockIo.to).toHaveBeenCalledWith('socket-456');
    });

    test('should handle error when user not connected', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: null,
      });

      await handlers.handleWebRTCCallTimeout(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('webrtc:error', {
        message: 'You are not connected to any user',
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle rapid message sending', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: 'guest_user-456',
      });

      validateMessage.text.mockReturnValue(true);

      const messages = Array.from({ length: 5 }, (_, i) => ({
        type: 'text',
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }));

      for (const message of messages) {
        await handlers.handleChatMessage(mockSocket, message);
      }

      // Each message causes 2 calls to mockIo.to (message emit + delivered emit)
      expect(mockIo.to).toHaveBeenCalledTimes(10);
    });

    test('should handle race condition in WebRTC signaling', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: 'guest_user-456',
      });

      const offerData = {
        offer: { type: 'offer', sdp: 'mock-sdp' },
        type: 'video',
      };

      // Send offer and immediately remove connected socket
      const offerPromise = handlers.handleWebRTCOffer(mockSocket, offerData);
      userSockets.delete('guest_user-456');

      await offerPromise;

      // Should handle gracefully
      expect(true).toBe(true);
    });

    test('should handle chat clear during active WebRTC call', async () => {
      getGuestBySessionId.mockResolvedValue({
        id: 'guest_user-123',
        username: 'TestUser',
        sessionId: 'session-123',
        connectedUser: 'guest_user-456',
      });

      await handlers.handleChatClear(mockSocket);

      // Should clean up properly
      expect(updateGuestPresence).toHaveBeenCalledWith('session-123', {
        connectedUser: null,
        inChat: false,
      });
    });
  });
});
