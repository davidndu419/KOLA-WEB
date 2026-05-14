import { supabase } from '@/lib/supabase';
import { db } from '@/db/dexie';
import { useAuthStore } from '@/stores/authStore';

export const authService = {
  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data.user) {
      // Attempt to load business from Dexie first (offline-first)
      // If not found, we will handle redirection in the UI
      const userProfile = {
        id: data.user.id,
        email: data.user.email!,
        full_name: data.user.user_metadata?.full_name,
      };

      // Set initial auth state
      useAuthStore.getState().setAuth(userProfile, null);
    }

    return data;
  },

  async signOut() {
    await supabase.auth.signOut();
    useAuthStore.getState().clearAuth();
  },

  async setupBusiness(userId: string, details: { name: string; type: string; currency: string }) {
    const business_id = crypto.randomUUID();
    
    const businessData = {
      local_id: business_id,
      business_id, // For multi-tenant alignment
      name: details.name,
      type: details.type,
      currency: details.currency,
      created_at: new Date(),
      updated_at: new Date(),
      sync_status: 'pending' as const,
      version: 1,
      device_id: 'web-pwa'
    };

    // 1. Save to Dexie (Local-first)
    // We'll assume a 'businesses' table exists or we add it to settings
    await db.app_settings.bulkAdd([
      { key: 'active_business_id', value: business_id, business_id, updated_at: new Date() },
      { key: 'business_profile', value: businessData, business_id, updated_at: new Date() }
    ]);

    // 2. Add to Sync Queue
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

    // 3. Update Auth Store
    const user = useAuthStore.getState().user;
    if (user) {
      useAuthStore.getState().setAuth({ ...user, business_id }, businessData as any);
    }

    return businessData;
  },

  async checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      // Check for local business profile
      const activeBusinessSetting = await db.app_settings.where('key').equals('active_business_id').first();
      const profileSetting = await db.app_settings.where('key').equals('business_profile').first();

      const userProfile = {
        id: session.user.id,
        email: session.user.email!,
        full_name: session.user.user_metadata?.full_name,
        business_id: activeBusinessSetting?.value
      };

      useAuthStore.getState().setAuth(userProfile, profileSetting?.value || null);
    } else {
      // Check for local persistent session (Offline mode)
      const store = useAuthStore.getState();
      if (store.isAuthenticated && store.user) {
        // We have a local session, allow it (Offline-First)
        console.log('[Auth] Using local persistent session (Offline)');
      } else {
        store.clearAuth();
      }
    }
    
    useAuthStore.getState().setInitialized(true);
  }
};
