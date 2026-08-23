export const SESSION_NONCE_COOKIE = "pms_session_nonce";
export const SESSION_NONCE_STORAGE_KEY = "pms_session_nonce";

export const SESSION_REPLACED_MESSAGE =
  "This account signed in on another device. You have been signed out.";

export function nonceCookieOptions(maxAge = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
