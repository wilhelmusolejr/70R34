import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  assignPostToProfile,
  autoAssignAllPosts,
  autoAssignPost,
  fetchPosts,
  unassignPost,
} from "../api/posts";
import { fetchProfiles } from "../api/profiles";
import { SafeImage } from "../components/SafeImage";
import { useAuth } from "../context/AuthContext";
import { canWrite } from "../utils/access";
import "../App.css";

const FILTERS = [
  { key: "unassigned", label: "Unassigned" },
  { key: "assigned", label: "Assigned" },
  { key: "all", label: "All" },
];

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

function getProfileLabel(profile) {
  if (!profile) return "";
  return (
    [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
    `Profile ${profile._id || ""}`
  );
}

function getPostProfile(post, profilesById) {
  if (!post) return null;
  if (post.profile) return post.profile;
  const id =
    typeof post.profileId === "object" && post.profileId
      ? post.profileId.id || post.profileId._id
      : post.profileId;
  if (!id) return null;
  return profilesById.get(String(id)) || null;
}

export function PostsPage() {
  const { currentUser } = useAuth();
  const writeable = canWrite(currentUser);

  const [posts, setPosts] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("unassigned");
  const [search, setSearch] = useState("");
  const [busyPostId, setBusyPostId] = useState("");
  const [assignDrafts, setAssignDrafts] = useState({});
  const [isAutoAssigningAll, setIsAutoAssigningAll] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const [postData, profileData] = await Promise.all([
          fetchPosts(),
          fetchProfiles(),
        ]);
        if (cancelled) return;
        setPosts(Array.isArray(postData) ? postData : []);
        setProfiles(Array.isArray(profileData) ? profileData : []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load posts.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const profilesById = useMemo(() => {
    const map = new Map();
    profiles.forEach((profile) => {
      if (profile?._id) map.set(String(profile._id), profile);
    });
    return map;
  }, [profiles]);

  const profileIdsWithPost = useMemo(() => {
    const set = new Set();
    posts.forEach((post) => {
      const id =
        typeof post.profileId === "object" && post.profileId
          ? post.profileId.id || post.profileId._id
          : post.profileId;
      if (id) set.add(String(id));
    });
    return set;
  }, [posts]);

  const assignableProfileOptions = useMemo(() => {
    return profiles
      .filter((profile) => !profileIdsWithPost.has(String(profile._id)))
      .map((profile) => ({
        id: profile._id,
        label: getProfileLabel(profile),
      }))
      .filter((entry) => entry.label);
  }, [profiles, profileIdsWithPost]);

  const filteredPosts = useMemo(() => {
    const text = search.trim().toLowerCase();
    return posts.filter((post) => {
      const assigned = !!(
        post.profile ||
        (typeof post.profileId === "object"
          ? post.profileId
          : post.profileId)
      );
      if (filter === "assigned" && !assigned) return false;
      if (filter === "unassigned" && assigned) return false;
      if (!text) return true;
      const caption = String(post.caption || post.post || "").toLowerCase();
      const profile = getPostProfile(post, profilesById);
      const name = getProfileLabel(profile).toLowerCase();
      return caption.includes(text) || name.includes(text);
    });
  }, [posts, filter, search, profilesById]);

  const unassignedCount = useMemo(
    () =>
      posts.reduce((total, post) => {
        const assigned = !!(
          post.profile ||
          (typeof post.profileId === "object"
            ? post.profileId
            : post.profileId)
        );
        return assigned ? total : total + 1;
      }, 0),
    [posts],
  );

  function replacePost(updated) {
    if (!updated || !updated._id) return;
    setPosts((current) =>
      current.map((post) => (post._id === updated._id ? updated : post)),
    );
  }

  async function handleAutoAssign(post) {
    if (!writeable) return;
    try {
      setBusyPostId(post._id);
      setError("");
      const updated = await autoAssignPost(post._id);
      replacePost(updated);
      const name = getProfileLabel(updated?.profile);
      setToast(name ? `Assigned to ${name}.` : "Post assigned.");
    } catch (err) {
      setError(err.message || "Failed to auto-assign post.");
    } finally {
      setBusyPostId("");
    }
  }

  async function handleAssign(post) {
    if (!writeable) return;
    const draft = String(assignDrafts[post._id] || "").trim();
    if (!draft) return;
    const match = assignableProfileOptions.find(
      (entry) => entry.label.toLowerCase() === draft.toLowerCase(),
    );
    if (!match) {
      setError("Type a valid profile name from the unassigned list.");
      return;
    }
    try {
      setBusyPostId(post._id);
      setError("");
      const updated = await assignPostToProfile(post._id, match.id);
      replacePost(updated);
      setAssignDrafts((current) => {
        const next = { ...current };
        delete next[post._id];
        return next;
      });
      setToast(`Assigned to ${match.label}.`);
    } catch (err) {
      setError(err.message || "Failed to assign post.");
    } finally {
      setBusyPostId("");
    }
  }

  async function handleUnassign(post) {
    if (!writeable) return;
    if (
      !window.confirm(
        "Unassign this post? It will return to the unassigned pool.",
      )
    ) {
      return;
    }
    try {
      setBusyPostId(post._id);
      setError("");
      const updated = await unassignPost(post._id);
      replacePost(updated);
      setToast("Post unassigned.");
    } catch (err) {
      setError(err.message || "Failed to unassign post.");
    } finally {
      setBusyPostId("");
    }
  }

  async function handleAutoAssignAll() {
    if (!writeable || isAutoAssigningAll) return;
    if (unassignedCount === 0) {
      setToast("Nothing to assign — every post already has an owner.");
      return;
    }
    if (
      !window.confirm(
        `Auto-assign ${unassignedCount} unassigned post${unassignedCount === 1 ? "" : "s"} to profiles without a post? Each profile gets at most one.`,
      )
    ) {
      return;
    }
    try {
      setIsAutoAssigningAll(true);
      setError("");
      const result = await autoAssignAllPosts();
      const updated = Array.isArray(result?.posts) ? result.posts : [];
      if (updated.length) {
        const byId = new Map(updated.map((entry) => [entry._id, entry]));
        setPosts((current) =>
          current.map((post) =>
            byId.has(post._id) ? byId.get(post._id) : post,
          ),
        );
      } else {
        const fresh = await fetchPosts();
        setPosts(Array.isArray(fresh) ? fresh : []);
      }
      const assigned = Number(result?.assignedCount ?? updated.length);
      const skipped = Number(result?.skippedCount ?? 0);
      const failed = Number(result?.failedCount ?? 0);
      const pieces = [`${assigned} assigned`];
      if (skipped) pieces.push(`${skipped} skipped`);
      if (failed) pieces.push(`${failed} failed`);
      setToast(`Auto-assign all — ${pieces.join(", ")}.`);
    } catch (err) {
      setError(err.message || "Failed to auto-assign all posts.");
    } finally {
      setIsAutoAssigningAll(false);
    }
  }

  return (
    <div className="page">
      {toast ? <div className="pv-toast">{toast}</div> : null}
      <div className="page-header">
        <div>
          <h1>Posts</h1>
          <p>
            Each card bundles a set of images as one Facebook post. Assign
            cards to profiles that don&apos;t have a post yet.
          </p>
        </div>
        <div className="hdr-acts">
          {writeable ? (
            <button
              type="button"
              className="btn-p"
              onClick={handleAutoAssignAll}
              disabled={
                isAutoAssigningAll || loading || unassignedCount === 0
              }
              title="Assigns every unassigned post to a profile without a post"
            >
              {isAutoAssigningAll
                ? "Auto-assigning..."
                : `Auto-assign All (${unassignedCount})`}
            </button>
          ) : null}
        </div>
      </div>

      <div className="stats-row">
        <div className="sc">
          <div className="snum">{posts.length}</div>
          <div className="slabel">Total Posts</div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--accent)" }}>
            {unassignedCount}
          </div>
          <div className="slabel">Unassigned</div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--green-t)" }}>
            {posts.length - unassignedCount}
          </div>
          <div className="slabel">Assigned</div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--purple)" }}>
            {assignableProfileOptions.length}
          </div>
          <div className="slabel">Profiles Without Post</div>
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
            placeholder="Search caption or assigned profile..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="posts-filter-pills">
          {FILTERS.map((entry) => (
            <button
              type="button"
              key={entry.key}
              className={`posts-filter-pill${filter === entry.key ? " active" : ""}`}
              onClick={() => setFilter(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <span className="rc">{filteredPosts.length} posts</span>
      </div>

      {error ? (
        <div className="empty-st" style={{ textAlign: "left" }}>
          <div className="ed">{error}</div>
        </div>
      ) : null}

      {loading ? (
        <div className="empty-st">
          <div className="et">Loading posts</div>
          <div className="ed">Fetching post bundles from the API...</div>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="empty-st">
          <div className="et">No posts to show</div>
          <div className="ed">
            {posts.length === 0
              ? "Codex hasn’t bundled any post groups yet. Once posts exist they will appear here for assignment."
              : "No posts match this filter. Try another tab or clear your search."}
          </div>
        </div>
      ) : (
        <div className="posts-grid">
          {filteredPosts.map((post) => {
            const images = Array.isArray(post.images) ? post.images : [];
            const previewImages = images.slice(0, 4);
            const extraImages = Math.max(images.length - 4, 0);
            const assignedProfile = getPostProfile(post, profilesById);
            const assigned = !!assignedProfile || !!post.profileId;
            const caption = String(post.caption || post.post || "").trim();
            const isBusy = busyPostId === post._id;
            const draftValue = assignDrafts[post._id] || "";

            return (
              <div className="post-card" key={post._id}>
                <div className="post-card-images">
                  {previewImages.length ? (
                    previewImages.map((image, index) => {
                      const filename =
                        typeof image === "object" ? image?.filename : null;
                      const key =
                        (typeof image === "object" &&
                          (image._id || image.id)) ||
                        index;
                      return (
                        <div className="post-card-image" key={`${post._id}-${key}`}>
                          <SafeImage
                            src={filename || ""}
                            alt={
                              (typeof image === "object" && image.annotation) ||
                              `Post image ${index + 1}`
                            }
                            className="post-card-image-img"
                          />
                          {index === 3 && extraImages > 0 ? (
                            <div className="post-card-image-overflow">
                              +{extraImages}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="post-card-image post-card-image-empty">
                      <span className="muted">No images</span>
                    </div>
                  )}
                </div>
                <div className="post-card-body">
                  <div className="post-card-meta">
                    <span className="post-card-count">
                      {images.length} image{images.length === 1 ? "" : "s"}
                    </span>
                    <span className="post-card-date">
                      Created {fmtDate(post.createdAt)}
                    </span>
                  </div>
                  {post.context ? (
                    <div className="post-card-context" title={post.context}>
                      <span className="post-card-context-label">Context</span>
                      <span className="post-card-context-text">
                        {post.context}
                      </span>
                    </div>
                  ) : null}
                  <div
                    className={`post-card-caption${caption ? "" : " muted"}`}
                  >
                    {caption || "No caption."}
                  </div>
                  <div
                    className={`post-card-status${assigned ? " assigned" : " unassigned"}`}
                  >
                    <span className="post-card-status-dot" />
                    {assigned ? (
                      <span>
                        Assigned to{" "}
                        {assignedProfile?._id ? (
                          <Link
                            to={`/profile/${assignedProfile._id}`}
                            className="post-card-profile-link"
                          >
                            {getProfileLabel(assignedProfile)}
                          </Link>
                        ) : (
                          <strong>
                            {getProfileLabel(assignedProfile) || "Unknown"}
                          </strong>
                        )}
                      </span>
                    ) : (
                      <span>Unassigned</span>
                    )}
                  </div>
                  {writeable ? (
                    assigned ? (
                      <div className="post-card-actions">
                        {assignedProfile?._id ? (
                          <Link
                            to={`/profile/${assignedProfile._id}`}
                            className="btn-s"
                          >
                            View Profile
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          className="btn-s post-card-danger"
                          onClick={() => handleUnassign(post)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Working..." : "Unassign"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="post-card-assign">
                          <input
                            type="text"
                            list={`post-assign-options-${post._id}`}
                            className="fsearch post-card-assign-input"
                            placeholder="Type a profile name"
                            value={draftValue}
                            onChange={(event) =>
                              setAssignDrafts((current) => ({
                                ...current,
                                [post._id]: event.target.value,
                              }))
                            }
                            disabled={isBusy}
                          />
                          <datalist id={`post-assign-options-${post._id}`}>
                            {assignableProfileOptions.map((entry) => (
                              <option key={entry.id} value={entry.label} />
                            ))}
                          </datalist>
                          <button
                            type="button"
                            className="btn-s"
                            onClick={() => handleAssign(post)}
                            disabled={isBusy || !draftValue.trim()}
                          >
                            {isBusy ? "Assigning..." : "Assign"}
                          </button>
                        </div>
                        <div className="post-card-actions">
                          <button
                            type="button"
                            className="btn-p post-card-auto"
                            onClick={() => handleAutoAssign(post)}
                            disabled={
                              isBusy || assignableProfileOptions.length === 0
                            }
                            title={
                              assignableProfileOptions.length === 0
                                ? "Every profile already has a post"
                                : "System picks a profile without a post"
                            }
                          >
                            {isBusy ? "Assigning..." : "Auto-assign"}
                          </button>
                        </div>
                      </>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
