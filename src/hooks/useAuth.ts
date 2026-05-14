'use client';

import { useEffect } from 'react';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const { user, business, isAuthenticated, isInitialized } = useAuthStore();

  useEffect(() => {
    // Initial session check
    if (!isInitialized) {
      authService.checkSession();
    }
  }, [isInitialized]);

  return {
    user,
    business,
    isAuthenticated,
    isInitialized,
    signOut: authService.signOut
  };
}
