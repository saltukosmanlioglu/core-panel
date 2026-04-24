import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import * as tenantsController from './tenants.controller';

const router = Router();

router.get('/', requireAdminAccess, tenantsController.getAll);
router.get('/:id', requireAdminAccess, validateUUID(), tenantsController.getById);
router.post('/', requireAdminAccess, tenantsController.create);
router.put('/:id', requireAdminAccess, validateUUID(), tenantsController.update);
router.delete('/:id', requireAdminAccess, validateUUID(), tenantsController.deleteById);

export default router;
