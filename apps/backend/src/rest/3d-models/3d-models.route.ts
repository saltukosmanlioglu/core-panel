import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './3d-models.controller';

const router = Router();

router.use(resolveCompany);

router.post(
  '/projects/:projectId/3d-models/generate-image',
  requireAdminAccess,
  validateUUID('projectId'),
  controller.generateImage,
);
router.post(
  '/projects/:projectId/3d-models/from-floor-plan',
  requireAdminAccess,
  validateUUID('projectId'),
  controller.createFromFloorPlanImage,
);
router.get(
  '/projects/:projectId/3d-models',
  requireAdminAccess,
  validateUUID('projectId'),
  controller.list,
);
router.post('/3d-models/:id/generate-3d', requireAdminAccess, validateUUID(), controller.generate3d);
router.get('/3d-models/:id/status', requireAdminAccess, validateUUID(), controller.status);
router.put('/3d-models/:id/status', requireAdminAccess, validateUUID(), controller.updateStatus);
router.delete('/3d-models/:id', requireAdminAccess, validateUUID(), controller.remove);

export default router;
