import { describe, expect, it } from 'vitest';
import { verifySignatureV2 } from '../src/webhook/verify';

// Official worked example from ThunderPhone's "Verify webhook signatures" guide.
const SECRET = 'whsec_example_4c1f2a9b';
const HEADER = 't=1767225600,v1=03a89bec521f78d55727237ca4713bb0b8dcdf2e09e450865b5b5637b80c1c4e';
const BODY = '{"customer_id":"cust_123"}';
const base = { header: HEADER, secret: SECRET, method: 'POST', path: '/tools/lookup?region=us', body: BODY, now: 1767225600 };

describe('verifySignatureV2', () => {
  it('accepts the documented test vector', () => expect(verifySignatureV2(base)).toBe(true));
  it('accepts a GET with an empty body (documented vector)', () => {
    expect(verifySignatureV2({ ...base, header: 't=1767225600,v1=3ce214cb0b8f2bf39b1d19d4e7265df9dbaff5a5f838d3cc6c753a8f7a4ad280',
      method: 'GET', path: '/tools/lookup?customer_id=cust_123', body: '' })).toBe(true);
  });
  it('rejects a wrong secret', () => expect(verifySignatureV2({ ...base, secret: 'nope' })).toBe(false));
  it('rejects a tampered body', () => expect(verifySignatureV2({ ...base, body: BODY + ' ' })).toBe(false));
  it('rejects a changed path or method', () => {
    expect(verifySignatureV2({ ...base, path: '/tools/lookup?region=in' })).toBe(false);
    expect(verifySignatureV2({ ...base, method: 'PUT' })).toBe(false);
  });
  it('rejects replays older than 5 minutes', () => expect(verifySignatureV2({ ...base, now: 1767225600 + 301 })).toBe(false));
  it('accepts within the 5 minute window', () => expect(verifySignatureV2({ ...base, now: 1767225600 + 299 })).toBe(true));
  it('rejects missing header or empty secret', () => {
    expect(verifySignatureV2({ ...base, header: undefined })).toBe(false);
    expect(verifySignatureV2({ ...base, secret: '' })).toBe(false);
  });
  it('supports secret rotation', () => expect(verifySignatureV2({ ...base, secret: ['new', SECRET] })).toBe(true));
});
