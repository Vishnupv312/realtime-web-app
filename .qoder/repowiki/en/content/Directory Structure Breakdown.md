# Directory Structure Breakdown

<cite>
**Referenced Files in This Document**   
- [backend/src/config/database.js](file://backend/src/config/database.js)
- [backend/src/config/logger.js](file://backend/src/config/logger.js)
- [backend/src/controllers/fileController.js](file://backend/src/controllers/fileController.js)
- [backend/src/controllers/guestController.js](file://backend/src/controllers/guestController.js)
- [backend/src/controllers/userController.js](file://backend/src/controllers/userController.js)
- [backend/src/middleware/auth.js](file://backend/src/middleware/auth.js)
- [backend/src/middleware/cors-debug.js](file://backend/src/middleware/cors-debug.js)
- [backend/src/middleware/security.js](file://backend/src/middleware/security.js)
- [backend/src/middleware/upload.js](file://backend/src/middleware/upload.js)
- [backend/src/middleware/validation.js](file://backend/src/middleware/validation.js)
- [backend/src/routes/auth.js](file://backend/src/routes/auth.js)
- [backend/src/routes/fileRoutes.js](file://backend/src/routes/fileRoutes.js)
- [backend/src/routes/guest.js](file://backend/src/routes/guest.js)
- [backend/src/routes/stats.js](file://backend/src/routes/stats.js)
- [backend/src/routes/tempFileRoutes.js](file://backend/src/routes/tempFileRoutes.js)
- [backend/src/routes/users.js](file://backend/src/routes/users.js)
- [backend/src/socket/socketHandlers.js](file://backend/src/socket/socketHandlers.js)
- [backend/src/socket/socketServer.js](file://backend/src/socket/socketServer.js)
- [backend/src/utils/jwt.js](file://backend/src/utils/jwt.js)
- [backend/src/utils/redisGuestManager.js](file://backend/src/utils/redisGuestManager.js)
- [backend/src/utils/tempFileStorage.js](file://backend/src/utils/tempFileStorage.js)
- [backend/src/server.js](file://backend/src/server.js)
- [backend/src/cluster.js](file://backend/src/cluster.js)
- [backend/.env](file://backend/.env)
- [backend/package.json](file://backend/package.json)
- [backend/README.md](file://backend/README.md)
- [backend/API_DOCUMENTATION.md](file://backend/API_DOCUMENTATION.md)
- [backend/FRONTEND_INTEGRATION_GUIDE.md](file://backend/FRONTEND_INTEGRATION_GUIDE.md)
- [backend/QUICK_REFERENCE.md](file://backend/QUICK_REFERENCE.md)
- [backend/TEST_SUITE_SUMMARY.md](file://backend/TEST_SUITE_SUMMARY.md)
- [backend/WARP.md](file://backend/WARP.md)
- [web/app/page.tsx](file://web/app/page.tsx)
- [web/app/chat/page.tsx](file://web/app/chat/page.tsx)
- [web/components/ui](file://web/components/ui)
- [web/components/ConnectionStatusDebug.tsx](file://web/components/ConnectionStatusDebug.tsx)
- [web/components/FilePreview.tsx](file://web/components/FilePreview.tsx)
- [web/components/GuestUsernameModal.tsx](file://web/components/GuestUsernameModal.tsx)
- [web/components/MatchingInterface.tsx](file://web/components/MatchingInterface.tsx)
- [web/components/MediaErrorAlert.tsx](file://web/components/MediaErrorAlert.tsx)
- [web/components/SessionTestButton.tsx](file://web/components/SessionTestButton.tsx)
- [web/components/VideoCallModal.tsx](file://web/components/VideoCallModal.tsx)
- [web/components/theme-provider.tsx](file://web/components/theme-provider.tsx)
- [web/contexts/ChatContext.tsx](file://web/contexts/ChatContext.tsx)
- [web/contexts/GuestSessionContext.tsx](file://web/contexts/GuestSessionContext.tsx)
- [web/hooks/useWebRTC.ts](file://web/hooks/useWebRTC.ts)
- [web/hooks/use-mobile.ts](file://web/hooks/use-mobile.ts)
- [web/hooks/use-toast.ts](file://web/hooks/use-toast.ts)
- [web/hooks/useCallLogs.ts](file://web/hooks/useCallLogs.ts)
- [web/lib/api.ts](file://web/lib/api.ts)
- [web/lib/mediaUtils.ts](file://web/lib/mediaUtils.ts)
- [web/lib/socket.ts](file://web/lib/socket.ts)
- [web/lib/utils.ts](file://web/lib/utils.ts)
- [web/.env](file://web/.env)
- [web/.env.local](file://web/.env.local)
- [web/next.config.mjs](file://web/next.config.mjs)
- [web/tsconfig.json](file://web/tsconfig.json)
- [web/package.json](file://web/package.json)
- [web/CALL_DISCONNECTION_TEST.md](file://web/CALL_DISCONNECTION_TEST.md)
- [web/CAMERA_TOGGLE_TEST_GUIDE.md](file://web/CAMERA_TOGGLE_TEST_GUIDE.md)
- [web/MOBILE_WEBRTC_GUIDE.md](file://web/MOBILE_WEBRTC_GUIDE.md)
- [web/TEST_README.md](file://web/TEST_README.md)
- [web/VIDEO_CALL_FIXES.md](file://web/VIDEO_CALL_FIXES.md)
- [web/jest.config.js](file://web/jest.config.js)
- [web/jest.setup.js](file://web/jest.setup.js)
</cite>

## Table of Contents
1. [Root-Level Directory Organization](#root-level-directory-organization)
2. [Backend Directory Structure](#backend-directory-structure)
3. [Frontend Directory Structure](#frontend-directory-structure)
4. [Root-Level Configuration Files](#root-level-configuration-files)
5. [Testing and Documentation Files](#testing-and-documentation-files)

## Root-Level Directory Organization

The Realtime Chat App follows a clear separation of concerns with two primary directories at the root level: `backend/` and `web/`. This structure enables independent development, testing, and deployment of the server-side and client-side components while maintaining a cohesive application architecture. The `backend/` directory contains all server-side logic, API endpoints, real-time communication handlers, and business logic, built with Node.js, Express, and Socket.IO. The `web/` directory houses the Next.js frontend application with React components, state management, WebRTC integration, and user interface elements. This separation allows for scalable development where backend engineers can focus on API design, authentication, and real-time data processing while frontend developers work on user experience, responsive design, and client-side functionality.

**Section sources**
- [backend/README.md](file://backend/README.md#L1-L584)
- [web/README.md](file://web/README.md#L1-L100)

## Backend Directory Structure

The backend/src directory is organized into several specialized subdirectories that separate concerns and promote maintainability. The config/ directory contains database.js for MongoDB connection setup and logger.js for Winston-based logging configuration, providing essential infrastructure services for the application. The controllers/ directory houses the business logic with three main controllers: fileController.js for handling file uploads and downloads, guestController.js for managing guest user sessions and authentication, and userController.js for user presence tracking, device information updates, and statistics. The middleware/ directory implements cross-cutting concerns with auth.js for JWT token validation, cors-debug.js for CORS policy management, security.js for Helmet.js security headers and rate limiting, upload.js for file upload validation and cleanup, and validation.js for input sanitization and validation rules.

The routes/ directory defines the API endpoints and socket routes with auth.js for authentication endpoints, fileRoutes.js for file upload endpoints, guest.js for guest user routes, stats.js for user statistics, tempFileRoutes.js for temporary file serving, and users.js for user management endpoints. The socket/ directory contains the real-time communication logic with socketHandlers.js implementing event handlers for user matching, chat messaging, and WebRTC signaling, and socketServer.js for Socket.IO server configuration with Redis adapter support for horizontal scaling. The utils/ directory provides shared functionality across the application with jwt.js for JWT token generation and verification, redisGuestManager.js for Redis-based guest session management, and tempFileStorage.js for temporary file storage operations.

**Section sources**
- [backend/src/config/database.js](file://backend/src/config/database.js#L1-L50)
- [backend/src/config/logger.js](file://backend/src/config/logger.js#L1-L30)
- [backend/src/controllers/fileController.js](file://backend/src/controllers/fileController.js#L1-L100)
- [backend/src/controllers/guestController.js](file://backend/src/controllers/guestController.js#L1-L150)
- [backend/src/controllers/userController.js](file://backend/src/controllers/userController.js#L1-L175)
- [backend/src/middleware/auth.js](file://backend/src/middleware/auth.js#L1-L40)
- [backend/src/middleware/cors-debug.js](file://backend/src/middleware/cors-debug.js#L1-L25)
- [backend/src/middleware/security.js](file://backend/src/middleware/security.js#L1-L80)
- [backend/src/middleware/upload.js](file://backend/src/middleware/upload.js#L1-L60)
- [backend/src/middleware/validation.js](file://backend/src/middleware/validation.js#L1-L35)
- [backend/src/routes/auth.js](file://backend/src/routes/auth.js#L1-L44)
- [backend/src/routes/fileRoutes.js](file://backend/src/routes/fileRoutes.js#L1-L75)
- [backend/src/routes/guest.js](file://backend/src/routes/guest.js#L1-L55)
- [backend/src/routes/stats.js](file://backend/src/routes/stats.js#L1-L30)
- [backend/src/routes/tempFileRoutes.js](file://backend/src/routes/tempFileRoutes.js#L1-L40)
- [backend/src/routes/users.js](file://backend/src/routes/users.js#L1-L60)
- [backend/src/socket/socketHandlers.js](file://backend/src/socket/socketHandlers.js#L1-L200)
- [backend/src/socket/socketServer.js](file://backend/src/socket/socketServer.js#L1-L199)
- [backend/src/utils/jwt.js](file://backend/src/utils/jwt.js#L1-L45)
- [backend/src/utils/redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L1-L60)
- [backend/src/utils/tempFileStorage.js](file://backend/src/utils/tempFileStorage.js#L1-L35)

## Frontend Directory Structure

The web/ directory follows the Next.js app directory structure with a well-organized component hierarchy. The app/ directory contains the main application pages with page.tsx for the home/dashboard and chat/page.tsx for the chat interface, leveraging Next.js routing and server components. The components/ directory is organized with UI primitives from Radix UI in the ui/ subdirectory, including accessible components like accordion, alert-dialog, avatar, button, card, dialog, dropdown-menu, form, input, label, popover, select, sheet, slider, switch, tabs, toast, and tooltip. Additional custom components include ConnectionStatusDebug for debugging connection issues, FilePreview for displaying file attachments, GuestUsernameModal for guest user authentication, MatchingInterface for user matching functionality, MediaErrorAlert for WebRTC media errors, SessionTestButton for session testing, VideoCallModal for video calling interface, and theme-provider for dark/light mode toggling.

The contexts/ directory implements React Context API for state management with ChatContext.tsx for chat state (messages, connected user, typing indicators) and GuestSessionContext.tsx for guest session management (authentication, user data persistence). The hooks/ directory contains custom React hooks with use-mobile for responsive design, use-toast for toast notifications, useCallLogs for WebRTC call logging, and useWebRTC.ts for WebRTC peer connection management, media stream handling, and call lifecycle control. The lib/ directory provides service clients and utilities with api.ts for API calls, mediaUtils.ts for media device management, socket.ts for Socket.IO client connection and event handling, and utils.ts for general utility functions. This structure promotes reusability, maintainability, and separation of concerns across the frontend application.

**Section sources**
- [web/app/page.tsx](file://web/app/page.tsx#L1-L50)
- [web/app/chat/page.tsx](file://web/app/chat/page.tsx#L1-L100)
- [web/components/ui](file://web/components/ui#L1-L500)
- [web/components/ConnectionStatusDebug.tsx](file://web/components/ConnectionStatusDebug.tsx#L1-L40)
- [web/components/FilePreview.tsx](file://web/components/FilePreview.tsx#L1-L60)
- [web/components/GuestUsernameModal.tsx](file://web/components/GuestUsernameModal.tsx#L1-L80)
- [web/components/MatchingInterface.tsx](file://web/components/MatchingInterface.tsx#L1-L70)
- [web/components/MediaErrorAlert.tsx](file://web/components/MediaErrorAlert.tsx#L1-L50)
- [web/components/SessionTestButton.tsx](file://web/components/SessionTestButton.tsx#L1-L35)
- [web/components/VideoCallModal.tsx](file://web/components/VideoCallModal.tsx#L1-L200)
- [web/components/theme-provider.tsx](file://web/components/theme-provider.tsx#L1-L45)
- [web/contexts/ChatContext.tsx](file://web/contexts/ChatContext.tsx#L1-L524)
- [web/contexts/GuestSessionContext.tsx](file://web/contexts/GuestSessionContext.tsx#L1-L150)
- [web/hooks/useWebRTC.ts](file://web/hooks/useWebRTC.ts#L1-L1085)
- [web/hooks/use-mobile.ts](file://web/hooks/use-mobile.ts#L1-L25)
- [web/hooks/use-toast.ts](file://web/hooks/use-toast.ts#L1-L30)
- [web/hooks/useCallLogs.ts](file://web/hooks/useCallLogs.ts#L1-L40)
- [web/lib/api.ts](file://web/lib/api.ts#L1-L55)
- [web/lib/mediaUtils.ts](file://web/lib/mediaUtils.ts#L1-L70)
- [web/lib/socket.ts](file://web/lib/socket.ts#L1-L370)
- [web/lib/utils.ts](file://web/lib/utils.ts#L1-L35)

## Root-Level Configuration Files

The root directory contains several configuration files that define the application's environment, build settings, and development workflow. The .env file in the backend directory specifies server configuration including PORT=3001, CORS_ORIGIN for cross-origin resource sharing, JWT_SECRET for token authentication, REDIS configuration for scaling, file upload limits, and logging settings. The .env file in the web directory defines frontend environment variables with NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SOCKET_URL pointing to the backend server endpoints. The next.config.mjs file configures Next.js with allowed development origins for mobile testing, ESLint and TypeScript build settings, and image optimization disabled for better performance. The tsconfig.json file defines TypeScript compiler options including module resolution, strict type checking, JSX preservation, and path aliases for easier imports. The package.json files in both backend and web directories list dependencies, development dependencies, and scripts for starting, building, testing, and linting the applications.

**Section sources**
- [backend/.env](file://backend/.env#L1-L33)
- [web/.env](file://web/.env#L1-L3)
- [web/next.config.mjs](file://web/next.config.mjs#L1-L40)
- [web/tsconfig.json](file://web/tsconfig.json#L1-L28)
- [backend/package.json](file://backend/package.json#L1-L66)
- [web/package.json](file://web/package.json#L1-L92)

## Testing and Documentation Files

The project includes comprehensive testing and documentation files at various levels to ensure code quality and facilitate development. Test files are organized in __tests__ directories within relevant components, such as socketHandlers.connection.test.js and socketHandlers.messaging.test.js in backend/src/socket/__tests__ for Socket.IO event testing, VideoCallModal.video-toggle.test.tsx in web/components/__tests__ for component testing, and useWebRTC.integration.test.tsx in web/hooks/__tests__ for WebRTC integration testing. Documentation files include README.md in both backend and web directories with setup instructions, API documentation, and deployment guides. The backend includes API_DOCUMENTATION.md with detailed endpoint specifications, FRONTEND_INTEGRATION_GUIDE.md for frontend developers, QUICK_REFERENCE.md for common commands, TEST_SUITE_SUMMARY.md for test results, and WARP.md for deployment workflows. The web directory includes CALL_DISCONNECTION_TEST.md for call disconnection scenarios, CAMERA_TOGGLE_TEST_GUIDE.md for camera toggle testing, MOBILE_WEBRTC_GUIDE.md for mobile WebRTC considerations, TEST_README.md for testing instructions, and VIDEO_CALL_FIXES.md for known video call issues and solutions. Configuration files for testing include jest.config.js and jest.setup.js in the web directory for Jest testing framework setup.

**Section sources**
- [backend/src/socket/__tests__/socketHandlers.connection.test.js](file://backend/src/socket/__tests__/socketHandlers.connection.test.js#L1-L50)
- [backend/src/socket/__tests__/socketHandlers.messaging.test.js](file://backend/src/socket/__tests__/socketHandlers.messaging.test.js#L1-L55)
- [web/components/__tests__/VideoCallModal.video-toggle.test.tsx](file://web/components/__tests__/VideoCallModal.video-toggle.test.tsx#L1-L35)
- [web/hooks/__tests__/useWebRTC.integration.test.tsx](file://web/hooks/__tests__/useWebRTC.integration.test.tsx#L1-L45)
- [web/hooks/__tests__/useWebRTC.video-toggle.test.tsx](file://web/hooks/__tests__/useWebRTC.video-toggle.test.tsx#L1-L40)
- [backend/README.md](file://backend/README.md#L1-L584)
- [backend/API_DOCUMENTATION.md](file://backend/API_DOCUMENTATION.md#L1-L200)
- [backend/FRONTEND_INTEGRATION_GUIDE.md](file://backend/FRONTEND_INTEGRATION_GUIDE.md#L1-L150)
- [backend/QUICK_REFERENCE.md](file://backend/QUICK_REFERENCE.md#L1-L100)
- [backend/TEST_SUITE_SUMMARY.md](file://backend/TEST_SUITE_SUMMARY.md#L1-L80)
- [backend/WARP.md](file://backend/WARP.md#L1-L60)
- [web/CALL_DISCONNECTION_TEST.md](file://web/CALL_DISCONNECTION_TEST.md#L1-L70)
- [web/CAMERA_TOGGLE_TEST_GUIDE.md](file://web/CAMERA_TOGGLE_TEST_GUIDE.md#L1-L90)
- [web/MOBILE_WEBRTC_GUIDE.md](file://web/MOBILE_WEBRTC_GUIDE.md#L1-L120)
- [web/TEST_README.md](file://web/TEST_README.md#L1-L100)
- [web/VIDEO_CALL_FIXES.md](file://web/VIDEO_CALL_FIXES.md#L1-L130)
- [web/jest.config.js](file://web/jest.config.js#L1-L25)
- [web/jest.setup.js](file://web/jest.setup.js#L1-L20)