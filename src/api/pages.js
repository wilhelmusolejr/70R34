const API_BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  "";

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);

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

  return response.json();
}

export function fetchPages() {
  return apiFetch("/api/pages");
}

export function fetchPage(pageId) {
  return apiFetch(`/api/pages/${pageId}`);
}

export function createPage(formData) {
  return apiFetch("/api/pages", {
    method: "POST",
    body: formData,
  });
}

export function addPagePost(pageId, formData) {
  return apiFetch(`/api/pages/${pageId}/posts`, {
    method: "POST",
    body: formData,
  });
}

export function updatePage(pageId, payload) {
  return apiFetch(`/api/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
