import { supabase } from '@/lib/supabase';
import { db } from '@/db/dexie';
import { useAuthStore } from '@/stores/authStore';
import { useStore } from '@/store/use-store';
import { syncService } from './sync.service';
import { syncQueueService } from './syncQueueService';
import { getRuntimeMode, getStorageKeys, clearRuntimeModeMarker } from '@/lib/runtime-mode';
import { clearGhostAuthState } from './sessionRecovery';

/**
 * Returns the base URL for auth redirect links (email verification, password reset, OAuth).
 * Uses the live browser origin when available, falls back to NEXT_PUBLIC_APP_URL for SSR.
 * This ensures production emails always point to the production domain.
 */
function getAuthRedirectBase(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://kola-web-ten.vercel.app';
}

type UserProfile = {
  id: string;
  email: string;
  full_name?: string;
  business_id?: string;
};

type BusinessProfile = {
  id: string;
  local_id: string;
  business_id: string;
  owner_id: string;
  user_id: string;
  name: string;
  type: string;
  business_name: string;
  business_type: string;
  currency: string;
  address?: string;
  physical_address?: string;
  created_at: Date;
  updated_at: Date;
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
  version: number;
  device_id: string;
};

type BusinessCloudLookup = {
  business: BusinessProfile | null;
  foundCount: number;
  source: 'owner_id' | 'none';
};

type SessionHydrationOptions = {
  preferCloudBusiness?: boolean;
  source?: string;
};

function devLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, payload || '');
  }
}

function isBrowserOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

// ─── USER-SWITCH ISOLATION ───────────────────────────────────────────────────
// Tracks the last authenticated user ID per runtime mode so we can detect
// when a *different* user signs in and clear stale data.

const LAST_USER_KEY_PREFIX = 'kola-last-auth-user';

function getLastUserKey(): string {
  const mode = getRuntimeMode();
  return `${LAST_USER_KEY_PREFIX}-${mode}`;
}

function getLastAuthUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(getLastUserKey());
}

function setLastAuthUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getLastUserKey(), userId);
}

function clearLastAuthUserId(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getLastUserKey());
}

/**
 * Clears ALL user-scoped data from Dexie tables for the current runtime mode.
 * Called when a different user signs in to prevent cross-user data leakage.
 * Preserves only the database structure (schema/indexes).
 */
async function clearLocalUserData(): Promise<void> {
  console.log('[Auth] Clearing local Dexie user data for user switch');

  const tablesToClear = [
    'businesses',
    'products',
    'categories',
    'service_categories',
    'expense_categories',
    'transactions',
    'sales',
    'sale_items',
    'services',
    'expenses',
    'ledger_entries',
    'sync_queue',
    'inventory_movements',
    'customers',
    'suppliers',
    'receivables',
    'app_settings',
    'receipts',
    'audit_logs',
  ];

  for (const tableName of tablesToClear) {
    try {
      const table = (db as any)[tableName];
      if (table && typeof table.clear === 'function') {
        await table.clear();
      }
    } catch (err) {
      console.warn(`[Auth] Failed to clear table ${tableName}:`, err);
    }
  }

  console.log('[Auth] Local Dexie data cleared');
}

/**
 * Detects if the signing-in user is different from the last authenticated user.
 * If so, clears all stale local data before proceeding with hydration.
 */
async function handleUserSwitch(newUserId: string): Promise<void> {
  const lastUserId = getLastAuthUserId();

  if (lastUserId && lastUserId !== newUserId) {
    console.log(`[Auth] User switch detected: ${lastUserId.slice(0, 8)}… → ${newUserId.slice(0, 8)}…`);

    // 1. Clear Zustand stores immediately
    useAuthStore.getState().clearAuth();
    useStore.getState().logout();

    // 2. Clear all Dexie user data
    await clearLocalUserData();
  }

  // Record the new user
  setLastAuthUserId(newUserId);
}

// ─── END USER-SWITCH ISOLATION ───────────────────────────────────────────────

function normalizeBusiness(raw: any, userId: string): BusinessProfile {
  const businessId = raw?.business_id || raw?.local_id || raw?.id || crypto.randomUUID();
  const name = raw?.business_name || raw?.name || 'Kola Business';
  const type = raw?.business_type || raw?.type || 'retail';
  const address = raw?.physical_address || raw?.address || '';
  const ownerId = raw?.owner_id || userId;

  return {
    local_id: businessId,
    id: businessId,
    business_id: businessId,
    owner_id: ownerId,
    user_id: ownerId,
    business_name: name,
    business_type: type,
    name,
    type,
    currency: raw?.currency || 'NGN',
    address,
    physical_address: address,
    created_at: raw?.created_at ? new Date(raw.created_at) : new Date(),
    updated_at: raw?.updated_at ? new Date(raw.updated_at) : new Date(),
    sync_status: raw?.sync_status || 'synced',
    version: raw?.version || 1,
    device_id: raw?.device_id || 'web-pwa',
  };
}

function businessBelongsToUser(raw: any, userId: string) {
  return (raw?.owner_id || raw?.user_id) === userId;
}

function remoteBusinessBelongsToUser(raw: any, userId: string) {
  return raw?.owner_id === userId;
}

async function upsertSetting(business_id: string, key: string, value: any) {
  const existing = await db.app_settings
    .where('business_id')
    .equals(business_id)
    .filter((setting) => setting.key === key)
    .first();

  if (existing?.id) {
    await db.app_settings.update(existing.id, { value, updated_at: new Date() });
  } else {
    await db.app_settings.add({ business_id, key, value, updated_at: new Date() });
  }
}

async function saveBusinessLocally(business: BusinessProfile) {
  const { id: _authId, ...dexieBusiness } = business;
  const existing = await db.businesses.where('business_id').equals(business.business_id).first();

  if (existing?.id) {
    await db.businesses.update(existing.id, dexieBusiness);
  } else {
    await db.businesses.add(dexieBusiness);
  }

  await upsertSetting(business.business_id, 'active_business_id', business.business_id);
  await upsertSetting(business.business_id, 'business_profile', business);
}

function hydrateStores(user: UserProfile, business: BusinessProfile | null) {
  useAuthStore.getState().setAuth(
    business ? { ...user, business_id: business.business_id } : user,
    business
  );

  const appStore = useStore.getState();
  appStore.setUser({
    id: user.id,
    name: user.full_name || user.email,
    role: 'owner',
  });

  if (business) {
    appStore.setBusiness({
      id: business.business_id,
      name: business.business_name,
      currency: business.currency,
      ownerName: user.full_name || user.email,
      address: business.physical_address || business.address || '',
    });
  }
}

async function loadLocalBusiness(userId: string): Promise<BusinessProfile | null> {
  // First try to find a business that belongs to this specific user
  const byOwner = await db.businesses.where('owner_id').equals(userId).first();
  if (byOwner) return normalizeBusiness(byOwner, userId);

  // Check active_business_id setting, but ONLY use it if the business belongs to this user
  const activeSetting = await db.app_settings.where('key').equals('active_business_id').first();
  const activeBusinessId = activeSetting?.value;

  if (activeBusinessId) {
    const active = await db.businesses.where('business_id').equals(activeBusinessId).first();
    // CRITICAL: Only return if this business belongs to the current user
    if (active && businessBelongsToUser(active, userId)) {
      return normalizeBusiness(active, userId);
    }
  }

  // Check business_profile setting, but validate ownership
  const profileSetting = await db.app_settings.where('key').equals('business_profile').first();
  if (profileSetting?.value) {
    const profileUserId = profileSetting.value.owner_id || profileSetting.value.user_id;
    // Only use local profile data when ownership matches the current auth user.
    if (profileUserId === userId) {
      const normalized = normalizeBusiness(profileSetting.value, userId);
      await saveBusinessLocally(normalized);
      return normalized;
    }
  }

  return null;
}

async function loadBusinessFromCloud(user: UserProfile): Promise<BusinessCloudLookup> {
  if (!isBrowserOnline()) {
    return { business: null, foundCount: 0, source: 'none' };
  }

  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      devLog('[Auth] Business cloud lookup skipped:', {
        field: 'owner_id',
        code: error.code,
        message: error.message,
      });
      return { business: null, foundCount: 0, source: 'none' };
    }

    const rows = (data || []) as any[];
    const uniqueRows: any[] = Array.from(
      new Map(rows
        .filter((row) => remoteBusinessBelongsToUser(row, user.id))
        .map((row) => [row.local_id || row.business_id || row.id, row]))
        .values()
    );

    const selected = uniqueRows[0] || null;

    devLog('[Auth] Business cloud lookup result:', {
      userId: user.id,
      email: user.email,
      foundCount: uniqueRows.length,
      source: selected ? 'owner_id' : 'none',
      selectedBusinessId: selected?.business_id || selected?.id || null,
      selectedLocalId: selected?.local_id || null,
    });

    if (!selected) {
      return { business: null, foundCount: 0, source: 'none' };
    }

    const business = normalizeBusiness(selected, user.id);
    await saveBusinessLocally(business);
    return { business, foundCount: uniqueRows.length, source: 'owner_id' };
  } catch (error) {
    console.warn('[Auth] Unable to load cloud business profile:', error);
    return { business: null, foundCount: 0, source: 'none' };
  }
}

async function resolveBusinessForUser(
  user: UserProfile,
  options: SessionHydrationOptions = {}
): Promise<BusinessProfile | null> {
  if (options.preferCloudBusiness) {
    const cloudLookup = await loadBusinessFromCloud(user);
    if (cloudLookup.business) return cloudLookup.business;
  }

  const localBusiness = await loadLocalBusiness(user.id);
  if (localBusiness) return localBusiness;

  const cloudLookup = await loadBusinessFromCloud(user);
  return cloudLookup.business;
}

export const authService = {
  /**
   * Check if an email is already registered (server-side via API route).
   * Returns true if the email exists, false otherwise.
   */
  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      if (!response.ok) {
        console.warn('[Auth] Email check API returned non-OK status:', response.status);
        return false; // Fail open — let Supabase handle it
      }

      const data = await response.json();
      return data.exists === true;
    } catch (err) {
      console.warn('[Auth] Email check failed, allowing signup to proceed:', err);
      return false; // Fail open on network error
    }
  },

  async signUp(email: string, password: string, fullName: string) {
    try {
      const redirectUrl = `${getAuthRedirectBase()}/auth/callback`;

      const { data, error } = await Promise.race([
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: redirectUrl,
          },
        }),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Sign up timeout. Please try again.')), 15000)
        )
      ]);
      
      if (error) {
        console.error('[Supabase SignUp Error]:', error);
        throw new Error(`[${error.status || 'ERROR'}] ${error.message}`);
      }
      return data;
    } catch (err: any) {
      console.error('[SignUp Exception]:', err);
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('Network error: Unable to reach authentication server.');
      }
      throw err;
    }
  },

  async signIn(email: string, password: string) {
    if (!isBrowserOnline()) {
      throw new Error('You are offline. Please connect to the internet to sign in.');
    }

    try {
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Login timeout. Please check your connection.')), 12000)
        )
      ]);

      if (error) throw error;

      // Temporarily disabled email verification enforcement
      // if (data.user && !data.user.email_confirmed_at) {
      //   return { ...data, emailVerified: false };
      // }

      if (data.user) {
        // ── USER-SWITCH CHECK ──
        await handleUserSwitch(data.user.id);

        const userProfile = {
          id: data.user.id,
          email: data.user.email!,
          full_name: data.user.user_metadata?.full_name,
        };

        const business = await resolveBusinessForUser(userProfile);
        hydrateStores(userProfile, business);

        if (business && isBrowserOnline()) {
          // Run batched initial sync — blocks until complete so dashboard
          // shows full data instead of drip-feeding items one by one
          useAuthStore.getState().setHydrationStatus('hydrating');
          try {
            await syncService.pullFromCloudBatched(business.business_id);
            useAuthStore.getState().setHydrationStatus('complete');
          } catch (e) {
            console.warn('[Auth] Initial batched sync failed:', e);
            useAuthStore.getState().setHydrationStatus('complete'); // Show what we have
          }
        } else {
          // Offline or no business — skip hydration
          useAuthStore.getState().setHydrationStatus('complete');
        }
      }

      return { ...data, emailVerified: true };
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('Connection failed. Please check your internet and try again.');
      }
      throw err;
    }
  },

  async signInWithGoogle() {
    if (!isBrowserOnline()) {
      throw new Error('You are offline. Please connect to the internet to sign in.');
    }

    const redirectUrl = `${getAuthRedirectBase()}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;
    return data;
  },

  async sendPasswordResetEmail(email: string) {
    if (!isBrowserOnline()) {
      throw new Error('You are offline. Please connect to the internet.');
    }

    const redirectUrl = `${getAuthRedirectBase()}/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error('[Supabase Reset Password Error]:', error);
      throw new Error(`[${error.status || 'ERROR'}] ${error.message}`);
    }
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('[Supabase Update Password Error]:', error);
      throw new Error(`[${error.status || 'ERROR'}] ${error.message}`);
    }
  },

  async resendVerificationEmail(email: string) {
    if (!isBrowserOnline()) {
      throw new Error('You are offline. Please connect to the internet.');
    }

    const redirectUrl = `${getAuthRedirectBase()}/auth/callback`;

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('[Supabase Resend Verification Error]:', error);
      throw new Error(`[${error.status || 'ERROR'}] ${error.message}`);
    }
  },

  async signOut() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Auth] Supabase signOut failed (offline?):', err);
    }

    // Clear all stores
    useAuthStore.getState().clearAuth();
    useStore.getState().logout();

    // Clear local Dexie data to prevent data leaking to next user
    await clearLocalUserData();

    // Clear the last user tracker
    clearLastAuthUserId();

    // Clear PWA runtime mode marker so next launch shows login
    clearRuntimeModeMarker();
  },

  async setupBusiness(userId: string, details: { name: string; type: string; currency: string }) {
    const business_id = crypto.randomUUID();
    const now = new Date();
    
    const businessData: BusinessProfile = {
      id: business_id,
      local_id: business_id,
      business_id,
      owner_id: userId,
      user_id: userId,
      business_name: details.name,
      business_type: details.type,
      name: details.name,
      type: details.type,
      currency: details.currency,
      address: '',
      physical_address: '',
      created_at: now,
      updated_at: now,
      sync_status: 'pending' as const,
      version: 1,
      device_id: 'web-pwa'
    };

    await saveBusinessLocally(businessData);

    await syncQueueService.enqueue('businesses', 'create', businessData, business_id);

    const user = useAuthStore.getState().user;
    if (user) {
      hydrateStores({ ...user, business_id }, businessData);
    }

    if (isBrowserOnline()) {
      try {
        await syncService.runFullSync(business_id);
      } catch (error) {
        console.warn('[Auth] Initial business cloud push failed; queued sync remains pending:', error);
      }
    }

    return businessData;
  },

  async checkSession(options: SessionHydrationOptions = {}) {
    try {
      const store = useAuthStore.getState();
      const mode = getRuntimeMode();
      const keys = getStorageKeys();

      if (process.env.NODE_ENV !== 'production') {
        console.log('[Auth] checkSession starting:', {
          source: options.source || 'checkSession',
          mode,
          authStorageKey: keys.authStorage,
          supabaseKey: keys.supabaseAuth,
          storeHasUser: !!store.user,
          storeIsAuthenticated: store.isAuthenticated,
          isOnline: isBrowserOnline(),
        });
      }

      if (!isBrowserOnline()) {
        console.log('[Auth] Offline — using local persistent session');
        if (store.isAuthenticated && store.user) {
          const business = store.business || await loadLocalBusiness(store.user.id);
          hydrateStores(store.user, business as BusinessProfile | null);
          return { user: store.user, business: business as BusinessProfile | null };
        }
        return { user: null, business: null };
      }

      let session = null;
      try {
        try {
          await supabase.auth.refreshSession();
        } catch (refreshError) {
          console.warn('[Auth] Supabase session refresh failed, checking existing session:', refreshError);
        }

        const result = await supabase.auth.getSession();
        session = result.data.session;
      } catch (error) {
        console.warn('[Auth] Supabase session check failed, using local session if available:', error);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('[Auth] Session check results:', {
          source: options.source || 'checkSession',
          supabaseSessionFound: !!session?.user,
          localAuthExists: store.isAuthenticated && !!store.user,
        });
      }

      if (session?.user) {
        // ── USER-SWITCH CHECK ──
        await handleUserSwitch(session.user.id);

        const userProfile = {
          id: session.user.id,
          email: session.user.email!,
          full_name: session.user.user_metadata?.full_name,
        };

        const business = await resolveBusinessForUser(userProfile, options);
        hydrateStores(userProfile, business);

        // Run batched initial sync for new/switched users
        if (business && isBrowserOnline()) {
          useAuthStore.getState().setHydrationStatus('hydrating');
          try {
            await syncService.pullFromCloudBatched(business.business_id);
            useAuthStore.getState().setHydrationStatus('complete');
          } catch (e) {
            console.warn('[Auth] checkSession batched sync failed:', e);
            useAuthStore.getState().setHydrationStatus('complete');
          }
        } else {
          useAuthStore.getState().setHydrationStatus('complete');
        }
        return { user: userProfile, business };
      } else if (store.isAuthenticated && store.user) {
        // Online ghost login: local auth cannot be trusted without a Supabase session.
        console.warn('[Auth] Local auth exists but Supabase session is missing while online; clearing stale local auth.');
        clearGhostAuthState('Session expired. Please login again.');
        return { user: null, business: null };
      } else {
        // No session anywhere — clear auth
        console.log('[Auth] No session found, clearing auth');
        store.clearAuth();
        useStore.getState().logout();
        return { user: null, business: null };
      }
    } catch (error) {
      console.warn('[Auth] Session check failed:', error);
      const store = useAuthStore.getState();
      if (!isBrowserOnline() && store.isAuthenticated && store.user) {
        hydrateStores(store.user, store.business as BusinessProfile | null);
        return { user: store.user, business: store.business as BusinessProfile | null };
      }
      if (isBrowserOnline() && store.isAuthenticated && store.user) {
        clearGhostAuthState('Session expired. Please login again.');
      }
      return { user: null, business: null };
    } finally {
      useAuthStore.getState().setInitialized(true);
    }
  }
};
