let accessToken = null;
let refreshToken = null;

function getApiBase() {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (window.location.port === "3000") return "";
  return "https://umubareapp.onrender.com";
}

const API_BASE = getApiBase();

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

export function isAuthenticated() {
  return !!accessToken;
}

export async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Handle token expiry - try refresh once
  if (res.status === 401 && refreshToken && !options._retried) {
    const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      accessToken = data.token;
      if (data.refreshToken) refreshToken = data.refreshToken;
      return api(path, { ...options, _retried: true });
    }

    // Refresh failed - clear tokens
    clearTokens();
    window.dispatchEvent(new CustomEvent("auth:expired"));
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed with status ${res.status}`);
  }

  // Handle 204 No Content
  if (res.status === 204) return null;

  return res.json();
}
