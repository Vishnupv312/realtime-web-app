const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cors = require("cors");
const mongoSanitize = require("express-mongo-sanitize");
const { logger } = require("../config/database");

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message:
        message || "Too many requests from this IP, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(
        `Rate limit reached for IP: ${req.ip}, User-Agent: ${req.get(
          "User-Agent"
        )}`
      );
      res.status(429).json({
        success: false,
        message:
          message || "Too many requests from this IP, please try again later.",
      });
    },
    skip: (req) => {
      // Skip rate limiting for health check endpoints
      return req.path === "/health" || req.path === "/api/health";
    },
  });
};

// Different rate limiters for different endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  50, // 5 attempts
  "Too many authentication attempts, please try again in 15 minutes."
);

const apiLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests
  "Too many API requests, please try again later."
);

const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 uploads per hour
  "Too many file uploads, please try again in an hour."
);

// CORS configuration
// Put your LAN IP here
const DEV_LAN_IP = "192.168.29.177"; // <-- replace with your LAN IP

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // In development, allow all origins including LAN IP
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.CORS_ORIGIN,
      `http://${DEV_LAN_IP}:3000`,
      `http://${DEV_LAN_IP}:3335`,
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3335",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3335",
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["X-Total-Count"],
};

const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3335",
        `http://${DEV_LAN_IP}:3000`,
        `http://${DEV_LAN_IP}:3335`,
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3335",
      ],
      connectSrc: [
        "'self'",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3335",
        `http://${DEV_LAN_IP}:3000`,
        `http://${DEV_LAN_IP}:3335`,
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3335",
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: [
        "'self'",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3335",
        `http://${DEV_LAN_IP}:3000`,
        `http://${DEV_LAN_IP}:3335`,
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3335",
      ],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
};

// Input sanitization middleware
// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  try {
    // Skip sanitization for multipart/form-data requests (file uploads)
    // as multer handles the parsing and mongoSanitize can interfere
    if (req.is("multipart/form-data")) {
      // Apply only custom sanitization to body fields
      if (req.body && typeof req.body === "object") {
        req.body = sanitizeObject(req.body);
      }
      return next();
    }

    // Apply mongo sanitize for other requests
    mongoSanitize()(req, res, (err) => {
      if (err) {
        logger.error("MongoSanitize error:", err);
        return next();
      }

      // Additional custom sanitization only on writable properties
      try {
        if (req.body && typeof req.body === "object") {
          req.body = sanitizeObject(req.body);
        }
        next();
      } catch (sanitizeError) {
        logger.error("Custom sanitization error:", sanitizeError);
        next();
      }
    });
  } catch (error) {
    logger.error("MongoSanitize error:", error);
    next();
  }
};
// Recursive object sanitization
const sanitizeObject = (obj) => {
  if (typeof obj !== "object" || obj === null) {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(obj[key]);
    }
  }

  return sanitized;
};

// String sanitization
const sanitizeString = (str) => {
  if (typeof str !== "string") return str;

  // Remove potentially dangerous characters and patterns
  return str
    .replace(/<script[^>]*>.*?<\/script>/gi, "") // Remove script tags
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: URLs
    .replace(/on\w+="[^"]*"/gi, "") // Remove event handlers
    .replace(/on\w+='[^']*'/gi, "") // Remove event handlers (single quotes)
    .trim();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Additional security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  // Remove server information
  res.removeHeader("X-Powered-By");

  next();
};

// IP extraction middleware
const extractClientIP = (req, res, next) => {
  // Get the real IP address from various headers
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip;

  req.clientIP = ip;
  next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.clientIP || req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // Log response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - start;
    logger.info(
      `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`
    );
    originalSend.call(this, data);
  };

  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  logger.error("Request error:", {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.clientIP || req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Don't leak error details in production
  if (process.env.NODE_ENV === "production") {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } else {
    res.status(500).json({
      success: false,
      message: err.message,
      stack: err.stack,
    });
  }
};

module.exports = {
  authLimiter,
  apiLimiter,
  uploadLimiter,
  corsOptions,
  helmetConfig,
  sanitizeInput,
  securityHeaders,
  extractClientIP,
  requestLogger,
  errorHandler,
  helmet: helmet(helmetConfig),
  cors: cors(corsOptions),
};
