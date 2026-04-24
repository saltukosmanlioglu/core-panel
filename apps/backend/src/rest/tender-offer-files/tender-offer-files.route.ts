import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './tender-offer-files.controller';

const router = Router({ mergeParams: true });

router.get('/', requireAdminAccess, resolveCompany, validateUUID('tenderId'), controller.getAll);
router.post('/', requireAdminAccess, resolveCompany, validateUUID('tenderId'), controller.upload.single('file'), controller.uploadFile);
router.delete('/:tenantId', requireAdminAccess, resolveCompany, validateUUID('tenderId'), validateUUID('tenantId'), controller.removeFile);

export default router;
