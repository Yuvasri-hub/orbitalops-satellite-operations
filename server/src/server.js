import http from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import { connectDB, disconnectDB, getConnectionState } from './config/db.js';
import { connectRedis, disconnectRedis, getRedisState } from './config/redis.js';
import { User } from './models/User.js';
import { seedDatabase } from './scripts/seed.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

let server;

async function startServer() {
  // Connect to PostgreSQL
  await connectDB(process.env.DATABASE_URL);

  // Connect to Redis Cache
  connectRedis();

  // If connected and empty (or missing demo users), auto-seed demo dataset
  const dbState = getConnectionState();
  if (dbState.ready) {
    try {
      const userCount = await User.countDocuments();
      const adminUser = await User.findOne({ email: 'admin@spaceops.local' });
      if (userCount === 0 || !adminUser) {
        console.log('[Server] Database missing demo accounts. Seeding initial flight demonstration data...');
        await seedDatabase();
      }
    } catch (err) {
      console.warn('[Server] Auto-seed check warning:', err.message);
    }
  }

  server = http.createServer(app);

  server.listen(PORT, () => {
    const redisState = getRedisState();
    console.log('====================================================');
    console.log(' SPACE MISSION OPERATIONS & SATELLITE MANAGEMENT');
    console.log(' Mission Control Server Initialized');
    console.log(` Port: ${PORT}`);
    console.log(` Health Check: http://localhost:${PORT}/api/health`);
    console.log(` Demo Accounts: http://localhost:${PORT}/api/auth/demo-accounts`);
    console.log(` Database: ${dbState.statusText}`);
    console.log(` Cache: ${redisState.statusText}`);
    console.log(' NOTE: All telemetry is strictly simulated demo data.');
    console.log('====================================================');
  });

  const handleShutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    if (server) {
      server.close(async () => {
        await disconnectRedis();
        await disconnectDB();
        console.log('[Server] Connections closed. Exiting process.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup failure:', err);
  process.exit(1);
});
