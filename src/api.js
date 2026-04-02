const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Profiles ──────────────────────────────────────────────────
export function getProfiles(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/profiles${qs ? `?${qs}` : ""}`);
}

export function getProfile(id) {
  return request(`/api/profiles/${id}`);
}

export function createProfile(data) {
  return request("/api/profiles", { method: "POST", body: JSON.stringify(data) });
}

export function createProfilesBulk(data) {
  return request("/api/profiles/bulk", { method: "POST", body: JSON.stringify(data) });
}

export function updateProfile(id, data) {
  return request(`/api/profiles/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function patchProfile(id, data) {
  return request(`/api/profiles/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteProfile(id) {
  return request(`/api/profiles/${id}`, { method: "DELETE" });
}
