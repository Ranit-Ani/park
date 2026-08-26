// ─── API client ──────────────────────────────────────────────────
// Mirrors the original vanilla apiRequest() from js/app.js exactly:
// same base URL, same auth header, same 401 handling.
//
// On Render, frontend + backend are served from the same origin, so a
// relative '/api' path works. But when this same frontend is bundled into
// the Capacitor Android app, the app is loaded from `capacitor://localhost`
// (or `https://localhost`) — there is no backend at that origin, so a
// relative path resolves to nowhere and every request fails.
//
// VITE_API_BASE_URL lets a build target an absolute backend URL instead.
// Leave it unset for the normal web build (keeps the relative '/api'
// behavior); set it to your Render URL when building the frontend for the
// Capacitor app. See frontend/.env.production.example.
const API_ROOT = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  : '';

export const API_BASE = API_ROOT + '/api';

// localStorage is used here (not sessionStorage) so the session survives
// closing the tab/browser and reopening it, and is shared across tabs.
// The JWT itself still expires normally on the backend, so this only
// keeps the user logged in for as long as the token is valid.
export function getToken() {
  return localStorage.getItem('agp_token');
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('agp_user') || 'null');
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem('agp_token', token);
  localStorage.setItem('agp_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('agp_token');
  localStorage.removeItem('agp_user');
}

/**
 * downloadFile(endpoint, filename)
 * For binary responses (like PDF receipts) that apiRequest can't handle
 * since it always expects JSON. Fetches with the auth header, then
 * triggers a normal browser file-save via a temporary link.
 */
export async function downloadFile(endpoint, filename) {
  const token = getToken();
  try {
    const res = await fetch(API_BASE + endpoint, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { success: false, message: body?.message || 'Download failed.' };
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (err) {
    console.error('Download:', endpoint, err);
    return { success: false, message: 'Download failed.' };
  }
}
/**
 * apiRequest(endpoint, options)
 * - Automatically attaches JSON content-type + bearer token
 * - Serializes object bodies to JSON
 * - On 401, clears the session (caller is responsible for redirecting)
 * - Never throws: returns null on network/parse failure
 */
export async function apiRequest(endpoint, options = {}, onUnauthorized) {
  const token = getToken();
  const cfg = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers || {}),
    },
  };
  if (cfg.body && typeof cfg.body === 'object') {
    cfg.body = JSON.stringify(cfg.body);
  }
  try {
    const res = await fetch(API_BASE + endpoint, cfg);
    if (res.status === 401) {
      clearSession();
      if (onUnauthorized) onUnauthorized();
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('API:', endpoint, err);
    return null;
  }
}