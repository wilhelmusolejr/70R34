import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfiles } from "../api/profiles";
import { GenerateProfilesModal } from "../components/GenerateProfilesModal";
import { NewProfileModal } from "../components/NewProfileModal";
import { SafeImage } from "../components/SafeImage";
import { AVC, STATUS_CLASS, STATUS_OPTIONS } from "../constants/profileUi";
import { useAuth } from "../context/AuthContext";
import { canViewConfidential, canWrite, mask } from "../utils/access";
import "../App.css";

const TODAY = new Date().toLocaleDateString("en-CA");

function getSelectedEmail(profile) {
  if (!profile?.emails?.length) return "";
  return (
    profile.emails.find((entry) => entry.selected)?.address ||
    profile.emails[0].address ||
    ""
  );
}

function ago(s) {
  const days = Math.floor((new Date() - new Date(s)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return m > 0 ? `${y}y ${m}mo ago` : `${y}y ago`;
}

function fmtDate(s) {
  if (!s) return "-";
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInactiveDays(profile) {
  const entries = profile?.trackerLog || [];
  const latestEntry = entries.length ? entries[entries.length - 1] : null;
  const basisDate = latestEntry?.date || profile?.profileCreated;
  if (!basisDate) return "-";

  const lastTracked = new Date(basisDate);
  const today = new Date(TODAY);
  if (Number.isNaN(lastTracked.getTime()) || Number.isNaN(today.getTime())) {
    return "-";
  }

  const diffDays = Math.floor((today - lastTracked) / 86400000);
  if (diffDays <= 0) return "Today";
  return `${diffDays}d`;
}

function getFriendsDisplay(profile) {
  return `${Number(profile?.friends || 0)} Friends`;
}

function getAvatarColor(id) {
  return AVC[(id - 1) % AVC.length];
}

function getUserAvatarFilename(profile) {
  const userImages = (profile?.images || [])
    .map((entry) => entry?.imageId || entry?.image)
    .filter((image) => image?.filename);

  if (!userImages.length) return "";

  const preferred =
    userImages.find(
      (image) =>
        String(image?.type || "")
          .trim()
          .toLowerCase() === "profile",
    ) || userImages[0];

  return preferred?.filename || "";
}

export function ProfilesPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const isMaker = currentUser?.role === "maker";
  const confidential = canViewConfidential(currentUser);
  const writeable = canWrite(currentUser);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState("id");
  const [trackerFilter, setTrackerFilter] = useState("");
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [trackerTarget, setTrackerTarget] = useState(null);
  const [trackerNote, setTrackerNote] = useState("");

  useEffect(() => {
    if (!toast) return undefined;

    const timeout = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchProfiles();
        if (!cancelled) {
          setProfiles(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load profiles.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfiles();

    return () => {
      cancelled = true;
    };
  }, []);

  function getLatestTrackerEntry(profile) {
    const entries = profile?.trackerLog || [];
    return entries.length ? entries[entries.length - 1] : null;
  }

  function isProcessedToday(profile) {
    const latestEntry = getLatestTrackerEntry(profile);
    return latestEntry?.date === TODAY;
  }

  function openTrackerModal(profile) {
    if (!isAdmin || isProcessedToday(profile)) return;
    setTrackerTarget(profile);
    setTrackerNote("");
  }

  function closeTrackerModal() {
    setTrackerTarget(null);
    setTrackerNote("");
  }

  function saveTrackerEntry() {
    if (!isAdmin || !trackerTarget || isProcessedToday(trackerTarget)) {
      closeTrackerModal();
      return;
    }

    const nextEntry = { date: TODAY, note: trackerNote.trim() };

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === trackerTarget.id
          ? {
              ...profile,
              trackerLog: [...(profile.trackerLog || []), nextEntry],
            }
          : profile,
      ),
    );
    closeTrackerModal();
  }

  function markAllToday() {
    if (!isAdmin) return;
    const note = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setProfiles((current) =>
      current.map((profile) =>
        isProcessedToday(profile)
          ? profile
          : {
              ...profile,
              trackerLog: [
                ...(profile.trackerLog || []),
                { date: TODAY, note },
              ],
            },
      ),
    );
  }

  const visibleProfiles = isMaker
    ? profiles.filter((profile) =>
        (currentUser?.profiles || []).some(
          (entry) => entry.profileId === profile.id,
        ),
      )
    : profiles;

  const totalProfiles = visibleProfiles.length;
  const activeProfiles = visibleProfiles.filter(
    (p) => p.status === "Active",
  ).length;
  const pendingProfiles = visibleProfiles.filter(
    (p) => p.status === "Pending Profile",
  ).length;
  const bannedProfiles = visibleProfiles.filter(
    (p) => p.status === "Banned",
  ).length;
  const readyProfiles = visibleProfiles.filter(
    (p) => p.status === "Ready",
  ).length;
  const doneTodayCount = visibleProfiles.filter((p) =>
    isProcessedToday(p),
  ).length;
  const trackableProfiles = visibleProfiles.filter((p) =>
    ["Active", "Flagged", "Need Setup"].includes(p.status),
  ).length;

  const filtered = visibleProfiles.filter((profile) => {
    const q = search.toLowerCase();
    const primaryWork = profile.work?.[0];
    const selectedEmail = getSelectedEmail(profile).toLowerCase();
    const matchesSearch =
      `${profile.firstName} ${profile.lastName} ${profile.city || ""} ${primaryWork?.company || ""} ${primaryWork?.position || ""}`
        .toLowerCase()
        .includes(q) ||
      (confidential && selectedEmail.includes(q));
    const matchesStatus =
      statusFilter.length === 0 || statusFilter.includes(profile.status);
    const matchesTracker =
      !trackerFilter ||
      (trackerFilter === "done"
        ? isProcessedToday(profile)
        : !isProcessedToday(profile));

    return matchesSearch && matchesStatus && matchesTracker;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === "name") {
      return `${a.firstName} ${a.lastName}`.localeCompare(
        `${b.firstName} ${b.lastName}`,
      );
    }
    if (sortOrder === "status") return a.status.localeCompare(b.status);
    if (sortOrder === "unprocessed") {
      return Number(isProcessedToday(a)) - Number(isProcessedToday(b));
    }
    if (sortOrder === "ready") {
      return Number(b.profileSetup) - Number(a.profileSetup);
    }
    return a.id - b.id;
  });

  const nextId =
    visibleProfiles.reduce((maxId, profile) => Math.max(maxId, profile.id), 0) +
    1;

  function handleProfileCreated(createdProfile) {
    setProfiles((current) =>
      [...current, createdProfile].sort((a, b) => a.id - b.id),
    );
  }

  function toggleStatusFilter(status) {
    setStatusFilter((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  }

  function clearStatusFilter() {
    setStatusFilter([]);
  }

  return (
    <div>
      {toast ? <div className="toast-notice">{toast}</div> : null}
      <GenerateProfilesModal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        onGenerated={(newProfiles) =>
          setProfiles((cur) =>
            [...cur, ...newProfiles].sort((a, b) => a.id - b.id),
          )
        }
        onToast={setToast}
      />
      <NewProfileModal
        isOpen={isModalOpen}
        nextId={nextId}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleProfileCreated}
        onToast={setToast}
      />
      {trackerTarget && (
        <div className="npm-backdrop" onClick={closeTrackerModal}>
          <div
            className="npm-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(520px, 100%)", maxHeight: "unset" }}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Tracker Entry</div>
                <h2 className="npm-title">
                  Mark {trackerTarget.firstName} {trackerTarget.lastName}
                </h2>
              </div>
              <button
                className="npm-close"
                type="button"
                onClick={closeTrackerModal}
              >
                x
              </button>
            </div>
            <div className="npm-body">
              <div className="npm-grid" style={{ gridTemplateColumns: "1fr" }}>
                <label className="npm-field">
                  <span className="npm-label">Date</span>
                  <input className="npm-input" value={TODAY} readOnly />
                </label>
                <label className="npm-field">
                  <span className="npm-label">Note (optional)</span>
                  <textarea
                    className="npm-input npm-textarea"
                    value={trackerNote}
                    onChange={(e) => setTrackerNote(e.target.value)}
                    placeholder="Add an optional note..."
                    autoFocus
                  />
                </label>
              </div>
              <div className="npm-footer">
                <button
                  type="button"
                  className="btn-s"
                  onClick={closeTrackerModal}
                >
                  Cancel
                </button>
                <div className="npm-footer-actions">
                  <button
                    type="button"
                    className="btn-p"
                    onClick={saveTrackerEntry}
                  >
                    Save Tracker Entry
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Profiles</h1>
            <p>Track accounts, monitor requirements, and log daily activity.</p>
          </div>
          <div className="hdr-acts">
            <button className="btn-s">Export CSV</button>
            {isAdmin && (
              <button
                className="mark-all-btn"
                onClick={markAllToday}
                style={{ display: "none" }}
              >
                <svg viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Mark All Done Today
              </button>
            )}
            {writeable && (
              <button className="btn-s" onClick={() => setIsGenerateOpen(true)}>
                Generate
              </button>
            )}
            {writeable && (
              <button className="btn-p" onClick={() => setIsModalOpen(true)}>
                + New Profile
              </button>
            )}
          </div>
        </div>

        <div className="stats-row">
          <div className="sc">
            <div className="snum">{totalProfiles}</div>
            <div className="slabel">Fake Profile</div>
          </div>
          <div className="sc">
            <div className="snum" style={{ color: "var(--green)" }}>
              {activeProfiles}
            </div>
            <div className="slabel">
              <span className="sdot" style={{ background: "var(--green)" }} />
              Active
            </div>
          </div>
          <div className="sc">
            <div className="snum" style={{ color: "var(--amber)" }}>
              {pendingProfiles}
            </div>
            <div className="slabel">
              <span className="sdot" style={{ background: "var(--amber)" }} />
              Pending
            </div>
          </div>
          <div className="sc">
            <div className="snum" style={{ color: "var(--red)" }}>
              {bannedProfiles}
            </div>
            <div className="slabel">
              <span className="sdot" style={{ background: "var(--red)" }} />
              Banned
            </div>
          </div>
          <div className="sc">
            <div className="snum" style={{ color: "var(--accent)" }}>
              {readyProfiles}
            </div>
            <div className="slabel">
              <span className="sdot" style={{ background: "var(--accent)" }} />
              Ready
            </div>
          </div>
          <div className="sc">
            <div className="snum" style={{ color: "var(--purple)" }}>
              {doneTodayCount} / {trackableProfiles}
            </div>
            <div className="slabel">
              <span className="sdot" style={{ background: "var(--purple)" }} />
              Done Today
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
              placeholder="Search name, city, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="status-filter-wrap">
            <button
              type="button"
              className={`fsel status-filter-trigger${isStatusFilterOpen ? " open" : ""}`}
              onClick={() => setIsStatusFilterOpen((current) => !current)}
            >
              <span>Status</span>
              <span className="status-filter-count">
                {statusFilter.length === 0
                  ? "All"
                  : `${statusFilter.length} selected`}
              </span>
            </button>
            {isStatusFilterOpen && (
              <div className="status-filter-box">
                <div className="status-filter-list">
                  <label className="status-filter-item">
                    <input
                      type="checkbox"
                      checked={statusFilter.length === 0}
                      onChange={clearStatusFilter}
                    />
                    <span>All</span>
                  </label>
                  {STATUS_OPTIONS.map((status) => (
                    <label key={status} className="status-filter-item">
                      <input
                        type="checkbox"
                        checked={statusFilter.includes(status)}
                        onChange={() => toggleStatusFilter(status)}
                      />
                      <span>{status}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <select
            className="fsel"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="id">Sort: ID</option>
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
            <option value="unprocessed">Unprocessed First</option>
            <option value="ready">Ready First</option>
          </select>
          <select
            className="fsel"
            value={trackerFilter}
            onChange={(e) => setTrackerFilter(e.target.value)}
          >
            <option value="">All Tracker</option>
            <option value="done">Done Today</option>
            <option value="pending">Not Done Today</option>
          </select>
          <span className="rc">{sorted.length} profiles</span>
        </div>

        {loading ? (
          <div className="empty-st">
            <div className="et">Loading profiles</div>
            <div className="ed">Fetching data from the API...</div>
          </div>
        ) : error ? (
          <div className="empty-st">
            <div className="et">Unable to load profiles</div>
            <div className="ed">{error}</div>
          </div>
        ) : (
          <div className="twrap profiles-table-wrap">
            <table className="tbl profiles-table">
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Status</th>
                  <th>Profile Created</th>
                  <th>Inactive</th>
                  <th>Links</th>
                  <th>Requirements</th>
                  <th style={{ textAlign: "center" }}>Daily Tracker</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((profile) => {
                  const done = isProcessedToday(profile);
                  const lastEntry = getLatestTrackerEntry(profile);
                  const userAvatar = getUserAvatarFilename(profile);

                  return (
                    <tr
                      key={profile.id}
                      className={done ? "processed-today" : ""}
                    >
                      <td data-label="Profile">
                        <div className="pcell">
                          <div
                            className="av"
                            style={{ background: getAvatarColor(profile.id) }}
                          >
                            <SafeImage
                              src={userAvatar}
                              alt={`${profile.firstName} ${profile.lastName}`}
                              className="av-img"
                            />
                          </div>
                          <div>
                            <div className="pname">
                              {profile.firstName} {profile.lastName}
                            </div>
                            <div className="pcity">{profile.city}</div>
                            <div className="pcity">
                              {confidential
                                ? getSelectedEmail(profile) || "-"
                                : mask("")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`sbadge ${STATUS_CLASS[profile.status] || "sp"}`}
                        >
                          <span className="sdot2" />
                          {profile.status}
                        </span>
                      </td>
                      <td data-label="Profile Created">
                        <div className="dcell">
                          <div className="dv">
                            {fmtDate(profile.profileCreated)}
                          </div>
                          <div className="da">
                            {ago(profile.profileCreated)}
                          </div>
                        </div>
                      </td>
                      <td data-label="Inactive">
                        <div className="dcell">
                          <div className="dv">{getInactiveDays(profile)}</div>
                          <div className="da">Since last tracked</div>
                        </div>
                      </td>
                      <td data-label="Links">
                        <div className="lcell">
                          {profile.profileUrl ? (
                            <a
                              href={profile.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="el"
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                              Profile
                            </a>
                          ) : (
                            <span className="nol">No profile</span>
                          )}
                          {profile.pageUrl ? (
                            <a
                              href={profile.pageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="el"
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                              Page
                            </a>
                          ) : (
                            <span className="nol">No page</span>
                          )}
                        </div>
                      </td>
                      <td data-label="Requirements">
                        <div className="cklist">
                          {[
                            { label: "2FA", value: profile.has2FA },
                            { label: "Page", value: profile.hasPage },
                            {
                              label: getFriendsDisplay(profile),
                              value: Number(profile?.friends || 0) >= 30,
                            },
                          ].map(({ label, value }) => (
                            <div key={label} className="cki">
                              <div className={`ckbox ${value ? "yes" : "no"}`}>
                                {value ? (
                                  <svg viewBox="0 0 24 24">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 24 24">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                )}
                              </div>
                              <span className={`cklabel ${value ? "yes" : "no"}`}>
                                {label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td data-label="Daily Tracker">
                        <div className="tracker-cell">
                          <span
                            className={`track-badge ${done ? "track-done" : "track-pending"}`}
                          >
                            {done ? "Done" : "Pending"}
                          </span>
                          {done && lastEntry && (
                            <span className="track-time">{lastEntry.note}</span>
                          )}
                          {!done && isAdmin && (
                            <button
                              className="mark-btn"
                              onClick={() => openTrackerModal(profile)}
                            >
                              Mark Done
                            </button>
                          )}
                        </div>
                      </td>
                      <td data-label="Action">
                        <button
                          className="vbtn"
                          onClick={() => navigate(`/profile/${profile.id}`)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {sorted.length === 0 && (
              <div className="empty-st">
                <div className="et">No profiles found</div>
                <div className="ed">Try adjusting your search or filters</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
