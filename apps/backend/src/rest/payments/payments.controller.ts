import fs from 'fs';
import path from 'path';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { TenantDb } from '../../lib/tenantDb';
import { UPLOADS_DIR } from '../../config/paths';
import { AppError } from '../../lib/AppError';
import {
  createGeneralExpenseSchema,
  createPaymentTransactionSchema,
  createProgressPaymentSchema,
  PAYMENT_FILE_MIME_TYPES,
  updateGeneralExpenseSchema,
  updateProgressPaymentSchema,
} from '../../models/payment.model';
import * as projectsRepo from '../projects/projects.repo';
import * as tendersRepo from '../tenders/tenders.repo';
import * as tenantsRepo from '../tenants/tenants.repo';
import * as auditRepo from '../tender-audit-logs/tender-audit-logs.repo';
import * as repo from './payments.repo';

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (!PAYMENT_FILE_MIME_TYPES.includes(file.mimetype as (typeof PAYMENT_FILE_MIME_TYPES)[number])) {
      cb(new AppError('Invalid file type. Allowed: PDF or image', 400, 'INVALID_FILE_TYPE'));
      return;
    }

    cb(null, true);
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

function safeUnlink(filePath?: string | null): void {
  if (!filePath) return;
  const absolute = filePath.startsWith('/uploads/')
    ? path.join(UPLOADS_DIR, path.basename(filePath))
    : filePath;

  try {
    fs.unlinkSync(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function publicUploadPath(file?: Express.Multer.File): string | null {
  return file ? `/uploads/${file.filename}` : null;
}

async function ensureProject(companyId: string, projectId: string, res: Response): Promise<boolean> {
  const project = await projectsRepo.findById(companyId, projectId);
  if (!project) {
    res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
    return false;
  }
  return true;
}

async function ensurePayment(tdb: TenantDb, id: string, res: Response): Promise<repo.ProgressPaymentRecord | null> {
  const payment = await repo.findPaymentById(tdb, id);
  if (!payment) {
    res.status(404).json({ error: 'Hakediş bulunamadı', code: 'NOT_FOUND' });
    return null;
  }
  return payment;
}

export const getTenantSummaries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;
    const tdb = new TenantDb(companyId);
    await repo.ensureDueNotifications(tdb, companyId, projectId, req.userId!);
    const tenants = await repo.findTenantSummaries(tdb, projectId);
    res.json({ tenants });
  } catch (error) {
    next(error);
  }
};

export const listPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;
    const tdb = new TenantDb(companyId);
    await repo.ensureDueNotifications(tdb, companyId, projectId, req.userId!);
    const payments = await repo.findPayments(tdb, projectId, {
      tenantId: typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined,
    });
    res.json({ payments });
  } catch (error) {
    next(error);
  }
};

export const createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createProgressPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }

    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;

    const tenant = await tenantsRepo.findById(parsed.data.tenantId);
    if (!tenant || tenant.companyId !== companyId) {
      res.status(400).json({ error: 'Tenant not found for this company', code: 'INVALID_TENANT' });
      return;
    }

    if (parsed.data.tenderId) {
      const tender = await tendersRepo.findById(companyId, parsed.data.tenderId);
      if (!tender || tender.projectId !== projectId) {
        res.status(400).json({ error: 'İhale bu inşaata ait değil', code: 'INVALID_TENDER' });
        return;
      }
    }

    const tdb = new TenantDb(companyId);
    const payment = await repo.createPayment(tdb, projectId, parsed.data, req.userId!);

    if (parsed.data.tenderId) {
      await auditRepo.create(tdb, parsed.data.tenderId, 'progress_payment_created', {
        paymentId: payment.id,
        tenantId: parsed.data.tenantId,
        totalAmount: parsed.data.totalAmount,
      }, req.userId!);
    }

    res.status(201).json({ payment });
  } catch (error) {
    next(error);
  }
};

export const getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payment = await ensurePayment(new TenantDb(req.resolvedCompanyId!), String(req.params.id), res);
    if (!payment) return;
    res.json({ payment });
  } catch (error) {
    next(error);
  }
};

export const updatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateProgressPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const payment = await repo.updatePayment(new TenantDb(req.resolvedCompanyId!), String(req.params.id), parsed.data);
    if (!payment) {
      res.status(404).json({ error: 'Hakediş bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ payment });
  } catch (error) {
    next(error);
  }
};

export const deletePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await repo.removePayment(new TenantDb(req.resolvedCompanyId!), String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Hakediş bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    deleted.transactions.forEach((tx) => safeUnlink(tx.receiptPath));
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};

export const approvePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payment = await repo.approvePayment(new TenantDb(req.resolvedCompanyId!), String(req.params.id));
    if (!payment) {
      res.status(404).json({ error: 'Hakediş bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ payment });
  } catch (error) {
    next(error);
  }
};

export const createTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const uploaded = req.file?.path;
  try {
    const parsed = createPaymentTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      safeUnlink(uploaded);
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }

    const companyId = req.resolvedCompanyId!;
    const tdb = new TenantDb(companyId);
    const payment = await ensurePayment(tdb, String(req.params.id), res);
    if (!payment) {
      safeUnlink(uploaded);
      return;
    }
    const transaction = await repo.createTransaction(tdb, payment.id, parsed.data, req.userId!, publicUploadPath(req.file));
    await repo.ensureDueNotifications(tdb, companyId, payment.projectId, req.userId!);
    res.status(201).json({ transaction, payment: await repo.findPaymentById(tdb, payment.id) });
  } catch (error) {
    safeUnlink(uploaded);
    next(error);
  }
};

export const listTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = new TenantDb(req.resolvedCompanyId!);
    const payment = await ensurePayment(tdb, String(req.params.id), res);
    if (!payment) return;
    const transactions = await repo.findTransactions(tdb, payment.id);
    res.json({ transactions });
  } catch (error) {
    next(error);
  }
};

export const deleteTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = new TenantDb(req.resolvedCompanyId!);
    const payment = await ensurePayment(tdb, String(req.params.id), res);
    if (!payment) return;
    const deleted = await repo.removeTransaction(tdb, payment.id, String(req.params.txId));
    if (!deleted) {
      res.status(404).json({ error: 'İşlem bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    safeUnlink(deleted.receiptPath);
    res.json({ status: 'ok', payment: await repo.findPaymentById(tdb, payment.id) });
  } catch (error) {
    next(error);
  }
};

export const listExpenses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;
    const expenses = await repo.findExpenses(new TenantDb(companyId), projectId, {
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    res.json({ expenses });
  } catch (error) {
    next(error);
  }
};

export const createExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const uploaded = req.file?.path;
  try {
    const parsed = createGeneralExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      safeUnlink(uploaded);
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) {
      safeUnlink(uploaded);
      return;
    }
    const expense = await repo.createExpense(new TenantDb(companyId), projectId, parsed.data, req.userId!, publicUploadPath(req.file));
    res.status(201).json({ expense });
  } catch (error) {
    safeUnlink(uploaded);
    next(error);
  }
};

export const updateExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const uploaded = req.file?.path;
  try {
    const parsed = updateGeneralExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      safeUnlink(uploaded);
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const tdb = new TenantDb(req.resolvedCompanyId!);
    const existing = await repo.findExpenseById(tdb, String(req.params.expenseId));
    if (!existing) {
      safeUnlink(uploaded);
      res.status(404).json({ error: 'Gider bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    const expense = await repo.updateExpense(tdb, existing.id, parsed.data, req.file ? publicUploadPath(req.file) : undefined);
    if (req.file) safeUnlink(existing.invoicePath);
    res.json({ expense });
  } catch (error) {
    safeUnlink(uploaded);
    next(error);
  }
};

export const deleteExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await repo.removeExpense(new TenantDb(req.resolvedCompanyId!), String(req.params.expenseId));
    if (!deleted) {
      res.status(404).json({ error: 'Gider bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    safeUnlink(deleted.invoicePath);
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};

export const expenseSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;
    const summary = await repo.getExpenseSummary(new TenantDb(companyId), projectId);
    res.json({ summary });
  } catch (error) {
    next(error);
  }
};

function currencyStyle(cell: ExcelJS.Cell): void {
  cell.numFmt = '"₺"#,##0.00;[Red]-"₺"#,##0.00';
}

export const exportPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;
    const tdb = new TenantDb(companyId);
    const payments = await repo.findPayments(tdb, projectId);
    const expenses = await repo.findExpenses(tdb, projectId);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Core Panel';

    const summary = wb.addWorksheet('Progress Payments');
    summary.columns = [
      { header: 'Tenant', key: 'tenant', width: 28 },
      { header: 'Period', key: 'period', width: 18 },
      { header: 'Total', key: 'total', width: 16 },
      { header: 'Paid', key: 'paid', width: 16 },
      { header: 'Remaining', key: 'remaining', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Due Date', key: 'dueDate', width: 16 },
      { header: 'Last Payment', key: 'lastPayment', width: 16 },
    ];
    payments.forEach((payment) => {
      summary.addRow({
        tenant: payment.tenantName ?? payment.tenantId,
        period: payment.period ?? '',
        total: payment.totalAmount,
        paid: payment.paidAmount,
        remaining: payment.remainingAmount,
        status: payment.status,
        dueDate: payment.dueDate ?? '',
        lastPayment: payment.transactions[0]?.paymentDate ?? '',
      });
    });
    const summaryTotal = summary.addRow({
      tenant: 'TOTAL',
      total: payments.reduce((sum, payment) => sum + payment.totalAmount, 0),
      paid: payments.reduce((sum, payment) => sum + payment.paidAmount, 0),
      remaining: payments.reduce((sum, payment) => sum + payment.remainingAmount, 0),
    });
    summaryTotal.font = { bold: true };
    ['C', 'D', 'E'].forEach((col) => currencyStyle(summary.getCell(`${col}${summaryTotal.number}`)));

    const txSheet = wb.addWorksheet('All Transactions');
    txSheet.columns = [
      { header: 'Date', key: 'date', width: 16 },
      { header: 'Tenant', key: 'tenant', width: 28 },
      { header: 'Amount', key: 'amount', width: 16 },
      { header: 'Receipt', key: 'receipt', width: 32 },
      { header: 'Note', key: 'note', width: 36 },
    ];
    const transactions = payments.flatMap((payment) => payment.transactions.map((tx) => ({ payment, tx })));
    transactions.forEach(({ payment, tx }) => {
      txSheet.addRow({
        date: tx.paymentDate,
        tenant: payment.tenantName ?? payment.tenantId,
        amount: tx.amount,
        receipt: tx.receiptPath ?? '',
        note: tx.note ?? '',
      });
    });
    const txTotal = txSheet.addRow({ tenant: 'TOTAL', amount: transactions.reduce((sum, row) => sum + row.tx.amount, 0) });
    txTotal.font = { bold: true };
    currencyStyle(txSheet.getCell(`C${txTotal.number}`));

    const expenseSheet = wb.addWorksheet('General Expenses');
    expenseSheet.columns = [
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Amount', key: 'amount', width: 16 },
      { header: 'Invoice', key: 'invoice', width: 32 },
      { header: 'Payment Date', key: 'paymentDate', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
    ];
    expenses.forEach((expense) => {
      expenseSheet.addRow({
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        invoice: expense.invoicePath ?? '',
        paymentDate: expense.paymentDate ?? '',
        status: expense.status,
      });
    });
    const expenseTotal = expenseSheet.addRow({ description: 'TOTAL', amount: expenses.reduce((sum, expense) => sum + expense.amount, 0) });
    expenseTotal.font = { bold: true };
    currencyStyle(expenseSheet.getCell(`C${expenseTotal.number}`));

    [summary, txSheet, expenseSheet].forEach((sheet) => {
      sheet.getRow(1).font = { bold: true };
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          ['C', 'D', 'E'].forEach((col) => {
            const cell = sheet.getCell(`${col}${rowNumber}`);
            if (typeof cell.value === 'number') currencyStyle(cell);
          });
        }
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="payments-${projectId}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
};

export const unreadNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notifications = await repo.findUnreadNotifications(
      new TenantDb(req.resolvedCompanyId!),
      req.resolvedCompanyId!,
      req.userId!,
    );
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await repo.markAllNotificationsRead(
      new TenantDb(req.resolvedCompanyId!),
      req.resolvedCompanyId!,
      req.userId!,
    );
    res.json({ updated });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notification = await repo.markNotificationRead(
      new TenantDb(req.resolvedCompanyId!),
      req.resolvedCompanyId!,
      req.userId!,
      String(req.params.id),
    );
    if (!notification) {
      res.status(404).json({ error: 'Bildirim bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ notification });
  } catch (error) {
    next(error);
  }
};
