import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './tender-invitations.controller';

const router = Router({ mergeParams: true });

router.use(resolveCompany);
router.use(requireAdminAccess);

router.get('/', validateUUID('tenderId'), controller.getByTenderId);
router.put('/', validateUUID('tenderId'), controller.replaceAll);

export default router;
