import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { isValidUUID } from '@/lib/uuid';

export async function getCurrentAuthenticatedUserId() {
  const authState = useAuthStore.getState();
  const storeUserId = authState.user?.id || authState.userId;
  if (isValidUUID(storeUserId)) return storeUserId;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn('[Auth] Unable to read current Supabase user:', error.message);
    }
    return isValidUUID(data.user?.id) ? data.user.id : null;
  } catch (error) {
    console.warn('[Auth] Unable to resolve current Supabase user:', error);
    return null;
  }
}
