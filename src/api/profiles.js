const API_BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  "";

async function apiFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    throw new Error("Unable to reach the server. Check your connection.");
  }

  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = await response.json();
      message = body.message || message;
    } catch {
      try {
        const text = await response.text();
        message = text || message;
      } catch {
        // ignore parse failures
      }
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function fetchProfiles() {
  return apiFetch("/api/profiles");
}

export function fetchProfile(id) {
  return apiFetch(`/api/profiles/${id}`);
}

export function updateProfile(id, payload) {
  return apiFetch(`/api/profiles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function createProfile(payload, userId) {
  return apiFetch("/api/profiles", {
    method: "POST",
    body: JSON.stringify({ ...payload, userId }),
  });
}

export function bulkCreateProfiles(profilesArray, userId) {
  return apiFetch("/api/profiles/bulk", {
    method: "POST",
    body: JSON.stringify({ profiles: profilesArray, userId }),
  });
}

export function deleteProfile(id) {
  return apiFetch(`/api/profiles/${id}`, {
    method: "DELETE",
  });
}

export function unassignProfileImage(id, imageId) {
  return apiFetch(`/api/profiles/${id}/images/${imageId}`, {
    method: "DELETE",
  });
}
