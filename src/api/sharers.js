const API_BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  "";

async function apiFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
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

export function fetchSharers(params = {}) {
  const search = new URLSearchParams();
  if (params.country) search.set("country", params.country);
  if (params.type) search.set("type", params.type);
  if (params.status) search.set("status", params.status);
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.skip != null) search.set("skip", String(params.skip));

  const qs = search.toString();
  const path = qs ? `/api/sharers?${qs}` : "/api/sharers";

  return apiFetch(path).then((data) => (Array.isArray(data) ? data : []));
}

export function createSharer(payload) {
  return apiFetch("/api/sharers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
}

export function updateSharer(sharerId, payload) {
  return apiFetch(`/api/sharers/${sharerId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
}

export function deleteSharer(sharerId) {
  return apiFetch(`/api/sharers/${sharerId}`, {
    method: "DELETE",
  });
}
