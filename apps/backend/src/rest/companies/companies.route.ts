import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { requireTenantAdminAccess } from '../../middleware/requireTenantAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import * as companiesController from './companies.controller';

const router = Router();

// Read: TENANT_ADMIN+ (scoped to their company)
router.get('/', requireTenantAdminAccess, companiesController.getAll);
router.get('/:id', requireTenantAdminAccess, validateUUID(), companiesController.getById);
// Reprovision: COMPANY_ADMIN only (use seed scripts for create/update/delete)
router.post('/:id/reprovision', requireAdminAccess, validateUUID(), companiesController.reprovision);

export default router;
