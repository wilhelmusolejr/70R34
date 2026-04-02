const API_BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  "";

async function authFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

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

  return response.json();
}

export function registerAccount(payload) {
  return authFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginAccount(payload) {
  return authFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAssignmentStatus(userId, profileId, assignmentStatus) {
  return authFetch(`/api/auth/users/${userId}/profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify({ assignmentStatus }),
  });
}
