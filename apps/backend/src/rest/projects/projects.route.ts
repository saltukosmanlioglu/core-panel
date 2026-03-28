import { Router } from 'express';
import { validateUUID } from '../../middleware/validateUUID';
import * as projectsController from './projects.controller';

const router = Router();

router.get('/', projectsController.getAll);
router.get('/:id', validateUUID(), projectsController.getById);
router.post('/', projectsController.create);
router.put('/:id', validateUUID(), projectsController.update);
router.delete('/:id', validateUUID(), projectsController.deleteById);

export default router;
