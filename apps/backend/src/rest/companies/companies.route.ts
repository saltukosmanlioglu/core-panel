import { Router } from 'express';
import { requireSuperAdmin } from '../../middleware/requireSuperAdmin';
import { requireTenantAdminAccess } from '../../middleware/requireTenantAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import * as companiesController from './companies.controller';

const router = Router();

// TENANT_ADMIN can read (scoped to their company); only SUPER_ADMIN can mutate
router.get('/', requireTenantAdminAccess, companiesController.getAll);
router.get('/:id', requireTenantAdminAccess, validateUUID(), companiesController.getById);
router.post('/', requireSuperAdmin, companiesController.create);
router.put('/:id', requireSuperAdmin, validateUUID(), companiesController.update);
router.delete('/:id', requireSuperAdmin, validateUUID(), companiesController.deleteById);
router.post('/:id/reprovision', requireSuperAdmin, validateUUID(), companiesController.reprovision);

export default router;
