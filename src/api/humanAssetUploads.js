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

export function createHumanAssetWithImages(formData) {
  return apiFetch("/api/human-assets", {
    method: "POST",
    body: formData,
  });
}

export function addImagesToHumanAsset(humanAssetId, formData) {
  return apiFetch(`/api/human-assets/${humanAssetId}/images`, {
    method: "POST",
    body: formData,
  });
}

export function deleteImagesFromHumanAsset(humanAssetId, imageIds) {
  return apiFetch(`/api/human-assets/${humanAssetId}/images`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageIds }),
  });
}
