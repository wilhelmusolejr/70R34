import { useEffect, useMemo, useState } from "react";
import { fetchProfiles } from "../api/profiles";
import { useNavigate } from "react-router-dom";
import { fetchHumanAssets } from "../api/humanAssets";
import { createHumanAssetWithImages } from "../api/humanAssetUploads";
import "../App.css";

function EmptyState({ title, description }) {
  return (
    <div className="empty-st">
      <div className="et">{title}</div>
      <div className="ed">{description}</div>
    </div>
  );
}

function getHumanAssetPreview(asset) {
  const images = asset?.images || [];
  const preferred =
    images.find(
      (image) =>
        String(image?.type || "")
          .trim()
          .toLowerCase() === "profile",
    ) || images[0];

  return preferred?.filename || "";
}

export function ImagesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showProfileAssignmentList, setShowProfileAssignmentList] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: "",
    numberPossibleProfile: "0",
    numberProfileUsing: [],
    imageAnnotation: "",
    imageSourceType: "scraped",
    aiGenerated: false,
    generationModel: "",
    files: [],
    batchImageType: "post",
  });

  function resetUploadForm() {
    setUploadForm({
      name: "",
      numberPossibleProfile: "0",
      numberProfileUsing: [],
      imageAnnotation: "",
      imageSourceType: "scraped",
      aiGenerated: false,
      generationModel: "",
      files: [],
      batchImageType: "post",
    });
    setShowProfileAssignmentList(false);
    setSubmitError("");
  }

  const availableProfiles = useMemo(
    () => profiles.filter((profile) => !Array.isArray(profile.images) || profile.images.length === 0),
    [profiles],
  );

  function setSelectedFiles(fileList) {
    setUploadForm((current) => ({
      ...current,
      files: fileList.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        checked: false,
        type: "post",
      })),
    }));
  }

  useEffect(() => () => {
    uploadForm.files.forEach((entry) => {
      if (entry.previewUrl) {
        URL.revokeObjectURL(entry.previewUrl);
      }
    });
  }, [uploadForm.files]);

  function applyBatchTypeToChecked() {
    setUploadForm((current) => ({
      ...current,
      files: current.files.map((entry) =>
        entry.checked
          ? { ...entry, type: current.batchImageType }
          : entry,
      ),
    }));
  }

  useEffect(() => {
    let cancelled = false;

    async function loadHumanAssets() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchHumanAssets();
        if (!cancelled) {
          setAssets(data);
        }
      } catch (err) {
        if (!cancelled) {
          setAssets([]);
          setError(err.message || "Failed to load image assets.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHumanAssets();

    return () => {
      cancelled = true;
    };
  }, []);

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

  async function handleCreateHumanAsset(event) {
    event.preventDefault();

    if (!uploadForm.name.trim()) {
      setSubmitError("Human asset name is required.");
      return;
    }

    if (!uploadForm.files.length) {
      setSubmitError("Add at least one image file.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");

      const formData = new FormData();
      formData.append("name", uploadForm.name.trim());
      formData.append("numberPossibleProfile", uploadForm.numberPossibleProfile);
      formData.append("imageAnnotation", uploadForm.imageAnnotation.trim());
      formData.append("imageSourceType", uploadForm.imageSourceType);
      formData.append("aiGenerated", String(uploadForm.aiGenerated));
      formData.append("generationModel", uploadForm.generationModel.trim());
      uploadForm.numberProfileUsing.forEach((profileId) => {
        formData.append("numberProfileUsing", profileId);
      });
      formData.append(
        "imageTypes",
        JSON.stringify(uploadForm.files.map((entry) => entry.type || "post")),
      );
      uploadForm.files.forEach((entry) => {
        formData.append("images", entry.file);
      });

      const createdAsset = await createHumanAssetWithImages(formData);
      setAssets((current) => [createdAsset, ...current]);
      setIsUploadOpen(false);
      resetUploadForm();
    } catch (err) {
      setSubmitError(err.message || "Failed to create human asset.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return assets.filter((asset) => {
      if (!normalizedSearch) return true;

      const imageNames = (asset.images || []).map((image) => image.filename).join(" ");

      return [asset.name, imageNames]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [assets, search]);

  const totalImages = filteredAssets.reduce((sum, asset) => sum + (asset.images?.length || 0), 0);
  const totalPossibleProfiles = filteredAssets.reduce(
    (sum, asset) => sum + asset.possibleProfiles,
    0,
  );
  const totalUses = filteredAssets.reduce((sum, asset) => sum + asset.usedBy, 0);

  if (loading) {
    return (
      <div className="page">
        <div className="empty-st">
          <div className="et">Loading image assets</div>
          <div className="ed">Fetching human asset records from the backend...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Images</h1>
          <p>Image assets connected to real human asset records from the backend.</p>
        </div>
        <button
          type="button"
          className="btn-p"
          onClick={() => {
            resetUploadForm();
            setIsUploadOpen(true);
          }}
        >
          Upload Human Asset
        </button>
      </div>

      <div className="stats-row">
        <div className="sc">
          <div className="snum">{filteredAssets.length}</div>
          <div className="slabel">Human Assets</div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--accent)" }}>
            {totalImages}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--accent)" }} />
            Linked Images
          </div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--amber)" }}>
            {totalPossibleProfiles}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--amber)" }} />
            Possible Profile
          </div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--green)" }}>
            {totalUses}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--green)" }} />
            Profiles Using
          </div>
        </div>
      </div>

      <div className="filters">
        <div className="sw">
          <span className="si">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            className="fsearch"
            placeholder="Search human asset name or image filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="rc">{filteredAssets.length} human assets</span>
      </div>

      {error ? (
        <EmptyState title="Unable to load image assets" description={error} />
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          title="No image assets found"
          description="Try a different search term."
        />
      ) : (
        <div className="twrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Images Inside</th>
                <th>Possible Profile</th>
                <th>Profiles Using</th>
                <th>Visit</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => {
                const previewImage = getHumanAssetPreview(asset);

                return (
                <tr key={asset.id}>
                  <td>
                    <div className="pcell">
                      <div className="av">
                        {previewImage ? (
                          <img
                            src={previewImage}
                            alt={asset.name}
                            className="av-img"
                          />
                        ) : (
                          String(asset.name || "I").trim().charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="pname">{asset.name}</div>
                        <div className="pcity">
                          {asset.images.length} image{asset.images.length === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="dcell">
                      <div className="dv">{asset.images.length}</div>
                      <div className="da">Files linked to this human asset</div>
                    </div>
                  </td>
                  <td>
                    <div className="dcell">
                      <div className="dv">{asset.possibleProfiles}</div>
                      <div className="da">Profiles supported</div>
                    </div>
                  </td>
                  <td>
                    <div className="dcell">
                      <div className="dv">{asset.usedBy}</div>
                      <div className="da">Profiles assigned</div>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="vbtn"
                      onClick={() => navigate(`/images/${asset.id}`)}
                    >
                      Visit
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isUploadOpen ? (
        <div className="npm-backdrop" onClick={() => setIsUploadOpen(false)}>
          <div
            className="npm-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(860px, 100%)" }}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Human Asset</div>
                <h2 className="npm-title">Upload Human Asset Images</h2>
              </div>
              <button
                className="npm-close"
                type="button"
                onClick={() => setIsUploadOpen(false)}
              >
                x
              </button>
            </div>
            <form className="npm-body" onSubmit={handleCreateHumanAsset}>
              <div className="npm-grid">
                <label className="npm-field">
                  <span className="npm-label">Human Asset Name</span>
                  <input
                    className="npm-input"
                    value={uploadForm.name}
                    onChange={(e) => setUploadForm((current) => ({ ...current, name: e.target.value }))}
                    placeholder="Jerome Hamoep"
                  />
                </label>
                <label className="npm-field">
                  <span className="npm-label">Number Possible Profile</span>
                  <input
                    type="number"
                    min="0"
                    className="npm-input"
                    value={uploadForm.numberPossibleProfile}
                    onChange={(e) => setUploadForm((current) => ({ ...current, numberPossibleProfile: e.target.value }))}
                  />
                </label>
                <label className="npm-field">
                  <span className="npm-label">Image Annotation</span>
                  <input
                    className="npm-input"
                    value={uploadForm.imageAnnotation}
                    onChange={(e) => setUploadForm((current) => ({ ...current, imageAnnotation: e.target.value }))}
                    placeholder="Optional shared annotation"
                  />
                </label>
                <label className="npm-field">
                  <span className="npm-label">Image Source Type</span>
                  <select
                    className="npm-input"
                    value={uploadForm.imageSourceType}
                    onChange={(e) => setUploadForm((current) => ({ ...current, imageSourceType: e.target.value }))}
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
                    value={uploadForm.generationModel}
                    onChange={(e) => setUploadForm((current) => ({ ...current, generationModel: e.target.value }))}
                    placeholder="stable-diffusion-3 or leave blank"
                  />
                </label>
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
                    {uploadForm.files.length
                      ? `${uploadForm.files.length} file(s) selected`
                      : "Upload one or more image files."}
                  </span>
                </label>
                {uploadForm.files.length ? (
                  <div className="npm-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="npm-label">Selected Images</span>
                    <div className="image-upload-batch-bar">
                      <select
                        className="npm-input"
                        value={uploadForm.batchImageType}
                        onChange={(e) =>
                          setUploadForm((current) => ({
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
                        className="btn-s"
                        onClick={applyBatchTypeToChecked}
                      >
                        Apply Type To Checked
                      </button>
                    </div>
                    <div className="image-upload-file-list">
                      {uploadForm.files.map((entry, index) => (
                        <div key={`${entry.file.name}-${index}`} className="image-upload-file-item">
                          <div className="image-upload-preview-frame">
                            <img
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
                                setUploadForm((current) => ({
                                  ...current,
                                  files: current.files.map((fileEntry, fileIndex) =>
                                    fileIndex === index
                                      ? { ...fileEntry, checked: e.target.checked }
                                      : fileEntry,
                                  ),
                                }))}
                            />
                            <span>{entry.file.name}</span>
                          </label>
                          <select
                            className="npm-input"
                            value={entry.type}
                            onChange={(e) =>
                              setUploadForm((current) => ({
                                ...current,
                                files: current.files.map((fileEntry, fileIndex) =>
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
                <div className="npm-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="npm-label">AI Generated</span>
                  <label className="npm-radio-option">
                    <input
                      type="checkbox"
                      checked={uploadForm.aiGenerated}
                      onChange={(e) =>
                        setUploadForm((current) => ({ ...current, aiGenerated: e.target.checked }))}
                    />
                    This upload is AI generated
                  </label>
                </div>
                <div className="npm-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="npm-label">Profiles Using This Human Asset</span>
                  {availableProfiles.length ? (
                    <>
                      <button
                        type="button"
                        className="btn-s"
                        onClick={() => setShowProfileAssignmentList((current) => !current)}
                      >
                        {showProfileAssignmentList
                          ? "Hide Profile Assignment"
                          : "Assign Profiles To This Human Asset"}
                      </button>
                      <div className="image-asset-helper">
                        Only images tagged as `post` will be saved into selected profile image data.
                      </div>
                      {showProfileAssignmentList ? (
                        <div className="image-upload-profile-list">
                          {availableProfiles.map((profile) => {
                            const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
                            const isChecked = uploadForm.numberProfileUsing.includes(profile._id);

                            return (
                              <label key={profile._id} className="image-upload-profile-option">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) =>
                                    setUploadForm((current) => ({
                                      ...current,
                                      numberProfileUsing: e.target.checked
                                        ? [...current.numberProfileUsing, profile._id]
                                        : current.numberProfileUsing.filter((id) => id !== profile._id),
                                    }))}
                                />
                                <span>{fullName || `Profile #${profile.id}`}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="image-asset-helper">No profiles available to pre-assign.</div>
                  )}
                </div>
              </div>
              {submitError ? <div className="npm-submit-error">{submitError}</div> : null}
              <div className="npm-footer">
                <button type="button" className="btn-s" onClick={() => setIsUploadOpen(false)}>
                  Cancel
                </button>
                <div className="npm-footer-actions">
                  <button type="submit" className="btn-p" disabled={isSubmitting}>
                    {isSubmitting ? "Uploading..." : "Create Human Asset"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
