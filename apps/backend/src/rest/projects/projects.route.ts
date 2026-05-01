import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { validateUUID } from '../../middleware/validateUUID';
import { resolveCompany } from '../../middleware/resolveCompany';
import * as floorplannerController from '../floorplanner/floorplanner.controller';
import * as projectsController from './projects.controller';

const router = Router();

router.use(resolveCompany);

router.get('/', requireAdminAccess, projectsController.getAll);
router.get('/:id', requireAdminAccess, validateUUID(), projectsController.getById);
router.post('/', requireAdminAccess, projectsController.create);
router.post('/:id/floorplanner/provision', requireAdminAccess, validateUUID(), floorplannerController.provisionProject);
router.post('/:id/floorplanner/generate-drawing', requireAdminAccess, validateUUID(), floorplannerController.generateDrawing);
router.post('/:id/floorplanner/export', requireAdminAccess, validateUUID(), floorplannerController.startExport);
router.get('/:id/floorplanner/export/:exportId', requireAdminAccess, validateUUID(), floorplannerController.getExport);
router.put('/:id', requireAdminAccess, validateUUID(), projectsController.update);
router.delete('/:id', requireAdminAccess, validateUUID(), projectsController.deleteById);

export default router;
