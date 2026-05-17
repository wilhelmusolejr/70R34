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
        // ignore
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

export function fetchPosts() {
  return apiFetch("/api/posts").then((data) =>
    Array.isArray(data) ? data : [],
  );
}

export function assignPostToProfile(postId, profileId) {
  return apiFetch(`/api/posts/${postId}/assign`, {
    method: "POST",
    body: JSON.stringify({ profileId }),
  });
}

export function unassignPost(postId) {
  return apiFetch(`/api/posts/${postId}/assign`, {
    method: "DELETE",
  });
}

export function autoAssignPost(postId) {
  return apiFetch(`/api/posts/${postId}/auto-assign`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function autoAssignAllPosts() {
  return apiFetch(`/api/posts/auto-assign-all`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
