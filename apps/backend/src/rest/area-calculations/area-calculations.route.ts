import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './area-calculations.controller';

const router = Router();

router.use(resolveCompany);
router.use(requireAdminAccess);

router.post(
  '/projects/:projectId/area-calculations/analyze',
  validateUUID('projectId'),
  controller.upload.fields([
    { name: 'rolovesi', maxCount: 1 },
    { name: 'eimar', maxCount: 1 },
    { name: 'plan_notes', maxCount: 1 },
    { name: 'other_files', maxCount: 5 },
  ]),
  controller.analyze,
);
router.get('/projects/:projectId/area-calculations/latest', validateUUID('projectId'), controller.getLatest);
router.get('/projects/:projectId/area-calculations', validateUUID('projectId'), controller.list);
router.get('/area-calculations/:id', validateUUID(), controller.getById);
router.delete('/area-calculations/:id', validateUUID(), controller.remove);

export default router;
