/** Shared login error when a profile is inactive / not activated. */
export const ACCOUNT_INACTIVE_MESSAGE =
  "Your account is not activated. Please contact your adviser or designated teacher.";

/** Shared login error when time-limited activation has ended. */
export const ACCOUNT_EXPIRED_MESSAGE =
  "Your account activation has expired. Please contact your adviser or designated teacher.";

export { SESSION_REPLACED_MESSAGE } from "@/lib/auth-session";

export const LOGIN_ERROR_STORAGE_KEY = "pms_login_error";

export function stashLoginError(message: string) {
  try {
    sessionStorage.setItem(LOGIN_ERROR_STORAGE_KEY, message);
  } catch {
    // ignore
  }
}

export function consumeLoginError(): string | null {
  try {
    const message = sessionStorage.getItem(LOGIN_ERROR_STORAGE_KEY);
    if (message) sessionStorage.removeItem(LOGIN_ERROR_STORAGE_KEY);
    return message;
  } catch {
    return null;
  }
}
