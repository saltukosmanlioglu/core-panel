import { Router } from 'express';
import { validateUUID } from '../../middleware/validateUUID';
import { resolveCompany } from '../../middleware/resolveCompany';
import * as controller from './tender-offers.controller';

// Mounted at /tenders/:tenderId/offers — mergeParams: true
export const tenderOffersRouter = Router({ mergeParams: true });
tenderOffersRouter.use(resolveCompany);
tenderOffersRouter.get('/', controller.getAll);
tenderOffersRouter.get('/my', controller.getMy);
tenderOffersRouter.get('/comparison', controller.getComparison);
tenderOffersRouter.post('/', controller.upsert);

// Mounted at /offers — standalone
export const offerActionsRouter = Router();
offerActionsRouter.use(resolveCompany);
offerActionsRouter.get('/:offerId/items', validateUUID('offerId'), controller.getOfferItems);
offerActionsRouter.put('/:offerId/items', validateUUID('offerId'), controller.bulkUpdateItems);
offerActionsRouter.post('/:offerId/submit', validateUUID('offerId'), controller.submit);
offerActionsRouter.post('/:offerId/approve', validateUUID('offerId'), controller.approve);
offerActionsRouter.post('/:offerId/reject', validateUUID('offerId'), controller.reject);
