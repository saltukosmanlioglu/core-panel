import { apiClient } from '../api-client';

export interface TenderItemNoteDto {
  siraNo: number;
  note: string;
}

export async function getTenderItemNotes(tenderId: string): Promise<TenderItemNoteDto[]> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/item-notes`);
  return res.data as TenderItemNoteDto[];
}

export async function upsertTenderItemNote(tenderId: string, siraNo: number, note: string): Promise<void> {
  await apiClient.put(`/api/tenders/${tenderId}/item-notes/${siraNo}`, { note });
}

export async function deleteTenderItemNote(tenderId: string, siraNo: number): Promise<void> {
  await apiClient.delete(`/api/tenders/${tenderId}/item-notes/${siraNo}`);
}
