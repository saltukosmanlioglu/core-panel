import { Router } from 'express';
import { validateUUID } from '../../middleware/validateUUID';
import { resolveCompany } from '../../middleware/resolveCompany';
import * as projectsController from './projects.controller';

const router = Router();

router.use(resolveCompany);

router.get('/', projectsController.getAll);
router.get('/:id', validateUUID(), projectsController.getById);
router.post('/', projectsController.create);
router.put('/:id', validateUUID(), projectsController.update);
router.delete('/:id', validateUUID(), projectsController.deleteById);

export default router;
