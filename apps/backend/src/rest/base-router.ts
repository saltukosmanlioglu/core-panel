import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken';
import { checkIsActive } from '../middleware/checkIsActive';
import authRouter from './auth/auth.route';
import companiesRouter from './companies/companies.route';
import tenantsRouter from './tenants/tenants.route';
import usersRouter from './users/users.route';
import statsRouter from './stats/stats.route';
import filesRouter from './files/files.route';
import projectsRouter from './projects/projects.route';
import tendersRouter from './tenders/tenders.route';

const baseRouter = Router();

baseRouter.use('/auth', authRouter);
baseRouter.use('/companies', verifyToken, checkIsActive, companiesRouter);
baseRouter.use('/companies/:companyId/files', verifyToken, checkIsActive, filesRouter);
baseRouter.use('/tenants', verifyToken, checkIsActive, tenantsRouter);
baseRouter.use('/admin/users', verifyToken, checkIsActive, usersRouter);
baseRouter.use('/admin/stats', verifyToken, checkIsActive, statsRouter);
baseRouter.use('/projects', verifyToken, checkIsActive, projectsRouter);
baseRouter.use('/tenders', verifyToken, checkIsActive, tendersRouter);

export default baseRouter;
