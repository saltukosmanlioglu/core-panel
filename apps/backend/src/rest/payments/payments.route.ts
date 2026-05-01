import { Router } from 'express';
import { requireAdminAccess } from '../../middleware/requireAdminAccess';
import { resolveCompany } from '../../middleware/resolveCompany';
import { validateUUID } from '../../middleware/validateUUID';
import * as controller from './payments.controller';

const router = Router();

router.use(resolveCompany);
router.use(requireAdminAccess);

router.get('/projects/:projectId/payments/tenants', validateUUID('projectId'), controller.getTenantSummaries);
router.get('/projects/:projectId/payments/export', validateUUID('projectId'), controller.exportPayments);
router.get('/projects/:projectId/payments', validateUUID('projectId'), controller.listPayments);
router.post('/projects/:projectId/payments', validateUUID('projectId'), controller.createPayment);

router.get('/payments/:id', validateUUID(), controller.getPayment);
router.put('/payments/:id', validateUUID(), controller.updatePayment);
router.delete('/payments/:id', validateUUID(), controller.deletePayment);
router.post('/payments/:id/approve', validateUUID(), controller.approvePayment);
router.get('/payments/:id/transactions', validateUUID(), controller.listTransactions);
router.post('/payments/:id/transactions', validateUUID(), controller.upload.single('receipt'), controller.createTransaction);
router.delete('/payments/:id/transactions/:txId', validateUUID(), validateUUID('txId'), controller.deleteTransaction);

router.get('/projects/:projectId/expenses/summary', validateUUID('projectId'), controller.expenseSummary);
router.get('/projects/:projectId/expenses', validateUUID('projectId'), controller.listExpenses);
router.post('/projects/:projectId/expenses', validateUUID('projectId'), controller.upload.single('invoice'), controller.createExpense);
router.put('/projects/:projectId/expenses/:expenseId', validateUUID('projectId'), validateUUID('expenseId'), controller.upload.single('invoice'), controller.updateExpense);
router.delete('/projects/:projectId/expenses/:expenseId', validateUUID('projectId'), validateUUID('expenseId'), controller.deleteExpense);

router.get('/notifications', controller.unreadNotifications);
router.put('/notifications/:id/read', validateUUID(), controller.markNotificationRead);

export default router;
