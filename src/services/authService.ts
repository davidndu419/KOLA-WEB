import { supabase } from '@/lib/supabase';
import { db } from '@/db/dexie';
import { useAuthStore } from '@/stores/authStore';
import { useStore } from '@/store/use-store';
import { syncService } from './sync.service';

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
  user_id: string;
  name: string;
  type: string;
  business_name: string;
  business_type: string;
  currency: string;
  created_at: Date;
  updated_at: Date;
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
  version: number;
  device_id: string;
};

function isBrowserOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function normalizeBusiness(raw: any, userId: string): BusinessProfile {
  const businessId = raw?.business_id || raw?.local_id || raw?.id || crypto.randomUUID();
  const name = raw?.business_name || raw?.name || 'Kola Business';
  const type = raw?.business_type || raw?.type || 'retail';

  return {
    local_id: businessId,
    id: businessId,
    business_id: businessId,
    user_id: raw?.owner_id || raw?.user_id || userId,
    business_name: name,
    business_type: type,
    name,
    type,
    currency: raw?.currency || 'NGN',
    created_at: raw?.created_at ? new Date(raw.created_at) : new Date(),
    updated_at: raw?.updated_at ? new Date(raw.updated_at) : new Date(),
    sync_status: raw?.sync_status || 'synced',
    version: raw?.version || 1,
    device_id: raw?.device_id || 'web-pwa',
  };
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
    });
  }
}

async function loadLocalBusiness(userId: string): Promise<BusinessProfile | null> {
  const activeSetting = await db.app_settings.where('key').equals('active_business_id').first();
  const activeBusinessId = activeSetting?.value;

  if (activeBusinessId) {
    const active = await db.businesses.where('business_id').equals(activeBusinessId).first();
    if (active && (!active.user_id || active.user_id === userId)) {
      const normalized = normalizeBusiness(active, userId);
      if (!active.user_id) await saveBusinessLocally(normalized);
      return normalized;
    }
  }

  const byUser = await db.businesses.where('user_id').equals(userId).first();
  if (byUser) return normalizeBusiness(byUser, userId);

  const profileSetting = await db.app_settings.where('key').equals('business_profile').first();
  if (profileSetting?.value) {
    const normalized = normalizeBusiness(profileSetting.value, userId);
    await saveBusinessLocally(normalized);
    return normalized;
  }

  return null;
}

async function pullBusinessFromCloud(userId: string): Promise<BusinessProfile | null> {
  if (!isBrowserOnline()) return null;

  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const business = normalizeBusiness(data, userId);
    await saveBusinessLocally(business);
    return business;
  } catch (error) {
    console.warn('[Auth] Unable to pull business profile from cloud:', error);
    return null;
  }
}

export const authService = {
  async signUp(email: string, password: string, fullName: string) {
    try {
      const { data, error } = await Promise.race([
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        }),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Sign up timeout. Please try again.')), 15000)
        )
      ]);
      
      if (error) throw error;
      return data;
    } catch (err: any) {
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

      if (data.user) {
        const userProfile = {
          id: data.user.id,
          email: data.user.email!,
          full_name: data.user.user_metadata?.full_name,
        };

        const business = (await loadLocalBusiness(data.user.id)) || (await pullBusinessFromCloud(data.user.id));
        hydrateStores(userProfile, business);

        if (business && isBrowserOnline()) {
          // Attempt sync but don't block login if it fails
          syncService.pullFromCloud(business.business_id).catch(e => console.warn('[Auth] Initial sync failed:', e));
        }
      }

      return data;
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('Connection failed. Please check your internet and try again.');
      }
      throw err;
    }
  },

  async signOut() {
    await supabase.auth.signOut();
    useAuthStore.getState().clearAuth();
    useStore.getState().logout();
  },

  async setupBusiness(userId: string, details: { name: string; type: string; currency: string }) {
    const business_id = crypto.randomUUID();
    const now = new Date();
    
    const businessData: BusinessProfile = {
      id: business_id,
      local_id: business_id,
      business_id,
      user_id: userId,
      business_name: details.name,
      business_type: details.type,
      name: details.name,
      type: details.type,
      currency: details.currency,
      created_at: now,
      updated_at: now,
      sync_status: 'pending' as const,
      version: 1,
      device_id: 'web-pwa'
    };

    await saveBusinessLocally(businessData);

    await db.sync_queue.add({
      business_id,
      entity: 'businesses',
      entity_id: business_id,
      action: 'create',
      payload: businessData,
      status: 'pending',
      retry_count: 0,
      created_at: new Date()
    });

    const user = useAuthStore.getState().user;
    if (user) {
      hydrateStores({ ...user, business_id }, businessData);
    }

    return businessData;
  },

  async checkSession() {
    try {
      const store = useAuthStore.getState();

      if (!isBrowserOnline()) {
        console.log('[Auth] Using local persistent session (Offline)');
        if (store.isAuthenticated && store.user) {
          const business = store.business || await loadLocalBusiness(store.user.id);
          hydrateStores(store.user, business as BusinessProfile | null);
        }
        return;
      }

      let session = null;
      try {
        const result = await supabase.auth.getSession();
        session = result.data.session;
      } catch (error) {
        console.warn('[Auth] Supabase session check failed, using local session if available:', error);
      }

      if (session?.user) {
        const userProfile = {
          id: session.user.id,
          email: session.user.email!,
          full_name: session.user.user_metadata?.full_name,
        };

        const business = (await loadLocalBusiness(session.user.id)) || (await pullBusinessFromCloud(session.user.id));
        hydrateStores(userProfile, business);
      } else if (store.isAuthenticated && store.user) {
        console.log('[Auth] Using local persistent session');
        const business = store.business || await loadLocalBusiness(store.user.id);
        hydrateStores(store.user, business as BusinessProfile | null);
      } else {
        store.clearAuth();
        useStore.getState().logout();
      }
    } catch (error) {
      console.warn('[Auth] Session check failed, preserving local session if present:', error);
      const store = useAuthStore.getState();
      if (store.isAuthenticated && store.user) {
        hydrateStores(store.user, store.business as BusinessProfile | null);
      }
    } finally {
      useAuthStore.getState().setInitialized(true);
    }
  }
};
