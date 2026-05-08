import crypto from "node:crypto";

const SECRET = (() => {
  const value = process.env.OAUTH_SIGNING_SECRET;
  if (!value || value.length < 32) {
    throw new Error("OAUTH_SIGNING_SECRET is missing or too short");
  }
  return value;
})();

export function generateOpaqueToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("base64url");
}

export function generateClientId(): string {
  return `bi_${crypto.randomBytes(16).toString("base64url")}`;
}

export function generateClientSecret(): string {
  return generateOpaqueToken(32);
}

export function hashToken(token: string): string {
  return crypto.createHmac("sha256", SECRET).update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
