import { useEffect, useState } from "react";
import {
  addPostImage,
  fetchAvailableImagesForPost,
  removePostImage,
  updatePost,
} from "../api/posts";
import { SafeImage } from "./SafeImage";

const PICKER_LIMIT = 30;

export function PostEditModal({ post, onClose, onUpdate }) {
  const [captionDraft, setCaptionDraft] = useState(post.caption || "");
  const [contextDraft, setContextDraft] = useState(post.context || "");
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [busyImageId, setBusyImageId] = useState("");
  const [error, setError] = useState("");

  const [pickerImages, setPickerImages] = useState([]);
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerTotalPages, setPickerTotalPages] = useState(1);
  const [pickerTotal, setPickerTotal] = useState(0);
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => {
    setCaptionDraft(post.caption || "");
    setContextDraft(post.context || "");
  }, [post._id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setPickerLoading(true);
        const data = await fetchAvailableImagesForPost({
          page: pickerPage,
          limit: PICKER_LIMIT,
        });
        if (cancelled) return;
        setPickerImages(Array.isArray(data?.images) ? data.images : []);
        setPickerTotal(Number(data?.total || 0));
        setPickerTotalPages(Math.max(Number(data?.totalPages || 1), 1));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load images.");
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [pickerPage, post._id]);

  const isDirty =
    captionDraft !== (post.caption || "") ||
    contextDraft !== (post.context || "");

  async function reloadPicker() {
    try {
      setPickerLoading(true);
      const data = await fetchAvailableImagesForPost({
        page: pickerPage,
        limit: PICKER_LIMIT,
      });
      setPickerImages(Array.isArray(data?.images) ? data.images : []);
      setPickerTotal(Number(data?.total || 0));
      const total = Math.max(Number(data?.totalPages || 1), 1);
      setPickerTotalPages(total);
      if (pickerPage > total) setPickerPage(total);
    } finally {
      setPickerLoading(false);
    }
  }

  async function handleSaveMeta() {
    if (!isDirty || isSavingMeta) return;
    try {
      setIsSavingMeta(true);
      setError("");
      const updated = await updatePost(post._id, {
        caption: captionDraft,
        context: contextDraft,
      });
      onUpdate(updated);
    } catch (err) {
      setError(err.message || "Failed to save changes.");
    } finally {
      setIsSavingMeta(false);
    }
  }

  async function handleRemoveImage(imageId) {
    if (busyImageId) return;
    if (
      !window.confirm(
        "Remove this image from the post? The image goes back to the available pool.",
      )
    ) {
      return;
    }
    try {
      setBusyImageId(imageId);
      setError("");
      const updated = await removePostImage(post._id, imageId);
      onUpdate(updated);
      await reloadPicker();
    } catch (err) {
      setError(err.message || "Failed to remove image.");
    } finally {
      setBusyImageId("");
    }
  }

  async function handleAddImage(image) {
    if (busyImageId) return;
    try {
      setBusyImageId(image._id);
      setError("");
      const updated = await addPostImage(post._id, image._id);
      onUpdate(updated);
      await reloadPicker();
    } catch (err) {
      setError(err.message || "Failed to add image.");
    } finally {
      setBusyImageId("");
    }
  }

  const currentImages = Array.isArray(post.images) ? post.images : [];

  return (
    <div className="npm-backdrop" onClick={onClose}>
      <div
        className="npm-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="npm-header">
          <div>
            <div className="npm-kicker">Post</div>
            <h2 className="npm-title">
              Edit post · {currentImages.length} image
              {currentImages.length === 1 ? "" : "s"}
            </h2>
          </div>
          <button
            className="npm-close"
            type="button"
            onClick={onClose}
          >
            x
          </button>
        </div>

        <div className="npm-body">
          {error ? (
            <div
              style={{
                background: "rgba(220,38,38,0.08)",
                color: "#dc2626",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                }}
              >
                Context
              </label>
              <textarea
                className="fsearch"
                value={contextDraft}
                onChange={(e) => setContextDraft(e.target.value)}
                placeholder="Short rationale — why these images go together"
                rows={2}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                }}
              >
                Caption
              </label>
              <textarea
                className="fsearch"
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                placeholder="Facebook caption from the persona's voice"
                rows={4}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-p"
                onClick={handleSaveMeta}
                disabled={!isDirty || isSavingMeta}
              >
                {isSavingMeta ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          <div className="post-edit-section-title">
            Current images ({currentImages.length})
          </div>
          {currentImages.length ? (
            <div className="post-edit-grid">
              {currentImages.map((image) => {
                const filename =
                  typeof image === "object" ? image?.filename : "";
                const id =
                  typeof image === "object"
                    ? String(image?._id || image?.id || "")
                    : String(image);
                return (
                  <div className="post-edit-tile" key={id}>
                    <SafeImage
                      src={filename || ""}
                      alt={
                        (typeof image === "object" && image.altText) ||
                        "Post image"
                      }
                      className="post-edit-tile-img"
                    />
                    <button
                      type="button"
                      className="post-edit-tile-remove"
                      onClick={() => handleRemoveImage(id)}
                      disabled={busyImageId === id}
                      title="Remove from post"
                      aria-label="Remove image from post"
                    >
                      {busyImageId === id ? "..." : "x"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="muted"
              style={{ fontSize: 13, padding: "8px 0 16px" }}
            >
              No images in this post.
            </div>
          )}

          <div
            className="post-edit-section-title"
            style={{ marginTop: 18 }}
          >
            Add images
            <span
              style={{
                fontWeight: 400,
                color: "var(--text2)",
                marginLeft: 8,
                fontSize: 12,
              }}
            >
              {pickerTotal} available
            </span>
          </div>
          {pickerLoading ? (
            <div className="muted" style={{ fontSize: 13, padding: "8px 0" }}>
              Loading available images...
            </div>
          ) : pickerImages.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, padding: "8px 0" }}>
              No unclaimed post images available.
            </div>
          ) : (
            <>
              <div className="post-edit-grid">
                {pickerImages.map((image) => (
                  <button
                    key={image._id}
                    type="button"
                    className="post-edit-tile post-edit-tile-add"
                    onClick={() => handleAddImage(image)}
                    disabled={busyImageId === image._id}
                    title={image.altText || "Add to post"}
                  >
                    <SafeImage
                      src={image.filename}
                      alt={image.altText || "Available image"}
                      className="post-edit-tile-img"
                    />
                    <span className="post-edit-tile-overlay">
                      {busyImageId === image._id ? "Adding..." : "+ Add"}
                    </span>
                  </button>
                ))}
              </div>
              {pickerTotalPages > 1 ? (
                <div className="post-edit-pager">
                  <button
                    type="button"
                    className="btn-s"
                    onClick={() => setPickerPage((p) => Math.max(1, p - 1))}
                    disabled={pickerPage <= 1 || pickerLoading}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>
                    Page {pickerPage} of {pickerTotalPages}
                  </span>
                  <button
                    type="button"
                    className="btn-s"
                    onClick={() =>
                      setPickerPage((p) => Math.min(pickerTotalPages, p + 1))
                    }
                    disabled={pickerPage >= pickerTotalPages || pickerLoading}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
