import { Router } from 'express';
import { validateUUID } from '../../middleware/validateUUID';
import { resolveCompany } from '../../middleware/resolveCompany';
import * as controller from './tender-items.controller';

const router = Router({ mergeParams: true });

router.use(resolveCompany);

router.get('/', controller.getAll);
router.post('/reorder', controller.reorder);
router.get('/:id', validateUUID(), controller.getById);
router.post('/', controller.create);
router.put('/:id', validateUUID(), controller.update);
router.delete('/:id', validateUUID(), controller.remove);

export default router;
