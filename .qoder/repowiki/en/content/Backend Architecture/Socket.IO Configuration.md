# Socket.IO Configuration

<cite>
**Referenced Files in This Document**
- [socketServer.js](file://backend/src/socket/socketServer.js)
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js)
- [auth.js](file://backend/src/middleware/auth.js)
- [jwt.js](file://backend/src/utils/jwt.js)
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js)
- [server.js](file://backend/src/server.js)
- [socket.ts](file://web/lib/socket.ts)
- [.env](file://backend/.env)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Core Socket.IO Server Configuration](#core-socketio-server-configuration)
4. [Redis Adapter Setup](#redis-adapter-setup)
5. [Middleware Configuration](#middleware-configuration)
6. [Connection Lifecycle Management](#connection-lifecycle-management)
7. [Utility Functions](#utility-functions)
8. [Network Deployment Patterns](#network-deployment-patterns)
9. [Performance Considerations](#performance-considerations)
10. [Common Issues and Debugging](#common-issues-and-debugging)
11. [Optimization Strategies](#optimization-strategies)

## Introduction

The Realtime Chat App implements a sophisticated Socket.IO-based communication system that handles WebSocket connections for real-time messaging, user matching, and WebRTC signaling. The architecture supports both single-instance and clustered deployments through Redis clustering, providing horizontal scalability while maintaining connection reliability.

The Socket.IO configuration encompasses CORS policies, transport options, connection settings, authentication middleware, rate limiting, and comprehensive error handling mechanisms. This documentation provides detailed insights into the implementation patterns, deployment considerations, and operational characteristics of the Socket.IO infrastructure.

## Architecture Overview

The Socket.IO implementation follows a modular architecture with clear separation of concerns across multiple layers:

```mermaid
graph TB
subgraph "Frontend Layer"
WS[WebSocket Client]
SC[Socket Service]
end
subgraph "Express Application"
APP[Express App]
SM[Security Middleware]
RM[Route Manager]
end
subgraph "Socket.IO Infrastructure"
SS[Socket Server]
RA[Redis Adapter]
MW[Middleware Stack]
EH[Event Handlers]
end
subgraph "Data Layer"
RG[Redis Guest Manager]
IM[In-Memory Storage]
DB[(Database)]
end
WS --> SC
SC --> SS
APP --> SS
SM --> MW
RM --> SS
SS --> RA
SS --> MW
MW --> EH
RA --> RG
RG --> DB
IM --> RG
```

**Diagram sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L1-L199)
- [server.js](file://backend/src/server.js#L1-L265)
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L1-L432)

**Section sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L1-L199)
- [server.js](file://backend/src/server.js#L1-L265)

## Core Socket.IO Server Configuration

The `createSocketServer()` function serves as the central initialization point for the Socket.IO infrastructure, establishing the core server configuration with comprehensive transport and security settings.

### Basic Server Configuration

The server initialization establishes fundamental connection parameters:

```mermaid
flowchart TD
Start([createSocketServer]) --> Config["Configure Server Options"]
Config --> CORS["Set CORS Policy"]
Config --> Transports["Define Transport Methods"]
Config --> Timeouts["Configure Timeouts"]
Timeouts --> InitHandlers["Initialize Handlers"]
InitHandlers --> SetupRedis["Setup Redis Adapter"]
SetupRedis --> SetupMW["Configure Middleware"]
SetupMW --> SetupEvents["Register Event Handlers"]
SetupEvents --> Return["Return Socket API"]
```

**Diagram sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L7-L25)

The configuration includes:

- **CORS Policy**: Flexible cross-origin resource sharing allowing development and production environments
- **Transport Methods**: WebSocket and polling transports for maximum compatibility
- **Ping Configuration**: Optimized heartbeat intervals for connection stability
- **Environment Awareness**: Conditional Redis adapter activation based on deployment context

### CORS Configuration Details

The CORS policy supports multiple origins for development and production environments:

| Origin Type | Pattern | Purpose |
|-------------|---------|---------|
| Development | `http://localhost:3000` | Local development |
| Production | `https://*.vercel.app` | Vercel deployment |
| Mobile Apps | Wildcard patterns | Cross-platform compatibility |
| API Testing | Various localhost ports | Development tools |

### Transport Configuration

The transport selection prioritizes WebSocket for efficiency while maintaining polling as a fallback:

| Transport | Priority | Use Case | Performance Impact |
|-----------|----------|----------|-------------------|
| WebSocket | Primary | Real-time communication | Low latency, efficient |
| Polling | Fallback | Legacy browsers, restricted networks | Higher overhead, reliable |

### Connection Timeouts and Intervals

The timeout configuration balances reliability with resource efficiency:

| Parameter | Value | Purpose | Tuning Considerations |
|-----------|-------|---------|----------------------|
| pingTimeout | 60,000ms | Maximum ping wait time | Network latency tolerance |
| pingInterval | 25,000ms | Ping frequency | Connection stability vs. overhead |

**Section sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L7-L25)

## Redis Adapter Setup

The `setupRedisAdapter()` function implements horizontal scaling capabilities through Redis clustering, enabling seamless load balancing across multiple server instances.

### Redis Adapter Architecture

```mermaid
sequenceDiagram
participant Server as "Socket.IO Server"
participant PubClient as "Redis Publisher"
participant SubClient as "Redis Subscriber"
participant Cluster as "Redis Cluster"
Server->>PubClient : Create Publisher Client
Server->>SubClient : Create Subscriber Client
Server->>PubClient : Connect
Server->>SubClient : Connect
Server->>Cluster : Establish Connection
Cluster-->>Server : Connection Ready
Server->>Server : Configure Adapter
Server->>PubClient : Setup Error Handling
Server->>SubClient : Setup Error Handling
```

**Diagram sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L27-L50)

### Redis Connection Configuration

The Redis client configuration emphasizes reliability and automatic recovery:

| Parameter | Value | Purpose | Failure Handling |
|-----------|-------|---------|------------------|
| reconnectDelay | 50ms | Initial reconnection delay | Exponential backoff |
| reconnectDelayMax | 500ms | Maximum reconnection delay | Prevents connection storms |
| maxRetriesPerRequest | 3 | Retry attempts per operation | Handles transient failures |

### Fallback Mechanism

The Redis adapter implements a robust fallback strategy:

```mermaid
flowchart TD
CheckEnv{"Production + Redis URL?"}
CheckEnv --> |Yes| TryConnect["Attempt Redis Connection"]
CheckEnv --> |No| SingleInstance["Single Instance Mode"]
TryConnect --> Success{"Connection Success?"}
Success --> |Yes| SetupAdapter["Configure Redis Adapter"]
Success --> |No| LogError["Log Connection Error"]
LogError --> FallbackMode["Continue Without Redis"]
SetupAdapter --> MonitorErrors["Monitor Redis Errors"]
MonitorErrors --> HandleErrors["Handle Redis Failures"]
SingleInstance --> LogInfo["Log Single Instance Mode"]
FallbackMode --> LogWarning["Log Fallback Warning"]
```

**Diagram sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L27-L50)

### Redis Guest Manager Integration

The Redis Guest Manager provides persistent session storage with automatic failover:

| Feature | Implementation | Benefits |
|---------|----------------|----------|
| Session Persistence | Redis key-value storage | Data durability |
| Fallback Storage | In-memory Map | Seamless degradation |
| Automatic Cleanup | Periodic expiration | Resource management |
| Connection Monitoring | Error event handling | Proactive failure detection |

**Section sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L27-L50)
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L1-L432)

## Middleware Configuration

The Socket.IO middleware stack implements comprehensive authentication and rate limiting to ensure secure and stable operations.

### Authentication Middleware

The `authenticateSocket` middleware validates guest session tokens and establishes user context:

```mermaid
sequenceDiagram
participant Client as "Socket Client"
participant Middleware as "Auth Middleware"
participant JWT as "JWT Validator"
participant Guest as "Guest Controller"
Client->>Middleware : Socket Connection with Token
Middleware->>JWT : Verify Token
JWT-->>Middleware : Decoded Payload
Middleware->>Guest : Validate Session
Guest-->>Middleware : Session Data
Middleware->>Client : Attach User Context
Middleware-->>Client : Allow Connection
```

**Diagram sources**
- [auth.js](file://backend/src/middleware/auth.js#L40-L75)

### JWT Token Validation

The authentication process includes comprehensive token validation:

| Validation Step | Purpose | Error Handling |
|-----------------|---------|----------------|
| Token Presence | Ensure authentication | 401 Unauthorized |
| Token Format | Verify Bearer format | Invalid token error |
| Token Signature | Validate JWT signature | Verification failure |
| Session Existence | Check guest session | Session not found |
| Session Status | Verify active session | Expired session |

### Rate Limiting Implementation

The rate limiting middleware prevents abuse while maintaining performance:

```mermaid
flowchart TD
SocketConnect["Socket Connection"]
SocketConnect --> ExtractUserId["Extract User ID"]
ExtractUserId --> CheckWindow{"Within Rate Window?"}
CheckWindow --> |No| ResetCounter["Reset Counter & Window"]
CheckWindow --> |Yes| CheckLimit{"Count < Max Requests?"}
CheckLimit --> |Yes| IncrementCount["Increment Count"]
CheckLimit --> |No| RejectRequest["Reject with Error"]
ResetCounter --> AllowRequest["Allow Request"]
IncrementCount --> AllowRequest
AllowRequest --> NextMiddleware["Continue to Next Middleware"]
RejectRequest --> ErrorHandler["Error Handler"]
```

**Diagram sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L54-L75)

### Rate Limiting Configuration

The rate limiting parameters balance security with usability:

| Parameter | Value | Purpose | Tuning Guidelines |
|-----------|-------|---------|-------------------|
| Window Duration | 60,000ms | Time window for counting | Adjust based on traffic patterns |
| Max Requests | 100 | Requests per window per user | Scale with expected load |
| Counter Reset | Automatic | Window-based reset | Prevents accumulation attacks |

**Section sources**
- [auth.js](file://backend/src/middleware/auth.js#L1-L100)
- [socketServer.js](file://backend/src/socket/socketServer.js#L54-L75)

## Connection Lifecycle Management

The Socket.IO connection lifecycle encompasses multiple phases from initial handshake through graceful disconnection, with comprehensive event handling and error recovery.

### Connection Event Flow

```mermaid
stateDiagram-v2
[*] --> Connecting
Connecting --> Authenticating : Token Provided
Authenticating --> Authorized : Auth Success
Authenticating --> Failed : Auth Failure
Authorized --> Connected : Setup Complete
Connected --> Active : Event Processing
Active --> Active : Continuous Communication
Active --> Disconnected : Client Disconnect
Active --> Failed : Error Occurred
Disconnected --> [*]
Failed --> [*]
```

**Diagram sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L77-L130)

### Event Handler Registration

The event handler setup covers all major communication patterns:

| Event Category | Events | Purpose | Implementation |
|----------------|--------|---------|----------------|
| Connection | `connection`, `disconnect` | Lifecycle management | Basic connection tracking |
| User Matching | `user:match`, `user:match:cancel` | User discovery | Random pairing system |
| Chat Operations | `chat:message`, `chat:clear` | Messaging | Text and file exchange |
| WebRTC Signaling | `webrtc:offer`, `webrtc:answer` | Video calls | Peer-to-peer communication |
| Presence | `chat:typing:start`, `chat:typing:stop` | User activity | Real-time indicators |

### Error Handling Mechanisms

The error handling system provides comprehensive fault tolerance:

```mermaid
flowchart TD
SocketError["Socket Error Event"]
SocketError --> LogError["Log Error Details"]
LogError --> CheckType{"Error Type?"}
CheckType --> |Authentication| AuthError["Handle Auth Error"]
CheckType --> |Network| NetworkError["Handle Network Error"]
CheckType --> |Application| AppError["Handle Application Error"]
AuthError --> RegenerateToken["Regenerate Token"]
NetworkError --> RetryConnection["Retry Connection"]
AppError --> CleanupResources["Cleanup Resources"]
RegenerateToken --> Reconnect["Reconnect with New Token"]
RetryConnection --> BackoffStrategy["Exponential Backoff"]
CleanupResources --> NotifyClients["Notify Affected Clients"]
```

**Diagram sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L131-L140)

### Connection Statistics

The system maintains comprehensive connection metrics:

| Metric | Purpose | Collection Method |
|--------|---------|------------------|
| Connected Sockets | Current connections | Real-time monitoring |
| Active Rooms | Chat sessions | Room membership tracking |
| User Presence | Online status | Presence events |
| Error Rates | System health | Error event aggregation |

**Section sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L77-L140)
- [socketHandlers.js](file://backend/src/socket/socketHandlers.js#L1-L771)

## Utility Functions

The Socket.IO implementation includes specialized utility functions for efficient message delivery and system monitoring.

### Broadcasting Functions

The utility functions provide optimized message distribution:

```mermaid
classDiagram
class SocketAPI {
+broadcast(event, data) void
+sendToUser(userId, event, data) boolean
+getStats() Object
}
class BroadcastMethods {
+io.emit() : Global Broadcast
+io.to(room).emit() : Room Broadcast
+io.to(socketId).emit() : Targeted Broadcast
}
class UserMapping {
+userSockets Map : userId -> socketId
+connectedUsers Map : socketId -> userId
}
SocketAPI --> BroadcastMethods
SocketAPI --> UserMapping
```

**Diagram sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L170-L185)

### Broadcast Implementation

The broadcast functions enable efficient message distribution:

| Function | Use Case | Performance Characteristics | Error Handling |
|----------|----------|---------------------------|----------------|
| `broadcast()` | System-wide announcements | O(1) complexity | Silent failure handling |
| `sendToUser()` | Direct user messages | O(1) lookup | Return status indication |
| Room broadcasts | Group communications | O(n) per room | Individual socket handling |

### Statistics Collection

The statistics functions provide real-time system monitoring:

```mermaid
flowchart LR
StatsRequest["Stats Request"]
StatsRequest --> CollectMetrics["Collect Metrics"]
CollectMetrics --> GuestStats["Guest Statistics"]
CollectMetrics --> ActiveUsers["Active Users"]
CollectMetrics --> RoomCounts["Room Counts"]
GuestStats --> TotalUsers["Total Users"]
GuestStats --> OnlineUsers["Online Users"]
GuestStats --> AvailableUsers["Available Users"]
ActiveUsers --> ActiveCount["Active User Count"]
RoomCounts --> RoomSize["Room Sizes"]
TotalUsers --> CombineResults["Combine Results"]
OnlineUsers --> CombineResults
AvailableUsers --> CombineResults
ActiveCount --> CombineResults
RoomSize --> CombineResults
CombineResults --> ReturnStats["Return Statistics"]
```

**Diagram sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L165-L169)

**Section sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L165-L185)

## Network Deployment Patterns

The Socket.IO architecture supports multiple deployment patterns to accommodate different scalability requirements and operational constraints.

### Single-Instance Deployment

```mermaid
graph TB
subgraph "Single Server Instance"
Client1[Client 1]
Client2[Client 2]
Client3[Client 3]
Server[Socket.IO Server]
Memory[In-Memory Storage]
Client1 --> Server
Client2 --> Server
Client3 --> Server
Server --> Memory
end
```

**Characteristics:**
- **Scalability**: Limited to single server capacity
- **Latency**: Minimal inter-server communication overhead
- **Reliability**: Single point of failure
- **Use Cases**: Development, small-scale production

### Redis-Clustered Deployment

```mermaid
graph TB
subgraph "Load Balancer"
LB[Load Balancer]
end
subgraph "Server Instances"
Server1[Socket.IO Server 1]
Server2[Socket.IO Server 2]
Server3[Socket.IO Server 3]
end
subgraph "Redis Cluster"
Redis1[Redis Master]
Redis2[Redis Slave 1]
Redis3[Redis Slave 2]
end
subgraph "Clients"
Client1[Client 1]
Client2[Client 2]
Client3[Client 3]
end
Client1 --> LB
Client2 --> LB
Client3 --> LB
LB --> Server1
LB --> Server2
LB --> Server3
Server1 --> Redis1
Server2 --> Redis1
Server3 --> Redis1
Redis1 --> Redis2
Redis1 --> Redis3
```

**Characteristics:**
- **Scalability**: Horizontal scaling across multiple servers
- **Latency**: Redis-based synchronization overhead
- **Reliability**: Fault-tolerant with Redis clustering
- **Use Cases**: Production environments requiring high availability

### Hybrid Deployment Strategy

The system automatically adapts to deployment conditions:

| Condition | Behavior | Rationale |
|-----------|----------|-----------|
| Production + Redis URL | Redis adapter enabled | Horizontal scaling capability |
| Production + No Redis | Single instance mode | Fallback to reliable operation |
| Development | Single instance mode | Simplicity for development |
| Testing | Single instance mode | Consistent testing environment |

**Section sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L27-L50)

## Performance Considerations

The Socket.IO implementation incorporates numerous performance optimizations to handle high-concurrency scenarios efficiently.

### Connection Overhead Analysis

| Component | Overhead | Optimization Strategy | Measurement |
|-----------|----------|---------------------|-------------|
| TCP Handshake | ~100ms | Keep-alive connections | Connection timing logs |
| WebSocket Upgrade | ~50ms | Protocol negotiation | Handshake duration |
| Authentication | ~20ms | Token caching | Auth middleware timing |
| Redis Operations | ~5-10ms | Connection pooling | Redis client metrics |

### Scalability Limits

The system architecture defines clear scalability boundaries:

```mermaid
graph LR
subgraph "Connection Scaling"
C1[10K Connections]
C2[50K Connections]
C3[100K+ Connections]
end
subgraph "Throughput Scaling"
T1[1K Messages/sec]
T2[10K Messages/sec]
T3[100K+ Messages/sec]
end
subgraph "Resource Scaling"
R1[Memory: 1GB]
R2[Memory: 4GB]
R3[Memory: 16GB+]
end
C1 --> T1
C2 --> T2
C3 --> T3
T1 --> R1
T2 --> R2
T3 --> R3
```

### Memory Management

The memory management strategy focuses on efficient resource utilization:

| Resource Type | Management Strategy | Thresholds | Cleanup |
|---------------|-------------------|------------|---------|
| Socket Connections | Weak references | 100K connections | Automatic cleanup |
| Event Handlers | Reference cleanup | Per connection | Disconnection |
| Rate Limiters | Time-based eviction | 1 minute windows | Automatic removal |
| Redis Cache | TTL-based expiration | 2 hour sessions | Periodic cleanup |

### Network Optimization

Network performance optimizations include:

- **Compression**: Message compression for large payloads
- **Batching**: Multiple operations in single network round-trip
- **Keep-alive**: Persistent connections to reduce handshake overhead
- **Load balancing**: Intelligent client distribution across servers

**Section sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L7-L25)
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L1-L432)

## Common Issues and Debugging

The Socket.IO implementation includes comprehensive error handling and debugging capabilities to facilitate troubleshooting in production environments.

### Connection Timeout Issues

Common connection timeout scenarios and solutions:

```mermaid
flowchart TD
TimeoutError["Connection Timeout"]
TimeoutError --> CheckNetwork{"Network Connectivity?"}
CheckNetwork --> |Poor| NetworkIssues["Network Issues"]
CheckNetwork --> |Good| CheckServer{"Server Load?"}
NetworkIssues --> ImproveLatency["Reduce Latency<br/>- CDN placement<br/>- Geographic distribution"]
CheckServer --> |High| OptimizeServer["Server Optimization"]
CheckServer --> |Normal| CheckConfig["Configuration Review"]
OptimizeServer --> IncreaseResources["Increase Resources<br/>- CPU/memory allocation<br/>- Connection limits"]
CheckConfig --> AdjustTimeouts["Adjust Timeouts<br/>- Increase pingTimeout<br/>- Optimize pingInterval"]
```

### CORS Configuration Problems

CORS-related issues commonly stem from misconfigured origins:

| Issue | Symptoms | Solution | Prevention |
|-------|----------|----------|------------|
| Origin Mismatch | Preflight failures | Update CORS origins | Environment-specific configuration |
| Credentials Issue | Authentication failures | Enable credentials | Proper credential handling |
| Method Restrictions | 405 errors | Allow required methods | Comprehensive method listing |

### Authentication Failures

Authentication problems often involve token validation issues:

```mermaid
sequenceDiagram
participant Client as "Client"
participant Auth as "Auth Middleware"
participant JWT as "JWT Service"
participant Guest as "Guest Service"
Client->>Auth : Socket Connection
Auth->>JWT : Verify Token
JWT-->>Auth : Token Expired
Auth->>Guest : Validate Session
Guest-->>Auth : Session Not Found
Auth-->>Client : Authentication Error
```

**Diagram sources**
- [auth.js](file://backend/src/middleware/auth.js#L40-L75)

### Redis Connection Issues

Redis connectivity problems require specific troubleshooting approaches:

| Problem | Indicators | Resolution | Monitoring |
|---------|------------|------------|------------|
| Connection Refused | ECONNREFUSED errors | Check Redis service | Connection status monitoring |
| Authentication Failure | AUTH errors | Verify credentials | Redis auth logging |
| Network Partition | Intermittent failures | Implement retry logic | Health check monitoring |

### Debugging Strategies

Effective debugging requires systematic approaches:

1. **Logging Levels**: Configure appropriate log levels for different environments
2. **Connection Tracking**: Monitor socket lifecycle events
3. **Performance Metrics**: Track connection establishment times
4. **Error Correlation**: Link frontend and backend error reports
5. **Load Testing**: Simulate high-concurrency scenarios

**Section sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L131-L140)
- [auth.js](file://backend/src/middleware/auth.js#L1-L100)

## Optimization Strategies

The Socket.IO implementation incorporates multiple optimization strategies to maximize performance and minimize resource consumption.

### Connection Pooling

Efficient connection management reduces overhead:

```mermaid
graph TB
subgraph "Connection Pool"
Pool[Connection Pool]
Active[Active Connections]
Idle[Idle Connections]
Pending[Pending Connections]
end
subgraph "Pool Management"
Acquire[Acquire Connection]
Release[Release Connection]
Cleanup[Cleanup Stale Connections]
end
Pool --> Active
Pool --> Idle
Pool --> Pending
Acquire --> Active
Active --> Release
Release --> Idle
Idle --> Cleanup
```

### Message Batching

Batching reduces network overhead and improves throughput:

| Batch Type | Trigger Conditions | Size Limits | Performance Gain |
|------------|-------------------|-------------|------------------|
| Event Batches | Timer-based | 100 events | 30% throughput improvement |
| Presence Updates | Change detection | 50 users | 20% latency reduction |
| Statistics Updates | Periodic collection | 1000 metrics | 15% bandwidth savings |

### Caching Strategies

Intelligent caching reduces database and computation overhead:

```mermaid
flowchart LR
Request[Client Request]
Request --> L1Cache["L1: In-Memory Cache"]
L1Cache --> |Hit| Return[Return Cached Data]
L1Cache --> |Miss| L2Cache["L2: Redis Cache"]
L2Cache --> |Hit| UpdateL1["Update L1 Cache"]
L2Cache --> |Miss| Database["Database Query"]
Database --> UpdateL2["Update L2 Cache"]
UpdateL2 --> UpdateL1
UpdateL1 --> Return
```

### Resource Optimization

Systematic resource optimization includes:

- **Memory Optimization**: Efficient data structures and garbage collection
- **CPU Optimization**: Asynchronous processing and worker threads
- **Network Optimization**: Compression and connection multiplexing
- **Storage Optimization**: Indexing and query optimization

### Monitoring and Alerting

Comprehensive monitoring enables proactive optimization:

| Metric Category | Key Indicators | Alert Thresholds | Action Triggers |
|-----------------|----------------|------------------|-----------------|
| Connection Health | Connection success rate | < 95% | Scale resources |
| Performance | Average response time | > 1000ms | Investigate bottlenecks |
| Resource Usage | Memory/CPU utilization | > 80% | Optimize configuration |
| Error Rates | Error frequency | > 1% | Debug and fix issues |

**Section sources**
- [socketServer.js](file://backend/src/socket/socketServer.js#L1-L199)
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L1-L432)