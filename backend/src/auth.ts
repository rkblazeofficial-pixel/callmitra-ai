import { createRemoteJWKSet, jwtVerify, JWTVerifyGetKey } from 'jose';

// Supabase signs access tokens either with a shared HS256 secret (legacy projects) or with
// asymmetric keys published at <project>/auth/v1/.well-known/jwks.json (current projects).
export type KeySource = { hs256Secret?: string; jwks?: JWTVerifyGetKey };

export function keySourceFromEnv(c: { supabaseUrl: string; supabaseJwtSecret: string }): KeySource {
  return {
    hs256Secret: c.supabaseJwtSecret || undefined,
    jwks: c.supabaseUrl ? createRemoteJWKSet(new URL(`${c.supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`)) : undefined,
  };
}

export async function verifyUser(authHeader: string | undefined, keys: KeySource): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const opts = { audience: 'authenticated' };
  try {
    if (keys.jwks) {
      try {
        const { payload } = await jwtVerify(token, keys.jwks, { ...opts, algorithms: ['ES256', 'RS256'] });
        if (typeof payload.sub === 'string') return payload.sub;
      } catch { /* fall through to the legacy secret */ }
    }
    if (keys.hs256Secret) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(keys.hs256Secret), { ...opts, algorithms: ['HS256'] });
      if (typeof payload.sub === 'string') return payload.sub;
    }
  } catch { /* invalid token */ }
  return null;
}
