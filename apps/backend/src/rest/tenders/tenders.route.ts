import { Router } from 'express';
import { validateUUID } from '../../middleware/validateUUID';
import * as tendersController from './tenders.controller';

const router = Router();

router.get('/', tendersController.getAll);
router.get('/:id', validateUUID(), tendersController.getById);
router.post('/', tendersController.create);
router.put('/:id', validateUUID(), tendersController.update);
router.delete('/:id', validateUUID(), tendersController.deleteById);

export default router;
