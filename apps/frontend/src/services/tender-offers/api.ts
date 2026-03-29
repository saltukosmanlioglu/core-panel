import type { TenderOffer, TenderOfferItem, OfferComparison } from '@core-panel/shared';
import { apiClient } from '../api-client';

export async function getMyOfferApi(tenderId: string): Promise<TenderOffer | null> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/offers/my`);
  return (res.data as { offer: TenderOffer | null }).offer;
}

export async function getAllOffersApi(tenderId: string): Promise<TenderOffer[]> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/offers`);
  return (res.data as { offers: TenderOffer[] }).offers;
}

export async function getOfferComparisonApi(tenderId: string): Promise<OfferComparison> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/offers/comparison`);
  return res.data as OfferComparison;
}

export async function upsertOfferApi(tenderId: string): Promise<TenderOffer> {
  const res = await apiClient.post(`/api/tenders/${tenderId}/offers`);
  return (res.data as { offer: TenderOffer }).offer;
}

export async function getOfferItemsApi(offerId: string): Promise<TenderOfferItem[]> {
  const res = await apiClient.get(`/api/offers/${offerId}/items`);
  return (res.data as { items: TenderOfferItem[] }).items;
}

export async function bulkUpdateOfferItemsApi(offerId: string, items: { itemId: string; materialUnitPrice: number; laborUnitPrice: number }[]): Promise<void> {
  await apiClient.put(`/api/offers/${offerId}/items`, { items });
}

export async function submitOfferApi(offerId: string): Promise<TenderOffer> {
  const res = await apiClient.post(`/api/offers/${offerId}/submit`);
  return (res.data as { offer: TenderOffer }).offer;
}

export async function approveOfferApi(offerId: string, notes?: string): Promise<TenderOffer> {
  const res = await apiClient.post(`/api/offers/${offerId}/approve`, { notes });
  return (res.data as { offer: TenderOffer }).offer;
}

export async function rejectOfferApi(offerId: string, notes?: string): Promise<TenderOffer> {
  const res = await apiClient.post(`/api/offers/${offerId}/reject`, { notes });
  return (res.data as { offer: TenderOffer }).offer;
}
