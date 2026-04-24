import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import * as usersController from './users.controller';

const router = Router();

router.get('/', requireAdminAccess, usersController.getAll);
router.get('/:id', requireAdminAccess, validateUUID(), usersController.getById);
router.post('/', requireAdminAccess, usersController.create);
router.put('/:id', requireAdminAccess, validateUUID(), usersController.update);
router.delete('/:id', requireAdminAccess, validateUUID(), usersController.deleteById);

export default router;
