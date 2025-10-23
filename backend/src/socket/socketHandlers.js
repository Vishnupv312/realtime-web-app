const { logger } = require('../config/logger');
const { validateMessage } = require('../middleware/validation');
const tempFileStorage = require('../utils/tempFileStorage');
const { updateGuestPresence, getGuestBySessionId, getAllOnlineGuests, getGuestStats } = require('../controllers/guestController');
const redisGuestManager = require('../utils/redisGuestManager');

// Store active connections in memory (use Redis for production scaling)
const connectedUsers = new Map(); // socketId -> userId mapping
const userSockets = new Map(); // userId -> socketId mapping

function createSocketHandlers(io) {
  // Handle guest user connection
  async function handleConnection(socket) {
    try {
      const user = socket.user;
      const userId = socket.userId;
      const sessionId = socket.sessionId;
      
      // Store connection mapping
      connectedUsers.set(socket.id, userId);
      userSockets.set(userId, socket.id);
      
      // Update guest presence in Redis
      await updateGuestPresence(sessionId, {
        isOnline: true,
        socketId: socket.id,
        connectedAt: new Date().toISOString()
      });
      
      // Join user to their own room for private messaging
      socket.join(userId);
      
      // Increment active user count
      const activeCount = await redisGuestManager.incrementActiveUserCount();
      
      logger.info(`Guest connected: ${user.username} (${userId}) - Socket: ${socket.id}, Active users: ${activeCount}`);
      
      // Send current user info to client
      socket.emit('connection:established', {
        userId: userId,
        username: user.username,
        socketId: socket.id,
        isGuest: true,
        sessionId: sessionId
      });
      
      // Broadcast updated statistics to all connected clients
      await broadcastUserStats();

    } catch (error) {
      logger.error('Connection handling error:', error);
      socket.emit('error', { message: 'Connection failed' });
    }
  }

  // Handle guest user disconnection
  async function handleDisconnection(socket) {
    try {
      const userId = connectedUsers.get(socket.id);
      const sessionId = socket.sessionId;
      if (!userId || !sessionId) return;

      const guestSession = await getGuestBySessionId(sessionId);
      if (!guestSession) return;
      
      // If guest was in chat, handle disconnection cleanup
      if (guestSession.connectedUser) {
        const connectedUserSocketId = userSockets.get(guestSession.connectedUser);
        if (connectedUserSocketId) {
          // Create room ID
          const roomId = [guestSession.id, guestSession.connectedUser].sort().join('_');
          
          // Notify connected user that guest left
          io.to(connectedUserSocketId).emit('room:closed', {
            userId: guestSession.id,
            username: guestSession.username,
            message: `The other user has left. Room closed.`,
            reason: 'user_disconnected'
          });
          
          // Update connected user's status
          const connectedGuestSessionId = guestSession.connectedUser.replace('guest_', '');
          await updateGuestPresence(connectedGuestSessionId, {
            connectedUser: null,
            inChat: false
          });
          
          // Clean up temporary files for this room
          const deletedFilesCount = tempFileStorage.deleteRoomFiles(roomId);
          if (deletedFilesCount > 0) {
            logger.info(`Cleaned up ${deletedFilesCount} temporary files for room ${roomId}`);
          }
        }
      }
      
      // Update guest presence to offline
      await updateGuestPresence(sessionId, {
        isOnline: false,
        socketId: null,
        inChat: false,
        connectedUser: null
      });
      
      // Remove from connection mappings
      connectedUsers.delete(socket.id);
      userSockets.delete(userId);
      
      // Decrement active user count
      const activeCount = await redisGuestManager.decrementActiveUserCount();
      
      logger.info(`Guest disconnected: ${guestSession.username} (${userId}), Active users: ${activeCount}`);
      
      // Broadcast updated statistics to all connected clients
      await broadcastUserStats();

    } catch (error) {
      logger.error('Disconnection handling error:', error);
    }
  }

  // Handle guest user matching request
  async function handleUserMatch(socket, data) {
    try {
      const userId = socket.userId;
      const sessionId = socket.sessionId;
      
      const guestSession = await getGuestBySessionId(sessionId);
      if (!guestSession) {
        socket.emit('user:match:error', { message: 'Guest session not found' });
        return;
      }
      
      return await handleGuestMatching(socket, guestSession);

    } catch (error) {
      logger.error('User matching error:', error);
      socket.emit('user:match:error', { message: 'Matching failed' });
    }
  }

  // Handle guest user matching
  async function handleGuestMatching(socket, guestSession) {
    try {
      // Set guest as searching
      await updateGuestPresence(socket.sessionId, {
        isSearching: true
      });
      
      // Notify the guest that they are now searching
      socket.emit('user:match:searching', { message: 'Searching for available users' });
      
      // Find other available guests who are searching
      const allOnlineGuests = await getAllOnlineGuests();
      const availableGuests = allOnlineGuests.filter(guest => 
        guest.id !== guestSession.id && // Not themselves
        guest.isSearching && // Must be searching
        !guest.connectedUser // Must not be connected
      );
      
      if (availableGuests.length === 0) {
        socket.emit('user:match:no_users', { 
          message: 'No users available for matching. Waiting for someone to join...' 
        });
        return;
      }
      
      // Select random guest from available ones
      const randomIndex = Math.floor(Math.random() * availableGuests.length);
      const matchedGuest = availableGuests[randomIndex];
      const matchedGuestSocketId = userSockets.get(matchedGuest.id);
      
      if (!matchedGuestSocketId) {
        socket.emit('user:match:error', { message: 'Selected user is no longer available' });
        return;
      }
      
      logger.info(`Matching guests: ${guestSession.username} <-> ${matchedGuest.username}`);
      
      // Connect both guests
      await updateGuestPresence(socket.sessionId, {
        isSearching: false,
        inChat: true,
        connectedUser: matchedGuest.id
      });
      
      // Update matched guest's status
      await updateGuestPresence(matchedGuest.sessionId, {
        isSearching: false,
        inChat: true,
        connectedUser: guestSession.id
      });
      
      // Create room ID
      const roomId = [guestSession.id, matchedGuest.id].sort().join('_');
      
      // Join both users to the room
      socket.join(roomId);
      io.sockets.sockets.get(matchedGuestSocketId)?.join(roomId);
      
      // Notify both guests about the match
      const guestMatchData = {
        matchedUser: {
          id: matchedGuest.id,
          username: matchedGuest.username,
          isGuest: true,
          location: matchedGuest.location,
          gender: matchedGuest.gender,
          language: matchedGuest.language
        },
        roomId: roomId
      };
      
      const matchedGuestMatchData = {
        matchedUser: {
          id: guestSession.id,
          username: guestSession.username,
          isGuest: true,
          location: guestSession.location,
          gender: guestSession.gender,
          language: guestSession.language
        },
        roomId: roomId
      };
      
      socket.emit('user:matched', guestMatchData);
      io.to(matchedGuestSocketId).emit('user:matched', matchedGuestMatchData);
      
      // Notify room that users have joined
      io.to(roomId).emit('room:user_joined', {
        userId: guestSession.id,
        username: guestSession.username,
        message: `${guestSession.username} has joined the chat`
      });
      
      io.to(roomId).emit('room:user_joined', {
        userId: matchedGuest.id,
        username: matchedGuest.username,
        message: `${matchedGuest.username} has joined the chat`
      });
      
      logger.info(`Guests matched: ${guestSession.username} <-> ${matchedGuest.username} in room ${roomId}`);
      
      // Broadcast updated statistics
      await broadcastUserStats();
      
    } catch (error) {
      logger.error('Guest matching error:', error);
      socket.emit('user:match:error', { message: 'Matching failed' });
    }
  }

  // Handle guest chat message
  async function handleChatMessage(socket, data) {
    try {
      const sessionId = socket.sessionId;
      
      const guestSession = await getGuestBySessionId(sessionId);
      if (!guestSession || !guestSession.connectedUser) {
        socket.emit('chat:error', { message: 'You are not connected to any user' });
        return;
      }
      
      return await handleGuestChatMessage(socket, guestSession, data);

    } catch (error) {
      logger.error('Chat message error:', error);
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  }

  // Handle guest chat message
  async function handleGuestChatMessage(socket, guestSession, data) {
    try {
      const { type, content, timestamp } = data;

      // Validate message based on type
      let isValid = false;
      switch (type) {
        case 'text':
          isValid = validateMessage.text(content);
          break;
        case 'file':
          isValid = validateMessage.file(content);
          break;
        case 'voice':
          isValid = validateMessage.voice(content);
          break;
        default:
          isValid = false;
      }

      if (!isValid) {
        socket.emit('chat:error', { message: 'Invalid message format' });
        return;
      }

      const messageData = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        senderId: guestSession.id,
        senderUsername: guestSession.username,
        type,
        content,
        timestamp: timestamp || new Date().toISOString()
      };

      const connectedUserSocketId = userSockets.get(guestSession.connectedUser);
      
      if (connectedUserSocketId) {
        // Send message to connected user
        io.to(connectedUserSocketId).emit('chat:message', messageData);
        
        // Send confirmation back to sender
        socket.emit('chat:message:sent', {
          messageId: messageData.id,
          timestamp: messageData.timestamp,
          status: 'sent'
        });

        // Add delivered confirmation when recipient receives the message
        io.to(connectedUserSocketId).emit('chat:message:delivered', {
          messageId: messageData.id,
          timestamp: new Date().toISOString()
        });

        logger.info(`Guest message sent: ${guestSession.username} -> ${guestSession.connectedUser} (${type})`);
      } else {
        socket.emit('chat:error', { message: 'Connected user is not available' });
      }

    } catch (error) {
      logger.error('Guest chat message error:', error);
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  }

  // Handle chat clear (when guest leaves current chat)
  async function handleChatClear(socket) {
    try {
      const sessionId = socket.sessionId;
      const guestSession = await getGuestBySessionId(sessionId);

      if (!guestSession) {
        socket.emit('chat:error', { message: 'Guest session not found' });
        return;
      }

      if (guestSession.connectedUser) {
        const connectedUserSocketId = userSockets.get(guestSession.connectedUser);
        
        // Create room ID
        const roomId = [guestSession.id, guestSession.connectedUser].sort().join('_');
        
        // Notify the room that user has left
        io.to(roomId).emit('room:user_left', {
          userId: guestSession.id,
          username: guestSession.username,
          message: `${guestSession.username} has left the chat`
        });
        
        if (connectedUserSocketId) {
          // Notify connected user that chat is being cleared
          io.to(connectedUserSocketId).emit('chat:cleared', {
            userId: guestSession.id,
            username: guestSession.username,
            reason: 'User left the chat'
          });

          // Disconnect the other user too
          const connectedGuestSessionId = guestSession.connectedUser.replace('guest_', '');
          await updateGuestPresence(connectedGuestSessionId, {
            connectedUser: null,
            inChat: false
          });
        }

        // Leave the room
        socket.leave(roomId);
        
        // Clean up temporary files for this room
        const deletedFilesCount = tempFileStorage.deleteRoomFiles(roomId);
        if (deletedFilesCount > 0) {
          logger.info(`Cleaned up ${deletedFilesCount} temporary files for room ${roomId}`);
        }
        
        // Disconnect current guest
        await updateGuestPresence(sessionId, {
          connectedUser: null,
          inChat: false
        });
      }

      // Confirm chat clear to user
      socket.emit('chat:clear:confirmed', {
        message: 'Chat cleared successfully'
      });

      logger.info(`Chat cleared for guest: ${guestSession.username}`);

    } catch (error) {
      logger.error('Chat clear error:', error);
      socket.emit('chat:error', { message: 'Failed to clear chat' });
    }
  }

  // WebRTC Signaling Handlers for guests
  async function handleWebRTCOffer(socket, data) {
    try {
      const sessionId = socket.sessionId;
      const guestSession = await getGuestBySessionId(sessionId);

      if (!guestSession || !guestSession.connectedUser) {
        socket.emit('webrtc:error', { message: 'You are not connected to any user' });
        return;
      }

      const { offer, type } = data; // type: 'audio' or 'video'
      const connectedUserSocketId = userSockets.get(guestSession.connectedUser);

      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('webrtc:offer', {
          offer,
          type,
          from: guestSession.id,
          fromUsername: guestSession.username
        });

        logger.info(`WebRTC offer sent: ${guestSession.username} -> ${guestSession.connectedUser} (${type})`);
      } else {
        socket.emit('webrtc:error', { message: 'Connected user is not available' });
      }

    } catch (error) {
      logger.error('WebRTC offer error:', error);
      socket.emit('webrtc:error', { message: 'Failed to send offer' });
    }
  }

  async function handleWebRTCAnswer(socket, data) {
    try {
      const sessionId = socket.sessionId;
      const guestSession = await getGuestBySessionId(sessionId);

      if (!guestSession || !guestSession.connectedUser) {
        socket.emit('webrtc:error', { message: 'You are not connected to any user' });
        return;
      }

      const { answer } = data;
      const connectedUserSocketId = userSockets.get(guestSession.connectedUser);

      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('webrtc:answer', {
          answer,
          from: guestSession.id,
          fromUsername: guestSession.username
        });

        logger.info(`WebRTC answer sent: ${guestSession.username} -> ${guestSession.connectedUser}`);
      } else {
        socket.emit('webrtc:error', { message: 'Connected user is not available' });
      }

    } catch (error) {
      logger.error('WebRTC answer error:', error);
      socket.emit('webrtc:error', { message: 'Failed to send answer' });
    }
  }

  async function handleICECandidate(socket, data) {
    try {
      const sessionId = socket.sessionId;
      const guestSession = await getGuestBySessionId(sessionId);

      if (!guestSession || !guestSession.connectedUser) {
        socket.emit('webrtc:error', { message: 'You are not connected to any user' });
        return;
      }

      const { candidate } = data;
      const connectedUserSocketId = userSockets.get(guestSession.connectedUser);

      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('webrtc:ice-candidate', {
          candidate,
          from: guestSession.id
        });

        logger.debug(`ICE candidate sent: ${guestSession.username} -> ${guestSession.connectedUser}`);
      } else {
        socket.emit('webrtc:error', { message: 'Connected user is not available' });
      }

    } catch (error) {
      logger.error('ICE candidate error:', error);
      socket.emit('webrtc:error', { message: 'Failed to send ICE candidate' });
    }
  }

  // Handle cancellation of matching request for guests
  async function handleCancelMatch(socket, data) {
    try {
      const sessionId = socket.sessionId;
      const guestSession = await getGuestBySessionId(sessionId);

      if (!guestSession) {
        socket.emit('user:match:cancel:error', { message: 'Guest session not found' });
        return;
      }

      // Stop searching for a match
      await updateGuestPresence(sessionId, {
        isSearching: false
      });
      
      // Notify the user that they are no longer searching
      socket.emit('user:match:cancelled', { message: 'Matching cancelled' });
      
      logger.info(`Guest ${guestSession.username} cancelled matching`);

    } catch (error) {
      logger.error('Match cancellation error:', error);
      socket.emit('user:match:cancel:error', { message: 'Failed to cancel matching' });
    }
  }

  // Handle guest leaving room (route change or explicit leave) - same as chat clear
  async function handleLeaveRoom(socket) {
    return await handleChatClear(socket);
  }
  
  // Handle explicit room closure for guests - same as chat clear
  async function handleCloseRoom(socket) {
    return await handleChatClear(socket);
  }

  // WebRTC Call End Handler for guests
  async function handleWebRTCCallEnd(socket, data) {
    try {
      const sessionId = socket.sessionId;
      const guestSession = await getGuestBySessionId(sessionId);

      if (!guestSession || !guestSession.connectedUser) {
        socket.emit('webrtc:error', { message: 'You are not connected to any user' });
        return;
      }

      const connectedUserSocketId = userSockets.get(guestSession.connectedUser);

      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('webrtc:call-end', {
          from: guestSession.id,
          fromUsername: guestSession.username
        });

        logger.info(`WebRTC call ended: ${guestSession.username} -> ${guestSession.connectedUser}`);
      } else {
        socket.emit('webrtc:error', { message: 'Connected user is not available' });
      }

    } catch (error) {
      logger.error('WebRTC call end error:', error);
      socket.emit('webrtc:error', { message: 'Failed to end call' });
    }
  }

  // WebRTC Call Reject Handler for guests
  async function handleWebRTCCallReject(socket, data) {
    try {
      const sessionId = socket.sessionId;
      const guestSession = await getGuestBySessionId(sessionId);

      if (!guestSession || !guestSession.connectedUser) {
        socket.emit('webrtc:error', { message: 'You are not connected to any user' });
        return;
      }

      const connectedUserSocketId = userSockets.get(guestSession.connectedUser);

      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('webrtc:call-reject', {
          from: guestSession.id,
          fromUsername: guestSession.username
        });

        logger.info(`WebRTC call rejected: ${guestSession.username} -> ${guestSession.connectedUser}`);
      } else {
        socket.emit('webrtc:error', { message: 'Connected user is not available' });
      }

    } catch (error) {
      logger.error('WebRTC call reject error:', error);
      socket.emit('webrtc:error', { message: 'Failed to reject call' });
    }
  }

  // WebRTC Call Timeout Handler for guests
  async function handleWebRTCCallTimeout(socket, data) {
    try {
      const sessionId = socket.sessionId;
      const guestSession = await getGuestBySessionId(sessionId);

      if (!guestSession || !guestSession.connectedUser) {
        socket.emit('webrtc:error', { message: 'You are not connected to any user' });
        return;
      }

      const connectedUserSocketId = userSockets.get(guestSession.connectedUser);

      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('webrtc:call-timeout', {
          from: guestSession.id,
          fromUsername: guestSession.username
        });

        logger.info(`WebRTC call timed out: ${guestSession.username} -> ${guestSession.connectedUser}`);
      } else {
        socket.emit('webrtc:error', { message: 'Connected user is not available' });
      }

    } catch (error) {
      logger.error('WebRTC call timeout error:', error);
      socket.emit('webrtc:error', { message: 'Failed to handle call timeout' });
    }
  }
  
  // Broadcast real-time statistics to all connected clients
  async function broadcastUserStats() {
    try {
      // Get guest statistics from Redis
      const guestStats = await getGuestStats();
      const activeCount = await redisGuestManager.getActiveUserCount();
      
      const stats = {
        totalUsers: guestStats.totalUsers,
        onlineUsers: guestStats.onlineUsers,
        activeUsers: activeCount,
        availableUsers: guestStats.availableUsers,
        connectedUsers: guestStats.connectedUsers
      };
      
      // Get all online guests
      const onlineGuests = await getAllOnlineGuests();
      const onlineUsers = onlineGuests.map(guest => ({
        id: guest.id,
        username: guest.username,
        isOnline: guest.isOnline,
        isSearching: guest.isSearching,
        lastSeen: guest.lastSeen,
        location: guest.location,
        gender: guest.gender,
        language: guest.language,
        isGuest: true
      }));
      
      // Broadcast to all connected sockets
      io.emit('realtime:stats', {
        stats,
        onlineUsers,
        timestamp: new Date().toISOString()
      });
      
      logger.debug('Broadcasted real-time statistics:', stats);
    } catch (error) {
      logger.error('Error broadcasting user stats:', error);
    }
  }
  
  // Get current statistics on demand
  async function handleGetStats(socket) {
    try {
      const guestStats = await getGuestStats();
      const onlineGuests = await getAllOnlineGuests();
      const activeCount = await redisGuestManager.getActiveUserCount();
      
      const stats = {
        totalUsers: guestStats.totalUsers,
        onlineUsers: guestStats.onlineUsers,
        activeUsers: activeCount,
        availableUsers: guestStats.availableUsers,
        connectedUsers: guestStats.connectedUsers
      };
      
      const onlineUsers = onlineGuests.map(guest => ({
        id: guest.id,
        username: guest.username,
        isOnline: guest.isOnline,
        isSearching: guest.isSearching,
        lastSeen: guest.lastSeen,
        location: guest.location,
        gender: guest.gender,
        language: guest.language,
        isGuest: true
      }));
      
      socket.emit('realtime:stats', {
        stats,
        onlineUsers,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Error getting stats:', error);
      socket.emit('realtime:stats:error', { message: 'Failed to get statistics' });
    }
  }

  return {
    handleConnection,
    handleDisconnection,
    handleUserMatch,
    handleCancelMatch,
    handleChatMessage,
    handleChatClear,
    handleWebRTCOffer,
    handleWebRTCAnswer,
    handleICECandidate,
    handleWebRTCCallEnd,
    handleWebRTCCallReject,
    handleWebRTCCallTimeout,
    handleLeaveRoom,
    handleCloseRoom,
    handleGetStats,
    broadcastUserStats
  };
}

module.exports = {
  createSocketHandlers,
  connectedUsers,
  userSockets
};
