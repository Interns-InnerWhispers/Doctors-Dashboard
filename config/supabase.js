const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.warn('\x1b[33m%s\x1b[0m', 'Warning: SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables. Supabase calls may fail.');
}

// 1. Service Role Client (Admin Operations Only - Bypasses RLS)
const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder-project-url.supabase.co',
  supabaseServiceRoleKey || 'placeholder-service-role-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// 2. User-Specific Client Factory (Enforces RLS)
const createSupabaseClient = (token) => {
  const options = token ? {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  } : {};
  
  return createClient(
    supabaseUrl || 'https://placeholder-project-url.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
    options
  );
};

module.exports = {
  supabaseAdmin,
  createSupabaseClient,
  supabaseUrl,
  supabaseAnonKey
};
