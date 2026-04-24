'use client';

import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let pendingRequests: Array<{ resolve: () => void; reject: (err: unknown) => void }> = [];

const drainQueue = (err: unknown) => {
  pendingRequests.forEach((p) => (err ? p.reject(err) : p.resolve()));
  pendingRequests = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || typeof window === 'undefined') {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const code = (error.response?.data as { code?: string } | undefined)?.code;
    const config = error.config as (typeof error.config & { _retry?: boolean }) | undefined;

    if (status === 403 && code === 'ACCOUNT_DEACTIVATED') {
      window.location.href = '/login?error=deactivated';
      return Promise.reject(error);
    }

    // Attempt a silent token refresh on 401, but not for the refresh endpoint itself
    if (status === 401 && !config?._retry && config?.url !== '/api/auth/refresh') {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: () => resolve(apiClient(config!)),
            reject,
          });
        });
      }

      isRefreshing = true;
      if (config) config._retry = true;

      try {
        await axios.post(
          '/api/auth/refresh',
          {},
          {
            baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
            withCredentials: true,
          }
        );
        drainQueue(null);
        return apiClient(config!);
      } catch (refreshError) {
        drainQueue(refreshError);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
