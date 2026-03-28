import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { requireTenantAdminAccess } from '../../middleware/requireTenantAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import * as tenantsController from './tenants.controller';

const router = Router();

// TENANT_ADMIN can read (scoped to their tenant); only COMPANY_ADMIN+ can mutate
router.get('/', requireTenantAdminAccess, tenantsController.getAll);
router.get('/:id', requireTenantAdminAccess, validateUUID(), tenantsController.getById);
router.post('/', requireAdminAccess, tenantsController.create);
router.put('/:id', requireAdminAccess, validateUUID(), tenantsController.update);
router.delete('/:id', requireAdminAccess, validateUUID(), tenantsController.deleteById);

export default router;
