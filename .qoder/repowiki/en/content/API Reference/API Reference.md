# API Reference

<cite>
**Referenced Files in This Document**   
- [auth.js](file://backend/src/routes/auth.js)
- [users.js](file://backend/src/routes/users.js)
- [fileRoutes.js](file://backend/src/routes/fileRoutes.js)
- [security.js](file://backend/src/middleware/security.js)
- [validation.js](file://backend/src/middleware/validation.js)
- [auth.js](file://backend/src/middleware/auth.js)
- [api.ts](file://web/lib/api.ts)
- [jwt.js](file://backend/src/utils/jwt.js)
- [guestController.js](file://backend/src/controllers/guestController.js)
- [userController.js](file://backend/src/controllers/userController.js)
- [fileController.js](file://backend/src/controllers/fileController.js)
- [tempFileStorage.js](file://backend/src/utils/tempFileStorage.js)
- [redisGuestManager.js](file://backend/src/utils/redisGuestManager.js)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication Mechanism](#authentication-mechanism)
3. [Rate Limiting](#rate-limiting)
4. [CORS Policy](#cors-policy)
5. [Error Handling](#error-handling)
6. [Guest Session Endpoints](#guest-session-endpoints)
7. [User Profile and Statistics Endpoints](#user-profile-and-statistics-endpoints)
8. [File Upload Endpoints](#file-upload-endpoints)
9. [Temporary File Handling](#temporary-file-handling)
10. [Frontend Integration](#frontend-integration)

## Introduction
This document provides comprehensive API documentation for the Realtime Chat App, detailing all RESTful endpoints for guest session management, user profile access, statistics retrieval, and file handling. The API uses token-based authentication with JWT tokens for guest sessions, implements rate limiting for security, and follows REST principles for consistent interface design.

The backend is built with Express.js and provides endpoints for creating guest sessions, managing user information, uploading files, and retrieving system statistics. All endpoints require proper authentication and follow standardized response formats for success and error cases.

**Section sources**
- [server.js](file://backend/src/server.js#L1-L265)
- [auth.js](file://backend/src/routes/auth.js#L1-L44)
- [users.js](file://backend/src/routes/users.js#L1-L40)
- [fileRoutes.js](file://backend/src/routes/fileRoutes.js#L1-L41)

## Authentication Mechanism
The Realtime Chat App implements a token-based authentication system specifically designed for guest sessions. Users are not required to register or provide personal information; instead, they receive a JWT (JSON Web Token) upon creating a guest session, which is used to authenticate subsequent requests.

### Token Generation and Validation
When a guest creates a session, the server generates a JWT token containing the following claims:
- `userId`: Unique identifier for the guest user
- `sessionId`: Unique session identifier
- `username`: Guest's chosen or generated username
- `isGuest`: Boolean flag indicating guest status
- `iat`: Issuance timestamp
- `exp`: Expiration timestamp (2 hours from creation)

The token is signed using a secret key stored in the environment variable `JWT_SECRET` and includes issuer and audience claims for additional security.

```mermaid
sequenceDiagram
participant Frontend
participant Backend
participant JWT
Frontend->>Backend : POST /api/auth/guest
Backend->>JWT : Generate token with payload
JWT-->>Backend : Signed JWT token
Backend-->>Frontend : 201 Created + token
Frontend->>Backend : Subsequent requests with Authorization header
Backend->>JWT : Verify token signature and claims
JWT-->>Backend : Decoded payload or error
Backend-->>Frontend : Response or 401 Unauthorized
```

**Diagram sources**
- [jwt.js](file://backend/src/utils/jwt.js#L1-L52)
- [guestController.js](file://backend/src/controllers/guestController.js#L1-L149)
- [auth.js](file://backend/src/middleware/auth.js#L1-L100)

### Session Renewal Process
Guest sessions have a 2-hour expiration period. When a token expires, the frontend automatically attempts to regenerate the session using the session regeneration callback mechanism implemented in the API service.

The process works as follows:
1. The frontend makes a request with an expired token
2. The server responds with a 401 Unauthorized status
3. The API interceptor detects the expired token and triggers the session regeneration callback
4. The old session token is cleared from session storage
5. A new guest session is created, generating a fresh token
6. The original request is retried with the new token

This seamless renewal process ensures uninterrupted user experience while maintaining security through regular token rotation.

**Section sources**
- [api.ts](file://web/lib/api.ts#L1-L130)
- [jwt.js](file://backend/src/utils/jwt.js#L1-L52)
- [auth.js](file://backend/src/middleware/auth.js#L1-L100)

## Rate Limiting
The API implements rate limiting to prevent abuse and ensure service availability for all users. Different endpoints have different rate limiting policies based on their sensitivity and resource requirements.

### Rate Limiting Configuration
The system uses Express Rate Limit with the following configurations:

```mermaid
flowchart TD
A[Incoming Request] --> B{Endpoint Type?}
B --> |Authentication| C[authLimiter: 50 requests per 15 minutes]
B --> |General API| D[apiLimiter: 100 requests per 15 minutes]
B --> |File Upload| E[uploadLimiter: 10 uploads per hour]
C --> F{Within Limit?}
D --> G{Within Limit?}
E --> H{Within Limit?}
F --> |Yes| I[Process Request]
G --> |Yes| I
H --> |Yes| I
F --> |No| J[429 Too Many Requests]
G --> |No| J
H --> |No| J
I --> K[Return Response]
```

**Diagram sources**
- [security.js](file://backend/src/middleware/security.js#L1-L332)
- [fileRoutes.js](file://backend/src/routes/fileRoutes.js#L1-L41)

### Rate Limiter Details
- **Authentication Limiter**: Applied to authentication endpoints with a limit of 50 requests per 15 minutes per IP address. This prevents brute force attacks on guest session creation.
- **API Limiter**: Applied to general API endpoints with a limit of 100 requests per 15 minutes per IP address. This protects against general API abuse.
- **Upload Limiter**: Applied specifically to file upload endpoints with a limit of 10 uploads per hour per authenticated session. This prevents excessive file upload activity.

All rate limiters include standard headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) to inform clients of their rate limit status. When a limit is exceeded, the server returns a 429 status code with a descriptive error message.

**Section sources**
- [security.js](file://backend/src/middleware/security.js#L1-L332)
- [fileRoutes.js](file://backend/src/routes/fileRoutes.js#L1-L41)

## CORS Policy
The API implements a comprehensive CORS (Cross-Origin Resource Sharing) policy to securely allow requests from authorized origins while preventing unauthorized cross-origin access.

### CORS Configuration
The CORS policy is configured differently for development and production environments:

```mermaid
flowchart TD
A[Incoming Request] --> B{Environment?}
B --> |Production| C[Check against allowed origins]
B --> |Development| D[Allow all origins]
C --> E{Origin in allowed list?}
D --> F[Allow request]
E --> |Yes| F
E --> |No| G[Block with CORS error]
F --> H[Add CORS headers]
H --> I[Process request]
```

**Diagram sources**
- [security.js](file://backend/src/middleware/security.js#L1-L332)
- [server.js](file://backend/src/server.js#L1-L265)

### Allowed Origins
The API allows requests from the following origins:
- Production: `https://realtime-web-app-ecru.vercel.app`, `https://realtime-web-app.onrender.com`
- Development: `http://localhost:3000`, `http://localhost:3001`, `http://localhost:3335`
- LAN Development: `http://[LAN_IP]:3000`, `http://[LAN_IP]:3335`

The development environment allows all origins to facilitate testing across different devices on a local network.

### Allowed Methods and Headers
The API supports the following HTTP methods:
- GET, POST, PUT, DELETE, OPTIONS

The following headers are allowed in requests:
- Content-Type
- Authorization
- X-Requested-With

The API exposes the `X-Total-Count` header to support pagination in responses.

**Section sources**
- [security.js](file://backend/src/middleware/security.js#L1-L332)
- [server.js](file://backend/src/server.js#L1-L265)

## Error Handling
The API follows a consistent error response format and handles various error scenarios with appropriate HTTP status codes.

### Error Response Format
All error responses follow this standard format:
```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

For validation errors, additional details are provided:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Error description",
      "param": "field_name",
      "location": "body"
    }
  ]
}
```

### Error Code Reference
The API uses standard HTTP status codes with specific meanings:

| Status Code | Meaning | Description |
|-------------|---------|-------------|
| 400 | Bad Request | Request validation failed or missing required parameters |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

**Section sources**
- [security.js](file://backend/src/middleware/security.js#L1-L332)
- [guestController.js](file://backend/src/controllers/guestController.js#L1-L149)
- [userController.js](file://backend/src/controllers/userController.js#L1-L175)
- [fileController.js](file://backend/src/controllers/fileController.js#L1-L141)

## Guest Session Endpoints
The guest session endpoints handle the creation and management of guest user sessions, allowing users to participate in the chat application without registration.

### Create Guest Session
Creates a new guest session and returns an authentication token.

**Endpoint**: `POST /api/auth/guest`  
**Authentication**: Not required  
**Rate Limit**: 50 requests per 15 minutes

**Request Headers**:
- `Content-Type: application/json`

**Request Body**:
```json
{
  "username": "string (optional, 3-20 characters, alphanumeric and underscore only)",
  "location": "object (optional)",
  "gender": "string (optional)",
  "language": "string (optional)"
}
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "Guest session created successfully",
  "data": {
    "token": "string (JWT token)",
    "user": {
      "id": "string",
      "username": "string",
      "isGuest": true,
      "sessionId": "string",
      "location": "object or null",
      "gender": "string or null",
      "language": "string or null"
    }
  }
}
```

**Error Responses**:
- 400: Validation failed (invalid username format or length)
- 429: Too many requests (rate limit exceeded)
- 500: Internal server error

**Section sources**
- [auth.js](file://backend/src/routes/auth.js#L1-L44)
- [guestController.js](file://backend/src/controllers/guestController.js#L1-L149)
- [validation.js](file://backend/src/middleware/validation.js#L1-L112)

### Get Current User Information
Retrieves information about the currently authenticated guest user.

**Endpoint**: `GET /api/auth/me`  
**Authentication**: Required (JWT token in Authorization header)  
**Rate Limit**: 100 requests per 15 minutes

**Request Headers**:
- `Authorization: Bearer <token>`

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "isGuest": true,
      "sessionId": "string"
    }
  }
}
```

**Error Responses**:
- 401: Access token is required or invalid/expired token
- 500: Internal server error

**Section sources**
- [auth.js](file://backend/src/routes/auth.js#L1-L44)
- [guestController.js](file://backend/src/controllers/guestController.js#L1-L149)
- [auth.js](file://backend/src/middleware/auth.js#L1-L100)

### Generate Random Username
Generates a random username for guest users.

**Endpoint**: `GET /api/auth/guest/username`  
**Authentication**: Not required  
**Rate Limit**: 50 requests per 15 minutes

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "username": "string (randomly generated)"
  }
}
```

**Error Responses**:
- 500: Internal server error

**Section sources**
- [auth.js](file://backend/src/routes/auth.js#L1-L44)
- [guestController.js](file://backend/src/controllers/guestController.js#L1-L149)

### Get Guest Session Information
Retrieves information about a specific guest session by session ID.

**Endpoint**: `GET /api/auth/guest/:sessionId`  
**Authentication**: Not required  
**Rate Limit**: 100 requests per 15 minutes

**Path Parameters**:
- `sessionId`: The ID of the guest session to retrieve

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "isOnline": "boolean",
      "lastSeen": "string (ISO date)",
      "isSearching": "boolean",
      "connectedUser": "string or null",
      "isGuest": true,
      "sessionId": "string",
      "location": "object or null",
      "gender": "string or null",
      "language": "string or null"
    }
  }
}
```

**Error Responses**:
- 404: Guest session not found or expired
- 500: Internal server error

**Section sources**
- [auth.js](file://backend/src/routes/auth.js#L1-L44)
- [guestController.js](file://backend/src/controllers/guestController.js#L1-L149)

## User Profile and Statistics Endpoints
These endpoints provide access to user profile information, online status, and system statistics.

### Get Online Users
Retrieves a list of currently online users.

**Endpoint**: `GET /api/users/online`  
**Authentication**: Required (JWT token in Authorization header)  
**Rate Limit**: 100 requests per 15 minutes

**Request Headers**:
- `Authorization: Bearer <token>`

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "onlineUsers": [
      {
        "id": "string",
        "sessionId": "string",
        "username": "string",
        "isOnline": true,
        "isSearching": "boolean",
        "lastSeen": "string (ISO date)",
        "connectedUser": "string or null",
        "location": "object or null",
        "gender": "string or null",
        "language": "string or null"
      }
    ],
    "count": "number"
  }
}
```

**Error Responses**:
- 401: Access token is required or invalid/expired token
- 500: Internal server error

**Section sources**
- [users.js](file://backend/src/routes/users.js#L1-L40)
- [userController.js](file://backend/src/controllers/userController.js#L1-L175)
- [auth.js](file://backend/src/middleware/auth.js#L1-L100)

### Get Available Users
Retrieves a list of users available for matching (online and not currently connected).

**Endpoint**: `GET /api/users/available`  
**Authentication**: Required (JWT token in Authorization header)  
**Rate Limit**: 100 requests per 15 minutes

**Request Headers**:
- `Authorization: Bearer <token>`

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "availableUsers": [
      {
        "id": "string",
        "sessionId": "string",
        "username": "string",
        "isOnline": true,
        "isSearching": true,
        "lastSeen": "string (ISO date)",
        "connectedUser": null,
        "location": "object or null",
        "gender": "string or null",
        "language": "string or null"
      }
    ],
    "count": "number"
  }
}
```

**Error Responses**:
- 401: Access token is required or invalid/expired token
- 500: Internal server error

**Section sources**
- [users.js](file://backend/src/routes/users.js#L1-L40)
- [userController.js](file://backend/src/controllers/userController.js#L1-L175)
- [auth.js](file://backend/src/middleware/auth.js#L1-L100)

### Get User Statistics
Retrieves user statistics including total, online, available, and connected user counts.

**Endpoint**: `GET /api/users/stats`  
**Authentication**: Required (JWT token in Authorization header)  
**Rate Limit**: 100 requests per 15 minutes

**Request Headers**:
- `Authorization: Bearer <token>`

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalUsers": "number",
      "onlineUsers": "number",
      "availableUsers": "number",
      "connectedUsers": "number"
    }
  }
}
```

**Error Responses**:
- 401: Access token is required or invalid/expired token
- 500: Internal server error

**Section sources**
- [users.js](file://backend/src/routes/users.js#L1-L40)
- [userController.js](file://backend/src/controllers/userController.js#L1-L175)
- [auth.js](file://backend/src/middleware/auth.js#L1-L100)

### Update Device Information
Registers or updates device information for the current guest session.

**Endpoint**: `POST /api/users/device`  
**Authentication**: Required (JWT token in Authorization header)  
**Rate Limit**: 100 requests per 15 minutes

**Request Headers**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "deviceId": "string (optional, 1-100 characters)",
  "ip": "string (optional, valid IP format)"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Device information updated successfully",
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "deviceId": "string or null",
      "ip": "string or null",
      "location": "object or null",
      "lastSeen": "string (ISO date)",
      "isGuest": true
    }
  }
}
```

**Error Responses**:
- 400: Validation failed (invalid deviceId length or IP format)
- 401: Access token is required or invalid/expired token
- 404: Guest session not found
- 500: Internal server error

**Section sources**
- [users.js](file://backend/src/routes/users.js#L1-L40)
- [userController.js](file://backend/src/controllers/userController.js#L1-L175)
- [validation.js](file://backend/src/middleware/validation.js#L1-L112)
- [auth.js](file://backend/src/middleware/auth.js#L1-L100)

## File Upload Endpoints
These endpoints handle file and voice note uploads for sharing in chat sessions.

### Upload File
Uploads a file to be shared in a chat session.

**Endpoint**: `POST /api/files/upload`  
**Authentication**: Required (JWT token in Authorization header)  
**Rate Limit**: 10 uploads per hour

**Request Headers**:
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body** (multipart/form-data):
- `file`: The file to upload (required)
- `roomId`: The chat room ID (required)
- `filename`: Original filename (optional)
- `fileType`: MIME type (optional)
- `fileSize`: File size in bytes (optional)

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "fileId": "string (unique identifier)",
    "filename": "string",
    "fileType": "string (MIME type)",
    "fileSize": "number",
    "tempUrl": "string (temporary view URL)",
    "downloadUrl": "string (download URL)",
    "isImage": "boolean",
    "fileTypeCategory": "string (image, video, audio, document, etc.)",
    "expiresAt": "string (ISO date, 2 hours from upload)"
  }
}
```

**Error Responses**:
- 400: No file uploaded, room ID required, or validation failed
- 401: Access token is required or invalid/expired token
- 429: Too many file uploads
- 500: Failed to upload file

**Section sources**
- [fileRoutes.js](file://backend/src/routes/fileRoutes.js#L1-L41)
- [fileController.js](file://backend/src/controllers/fileController.js#L1-L141)
- [validation.js](file://backend/src/middleware/validation.js#L1-L112)
- [auth.js](file://backend/src/middleware/auth.js#L1-L100)

### Upload Voice Note
Uploads a voice note recording to be shared in a chat session.

**Endpoint**: `POST /api/files/voice`  
**Authentication**: Required (JWT token in Authorization header)  
**Rate Limit**: 10 uploads per hour

**Request Headers**:
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body** (multipart/form-data):
- `file`: The voice note file to upload (required)
- `roomId`: The chat room ID (required)
- `duration`: Recording duration in seconds (required, 1-300)
- `fileSize`: File size in bytes (optional)

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "fileId": "string (unique identifier)",
    "filename": "string",
    "fileType": "string (MIME type)",
    "fileSize": "number",
    "duration": "number",
    "tempUrl": "string (temporary playback URL)",
    "downloadUrl": "string (download URL)",
    "isImage": "boolean",
    "fileTypeCategory": "string (audio)",
    "expiresAt": "string (ISO date, 2 hours from upload)"
  }
}
```

**Error Responses**:
- 400: No voice note uploaded, room ID required, validation failed (duration or file size)
- 401: Access token is required or invalid/expired token
- 429: Too many file uploads
- 500: Failed to upload voice note

**Section sources**
- [fileRoutes.js](file://backend/src/routes/fileRoutes.js#L1-L41)
- [fileController.js](file://backend/src/controllers/fileController.js#L1-L141)
- [validation.js](file://backend/src/middleware/validation.js#L1-L112)
- [auth.js](file://backend/src/middleware/auth.js#L1-L100)

## Temporary File Handling
The system provides endpoints for accessing temporarily stored files with time-limited URLs.

### Serve Temporary File
Serves a temporary file for inline viewing (e.g., image preview).

**Endpoint**: `GET /api/temp-files/temp/:fileId`  
**Authentication**: Not required (access controlled by unique fileId)  
**Rate Limit**: None

**Path Parameters**:
- `fileId`: The unique identifier of the temporary file

**Response**:
- Returns the file content with appropriate Content-Type header
- Sets Content-Disposition to "inline" for browser rendering
- Expires after 2 hours from upload

**Error Responses**:
- 400: File ID is required
- 404: File not found or expired
- 500: Failed to serve file

**Section sources**
- [tempFileRoutes.js](file://backend/src/routes/tempFileRoutes.js#L1-L172)
- [tempFileStorage.js](file://backend/src/utils/tempFileStorage.js#L1-L237)

### Download Temporary File
Provides a temporary file for download.

**Endpoint**: `GET /api/temp-files/download/:fileId`  
**Authentication**: Not required (access controlled by unique fileId)  
**Rate Limit**: None

**Path Parameters**:
- `fileId`: The unique identifier of the temporary file

**Response**:
- Returns the file content with appropriate Content-Type header
- Sets Content-Disposition to "attachment" to trigger download
- Expires after 2 hours from upload

**Error Responses**:
- 400: File ID is required
- 404: File not found or expired
- 500: Failed to download file

**Section sources**
- [tempFileRoutes.js](file://backend/src/routes/tempFileRoutes.js#L1-L172)
- [tempFileStorage.js](file://backend/src/utils/tempFileStorage.js#L1-L237)

### Get File Information
Retrieves metadata about a temporary file without downloading it.

**Endpoint**: `GET /api/temp-files/info/:fileId`  
**Authentication**: Not required (access controlled by unique fileId)  
**Rate Limit**: None

**Path Parameters**:
- `fileId`: The unique identifier of the temporary file

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "fileId": "string",
    "originalName": "string",
    "mimetype": "string",
    "size": "number",
    "createdAt": "string (ISO date)",
    "expiresAt": "string (ISO date)",
    "isImage": "boolean",
    "fileType": "string (category)"
  }
}
```

**Error Responses**:
- 400: File ID is required
- 404: File not found or expired
- 500: Failed to get file info

**Section sources**
- [tempFileRoutes.js](file://backend/src/routes/tempFileRoutes.js#L1-L172)
- [tempFileStorage.js](file://backend/src/utils/tempFileStorage.js#L1-L237)

## Frontend Integration
This section provides examples and guidance for integrating with the API from the frontend application.

### API Service Usage
The frontend uses a centralized API service (`lib/api.ts`) that handles authentication, error handling, and request configuration.

```mermaid
classDiagram
class ApiService {
+baseURL : string
+timeout : number
+interceptors : Array
+guestAPI : Object
+userAPI : Object
+fileAPI : Object
+setSessionRegenerationCallback(callback)
}
class GuestAPI {
+generateUsername()
+createSession(userData)
+getSession(sessionId)
+getMe()
+updateLocation(locationData)
}
class UserAPI {
+getOnlineUsers()
+getAvailableUsers()
+updateDevice(deviceData)
+getStats()
}
class FileAPI {
+uploadFile(formData)
+uploadVoice(formData)
}
ApiService --> GuestAPI : "contains"
ApiService --> UserAPI : "contains"
ApiService --> FileAPI : "contains"
```

**Diagram sources**
- [api.ts](file://web/lib/api.ts#L1-L130)

### Code Examples
**Creating a Guest Session**:
```javascript
import { guestAPI } from '../lib/api';

try {
  const response = await guestAPI.createSession({
    username: 'CoolPanda123',
    location: { country: 'US', city: 'New York' },
    gender: 'female',
    language: 'en'
  });
  
  console.log('Session created:', response.data.user);
} catch (error) {
  console.error('Failed to create session:', error);
}
```

**Uploading a File**:
```javascript
import { fileAPI } from '../lib/api';

const uploadFile = async (file, roomId) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('roomId', roomId);
  
  try {
    const response = await fileAPI.uploadFile(formData);
    console.log('File uploaded:', response.data);
    return response.data;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};
```

**Handling Token Expiration**:
```javascript
import { setSessionRegenerationCallback } from '../lib/api';
import { createGuestSession } from './sessionService';

// Set up session regeneration callback
setSessionRegenerationCallback(async () => {
  // Implement your session regeneration logic
  await createGuestSession();
});
```

### cURL Examples
**Create Guest Session**:
```bash
curl -X POST https://api.realtime-chat-app.com/api/auth/guest \
  -H "Content-Type: application/json" \
  -d '{"username":"CoolPanda123","location":{"country":"US"}}'
```

**Get Current User**:
```bash
curl -X GET https://api.realtime-chat-app.com/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Upload a File**:
```bash
curl -X POST https://api.realtime-chat-app.com/api/files/upload \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "file=@/path/to/image.jpg" \
  -F "roomId=chat-room-123"
```

**Get User Statistics**:
```bash
curl -X GET https://api.realtime-chat-app.com/api/users/stats \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Section sources**
- [api.ts](file://web/lib/api.ts#L1-L130)
- [guestController.js](file://backend/src/controllers/guestController.js#L1-L149)
- [fileController.js](file://backend/src/controllers/fileController.js#L1-L141)