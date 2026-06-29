let accessToken = null;
let refreshToken = null;

const STORAGE_KEY_ACCESS = "ub_access";
const STORAGE_KEY_REFRESH = "ub_refresh";

function getApiBase() {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (window.location.port === "3000") return "";
  return "https://umubareapp.onrender.com";
}

const API_BASE = getApiBase();

function loadTokens() {
  const access = localStorage.getItem(STORAGE_KEY_ACCESS);
  const refresh = localStorage.getItem(STORAGE_KEY_REFRESH);
  if (access && refresh) {
    accessToken = access;
    refreshToken = refresh;
  }
}

function persistTokens() {
  if (accessToken && refreshToken) {
    localStorage.setItem(STORAGE_KEY_ACCESS, accessToken);
    localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
  }
}

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  persistTokens();
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
  localStorage.removeItem(STORAGE_KEY_ACCESS);
  localStorage.removeItem(STORAGE_KEY_REFRESH);
  sessionStorage.removeItem(STORAGE_KEY_ACCESS);
  sessionStorage.removeItem(STORAGE_KEY_REFRESH);
}

loadTokens();

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
    try {
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        accessToken = data.token;
        refreshToken = data.refreshToken;
        persistTokens();
        return api(path, { ...options, _retried: true });
      }
    } catch {
      // Network error during refresh
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
