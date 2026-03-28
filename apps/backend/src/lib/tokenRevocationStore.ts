// In-memory revocation store (replace with Redis for production)
// NOTE: This store is not cluster-safe. Use Redis for multi-process deployments.
const revokedTokens = new Map<string, number>(); // jti → expiry timestamp (seconds)

export const revokeToken = (jti: string, expiresAt: number): void => {
  revokedTokens.set(jti, expiresAt);
};

export const isTokenRevoked = (jti: string): boolean => {
  const expiresAt = revokedTokens.get(jti);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt * 1000) {
    revokedTokens.delete(jti); // cleanup expired entry
    return false;
  }
  return true;
};

// Cleanup expired tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiresAt] of revokedTokens.entries()) {
    if (now > expiresAt * 1000) revokedTokens.delete(jti);
  }
}, 60 * 60 * 1000);
