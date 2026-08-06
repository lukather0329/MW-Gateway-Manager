import { Router } from 'express';
import * as deviceController from '../controllers/deviceController';

export const deviceRoutes = Router();

deviceRoutes.get('/', deviceController.list);
deviceRoutes.post('/', deviceController.create);
deviceRoutes.get('/:id', deviceController.getById);
deviceRoutes.put('/:id', deviceController.update);
deviceRoutes.delete('/:id', deviceController.remove);
deviceRoutes.post('/:id/regenerate-token', deviceController.regenerateToken);
