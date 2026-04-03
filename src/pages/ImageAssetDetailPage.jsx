import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchHumanAsset } from "../api/humanAssets";
import { fetchProfiles } from "../api/profiles";
import "../App.css";

function EmptyState({ title, description }) {
  return (
    <div className="empty-st">
      <div className="et">{title}</div>
      <div className="ed">{description}</div>
    </div>
  );
}

export function ImageAssetDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [assetLoading, setAssetLoading] = useState(true);
  const [assetError, setAssetError] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationsByImage, setAnnotationsByImage] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [pendingAnnotation, setPendingAnnotation] = useState(null);
  const [selectedProfileName, setSelectedProfileName] = useState("");
  const [draftBox, setDraftBox] = useState(null);
  const previewRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAsset() {
      try {
        setAssetLoading(true);
        setAssetError("");
        const data = await fetchHumanAsset(id);
        if (!cancelled) {
          setAsset(data);
        }
      } catch (err) {
        if (!cancelled) {
          setAsset(null);
          setAssetError(err.message || "Failed to load human asset.");
        }
      } finally {
        if (!cancelled) {
          setAssetLoading(false);
        }
      }
    }

    loadAsset();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      try {
        const data = await fetchProfiles();
        if (!cancelled) {
          setProfiles(data);
        }
      } catch {
        if (!cancelled) {
          setProfiles([]);
        }
      }
    }

    loadProfiles();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setAnnotationsByImage({});
  }, [asset]);

  useEffect(() => {
    setAnnotationMode(false);
    setDraftBox(null);
    setPendingAnnotation(null);
    setSelectedProfileName("");
  }, [selectedImage]);

  if (assetLoading) {
    return (
      <div className="page">
        <EmptyState
          title="Loading image asset"
          description="Fetching human asset data from the backend..."
        />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="page">
        <button className="back-btn" onClick={() => navigate("/images")}>
          <svg viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to Images
        </button>
        <EmptyState
          title="Image asset not found"
          description={assetError || "The asset you are trying to view does not exist."}
        />
      </div>
    );
  }

  function getRelativePoint(event) {
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds) return null;

    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    return {
      x: Math.min(Math.max(x, 0), 1),
      y: Math.min(Math.max(y, 0), 1),
    };
  }

  function handleAnnotationStart(event) {
    if (!annotationMode || !selectedImage) return;

    const point = getRelativePoint(event);
    if (!point) return;

    setDraftBox({
      startX: point.x,
      startY: point.y,
      endX: point.x,
      endY: point.y,
    });
  }

  function handleAnnotationMove(event) {
    if (!draftBox) return;

    const point = getRelativePoint(event);
    if (!point) return;

    setDraftBox((current) =>
      current
        ? {
            ...current,
            endX: point.x,
            endY: point.y,
          }
        : current,
    );
  }

  function handleAnnotationEnd() {
    if (!draftBox || !selectedImage) return;

    const x = Math.min(draftBox.startX, draftBox.endX);
    const y = Math.min(draftBox.startY, draftBox.endY);
    const width = Math.abs(draftBox.endX - draftBox.startX);
    const height = Math.abs(draftBox.endY - draftBox.startY);

    setDraftBox(null);

    if (width < 0.02 || height < 0.02) {
      return;
    }

    setPendingAnnotation({
      id: `${selectedImage}-${Date.now()}`,
      image: selectedImage,
      x,
      y,
      width,
      height,
    });
  }

  function savePendingAnnotation() {
    if (!pendingAnnotation || !selectedProfileName.trim()) return;

    setAnnotationsByImage((current) => ({
      ...current,
      [pendingAnnotation.image]: [
        ...(current[pendingAnnotation.image] || []),
        {
          ...pendingAnnotation,
          label: selectedProfileName.trim(),
        },
      ],
    }));
    setPendingAnnotation(null);
    setSelectedProfileName("");
  }

  function deleteAnnotation(annotationId) {
    if (!selectedImage) return;

    setAnnotationsByImage((current) => ({
      ...current,
      [selectedImage]: (current[selectedImage] || []).filter(
        (annotation) => annotation.id !== annotationId,
      ),
    }));
  }

  const selectedAnnotations = selectedImage
    ? annotationsByImage[selectedImage] || []
    : [];
  const profileOptions = profiles
    .map((profile) => [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim())
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) === index)
    .sort((a, b) => a.localeCompare(b));
  const draftStyle = annotationMode
    ? draftBox
      ? {
          left: `${Math.min(draftBox.startX, draftBox.endX) * 100}%`,
          top: `${Math.min(draftBox.startY, draftBox.endY) * 100}%`,
          width: `${Math.abs(draftBox.endX - draftBox.startX) * 100}%`,
          height: `${Math.abs(draftBox.endY - draftBox.startY) * 100}%`,
        }
      : pendingAnnotation?.image === selectedImage
        ? {
            left: `${pendingAnnotation.x * 100}%`,
            top: `${pendingAnnotation.y * 100}%`,
            width: `${pendingAnnotation.width * 100}%`,
            height: `${pendingAnnotation.height * 100}%`,
          }
        : null
    : null;

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate("/images")}>
        <svg viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to Images
      </button>

      <div className="page-header">
        <div>
          <h1>{asset.name}</h1>
          <p>Human asset image gallery backed by live database records.</p>
        </div>
      </div>

      <div className="image-asset-profile">
        <div className="image-asset-basics">
          <div className="sc">
            <div className="slabel">Asset Name</div>
            <div className="image-asset-value">{asset.name}</div>
          </div>
          <div className="sc">
            <div className="slabel">Images Inside</div>
            <div className="image-asset-value">{asset.images.length}</div>
          </div>
          <div className="sc">
            <div className="slabel">Possible Profile</div>
            <div className="image-asset-value">{asset.possibleProfiles}</div>
          </div>
          <div className="sc">
            <div className="slabel">Profiles Using</div>
            <div className="image-asset-value">{asset.usedBy}</div>
          </div>
        </div>

        <div className="image-asset-link-row">
          <span className="nol">Human asset images are stored via linked image documents.</span>
        </div>

        <div className="page-section-head">
          <h2>Gallery</h2>
          <span>{asset.images.length} images</span>
        </div>

        <div className="image-asset-gallery">
          {asset.images.map((image, index) => (
            <div key={`${asset.id}-${image._id}`} className="image-asset-tile">
              <button
                type="button"
                className="image-asset-preview image-asset-preview-btn"
                onClick={() => setSelectedImage(image.filename)}
              >
                <img
                  src={image.filename}
                  alt={`${asset.name} ${index + 1}`}
                  className="image-asset-img"
                />
              </button>
              <div className="image-asset-caption">
                {image.annotation || `Image ${index + 1}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedImage ? (
        <div className="npm-backdrop" onClick={() => setSelectedImage(null)}>
          <div
            className="npm-modal image-asset-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Image Asset</div>
                <h2 className="npm-title">{asset.name}</h2>
              </div>
              <button
                className="npm-close"
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                }}
              >
                x
              </button>
            </div>

            <div className="npm-body image-asset-modal-body">
              <div className="image-asset-modal-layout">
                <div
                  ref={previewRef}
                  className={`image-asset-modal-preview${annotationMode ? " annotation-active" : ""}`}
                  onMouseDown={handleAnnotationStart}
                  onMouseMove={handleAnnotationMove}
                  onMouseUp={handleAnnotationEnd}
                  onMouseLeave={() => {
                    if (draftBox) {
                      handleAnnotationEnd();
                    }
                  }}
                >
                  <img
                    src={selectedImage}
                    alt={asset.name}
                    className="image-asset-modal-img"
                  />
                  <div className="image-asset-annotation-layer">
                    {selectedAnnotations.map((annotation) => (
                      <div
                        key={annotation.id}
                        className="image-asset-annotation-box"
                        style={{
                          left: `${annotation.x * 100}%`,
                          top: `${annotation.y * 100}%`,
                          width: `${annotation.width * 100}%`,
                          height: `${annotation.height * 100}%`,
                        }}
                      >
                        <span className="image-asset-annotation-label">
                          {annotation.label}
                        </span>
                      </div>
                    ))}
                    {draftStyle ? (
                      <div
                        className="image-asset-annotation-box draft"
                        style={draftStyle}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="image-asset-modal-settings">
                  <div className="image-asset-settings-card">
                    <div className="npm-label">Tools</div>
                    <button
                      type="button"
                      className={annotationMode ? "btn-s" : "btn-p"}
                      onClick={() => {
                        setAnnotationMode((current) => !current);
                        setDraftBox(null);
                      }}
                    >
                      {annotationMode ? "Stop Annotating" : "Annotation Tool"}
                    </button>
                    <div className="image-asset-helper">
                      {annotationMode
                        ? "Drag on the image to draw a box, then choose a profile name on the right."
                        : "Turn on annotation mode to draw labeled boxes."}
                    </div>
                  </div>

                  {annotationMode ? (
                    <div className="image-asset-settings-card">
                      <div className="npm-label">Profile Name</div>
                      <input
                        type="text"
                        list="image-asset-profile-options"
                        className="fsearch image-asset-input"
                        value={selectedProfileName}
                        onChange={(e) => setSelectedProfileName(e.target.value)}
                        disabled={!pendingAnnotation}
                        placeholder={
                          profileOptions.length
                            ? "Start typing a profile name"
                            : "No profiles available"
                        }
                      />
                      <datalist id="image-asset-profile-options">
                        {profileOptions.map((profileName) => (
                          <option key={profileName} value={profileName} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        className="btn-p"
                        onClick={savePendingAnnotation}
                        disabled={
                          !pendingAnnotation ||
                          !selectedProfileName.trim() ||
                          !profileOptions.includes(selectedProfileName.trim())
                        }
                      >
                        Save Annotation
                      </button>
                      <div className="image-asset-helper">
                        {pendingAnnotation
                          ? "Choose a generated profile identity and save this annotation."
                          : profileOptions.length
                            ? "Draw a box first to attach a profile name."
                            : "No generated profiles were found in the database yet."}
                      </div>
                    </div>
                  ) : null}

                  <div className="image-asset-settings-card">
                    <div className="npm-label">Users Have Used This Image</div>
                    <div className="image-asset-user-list">
                      {(asset.imageUsers?.[selectedImage] || []).length ? (
                        (asset.imageUsers?.[selectedImage] || []).map((user) => (
                          <div
                            key={`${selectedImage}-${user}`}
                            className="image-asset-user-item"
                          >
                            {user}
                          </div>
                        ))
                      ) : (
                        <div className="image-asset-helper">
                          No profiles are using this human asset yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="image-asset-settings-card">
                    <div className="npm-label">Annotations</div>
                    <div className="image-asset-user-list">
                      {selectedAnnotations.length ? (
                        selectedAnnotations.map((annotation) => (
                          <div
                            key={`summary-${annotation.id}`}
                            className="image-asset-user-item image-asset-annotation-item"
                          >
                            <span>{annotation.label}</span>
                            <button
                              type="button"
                              className="image-asset-delete-btn"
                              onClick={() => deleteAnnotation(annotation.id)}
                            >
                              Delete
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="image-asset-helper">
                          No annotations yet for this image.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
