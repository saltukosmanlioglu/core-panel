import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './material-suppliers.controller';

const router = Router();

router.get('/', requireAdminAccess, controller.getAll);
router.get('/:id', requireAdminAccess, validateUUID(), controller.getById);
router.post('/', requireAdminAccess, controller.create);
router.put('/:id', requireAdminAccess, validateUUID(), controller.update);
router.delete('/:id', requireAdminAccess, validateUUID(), controller.remove);

export default router;
