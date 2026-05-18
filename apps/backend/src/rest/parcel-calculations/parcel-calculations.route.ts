import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './parcel-calculations.controller';

const router = Router();

router.use(resolveCompany);
router.use(requireAdminAccess);

router.post('/projects/:projectId/parcel-calculations', validateUUID('projectId'), controller.create);
router.get('/projects/:projectId/parcel-calculations', validateUUID('projectId'), controller.list);
router.post(
  '/projects/:projectId/parcel-calculations/extract-setbacks',
  validateUUID('projectId'),
  controller.upload.single('document'),
  controller.extractSetbacks,
);
router.get('/parcel-calculations/:id', validateUUID(), controller.getById);
router.put('/parcel-calculations/:id', validateUUID(), controller.update);
router.delete('/parcel-calculations/:id', validateUUID(), controller.remove);

export default router;
