import { createLocalJWKSet, exportJWK, generateKeyPair, KeyLike, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { verifyUser } from '../src/auth';

describe('verifyUser with JWKS (asymmetric Supabase keys)', () => {
  it('accepts a valid ES256 token and rejects wrong key, audience, or expiry', async () => {
    const good = await generateKeyPair('ES256'); const evil = await generateKeyPair('ES256');
    const jwk = { ...(await exportJWK(good.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
    const keys = { jwks: createLocalJWKSet({ keys: [jwk] }) };
    const mint = (key: KeyLike, aud = 'authenticated', exp = '1h') =>
      new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: 'k1' }).setSubject('user-1').setAudience(aud).setExpirationTime(exp).sign(key);
    expect(await verifyUser(`Bearer ${await mint(good.privateKey)}`, keys)).toBe('user-1');
    expect(await verifyUser(`Bearer ${await mint(evil.privateKey)}`, keys)).toBeNull();
    expect(await verifyUser(`Bearer ${await mint(good.privateKey, 'anon')}`, keys)).toBeNull();
    expect(await verifyUser(`Bearer ${await mint(good.privateKey, 'authenticated', '-1h')}`, keys)).toBeNull();
    expect(await verifyUser(undefined, keys)).toBeNull();
    expect(await verifyUser('Bearer x', {})).toBeNull();
  });
});
