import { Router } from 'express';
import multer from 'multer';
import { validateUUID } from '../../middleware/validateUUID';
import { resolveCompany } from '../../middleware/resolveCompany';
import * as controller from './offer-documents.controller';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

router.use(resolveCompany);
router.use(validateUUID('projectId'));

router.get('/parcel-area', controller.getParcelArea);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/generate-pdf', upload.single('floorPlanImage'), controller.generateCustomPdf);
router.get('/:id/generate-pdf', validateUUID(), controller.generatePdf);
router.get('/:id', validateUUID(), controller.getById);
router.put('/:id', validateUUID(), controller.update);
router.delete('/:id', validateUUID(), controller.deleteById);

export default router;
