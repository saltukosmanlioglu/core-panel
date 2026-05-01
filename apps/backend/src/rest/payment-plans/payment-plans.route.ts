import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './payment-plans.controller';

const router = Router();

router.use(resolveCompany);
router.use(requireAdminAccess);

router.get('/property-owners/:ownerId/payment-plans', validateUUID('ownerId'), controller.list);
router.post('/property-owners/:ownerId/payment-plans', validateUUID('ownerId'), controller.create);
router.put('/payment-plans/:id', validateUUID(), controller.update);
router.delete('/payment-plans/:id', validateUUID(), controller.remove);
router.post(
  '/payment-plans/:id/installments/:installmentId/pay',
  validateUUID(),
  validateUUID('installmentId'),
  controller.upload.single('receipt'),
  controller.payInstallment,
);

export default router;
