import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './price-list.controller';

const router = Router();

router.use(resolveCompany);
router.use(requireAdminAccess);

router.get('/projects/:projectId/price-list', validateUUID('projectId'), controller.getPriceList);
router.get('/projects/:projectId/price-list/export', validateUUID('projectId'), controller.exportPriceList);

export default router;
