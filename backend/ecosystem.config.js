module.exports = {
  apps: [
    {
      // Single instance mode (development/low-cost starter)
      name: "realtime-chat-starter",
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,

        // === VALKEY/REDIS CONNECTION DETAILS ===
        REDIS_HOST: "master.chat-app-valkey.w4qqcd.aps1.cache.amazonaws.com",
        REDIS_PORT: 6379,
        // REDIS_PASSWORD: 'your_secret_password', // Uncomment and set if needed
        // =======================================
      },
      watch: true,
      ignore_watch: ["node_modules", "uploads", "logs", ".git"],
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      time: true,
    },
    {
      // Clustered mode (production) - UPDATED REDIS CONFIG
      name: "realtime-chat-prod-cluster",
      script: "src/cluster.js",
      instances: "max", // Use all CPU cores
      exec_mode: "cluster",
      // Base ENV (Will be used if starting without --env production)
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        CLUSTER_MODE: true,
        // === VALKEY/REDIS CONNECTION DETAILS ADDED ===
        REDIS_HOST: "master.chat-app-valkey.w4qqcd.aps1.cache.amazonaws.com",
        REDIS_PORT: 6379,
        // ===========================================
      },
      // env_production (Will override base env)
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
        CLUSTER_MODE: true,
        // === VALKEY/REDIS CONNECTION DETAILS ADDED ===
        REDIS_HOST: "master.chat-app-valkey.w4qqcd.aps1.cache.amazonaws.com",
        REDIS_PORT: 6379,
        // ===========================================
      },
      watch: false,
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      time: true,
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",

      // Auto restart settings
      min_uptime: "10s",
      max_restarts: 5,

      // Graceful shutdown
      kill_timeout: 5000,

      // Health monitoring
      health_check_http: {
        url: "http://localhost:3001/health",
        interval: 30000,
        timeout: 5000,
        max_fails: 3,
      },
    },
    {
      // Load balancer mode (multiple instances without clustering) - UPDATED REDIS CONFIG
      name: "realtime-chat-load-balanced",
      script: "src/server.js",
      instances: 4,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        // === VALKEY/REDIS CONNECTION DETAILS UPDATED ===
        REDIS_HOST: "master.chat-app-valkey.w4qqcd.aps1.cache.amazonaws.com",
        REDIS_PORT: 6379,
        // REDIS_URL: "redis://localhost:6379", // No longer needed if using HOST/PORT
        // =============================================
      },
      increment_var: "PORT",
      watch: false,
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      time: true,
      max_memory_restart: "512M",
    },
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: "node",
      host: "your-server.com",
      ref: "origin/main",
      repo: "https://github.com/yourusername/realtime-chat-backend.git",
      path: "/var/www/realtime-chat",
      "pre-deploy-local": "",
      // **CRITICAL CHANGE:** Use --only to start the low-cost process
      "post-deploy":
        "npm install && pm2 start ecosystem.config.js --only realtime-chat-starter",
      "pre-setup": "",
    },
  },
};
