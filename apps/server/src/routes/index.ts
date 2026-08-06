import { Router } from 'express';
import { authRoutes } from './authRoutes';
import { programRoutes } from './programRoutes';
import { apacheRoutes } from './apacheRoutes';
import { backupRoutes } from './backupRoutes';
import { auditLogRoutes } from './auditLogRoutes';
import { settingsRoutes } from './settingsRoutes';
import { deviceRoutes } from './deviceRoutes';
import { dashboardRoutes } from './dashboardRoutes';
import { userRoutes } from './userRoutes';
import { requireAuth } from '../middleware/requireAuth';
import { verifyCsrfToken } from '../middleware/csrf';

export const apiRouter = Router();

// /api/auth is reachable while unauthenticated (login itself, and the
// csrf-token bootstrap endpoint the login form needs before a session
// exists).
apiRouter.use('/auth', authRoutes);

// Everything else requires an active admin session, plus a matching CSRF
// token on every mutating request.
apiRouter.use(requireAuth);
apiRouter.use(verifyCsrfToken);

apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/programs', programRoutes);
apiRouter.use('/apache', apacheRoutes);
apiRouter.use('/backups', backupRoutes);
apiRouter.use('/audit-logs', auditLogRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/devices', deviceRoutes);
apiRouter.use('/users', userRoutes);
