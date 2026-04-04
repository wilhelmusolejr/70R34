const API_BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  "";

export function getPageImagesDownloadUrl(pageId) {
  return `${API_BASE}/api/pages/${pageId}/images/download`;
}
