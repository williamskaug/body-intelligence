import crypto from "node:crypto";

export type PkceMethod = "S256" | "plain";

export function verifyChallenge(
  verifier: string,
  challenge: string,
  method: PkceMethod,
): boolean {
  if (method === "plain") {
    return verifier === challenge;
  }
  // S256: BASE64URL(SHA256(verifier)) === challenge
  const computed = crypto.createHash("sha256").update(verifier).digest("base64url");
  return computed === challenge;
}

export function isValidVerifierFormat(verifier: string): boolean {
  // RFC 7636 — code_verifier = high-entropy cryptographic random string,
  // 43-128 chars from [A-Za-z0-9-._~].
  return /^[A-Za-z0-9._~-]{43,128}$/.test(verifier);
}

export function isValidChallengeFormat(challenge: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(challenge);
}
