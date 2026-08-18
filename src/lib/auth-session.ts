export const SESSION_NONCE_COOKIE = "pms_session_nonce";
export const SESSION_NONCE_STORAGE_KEY = "pms_session_nonce";

export const SESSION_REPLACED_MESSAGE =
  "This account signed in on another device. You have been signed out.";

export function formatLockMessage(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return minutes === 1
    ? "Too many failed sign-in attempts. Try again in 1 minute."
    : `Too many failed sign-in attempts. Try again in ${minutes} minutes.`;
}

export function clientIpFromRequest(request: Request) {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf?.trim()) return cf.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function nonceCookieOptions(maxAge = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
