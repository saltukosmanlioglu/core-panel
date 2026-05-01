import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './property-owners.controller';

const router = Router();

router.use(resolveCompany);
router.use(requireAdminAccess);

router.get('/projects/:projectId/property-owners', validateUUID('projectId'), controller.list);
router.post('/projects/:projectId/property-owners', validateUUID('projectId'), controller.create);
router.put('/property-owners/:id', validateUUID(), controller.update);
router.delete('/property-owners/:id', validateUUID(), controller.remove);

export default router;
