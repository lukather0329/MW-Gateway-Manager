import { Router } from 'express';
import * as userController from '../controllers/userController';

export const userRoutes = Router();

userRoutes.get('/', userController.list);
userRoutes.post('/', userController.create);
userRoutes.delete('/:id', userController.remove);
