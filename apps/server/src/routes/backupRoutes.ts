import { Router } from 'express';
import * as backupController from '../controllers/backupController';

export const backupRoutes = Router();

backupRoutes.get('/', backupController.list);
backupRoutes.post('/', backupController.createManualBackup);
backupRoutes.post('/:id/restore', backupController.restore);
