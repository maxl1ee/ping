import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import logger from './lib/logger';
import { runMigrations } from './db/migrate';
import { generalLimiter, authLimiter, chatLimiter } from './middleware/rateLimit';

// Routes
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import nexusRoutes from './routes/nexus';
import profileRoutes from './routes/profile';

const app = express();
const PORT = parseInt(process.env.PORT || '3002');

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(generalLimiter);

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ping-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/nexus', nexusRoutes);
app.use('/api/profile', profileRoutes);

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Start Server ────────────────────────────────────────────────────────────

async function start() {
  try {
    await runMigrations();
    logger.info('Database ready');

    app.listen(PORT, () => {
      logger.info({ port: PORT }, '🏓 Ping API is running');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
