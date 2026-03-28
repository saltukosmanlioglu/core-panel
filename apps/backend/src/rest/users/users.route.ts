import { Router } from 'express';
import { requireTenantAdminAccess } from '../../middleware/requireTenantAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import * as usersController from './users.controller';

const router = Router();

router.get('/', requireTenantAdminAccess, usersController.getAll);
router.get('/:id', requireTenantAdminAccess, validateUUID(), usersController.getById);
router.post('/', requireTenantAdminAccess, usersController.create);
router.put('/:id', requireTenantAdminAccess, validateUUID(), usersController.update);
router.delete('/:id', requireTenantAdminAccess, validateUUID(), usersController.deleteById);

export default router;
