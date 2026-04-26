import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './tender-awards.controller';

const router = Router({ mergeParams: true });

router.get('/', requireAdminAccess, resolveCompany, validateUUID('tenderId'), controller.getAwardItems);
router.get('/recommendations', requireAdminAccess, resolveCompany, validateUUID('tenderId'), controller.getRecommendations);
router.put('/', requireAdminAccess, resolveCompany, validateUUID('tenderId'), controller.bulkUpsertItems);
router.post('/finalize', requireAdminAccess, resolveCompany, validateUUID('tenderId'), controller.finalizeTender);

export default router;
