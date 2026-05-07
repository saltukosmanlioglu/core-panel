import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './floor-plans.controller';

const router = Router();

router.use(resolveCompany);
router.use(requireAdminAccess);

router.post('/projects/:projectId/floor-plans/generate', validateUUID('projectId'), controller.generate);
router.get('/projects/:projectId/floor-plans', validateUUID('projectId'), controller.list);
router.get('/floor-plans/:id', validateUUID(), controller.getById);
router.get('/floor-plans/:id/xml', validateUUID(), controller.downloadXml);
router.delete('/floor-plans/:id', validateUUID(), controller.remove);
router.post('/floor-plans/:id/regenerate', validateUUID(), controller.regenerate);

export default router;
