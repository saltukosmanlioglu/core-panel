import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import { resolveCompany } from '../../middleware/resolveCompany';
import * as tendersController from './tenders.controller';

const router = Router();

router.use(resolveCompany);

router.get('/', requireAdminAccess, tendersController.getAll);
router.get('/:id', requireAdminAccess, validateUUID(), tendersController.getById);
router.post('/', requireAdminAccess, tendersController.create);
router.put('/:id', requireAdminAccess, validateUUID(), tendersController.update);
router.delete('/:id', requireAdminAccess, validateUUID(), tendersController.deleteById);

export default router;
