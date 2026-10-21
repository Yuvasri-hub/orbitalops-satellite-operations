import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getConnectionState } from './config/db.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import satelliteRoutes from './routes/satelliteRoutes.js';
import groundStationRoutes from './routes/groundStationRoutes.js';
import missionRoutes from './routes/missionRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import maintenanceRoutes from './routes/maintenanceRoutes.js';
import commLogRoutes from './routes/commLogRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import userRoutes from './routes/userRoutes.js';

import { notFound, errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();

const app = express();

// Middleware - Enhanced CORS supporting local Docker, local dev, and Render domains
const clientUrlEnv = process.env.CLIENT_URL;
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!clientUrlEnv || clientUrlEnv === '*') {
        return callback(null, true);
      }
      const allowedList = clientUrlEnv.split(',').map((u) => u.trim());
      if (
        allowedList.includes(origin) ||
        origin.endsWith('.onrender.com') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbState = getConnectionState();
  res.json({
    status: dbState.ready ? 'operational' : 'degraded',
    service: 'Space Mission Operations & Satellite Management System',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    telemetryMode: 'SIMULATED DEMO DATA ONLY',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/satellites', satelliteRoutes);
app.use('/api/stations', groundStationRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/comm-logs', commLogRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

export default app;
