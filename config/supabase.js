const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('\x1b[33m%s\x1b[0m', 'Warning: SUPABASE_URL or SUPABASE_ANON_KEY is not defined in environment variables. Supabase authentication calls will fail.');
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder-project-url.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

module.exports = supabase;
