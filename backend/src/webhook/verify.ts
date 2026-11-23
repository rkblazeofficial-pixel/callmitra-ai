import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 300;

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// X-ThunderPhone-Signature-V2: t=<unix>,v1=<hex hmac of "t\nMETHOD\npath?query\nbody">.
// `path` must be the request target exactly as received; `body` the raw bytes.
export function verifySignatureV2(opts: {
  header: string | undefined; secret: string | string[]; method: string; path: string; body: Buffer | string; now?: number;
}): boolean {
  const secrets = Array.isArray(opts.secret) ? opts.secret : [opts.secret];
  if (!opts.header || secrets.every((s) => !s)) return false;
  let t: number | undefined;
  const sigs: string[] = [];
  for (const part of opts.header.split(',')) {
    const [k, ...rest] = part.trim().split('=');
    const v = rest.join('=');
    if (k === 't' && /^\d{1,15}$/.test(v)) t = Number(v);
    else if (k === 'v1') sigs.push(v);
  }
  if (t === undefined) return false;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > TOLERANCE_SECONDS) return false;
  const body = typeof opts.body === 'string' ? Buffer.from(opts.body) : opts.body;
  for (const secret of secrets) {
    if (!secret) continue;
    const expected = createHmac('sha256', secret)
      .update(`${t}\n${opts.method.toUpperCase()}\n${opts.path}\n`)
      .update(body)
      .digest('hex');
    if (sigs.some((s) => safeEqual(s, expected))) return true;
  }
  return false;
}
