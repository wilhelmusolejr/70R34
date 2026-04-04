const API_BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  "";

export function getProfileImagesDownloadUrl(profileId) {
  return `${API_BASE}/api/profiles/${profileId}/images/download`;
}
