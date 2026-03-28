'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useUser } from '@/contexts/UserContext';
import { getMeApi } from '@/services/auth/api';

export function useAuth() {
  const { user, setUser, setIsLoading } = useUser();
  const router = useRouter();
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current || user !== null) return;
    hasFetched.current = true;

    getMeApi()
      .then((data) => {
        setUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          companyId: data.user.companyId,
          isActive: data.user.isActive,
          mfaEnabled: data.user.mfaEnabled,
          tenantId: data.user.tenantId,
          lastLogin: data.user.lastLogin,
        });
      })
      .catch((err: unknown) => {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 403 && (err.response.data as { code?: string })?.code === 'ACCOUNT_DEACTIVATED') {
            router.push('/login?error=deactivated');
          } else if (err.response?.status === 401) {
            router.push('/login');
          }
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [user, setUser, setIsLoading, router]);
}
