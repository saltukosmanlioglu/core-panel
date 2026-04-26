import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './tender-item-notes.controller';

const router = Router({ mergeParams: true });

router.get('/', requireAdminAccess, resolveCompany, validateUUID('tenderId'), controller.getAll);
router.put('/:siraNo', requireAdminAccess, resolveCompany, validateUUID('tenderId'), controller.upsert);
router.delete('/:siraNo', requireAdminAccess, resolveCompany, validateUUID('tenderId'), controller.remove);

export default router;
