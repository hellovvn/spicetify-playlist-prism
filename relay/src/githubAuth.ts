// Signs in to GitHub as the "prism-reports" GitHub App and gets a short-lived token
// that can create issues on the repos the App is installed on.
//
// How a GitHub App signs in:
// 1. Make a JWT (a signed note "I am App <id>", valid ~10 min) with the App's private key.
// 2. Trade it at GitHub for an installation token (valid 1 hour, only for that installation).
//
// GitHub's .pem key is "BEGIN RSA PRIVATE KEY" (PKCS#1). The browser crypto API
// (crypto.subtle, which Cloudflare Workers have) only reads PKCS#8, so pkcs1ToPkcs8 wraps it.
// A key already in PKCS#8 ("BEGIN PRIVATE KEY") is used as is.

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const isPkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  const der = base64ToBytes(body);
  const pkcs8 = isPkcs1 ? pkcs1ToPkcs8(der) : der;
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** The App's JWT, valid from 60 s ago (clock drift) for 9 minutes. */
export async function makeAppJwt(appId: string, key: CryptoKey, nowSeconds: number): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: nowSeconds - 60, exp: nowSeconds + 9 * 60, iss: appId };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

/** Wraps a PKCS#1 RSA key in the PKCS#8 envelope (DER). */
export function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  // SEQUENCE { INTEGER 0, SEQUENCE { OID rsaEncryption, NULL }, OCTET STRING <pkcs1> }
  const version = [0x02, 0x01, 0x00];
  const algorithm = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLength(pkcs1.length)];
  const innerLength = version.length + algorithm.length + octet.length + pkcs1.length;
  const head = [0x30, ...derLength(innerLength), ...version, ...algorithm, ...octet];
  const out = new Uint8Array(head.length + pkcs1.length);
  out.set(head, 0);
  out.set(pkcs1, head.length);
  return out;
}

function derLength(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n = Math.floor(n / 256);
  }
  return [0x80 | bytes.length, ...bytes];
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlJson(obj: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(obj)));
}
