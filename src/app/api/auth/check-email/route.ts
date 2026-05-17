import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/check-email
 * Server-side endpoint to check if an email is already registered.
 * Uses the service role key to query auth.users — NEVER exposed to client.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[check-email] Missing Supabase configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Create admin client with service role key (server-side only)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user exists via admin API
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (error) {
      console.error('[check-email] Admin API error:', error);
      // Fall back to a different approach: try to look up by email
      // listUsers doesn't support email filter, so we use a targeted approach
    }

    // Use the admin getUserByEmail-style approach via listing
    // Since listUsers doesn't filter by email, we use a direct RPC approach
    // Query the auth.users table directly via service role
    const { data: userData, error: userError } = await supabaseAdmin
      .rpc('check_email_exists_fn', { email_input: email.toLowerCase().trim() });

    if (!userError && userData !== null && userData !== undefined) {
      return NextResponse.json({ exists: !!userData });
    }

    // Fallback: Use admin.listUsers and filter (works for small user bases)
    // For production scale, the RPC function is preferred
    const { data: allUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error('[check-email] List users error:', listError);
      // If we can't check, allow the signup to proceed — Supabase will handle it
      return NextResponse.json({ exists: false });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userExists = allUsers.users.some(
      (u) => u.email?.toLowerCase().trim() === normalizedEmail
    );

    return NextResponse.json({ exists: userExists });
  } catch (err: any) {
    console.error('[check-email] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
