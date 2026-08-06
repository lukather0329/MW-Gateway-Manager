import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { sessionMiddleware } from './middleware/session';
import { apiRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.webOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(sessionMiddleware);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api', apiRateLimiter);
  app.use('/api', apiRouter);

  app.use(errorHandler);

  return app;
}
