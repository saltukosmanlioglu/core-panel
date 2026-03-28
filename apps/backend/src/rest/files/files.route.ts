import { Router } from 'express';
import { validateUUID } from '../../middleware/validateUUID';
import { requireCompanyAccess } from '../../middleware/requireCompanyAccess';
import * as filesController from './files.controller';

// Mounted at /api/companies/:companyId/files
// verifyToken + checkIsActive are applied at base-router level before this router.
const router = Router({ mergeParams: true });

router.use(validateUUID('companyId'), requireCompanyAccess);

router.get('/', filesController.listFiles);
router.post('/', filesController.createFile);
router.get('/:id', filesController.getFile);
router.patch('/:id', filesController.updateFile);
router.delete('/:id', filesController.deleteFile);
router.post('/:id/archive', filesController.archiveFile);

export default router;
