import { Router } from 'express';
import * as authController from '../controllers/authController';
import { loginRateLimiter } from '../middleware/rateLimiter';

export const authRoutes = Router();

authRoutes.get('/csrf-token', authController.csrfToken);
authRoutes.post('/login', loginRateLimiter, authController.login);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', authController.me);
