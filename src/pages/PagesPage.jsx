import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProfiles } from "../api/profiles";
import { createPage, fetchPages } from "../api/pages";
import { useAuth } from "../context/AuthContext";
import { generatePageInformation } from "../generator/pages";
import "../App.css";

function EmptyState({ title, description }) {
  return (
    <div className="empty-st">
      <div className="et">{title}</div>
      <div className="ed">{description}</div>
    </div>
  );
}

function derivePageStatus(page) {
  if (!page.assets?.length) return "Pending";
  if (!page.linkedIdentity) return "Available";
  return "Claimed";
}

function getPagePreviewImage(page) {
  const assets = page?.assets || [];
  const preferred =
    assets.find(
      (asset) =>
        String(asset?.type || "")
          .trim()
          .toLowerCase() === "profile" && asset?.imageId?.filename,
    ) ||
    assets.find((asset) => asset?.imageId?.filename);

  return preferred?.imageId?.filename || "";
}

function getPageInitial(value) {
  return (
    String(value || "P")
      .trim()
      .charAt(0)
      .toUpperCase() || "P"
  );
}

function PageStatusBadge({ status }) {
  const className =
    status === "Available"
      ? "sp"
      : status === "Pending"
        ? "sa"
        : "sg";

  return (
    <span className={`sbadge ${className}`}>
      <span className="sdot2" />
      {status}
    </span>
  );
}

function PagesTable({ title, rows }) {
  if (!rows.length) {
    return (
      <div className="page-section">
        <div className="page-section-head">
          <h2>{title}</h2>
          <span>{rows.length} pages</span>
        </div>
        <EmptyState
          title={`No ${title.toLowerCase()} pages`}
          description="Try a different search or add a new page."
        />
      </div>
    );
  }

  return (
    <div className="page-section">
      <div className="page-section-head">
        <h2>{title}</h2>
        <span>{rows.length} pages</span>
      </div>
      <div className="twrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Page Name</th>
              <th>Status</th>
              <th>Category</th>
              <th>Assigned Profile</th>
              <th>Assets</th>
              <th>Posts</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((page) => {
              const previewImage = getPagePreviewImage(page);

              return (
              <tr key={`${title}-${page.id}`}>
                <td>
                  <div className="pcell">
                    <div className="av">
                      {previewImage ? (
                        <img
                          src={previewImage}
                          alt={page.pageName}
                          className="av-img"
                        />
                      ) : (
                        getPageInitial(page.pageName)
                      )}
                    </div>
                    <div>
                      <div className="pname">{page.pageName}</div>
                      <div className="pcity">
                        {page.assets.length} asset{page.assets.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <PageStatusBadge status={page.status} />
                </td>
                <td>{page.category || <span className="nol">No category</span>}</td>
                <td>
                  {page.linkedIdentity
                    ? `${page.linkedIdentity.firstName || ""} ${page.linkedIdentity.lastName || ""}`.trim()
                    : <span className="nol">No profile</span>}
                </td>
                <td>
                  <div className="dcell">
                    <div className="dv">{page.assets.length}</div>
                    <div className="da">Uploaded assets</div>
                  </div>
                </td>
                <td>
                  <div className="dcell">
                    <div className="dv">{page.posts?.length || 0}</div>
                    <div className="da">Created posts</div>
                  </div>
                </td>
                <td>
                  <Link to={`/pages/${page.id}`} className="btn-s">
                    Visit
                  </Link>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PagesPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [pages, setPages] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [guardMessage, setGuardMessage] = useState("");
  const [showAssignedProfileList, setShowAssignedProfileList] = useState(false);
  const [pageForm, setPageForm] = useState({
    pageName: "",
    pageId: "",
    category: "",
    followerCount: "0",
    likeCount: "0",
    generationPrompt: "",
    linkedIdentityId: "",
    batchAssetType: "post",
    bio: "",
    engagementScore: "0",
    files: [],
  });

  function resetPageForm() {
    setPageForm({
      pageName: "",
      pageId: "",
      category: "",
      followerCount: "0",
      likeCount: "0",
      generationPrompt: "",
      linkedIdentityId: "",
      batchAssetType: "post",
      bio: "",
      engagementScore: "0",
      files: [],
    });
    setShowAssignedProfileList(false);
    setSubmitError("");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        const [pagesData, profilesData] = await Promise.all([
          fetchPages(),
          fetchProfiles(),
        ]);
        if (!cancelled) {
          setPages(pagesData);
          setProfiles(profilesData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load pages.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    pageForm.files.forEach((entry) => {
      if (entry.previewUrl) {
        URL.revokeObjectURL(entry.previewUrl);
      }
    });
  }, [pageForm.files]);

  function setSelectedPageFiles(fileList) {
    setPageForm((current) => ({
      ...current,
      files: fileList.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        checked: false,
        type: "post",
      })),
    }));
  }

  function applyBatchAssetTypeToChecked() {
    setPageForm((current) => ({
      ...current,
      files: current.files.map((entry) =>
        entry.checked
          ? { ...entry, type: current.batchAssetType }
          : entry,
      ),
    }));
  }

  function handleGeneratePageInformation() {
    const generated = generatePageInformation();
    setPageForm((current) => ({
      ...current,
      pageName: generated.pageName,
      pageId: generated.pageId,
      category: generated.category,
      followerCount: generated.followerCount,
      likeCount: generated.likeCount,
      engagementScore: generated.engagementScore,
      generationPrompt: generated.generationPrompt,
      bio: generated.bio,
    }));
    setSubmitError("");
  }

  function ensureAdminAccess() {
    if (isAdmin) {
      return true;
    }

    setGuardMessage(
      currentUser
        ? "Only admin accounts can create or edit pages."
        : "You need to log in as an admin to create or edit pages.",
    );
    return false;
  }

  async function handleCreatePage(event) {
    event.preventDefault();

    if (!ensureAdminAccess()) {
      return;
    }

    if (!pageForm.pageName.trim()) {
      setSubmitError("Page name is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");

      const formData = new FormData();
      Object.entries(pageForm).forEach(([key, value]) => {
        if (key === "files") return;
        formData.append(key, value);
      });
      formData.append(
        "assetTypes",
        JSON.stringify(pageForm.files.map((entry) => entry.type || "post")),
      );
      pageForm.files.forEach((entry) => {
        formData.append("images", entry.file);
      });

      const createdPage = await createPage(formData);
      setPages((current) => [createdPage, ...current]);
      setIsModalOpen(false);
      resetPageForm();
    } catch (err) {
      setSubmitError(err.message || "Failed to create page.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const pageRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return pages
      .map((page) => ({
        ...page,
        status: derivePageStatus(page),
      }))
      .filter((page) => {
        if (!normalizedSearch) return true;

        return [
          page.pageName,
          page.status,
          page.category,
          page.pageId,
          page.generationPrompt,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      });
  }, [pages, search]);

  const availablePages = pageRows.filter((page) => page.status === "Available");
  const pendingPages = pageRows.filter((page) => page.status === "Pending");
  const claimedPages = pageRows.filter((page) => page.status === "Claimed");
  const isAddPageBusy = isSubmitting;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Pages</h1>
          <p>Browse page inventory grouped by availability and claim status.</p>
        </div>
        <button
          type="button"
          className="btn-p"
          onClick={() => {
            if (!ensureAdminAccess()) {
              return;
            }
            resetPageForm();
            setIsModalOpen(true);
          }}
        >
          Add Page
        </button>
      </div>

      <div className="stats-row">
        <div className="sc">
          <div className="snum">{pageRows.length}</div>
          <div className="slabel">Total Pages</div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--accent)" }}>
            {availablePages.length}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--accent)" }} />
            Available
          </div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--amber)" }}>
            {pendingPages.length}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--amber)" }} />
            Pending
          </div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--green)" }}>
            {claimedPages.length}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--green)" }} />
            Claimed
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
            placeholder="Search page name, category, prompt, or page ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="rc">{pageRows.length} pages</span>
      </div>

      {loading ? (
        <EmptyState
          title="Loading pages"
          description="Fetching page inventory from the API..."
        />
      ) : error ? (
        <EmptyState title="Unable to load pages" description={error} />
      ) : (
        <div className="page-sections">
          <PagesTable title="Available" rows={availablePages} />
          <PagesTable title="Pending" rows={pendingPages} />
          <PagesTable title="Claimed" rows={claimedPages} />
        </div>
      )}

      {isModalOpen ? (
        <div
          className="npm-backdrop"
          onClick={isAddPageBusy ? undefined : () => setIsModalOpen(false)}
        >
          <div
            className="npm-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(860px, 100%)" }}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Page</div>
                <h2 className="npm-title">Add Page</h2>
              </div>
              <button
                className="npm-close"
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isAddPageBusy}
              >
                x
              </button>
            </div>
            <form className="npm-body npm-form" onSubmit={handleCreatePage} aria-busy={isAddPageBusy}>
              <fieldset className="npm-form-fieldset" disabled={isAddPageBusy}>
              <div className="npm-grid">
                <div className="npm-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="npm-label">Quick Generator</span>
                  <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
                  <button type="button" className="btn-s" onClick={handleGeneratePageInformation}>
                    
                    Generate Page Info
                  </button>
                    <span className="image-asset-helper">
                      Fills page name, category, ID, bio, prompt, and starter metrics.
                    </span>
                  </div>
                </div>
                <label className="npm-field">
                  <span className="npm-label">Page Name</span>
                  <input
                    className="npm-input"
                    value={pageForm.pageName}
                    onChange={(e) => setPageForm((current) => ({ ...current, pageName: e.target.value }))}
                    placeholder="My New Page"
                  />
                </label>
                <label className="npm-field">
                  <span className="npm-label">Page ID</span>
                  <input
                    className="npm-input"
                    value={pageForm.pageId}
                    onChange={(e) => setPageForm((current) => ({ ...current, pageId: e.target.value }))}
                    placeholder="100087654321098"
                  />
                </label>
                <label className="npm-field">
                  <span className="npm-label">Category</span>
                  <input
                    className="npm-input"
                    value={pageForm.category}
                    onChange={(e) => setPageForm((current) => ({ ...current, category: e.target.value }))}
                    placeholder="personalBlog"
                  />
                </label>
                <label className="npm-field">
                  <span className="npm-label">Follower Count</span>
                  <input
                    type="number"
                    min="0"
                    className="npm-input"
                    value={pageForm.followerCount}
                    onChange={(e) => setPageForm((current) => ({ ...current, followerCount: e.target.value }))}
                  />
                </label>
                <label className="npm-field">
                  <span className="npm-label">Like Count</span>
                  <input
                    type="number"
                    min="0"
                    className="npm-input"
                    value={pageForm.likeCount}
                    onChange={(e) => setPageForm((current) => ({ ...current, likeCount: e.target.value }))}
                  />
                </label>
                <label className="npm-field">
                  <span className="npm-label">Engagement Score</span>
                  <input
                    type="number"
                    min="0"
                    className="npm-input"
                    value={pageForm.engagementScore}
                    onChange={(e) => setPageForm((current) => ({ ...current, engagementScore: e.target.value }))}
                  />
                </label>
                <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="npm-label">Generation Prompt</span>
                  <textarea
                    className="npm-input npm-textarea"
                    value={pageForm.generationPrompt}
                    onChange={(e) => setPageForm((current) => ({ ...current, generationPrompt: e.target.value }))}
                    placeholder="Describe the page persona and content direction..."
                  />
                </label>
                <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="npm-label">Bio</span>
                  <textarea
                    className="npm-input npm-textarea"
                    value={pageForm.bio}
                    onChange={(e) => setPageForm((current) => ({ ...current, bio: e.target.value }))}
                    placeholder="Write the page bio..."
                  />
                </label>
                <div className="npm-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="npm-label">Assign One Profile (Optional)</span>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.65rem",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      className="btn-s"
                      onClick={() => setShowAssignedProfileList((current) => !current)}
                    >
                      {showAssignedProfileList ? "Hide Profile List" : "Assign Profile"}
                    </button>
                    {pageForm.linkedIdentityId ? (
                      <button
                        type="button"
                        className="btn-s"
                        onClick={() =>
                          setPageForm((current) => ({
                            ...current,
                            linkedIdentityId: "",
                          }))}
                      >
                        Clear Selection
                      </button>
                    ) : null}
                  </div>
                  {showAssignedProfileList ? (
                    <div className="image-upload-profile-list">
                      {profiles.length ? (
                        profiles.map((profile) => {
                          const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
                          return (
                            <label key={profile._id} className="image-upload-profile-option">
                              <input
                                type="radio"
                                name="linkedIdentityId"
                                checked={pageForm.linkedIdentityId === profile._id}
                                onChange={() =>
                                  setPageForm((current) => ({
                                    ...current,
                                    linkedIdentityId: profile._id,
                                  }))}
                              />
                              <span>{fullName || `Profile #${profile.id}`}</span>
                            </label>
                          );
                        })
                      ) : (
                        <div className="image-asset-helper">No profiles available.</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="npm-label">Upload Images</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="npm-input"
                    onChange={(e) => setSelectedPageFiles(Array.from(e.target.files || []))}
                  />
                  <span className="image-asset-helper">
                    {pageForm.files.length
                      ? `${pageForm.files.length} file(s) selected`
                      : "Upload one or more page images."}
                  </span>
                </label>
                {pageForm.files.length ? (
                  <div className="npm-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="npm-label">Selected Images</span>
                    <div className="image-upload-batch-bar">
                      <select
                        className="npm-input"
                        value={pageForm.batchAssetType}
                        onChange={(e) =>
                          setPageForm((current) => ({
                            ...current,
                            batchAssetType: e.target.value,
                          }))}
                      >
                        <option value="profile">Profile</option>
                        <option value="cover">Cover</option>
                        <option value="post">Post</option>
                        <option value="reels">Reels</option>
                      </select>
                      <button
                        type="button"
                        className="btn-s"
                        onClick={applyBatchAssetTypeToChecked}
                      >
                        Apply Type To Checked
                      </button>
                    </div>
                    <div className="image-upload-file-list">
                      {pageForm.files.map((entry, index) => (
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
                                setPageForm((current) => ({
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
                              setPageForm((current) => ({
                                ...current,
                                files: current.files.map((fileEntry, fileIndex) =>
                                  fileIndex === index
                                    ? { ...fileEntry, type: e.target.value }
                                    : fileEntry,
                                ),
                              }))}
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
              {submitError ? <div className="npm-submit-error">{submitError}</div> : null}
              <div className="npm-footer">
                <button type="button" className="btn-s" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <div className="npm-footer-actions">
                  <button type="submit" className="btn-p" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create Page"}
                  </button>
                </div>
              </div>
              </fieldset>
              {isAddPageBusy ? (
                <div className="npm-loading-overlay">
                  <div className="npm-spinner" />
                  <div className="npm-loading-title">Creating page</div>
                  <div className="npm-loading-copy">
                    We&apos;re saving the page and uploading any selected files. This modal will unlock once everything is done.
                  </div>
                </div>
              ) : null}
            </form>
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
    </div>
  );
}
