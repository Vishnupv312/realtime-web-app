# Getting Started

<cite>
**Referenced Files in This Document**   
- [backend/package.json](file://backend/package.json)
- [web/package.json](file://web/package.json)
- [backend/.env](file://backend/.env)
- [web/.env.local](file://web/.env.local)
- [backend/README.md](file://backend/README.md)
- [backend/src/server.js](file://backend/src/server.js)
- [backend/src/config/database.js](file://backend/src/config/database.js)
- [backend/ecosystem.config.js](file://backend/ecosystem.config.js)
- [backend/src/socket/socketServer.js](file://backend/src/socket/socketServer.js)
- [backend/src/utils/redisGuestManager.js](file://backend/src/utils/redisGuestManager.js)
- [web/next.config.mjs](file://web/next.config.mjs)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Development Environment Setup](#development-environment-setup)
3. [Backend Installation and Configuration](#backend-installation-and-configuration)
4. [Frontend Installation and Configuration](#frontend-installation-and-configuration)
5. [Starting the Servers](#starting-the-servers)
6. [Accessing the Application](#accessing-the-application)
7. [Troubleshooting Common Issues](#troubleshooting-common-issues)
8. [Application Features Overview](#application-features-overview)

## Introduction
This guide provides comprehensive instructions for setting up the Realtime Chat App development environment. The application consists of a Node.js backend with Socket.IO for real-time communication and a Next.js frontend. The setup includes configuration for MongoDB (though currently unused), Redis for session management, and proper environment variable setup. This document covers platform-specific considerations for macOS, Linux, and Windows environments.

## Development Environment Setup
To set up the development environment for the Realtime Chat App, you'll need to install the required software dependencies. The application requires specific versions of Node.js, package managers, and database services to function correctly.

### Required Software
The Realtime Chat App requires the following software to be installed on your development machine:

- **Node.js 18+**: The backend is built on Node.js with an engine requirement of version 16.0.0 or higher, but Node.js 18+ is recommended for optimal performance and compatibility.
- **pnpm**: The frontend uses pnpm as its package manager instead of npm or yarn, as indicated by the presence of pnpm-lock.yaml in the web directory.
- **MongoDB**: Although the current implementation doesn't actively use MongoDB (relying instead on Redis and in-memory storage), MongoDB 4.4+ is listed as a prerequisite in the documentation and should be installed for potential future use.
- **Redis**: Redis is used for guest session management and scaling, with the backend configured to connect to Redis on localhost:6379 by default.

### Platform-Specific Installation Instructions
The installation process varies slightly depending on your operating system. Below are the platform-specific instructions for setting up the required software.

#### macOS
For macOS users, the recommended approach is to use Homebrew for package management:

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 18+
brew install node@18

# Install pnpm
npm install -g pnpm

# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Install Redis
brew install redis
```

After installation, start the MongoDB and Redis services:

```bash
# Start MongoDB
brew services start mongodb-community

# Start Redis
brew services start redis
```

#### Linux
For Linux distributions, use the appropriate package manager for your distribution:

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Install Redis
sudo apt-get install redis-server
```

Start the services:

```bash
# Start MongoDB
sudo systemctl start mongod

# Start Redis
sudo systemctl start redis-server
```

#### Windows
For Windows users, download the installers from the official websites:

1. Download and install Node.js 18+ from [nodejs.org](https://nodejs.org/)
2. Install pnpm via npm: `npm install -g pnpm`
3. Download MongoDB from [mongodb.com](https://www.mongodb.com/try/download/community)
4. Download Redis from [redis.io](https://redis.io/download/) or use Windows Subsystem for Linux (WSL)

Alternatively, use Windows Package Manager (winget):

```cmd
# Install Node.js
winget install OpenJS.NodeJS.LTS

# Install MongoDB
winget install MongoDB.Server

# Install Redis
winget install Redis.Redis
```

**Section sources**
- [backend/package.json](file://backend/package.json#L1-L65)
- [backend/README.md](file://backend/README.md#L30-L58)

## Backend Installation and Configuration
This section covers the installation and configuration of the backend server for the Realtime Chat App. The backend is built with Node.js, Express, and Socket.IO, providing real-time communication capabilities.

### Installing Backend Dependencies
To install the backend dependencies, navigate to the backend directory and use npm to install the required packages:

```bash
cd backend
npm install
```

The package.json file in the backend directory lists the dependencies, including Express for the web server, Socket.IO for real-time communication, Redis for session management, and various security and utility packages. The installation will create a node_modules directory containing all the required packages.

### Backend Configuration
The backend configuration is managed through environment variables in the .env file. A sample .env file is provided in the backend directory with default values that can be customized for your development environment.

#### Environment Variables
The following environment variables are available for configuration in the backend/.env file:

- **Server Configuration**: PORT (default: 3001), NODE_ENV (default: development), CORS_ORIGIN (default: http://localhost:3000)
- **JWT Configuration**: JWT_SECRET (must be changed in production), JWT_EXPIRES_IN (default: 7d)
- **Redis Configuration**: REDIS_HOST (default: localhost), REDIS_PORT (default: 6379), REDIS_PASSWORD (empty by default), REDIS_URL (default: redis://localhost:6379)
- **File Upload Configuration**: MAX_FILE_SIZE (default: 10485760 bytes = 10MB), MAX_VOICE_DURATION (default: 300 seconds = 5 minutes), UPLOAD_PATH (default: ./uploads)
- **Security Configuration**: BCRYPT_ROUNDS (default: 12), RATE_LIMIT_WINDOW_MS (default: 900000 ms = 15 minutes), RATE_LIMIT_MAX_REQUESTS (default: 100)
- **Logging**: LOG_LEVEL (default: info), LOG_FILE (default: ./logs/app.log)
- **Clustering**: CLUSTER_MODE (default: false), CLUSTER_WORKERS (default: 0)

The backend is configured to use Redis for guest session management, with a fallback to in-memory storage if Redis is not available. The RedisGuestManager class handles the connection to Redis and provides methods for creating, retrieving, and updating guest sessions.

**Section sources**
- [backend/.env](file://backend/.env#L1-L32)
- [backend/src/server.js](file://backend/src/server.js#L1-L264)
- [backend/src/utils/redisGuestManager.js](file://backend/src/utils/redisGuestManager.js#L1-L431)

## Frontend Installation and Configuration
This section covers the installation and configuration of the frontend application for the Realtime Chat App. The frontend is built with Next.js, a React framework for server-side rendering and static site generation.

### Installing Frontend Dependencies
To install the frontend dependencies, navigate to the web directory and use pnpm to install the required packages:

```bash
cd web
pnpm install
```

The package.json file in the web directory lists the dependencies, including Next.js for the framework, React for the UI library, Tailwind CSS for styling, and various UI component libraries. The installation will create a node_modules directory containing all the required packages.

### Frontend Configuration
The frontend configuration is managed through environment variables in the .env.local file. Two environment files are provided: .env and .env.local. The .env.local file takes precedence over .env and should be used for local development configuration.

#### Environment Variables
The following environment variables are available for configuration in the web/.env.local file:

- **API Configuration**: NEXT_PUBLIC_API_URL (API endpoint for backend requests)
- **Socket Configuration**: NEXT_PUBLIC_SOCKET_URL (WebSocket endpoint for Socket.IO connections)

The current .env.local file is configured to connect to the backend server running on a specific IP address and port:

```
NEXT_PUBLIC_API_URL=http://10.95.226.36:3001
NEXT_PUBLIC_SOCKET_URL=http://10.95.226.36:3001
```

For local development, you may need to update these values to match your local environment. If running both servers on the same machine, you can use:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

The next.config.mjs file contains additional configuration for the Next.js application, including allowed development origins for CORS, ESLint and TypeScript settings, and image optimization settings. The allowedDevOrigins array includes various IP address patterns to allow connections from different network interfaces, which is useful for testing on mobile devices or other computers on the same network.

**Section sources**
- [web/.env.local](file://web/.env.local#L1-L2)
- [web/package.json](file://web/package.json#L1-L91)
- [web/next.config.mjs](file://web/next.config.mjs#L1-L39)

## Starting the Servers
This section covers the process of starting both the backend and frontend servers in the correct order to ensure proper functionality of the Realtime Chat App.

### Startup Order and Commands
It's important to start the servers in the correct order to ensure that the frontend can connect to the backend. The backend server should be started first, followed by the frontend server.

#### Starting the Backend Server
Navigate to the backend directory and start the server using one of the following commands:

```bash
# Development mode with nodemon (restarts on file changes)
npm run dev

# Development mode with clustering
npm run dev:cluster

# Direct node execution
node src/server.js
```

The backend server will start on port 3001 (or the port specified in the .env file) and listen on all network interfaces (0.0.0.0). You should see output indicating that the server is running, the Socket.IO server is ready, and the environment is set to development.

#### Starting the Frontend Server
Once the backend server is running, open a new terminal window, navigate to the web directory, and start the frontend server:

```bash
# Development mode
pnpm dev

# Or using the direct next.js command
npx next dev -p 3000
```

The frontend server will start on port 3000 and display the URL where the application can be accessed (usually http://localhost:3000).

### Development Scripts
The package.json files in both the backend and web directories contain scripts for various development tasks:

**Backend Scripts:**
- `start`: Starts the server in production mode
- `dev`: Starts the server in development mode with nodemon
- `dev:cluster`: Starts the server in clustered development mode
- `test`: Runs Jest tests
- `test:watch`: Runs Jest tests in watch mode
- `test:coverage`: Runs Jest tests with coverage reporting
- `test:socket`: Runs only the socket handler tests

**Frontend Scripts:**
- `dev`: Starts the Next.js development server on port 3000
- `build`: Builds the Next.js application for production
- `start`: Starts the Next.js production server on port 3000
- `lint`: Runs linting on the codebase
- `test`: Runs Jest tests
- `test:watch`: Runs Jest tests in watch mode
- `test:coverage`: Runs Jest tests with coverage reporting

The ecosystem.config.js file in the backend directory provides configuration for PM2, a production process manager for Node.js applications. It defines three application configurations:
- `realtime-chat-dev`: Single instance mode for development
- `realtime-chat-prod`: Clustered mode for production
- `realtime-chat-load-balanced`: Multiple instances for load balancing

**Section sources**
- [backend/package.json](file://backend/package.json#L1-L65)
- [web/package.json](file://web/package.json#L1-L91)
- [backend/ecosystem.config.js](file://backend/ecosystem.config.js#L1-L97)

## Accessing the Application
Once both servers are running, you can access the Realtime Chat App through your web browser. The application provides a real-time chat interface with guest user functionality and WebRTC-based audio/video calling capabilities.

### Local Access
By default, the frontend server runs on port 3000 and can be accessed at:

```
http://localhost:3000
```

If you have configured the frontend to allow connections from your IP address (as specified in next.config.mjs), you can also access the application using your machine's IP address:

```
http://10.109.44.148:3000
```

Replace the IP address with your actual local IP address. This is useful for testing the application on mobile devices or other computers on the same network.

### Verification of Setup
To verify that the setup is working correctly, perform the following checks:

1. **Backend Health Check**: Access the backend health endpoint at http://localhost:3001/health. You should receive a JSON response indicating that the server is running.

2. **Socket.IO Connection**: Check the browser's developer console for any errors related to Socket.IO connection. A successful connection will show a "Connected to server" message.

3. **CORS Test**: Access the CORS test endpoint at http://localhost:3001/api/cors-test. This endpoint verifies that CORS is configured correctly and should return a JSON response with success: true.

4. **Application Functionality**: Navigate through the application interface to ensure all components are loading correctly. The main page should display a chat interface, and you should be able to initiate a guest session.

### Cross-Origin Resource Sharing (CORS)
The application is configured to handle CORS requests from specific origins. The backend allows requests from http://localhost:3000 and http://10.95.226.36:3000 as specified in the CORS_ORIGIN environment variable. The frontend's next.config.mjs file includes an allowedDevOrigins array that specifies which origins are permitted during development, including various IP address patterns for local network access.

**Section sources**
- [backend/src/server.js](file://backend/src/server.js#L1-L264)
- [web/next.config.mjs](file://web/next.config.mjs#L1-L39)

## Troubleshooting Common Issues
This section addresses common setup issues that may occur when configuring the Realtime Chat App development environment. These issues typically relate to database connections, Redis configuration, and CORS errors.

### Database Connection Failures
Although the current implementation does not actively use MongoDB (relying instead on Redis and in-memory storage), MongoDB connection issues may still occur if the application attempts to connect to a MongoDB instance.

**Symptoms:**
- Error messages indicating "MongoDB connection failed" or "MongoDB Connected" in the server logs
- Application startup failures related to database connectivity

**Solutions:**
1. Ensure MongoDB is installed and running on your system.
2. Verify that the MongoDB service is active:
   - macOS: `brew services list | grep mongodb`
   - Linux: `sudo systemctl status mongod`
   - Windows: Check Services for "MongoDB Server"
3. If MongoDB is not required for your use case, you can ignore these messages as the application will fall back to Redis and in-memory storage.
4. If you need MongoDB functionality, ensure the MONGODB_URI environment variable is correctly set in the .env file.

### Redis Not Running
Redis is used for guest session management and scaling. If Redis is not running, the application will fall back to in-memory storage, which may affect functionality in clustered environments.

**Symptoms:**
- Warning messages in the server logs: "Redis initialization failed" or "Continuing without Redis"
- "Failed to initialize Redis adapter" messages
- Limited session persistence across server restarts

**Solutions:**
1. Install and start Redis:
   - macOS: `brew services start redis`
   - Linux: `sudo systemctl start redis-server`
   - Windows: Start the Redis service from Services or use WSL
2. Verify Redis is running by connecting to it:
   ```bash
   redis-cli ping
   ```
   You should receive a "PONG" response.
3. Ensure the REDIS_URL in the .env file matches your Redis installation (default: redis://localhost:6379).
4. Restart the backend server after starting Redis to establish the connection.

### CORS Errors
Cross-Origin Resource Sharing (CORS) errors occur when the frontend attempts to connect to the backend from a different origin than what is permitted.

**Symptoms:**
- Browser console errors: "Access to fetch at 'http://localhost:3001/health' from origin 'http://localhost:3000' has been blocked by CORS policy"
- Failed API requests with status code 403 or 405
- Socket.IO connection failures

**Solutions:**
1. Verify the CORS_ORIGIN environment variable in backend/.env includes the frontend origin:
   ```
   CORS_ORIGIN=http://localhost:3000,http://10.95.226.36:3000
   ```
2. Check the frontend's .env.local file to ensure NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SOCKET_URL match the backend server address.
3. For development, you can temporarily use a more permissive CORS configuration by modifying the cors middleware in the backend, but this should not be used in production.
4. Ensure both servers are running on the expected ports (backend on 3001, frontend on 3000).
5. If accessing from a mobile device or another computer, ensure the IP address is included in the allowed origins in next.config.mjs.

### Additional Troubleshooting Tips
- **Port Conflicts**: If the default ports (3000 for frontend, 3001 for backend) are in use, modify the PORT environment variable in backend/.env and the -p flag in the frontend start command.
- **Node.js Version Issues**: Ensure you are using Node.js 18+ as specified in the requirements. Version mismatches can cause dependency installation issues.
- **File Permissions**: On Unix-based systems, ensure the uploads directory has proper write permissions for the Node.js process.
- **Firewall Settings**: Ensure your firewall allows connections on ports 3000 and 3001, especially if accessing from other devices on the network.

**Section sources**
- [backend/.env](file://backend/.env#L1-L32)
- [backend/src/server.js](file://backend/src/server.js#L1-L264)
- [backend/src/socket/socketServer.js](file://backend/src/socket/socketServer.js#L1-L198)
- [web/.env.local](file://web/.env.local#L1-L2)
- [web/next.config.mjs](file://web/next.config.mjs#L1-L39)

## Application Features Overview
Once the Realtime Chat App is successfully running, you can explore its main features. The application provides a guest-based chat experience with real-time messaging and WebRTC-powered audio/video calling capabilities.

### Main Features
The Realtime Chat App offers the following key features:

1. **Guest User System**: Users can join as guests without registration, with randomly generated usernames (e.g., "CoolPanda123").
2. **Real-Time Messaging**: Instant text chat with other users, with messages transmitted via Socket.IO.
3. **User Matching**: Random matching system that connects guest users for one-on-one conversations.
4. **File Sharing**: Ability to share files up to 10MB in size.
5. **Voice Notes**: Recording and sending voice messages up to 5 minutes in length.
6. **WebRTC Audio/Video Calls**: Real-time audio and video calling between matched users using WebRTC technology.
7. **Typing Indicators**: Visual indication when the other user is typing a message.
8. **Connection Status**: Display of connection quality and status information.

### User Interface
The application interface consists of:
- A main chat window with message history
- Input area for typing messages
- Controls for file attachment and voice recording
- Video call initiation button
- User information and connection status display
- Guest username display and management

The frontend is built with Next.js and uses Tailwind CSS for styling, with UI components from Radix UI and other libraries. The responsive design allows for use on both desktop and mobile devices.

### Technology Stack
The application leverages several modern technologies:
- **Backend**: Node.js, Express, Socket.IO, Redis
- **Frontend**: Next.js, React, Tailwind CSS
- **Real-Time Communication**: WebRTC for peer-to-peer audio/video, Socket.IO for signaling and chat
- **State Management**: Context API for state management in React components
- **Authentication**: JWT-based authentication for registered users (though the current focus is on guest access)

**Section sources**
- [backend/README.md](file://backend/README.md#L3-L583)
- [backend/src/socket/socketServer.js](file://backend/src/socket/socketServer.js#L1-L198)
- [web/package.json](file://web/package.json#L1-L91)