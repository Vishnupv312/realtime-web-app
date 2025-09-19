const User = require('../models/User');
const { logger } = require('../config/database');
const { validateMessage } = require('../middleware/validation');
const tempFileStorage = require('../utils/tempFileStorage');

// Store active connections in memory (use Redis for production scaling)
const connectedUsers = new Map(); // socketId -> userId mapping
const userSockets = new Map(); // userId -> socketId mapping

function createSocketHandlers(io) {
  // Handle user connection
  async function handleConnection(socket) {
    try {
      const user = socket.user;
      const userId = user._id.toString();
      
      // Store connection mapping
      connectedUsers.set(socket.id, userId);
      userSockets.set(userId, socket.id);

      // Update user status to online
      await user.setOnline(socket.id);
      
      // Join user to their own room for private messaging
      socket.join(userId);

      logger.info(`User connected: ${user.username} (${userId}) - Socket: ${socket.id}`);

      // Notify other users that this user is online
      socket.broadcast.emit('user:online', {
        userId: userId,
        username: user.username,
        deviceId: user.deviceId,
        location: user.location
      });

      // Send current user info to client
      socket.emit('connection:established', {
        userId: userId,
        username: user.username,
        socketId: socket.id
      });

    } catch (error) {
      logger.error('Connection handling error:', error);
      socket.emit('error', { message: 'Connection failed' });
    }
  }

  // Handle user disconnection
  async function handleDisconnection(socket) {
    try {
      const userId = connectedUsers.get(socket.id);
      if (!userId) return;

      const user = await User.findById(userId);
      if (!user) return;

      // If user was connected to another user, instantly close the room
      if (user.connectedUser) {
        const connectedUserId = user.connectedUser.toString();
        const connectedUserSocketId = userSockets.get(connectedUserId);
        
        // Create room ID the same way as in handleUserMatch
        const roomId = [userId, connectedUserId].sort().join('_');
        
        // Instantly close the room and notify the remaining user
        if (connectedUserSocketId) {
          io.to(connectedUserSocketId).emit('room:closed', {
            userId: userId,
            username: user.username,
            message: `The other user has left. Room closed.`,
            reason: 'user_disconnected'
          });

          // Disconnect the other user too to prevent reconnection
          const connectedUser = await User.findById(connectedUserId);
          if (connectedUser) {
            await connectedUser.disconnect();
          }
        }
        
        // Destroy the room completely
        io.in(roomId).socketsLeave(roomId);
        
        // Clean up temporary files for this room
        const deletedFilesCount = tempFileStorage.deleteRoomFiles(roomId);
        if (deletedFilesCount > 0) {
          logger.info(`Cleaned up ${deletedFilesCount} temporary files for room ${roomId}`);
        }
        
        logger.info(`Room ${roomId} instantly closed due to user ${user.username} disconnection`);
      }

      // Update user status to offline
      await user.setOffline();

      // Remove from connection mappings
      connectedUsers.delete(socket.id);
      userSockets.delete(userId);

      logger.info(`User disconnected: ${user.username} (${userId})`);

      // Notify other users that this user is offline
      socket.broadcast.emit('user:offline', {
        userId: userId,
        username: user.username
      });

    } catch (error) {
      logger.error('Disconnection handling error:', error);
    }
  }

  // Handle user matching request
  async function handleUserMatch(socket, data) {
    try {
      const userId = socket.userId;
      const user = await User.findById(userId);

      if (!user) {
        socket.emit('user:match:error', { message: 'User not found' });
        return;
      }

      // Set user as searching for a match
      await user.startSearching();
      
      // Notify the user that they are now searching
      socket.emit('user:match:searching', { message: 'Searching for available users' });
      
      // Find available users (online, searching, and not connected)
      const availableUsers = await User.findAvailableUsers(userId);
      
      if (availableUsers.length === 0) {
        // No users available right now, but keep the user in searching state
        // They will be matched when another user starts searching
        socket.emit('user:match:no_users', { message: 'No users available for matching. Waiting for someone to join...' });
        return;
      }

      // Select random user from those who are also searching
      const randomIndex = Math.floor(Math.random() * availableUsers.length);
      const matchedUser = availableUsers[randomIndex];

      // Connect both users
      logger.info(`Connecting users: ${user.username} -> ${matchedUser.username}`);
      
      // Ensure both users are connected before proceeding
      await Promise.all([
        user.connectToUser(matchedUser._id),
        matchedUser.connectToUser(user._id)
      ]);
      
      // Both users are no longer searching
      await Promise.all([
        user.stopSearching(),
        matchedUser.stopSearching()
      ]);
      
      // Refresh user objects to get updated data from database
      const refreshedUser = await User.findById(user._id);
      const refreshedMatchedUser = await User.findById(matchedUser._id);
      
      logger.info(`Users connected successfully: ${user.username} <-> ${matchedUser.username}`);
      logger.info(`User ${refreshedUser.username} connected to: ${refreshedUser.connectedUser}`);
      logger.info(`User ${refreshedMatchedUser.username} connected to: ${refreshedMatchedUser.connectedUser}`);

      const matchedUserSocketId = userSockets.get(matchedUser._id.toString());

      if (matchedUserSocketId) {
        // Create a unique room ID for these two users
        const roomId = [userId, matchedUser._id.toString()].sort().join('_');
        
        // Join both users to the room
        socket.join(roomId);
        io.sockets.sockets.get(matchedUserSocketId)?.join(roomId);
        
        // Notify both users about the match
        const user1MatchData = {
          matchedUser: {
            id: matchedUser._id.toString(),
            username: matchedUser.username,
            deviceId: matchedUser.deviceId,
            location: matchedUser.location,
            ip: matchedUser.ip
          },
          roomId: roomId
        };
        
        const user2MatchData = {
          matchedUser: {
            id: user._id.toString(),
            username: user.username,
            deviceId: user.deviceId,
            location: user.location,
            ip: user.ip
          },
          roomId: roomId
        };
        
        logger.info(`Sending match data to ${user.username}:`, JSON.stringify(user1MatchData));
        socket.emit('user:matched', user1MatchData);

        logger.info(`Sending match data to ${matchedUser.username}:`, JSON.stringify(user2MatchData));
        io.to(matchedUserSocketId).emit('user:matched', user2MatchData);
        
        // Notify room that users have joined
        io.to(roomId).emit('room:user_joined', {
          userId: user._id,
          username: user.username,
          message: `${user.username} has joined the chat`
        });
        
        io.to(roomId).emit('room:user_joined', {
          userId: matchedUser._id,
          username: matchedUser.username,
          message: `${matchedUser.username} has joined the chat`
        });

        logger.info(`Users matched: ${user.username} <-> ${matchedUser.username} in room ${roomId}`);
      } else {
        // If the matched user is no longer available, set this user back to searching
        await user.stopSearching();
        socket.emit('user:match:error', { message: 'Selected user is no longer available' });
      }

    } catch (error) {
      logger.error('User matching error:', error);
      // Make sure to stop searching in case of error
      try {
        const user = await User.findById(socket.userId);
        if (user) await user.stopSearching();
      } catch (e) {
        logger.error('Error stopping user search:', e);
      }
      socket.emit('user:match:error', { message: 'Matching failed' });
    }
  }

  // Handle chat message
  async function handleChatMessage(socket, data) {
    try {
      const userId = socket.userId;
      const user = await User.findById(userId);

      if (!user || !user.connectedUser) {
        socket.emit('chat:error', { message: 'You are not connected to any user' });
        return;
      }

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
        senderId: userId,
        senderUsername: user.username,
        type,
        content,
        timestamp: timestamp || new Date().toISOString()
      };

      const connectedUserSocketId = userSockets.get(user.connectedUser.toString());
      
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

        logger.info(`Message sent: ${user.username} -> ${user.connectedUser} (${type})`);
      } else {
        socket.emit('chat:error', { message: 'Connected user is not available' });
      }

    } catch (error) {
      logger.error('Chat message error:', error);
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  }

  // Handle chat clear (when user leaves current chat)
  async function handleChatClear(socket) {
    try {
      const userId = socket.userId;
      const user = await User.findById(userId);

      if (!user) {
        socket.emit('chat:error', { message: 'User not found' });
        return;
      }

      if (user.connectedUser) {
        const connectedUserSocketId = userSockets.get(user.connectedUser.toString());
        const connectedUser = await User.findById(user.connectedUser);
        
        // Create room ID the same way as in handleUserMatch
        const roomId = [userId, user.connectedUser.toString()].sort().join('_');
        
        // Notify the room that user has left
        io.to(roomId).emit('room:user_left', {
          userId: userId,
          username: user.username,
          message: `${user.username} has left the chat`
        });
        
        if (connectedUserSocketId) {
          // Notify connected user that chat is being cleared
          io.to(connectedUserSocketId).emit('chat:cleared', {
            userId: userId,
            username: user.username,
            reason: 'User left the chat'
          });

          // Disconnect the other user too
          if (connectedUser) {
            await connectedUser.disconnect();
          }
        }

        // Leave the room
        socket.leave(roomId);
        
        // Clean up temporary files for this room
        const deletedFilesCount = tempFileStorage.deleteRoomFiles(roomId);
        if (deletedFilesCount > 0) {
          logger.info(`Cleaned up ${deletedFilesCount} temporary files for room ${roomId}`);
        }
        
        // Disconnect current user
        await user.disconnect();
      }

      // Confirm chat clear to user
      socket.emit('chat:clear:confirmed', {
        message: 'Chat cleared successfully'
      });

      logger.info(`Chat cleared for user: ${user.username}`);

    } catch (error) {
      logger.error('Chat clear error:', error);
      socket.emit('chat:error', { message: 'Failed to clear chat' });
    }
  }

  // WebRTC Signaling Handlers
  async function handleWebRTCOffer(socket, data) {
    try {
      const userId = socket.userId;
      const user = await User.findById(userId);

      if (!user || !user.connectedUser) {
        socket.emit('webrtc:error', { message: 'You are not connected to any user' });
        return;
      }

      const { offer, type } = data; // type: 'audio' or 'video'
      const connectedUserSocketId = userSockets.get(user.connectedUser.toString());

      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('webrtc:offer', {
          offer,
          type,
          from: userId,
          fromUsername: user.username
        });

        logger.info(`WebRTC offer sent: ${user.username} -> ${user.connectedUser} (${type})`);
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
      const userId = socket.userId;
      const user = await User.findById(userId);

      if (!user || !user.connectedUser) {
        socket.emit('webrtc:error', { message: 'You are not connected to any user' });
        return;
      }

      const { answer } = data;
      const connectedUserSocketId = userSockets.get(user.connectedUser.toString());

      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('webrtc:answer', {
          answer,
          from: userId,
          fromUsername: user.username
        });

        logger.info(`WebRTC answer sent: ${user.username} -> ${user.connectedUser}`);
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
      const userId = socket.userId;
      const user = await User.findById(userId);

      if (!user || !user.connectedUser) {
        socket.emit('webrtc:error', { message: 'You are not connected to any user' });
        return;
      }

      const { candidate } = data;
      const connectedUserSocketId = userSockets.get(user.connectedUser.toString());

      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('webrtc:ice-candidate', {
          candidate,
          from: userId
        });

        logger.debug(`ICE candidate sent: ${user.username} -> ${user.connectedUser}`);
      } else {
        socket.emit('webrtc:error', { message: 'Connected user is not available' });
      }

    } catch (error) {
      logger.error('ICE candidate error:', error);
      socket.emit('webrtc:error', { message: 'Failed to send ICE candidate' });
    }
  }

  // Handle cancellation of matching request
  async function handleCancelMatch(socket, data) {
    try {
      const userId = socket.userId;
      const user = await User.findById(userId);

      if (!user) {
        socket.emit('user:match:cancel:error', { message: 'User not found' });
        return;
      }

      // Stop searching for a match
      await user.stopSearching();
      
      // Notify the user that they are no longer searching
      socket.emit('user:match:cancelled', { message: 'Matching cancelled' });
      
      logger.info(`User ${user.username} cancelled matching`);

    } catch (error) {
      logger.error('Match cancellation error:', error);
      socket.emit('user:match:cancel:error', { message: 'Failed to cancel matching' });
    }
  }

  // Handle user leaving room (route change or explicit leave)
  async function handleLeaveRoom(socket) {
    try {
      const userId = socket.userId;
      const user = await User.findById(userId);
      
      if (!user) {
        socket.emit('room:leave:error', { message: 'User not found' });
        return;
      }
      
      if (user.connectedUser) {
        const connectedUserId = user.connectedUser.toString();
        const connectedUserSocketId = userSockets.get(connectedUserId);
        const connectedUser = await User.findById(connectedUserId);
        
        // Create room ID the same way as in handleUserMatch
        const roomId = [userId, connectedUserId].sort().join('_');
        
        // Notify the room and connected user that this user has left
        if (connectedUserSocketId) {
          io.to(connectedUserSocketId).emit('room:closed', {
            userId: userId,
            username: user.username,
            message: `The other user has left. Room closed.`,
            reason: 'user_left'
          });
          
          // Disconnect the other user too
          if (connectedUser) {
            await connectedUser.disconnect();
          }
        }
        
        // Leave the room
        socket.leave(roomId);
        
        // Disconnect current user
        await user.disconnect();
        
        logger.info(`User ${user.username} left room ${roomId}`);
      }
      
      // Confirm room leave to user
      socket.emit('room:left', {
        message: 'Successfully left the room'
      });
      
    } catch (error) {
      logger.error('Leave room error:', error);
      socket.emit('room:leave:error', { message: 'Failed to leave room' });
    }
  }
  
  // Handle explicit room closure
  async function handleCloseRoom(socket) {
    try {
      const userId = socket.userId;
      const user = await User.findById(userId);
      
      if (!user) {
        socket.emit('room:close:error', { message: 'User not found' });
        return;
      }
      
      if (user.connectedUser) {
        const connectedUserId = user.connectedUser.toString();
        const connectedUserSocketId = userSockets.get(connectedUserId);
        const connectedUser = await User.findById(connectedUserId);
        
        // Create room ID the same way as in handleUserMatch
        const roomId = [userId, connectedUserId].sort().join('_');
        
        // Broadcast room closure to all participants
        io.to(roomId).emit('room:closed', {
          userId: userId,
          username: user.username,
          message: `${user.username} closed the room.`,
          reason: 'room_closed'
        });
        
        // Disconnect both users
        await user.disconnect();
        if (connectedUser) {
          await connectedUser.disconnect();
        }
        
        // Both users leave the room
        socket.leave(roomId);
        if (connectedUserSocketId) {
          io.sockets.sockets.get(connectedUserSocketId)?.leave(roomId);
        }
        
        // Clean up temporary files for this room
        const deletedFilesCount = tempFileStorage.deleteRoomFiles(roomId);
        if (deletedFilesCount > 0) {
          logger.info(`Cleaned up ${deletedFilesCount} temporary files for room ${roomId}`);
        }
        
        logger.info(`Room ${roomId} closed by user ${user.username}`);
      }
      
    } catch (error) {
      logger.error('Close room error:', error);
      socket.emit('room:close:error', { message: 'Failed to close room' });
    }
  }

  // WebRTC Call End Handler
  async function handleWebRTCCallEnd(socket, data) {
    try {
      const userId = socket.userId;
      const user = await User.findById(userId);

      if (!user || !user.connectedUser) {
        socket.emit('webrtc:error', { message: 'You are not connected to any user' });
        return;
      }

      const connectedUserSocketId = userSockets.get(user.connectedUser.toString());

      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('webrtc:call-end', {
          from: userId,
          fromUsername: user.username
        });

        logger.info(`WebRTC call ended: ${user.username} -> ${user.connectedUser}`);
      } else {
        socket.emit('webrtc:error', { message: 'Connected user is not available' });
      }

    } catch (error) {
      logger.error('WebRTC call end error:', error);
      socket.emit('webrtc:error', { message: 'Failed to end call' });
    }
  }

  // WebRTC Call Reject Handler
  async function handleWebRTCCallReject(socket, data) {
    try {
      const userId = socket.userId;
      const user = await User.findById(userId);

      if (!user || !user.connectedUser) {
        socket.emit('webrtc:error', { message: 'You are not connected to any user' });
        return;
      }

      const connectedUserSocketId = userSockets.get(user.connectedUser.toString());

      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('webrtc:call-reject', {
          from: userId,
          fromUsername: user.username
        });

        logger.info(`WebRTC call rejected: ${user.username} -> ${user.connectedUser}`);
      } else {
        socket.emit('webrtc:error', { message: 'Connected user is not available' });
      }

    } catch (error) {
      logger.error('WebRTC call reject error:', error);
      socket.emit('webrtc:error', { message: 'Failed to reject call' });
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
    handleLeaveRoom,
    handleCloseRoom
  };
}

module.exports = {
  createSocketHandlers,
  connectedUsers,
  userSockets
};
