import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './metraj.controller';

const router = Router();

router.use(resolveCompany, requireAdminAccess);

router.get('/projects/:projectId/metraj', validateUUID('projectId'), controller.get);
router.post('/projects/:projectId/metraj', validateUUID('projectId'), controller.upsert);
router.delete('/metraj/:id', validateUUID(), controller.remove);

export default router;
