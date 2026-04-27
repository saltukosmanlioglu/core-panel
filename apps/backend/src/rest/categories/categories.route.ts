import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './categories.controller';

const router = Router();

router.get('/', requireAdminAccess, controller.getAll);
router.get('/tenants/:tenantId/categories', requireAdminAccess, validateUUID('tenantId'), controller.getTenantCategories);
router.put('/tenants/:tenantId/categories', requireAdminAccess, validateUUID('tenantId'), controller.updateTenantCategories);
router.get('/suppliers/:supplierId/categories', requireAdminAccess, validateUUID('supplierId'), controller.getSupplierCategories);
router.put('/suppliers/:supplierId/categories', requireAdminAccess, validateUUID('supplierId'), controller.updateSupplierCategories);
router.get('/:categoryId/tenants', requireAdminAccess, validateUUID('categoryId'), controller.getTenantsByCategory);
router.get('/:id', requireAdminAccess, validateUUID(), controller.getById);
router.post('/', requireAdminAccess, controller.create);
router.put('/:id', requireAdminAccess, validateUUID(), controller.update);
router.delete('/:id', requireAdminAccess, validateUUID(), controller.remove);

export default router;
