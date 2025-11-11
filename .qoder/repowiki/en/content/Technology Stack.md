# Technology Stack

<cite>
**Referenced Files in This Document**   
- [web/package.json](file://web/package.json)
- [backend/package.json](file://backend/package.json)
- [web/next.config.mjs](file://web/next.config.mjs)
- [backend/ecosystem.config.js](file://backend/ecosystem.config.js)
- [web/tsconfig.json](file://web/tsconfig.json)
- [backend/src/config/database.js](file://backend/src/config/database.js)
- [backend/src/config/logger.js](file://backend/src/config/logger.js)
- [backend/src/utils/jwt.js](file://backend/src/utils/jwt.js)
- [backend/src/utils/redisGuestManager.js](file://backend/src/utils/redisGuestManager.js)
- [web/lib/socket.ts](file://web/lib/socket.ts)
- [web/jest.config.js](file://web/jest.config.js)
- [web/jest.setup.js](file://web/jest.setup.js)
- [backend/src/socket/socketHandlers.js](file://backend/src/socket/socketHandlers.js)
</cite>

## Table of Contents
1. [Frontend Stack](#frontend-stack)
2. [Backend Stack](#backend-stack)
3. [Testing Stack](#testing-stack)
4. [Build and Deployment Tools](#build-and-deployment-tools)
5. [Dependency Management](#dependency-management)

## Frontend Stack

The frontend of the Realtime Chat App is built using a modern React-based technology stack centered around Next.js 14 with the App Router architecture. The application leverages React 19 (as specified in package.json) for building dynamic user interfaces with server-side rendering and static site generation capabilities. TypeScript (version 5+) provides static typing for improved code quality and developer experience, as configured in tsconfig.json.

Next.js 15.2.4 serves as the core framework, enabling server-side rendering, API routes, and file-based routing through the App Router pattern. The styling system combines Tailwind CSS for utility-first CSS with custom configurations in tailwindcss-animate and tailwind-merge for optimized styling and animation handling. The UI component library is built on Radix UI primitives (including components like Accordion, AlertDialog, Avatar, Checkbox, Dialog, DropdownMenu, Tabs, Toast, and Tooltip), which provide accessible, unstyled components that are styled using Tailwind CSS classes.

The real-time communication layer uses Socket.IO client (latest version) to maintain persistent connections with the backend server for instant messaging, presence updates, and WebRTC signaling. Additional frontend libraries include framer-motion for animations, zod for schema validation, react-hook-form for form state management, and js-cookie for client-side cookie operations. The theme system is implemented using next-themes for dark/light mode toggling, with Vercel Analytics integrated for usage tracking.

**Section sources**
- [web/package.json](file://web/package.json)
- [web/next.config.mjs](file://web/next.config.mjs)
- [web/tsconfig.json](file://web/tsconfig.json)
- [web/lib/socket.ts](file://web/lib/socket.ts)
- [web/components/ui/button.tsx](file://web/components/ui/button.tsx)
- [web/components/theme-provider.tsx](file://web/components/theme-provider.tsx)
- [web/app/layout.tsx](file://web/app/layout.tsx)

## Backend Stack

The backend infrastructure is built on Node.js 16+ (with engine specification in package.json) using Express.js 5.1.0 as the web application framework. The real-time communication layer is powered by Socket.IO 4.8.1, which handles WebSocket connections for instant messaging, user presence, and WebRTC signaling between clients. For session and state management, Redis 5.8.2 is used as an in-memory data store, with the @socket.io/redis-adapter enabling horizontal scaling of Socket.IO across multiple server instances.

Persistent data storage is handled by MongoDB via Mongoose ODM, with connection management and error handling implemented in the database configuration. Authentication is implemented using JWT (JSON Web Tokens) with jsonwebtoken 9.0.2, providing stateless authentication with token expiration and secure secret management. The winston 3.17.0 logging library provides structured JSON logging with multiple transports (console and file) and error-level filtering, as configured in both logger.js and database.js.

Security middleware includes helmet for HTTP header protection, cors for cross-origin resource sharing, express-rate-limit for rate limiting, and express-validator for input validation. Additional utilities include bcryptjs for password hashing, multer for file uploads, and geoip-lite for IP-based geolocation. The redisGuestManager.js utility implements a robust guest session management system with Redis as the primary store and in-memory fallback, handling guest session creation, presence updates, and cleanup.

**Section sources**
- [backend/package.json](file://backend/package.json)
- [backend/src/config/database.js](file://backend/src/config/database.js)
- [backend/src/config/logger.js](file://backend/src/config/logger.js)
- [backend/src/utils/jwt.js](file://backend/src/utils/jwt.js)
- [backend/src/utils/redisGuestManager.js](file://backend/src/utils/redisGuestManager.js)
- [backend/src/socket/socketHandlers.js](file://backend/src/socket/socketHandlers.js)

## Testing Stack

The application employs a comprehensive testing strategy using Jest as the primary testing framework for both frontend and backend codebases. On the frontend, React Testing Library is used for component testing, enabling realistic user interaction simulations and DOM queries. The jest.config.js configuration extends Next.js's built-in Jest setup, with custom module mappings and test environment settings. The jest.setup.js file includes mocks for critical dependencies including socket.io-client, js-cookie, and environment variables, ensuring isolated and reliable tests.

The testing setup includes coverage reporting with specific patterns to include relevant source files (lib/, hooks/, components/) while excluding type definitions and node_modules. Test files are organized using the __tests__ directory pattern and follow the *.test.[jt]s?(x) naming convention. The backend also uses Jest for testing socket handlers and business logic, with a dedicated test script configuration that targets the socket handler tests specifically. Both frontend and backend support watch mode, coverage reporting, and continuous testing workflows.

**Section sources**
- [web/jest.config.js](file://web/jest.config.js)
- [web/jest.setup.js](file://web/jest.setup.js)
- [backend/package.json](file://backend/package.json)
- [backend/src/socket/__tests__](file://backend/src/socket/__tests__)

## Build and Deployment Tools

The deployment infrastructure utilizes PM2 as the process manager for the Node.js backend, with a comprehensive ecosystem.config.js configuration that defines multiple deployment modes. The configuration includes three distinct application setups: development mode (single instance with file watching), production mode (clustered mode using all CPU cores), and load-balanced mode (multiple forked instances). PM2 provides features like automatic restarts, memory-based restarts, graceful shutdown, and health monitoring with configurable intervals and failure thresholds.

For frontend deployment, Vercel is the designated platform, as indicated by the presence of Vercel Analytics and the Next.js framework choice, which is optimized for Vercel's infrastructure. The PM2 ecosystem configuration also includes deployment scripts for production environments, with post-deploy commands to install dependencies and reload the process configuration. The backend server implements graceful shutdown handling for both HTTP and MongoDB connections, ensuring clean process termination. Logging is centralized through PM2's log file management, with separate files for combined output, stdout, and stderr.

**Section sources**
- [backend/ecosystem.config.js](file://backend/ecosystem.config.js)
- [backend/package.json](file://backend/package.json)
- [backend/src/server.js](file://backend/src/server.js)
- [backend/src/config/database.js](file://backend/src/config/database.js)

## Dependency Management

The project uses pnpm as the package manager, as evidenced by the presence of pnpm-lock.yaml in the root directory. This choice provides efficient disk space usage through hard linking and a strict dependency resolution algorithm that prevents phantom dependencies. The package.json files in both frontend (web/) and backend directories specify exact version ranges for dependencies, with the frontend using caret (^) and latest version specifiers for most packages.

The dependency strategy separates production dependencies from development dependencies clearly, with frontend development dependencies including testing libraries (jest, @testing-library), TypeScript tooling, and PostCSS processors. The backend development dependencies are minimal, including only nodemon for development and Jest for testing. The use of pnpm enables consistent dependency resolution across environments and faster installation times compared to other package managers. Both frontend and backend include explicit engine specifications to ensure Node.js version compatibility.

**Section sources**
- [web/package.json](file://web/package.json)
- [backend/package.json](file://backend/package.json)
- [web/pnpm-lock.yaml](file://web/pnpm-lock.yaml)
- [backend/package-lock.json](file://backend/package-lock.json)