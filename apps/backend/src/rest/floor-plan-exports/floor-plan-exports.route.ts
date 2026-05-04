import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './floor-plan-exports.controller';

const router = Router();

router.use(resolveCompany);
router.use(requireAdminAccess);

router.get('/projects/:projectId/floor-plan-exports', validateUUID('projectId'), controller.list);
router.get('/floor-plan-exports/:id', validateUUID(), controller.getById);
router.delete('/floor-plan-exports/:id', validateUUID(), controller.remove);

export default router;
