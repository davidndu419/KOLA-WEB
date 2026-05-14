// src/store/use-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Business {
  id: string;
  name: string;
  currency: string;
  ownerName: string;
  phone?: string;
  address?: string;
}

interface User {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'staff';
}

interface AppState {
  business: Business | null;
  user: User | null;
  isOffline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  theme: 'light' | 'dark';
  notificationsEnabled: boolean;
  
  // Actions
  setBusiness: (business: Business) => void;
  setUser: (user: User) => void;
  setOfflineStatus: (status: boolean) => void;
  setSyncStatus: (status: boolean) => void;
  setLastSyncTime: (time: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  logout: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      business: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Kola General Store',
        currency: '₦',
        ownerName: 'John Kola',
        address: '123 Lagos Way, Nigeria',
      },
      user: {
        id: 'user-001',
        name: 'John',
        role: 'owner',
      },
      isOffline: false,
      isSyncing: false,
      lastSyncTime: null,
      theme: 'light',
      notificationsEnabled: true,

      setBusiness: (business) => set({ business }),
      setUser: (user) => set({ user }),
      setOfflineStatus: (isOffline) => set({ isOffline }),
      setSyncStatus: (isSyncing) => set({ isSyncing }),
      setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
      setTheme: (theme) => set({ theme }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      logout: () => set({ business: null, user: null }),
    }),
    {
      name: 'kola-app-storage',
    }
  )
);
