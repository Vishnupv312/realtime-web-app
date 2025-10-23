const express = require("express");
const http = require("http");
const path = require("path");
require("dotenv").config();

const { logger } = require("./config/logger");
const { createSocketServer } = require("./socket/socketServer");

// Import middleware
const {
  helmet,
  cors,
  authLimiter,
  apiLimiter,
  uploadLimiter,
  sanitizeInput,
  securityHeaders,
  extractClientIP,
  requestLogger,
  errorHandler,
} = require("./middleware/security");

// Temporary debug CORS
const { debugCors, permissiveCors } = require("./middleware/cors-debug");

const { cleanupOldFiles } = require("./middleware/upload");

// Import routes  
const guestRoutes = require("./routes/guest");
const fileRoutes = require("./routes/fileRoutes");
const tempFileRoutes = require("./routes/tempFileRoutes");
const statsRoutes = require("./routes/stats");

function createApp() {
  const app = express();
  // Trust proxy for proper IP detection
  app.set("trust proxy", 1);

  // Security middleware
  app.use(helmet);
  // Use debug CORS for production debugging
  if (process.env.NODE_ENV === "production") {
    console.log("Using debug CORS for production");
    app.use(debugCors);
  } else {
    app.use(cors);
  }
  app.use(securityHeaders);
  app.use(extractClientIP);

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Input sanitization
  app.use(sanitizeInput);

  // Logging middleware
  if (process.env.NODE_ENV !== "test") {
    app.use(requestLogger);
  }

  // Compression middleware
  const compression = require("compression");
  app.use(compression());

  // Static files middleware for uploaded files
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

  logger.info("Middleware initialized successfully");
  return app;
}


async function initializeRedis() {
  try {
    const redisGuestManager = require('./utils/redisGuestManager');
    await redisGuestManager.initialize();
    logger.info("Redis guest manager initialized successfully");
    return true;
  } catch (error) {
    logger.error("Redis initialization failed:", error.message || error);
    logger.warn("Continuing without Redis - using fallback storage");
    return false;
  }
}

function initializeRoutes(app, socketApi) {
  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      success: true,
      message: "Server is running",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0",
    });
  });

  // CORS debug endpoint
  app.get("/api/cors-test", (req, res) => {
    res.json({
      success: true,
      message: "CORS is working",
      origin: req.headers.origin,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });
  });

  // API routes with rate limiting
  app.use("/api/guest", apiLimiter, guestRoutes);
  app.use("/api/files", apiLimiter, fileRoutes);
  app.use("/api/temp-files", tempFileRoutes); // No rate limiting for file serving
  app.use("/api/stats", apiLimiter, statsRoutes);

  // Socket.IO health check
  app.get("/api/socket/stats", apiLimiter, (req, res) => {
    if (socketApi) {
      res.json({
        success: true,
        data: socketApi.getStats(),
      });
    } else {
      res.status(503).json({
        success: false,
        message: "Socket.IO server not initialized",
      });
    }
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "API endpoint not found",
    });
  });

  logger.info("Routes initialized successfully");
}

function initializeErrorHandling(app, server) {
  // Global error handler
  app.use(errorHandler);

  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received, starting graceful shutdown`);

    // Prevent multiple shutdown attempts
    if (gracefulShutdown.inProgress) {
      return;
    }
    gracefulShutdown.inProgress = true;

    const shutdown = async () => {
      try {
        // Close HTTP server
        if (server) {
          server.close();
          logger.info("HTTP server closed");
        }
        
        // Close Redis connection
        try {
          const redisGuestManager = require('./utils/redisGuestManager');
          await redisGuestManager.close();
        } catch (error) {
          logger.error("Error closing Redis connection:", error);
        }
        
        
        process.exit(0);
      } catch (error) {
        logger.error("Error during graceful shutdown:", error);
        process.exit(1);
      }
    };

    shutdown();

    // Force exit after timeout
    setTimeout(() => {
      logger.error("Forced shutdown due to timeout");
      process.exit(1);
    }, 5000); // Reduced timeout
  };

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
    gracefulShutdown("uncaughtException");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    gracefulShutdown("unhandledRejection");
  });

  // Handle SIGTERM (e.g., from process manager)
  process.on("SIGTERM", () => {
    logger.info("SIGTERM received");
    gracefulShutdown("SIGTERM");
  });

  // Handle SIGINT (e.g., Ctrl+C)
  process.on("SIGINT", () => {
    logger.info("SIGINT received");
    gracefulShutdown("SIGINT");
  });

  logger.info("Error handling initialized successfully");
}

function startCleanupTasks() {
  // Clean up old uploaded files every hour
  const cleanupInterval = 60 * 60 * 1000; // 1 hour
  const cleanup = cleanupOldFiles(24); // Remove files older than 24 hours

  setInterval(cleanup, cleanupInterval);
  // Run initial cleanup
  setTimeout(cleanup, 5000); // After 5 seconds

  logger.info("Cleanup tasks started");
}

function startServer() {
  const app = createApp();
  const httpServer = http.createServer(app);
  const port = process.env.PORT || 3001;

  // Initialize Socket.IO
  const socketApi = createSocketServer(httpServer);

  initializeRoutes(app, socketApi);
  initializeErrorHandling(app, httpServer);
  startCleanupTasks();

  // Initialize Redis manager asynchronously (non-blocking)
  initializeRedis().catch((err) => {
    logger.warn(
      "Redis initialization failed, using fallback storage:",
      err.message || 'Unknown error'
    );
  });

  httpServer.listen(port, "0.0.0.0", () => {
    logger.info(`🚀 Server running on port http://0.0.0.0:${port}`);
    logger.info(`📡 Socket.IO server ready`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    logger.info(`📊 Health check: http://localhost:${port}/health`);
    logger.info(`📈 Socket stats: http://localhost:${port}/api/socket/stats`);
  });

  return { app, httpServer, socketApi };
}

// Create and start server if run directly
if (require.main === module) {
  startServer();
}

module.exports = { startServer, createApp };
