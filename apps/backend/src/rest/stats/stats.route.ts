import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { apiLimiter } from '../../middleware/rateLimiter';
import * as statsController from './stats.controller';

const router = Router();

router.get('/', requireAdminAccess, apiLimiter, statsController.getStats);

export default router;
