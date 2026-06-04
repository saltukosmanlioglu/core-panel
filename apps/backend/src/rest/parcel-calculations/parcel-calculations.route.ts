import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './parcel-calculations.controller';

const router = Router();

router.get('/tkgm/provinces', controller.getTkgmProvinces);
router.get('/tkgm/districts/:provinceId', controller.getTkgmDistricts);
router.get('/tkgm/neighborhoods/:districtId', controller.getTkgmNeighborhoods);

router.use(resolveCompany);

router.post(
  '/projects/:projectId/parcel-calculations/fetch-from-tkgm',
  validateUUID('projectId'),
  controller.fetchFromTkgm,
);

router.use(requireAdminAccess);

router.post('/projects/:projectId/parcel-calculations', validateUUID('projectId'), controller.create);
router.get('/projects/:projectId/parcel-calculations', validateUUID('projectId'), controller.list);
router.post(
  '/projects/:projectId/parcel-calculations/extract-setbacks',
  validateUUID('projectId'),
  controller.upload.fields([
    { name: 'planNotes', maxCount: 1 },
    { name: 'zoningDocument', maxCount: 1 },
    { name: 'document', maxCount: 1 },
  ]),
  controller.extractSetbacks,
);
router.post(
  '/projects/:projectId/parcel-calculations/extract-zoning',
  validateUUID('projectId'),
  controller.upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'imarDurumu', maxCount: 1 },
    { name: 'planNotes', maxCount: 1 },
    { name: 'zoningDocument', maxCount: 1 },
    { name: 'document', maxCount: 1 },
  ]),
  controller.extractZoning,
);
router.get('/parcel-calculations/:id', validateUUID(), controller.getById);
router.put('/parcel-calculations/:id', validateUUID(), controller.update);
router.delete('/parcel-calculations/:id', validateUUID(), controller.remove);

export default router;
