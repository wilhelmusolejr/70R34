const API_BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  "";

export function getPostImagesDownloadUrl(postId) {
  return `${API_BASE}/api/posts/${postId}/images/download`;
}
