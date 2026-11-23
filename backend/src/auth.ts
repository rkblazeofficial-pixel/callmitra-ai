import { jwtVerify } from 'jose';

// Verifies a Supabase access token (HS256, signed with the project's JWT secret).
export async function verifyUser(authHeader: string | undefined, secret: string): Promise<string | null> {
  if (!secret || !authHeader?.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jwtVerify(authHeader.slice(7), new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
