/* global process */
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");

export function withPublicImageUrl(filename) {
  const value = String(filename || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (!PUBLIC_BASE_URL) return value;
  return `${PUBLIC_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

export function mapImageDoc(image) {
  if (!image || typeof image !== "object") return image;
  return {
    ...image,
    filename: withPublicImageUrl(image.filename),
  };
}
