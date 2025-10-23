const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../config/logger');

class RedisGuestManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.fallbackStorage = new Map(); // Fallback to in-memory if Redis fails
  }

  async initialize() {
    if (process.env.REDIS_URL) {
      try {
        this.client = redis.createClient({
          url: process.env.REDIS_URL,
          socket: {
            reconnectDelay: 50,
            reconnectDelayMax: 500,
            maxRetriesPerRequest: 3
          },
          retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              logger.warn('Redis connection refused, using fallback storage');
              return undefined;
            }
            return Math.min(options.attempt * 100, 3000);
          }
        });

        this.client.on('error', (err) => {
          logger.error('Redis client error:', err);
          this.isConnected = false;
        });

        this.client.on('connect', () => {
          logger.info('Connected to Redis for guest management');
          this.isConnected = true;
        });

        this.client.on('ready', () => {
          logger.info('Redis client ready for guest management');
          this.isConnected = true;
        });

        this.client.on('end', () => {
          logger.warn('Redis connection closed, falling back to in-memory storage');
          this.isConnected = false;
        });

        await this.client.connect();
        logger.info('Redis Guest Manager initialized successfully');
      } catch (error) {
        logger.warn('Failed to initialize Redis, using in-memory fallback:', error.message);
        this.isConnected = false;
      }
    } else {
      logger.info('No REDIS_URL provided, using in-memory guest storage');
    }

    // Start cleanup interval
    this.startCleanupInterval();
  }

  // Generate random guest username
  generateGuestUsername() {
    const adjectives = [
      'Cool', 'Happy', 'Smart', 'Brave', 'Kind', 'Quick', 'Bright', 'Calm', 'Swift', 'Bold',
      'Wise', 'Nice', 'Fun', 'Wild', 'Free', 'Pure', 'Fast', 'True', 'Good', 'Fair'
    ];

    const nouns = [
      'Panda', 'Tiger', 'Eagle', 'Wolf', 'Fox', 'Bear', 'Lion', 'Shark', 'Hawk', 'Owl',
      'Cat', 'Dog', 'Bird', 'Fish', 'Deer', 'Frog', 'Duck', 'Bee', 'Star', 'Moon'
    ];

    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 9999) + 1;
    return `${randomAdjective}${randomNoun}${randomNumber}`;
  }

  // Create a new guest session
  async createGuestSession(username = null) {
    const sessionId = uuidv4();
    const guestId = `guest_${uuidv4()}`;
    const guestUsername = username && username.trim() ? username.trim() : this.generateGuestUsername();
    
    const guestSession = {
      id: guestId,
      sessionId,
      username: guestUsername,
      isOnline: false, // Will be set to true when socket connects
      lastSeen: new Date().toISOString(),
      isSearching: false,
      inChat: false,
      connectedUser: null,
      socketId: null,
      location: null,
      gender: null,
      language: null,
      createdAt: new Date().toISOString(),
      connectedAt: null
    };

    const key = `guest:${sessionId}`;
    const expirySeconds = 2 * 60 * 60; // 2 hours

    if (this.isConnected && this.client) {
      try {
        await this.client.setEx(key, expirySeconds, JSON.stringify(guestSession));
        logger.info(`Guest session created in Redis: ${guestUsername} (${sessionId})`);
      } catch (error) {
        logger.error('Redis setEx error:', error);
        // Fallback to in-memory
        this.fallbackStorage.set(sessionId, {
          ...guestSession,
          expiresAt: new Date(Date.now() + expirySeconds * 1000)
        });
        logger.info(`Guest session created in fallback storage: ${guestUsername} (${sessionId})`);
      }
    } else {
      // Use fallback storage
      this.fallbackStorage.set(sessionId, {
        ...guestSession,
        expiresAt: new Date(Date.now() + expirySeconds * 1000)
      });
      logger.info(`Guest session created in fallback storage: ${guestUsername} (${sessionId})`);
    }

    return guestSession;
  }

  // Get guest session by sessionId
  async getGuestSession(sessionId) {
    const key = `guest:${sessionId}`;

    if (this.isConnected && this.client) {
      try {
        const data = await this.client.get(key);
        if (data) {
          return JSON.parse(data);
        }
      } catch (error) {
        logger.error('Redis get error:', error);
        // Fall through to fallback
      }
    }

    // Check fallback storage
    const fallbackSession = this.fallbackStorage.get(sessionId);
    if (fallbackSession && fallbackSession.expiresAt > new Date()) {
      return fallbackSession;
    }

    return null;
  }

  // Update guest presence/status
  async updateGuestPresence(sessionId, updates) {
    const guestSession = await this.getGuestSession(sessionId);
    if (!guestSession) {
      return null;
    }

    const updatedSession = {
      ...guestSession,
      ...updates,
      lastSeen: new Date().toISOString()
    };

    const key = `guest:${sessionId}`;
    const expirySeconds = 2 * 60 * 60; // 2 hours

    if (this.isConnected && this.client) {
      try {
        await this.client.setEx(key, expirySeconds, JSON.stringify(updatedSession));
      } catch (error) {
        logger.error('Redis setEx error:', error);
        // Update fallback storage
        const fallbackSession = this.fallbackStorage.get(sessionId);
        if (fallbackSession) {
          Object.assign(fallbackSession, updates);
          fallbackSession.lastSeen = new Date().toISOString();
          this.fallbackStorage.set(sessionId, fallbackSession);
        }
      }
    } else {
      // Update fallback storage
      const fallbackSession = this.fallbackStorage.get(sessionId);
      if (fallbackSession) {
        Object.assign(fallbackSession, updates);
        fallbackSession.lastSeen = new Date().toISOString();
        this.fallbackStorage.set(sessionId, fallbackSession);
      }
    }

    return updatedSession;
  }

  // Get all online guests
  async getAllOnlineGuests() {
    const onlineGuests = [];

    if (this.isConnected && this.client) {
      try {
        const keys = await this.client.keys('guest:*');
        for (const key of keys) {
          const data = await this.client.get(key);
          if (data) {
            const guest = JSON.parse(data);
            if (guest.isOnline) {
              onlineGuests.push({
                id: guest.id,
                sessionId: guest.sessionId,
                username: guest.username,
                isOnline: guest.isOnline,
                isSearching: guest.isSearching,
                lastSeen: guest.lastSeen,
                connectedUser: guest.connectedUser,
                location: guest.location,
                gender: guest.gender,
                language: guest.language
              });
            }
          }
        }
      } catch (error) {
        logger.error('Redis keys/get error:', error);
        // Fall through to fallback
      }
    }

    // Also check fallback storage
    const now = new Date();
    for (const [sessionId, guest] of this.fallbackStorage.entries()) {
      if (guest.isOnline && guest.expiresAt > now) {
        // Avoid duplicates if Redis also returned this guest
        const exists = onlineGuests.find(g => g.sessionId === sessionId);
        if (!exists) {
          onlineGuests.push({
            id: guest.id,
            sessionId: guest.sessionId,
            username: guest.username,
            isOnline: guest.isOnline,
            isSearching: guest.isSearching,
            lastSeen: guest.lastSeen,
            connectedUser: guest.connectedUser,
            location: guest.location,
            gender: guest.gender,
            language: guest.language
          });
        }
      }
    }

    return onlineGuests;
  }

  // Get guest statistics
  async getGuestStats() {
    let totalGuests = 0;
    let onlineGuests = 0;
    let searchingGuests = 0;
    let connectedGuests = 0;

    if (this.isConnected && this.client) {
      try {
        const keys = await this.client.keys('guest:*');
        for (const key of keys) {
          const data = await this.client.get(key);
          if (data) {
            const guest = JSON.parse(data);
            totalGuests++;
            if (guest.isOnline) {
              onlineGuests++;
              if (guest.isSearching) {
                searchingGuests++;
              }
              if (guest.connectedUser) {
                connectedGuests++;
              }
            }
          }
        }
      } catch (error) {
        logger.error('Redis stats error:', error);
        // Fall through to fallback
      }
    }

    // Also count fallback storage
    const now = new Date();
    for (const [sessionId, guest] of this.fallbackStorage.entries()) {
      if (guest.expiresAt > now) {
        totalGuests++;
        if (guest.isOnline) {
          onlineGuests++;
          if (guest.isSearching) {
            searchingGuests++;
          }
          if (guest.connectedUser) {
            connectedGuests++;
          }
        }
      }
    }

    return {
      totalUsers: totalGuests,
      onlineUsers: onlineGuests,
      availableUsers: searchingGuests,
      connectedUsers: connectedGuests / 2 // Divide by 2 since each connection involves 2 users
    };
  }

  // Remove guest session
  async removeGuestSession(sessionId) {
    const key = `guest:${sessionId}`;

    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch (error) {
        logger.error('Redis del error:', error);
      }
    }

    // Also remove from fallback storage
    this.fallbackStorage.delete(sessionId);
  }

  // Increment active user count
  async incrementActiveUserCount() {
    const key = 'active_user_count';
    
    if (this.isConnected && this.client) {
      try {
        const count = await this.client.incr(key);
        await this.client.expire(key, 300); // Expire after 5 minutes of inactivity
        return count;
      } catch (error) {
        logger.error('Redis incr error:', error);
      }
    }
    
    return null;
  }

  // Decrement active user count
  async decrementActiveUserCount() {
    const key = 'active_user_count';
    
    if (this.isConnected && this.client) {
      try {
        const count = await this.client.decr(key);
        // Don't let it go below 0
        if (count < 0) {
          await this.client.set(key, '0');
          return 0;
        }
        return count;
      } catch (error) {
        logger.error('Redis decr error:', error);
      }
    }
    
    return null;
  }

  // Get current active user count
  async getActiveUserCount() {
    const key = 'active_user_count';
    
    if (this.isConnected && this.client) {
      try {
        const count = await this.client.get(key);
        return parseInt(count || '0', 10);
      } catch (error) {
        logger.error('Redis get error:', error);
      }
    }
    
    return 0;
  }

  // Clean up expired sessions (for fallback storage)
  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, guest] of this.fallbackStorage.entries()) {
      if (guest.expiresAt && guest.expiresAt < now) {
        this.fallbackStorage.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned ${cleanedCount} expired guest sessions from fallback storage`);
    }

    return cleanedCount;
  }

  // Start cleanup interval
  startCleanupInterval() {
    // Clean up expired sessions every 10 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 10 * 60 * 1000);

    logger.info('Guest session cleanup interval started');
  }

  // Graceful shutdown
  async close() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        logger.info('Redis Guest Manager connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection:', error);
      }
    }
  }
}

// Create singleton instance
const redisGuestManager = new RedisGuestManager();

module.exports = redisGuestManager;