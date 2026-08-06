import { Router } from 'express';
import * as settingsController from '../controllers/settingsController';

export const settingsRoutes = Router();

settingsRoutes.get('/', settingsController.get);
settingsRoutes.put('/', settingsController.update);
