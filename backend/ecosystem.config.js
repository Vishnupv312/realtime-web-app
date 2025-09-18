module.exports = {
  apps: [
    {
      // Single instance mode (development)
      name: 'realtime-chat-dev',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      watch: true,
      ignore_watch: [
        'node_modules',
        'uploads',
        'logs',
        '.git'
      ],
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true
    },
    {
      // Clustered mode (production)
      name: 'realtime-chat-prod',
      script: 'src/cluster.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        CLUSTER_MODE: true
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        CLUSTER_MODE: true
      },
      watch: false,
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      
      // Auto restart settings
      min_uptime: '10s',
      max_restarts: 5,
      
      // Graceful shutdown
      kill_timeout: 5000,
      
      // Health monitoring
      health_check_http: {
        url: 'http://localhost:3001/health',
        interval: 30000,
        timeout: 5000,
        max_fails: 3
      }
    },
    {
      // Load balancer mode (multiple instances without clustering)
      name: 'realtime-chat-load-balanced',
      script: 'src/server.js',
      instances: 4,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        REDIS_URL: 'redis://localhost:6379' // Required for load balancing
      },
      increment_var: 'PORT',
      watch: false,
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true,
      max_memory_restart: '512M'
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/realtime-chat-backend.git',
      path: '/var/www/realtime-chat',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};