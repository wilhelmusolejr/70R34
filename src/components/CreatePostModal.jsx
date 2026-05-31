import { useEffect, useMemo, useState } from "react";
import { createPost } from "../api/posts";
import { fetchHumanAssets } from "../api/humanAssets";
import { SafeImage } from "./SafeImage";

function formatAssetName(asset) {
  const name = String(asset?.name || "").trim();
  if (!name) return `Asset ${String(asset?.id || asset?._id || "")}`;
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getImageId(image) {
  return String(image?._id || image?.id || "");
}

export function CreatePostModal({ profiles, onClose, onCreated }) {
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState("");
  const [selectedImageIds, setSelectedImageIds] = useState(() => new Set());
  const [caption, setCaption] = useState("");
  const [context, setContext] = useState("");
  const [profileQuery, setProfileQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setAssetsLoading(true);
        setAssetsError("");
        const data = await fetchHumanAssets();
        if (cancelled) return;
        setAssets(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setAssetsError(err.message || "Failed to load assets.");
      } finally {
        if (!cancelled) setAssetsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleAssets = useMemo(() => {
    return assets
      .map((asset) => {
        const images = Array.isArray(asset.images) ? asset.images : [];
        const available = images.filter((img) => !img.postId);
        return { asset, images: available };
      })
      .filter((entry) => entry.images.length > 0);
  }, [assets]);

  const profileOptions = useMemo(() => {
    return profiles
      .map((profile) => ({
        id: String(profile._id || profile.id || ""),
        label:
          [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
          `Profile #${profile._id}`,
      }))
      .filter((opt) => opt.id && opt.label)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [profiles]);

  const matchedProfile = useMemo(() => {
    const q = profileQuery.trim();
    if (!q) return null;
    return profileOptions.find((opt) => opt.label === q) || null;
  }, [profileQuery, profileOptions]);

  function toggleImage(imageId) {
    setSelectedImageIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitError("");
    if (selectedImageIds.size === 0) {
      setSubmitError("Pick at least one image.");
      return;
    }
    try {
      setSubmitting(true);
      const created = await createPost({
        images: Array.from(selectedImageIds),
        caption: caption.trim(),
        context: context.trim(),
        profileId: matchedProfile?.id || "",
      });
      onCreated?.(created);
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Failed to create post.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="npm-backdrop"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="npm-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(1180px, 100%)" }}
      >
        <div className="npm-header">
          <div>
            <div className="npm-kicker">Post</div>
            <h2 className="npm-title">Create post</h2>
          </div>
          <button
            type="button"
            className="npm-close"
            onClick={onClose}
            disabled={submitting}
          >
            x
          </button>
        </div>

        <div className="npm-body">
          <div className="cpm-split">
            <div className="cpm-split-images">
              <div
                style={{
                  marginBottom: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Images · {selectedImageIds.size} selected
              </div>

              {assetsLoading ? (
                <div className="dashboard-chart-empty">Loading assets…</div>
              ) : assetsError ? (
                <div className="npm-submit-error">{assetsError}</div>
              ) : visibleAssets.length === 0 ? (
                <div className="dashboard-chart-empty">
                  No available images. Every image is either missing or already
                  assigned to another post.
                </div>
              ) : (
                <div className="cpm-asset-list">
                  {visibleAssets.map(({ asset, images }) => {
                    const assetId = String(asset.id || asset._id || "");
                    const selectedInAsset = images.filter((img) =>
                      selectedImageIds.has(getImageId(img)),
                    ).length;
                    return (
                      <div key={assetId} className="cpm-asset">
                        <div className="cpm-asset-head">
                          <span className="cpm-asset-name">
                            {formatAssetName(asset)}
                          </span>
                          <span className="cpm-asset-meta">
                            {selectedInAsset > 0
                              ? `${selectedInAsset} selected · `
                              : ""}
                            {images.length} image
                            {images.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="cpm-image-grid">
                          {images.map((image) => {
                            const imageId = getImageId(image);
                            const checked = selectedImageIds.has(imageId);
                            return (
                              <label
                                key={imageId}
                                className={`cpm-image${checked ? " is-checked" : ""}`}
                                title={image.altText || image.filename}
                              >
                                <input
                                  type="checkbox"
                                  className="cpm-image-checkbox"
                                  checked={checked}
                                  onChange={() => toggleImage(imageId)}
                                />
                                <SafeImage
                                  src={image.filename}
                                  alt={image.altText || ""}
                                  className="create-post-image-img"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="cpm-split-fields">
              <label className="npm-field">
                <span className="npm-label">Context</span>
                <textarea
                  className="npm-input npm-textarea"
                  rows={3}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="What is this post about? (internal note)"
                  disabled={submitting}
                />
              </label>

              <label className="npm-field">
                <span className="npm-label">Caption</span>
                <textarea
                  className="npm-input npm-textarea"
                  rows={6}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Text shown on the Facebook post"
                  disabled={submitting}
                />
              </label>

              <label className="npm-field">
                <span className="npm-label">
                  Owner profile{" "}
                  <span style={{ color: "var(--text2)", fontWeight: 400 }}>
                    (optional)
                  </span>
                </span>
                <input
                  type="text"
                  list="create-post-profile-options"
                  className="npm-input"
                  value={profileQuery}
                  onChange={(e) => setProfileQuery(e.target.value)}
                  placeholder={
                    profileOptions.length
                      ? "Start typing a profile name…"
                      : "No profiles available"
                  }
                  disabled={submitting}
                />
                <datalist id="create-post-profile-options">
                  {profileOptions.map((opt) => (
                    <option key={opt.id} value={opt.label} />
                  ))}
                </datalist>
                {profileQuery.trim() && !matchedProfile ? (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text2)",
                      marginTop: 4,
                    }}
                  >
                    No match — leave blank to create unassigned, or pick from
                    the suggestions.
                  </span>
                ) : null}
              </label>

              {submitError ? (
                <div className="npm-submit-error" style={{ marginTop: 8 }}>
                  {submitError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="npm-footer">
            <button
              type="button"
              className="btn-s"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <div className="npm-footer-actions">
              <button
                type="button"
                className="btn-p"
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  selectedImageIds.size === 0 ||
                  Boolean(profileQuery.trim() && !matchedProfile)
                }
              >
                {submitting
                  ? "Creating…"
                  : `Create post (${selectedImageIds.size} image${selectedImageIds.size === 1 ? "" : "s"})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
