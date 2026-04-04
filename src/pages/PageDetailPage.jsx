import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getPageImagesDownloadUrl } from "../api/pageDownloads";
import { fetchProfiles } from "../api/profiles";
import { addPageImages, addPagePost, fetchPage, updatePage } from "../api/pages";
import "../App.css";

function derivePageStatus(page) {
  if (!page?.assets?.length) return "Pending";
  if (!page?.linkedIdentity) return "Available";
  return "Claimed";
}

function fmtNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString("en-US") : "0";
}

function fmtDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPageColor(seed) {
  const palette = [
    "#3b82f6",
    "#0f766e",
    "#d97706",
    "#dc2626",
    "#7c3aed",
    "#0891b2",
  ];
  const text = String(seed || "page");
  const hash = [...text].reduce((total, char) => total + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function getPageInitial(value) {
  return (
    String(value || "P")
      .trim()
      .charAt(0)
      .toUpperCase() || "P"
  );
}

function CopyRow({ label, value, mono = false }) {
  const [copied, setCopied] = useState(false);
  const displayValue = String(value || "").trim();

  async function copy() {
    if (!displayValue) return;
    try {
      await navigator.clipboard.writeText(displayValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failures.
    }
  }

  return (
    <div className="dr">
      <div className="dl">{label}</div>
      <div
        className={`dv${mono ? " mono" : ""}${displayValue ? "" : " muted"}`}
      >
        {displayValue || "-"}
      </div>
      {displayValue ? (
        <button
          type="button"
          className={`cpbtn${copied ? " ok" : ""}`}
          onClick={copy}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      ) : null}
    </div>
  );
}

function EditableField({
  label,
  value,
  onSave,
  multiline = false,
  numeric = false,
  mono = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));

  async function save() {
    await onSave(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="dr">
        <div className="dl">{label}</div>
        <div className="dv">
          <div className="ef-wrap">
            {multiline ? (
              <textarea
                className="ef-input ef-textarea"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                autoFocus
              />
            ) : (
              <input
                className={`ef-input${mono ? " ef-mono" : ""}`}
                type={numeric ? "number" : "text"}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                autoFocus
              />
            )}
            <div className="ef-btns">
              <button type="button" className="ef-save" onClick={save}>
                Save
              </button>
              <button
                type="button"
                className="ef-cancel"
                onClick={() => {
                  setDraft(String(value ?? ""));
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dr">
      <div className="dl">{label}</div>
      <div className="dv">
        <div className={`ef-read${multiline ? " multi" : ""}`}>
          <div
            className={`ef-display${mono ? " mono" : ""}`}
            onDoubleClick={() => {
              setDraft(String(value ?? ""));
              setEditing(true);
            }}
            title="Double-click to edit"
          >
            {String(value ?? "").trim() ? (
              <span className={mono ? "dv mono" : undefined}>
                {String(value ?? "").trim()}
              </span>
            ) : (
              <em className="ef-empty">Double-click to add...</em>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children, badge = null }) {
  return (
    <div className="dc">
      <div className="dct">
        {title}
        {badge}
      </div>
      {children}
    </div>
  );
}

export function PageDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [postText, setPostText] = useState("");
  const [postFiles, setPostFiles] = useState([]);
  const [pageImageFiles, setPageImageFiles] = useState([]);
  const [pageImageBatchType, setPageImageBatchType] = useState("post");
  const [pageImageDescription, setPageImageDescription] = useState("");
  const [pageImageEngagementScore, setPageImageEngagementScore] = useState("0");
  const [isAddingImages, setIsAddingImages] = useState(false);
  const [addImagesError, setAddImagesError] = useState("");
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [postError, setPostError] = useState("");
  const [isAddPostModalOpen, setIsAddPostModalOpen] = useState(false);
  const [isAddImagesModalOpen, setIsAddImagesModalOpen] = useState(false);
  const [showAssignProfileInput, setShowAssignProfileInput] = useState(false);
  const [assignProfileName, setAssignProfileName] = useState("");
  const [isSavingPage, setIsSavingPage] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [bioCopied, setBioCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchPage(id);
        if (!cancelled) setPage(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load page.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPage();

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

  useEffect(
    () => () => {
      postFiles.forEach((entry) => {
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      });
    },
    [postFiles],
  );

  useEffect(
    () => () => {
      pageImageFiles.forEach((entry) => {
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      });
    },
    [pageImageFiles],
  );

  useEffect(() => {
    if (!isEditingBio) {
      setBioDraft(String(page?.bio || ""));
    }
  }, [isEditingBio, page?.bio]);

  const status = useMemo(() => derivePageStatus(page), [page]);
  const posts = page?.posts || [];
  const gallery = useMemo(
    () => [
      ...(page?.assets || [])
        .filter((asset) => asset?.imageId?.filename)
        .map((asset) => ({
          id: `asset-${asset.imageId._id}`,
          image: asset.imageId,
          kind: asset.type || "post",
          label:
            asset.imageId.annotation || asset.imageId.filename.split("/").pop(),
        })),
      ...(page?.posts || []).flatMap((post, postIndex) =>
        (post.images || [])
          .filter((image) => image?.filename)
          .map((image, imageIndex) => ({
            id: `post-${post.id}-${image._id || imageIndex}`,
            image,
            kind: `Post ${postIndex + 1}`,
            label: image.annotation || image.filename.split("/").pop(),
          })),
      ),
    ],
    [page],
  );
  const heroImage = gallery[0]?.image?.filename || "";
  const linkedProfileName = page?.linkedIdentity
    ? [page.linkedIdentity.firstName, page.linkedIdentity.lastName]
        .filter(Boolean)
        .join(" ")
        .trim()
    : "";
  const assignableProfiles = profiles.filter((profile) => {
    const hasPage = String(profile.pageUrl || "").trim().length > 0;
    const isCurrent = page?.linkedIdentity?.id === profile.id;
    return !hasPage || isCurrent;
  });
  const assignableProfileOptions = assignableProfiles
    .map((profile) => {
      const fullName = [profile.firstName, profile.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        id: profile._id,
        label: fullName || `Profile #${profile.id}`,
      };
    })
    .filter((profile) => profile.label);
  const pageAccent = getPageColor(page?.pageName);

  async function savePageChanges(patch) {
    try {
      setIsSavingPage(true);
      setError("");
      const nextPage = await updatePage(id, patch);
      setPage(nextPage);
      setShowAssignProfileInput(false);
      setAssignProfileName("");
    } catch (err) {
      setError(err.message || "Failed to save page.");
    } finally {
      setIsSavingPage(false);
    }
  }

  async function handleSaveBio() {
    await savePageChanges({ bio: bioDraft });
    setIsEditingBio(false);
  }

  async function handleCopyBio() {
    const value = String(page?.bio || "").trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setBioCopied(true);
      setTimeout(() => setBioCopied(false), 1500);
    } catch {
      // Ignore clipboard failures.
    }
  }

  async function handleAssignProfile() {
    const normalizedName = assignProfileName.trim().toLowerCase();
    const match = assignableProfileOptions.find(
      (profile) => profile.label.toLowerCase() === normalizedName,
    );

    if (!match) {
      setError("Choose a valid profile name from the available dataset.");
      return;
    }

    await savePageChanges({ linkedIdentityId: match.id });
  }

  function setSelectedPostFiles(fileList) {
    setPostFiles((current) => {
      current.forEach((entry) => {
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      });

      return fileList.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
    });
  }

  function setSelectedPageImageFiles(fileList) {
    setPageImageFiles((current) => {
      current.forEach((entry) => {
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      });

      return fileList.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        checked: false,
        type: "post",
      }));
    });
  }

  function applyBatchAssetTypeToChecked() {
    setPageImageFiles((current) =>
      current.map((entry) =>
        entry.checked ? { ...entry, type: pageImageBatchType } : entry,
      ),
    );
  }

  async function handleAddPost(event) {
    event.preventDefault();

    if (!postText.trim() && !postFiles.length) {
      setPostError("Add post text or upload at least one image.");
      return;
    }

    try {
      setIsSubmittingPost(true);
      setPostError("");

      const formData = new FormData();
      formData.append("post", postText);
      postFiles.forEach((entry) => {
        formData.append("images", entry.file);
      });

      const updatedPage = await addPagePost(page.id, formData);
      setPage(updatedPage);
      setPostText("");
      setSelectedPostFiles([]);
      setIsAddPostModalOpen(false);
    } catch (err) {
      setPostError(err.message || "Failed to add post.");
    } finally {
      setIsSubmittingPost(false);
    }
  }

  function openAddPostModal() {
    setPostError("");
    setPostText("");
    setSelectedPostFiles([]);
    setIsAddPostModalOpen(true);
  }

  function closeAddPostModal() {
    setIsAddPostModalOpen(false);
    setPostError("");
    setPostText("");
    setSelectedPostFiles([]);
  }

  function openAddImagesModal() {
    setAddImagesError("");
    setPageImageDescription(page?.bio || "");
    setPageImageEngagementScore("0");
    setPageImageBatchType("post");
    setSelectedPageImageFiles([]);
    setIsAddImagesModalOpen(true);
  }

  function closeAddImagesModal() {
    setIsAddImagesModalOpen(false);
    setAddImagesError("");
    setPageImageDescription("");
    setPageImageEngagementScore("0");
    setPageImageBatchType("post");
    setSelectedPageImageFiles([]);
  }

  async function handleAddImages(event) {
    event.preventDefault();

    if (!pageImageFiles.length) {
      setAddImagesError("Upload at least one image.");
      return;
    }

    try {
      setIsAddingImages(true);
      setAddImagesError("");

      const formData = new FormData();
      formData.append("postDescription", pageImageDescription);
      formData.append("engagementScore", pageImageEngagementScore);
      formData.append(
        "assetTypes",
        JSON.stringify(pageImageFiles.map((entry) => entry.type || "post")),
      );
      pageImageFiles.forEach((entry) => {
        formData.append("images", entry.file);
      });

      const updatedPage = await addPageImages(page.id, formData);
      setPage(updatedPage);
      closeAddImagesModal();
    } catch (err) {
      setAddImagesError(err.message || "Failed to add images.");
    } finally {
      setIsAddingImages(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="empty-st">
          <div className="et">Loading page</div>
          <div className="ed">Fetching page information from the API...</div>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="page">
        <div className="empty-st">
          <div className="et">Unable to load page</div>
          <div className="ed">{error || "Page not found."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate("/pages")}>
        <svg viewBox="0 0 24 24">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        All Pages
      </button>

      {error && (
        <div
          className="empty-st"
          style={{ padding: "16px 0 20px", textAlign: "left" }}
        >
          <div className="ed">{error}</div>
        </div>
      )}

      <div className="dhero">
        <div
          className="hcover"
          style={
            heroImage
              ? {
                  backgroundImage: `linear-gradient(135deg, ${pageAccent}22, ${pageAccent}66), url(${heroImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background: `linear-gradient(135deg, ${pageAccent}22, ${pageAccent}55)`,
                }
          }
        >
          <div className="haw">
            {heroImage ? (
              <div
                className="hav hav-img-wrap"
                style={{ background: pageAccent }}
              >
                <img src={heroImage} alt={page.pageName} className="hav-img" />
              </div>
            ) : (
              <div className="hav" style={{ background: pageAccent }}>
                {getPageInitial(page.pageName)}
              </div>
            )}
          </div>
        </div>
        <div className="hbody">
          <div className="htop">
            <div>
              <div className="hname">{page.pageName}</div>
              <div className="hsub">
                {page.category || "No category"} · {page.pageId || "No page ID"}
              </div>
              <div className="hbrow">
                <span
                  className={`sbadge ${status === "Available" ? "sp" : status === "Pending" ? "sa" : "sg"}`}
                >
                  <span className="sdot2" />
                  {status}
                </span>
                <span className="tag tv">{gallery.length} Images</span>
                <span className="tag tv">{posts.length} Posts</span>
              </div>
            </div>
            <div className="hmeta">
              Followers: {fmtNumber(page.followerCount)}
              <br />
              Likes: {fmtNumber(page.likeCount)}
              <br />
              Updated: {fmtDate(page.updatedAt)}
            </div>
          </div>
          <div className="hbio-wrap">
            {isEditingBio ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <textarea
                  className="npm-input npm-textarea"
                  value={bioDraft}
                  onChange={(event) => setBioDraft(event.target.value)}
                  placeholder="Write the page bio..."
                />
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="btn-s" onClick={handleSaveBio} disabled={isSavingPage}>
                    {isSavingPage ? "Saving..." : "Save Bio"}
                  </button>
                  <button
                    type="button"
                    className="btn-s"
                    onClick={() => {
                      setBioDraft(String(page.bio || ""));
                      setIsEditingBio(false);
                    }}
                    disabled={isSavingPage}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <div
                  className="ef-display"
                  onDoubleClick={() => {
                    setBioDraft(String(page.bio || ""));
                    setIsEditingBio(true);
                  }}
                  title="Double-click to edit"
                  style={{ cursor: "text", flex: 1 }}
                >
                  {String(page.bio || "").trim() ? (
                    page.bio
                  ) : (
                    <em className="ef-empty">Double-click to add bio...</em>
                  )}
                </div>
                {String(page.bio || "").trim() ? (
                  <button
                    type="button"
                    className={`cpbtn${bioCopied ? " ok" : ""}`}
                    onClick={handleCopyBio}
                  >
                    {bioCopied ? "Copied!" : "Copy"}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dgrid">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <SectionCard title="Overview">
            <div className="dr">
              <div className="dl">Gallery Images</div>
              <div className="dv">{gallery.length}</div>
            </div>
            <div className="dr">
              <div className="dl">Posts</div>
              <div className="dv">{posts.length}</div>
            </div>
            <div className="dr" style={{ borderBottom: "none" }}>
              <div className="dl">Assigned Profile</div>
              <div className={`dv${linkedProfileName ? "" : " muted"}`}>
                {linkedProfileName || "None"}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Page Information">
            <EditableField
              label="Page Name"
              value={page.pageName}
              onSave={(value) => savePageChanges({ pageName: value })}
            />
            <EditableField
              label="Page ID"
              value={page.pageId}
              mono
              onSave={(value) => savePageChanges({ pageId: value })}
            />
            <EditableField
              label="Category"
              value={page.category}
              onSave={(value) => savePageChanges({ category: value })}
            />
            <CopyRow label="Status" value={status} />
            <CopyRow label="Created" value={fmtDate(page.createdAt)} />
            <CopyRow label="Updated" value={fmtDate(page.updatedAt)} />
            <EditableField
              label="Followers"
              value={page.followerCount}
              numeric
              onSave={(value) => savePageChanges({ followerCount: value })}
            />
            <EditableField
              label="Likes"
              value={page.likeCount}
              numeric
              onSave={(value) => savePageChanges({ likeCount: value })}
            />
          </SectionCard>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <SectionCard
            title="Assigned Profile"
            badge={
              <button
                type="button"
                className="btn-s"
                onClick={() => {
                  setError("");
                  setAssignProfileName(linkedProfileName);
                  setShowAssignProfileInput((current) => !current);
                }}
              >
                {showAssignProfileInput ? "Hide Dataset" : "Option"}
              </button>
            }
          >
            {page.linkedIdentity ? (
              <>
                <CopyRow label="Profile Name" value={linkedProfileName} />
                <CopyRow
                  label="Page URL"
                  value={page.linkedIdentity?.pageUrl || ""}
                />
                <div className="dr" style={{ borderBottom: "none" }}>
                  <div className="dl">Open Profile</div>
                  <div className="dv">
                    <Link
                      to={`/profile/${page.linkedIdentity.id}`}
                      className="image-asset-user-link"
                    >
                      Open profile
                    </Link>
                  </div>
                </div>
                <div className="dr" style={{ borderBottom: "none" }}>
                  <div className="dl">Open Page</div>
                  <div className="dv">
                    {String(page.linkedIdentity?.pageUrl || "").trim() ? (
                      <a
                        href={page.linkedIdentity.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="image-asset-user-link"
                      >
                        Open page
                      </a>
                    ) : (
                      <span className="muted">No page URL</span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="muted">No profile linked to this page yet.</div>
            )}
            {showAssignProfileInput ? (
              <div
                style={{
                  marginTop: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {assignableProfileOptions.length ? (
                  <>
                    <div className="muted">
                      Type the profile name from the dataset. Only profiles
                      without a page URL are available here.
                    </div>
                    <input
                      type="text"
                      list="page-assignable-profile-options"
                      className="fsearch"
                      style={{ paddingLeft: "13px" }}
                      value={assignProfileName}
                      onChange={(event) =>
                        setAssignProfileName(event.target.value)
                      }
                      placeholder="Type a profile name"
                      disabled={isSavingPage}
                    />
                    <datalist id="page-assignable-profile-options">
                      {assignableProfileOptions.map((profile) => (
                        <option key={profile.id} value={profile.label} />
                      ))}
                    </datalist>
                    <div
                      style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                    >
                      <button
                        type="button"
                        className="btn-s"
                        onClick={handleAssignProfile}
                        disabled={isSavingPage || !assignProfileName.trim()}
                      >
                        {isSavingPage ? "Saving..." : "Assign Profile"}
                      </button>
                      <button
                        type="button"
                        className="btn-s"
                        onClick={() =>
                          savePageChanges({ linkedIdentityId: "" })
                        }
                        disabled={isSavingPage || !page?.linkedIdentity}
                      >
                        Clear Assigned Profile
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="muted">No eligible profiles available.</div>
                )}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Generation Prompt">
            <EditableField
              label="Prompt"
              value={page.generationPrompt}
              multiline
              onSave={(value) => savePageChanges({ generationPrompt: value })}
            />
          </SectionCard>

          <SectionCard
            title="Posts"
            badge={
              <div className="page-post-header-actions">
                <button
                  type="button"
                  className="btn-s"
                  onClick={openAddPostModal}
                >
                  Add Post
                </button>
                <span className="page-detail-chip">{posts.length}</span>
              </div>
            }
          >
            {posts.length ? (
              <div className="page-post-list">
                {posts.map((post, postIndex) => (
                  <details key={post.id} className="page-post-card">
                    <summary className="page-post-summary">
                      <div className="page-post-card-head">
                        <div className="page-post-head-main">
                          <div className="page-post-card-date">
                            {fmtDate(post.createdAt)}
                          </div>
                          <div
                            className={`page-post-preview${post.post ? "" : " muted"}`}
                          >
                            {post.post || "No description added."}
                          </div>
                        </div>
                        <div className="page-post-head-side">
                          <span className="page-detail-chip">
                            {post.images?.length || 0} images
                          </span>
                          <div className="page-post-number">
                            Post {postIndex + 1}
                          </div>
                          <span
                            className="page-post-chevron"
                            aria-hidden="true"
                          >
                            <svg viewBox="0 0 24 24">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </summary>
                    <div className="page-post-content">
                      <CopyRow label="Description" value={post.post} />
                      {post.images?.length ? (
                        <div className="page-post-image-grid">
                          {post.images.map((image, index) => (
                            <div
                              key={`${image._id || index}`}
                              className="profile-image-tile"
                            >
                              <div className="profile-image-frame">
                                <img
                                  src={image.filename}
                                  alt={`${page.pageName} post ${index + 1}`}
                                  className="profile-image-img"
                                />
                              </div>
                              <div className="profile-image-meta">
                                <div className="profile-image-name">
                                  {image.annotation ||
                                    image.filename.split("/").pop()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="muted">
                          No images attached to this post.
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div className="muted">No posts added to this page yet.</div>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Images Gallery"
        badge={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="btn-s" onClick={openAddImagesModal}>
              Add Images
            </button>
            {gallery.length ? (
              <a href={getPageImagesDownloadUrl(page.id)} className="btn-s">
                Download ZIP
              </a>
            ) : null}
          </div>
        }
      >
        {gallery.length ? (
          <>
            <div className="profile-image-gallery-head">
              <span className="muted">{gallery.length} images assigned</span>
            </div>
            <div className="page-gallery-grid">
              {gallery.map((asset, index) => (
                <div
                  key={`${asset.id || index}`}
                  className="profile-image-tile"
                >
                  <div className="profile-image-frame">
                    <img
                      src={asset.image.filename}
                      alt={`${page.pageName} ${index + 1}`}
                      className="profile-image-img"
                    />
                  </div>
                  <div className="profile-image-meta">
                    <div className="profile-image-name">{asset.kind}</div>
                    <div className="profile-image-date">{asset.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="muted">No images uploaded to this page yet.</div>
        )}
      </SectionCard>

      {isAddPostModalOpen ? (
        <div className="npm-backdrop" onClick={closeAddPostModal}>
          <div
            className="npm-modal"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(760px, 100%)" }}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Page Post</div>
                <h2 className="npm-title">Add Post</h2>
              </div>
              <button
                className="npm-close"
                type="button"
                onClick={closeAddPostModal}
              >
                x
              </button>
            </div>
            <form className="npm-body page-post-form" onSubmit={handleAddPost}>
              <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                <span className="npm-label">Post Description</span>
                <textarea
                  className="npm-input npm-textarea"
                  value={postText}
                  onChange={(event) => setPostText(event.target.value)}
                  placeholder="Write the post text..."
                />
              </label>
              <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                <span className="npm-label">Upload Post Images</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="npm-input"
                  onChange={(event) =>
                    setSelectedPostFiles(Array.from(event.target.files || []))
                  }
                />
              </label>
              {postFiles.length ? (
                <div className="page-post-upload-grid">
                  {postFiles.map((entry, index) => (
                    <div
                      key={`${entry.file.name}-${index}`}
                      className="page-post-upload-item"
                    >
                      <div className="image-upload-preview-frame">
                        <img
                          src={entry.previewUrl}
                          alt={entry.file.name}
                          className="image-upload-preview-img"
                        />
                      </div>
                      <div className="profile-image-date">
                        {entry.file.name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {postError ? (
                <div className="npm-submit-error">{postError}</div>
              ) : null}
              <div className="npm-footer">
                <button
                  type="button"
                  className="btn-s"
                  onClick={closeAddPostModal}
                >
                  Cancel
                </button>
                <div className="npm-footer-actions">
                  <button
                    type="submit"
                    className="btn-p"
                    disabled={isSubmittingPost}
                  >
                    {isSubmittingPost ? "Adding Post..." : "Add Post"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isAddImagesModalOpen ? (
        <div className="npm-backdrop" onClick={closeAddImagesModal}>
          <div
            className="npm-modal"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(860px, 100%)" }}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Page Assets</div>
                <h2 className="npm-title">Add Images</h2>
              </div>
              <button className="npm-close" type="button" onClick={closeAddImagesModal}>
                x
              </button>
            </div>
            <form className="npm-body" onSubmit={handleAddImages}>
              <div className="npm-grid">
                <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="npm-label">Description</span>
                  <textarea
                    className="npm-input npm-textarea"
                    value={pageImageDescription}
                    onChange={(event) => setPageImageDescription(event.target.value)}
                    placeholder="Optional description for these images..."
                  />
                </label>
                <label className="npm-field">
                  <span className="npm-label">Engagement Score</span>
                  <input
                    type="number"
                    min="0"
                    className="npm-input"
                    value={pageImageEngagementScore}
                    onChange={(event) => setPageImageEngagementScore(event.target.value)}
                  />
                </label>
                <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="npm-label">Upload Images</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="npm-input"
                    onChange={(event) =>
                      setSelectedPageImageFiles(Array.from(event.target.files || []))
                    }
                  />
                  <span className="image-asset-helper">
                    {pageImageFiles.length
                      ? `${pageImageFiles.length} file(s) selected`
                      : "Upload one or more page images."}
                  </span>
                </label>
                {pageImageFiles.length ? (
                  <div className="npm-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="npm-label">Selected Images</span>
                    <div className="image-upload-batch-bar">
                      <select
                        className="npm-input"
                        value={pageImageBatchType}
                        onChange={(event) => setPageImageBatchType(event.target.value)}
                      >
                        <option value="profile">Profile</option>
                        <option value="cover">Cover</option>
                        <option value="post">Post</option>
                        <option value="reels">Reels</option>
                      </select>
                      <button type="button" className="btn-s" onClick={applyBatchAssetTypeToChecked}>
                        Apply Type To Checked
                      </button>
                    </div>
                    <div className="image-upload-file-list">
                      {pageImageFiles.map((entry, index) => (
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
                              onChange={(event) =>
                                setPageImageFiles((current) =>
                                  current.map((fileEntry, fileIndex) =>
                                    fileIndex === index
                                      ? { ...fileEntry, checked: event.target.checked }
                                      : fileEntry,
                                  ),
                                )
                              }
                            />
                            <span>{entry.file.name}</span>
                          </label>
                          <select
                            className="npm-input"
                            value={entry.type}
                            onChange={(event) =>
                              setPageImageFiles((current) =>
                                current.map((fileEntry, fileIndex) =>
                                  fileIndex === index
                                    ? { ...fileEntry, type: event.target.value }
                                    : fileEntry,
                                ),
                              )
                            }
                          >
                            <option value="profile">Profile</option>
                            <option value="cover">Cover</option>
                            <option value="post">Post</option>
                            <option value="reels">Reels</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              {addImagesError ? <div className="npm-submit-error">{addImagesError}</div> : null}
              <div className="npm-footer">
                <button type="button" className="btn-s" onClick={closeAddImagesModal}>
                  Cancel
                </button>
                <div className="npm-footer-actions">
                  <button type="submit" className="btn-p" disabled={isAddingImages}>
                    {isAddingImages ? "Adding..." : "Add Images"}
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
