import { Router } from 'express';
import * as apacheController from '../controllers/apacheController';

export const apacheRoutes = Router();

apacheRoutes.get('/status', apacheController.status);
apacheRoutes.post('/test-config', apacheController.testConfig);
apacheRoutes.post('/graceful', apacheController.graceful);
apacheRoutes.get('/modules', apacheController.modules);
apacheRoutes.get('/setup-check', apacheController.setupCheck);
apacheRoutes.post('/setup-apply-include-optional', apacheController.setupApplyIncludeOptional);
