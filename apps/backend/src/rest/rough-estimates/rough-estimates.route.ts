import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './rough-estimates.controller';

const router = Router();

router.use(resolveCompany);
router.use(requireAdminAccess);

router.get('/projects/:projectId/rough-estimates', validateUUID('projectId'), controller.list);
router.post('/projects/:projectId/rough-estimates', validateUUID('projectId'), controller.create);
router.get('/rough-estimates/:id', validateUUID(), controller.getById);
router.put('/rough-estimates/:id', validateUUID(), controller.update);
router.delete('/rough-estimates/:id', validateUUID(), controller.remove);
router.get('/rough-estimates/:id/units', validateUUID(), controller.getUnits);
router.post('/rough-estimates/:id/units', validateUUID(), controller.upsertUnits);
router.post('/rough-estimates/:id/export-pdf', validateUUID(), controller.exportPdf);
router.post('/rough-estimates/:id/export-excel', validateUUID(), controller.exportExcel);

export default router;
