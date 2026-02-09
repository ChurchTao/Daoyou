import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_AUTH_SERVICE_KEY;

export function createAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase admin config: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_AUTH_SERVICE_KEY',
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
