const cluster = require('cluster');
const os = require('os');
const { logger } = require('./config/database');

if (cluster.isMaster) {
  const numWorkers = process.env.CLUSTER_WORKERS || os.cpus().length;
  
  logger.info(`Master ${process.pid} is running`);
  logger.info(`Starting ${numWorkers} workers...`);

  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  // Worker event handlers
  cluster.on('online', (worker) => {
    logger.info(`Worker ${worker.process.pid} is online`);
  });

  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    logger.info('Starting a new worker...');
    cluster.fork();
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('Master received SIGTERM, shutting down gracefully');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });

  process.on('SIGINT', () => {
    logger.info('Master received SIGINT, shutting down gracefully');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });

} else {
  // Worker process
  const { startServer } = require('./server');
  startServer();

  logger.info(`Worker ${process.pid} started`);
}
