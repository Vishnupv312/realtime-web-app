# Presence and Statistics System

<cite>
**Referenced Files in This Document**
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js)
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js)
- [socketServer.js](file://backend/src/socket/socketServer.js)
- [guestController.js](file://backend/src/controllers/guestController.js)
- [stats.js](file://backend/src/routes/stats.js)
- [socket.ts](file://web/lib/socket.ts)
- [GuestSessionContext.tsx](file://web/contexts/GuestSessionContext.tsx)
- [socketHandlers.connection.test.js](file://backend/src/socket/__tests__/socketHandlers.connection.test.js)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [User Presence Tracking](#user-presence-tracking)
4. [Statistics Collection](#statistics-collection)
5. [Redis Persistence Layer](#redis-persistence-layer)
6. [Broadcasting Mechanism](#broadcasting-mechanism)
7. [Frontend Integration](#frontend-integration)
8. [Heartbeat and Connection Management](#heartbeat-and-connection-management)
9. [Error Handling and Race Conditions](#error-handling-and-race-conditions)
10. [Performance Considerations](#performance-considerations)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Conclusion](#conclusion)

## Introduction

The Presence and Statistics System is a comprehensive real-time monitoring solution that tracks user activity, maintains online status, and provides live statistics for the chat application. Built on a WebSocket-based architecture with Redis persistence, it ensures reliable presence tracking even in high-concurrency environments with distributed deployments.

The system monitors four primary presence states: online status, searching state for matches, connection status, and active user engagement. It maintains real-time statistics including total users, online users, active users, available users, and connected users, broadcasting updates to all connected clients via the 'realtime:stats' event.

## System Architecture

The Presence and Statistics System follows a layered architecture with clear separation of concerns:

```mermaid
graph TB
subgraph "Frontend Layer"
UI[User Interface]
SocketClient[Socket Client]
Context[Guest Session Context]
end
subgraph "WebSocket Layer"
SocketServer[Socket.IO Server]
SocketHandlers[Socket Handlers]
AuthMiddleware[Authentication Middleware]
end
subgraph "Business Logic Layer"
GuestController[Guest Controller]
StatsController[Statistics Controller]
PresenceManager[Presence Manager]
end
subgraph "Data Layer"
Redis[Redis Cluster]
Fallback[Fallback Storage]
ActiveCount[Active User Counter]
end
UI --> SocketClient
SocketClient --> SocketServer
SocketServer --> SocketHandlers
SocketHandlers --> AuthMiddleware
AuthMiddleware --> GuestController
GuestController --> PresenceManager
PresenceManager --> Redis
PresenceManager --> Fallback
PresenceManager --> ActiveCount
SocketHandlers --> StatsController
StatsController --> Redis
SocketServer --> SocketClient
```

**Diagram sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L1-L199)
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L1-L771)
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L1-L432)

**Section sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L1-L199)
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L1-L771)

## User Presence Tracking

### Presence States and Transitions

The system tracks user presence through four distinct states:

| State | Description | Redis Field | Frontend Event |
|-------|-------------|-------------|----------------|
| Online | User is connected to the server | `isOnline: true/false` | `presence:online` |
| Searching | User is actively looking for matches | `isSearching: true/false` | `presence:searching` |
| Connected | User is in a chat session | `connectedUser: userId/null` | `presence:connected` |
| Active | User has recent activity | `lastSeen: timestamp` | `presence:heartbeat` |

### Presence Update Mechanisms

```mermaid
sequenceDiagram
participant Client as "Frontend Client"
participant Socket as "Socket Service"
participant Handler as "Socket Handler"
participant Redis as "Redis Manager"
participant Broadcast as "Broadcast System"
Client->>Socket : sendHeartbeat()
Socket->>Handler : emit('presence : heartbeat')
Handler->>Redis : updateGuestPresence(sessionId, {lastSeen})
Redis-->>Handler : Updated session
Handler->>Broadcast : broadcastUserStats()
Broadcast->>Socket : io.emit('realtime : stats')
Socket-->>Client : realtime : stats event
```

**Diagram sources**
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L697-L743)
- [socket.ts](file://web/lib/socket.ts#L278-L330)

### Connection Lifecycle Management

The system handles complete connection lifecycles with automatic cleanup:

```mermaid
stateDiagram-v2
[*] --> Disconnected
Disconnected --> Connecting : handleConnection()
Connecting --> Connected : Authentication Success
Connecting --> Disconnected : Authentication Failure
Connected --> Online : Presence Update
Online --> Searching : Match Request
Searching --> Online : Match Cancelled
Searching --> Connected : Match Found
Connected --> Online : Chat Ended
Connected --> Disconnected : Network Error
Online --> Disconnected : handleDisconnection()
Disconnected --> [*]
```

**Diagram sources**
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L10-L150)

**Section sources**
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L10-L150)
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L149-L202)

## Statistics Collection

### Statistical Metrics

The system maintains five key statistical metrics:

| Metric | Description | Calculation Method | Redis Key |
|--------|-------------|-------------------|-----------|
| Total Users | All guest accounts created | Count all `guest:*` keys | N/A |
| Online Users | Currently connected users | Filter `isOnline: true` | N/A |
| Active Users | Users with recent activity | Redis counter (`active_user_count`) | `active_user_count` |
| Available Users | Users searching for matches | Filter `isSearching: true` | N/A |
| Connected Users | Users in active chat sessions | Count `connectedUser` fields | N/A |

### Statistics Calculation Process

```mermaid
flowchart TD
Start([Statistics Request]) --> CheckRedis{Redis Available?}
CheckRedis --> |Yes| ScanKeys[Scan guest:* Keys]
CheckRedis --> |No| UseFallback[Use Fallback Storage]
ScanKeys --> ParseData[Parse JSON Data]
ParseData --> CountMetrics[Count Each Metric]
UseFallback --> CountFallback[Count Fallback Entries]
CountMetrics --> CalculateConnected[Calculate Connected Users]
CountFallback --> CalculateConnected
CalculateConnected --> IncrementActive[Increment Active Counter]
IncrementActive --> ReturnStats[Return Statistics]
ReturnStats --> End([Complete])
```

**Diagram sources**
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L233-L318)

**Section sources**
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L233-L318)
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L697-L743)

## Redis Persistence Layer

### Redis Configuration and Connection Management

The Redis Guest Manager implements robust connection handling with automatic fallback capabilities:

```mermaid
classDiagram
class RedisGuestManager {
+client : RedisClient
+isConnected : boolean
+fallbackStorage : Map
+initialize() Promise~void~
+createGuestSession() Promise~GuestSession~
+updateGuestPresence() Promise~GuestSession~
+getGuestStats() Promise~Stats~
+incrementActiveUserCount() Promise~number~
+decrementActiveUserCount() Promise~number~
+cleanupExpiredSessions() number
}
class RedisClient {
+setEx(key, ttl, value) Promise~void~
+get(key) Promise~string~
+keys(pattern) Promise~string[]~
+del(key) Promise~number~
+incr(key) Promise~number~
+decr(key) Promise~number~
+expire(key, ttl) Promise~boolean~
}
class FallbackStorage {
+Map~string,GuestSession~
+set(sessionId, session) void
+delete(sessionId) boolean
+get(sessionId) GuestSession
}
RedisGuestManager --> RedisClient : uses
RedisGuestManager --> FallbackStorage : falls back to
```

**Diagram sources**
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L1-L432)

### Data Expiration and Cleanup

The system implements intelligent data expiration:

- **Session Expiry**: 2-hour TTL for guest sessions
- **Active User Counter**: 5-minute TTL with auto-expiration
- **Fallback Cleanup**: 10-minute interval cleanup of expired sessions

**Section sources**
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L1-L432)

## Broadcasting Mechanism

### Real-time Statistics Broadcasting

The system broadcasts updated statistics to all connected clients using Socket.IO's `io.emit()` method:

```mermaid
sequenceDiagram
participant Handler as "Socket Handler"
participant StatsCalc as "Statistics Calculator"
participant Redis as "Redis Manager"
participant IO as "Socket.IO"
participant Clients as "Connected Clients"
Handler->>StatsCalc : broadcastUserStats()
StatsCalc->>Redis : getGuestStats()
Redis-->>StatsCalc : Statistics data
StatsCalc->>Redis : getActiveUserCount()
Redis-->>StatsCalc : Active count
StatsCalc->>Redis : getAllOnlineGuests()
Redis-->>StatsCalc : Online users list
StatsCalc->>IO : io.emit('realtime : stats')
IO->>Clients : Send statistics update
Clients->>Clients : Update UI components
```

**Diagram sources**
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L697-L743)

### Broadcast Events and Payload Structure

| Event | Purpose | Payload Structure |
|-------|---------|-------------------|
| `realtime:stats` | Push statistics to all clients | `{stats, onlineUsers, timestamp}` |
| `stats:update` | Update individual client | `{stats, timestamp}` |
| `users:online:update` | Update online users list | `[UserObject...]` |

**Section sources**
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L697-L743)

## Frontend Integration

### Socket Service Implementation

The frontend socket service manages real-time presence and statistics:

```mermaid
classDiagram
class SocketService {
+socket : Socket
+isConnected : boolean
+currentUser : GuestUser
+connectionCallbacks : Function[]
+connect(guestUser) Socket
+updateOnlineStatus(isOnline) void
+sendHeartbeat() void
+requestStats() void
+onConnectionChange(callback) Function
+handleTokenExpiration() Promise~void~
}
class GuestSessionContext {
+guestUser : GuestUser
+realTimeStats : Stats
+onlineUsers : User[]
+initializeGuestSession() Promise~void~
+setOnlineStatus(isOnline) void
+generateGuestUsername() string
+clearGuestSession() void
}
SocketService --> GuestSessionContext : updates
GuestSessionContext --> SocketService : uses
```

**Diagram sources**
- [socket.ts](file://web/lib/socket.ts#L1-L474)
- [GuestSessionContext.tsx](file://web/contexts/GuestSessionContext.tsx#L1-L453)

### Statistics Display Integration

The frontend integrates statistics through React context and real-time updates:

```mermaid
flowchart LR
SocketService[Socket Service] --> Context[Guest Session Context]
Context --> StatsUI[Statistics UI]
Context --> UserList[Online Users List]
StatsUI --> TotalUsers[Total Users Display]
StatsUI --> OnlineUsers[Online Users Display]
StatsUI --> AvailableUsers[Available Users Display]
StatsUI --> ConnectedUsers[Connected Users Display]
UserList --> UserCards[User Card Components]
```

**Diagram sources**
- [GuestSessionContext.tsx](file://web/contexts/GuestSessionContext.tsx#L119-L139)

**Section sources**
- [socket.ts](file://web/lib/socket.ts#L1-L474)
- [GuestSessionContext.tsx](file://web/contexts/GuestSessionContext.tsx#L1-L453)

## Heartbeat and Connection Management

### Heartbeat Mechanism

The system implements a robust heartbeat mechanism for presence validation:

```mermaid
sequenceDiagram
participant Client as "Frontend Client"
participant Socket as "Socket Service"
participant Server as "Socket Handler"
participant Redis as "Redis Manager"
loop Every 30 seconds
Client->>Socket : sendHeartbeat()
Socket->>Server : emit('presence : heartbeat')
Server->>Redis : updateGuestPresence(lastSeen)
Redis-->>Server : Updated timestamp
Server->>Server : Check for stale presence
alt Stale presence detected
Server->>Redis : Mark as offline
Server->>Server : Broadcast presence update
end
end
```

**Diagram sources**
- [socket.ts](file://web/lib/socket.ts#L278-L330)
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L697-L743)

### Connection Resilience Features

The system includes comprehensive connection resilience:

- **Automatic Reconnection**: Configurable retry attempts with exponential backoff
- **Token Refresh**: Automatic JWT token regeneration on expiration
- **Session Recovery**: Ability to recover from network interruptions
- **Graceful Degradation**: Fallback to in-memory storage when Redis unavailable

**Section sources**
- [socket.ts](file://web/lib/socket.ts#L60-L200)
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L15-L60)

## Error Handling and Race Conditions

### Race Condition Prevention

The system addresses several potential race conditions:

| Race Condition | Prevention Strategy | Implementation |
|----------------|-------------------|----------------|
| Concurrent Updates | Atomic Redis operations | `SET` with TTL |
| Stale Presence Data | Timestamp validation | Compare `lastSeen` timestamps |
| Session Cleanup | Synchronized cleanup | Redis expiration + fallback cleanup |
| High Concurrency | Rate limiting | Per-user request throttling |

### Error Handling Patterns

```mermaid
flowchart TD
Error[Error Occurred] --> CheckType{Error Type}
CheckType --> |Redis Error| FallbackToMemory[Use Fallback Storage]
CheckType --> |Network Error| RetryWithBackoff[Retry with Backoff]
CheckType --> |Authentication Error| RegenerateToken[Regenerate JWT]
CheckType --> |Concurrent Access| LockMechanism[Apply Lock Mechanism]
FallbackToMemory --> LogError[Log Error Details]
RetryWithBackoff --> LogError
RegenerateToken --> LogError
LockMechanism --> LogError
LogError --> ContinueOperation[Continue Operation]
ContinueOperation --> MonitorHealth[Monitor System Health]
```

**Diagram sources**
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L149-L202)

### Stale Data Mitigation

The system implements multiple strategies to prevent stale presence data:

- **Timestamp Validation**: Regular heartbeat updates with timestamp comparison
- **Session Expiry**: Automatic cleanup of expired sessions
- **Fallback Monitoring**: Continuous monitoring of fallback storage health
- **Health Checks**: Periodic validation of presence data consistency

**Section sources**
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L149-L202)
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L10-L150)

## Performance Considerations

### Scalability Features

The Presence and Statistics System is designed for high-performance operation:

- **Redis Clustering**: Support for Redis cluster deployment
- **Connection Pooling**: Efficient Redis client management
- **Rate Limiting**: Per-user request throttling to prevent abuse
- **Lazy Loading**: On-demand statistics calculation
- **Caching Strategy**: Intelligent caching of frequently accessed data

### Memory Management

The system implements efficient memory management:

- **Garbage Collection**: Automatic cleanup of expired sessions
- **Connection Mapping**: Optimized data structures for user tracking
- **Fallback Storage**: In-memory storage with automatic cleanup
- **Statistics Aggregation**: Efficient aggregation algorithms

### Performance Monitoring

Key performance metrics include:

- **Response Times**: Average response times for presence updates
- **Throughput**: Messages processed per second
- **Error Rates**: Frequency of errors and failures
- **Resource Usage**: Memory and CPU utilization patterns

## Troubleshooting Guide

### Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Stale Presence Data | Users appear online when offline | Restart Redis or check heartbeat intervals |
| High Memory Usage | Increasing memory consumption | Check for memory leaks in fallback storage |
| Connection Drops | Frequent disconnections | Verify Redis connectivity and network stability |
| Slow Statistics | Delayed statistics updates | Optimize Redis queries and indexing |

### Diagnostic Commands

```bash
# Check Redis connectivity
redis-cli ping

# Monitor Redis keys
redis-cli keys "guest:*"

# Check active connections
redis-cli info clients

# Monitor Redis memory usage
redis-cli info memory
```

### Logging and Monitoring

The system provides comprehensive logging:

- **Connection Events**: Detailed logs for connection/disconnection
- **Presence Updates**: Logs for presence state changes
- **Error Events**: Comprehensive error logging with stack traces
- **Performance Metrics**: Timing information for critical operations

**Section sources**
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L15-L60)
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L10-L150)

## Conclusion

The Presence and Statistics System provides a robust, scalable solution for real-time user presence tracking and statistics collection. Its architecture balances performance, reliability, and scalability while maintaining simplicity in implementation and operation.

Key strengths of the system include:

- **Reliability**: Redis-based persistence with automatic fallback
- **Scalability**: Support for distributed deployments with Redis clustering
- **Real-time Updates**: Instant statistics broadcasting to all clients
- **Resilience**: Comprehensive error handling and recovery mechanisms
- **Performance**: Optimized data structures and caching strategies

The system successfully addresses the challenges of maintaining accurate presence information in high-concurrency environments while providing a seamless user experience through real-time statistics updates.

Future enhancements could include advanced analytics, predictive user behavior modeling, and enhanced monitoring capabilities to further improve the system's intelligence and operational insights.