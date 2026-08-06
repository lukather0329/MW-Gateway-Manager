import { Router } from 'express';
import * as programController from '../controllers/programController';

export const programRoutes = Router();

programRoutes.get('/', programController.list);
programRoutes.post('/', programController.create);
programRoutes.get('/:id', programController.getById);
programRoutes.put('/:id', programController.update);
programRoutes.delete('/:id', programController.remove);
programRoutes.post('/:id/test', programController.testConnection);
programRoutes.post('/:id/preview', programController.preview);
programRoutes.post('/:id/apply', programController.apply);
programRoutes.post('/:id/enable', programController.setEnabled(true));
programRoutes.post('/:id/disable', programController.setEnabled(false));
