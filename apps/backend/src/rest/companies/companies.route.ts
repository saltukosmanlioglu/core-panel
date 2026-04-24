import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import * as companiesController from './companies.controller';

const router = Router();

router.get('/', requireAdminAccess, companiesController.getAll);
router.get('/:id', requireAdminAccess, validateUUID(), companiesController.getById);
router.post('/:id/reprovision', requireAdminAccess, validateUUID(), companiesController.reprovision);

export default router;
