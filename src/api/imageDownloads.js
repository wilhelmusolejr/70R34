const API_BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  "";

export function getHumanAssetImagesDownloadUrl(humanAssetId) {
  return `${API_BASE}/api/human-assets/${humanAssetId}/images/download`;
}
