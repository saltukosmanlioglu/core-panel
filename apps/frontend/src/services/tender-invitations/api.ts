import { apiClient } from '../api-client';
import type { TenderInvitationResponse } from '@core-panel/shared';

export async function getTenderInvitations(tenderId: string): Promise<TenderInvitationResponse> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/invitations`);
  return res.data as TenderInvitationResponse;
}

export async function updateTenderInvitations(tenderId: string, tenantIds: string[]): Promise<TenderInvitationResponse> {
  const res = await apiClient.put(`/api/tenders/${tenderId}/invitations`, { tenantIds });
  return res.data as TenderInvitationResponse;
}
