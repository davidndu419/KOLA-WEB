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
  name: string;
  type: string;
  currency: string;
}

interface AuthState {
  user: UserProfile | null;
  business: BusinessProfile | null;
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
      isAuthenticated: false,
      isInitialized: false,

      setAuth: (user, business) => set({ 
        user, 
        business, 
        isAuthenticated: true 
      }),

      clearAuth: () => set({ 
        user: null, 
        business: null, 
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
