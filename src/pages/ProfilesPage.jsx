import { useEffect, useState } from "react";
import {
  addTrackerEntry,
  fetchProfiles,
  updateProfile,
} from "../api/profiles";
import { BulkEditModal } from "../components/BulkEditModal";
import { GenerateProfilesModal } from "../components/GenerateProfilesModal";
import { NewProfileModal } from "../components/NewProfileModal";
import { SafeImage } from "../components/SafeImage";
import {
  AVC,
  STATUS_CLASS,
  STATUS_COLORS,
  STATUS_OPTIONS,
} from "../constants/profileUi";
import { useAuth } from "../context/AuthContext";
import { COUNTRY_OPTIONS } from "../generator/countries/index.js";
import {
  allowedStatusesFor,
  canViewConfidential,
  canWrite,
  defaultStatusFilterFor,
  mask,
} from "../utils/access";
import "../App.css";

const TODAY = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Manila",
});

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

function hasPageUrl(profile) {
  return String(profile?.pageUrl || "").trim().length > 0;
}

const FRIENDS_REQUIREMENT = 30;

const TRACKER_FILTER_CYCLE = ["", "done", "pending"];
const TRACKER_FILTER_LABELS = {
  "": "All Tracker",
  done: "Done Today",
  pending: "Not Done Today",
};

const FILTERS_STORAGE_KEY = "pv_profiles_filters";

function loadStoredFilters() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getAvatarColor(id) {
  const str = String(id || "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVC[hash % AVC.length];
}

function StatCard({ active, onClick, accentColor, children }) {
  const interactive = typeof onClick === "function";
  const handleKey = (event) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };
  const outlineColor = accentColor || "var(--accent)";
  return (
    <div
      className="sc"
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? handleKey : undefined}
      style={{
        cursor: interactive ? "pointer" : undefined,
        outline: active ? `2px solid ${outlineColor}` : undefined,
        outlineOffset: active ? "2px" : undefined,
        background:
          active && accentColor ? `${accentColor}1a` : undefined,
        userSelect: interactive ? "none" : undefined,
      }}
    >
      {children}
    </div>
  );
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
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const isMaker = currentUser?.role === "maker";
  const confidential = canViewConfidential(currentUser);
  const writeable = canWrite(currentUser);
  const allowedStatuses = allowedStatusesFor(currentUser, STATUS_OPTIONS);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(() => loadStoredFilters()?.search || "");
  const [statusFilter, setStatusFilter] = useState(() => {
    const stored = loadStoredFilters();
    if (Array.isArray(stored?.statusFilter)) return stored.statusFilter;
    return defaultStatusFilterFor(currentUser);
  });
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState(
    () => loadStoredFilters()?.sortOrder || "id",
  );
  const [trackerFilter, setTrackerFilter] = useState(() => {
    const stored = loadStoredFilters()?.trackerFilter;
    return TRACKER_FILTER_CYCLE.includes(stored) ? stored : "";
  });
  const [countryFilter, setCountryFilter] = useState(
    () => loadStoredFilters()?.countryFilter || "",
  );
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [trackerTarget, setTrackerTarget] = useState(null);
  const [trackerNote, setTrackerNote] = useState("");
  const [trackerSaving, setTrackerSaving] = useState(false);
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;

    const timeout = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          search,
          statusFilter,
          sortOrder,
          trackerFilter,
          countryFilter,
        }),
      );
    } catch {
      // ignore quota / unavailable
    }
  }, [search, statusFilter, sortOrder, trackerFilter, countryFilter]);

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

  async function saveTrackerEntry() {
    if (!isAdmin || !trackerTarget || isProcessedToday(trackerTarget)) {
      closeTrackerModal();
      return;
    }

    setTrackerSaving(true);
    try {
      const updated = await addTrackerEntry(trackerTarget._id, {
        date: TODAY,
        note: trackerNote.trim(),
      });
      setProfiles((current) =>
        current.map((profile) =>
          profile._id === trackerTarget._id
            ? { ...profile, ...updated }
            : profile,
        ),
      );
      closeTrackerModal();
    } catch (err) {
      setToast(err.message || "Failed to save tracker entry.");
    } finally {
      setTrackerSaving(false);
    }
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
          (entry) => entry.profileId === profile._id,
        ),
      )
    : profiles;

  const totalProfiles = visibleProfiles.length;
  const activeProfiles = visibleProfiles.filter(
    (p) => p.status === "Active",
  ).length;
  const flaggedProfiles = visibleProfiles.filter(
    (p) => p.status === "Flagged",
  ).length;
  const needCheckingProfiles = visibleProfiles.filter(
    (p) => p.status === "Need Checking",
  ).length;
  const readyProfiles = visibleProfiles.filter(
    (p) => p.status === "Ready",
  ).length;
  const trackableStatuses = ["Active", "Flagged", "Need Setup"];
  const trackableProfiles = visibleProfiles.filter((p) =>
    trackableStatuses.includes(p.status),
  ).length;
  const doneTodayCount = visibleProfiles.filter(
    (p) => trackableStatuses.includes(p.status) && isProcessedToday(p),
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
    const withinAllowed = allowedStatuses.includes(profile.status);
    const matchesStatus =
      withinAllowed &&
      (statusFilter.length === 0 || statusFilter.includes(profile.status));
    const matchesTracker =
      !trackerFilter ||
      (trackerFilter === "done"
        ? isProcessedToday(profile)
        : !isProcessedToday(profile));
    const matchesCountry =
      !countryFilter || (profile.country || "US") === countryFilter;

    return matchesSearch && matchesStatus && matchesTracker && matchesCountry;
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
    return String(a._id || "").localeCompare(String(b._id || ""));
  });

  async function copyFilteredIds() {
    const ids = sorted.map((profile) => profile._id);
    const payload = JSON.stringify(ids);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = payload;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setToast(`Copied ${ids.length} ID${ids.length === 1 ? "" : "s"}`);
    } catch {
      setToast("Failed to copy IDs");
    }
  }

  function handleProfileCreated(createdProfile) {
    setProfiles((current) =>
      [...current, createdProfile].sort((a, b) =>
        String(a._id || "").localeCompare(String(b._id || "")),
      ),
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

  function toggleSingleStatus(status) {
    setStatusFilter((current) =>
      current.length === 1 && current[0] === status ? [] : [status],
    );
  }

  function isOnlyStatus(status) {
    return statusFilter.length === 1 && statusFilter[0] === status;
  }

  function cycleTrackerFilter() {
    setTrackerFilter((current) => {
      const idx = TRACKER_FILTER_CYCLE.indexOf(current);
      return TRACKER_FILTER_CYCLE[(idx + 1) % TRACKER_FILTER_CYCLE.length];
    });
  }

  function toggleQuickEditMode() {
    setQuickEditMode((current) => {
      if (current) {
        setSelectedIds(new Set());
      }
      return !current;
    });
  }

  function toggleRowSelected(profileId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function applyBulkEdits(payload) {
    if (!writeable || selectedIds.size === 0 || isBulkApplying) return;

    setIsBulkApplying(true);
    const ids = Array.from(selectedIds);
    const profilesById = new Map(profiles.map((p) => [p._id, p]));

    const tasks = ids.map(async (id) => {
      const current = profilesById.get(id);
      if (!current) return { id, ok: false, error: "Profile not found locally" };

      const patch = {};
      if (payload.status) patch.status = payload.status.value;
      if (payload.tags) {
        const currentTags = Array.isArray(current.tags) ? current.tags : [];
        patch.tags =
          payload.tags.action === "remove"
            ? currentTags.filter((t) => t !== payload.tags.value)
            : Array.from(new Set([...currentTags, payload.tags.value]));
      }
      if (payload.flags) Object.assign(patch, payload.flags);

      try {
        let updated = current;
        if (Object.keys(patch).length > 0) {
          updated = await updateProfile(id, patch);
        }
        if (payload.tracker && !isProcessedToday(updated)) {
          updated = await addTrackerEntry(id, {
            date: TODAY,
            note: payload.tracker.note,
          });
        }
        return { id, ok: true, profile: updated };
      } catch (err) {
        return { id, ok: false, error: err.message || "Update failed" };
      }
    });

    const results = await Promise.all(tasks);
    const successByid = new Map();
    let failed = 0;
    for (const r of results) {
      if (r.ok && r.profile) successByid.set(r.id, r.profile);
      else if (!r.ok) failed += 1;
    }

    if (successByid.size > 0) {
      setProfiles((current) =>
        current.map((p) =>
          successByid.has(p._id) ? { ...p, ...successByid.get(p._id) } : p,
        ),
      );
    }

    setIsBulkApplying(false);
    setIsBulkEditOpen(false);
    setSelectedIds(new Set());
    const succeeded = successByid.size;
    setToast(
      failed > 0
        ? `Updated ${succeeded}, ${failed} failed.`
        : `Updated ${succeeded} profile${succeeded === 1 ? "" : "s"}.`,
    );
  }

  return (
    <div>
      {toast ? <div className="toast-notice">{toast}</div> : null}
      <GenerateProfilesModal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        onGenerated={(newProfiles) =>
          setProfiles((cur) =>
            [...cur, ...newProfiles].sort((a, b) =>
              String(a._id || "").localeCompare(String(b._id || "")),
            ),
          )
        }
        onToast={setToast}
      />
      <NewProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleProfileCreated}
        onToast={setToast}
      />
      <BulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => (isBulkApplying ? null : setIsBulkEditOpen(false))}
        selectedCount={selectedIds.size}
        onApply={applyBulkEdits}
        isApplying={isBulkApplying}
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
                  disabled={trackerSaving}
                >
                  Cancel
                </button>
                <div className="npm-footer-actions">
                  <button
                    type="button"
                    className="btn-p"
                    onClick={saveTrackerEntry}
                    disabled={trackerSaving}
                  >
                    {trackerSaving ? "Saving..." : "Save Tracker Entry"}
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
            <button
              type="button"
              className="btn-s"
              onClick={copyFilteredIds}
              disabled={loading || sorted.length === 0}
              title="Copy visible profile IDs as a JSON array"
            >
              Copy IDs
            </button>
            {writeable && (
              <button
                type="button"
                className={quickEditMode ? "btn-p" : "btn-s"}
                onClick={toggleQuickEditMode}
                title="Toggle bulk-select mode"
              >
                {quickEditMode ? "Exit Quick Edit" : "Quick Edit"}
              </button>
            )}
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
          <StatCard
            active={statusFilter.length === 0}
            onClick={clearStatusFilter}
          >
            <div className="snum">{totalProfiles}</div>
            <div className="slabel">Fake Profile</div>
          </StatCard>
          <StatCard
            active={isOnlyStatus("Active")}
            onClick={() => toggleSingleStatus("Active")}
            accentColor={STATUS_COLORS.Active}
          >
            <div className="snum" style={{ color: STATUS_COLORS.Active }}>
              {activeProfiles}
            </div>
            <div className="slabel">
              <span
                className="sdot"
                style={{ background: STATUS_COLORS.Active }}
              />
              Active
            </div>
          </StatCard>
          <StatCard
            active={isOnlyStatus("Flagged")}
            onClick={() => toggleSingleStatus("Flagged")}
            accentColor={STATUS_COLORS.Flagged}
          >
            <div className="snum" style={{ color: STATUS_COLORS.Flagged }}>
              {flaggedProfiles}
            </div>
            <div className="slabel">
              <span
                className="sdot"
                style={{ background: STATUS_COLORS.Flagged }}
              />
              Flagged
            </div>
          </StatCard>
          <StatCard
            active={isOnlyStatus("Need Checking")}
            onClick={() => toggleSingleStatus("Need Checking")}
            accentColor={STATUS_COLORS["Need Checking"]}
          >
            <div
              className="snum"
              style={{ color: STATUS_COLORS["Need Checking"] }}
            >
              {needCheckingProfiles}
            </div>
            <div className="slabel">
              <span
                className="sdot"
                style={{ background: STATUS_COLORS["Need Checking"] }}
              />
              Need Checking
            </div>
          </StatCard>
          <StatCard
            active={isOnlyStatus("Ready")}
            onClick={() => toggleSingleStatus("Ready")}
            accentColor={STATUS_COLORS.Ready}
          >
            <div className="snum" style={{ color: STATUS_COLORS.Ready }}>
              {readyProfiles}
            </div>
            <div className="slabel">
              <span
                className="sdot"
                style={{ background: STATUS_COLORS.Ready }}
              />
              Ready
            </div>
          </StatCard>
          <StatCard>
            <div className="snum" style={{ color: "var(--purple)" }}>
              {doneTodayCount} / {trackableProfiles}
            </div>
            <div className="slabel">
              <span className="sdot" style={{ background: "var(--purple)" }} />
              Done Today
            </div>
          </StatCard>
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
          <select
            className="fsel"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
          >
            <option value="">All Countries</option>
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
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
                  {!isMaker && (
                    <label className="status-filter-item">
                      <input
                        type="checkbox"
                        checked={statusFilter.length === 0}
                        onChange={clearStatusFilter}
                      />
                      <span>All</span>
                    </label>
                  )}
                  {allowedStatuses.map((status) => {
                    const color = STATUS_COLORS[status] || "#64748B";
                    const isSelected = statusFilter.includes(status);
                    return (
                      <label
                        key={status}
                        className="status-filter-item"
                        style={{
                          background: isSelected ? `${color}26` : undefined,
                          borderLeft: `3px solid ${
                            isSelected ? color : "transparent"
                          }`,
                          paddingLeft: 8,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStatusFilter(status)}
                          style={{ accentColor: color }}
                        />
                        <span style={{ color }}>{status}</span>
                      </label>
                    );
                  })}
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
          <button
            type="button"
            className="fsel"
            onClick={cycleTrackerFilter}
            title="Click to cycle: All Tracker → Done Today → Not Done Today"
          >
            {TRACKER_FILTER_LABELS[trackerFilter] || TRACKER_FILTER_LABELS[""]}
          </button>
          <span className="rc">{sorted.length} profiles</span>
        </div>

        {quickEditMode ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              marginBottom: 12,
              borderRadius: 10,
              background:
                selectedIds.size > 0
                  ? `${STATUS_COLORS.Ready}1a`
                  : "var(--surface2)",
              border: `1px solid ${
                selectedIds.size > 0 ? STATUS_COLORS.Ready : "var(--border)"
              }`,
              fontSize: 13,
              position: "sticky",
              top: 0,
              zIndex: 5,
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {selectedIds.size} selected
            </span>
            <span style={{ color: "var(--text2)" }}>
              of {sorted.length} visible
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-s"
                onClick={clearSelection}
                disabled={selectedIds.size === 0}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-p"
                onClick={() => setIsBulkEditOpen(true)}
                disabled={selectedIds.size === 0}
              >
                Bulk Edit
              </button>
            </div>
          </div>
        ) : null}

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
                  {quickEditMode ? (
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={
                          sorted.length > 0 &&
                          sorted.every((p) => selectedIds.has(p._id))
                        }
                        ref={(node) => {
                          if (!node) return;
                          const some = sorted.some((p) =>
                            selectedIds.has(p._id),
                          );
                          const all =
                            sorted.length > 0 &&
                            sorted.every((p) => selectedIds.has(p._id));
                          node.indeterminate = some && !all;
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((current) => {
                              const next = new Set(current);
                              sorted.forEach((p) => next.add(p._id));
                              return next;
                            });
                          } else {
                            setSelectedIds((current) => {
                              const next = new Set(current);
                              sorted.forEach((p) => next.delete(p._id));
                              return next;
                            });
                          }
                        }}
                        title="Select all visible"
                      />
                    </th>
                  ) : null}
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

                  const isSelected = selectedIds.has(profile._id);

                  return (
                    <tr
                      key={profile._id}
                      className={done ? "processed-today" : ""}
                      style={
                        isSelected
                          ? { background: `${STATUS_COLORS.Ready}1a` }
                          : undefined
                      }
                    >
                      {quickEditMode ? (
                        <td style={{ width: 36 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelected(profile._id)}
                            style={{ accentColor: STATUS_COLORS.Ready }}
                          />
                        </td>
                      ) : null}
                      <td data-label="Profile">
                        <div className="pcell">
                          <div
                            className="av"
                            style={{ background: getAvatarColor(profile._id) }}
                          >
                            <SafeImage
                              src={userAvatar}
                              alt={`${profile.firstName} ${profile.lastName}`}
                              className="av-img"
                              initials={(profile.firstName || profile.lastName || "?").charAt(0)}
                              initialsSeed={profile._id}
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
                            { label: "2FA", value: !!profile.has2FA },
                            { label: "Page", value: hasPageUrl(profile) },
                            {
                              label: getFriendsDisplay(profile),
                              value:
                                Number(profile?.friends || 0) >=
                                FRIENDS_REQUIREMENT,
                            },
                            {
                              label: `${(profile.posts || []).length} Post${(profile.posts || []).length === 1 ? "" : "s"}`,
                              value: (profile.posts || []).length >= 1,
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
                      <td data-label="Daily Tracker" style={{ maxWidth: "260px" }}>
                        <div className="tracker-cell">
                          <span
                            className={`track-badge ${done ? "track-done" : "track-pending"}`}
                          >
                            {done ? "Done" : "Pending"}
                          </span>
                          {done && lastEntry && (
                            <span
                              className="track-time"
                              title={
                                (lastEntry.note || "").length > 200
                                  ? lastEntry.note
                                  : undefined
                              }
                              style={{
                                display: "inline-block",
                                maxWidth: "240px",
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                              }}
                            >
                              {(lastEntry.note || "").length > 200
                                ? `${lastEntry.note.slice(0, 200)}...`
                                : lastEntry.note}
                            </span>
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
                        <a
                          className="vbtn"
                          href={`/profile/${profile._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View
                        </a>
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
