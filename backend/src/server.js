const express = require("express");
const http = require("http");
const path = require("path");
require("dotenv").config();

const { connectDB, logger } = require("./config/database");
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
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const fileRoutes = require("./routes/fileRoutes");
const tempFileRoutes = require("./routes/tempFileRoutes");

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

async function initializeDatabase() {
  try {
    await connectDB();
    logger.info("Database initialized successfully");
  } catch (error) {
    logger.error("Database initialization failed:", error);
    // Exit gracefully without triggering error cascade
    setTimeout(() => {
      process.exit(1);
    }, 1000);
    throw error;
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
  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/users", apiLimiter, userRoutes);
  app.use("/api/files", apiLimiter, fileRoutes);
  app.use("/api/temp-files", tempFileRoutes); // No rate limiting for file serving

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

    server.close(() => {
      logger.info("HTTP server closed");
      const mongoose = require("mongoose");
      mongoose.connection.close(() => {
        logger.info("Database connection closed");
        process.exit(0);
      });
    });

    setTimeout(() => {
      logger.error("Forced shutdown due to timeout");
      process.exit(1);
    }, 10000);
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

  // Initialize database asynchronously (non-blocking)
  initializeDatabase().catch((err) => {
    logger.warn(
      "Database initialization failed, continuing without database:",
      err.message
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
