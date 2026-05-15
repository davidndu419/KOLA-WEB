import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  clearAuth: () => void;
  setInitialized: (value: boolean) => void;
}

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
      name: 'kola-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
