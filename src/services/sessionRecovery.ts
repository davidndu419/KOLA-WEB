import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getStorageKeys } from '@/lib/runtime-mode';
import { useAuthStore } from '@/stores/authStore';
import { useStore } from '@/store/use-store';

export type SupabaseSessionRecoveryResult =
  | {
      ok: true;
      source: string;
      session: Session;
      user: User;
      recoveredBy: 'existing-session' | 'refresh-session' | 'check-session';
    }
  | {
      ok: false;
      source: string;
      error: string;
      localAuthPresent: boolean;
      supabaseSessionPresent: boolean;
    };

const SESSION_EXPIRED_MESSAGE = 'Session expired. Please login again.';
let authStateListenerStarted = false;

function isBrowserOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function setRecoveryStatus(status: 'idle' | 'recovering' | 'recovered' | 'failed', error?: string | null) {
  useAuthStore.getState().setAuthRecoveryStatus(status, error || null);
}

async function validateSession(session: Session | null) {
  if (!session?.user) return null;

  if (!isBrowserOnline()) {
    return session.user;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    console.warn('[AuthRecovery] Supabase user validation failed:', error?.message);
    return null;
  }

  return data.user;
}

export function clearGhostAuthState(reason = SESSION_EXPIRED_MESSAGE) {
  const store = useAuthStore.getState();
  store.clearAuth();
  store.setInitialized(true);
  store.setHydrationStatus('failed');
  store.setAuthRecoveryStatus('failed', reason);
  useStore.getState().logout();

  if (typeof window !== 'undefined') {
    const keys = getStorageKeys();
    window.localStorage.removeItem(keys.syncLock);
    window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message: reason } }));
    window.dispatchEvent(new CustomEvent('kola:session-expired', { detail: { reason } }));
  }
}

export async function ensureSupabaseSession(source: string): Promise<SupabaseSessionRecoveryResult> {
  const localAuthPresent = () => {
    const state = useAuthStore.getState();
    return !!state.user && state.isAuthenticated;
  };

  setRecoveryStatus('recovering');

  try {
    const existing = await supabase.auth.getSession();
    const existingSession = existing.data.session;
    const existingUser = await validateSession(existingSession);

    if (existingSession && existingUser) {
      setRecoveryStatus('recovered');
      return {
        ok: true,
        source,
        session: existingSession,
        user: existingUser,
        recoveredBy: 'existing-session',
      };
    }

    const refreshed = await supabase.auth.refreshSession();
    const refreshedSession = refreshed.data.session;
    const refreshedUser = await validateSession(refreshedSession);

    if (!refreshed.error && refreshedSession && refreshedUser) {
      setRecoveryStatus('recovered');
      return {
        ok: true,
        source,
        session: refreshedSession,
        user: refreshedUser,
        recoveredBy: 'refresh-session',
      };
    }

    const { authService } = await import('@/services/authService');
    await authService.checkSession({ source, preferCloudBusiness: true });

    const checked = await supabase.auth.getSession();
    const checkedSession = checked.data.session;
    const checkedUser = await validateSession(checkedSession);

    if (checkedSession && checkedUser) {
      setRecoveryStatus('recovered');
      return {
        ok: true,
        source,
        session: checkedSession,
        user: checkedUser,
        recoveredBy: 'check-session',
      };
    }

    const error = SESSION_EXPIRED_MESSAGE;
    setRecoveryStatus('failed', error);
    return {
      ok: false,
      source,
      error,
      localAuthPresent: localAuthPresent(),
      supabaseSessionPresent: !!checkedSession,
    };
  } catch (error: any) {
    const message = error?.message || SESSION_EXPIRED_MESSAGE;
    setRecoveryStatus('failed', message);
    return {
      ok: false,
      source,
      error: message,
      localAuthPresent: localAuthPresent(),
      supabaseSessionPresent: false,
    };
  }
}

export function startSupabaseAuthStateListener() {
  if (authStateListenerStarted || typeof window === 'undefined') {
    return () => {};
  }

  authStateListenerStarted = true;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    setTimeout(async () => {
      if (event === 'SIGNED_OUT') {
        clearGhostAuthState(SESSION_EXPIRED_MESSAGE);
        return;
      }

      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          const recovered = await ensureSupabaseSession('auth-state-initial');
          if (recovered.ok) {
            const { authService } = await import('@/services/authService');
            await authService.checkSession({ source: 'auth-state-initial', preferCloudBusiness: true });
          }
        } else if (localStorageHasAuthStoreUser()) {
          clearGhostAuthState(SESSION_EXPIRED_MESSAGE);
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        setRecoveryStatus('recovered');
        return;
      }

      if (event === 'USER_UPDATED') {
        const { authService } = await import('@/services/authService');
        await authService.checkSession({ source: 'auth-state-user-updated', preferCloudBusiness: true });
      }
    }, 0);
  });

  return () => {
    authStateListenerStarted = false;
    data.subscription.unsubscribe();
  };
}

function localStorageHasAuthStoreUser() {
  return !!useAuthStore.getState().user && useAuthStore.getState().isAuthenticated;
}

export { SESSION_EXPIRED_MESSAGE };
