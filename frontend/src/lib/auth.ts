const TOKEN_KEY = "token";

/** Reads the `exp` claim (seconds since epoch) from a JWT without verifying it. */
function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json)?.exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * The stored login token, or null when there is none or it has expired.
 * Expired tokens are removed so they can't send the user to the chat page again.
 */
export function getValidToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const exp = tokenExpiry(token);
  if (exp !== null && exp * 1000 <= Date.now()) {
    clearToken();
    return null;
  }
  return token;
}
