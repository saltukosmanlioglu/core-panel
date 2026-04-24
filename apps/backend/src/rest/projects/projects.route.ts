import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import { resolveCompany } from '../../middleware/resolveCompany';
import * as projectsController from './projects.controller';

const router = Router();

router.use(resolveCompany);

router.get('/', requireAdminAccess, projectsController.getAll);
router.get('/:id', requireAdminAccess, validateUUID(), projectsController.getById);
router.post('/', requireAdminAccess, projectsController.create);
router.put('/:id', requireAdminAccess, validateUUID(), projectsController.update);
router.delete('/:id', requireAdminAccess, validateUUID(), projectsController.deleteById);

export default router;
