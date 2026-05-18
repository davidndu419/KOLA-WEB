'use client';

import { useEffect } from 'react';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { ensureSupabaseSession } from '@/services/sessionRecovery';

export function useAuth() {
  const { user, business, isAuthenticated, isInitialized } = useAuthStore();

  useEffect(() => {
    useAuthStore.getState().setInitialized(false);
    ensureSupabaseSession('auth-startup').then((result) => {
      if (result.ok) {
        authService.checkSession({ source: 'auth-startup', preferCloudBusiness: true });
      } else if (!navigator.onLine) {
        authService.checkSession({ source: 'auth-startup-offline' });
      }
    });
  }, []);

  return {
    user,
    business,
    isAuthenticated,
    isInitialized,
    signOut: authService.signOut
  };
}
