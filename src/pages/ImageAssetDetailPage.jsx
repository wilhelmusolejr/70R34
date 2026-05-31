import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { assignImageToProfile } from "../api/imageAssignments";
import { getHumanAssetImagesDownloadUrl } from "../api/imageDownloads";
import { fetchHumanAsset, updateHumanAssetImage } from "../api/humanAssets";
import { createImageAnnotation } from "../api/imageAnnotations";
import {
  addImagesToHumanAsset,
  deleteImagesFromHumanAsset,
} from "../api/humanAssetUploads";
import { fetchProfiles } from "../api/profiles";
import { SafeImage } from "../components/SafeImage";
import { useAuth } from "../context/AuthContext";
import "../App.css";

function EmptyState({ title, description }) {
  return (
    <div className="empty-st">
      <div className="et">{title}</div>
      <div className="ed">{description}</div>
    </div>
  );
}

function getAnnotationColor(label) {
  const palettes = [
    {
      border: "#ff6b35",
      fill: "rgba(255, 107, 53, 0.12)",
      shadow: "rgba(255, 107, 53, 0.18)",
    },
    {
      border: "#0f9d58",
      fill: "rgba(15, 157, 88, 0.12)",
      shadow: "rgba(15, 157, 88, 0.18)",
    },
    {
      border: "#1a73e8",
      fill: "rgba(26, 115, 232, 0.12)",
      shadow: "rgba(26, 115, 232, 0.18)",
    },
    {
      border: "#c058ff",
      fill: "rgba(192, 88, 255, 0.12)",
      shadow: "rgba(192, 88, 255, 0.18)",
    },
    {
      border: "#d97706",
      fill: "rgba(217, 119, 6, 0.12)",
      shadow: "rgba(217, 119, 6, 0.18)",
    },
    {
      border: "#dc2626",
      fill: "rgba(220, 38, 38, 0.12)",
      shadow: "rgba(220, 38, 38, 0.18)",
    },
    {
      border: "#0891b2",
      fill: "rgba(8, 145, 178, 0.12)",
      shadow: "rgba(8, 145, 178, 0.18)",
    },
  ];

  const key = String(label || "")
    .trim()
    .toLowerCase();
  const hash = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

function getImageTags(image) {
  const tags = [];

  if (Array.isArray(image?.tags)) {
    for (const tag of image.tags) {
      if (tag) tags.push(String(tag));
    }
  }
  if (image?.sourceType) {
    tags.push(String(image.sourceType));
  }
  if (image?.aiGenerated) {
    tags.push("ai");
  }
  if (image?.generationModel) {
    tags.push(String(image.generationModel));
  }

  return tags;
}

function toCapitalizedWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function ImageAssetDetailPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
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
  const [assignProfileName, setAssignProfileName] = useState("");
  const [draftBox, setDraftBox] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [isAssigningImage, setIsAssigningImage] = useState(false);
  const [isAddImagesOpen, setIsAddImagesOpen] = useState(false);
  const [isAddingImages, setIsAddingImages] = useState(false);
  const [addImagesError, setAddImagesError] = useState("");
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedImageIdsForDelete, setSelectedImageIdsForDelete] = useState([]);
  const [isDeletingImages, setIsDeletingImages] = useState(false);
  const [deleteImagesError, setDeleteImagesError] = useState("");
  const [guardMessage, setGuardMessage] = useState("");
  const [showProfileAssignmentList, setShowProfileAssignmentList] =
    useState(false);
  const [imageModalTab, setImageModalTab] = useState("assign");
  const [addImageTab, setAddImageTab] = useState("image");
  const [showAssignImageForm, setShowAssignImageForm] = useState(false);
  const [imageEditForm, setImageEditForm] = useState({
    altText: "",
    originalCaption: "",
    tags: [],
    sourceType: "scraped",
    aiGenerated: false,
    generationModel: "",
  });
  const [imageTagDraft, setImageTagDraft] = useState("");
  const [savingImageEdit, setSavingImageEdit] = useState(false);
  const [imageEditError, setImageEditError] = useState("");
  const [imageEditSavedAt, setImageEditSavedAt] = useState(0);
  const [addImagesForm, setAddImagesForm] = useState({
    imageAnnotation: "",
    imageSourceType: "scraped",
    aiGenerated: false,
    generationModel: "",
    files: [],
    batchImageType: "post",
    numberProfileUsing: [],
  });
  const previewRef = useRef(null);
  const selectedImageId = selectedImage?._id || null;
  const selectedImageFilename = selectedImage?.filename || "";

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
    setAnnotationsByImage(asset?.annotationsByImage || {});
  }, [asset]);

  useEffect(() => {
    const assetName = String(asset?.name || "").trim();
    document.title = assetName ? `${assetName} | 70R34` : "IMAGE ASSET | 70R34";
  }, [asset?.name]);

  useEffect(() => {
    setAnnotationMode(false);
    setDraftBox(null);
    setPendingAnnotation(null);
    setSelectedProfileName("");
    setAssignProfileName("");
    setShowAssignImageForm(false);
    setSaveError("");
    setAssignError("");
    setImageModalTab("assign");
    setImageEditForm({
      altText: selectedImage?.altText || "",
      originalCaption: selectedImage?.originalCaption || "",
      tags: Array.isArray(selectedImage?.tags) ? [...selectedImage.tags] : [],
      sourceType: selectedImage?.sourceType || "scraped",
      aiGenerated: Boolean(selectedImage?.aiGenerated),
      generationModel: selectedImage?.generationModel || "",
    });
    setImageTagDraft("");
    setImageEditError("");
    setImageEditSavedAt(0);
  }, [selectedImage]);

  function addImageEditTag(rawTag) {
    const value = String(rawTag || "").trim();
    if (!value) return;
    setImageEditForm((current) => {
      const exists = current.tags.some(
        (tag) => tag.toLowerCase() === value.toLowerCase(),
      );
      return exists ? current : { ...current, tags: [...current.tags, value] };
    });
    setImageTagDraft("");
  }

  function removeImageEditTag(tagToRemove) {
    setImageEditForm((current) => ({
      ...current,
      tags: current.tags.filter((tag) => tag !== tagToRemove),
    }));
  }

  function handleImageEditTagKeyDown(event) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addImageEditTag(imageTagDraft);
    } else if (
      event.key === "Backspace" &&
      !imageTagDraft &&
      imageEditForm.tags.length
    ) {
      removeImageEditTag(imageEditForm.tags[imageEditForm.tags.length - 1]);
    }
  }

  async function handleSaveImageEdit(event) {
    event?.preventDefault?.();
    if (!ensureAdminAccess()) return;
    if (!asset?.id || !selectedImage?._id) {
      setImageEditError("No image selected.");
      return;
    }
    try {
      setSavingImageEdit(true);
      setImageEditError("");
      const trailing = imageTagDraft.trim();
      const tags = trailing
        ? [...imageEditForm.tags, trailing].filter(
            (tag, index, arr) =>
              arr.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) ===
              index,
          )
        : imageEditForm.tags;
      await updateHumanAssetImage(asset.id, selectedImage._id, {
        altText: imageEditForm.altText,
        originalCaption: imageEditForm.originalCaption,
        tags,
        sourceType: imageEditForm.sourceType,
        aiGenerated: imageEditForm.aiGenerated,
        generationModel: imageEditForm.generationModel,
      });
      const nextAsset = await fetchHumanAsset(id);
      setAsset(nextAsset);
      const nextImage =
        nextAsset?.images?.find((img) => img._id === selectedImage._id) || null;
      setSelectedImage(nextImage);
      setImageEditSavedAt(Date.now());
    } catch (err) {
      setImageEditError(err.message || "Failed to save image changes.");
    } finally {
      setSavingImageEdit(false);
    }
  }

  useEffect(
    () => () => {
      addImagesForm.files.forEach((entry) => {
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      });
    },
    [addImagesForm.files],
  );

  function resetAddImagesForm() {
    setAddImagesForm({
      imageAnnotation: "",
      imageSourceType: "scraped",
      aiGenerated: false,
      generationModel: "",
      files: [],
      batchImageType: "post",
      numberProfileUsing: [],
    });
    setShowProfileAssignmentList(false);
    setAddImagesError("");
    setAddImageTab("image");
  }

  function ensureAdminAccess() {
    if (isAdmin) {
      return true;
    }

    setGuardMessage(
      currentUser
        ? "Only admin accounts can change this human asset."
        : "You need to log in as an admin to change this human asset.",
    );
    return false;
  }

  function toggleDeleteSelection(imageId) {
    setSelectedImageIdsForDelete((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId],
    );
  }

  async function handleDeleteSelectedImages() {
    if (!ensureAdminAccess()) {
      return;
    }

    if (!selectedImageIdsForDelete.length) {
      setDeleteImagesError("Select at least one image to delete.");
      return;
    }

    try {
      setIsDeletingImages(true);
      setDeleteImagesError("");
      const nextAsset = await deleteImagesFromHumanAsset(
        asset.id,
        selectedImageIdsForDelete,
      );
      setAsset(nextAsset);
      setAnnotationsByImage(nextAsset.annotationsByImage || {});
      setSelectedImage(null);
      setIsDeleteMode(false);
      setSelectedImageIdsForDelete([]);
    } catch (error) {
      setDeleteImagesError(error.message || "Failed to delete images.");
    } finally {
      setIsDeletingImages(false);
    }
  }

  function setSelectedFiles(fileList) {
    setAddImagesForm((current) => ({
      ...current,
      files: fileList.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        checked: false,
        type: "post",
      })),
    }));
  }

  function applyBatchTypeToChecked() {
    setAddImagesForm((current) => ({
      ...current,
      files: current.files.map((entry) =>
        entry.checked ? { ...entry, type: current.batchImageType } : entry,
      ),
    }));
  }

  async function handleAddImages(event) {
    event.preventDefault();

    if (!ensureAdminAccess()) {
      return;
    }

    if (!addImagesForm.files.length) {
      setAddImagesError("Add at least one image file.");
      return;
    }

    try {
      setIsAddingImages(true);
      setAddImagesError("");

      const formData = new FormData();
      formData.append("imageAnnotation", addImagesForm.imageAnnotation.trim());
      formData.append("imageSourceType", addImagesForm.imageSourceType);
      formData.append("aiGenerated", String(addImagesForm.aiGenerated));
      formData.append("generationModel", addImagesForm.generationModel.trim());
      addImagesForm.numberProfileUsing.forEach((profileId) => {
        formData.append("numberProfileUsing", profileId);
      });
      formData.append(
        "imageTypes",
        JSON.stringify(addImagesForm.files.map((entry) => entry.type || "post")),
      );
      addImagesForm.files.forEach((entry) => {
        formData.append("images", entry.file);
      });

      const nextAsset = await addImagesToHumanAsset(asset.id, formData);
      setAsset(nextAsset);
      setAnnotationsByImage(nextAsset.annotationsByImage || {});
      setIsAddImagesOpen(false);
      resetAddImagesForm();
    } catch (error) {
      setAddImagesError(error.message || "Failed to add images.");
    } finally {
      setIsAddingImages(false);
    }
  }

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
          description={
            assetError || "The asset you are trying to view does not exist."
          }
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
      id: `${selectedImage._id}-${Date.now()}`,
      imageId: selectedImage._id,
      imageFilename: selectedImage.filename,
      x,
      y,
      width,
      height,
    });
  }

  async function savePendingAnnotation() {
    if (!ensureAdminAccess()) {
      return;
    }

    const selectedProfile = profiles.find(
      (profile) =>
        [profile.firstName, profile.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() === selectedProfileName.trim(),
    );

    if (!pendingAnnotation || !selectedProfile) return;

    try {
      setIsSavingAnnotation(true);
      setSaveError("");

      const nextAsset = await createImageAnnotation(asset.id, {
        imageId: pendingAnnotation.imageId,
        profileId: selectedProfile._id,
        label: selectedProfileName.trim(),
        x: pendingAnnotation.x,
        y: pendingAnnotation.y,
        width: pendingAnnotation.width,
        height: pendingAnnotation.height,
      });

      setAsset(nextAsset);
      setAnnotationsByImage(nextAsset.annotationsByImage || {});
      setSelectedImage(
        nextAsset.images.find(
          (image) => image._id === pendingAnnotation.imageId,
        ) || null,
      );
      setPendingAnnotation(null);
      setSelectedProfileName("");
    } catch (error) {
      setSaveError(error.message || "Failed to save annotation.");
    } finally {
      setIsSavingAnnotation(false);
    }
  }

  async function handleAssignImage() {
    if (!ensureAdminAccess()) {
      return;
    }

    const selectedProfile = profiles.find(
      (profile) =>
        [profile.firstName, profile.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() === assignProfileName.trim(),
    );

    if (!selectedImage || !selectedProfile) return;

    try {
      setIsAssigningImage(true);
      setAssignError("");

      const nextAsset = await assignImageToProfile(asset.id, {
        imageId: selectedImage._id,
        profileId: selectedProfile._id,
      });

      setAsset(nextAsset);
      setAnnotationsByImage(nextAsset.annotationsByImage || {});
      setSelectedImage(
        nextAsset.images.find((image) => image._id === selectedImage._id) ||
          null,
      );
      setAssignProfileName("");
    } catch (error) {
      setAssignError(error.message || "Failed to assign image.");
    } finally {
      setIsAssigningImage(false);
    }
  }

  function deleteAnnotation(annotationId) {
    if (!ensureAdminAccess()) {
      return;
    }

    if (!selectedImage) return;

    setAnnotationsByImage((current) => ({
      ...current,
      [selectedImageFilename]: (current[selectedImageFilename] || []).filter(
        (annotation) => annotation.id !== annotationId,
      ),
    }));
  }

  const selectedAnnotations = selectedImage
    ? annotationsByImage[selectedImageFilename] || []
    : [];
  const profileOptions = profiles
    .map((profile) =>
      [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim(),
    )
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) === index)
    .sort((a, b) => a.localeCompare(b));
  const assignableProfiles = profiles.filter(
    (profile) =>
      !Array.isArray(profile.images) || profile.images.length === 0,
  );
  const draftStyle = annotationMode
    ? draftBox
      ? {
          left: `${Math.min(draftBox.startX, draftBox.endX) * 100}%`,
          top: `${Math.min(draftBox.startY, draftBox.endY) * 100}%`,
          width: `${Math.abs(draftBox.endX - draftBox.startX) * 100}%`,
          height: `${Math.abs(draftBox.endY - draftBox.startY) * 100}%`,
        }
      : pendingAnnotation?.imageId === selectedImageId
        ? {
            left: `${pendingAnnotation.x * 100}%`,
            top: `${pendingAnnotation.y * 100}%`,
            width: `${pendingAnnotation.width * 100}%`,
            height: `${pendingAnnotation.height * 100}%`,
          }
        : null
    : null;
  const isAddAssetImagesBusy = isAddingImages;
  const displayAssetName = toCapitalizedWords(asset?.name);

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
          <h1>{displayAssetName || asset.name}</h1>
          <p>Human asset image gallery backed by live database records.</p>
        </div>
      </div>

      <div className="image-asset-profile">
        <div className="image-asset-basics">
          <div className="sc">
            <div className="slabel">Asset Name</div>
            <div className="image-asset-value">{displayAssetName || asset.name}</div>
          </div>
          <div className="sc">
            <div className="slabel">Images Inside</div>
            <div className="image-asset-value">{asset.images.length}</div>
          </div>
          <div className="sc">
            <div className="slabel">Country</div>
            <div className="image-asset-value">{asset.country || "US"}</div>
          </div>
          <div className="sc">
            <div className="slabel">Profiles Using</div>
            <div className="image-asset-value">{asset.usedBy}</div>
          </div>
        </div>

        <div className="image-asset-link-row">
          <span className="nol">
            Human asset images are stored via linked image documents.
          </span>
        </div>

        <div className="image-asset-detail-layout">
          <div className="image-asset-settings-card">
            <div className="image-asset-card-head">
              <div className="npm-label">Profiles Using This Human Asset</div>
              <span className="image-asset-count-pill">
                {asset.numberProfileUsing?.length || 0}
              </span>
            </div>
            <div className="image-asset-user-list">
              {(asset.numberProfileUsing || []).length ? (
                asset.numberProfileUsing.map((profile) => {
                  const fullName = [profile.firstName, profile.lastName]
                    .filter(Boolean)
                    .join(" ")
                    .trim();

                  return (
                    <div
                      key={`asset-profile-${profile._id}`}
                      className="image-asset-user-item"
                    >
                      <div className="image-asset-user-name">
                        {fullName || `Profile #${profile._id}`}
                      </div>
                      <Link
                        to={`/profile/${profile._id}`}
                        className="image-asset-user-link"
                      >
                        Open Profile
                      </Link>
                    </div>
                  );
                })
              ) : (
                <div className="image-asset-helper">
                  No profiles are using this human asset yet.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="page-section-head image-asset-gallery-head">
              <h2>Gallery</h2>
              <div className="image-asset-gallery-actions image-asset-action-bar">
                <button
                  type="button"
                  className={`image-asset-action-btn ${isDeleteMode ? "is-active is-danger" : "is-danger"}`}
                  onClick={() => {
                    if (!ensureAdminAccess()) {
                      return;
                    }
                    setIsDeleteMode((current) => !current);
                    setSelectedImageIdsForDelete([]);
                    setDeleteImagesError("");
                  }}
                >
                  {isDeleteMode ? "Cancel Delete" : "Delete Images"}
                </button>
                <button
                  type="button"
                  className="image-asset-action-btn is-primary"
                  onClick={() => {
                    if (!ensureAdminAccess()) {
                      return;
                    }
                    resetAddImagesForm();
                    setIsAddImagesOpen(true);
                  }}
                >
                  Add Image
                </button>
                <a
                  href={getHumanAssetImagesDownloadUrl(asset.id)}
                  className="image-asset-action-btn is-secondary"
                >
                  Download ZIP
                </a>
                <span className="image-asset-action-count">
                  {asset.images.length} images
                </span>
              </div>
            </div>

            {isDeleteMode ? (
              <div className="image-asset-helper" style={{ marginBottom: "12px" }}>
                Select the images you want to delete from this human asset.
              </div>
            ) : null}
            {deleteImagesError ? (
              <div className="npm-submit-error" style={{ marginBottom: "12px" }}>
                {deleteImagesError}
              </div>
            ) : null}

            <div className="image-asset-gallery image-asset-gallery-compact">
              {asset.images.map((image, index) => (
                (() => {
                  const imageTags = getImageTags(image);
                  return (
                <div
                  key={`${asset.id}-${image._id}`}
                  className={`image-asset-tile${selectedImageIdsForDelete.includes(image._id) ? " selected" : ""}${isDeleteMode ? " delete-mode" : ""}`}
                  onClick={
                    isDeleteMode ? () => toggleDeleteSelection(image._id) : undefined
                  }
                  role={isDeleteMode ? "button" : undefined}
                  tabIndex={isDeleteMode ? 0 : undefined}
                  onKeyDown={
                    isDeleteMode
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleDeleteSelection(image._id);
                          }
                        }
                      : undefined
                  }
                >
                  {isDeleteMode ? (
                    <label className="image-asset-delete-check">
                      <input
                        type="checkbox"
                        checked={selectedImageIdsForDelete.includes(image._id)}
                        onChange={() => toggleDeleteSelection(image._id)}
                        onClick={(event) => event.stopPropagation()}
                      />
                      <span>Select</span>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="image-asset-preview image-asset-preview-btn"
                    disabled={isDeleteMode}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedImage(image);
                    }}
                  >
                    <SafeImage
                      src={image.filename}
                      alt={`${asset.name} ${index + 1}`}
                      className="image-asset-img"
                    />
                  </button>
                  <div
                    className="image-asset-caption"
                    title={image.altText || `Image ${index + 1}`}
                  >
                    {image.altText || `Image ${index + 1}`}
                  </div>
                  {imageTags.length ? (
                    <div className="image-asset-tag-row">
                      {imageTags.map((tag) => (
                        <span key={`${image._id}-${tag}`} className="image-asset-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                  );
                })()
              ))}
            </div>
            {isDeleteMode ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "14px",
                }}
              >
                <button
                  type="button"
                  className="btn-p"
                  onClick={handleDeleteSelectedImages}
                  disabled={isDeletingImages || !selectedImageIdsForDelete.length}
                >
                  {isDeletingImages ? "Deleting..." : "Delete Selected Images"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {selectedImageFilename ? (
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
                  <SafeImage
                    src={selectedImageFilename}
                    alt={asset.name}
                    className="image-asset-modal-img"
                  />
                  <div className="image-asset-annotation-layer">
                    {selectedAnnotations.map((annotation) => (
                      <div
                        key={annotation.id}
                        className="image-asset-annotation-box"
                        style={{
                          "--annotation-border": getAnnotationColor(
                            annotation.label,
                          ).border,
                          "--annotation-fill": getAnnotationColor(
                            annotation.label,
                          ).fill,
                          "--annotation-shadow": getAnnotationColor(
                            annotation.label,
                          ).shadow,
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
                  <div
                    className="npm-tabs"
                    role="tablist"
                    aria-label="Image modal tabs"
                    style={{
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      padding: 0,
                      marginBottom: 4,
                    }}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={imageModalTab === "assign"}
                      className={`npm-tab ${imageModalTab === "assign" ? "active" : ""}`}
                      onClick={() => setImageModalTab("assign")}
                    >
                      Assign to Profile
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={imageModalTab === "details"}
                      className={`npm-tab ${imageModalTab === "details" ? "active" : ""}`}
                      onClick={() => setImageModalTab("details")}
                    >
                      Image Details
                    </button>
                  </div>

                  {imageModalTab === "assign" ? (
                  <>
                  <div className="image-asset-settings-card">
                    <div className="npm-label">Tools</div>
                    <button
                      type="button"
                      className={annotationMode ? "btn-s" : "btn-p"}
                      onClick={() => {
                        if (!ensureAdminAccess()) {
                          return;
                        }
                        setAnnotationMode((current) => !current);
                        setDraftBox(null);
                      }}
                    >
                      {annotationMode ? "Stop Annotating" : "Annotation Tool"}
                    </button>
                    <button
                      type="button"
                      className="btn-p"
                      onClick={() => {
                        if (!ensureAdminAccess()) {
                          return;
                        }
                        setShowAssignImageForm((current) => !current);
                        setAssignError("");
                      }}
                    >
                      {showAssignImageForm
                        ? "Cancel Assign Image"
                        : "Assign Image To Profile"}
                    </button>
                  </div>

                  {showAssignImageForm ? (
                    <div className="image-asset-settings-card">
                      <div className="image-asset-card-head">
                        <div className="npm-label">Assign Image To Profile</div>
                      </div>
                      <div className="image-asset-helper">
                        Pick a profile to attach this image to. The image will
                        appear in that profile&apos;s image list.
                      </div>
                      <input
                        type="text"
                        list="image-asset-assign-profile-options"
                        className="fsearch image-asset-input"
                        value={assignProfileName}
                        onChange={(e) => setAssignProfileName(e.target.value)}
                        placeholder={
                          profileOptions.length
                            ? "Choose a profile to assign this image"
                            : "No profiles available"
                        }
                      />
                      <datalist id="image-asset-assign-profile-options">
                        {profileOptions.map((profileName) => (
                          <option
                            key={`assign-${profileName}`}
                            value={profileName}
                          />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        className="image-asset-action-btn is-primary"
                        onClick={handleAssignImage}
                        disabled={
                          isAssigningImage ||
                          !selectedImage ||
                          !assignProfileName.trim() ||
                          !profileOptions.includes(assignProfileName.trim())
                        }
                      >
                        {isAssigningImage
                          ? "Assigning..."
                          : "Confirm Assign Image"}
                      </button>
                      {assignError ? (
                        <div
                          className="image-asset-helper"
                          style={{ color: "#b42318" }}
                        >
                          {assignError}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

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
                        className="image-asset-action-btn is-primary"
                        onClick={savePendingAnnotation}
                        disabled={
                          isSavingAnnotation ||
                          !pendingAnnotation ||
                          !selectedProfileName.trim() ||
                          !profileOptions.includes(selectedProfileName.trim())
                        }
                      >
                        {isSavingAnnotation ? "Saving..." : "Save Annotation"}
                      </button>
                      {saveError ? (
                        <div
                          className="image-asset-helper"
                          style={{ color: "#b42318" }}
                        >
                          {saveError}
                        </div>
                      ) : null}
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
                    <div className="image-asset-card-head">
                      <div className="npm-label">
                        Users Have Used This Image
                      </div>
                      <span className="image-asset-count-pill">
                        {
                          (asset.imageUsers?.[selectedImageFilename] || [])
                            .length
                        }
                      </span>
                    </div>
                    <div className="image-asset-user-list">
                      {(asset.imageUsers?.[selectedImageFilename] || [])
                        .length ? (
                        (asset.imageUsers?.[selectedImageFilename] || []).map(
                          (user) => (
                            <div
                              key={`${selectedImageFilename}-${user}`}
                              className="image-asset-user-item"
                            >
                              {user}
                            </div>
                          ),
                        )
                      ) : (
                        <div className="image-asset-helper">
                          No profiles are using this human asset yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="image-asset-settings-card">
                    <div className="image-asset-card-head">
                      <div className="npm-label">Annotations</div>
                      <span className="image-asset-count-pill">
                        {selectedAnnotations.length}
                      </span>
                    </div>
                    <div className="image-asset-user-list">
                      {selectedAnnotations.length ? (
                        selectedAnnotations.map((annotation) => (
                          <div
                            key={`summary-${annotation.id}`}
                            className="image-asset-user-item image-asset-annotation-item"
                          >
                            <span className="image-asset-annotation-meta">
                              <span
                                className="image-asset-annotation-dot"
                                style={{
                                  background: getAnnotationColor(
                                    annotation.label,
                                  ).border,
                                }}
                              />
                              <span>{annotation.label}</span>
                            </span>
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
                  </>
                  ) : (
                  <form
                    className="image-asset-settings-card"
                    onSubmit={handleSaveImageEdit}
                    aria-busy={savingImageEdit}
                  >
                    <div className="image-asset-card-head">
                      <div className="npm-label">Edit Image</div>
                    </div>

                    <label className="npm-field">
                      <span className="npm-label">Alt Text</span>
                      <input
                        className="npm-input"
                        value={imageEditForm.altText}
                        onChange={(e) =>
                          setImageEditForm((current) => ({
                            ...current,
                            altText: e.target.value,
                          }))
                        }
                        placeholder="Describe what's in the image"
                        disabled={savingImageEdit}
                      />
                    </label>

                    <label className="npm-field">
                      <span className="npm-label">Original Caption</span>
                      <textarea
                        className="npm-input npm-textarea"
                        rows={2}
                        value={imageEditForm.originalCaption}
                        onChange={(e) =>
                          setImageEditForm((current) => ({
                            ...current,
                            originalCaption: e.target.value,
                          }))
                        }
                        placeholder="Caption from the source it was downloaded from"
                        disabled={savingImageEdit}
                      />
                    </label>

                    <div className="npm-field">
                      <span className="npm-label">
                        Tags{" "}
                        <span
                          style={{
                            color: "var(--text2)",
                            fontWeight: 400,
                          }}
                        >
                          (pick a suggestion or type your own)
                        </span>
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 6,
                          padding: 6,
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          background: "var(--surface)",
                          color: "var(--text)",
                          minHeight: 36,
                        }}
                      >
                        {imageEditForm.tags.map((tag) => (
                          <span
                            key={`${selectedImageId}-edit-${tag}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 8px",
                              background: "var(--surface2)",
                              border: "1px solid var(--border)",
                              borderRadius: 999,
                              fontSize: 12,
                              color: "var(--text)",
                            }}
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeImageEditTag(tag)}
                              disabled={savingImageEdit}
                              style={{
                                border: "none",
                                background: "transparent",
                                cursor: "pointer",
                                padding: 0,
                                fontSize: 14,
                                lineHeight: 1,
                                color: "var(--text2)",
                              }}
                              aria-label={`Remove tag ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          list="image-asset-edit-tag-suggestions"
                          value={imageTagDraft}
                          onChange={(e) => setImageTagDraft(e.target.value)}
                          onKeyDown={handleImageEditTagKeyDown}
                          onBlur={() => addImageEditTag(imageTagDraft)}
                          placeholder={
                            imageEditForm.tags.length
                              ? "Add another..."
                              : "profile, cover, post, or anything"
                          }
                          disabled={savingImageEdit}
                          style={{
                            flex: 1,
                            minWidth: 120,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            fontSize: 13,
                            fontFamily: "var(--font)",
                            padding: "2px 4px",
                            color: "var(--text)",
                          }}
                        />
                        <datalist id="image-asset-edit-tag-suggestions">
                          <option value="profile" />
                          <option value="cover" />
                          <option value="post" />
                        </datalist>
                      </div>
                      <div className="image-asset-helper">
                        Press Enter or comma to add. Click × to remove.
                      </div>
                    </div>

                    <label className="npm-field">
                      <span className="npm-label">Source Type</span>
                      <select
                        className="npm-input"
                        value={imageEditForm.sourceType}
                        onChange={(e) =>
                          setImageEditForm((current) => ({
                            ...current,
                            sourceType: e.target.value,
                          }))
                        }
                        disabled={savingImageEdit}
                      >
                        <option value="generated">generated</option>
                        <option value="scraped">scraped</option>
                        <option value="stock">stock</option>
                        <option value="real">real</option>
                      </select>
                    </label>

                    <label
                      className="npm-field"
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={imageEditForm.aiGenerated}
                        onChange={(e) =>
                          setImageEditForm((current) => ({
                            ...current,
                            aiGenerated: e.target.checked,
                          }))
                        }
                        disabled={savingImageEdit}
                      />
                      <span className="npm-label" style={{ margin: 0 }}>
                        AI Generated
                      </span>
                    </label>

                    <label className="npm-field">
                      <span className="npm-label">Generation Model</span>
                      <input
                        className="npm-input"
                        value={imageEditForm.generationModel}
                        onChange={(e) =>
                          setImageEditForm((current) => ({
                            ...current,
                            generationModel: e.target.value,
                          }))
                        }
                        placeholder="stable-diffusion-3, flux, etc."
                        disabled={savingImageEdit}
                      />
                    </label>

                    {imageEditError ? (
                      <div
                        className="image-asset-helper"
                        style={{ color: "var(--red-t)" }}
                      >
                        {imageEditError}
                      </div>
                    ) : null}
                    {imageEditSavedAt ? (
                      <div
                        className="image-asset-helper"
                        style={{ color: "var(--green-t)" }}
                      >
                        Saved.
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      className="image-asset-action-btn is-primary"
                      disabled={savingImageEdit}
                    >
                      {savingImageEdit ? "Saving..." : "Save Changes"}
                    </button>
                  </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {guardMessage ? (
        <div className="npm-backdrop" onClick={() => setGuardMessage("")}>
          <div
            className="npm-modal auth-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Access Restricted</div>
                <h2 className="npm-title">Admin Required</h2>
              </div>
              <button
                className="npm-close"
                type="button"
                onClick={() => setGuardMessage("")}
              >
                x
              </button>
            </div>
            <div className="npm-body">
              <div style={{ color: "var(--text2)", fontSize: "13px" }}>
                {guardMessage}
              </div>
              <div className="npm-footer">
                <div className="npm-footer-actions">
                  <button
                    type="button"
                    className="btn-p"
                    onClick={() => setGuardMessage("")}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isAddImagesOpen ? (
        <div
          className="npm-backdrop"
          onClick={isAddAssetImagesBusy ? undefined : () => setIsAddImagesOpen(false)}
        >
          <div
            className="npm-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(860px, 100%)" }}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Human Asset</div>
                <h2 className="npm-title">Add Images To {asset.name}</h2>
              </div>
              <button
                className="npm-close"
                type="button"
                onClick={() => setIsAddImagesOpen(false)}
                disabled={isAddAssetImagesBusy}
              >
                x
              </button>
            </div>
            <form
              className="npm-body npm-form image-asset-add-modal-body"
              onSubmit={handleAddImages}
              aria-busy={isAddAssetImagesBusy}
            >
              <fieldset className="npm-form-fieldset" disabled={isAddAssetImagesBusy}>
              <div
                className="npm-tabs"
                role="tablist"
                aria-label="Add image tabs"
                style={{
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  padding: 0,
                  marginBottom: 12,
                }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={addImageTab === "image"}
                  className={`npm-tab ${addImageTab === "image" ? "active" : ""}`}
                  onClick={() => setAddImageTab("image")}
                >
                  Image
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={addImageTab === "assign"}
                  className={`npm-tab ${addImageTab === "assign" ? "active" : ""}`}
                  onClick={() => setAddImageTab("assign")}
                >
                  Assign to Profile
                </button>
              </div>
              {addImageTab === "image" ? (
              <div className="npm-grid">
                <label className="npm-field">
                  <span className="npm-label">Image Annotation</span>
                  <input
                    className="npm-input"
                    value={addImagesForm.imageAnnotation}
                    onChange={(e) =>
                      setAddImagesForm((current) => ({
                        ...current,
                        imageAnnotation: e.target.value,
                      }))}
                    placeholder="Optional shared annotation"
                  />
                </label>
                <label className="npm-field">
                  <span className="npm-label">Image Source Type</span>
                  <select
                    className="npm-input"
                    value={addImagesForm.imageSourceType}
                    onChange={(e) =>
                      setAddImagesForm((current) => ({
                        ...current,
                        imageSourceType: e.target.value,
                      }))}
                  >
                    <option value="generated">Generated</option>
                    <option value="scraped">Scraped</option>
                    <option value="stock">Stock</option>
                    <option value="real">Real</option>
                  </select>
                </label>
                <label className="npm-field">
                  <span className="npm-label">Generation Model</span>
                  <input
                    className="npm-input"
                    value={addImagesForm.generationModel}
                    onChange={(e) =>
                      setAddImagesForm((current) => ({
                        ...current,
                        generationModel: e.target.value,
                      }))}
                    placeholder="stable-diffusion-3 or leave blank"
                  />
                </label>
                <div className="npm-field">
                  <span className="npm-label">AI Generated</span>
                  <label className="npm-radio-option">
                    <input
                      type="checkbox"
                      checked={addImagesForm.aiGenerated}
                      onChange={(e) =>
                        setAddImagesForm((current) => ({
                          ...current,
                          aiGenerated: e.target.checked,
                        }))}
                    />
                    This upload is AI generated
                  </label>
                </div>
                <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="npm-label">Image Files</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="npm-input"
                    onChange={(e) =>
                      setSelectedFiles(Array.from(e.target.files || []))}
                  />
                  <span className="image-asset-helper">
                    {addImagesForm.files.length
                      ? `${addImagesForm.files.length} file(s) selected`
                      : "Upload one or more image files."}
                  </span>
                </label>
                {addImagesForm.files.length ? (
                  <div className="npm-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="npm-label">Selected Images</span>
                    <div className="image-upload-batch-bar">
                      <select
                        className="npm-input"
                        value={addImagesForm.batchImageType}
                        onChange={(e) =>
                          setAddImagesForm((current) => ({
                            ...current,
                            batchImageType: e.target.value,
                          }))}
                      >
                        <option value="post">Post</option>
                        <option value="profile">Profile</option>
                        <option value="cover">Cover</option>
                        <option value="document">Document</option>
                      </select>
                      <button
                        type="button"
                        className="image-asset-action-btn is-secondary"
                        onClick={applyBatchTypeToChecked}
                      >
                        Apply Type To Checked
                      </button>
                    </div>
                    <div className="image-upload-file-list">
                      {addImagesForm.files.map((entry, index) => (
                        <div
                          key={`${entry.file.name}-${index}`}
                          className="image-upload-file-item"
                        >
                          <div className="image-upload-preview-frame">
                            <SafeImage
                              src={entry.previewUrl}
                              alt={entry.file.name}
                              className="image-upload-preview-img"
                            />
                          </div>
                          <label className="image-upload-file-check">
                            <input
                              type="checkbox"
                              checked={entry.checked}
                              onChange={(e) =>
                                setAddImagesForm((current) => ({
                                  ...current,
                                  files: current.files.map(
                                    (fileEntry, fileIndex) =>
                                      fileIndex === index
                                        ? {
                                            ...fileEntry,
                                            checked: e.target.checked,
                                          }
                                        : fileEntry,
                                  ),
                                }))}
                            />
                            <span title={entry.file.name}>{entry.file.name}</span>
                          </label>
                          <select
                            className="npm-input"
                            value={entry.type}
                            onChange={(e) =>
                              setAddImagesForm((current) => ({
                                ...current,
                                files: current.files.map(
                                  (fileEntry, fileIndex) =>
                                    fileIndex === index
                                      ? { ...fileEntry, type: e.target.value }
                                      : fileEntry,
                                ),
                              }))}
                          >
                            <option value="post">Post</option>
                            <option value="profile">Profile</option>
                            <option value="cover">Cover</option>
                            <option value="document">Document</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              ) : (
              <div className="npm-grid">
                <div className="npm-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="npm-label">
                    Profiles Using This Human Asset
                  </span>
                  {assignableProfiles.length ? (
                    <>
                      <button
                        type="button"
                        className="image-asset-action-btn is-secondary"
                        onClick={() =>
                          setShowProfileAssignmentList((current) => !current)}
                      >
                        {showProfileAssignmentList
                          ? "Hide Profile Assignment"
                          : "Assign Profiles To This Human Asset"}
                      </button>
                      <div className="image-asset-helper">
                        Only images tagged as `post` will be saved into selected
                        profile image data.
                      </div>
                      {showProfileAssignmentList ? (
                        <div className="image-upload-profile-list">
                          {assignableProfiles.map((profile) => {
                            const fullName = [profile.firstName, profile.lastName]
                              .filter(Boolean)
                              .join(" ")
                              .trim();
                            const isChecked =
                              addImagesForm.numberProfileUsing.includes(
                                profile._id,
                              );

                            return (
                              <label
                                key={profile._id}
                                className="image-upload-profile-option"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) =>
                                    setAddImagesForm((current) => ({
                                      ...current,
                                      numberProfileUsing: e.target.checked
                                        ? [
                                            ...current.numberProfileUsing,
                                            profile._id,
                                          ]
                                        : current.numberProfileUsing.filter(
                                            (entryId) => entryId !== profile._id,
                                          ),
                                    }))}
                                />
                                <span>{fullName || `Profile #${profile._id}`}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="image-asset-helper">
                      No profiles available to pre-assign.
                    </div>
                  )}
                </div>
              </div>
              )}
              {addImagesError ? (
                <div className="npm-submit-error">{addImagesError}</div>
              ) : null}
              <div className="npm-footer">
                <button
                  type="button"
                  className="image-asset-action-btn is-secondary"
                  onClick={() => setIsAddImagesOpen(false)}
                >
                  Cancel
                </button>
                <div className="npm-footer-actions">
                  <button
                    type="submit"
                    className="image-asset-action-btn is-primary"
                    disabled={isAddingImages}
                  >
                    {isAddingImages ? "Adding..." : "Add Images"}
                  </button>
                </div>
              </div>
              </fieldset>
              {isAddAssetImagesBusy ? (
                <div className="npm-loading-overlay">
                  <div className="npm-spinner" />
                  <div className="npm-loading-title">Adding images</div>
                  <div className="npm-loading-copy">
                    We&apos;re uploading the files and updating this human asset now. The modal will unlock when it finishes.
                  </div>
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
