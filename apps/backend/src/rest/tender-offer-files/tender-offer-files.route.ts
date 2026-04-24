import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './tender-offer-files.controller';

const router = Router({ mergeParams: true });

router.use(resolveCompany);
router.use(requireAdminAccess);

router.get('/', validateUUID('tenderId'), controller.getAll);
router.post('/', validateUUID('tenderId'), controller.offerFileUpload.single('file'), controller.upload);
router.delete('/:tenantId', validateUUID('tenderId'), validateUUID('tenantId'), controller.remove);

export default router;
