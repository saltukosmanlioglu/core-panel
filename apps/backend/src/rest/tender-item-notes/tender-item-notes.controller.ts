import { NextFunction, Request, Response } from 'express';
import { getTdb } from '../../lib/tenantDb';
import { upsertTenderItemNoteSchema } from '../../models/tender-item-note.model';
import * as tendersRepo from '../tenders/tenders.repo';
import * as tenderItemNotesRepo from './tender-item-notes.repo';

function parseSiraNo(req: Request, res: Response): number | null {
  const siraNo = Number.parseInt(String(req.params.siraNo), 10);

  if (!Number.isInteger(siraNo) || siraNo <= 0) {
    res.status(400).json({ error: 'Geçersiz sıra numarası', code: 'VALIDATION_ERROR' });
    return null;
  }

  return siraNo;
}

async function ensureTenderExists(req: Request, res: Response): Promise<boolean> {
  const companyId = req.resolvedCompanyId!;
  const tenderId = String(req.params.tenderId);
  const tender = await tendersRepo.findById(companyId, tenderId);

  if (!tender) {
    res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
    return false;
  }

  return true;
}

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureTenderExists(req, res))) {
      return;
    }

    const notes = await tenderItemNotesRepo.findByTenderId(getTdb(req), String(req.params.tenderId));
    res.json(notes);
  } catch (error) {
    next(error);
  }
};

export const upsert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = upsertTenderItemNoteSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const siraNo = parseSiraNo(req, res);
    if (siraNo === null) {
      return;
    }

    if (!(await ensureTenderExists(req, res))) {
      return;
    }

    const note = await tenderItemNotesRepo.upsert(
      getTdb(req),
      String(req.params.tenderId),
      siraNo,
      parsed.data.note,
      req.userId!,
    );

    res.json({ siraNo: note.siraNo, note: note.note });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const siraNo = parseSiraNo(req, res);
    if (siraNo === null) {
      return;
    }

    if (!(await ensureTenderExists(req, res))) {
      return;
    }

    await tenderItemNotesRepo.remove(getTdb(req), String(req.params.tenderId), siraNo);
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};
