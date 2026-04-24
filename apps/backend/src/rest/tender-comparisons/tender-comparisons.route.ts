import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './tender-comparisons.controller';

const router = Router({ mergeParams: true });

router.get('/', requireAdminAccess, resolveCompany, validateUUID('tenderId'), controller.getLatest);
router.post('/', requireAdminAccess, resolveCompany, validateUUID('tenderId'), controller.run);

export default router;
