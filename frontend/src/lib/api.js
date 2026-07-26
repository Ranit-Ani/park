// ─── API client ──────────────────────────────────────────────────
// Mirrors the original vanilla apiRequest() from js/app.js exactly:
// same base URL, same auth header, same 401 handling.

export const API_BASE = '/api';

// sessionStorage (not localStorage) is used deliberately here: it is scoped
// to a single browser tab. Opening the site in a brand new tab always starts
// with an empty session, so the user has to log in again there — even
// though they're already logged in on another tab of the same browser.
export function getToken() {
  return sessionStorage.getItem('agp_token');
}

export function getUser() {
  try {
    return JSON.parse(sessionStorage.getItem('agp_user') || 'null');
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  sessionStorage.setItem('agp_token', token);
  sessionStorage.setItem('agp_user', JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem('agp_token');
  sessionStorage.removeItem('agp_user');
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