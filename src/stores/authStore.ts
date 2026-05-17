import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getStorageKeys } from '@/lib/runtime-mode';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  business_id?: string;
}

interface BusinessProfile {
  id: string;
  local_id?: string;
  business_id?: string;
  user_id?: string;
  name: string;
  type: string;
  business_name?: string;
  business_type?: string;
  currency: string;
  ownerName?: string;
  address?: string;
  created_at?: Date | string;
  updated_at?: Date | string;
  sync_status?: 'pending' | 'synced' | 'failed' | 'conflict';
}

interface AuthState {
  user: UserProfile | null;
  business: BusinessProfile | null;
  userId: string | null;
  activeBusinessId: string | null;
  businessName: string | null;
  businessType: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  
  setAuth: (user: UserProfile, business: BusinessProfile | null) => void;
  updateBusiness: (business: BusinessProfile) => void;
  clearAuth: () => void;
  setInitialized: (value: boolean) => void;
}

// Resolve the storage key at module load time (client-side) or use a safe default (SSR)
const storageKey = typeof window !== 'undefined' 
  ? getStorageKeys().authStorage 
  : 'kola-browser-auth-storage';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      business: null,
      userId: null,
      activeBusinessId: null,
      businessName: null,
      businessType: null,
      isAuthenticated: false,
      isInitialized: false,

      setAuth: (user, business) => set({ 
        user, 
        business, 
        userId: user.id,
        activeBusinessId: business?.id || business?.business_id || null,
        businessName: business?.name || business?.business_name || null,
        businessType: business?.type || business?.business_type || null,
        isAuthenticated: true 
      }),

      updateBusiness: (business) => set({
        business,
        activeBusinessId: business.id || business.business_id || null,
        businessName: business.name || business.business_name || null,
        businessType: business.type || business.business_type || null,
      }),

      clearAuth: () => set({ 
        user: null, 
        business: null, 
        userId: null,
        activeBusinessId: null,
        businessName: null,
        businessType: null,
        isAuthenticated: false 
      }),

      setInitialized: (isInitialized) => set({ isInitialized }),
    }),
    {
      name: storageKey,
      storage: createJSONStorage(() => localStorage),
    }
  )
);
