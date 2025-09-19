const cors = require("cors");

// Simplified CORS configuration for debugging production issues
const debugCorsOptions = {
  origin: [
    "https://realtime-web-app-ecru.vercel.app",
    "https://realtime-web-app.onrender.com",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3335",
    /\.vercel\.app$/, // Allow any vercel app
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization", 
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-CSRF-Token"
  ],
  exposedHeaders: ["X-Total-Count"],
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

// Even more permissive for debugging
const permissiveCorsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: "*",
  exposedHeaders: ["X-Total-Count"],
  optionsSuccessStatus: 200,
};

module.exports = {
  debugCors: cors(debugCorsOptions),
  permissiveCors: cors(permissiveCorsOptions),
};