import { Router } from 'express';
import * as auditLogController from '../controllers/auditLogController';

export const auditLogRoutes = Router();

auditLogRoutes.get('/', auditLogController.list);
