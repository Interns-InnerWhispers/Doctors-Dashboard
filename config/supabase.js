const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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

let cachedKeys = null;
let lastFetched = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const fetchJWKS = async (forceRefresh = false) => {
  const now = Date.now();
  if (cachedKeys && !forceRefresh && (now - lastFetched < CACHE_TTL)) {
    return cachedKeys;
  }

  const url = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseAnonKey
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch JWKS from Supabase: ${res.statusText}`);
    }
    const data = await res.json();
    if (data && Array.isArray(data.keys)) {
      cachedKeys = data.keys;
      lastFetched = now;
      return cachedKeys;
    }
    throw new Error('Invalid JWKS format returned from Supabase');
  } catch (err) {
    console.error('Error fetching JWKS from Supabase:', err.message);
    if (cachedKeys) {
      console.warn('Returning stale cached JWKS keys due to fetch failure.');
      return cachedKeys;
    }
    throw err;
  }
};

const verifyJWTLocally = async (token) => {
  try {
    const decodedToken = jwt.decode(token, { complete: true });
    if (!decodedToken || !decodedToken.header) {
      throw new Error('Invalid JWT format');
    }

    const { kid, alg } = decodedToken.header;
    if (alg !== 'ES256') {
      throw new Error(`Unsupported JWT algorithm: ${alg}`);
    }

    let keys = await fetchJWKS();
    let keyMatch = keys.find(k => k.kid === kid);

    if (!keyMatch) {
      console.log(`JWK key ID "${kid}" not found in cache. Refreshing JWKS...`);
      keys = await fetchJWKS(true);
      keyMatch = keys.find(k => k.kid === kid);
    }

    if (!keyMatch) {
      throw new Error(`Signing key not found for kid: ${kid}`);
    }

    const publicKey = crypto.createPublicKey({
      format: 'jwk',
      key: keyMatch
    });
    const pem = publicKey.export({ type: 'spki', format: 'pem' });

    const payload = jwt.verify(token, pem, { algorithms: ['ES256'] });

    return {
      user: {
        id: payload.sub,
        email: payload.email,
        user_metadata: payload.user_metadata || {}
      },
      error: null
    };
  } catch (error) {
    return {
      user: null,
      error
    };
  }
};

module.exports = {
  supabaseAdmin,
  createSupabaseClient,
  supabaseUrl,
  supabaseAnonKey,
  verifyJWTLocally
};
