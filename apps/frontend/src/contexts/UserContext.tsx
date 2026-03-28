'use client';

import { createContext, useContext, useState } from 'react';
import { logoutApi } from '@/services/auth/api';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  companyId: string | null;
  isActive: boolean;
  mfaEnabled: boolean;
  tenantId: string | null;
  lastLogin: string | null;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = async () => {
    try {
      await logoutApi();
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser, isLoading, setIsLoading, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
