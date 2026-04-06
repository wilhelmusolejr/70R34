import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { updateAssignmentStatus } from "../api/auth";
import { fetchPages, updatePage } from "../api/pages";
import { getProfileImagesDownloadUrl } from "../api/profileDownloads";
import {
  fetchProfile,
  unassignProfileImage,
  updateProfile,
} from "../api/profiles";
import { AVC, STATUS_CLASS, STATUS_OPTIONS } from "../constants/profileUi";
import { useAuth } from "../context/AuthContext";
import { canViewConfidential, mask, reveal } from "../utils/access";
import "../App.css";

const MAKER_EDITABLE_FIELDS = new Set([
  "emails",
  "emailPassword",
  "facebookPassword",
  "profileUrl",
  "pageUrl",
]);

function getAvatarColor(id) {
  return AVC[(id - 1) % AVC.length];
}

function getInitials(f, l) {
  return (f[0] + l[0]).toUpperCase();
}

function toCapitalizedWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getGenderBadgeClass(gender) {
  const normalized = String(gender || "")
    .trim()
    .toLowerCase();
  if (normalized === "female") return "female";
  if (normalized === "male") return "male";
  return "neutral";
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

function formatImageTypeLabel(type) {
  const normalized = String(type || "other")
    .trim()
    .toLowerCase();
  if (normalized === "profile") return "Profile Photos";
  if (normalized === "cover") return "Cover Photos";
  if (normalized === "post") return "Post Images";
  if (normalized === "reels") return "Reels";
  if (normalized === "document") return "Documents";
  return normalized
    ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} Images`
    : "Other Images";
}

function hasPageUrl(profile) {
  return String(profile?.pageUrl || "").trim().length > 0;
}

const TODAY = new Date().toLocaleDateString("en-CA");

function score(p) {
  return [p.has2FA, hasPageUrl(p), p.friends >= 30, p.profileSetup].filter(
    Boolean,
  ).length;
}

function getDefaultProfile() {
  return {
    id: 0,
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    emails: [],
    emailPassword: "",
    facebookPassword: "",
    proxy: "",
    proxyLocation: "",
    city: "",
    hometown: "",
    bio: "",
    status: "Available",
    profileUrl: "",
    pageUrl: "",
    pageId: "",
    linkedPage: null,
    tags: [],
    profileCreated: "",
    accountCreated: "",
    friends: 0,
    has2FA: false,
    hasPage: false,
    profileSetup: false,
    phone: "",
    recoveryEmail: "",
    notes: "",
    websites: [],
    socialLinks: [],
    images: [],
    trackerLog: [],
    avatarUrl: "",
    coverPhotoUrl: "",
    personal: {
      relationshipStatus: "",
      relationshipStatusSince: "",
      languages: [],
    },
    work: [],
    education: {
      college: { name: "", from: "", to: "", graduated: false, degree: "" },
      highSchool: { name: "", from: "", to: "", graduated: false, degree: "" },
    },
    hobbies: [],
    interests: {
      music: [],
      tvShows: [],
      movies: [],
      games: [],
      sportsTeams: [],
    },
    travel: [],
    otherNames: [],
  };
}

function serializeProfile(profile) {
  const { linkedPage: _linkedPage, ...rest } = profile || {};

  return {
    ...rest,
    pageId:
      typeof rest.pageId === "object" && rest.pageId
        ? String(rest.pageId.id || rest.pageId._id || "")
        : String(rest.pageId || ""),
  };
}

function normalizeProfile(raw) {
  const base = getDefaultProfile();

  return {
    ...base,
    ...raw,
    personal: {
      ...base.personal,
      ...(raw?.personal || {}),
    },
    work: raw?.work || [],
    education: {
      college: {
        ...base.education.college,
        ...(raw?.education?.college || {}),
      },
      highSchool: {
        ...base.education.highSchool,
        ...(raw?.education?.highSchool || {}),
      },
    },
    hobbies: raw?.hobbies || [],
    interests: {
      ...base.interests,
      ...(raw?.interests || {}),
    },
    images: raw?.images || [],
    travel: raw?.travel || [],
    otherNames: raw?.otherNames || [],
  };
}

function getSelectedEmail(profile) {
  if (!profile?.emails?.length) return "";
  return profile.emails.find((entry) => entry.selected)?.address || "";
}

function selectEmail(profile, address) {
  const nextAddress = String(address || "").trim();
  return (profile.emails || []).map((entry) => ({
    ...entry,
    selected: !!nextAddress && entry.address === nextAddress,
  }));
}

function EmailSelectField({
  profile,
  onChange,
  disabled = false,
  confidential = true,
}) {
  const [copied, setCopied] = useState(false);
  const selectedEmail = getSelectedEmail(profile);

  async function copy() {
    if (!selectedEmail) return;
    try {
      await navigator.clipboard.writeText(selectedEmail);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="ef-read">
      <select
        className="ef-input"
        value={selectedEmail}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select email</option>
        {(profile.emails || []).map((entry, index) => (
          <option key={`${entry.address}-${index}`} value={entry.address}>
            {confidential ? entry.address : mask(entry.address)}
          </option>
        ))}
      </select>
      {selectedEmail && confidential && (
        <button className={`cpbtn${copied ? " ok" : ""}`} onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  );
}

function EditableText({
  value,
  onSave,
  placeholder = "Click to add...",
  multiline = false,
  mono = false,
  copyable = false,
  editable = true,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [copied, setCopied] = useState(false);
  const empty = !value || String(value).trim() === "";

  function save() {
    onSave(draft);
    setEditing(false);
  }

  function cancel() {
    setDraft(value || "");
    setEditing(false);
  }

  async function copy(e) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(value));
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (editing) {
    return (
      <div className="ef-wrap">
        {multiline ? (
          <textarea
            className="ef-input ef-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            readOnly={!editable}
          />
        ) : (
          <input
            className={`ef-input${mono ? " ef-mono" : ""}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            autoFocus
            readOnly={!editable}
          />
        )}
        <div className="ef-btns">
          <button className="ef-save" onClick={save}>
            Save
          </button>
          <button className="ef-cancel" onClick={cancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`ef-read${multiline ? " multi" : ""}`}>
      <div
        className="ef-display"
        onClick={() => {
          if (!editable) return;
          setDraft(value || "");
          setEditing(true);
        }}
        title={editable ? "Click to edit" : undefined}
      >
        {value ? (
          <span>{value}</span>
        ) : (
          <em className="ef-empty">{placeholder}</em>
        )}
        {editable && <span className="ef-pen">Edit</span>}
      </div>
      {copyable && !empty && (
        <button className={`cpbtn${copied ? " ok" : ""}`} onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  );
}

function EditableTags({
  items = [],
  onSave,
  placeholder = "Add...",
  max = 5,
  copyable = false,
  editable = true,
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [copiedItem, setCopiedItem] = useState("");

  function add() {
    if (!editable) return;
    if (!draft.trim()) {
      setAdding(false);
      return;
    }
    onSave([...items, draft.trim()].slice(0, max));
    setDraft("");
    setAdding(false);
  }

  function remove(i) {
    if (!editable) return;
    onSave(items.filter((_, idx) => idx !== i));
  }

  async function copy(item) {
    try {
      await navigator.clipboard.writeText(String(item));
    } catch {
      return;
    }
    setCopiedItem(item);
    setTimeout(() => setCopiedItem(""), 1500);
  }

  return (
    <div className="tag-list">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="tag-pill">
          {item}
          {copyable && (
            <button className="tag-pill-copy" onClick={() => copy(item)}>
              {copiedItem === item ? "Copied!" : "Copy"}
            </button>
          )}
          {editable && (
            <button className="tag-pill-rm" onClick={() => remove(i)}>
              x
            </button>
          )}
        </span>
      ))}
      {editable &&
        items.length < max &&
        (adding ? (
          <input
            className="tag-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") {
                setAdding(false);
                setDraft("");
              }
            }}
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <button className="tag-add-btn" onClick={() => setAdding(true)}>
            + Add
          </button>
        ))}
    </div>
  );
}

function InfoRow({ label, value, mono = false, copyable = false }) {
  const [copied, setCopied] = useState(false);
  const empty = !value || String(value).trim() === "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value));
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="dr">
      <div className="dl">{label}</div>
      <div className={`dv${mono ? " mono" : ""}${empty ? " muted" : ""}`}>
        {empty ? "—" : String(value)}
      </div>
      {copyable && !empty && (
        <button className={`cpbtn${copied ? " ok" : ""}`} onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  );
}

function WorkCard({ item, onUpdate, onRemove, editable = true }) {
  return (
    <div className="work-card">
      <div className="work-header">
        <div>
          <div className="work-title">
            <EditableText
              value={item.position}
              onSave={(v) => onUpdate("position", v)}
              placeholder="Position"
              copyable
              editable={editable}
            />
          </div>
          <div className="work-pos">
            <EditableText
              value={item.company}
              onSave={(v) => onUpdate("company", v)}
              placeholder="Company"
              copyable
              editable={editable}
            />
          </div>
        </div>
        {editable && (
          <button className="rm-btn" onClick={onRemove} title="Remove">
            x
          </button>
        )}
      </div>
      <div className="work-meta">
        <EditableText
          value={item.from}
          onSave={(v) => onUpdate("from", v)}
          placeholder="From"
          editable={editable}
        />
        {!item.current && (
          <>
            <span className="work-sep">-</span>
            <EditableText
              value={item.to}
              onSave={(v) => onUpdate("to", v)}
              placeholder="To"
              editable={editable}
            />
          </>
        )}
        {item.current && <span className="current-badge">Current</span>}
        <label className="current-toggle">
          <input
            type="checkbox"
            checked={!!item.current}
            onChange={(e) => onUpdate("current", e.target.checked)}
            disabled={!editable}
          />
          Currently here
        </label>
        {item.city && <span className="work-sep">·</span>}
        <EditableText
          value={item.city}
          onSave={(v) => onUpdate("city", v)}
          placeholder="City (optional)"
          editable={editable}
        />
      </div>
    </div>
  );
}

function TravelCard({ item, onUpdate, onRemove, editable = true }) {
  return (
    <div className="work-card">
      <div className="work-header">
        <div className="work-title">
          <EditableText
            value={item.place}
            onSave={(v) => onUpdate("place", v)}
            placeholder="Place visited"
            copyable
            editable={editable}
          />
        </div>
        {editable && (
          <button className="rm-btn" onClick={onRemove} title="Remove">
            x
          </button>
        )}
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Date:</span>
        <EditableText
          value={item.date}
          onSave={(v) => onUpdate("date", v)}
          placeholder="YYYY-MM (optional)"
          editable={editable}
        />
      </div>
    </div>
  );
}

function SectionCard({ title, badge, children }) {
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

function StatusSelect({ value, onChange, disabled = false }) {
  return (
    <span className={`sbadge ${STATUS_CLASS[value] || "sp"}`}>
      <span className="sdot2" />
      <select
        className="ef-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          minWidth: "auto",
          color: "inherit",
          fontSize: "12px",
          fontWeight: 700,
          boxShadow: "none",
          cursor: "pointer",
        }}
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </span>
  );
}

export function ProfileDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, login } = useAuth();
  const numId = Number.parseInt(id, 10);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [trackerNote, setTrackerNote] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [removingImageId, setRemovingImageId] = useState("");
  const [pages, setPages] = useState([]);
  const [pageDatasetInput, setPageDatasetInput] = useState("");
  const [isSavingPageOwnership, setIsSavingPageOwnership] = useState(false);
  const role = currentUser?.role || "";
  const isAdmin = role === "admin";
  const isMaker = role === "maker";
  const makerOwnsProfile =
    isMaker &&
    (currentUser?.profiles || []).some(
      (entry) => entry.profileId === profile?.id,
    );
  const generalConfidential = canViewConfidential(currentUser);
  const writeable = isAdmin;
  const confidential = generalConfidential;
  const canPersist = isAdmin || makerOwnsProfile;
  const canEditField = (field) =>
    isAdmin || (makerOwnsProfile && MAKER_EDITABLE_FIELDS.has(field));
  const canViewEmailCredentials = isAdmin || makerOwnsProfile;
  const canViewProxy = isAdmin || makerOwnsProfile;
  const readOnlyMessage = makerOwnsProfile
    ? "Limited access — makers can edit email, passwords, and profile/page URLs only."
    : "Read-only — contact an admin to make changes.";
  const displayFullName = [profile?.firstName, profile?.lastName]
    .map((part) => toCapitalizedWords(part))
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchProfile(numId);
        if (!cancelled) setProfile(normalizeProfile(data));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [numId]);

  useEffect(() => {
    let cancelled = false;

    async function loadPages() {
      try {
        const data = await fetchPages();
        if (!cancelled) {
          setPages(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setPages([]);
        }
      }
    }

    loadPages();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fullName = [profile?.firstName, profile?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    document.title = fullName ? `${fullName} | 70R34` : "PROFILE | 70R34";
  }, [profile?.firstName, profile?.lastName]);

  async function persistProfile(updater) {
    if (!profile || !canPersist) return;

    const previous = profile;
    const nextProfile = normalizeProfile(
      typeof updater === "function" ? updater(previous) : updater,
    );

    setProfile(nextProfile);

    try {
      const saved = await updateProfile(numId, serializeProfile(nextProfile));
      setProfile(normalizeProfile(saved));
      setError("");
    } catch (err) {
      setProfile(previous);
      setError(err.message || "Failed to save profile changes.");
    }
  }

  async function handleUnassignProfileImage(imageId) {
    if (!profile || !imageId) return;

    try {
      setRemovingImageId(imageId);
      const updated = await unassignProfileImage(numId, imageId);
      setProfile(normalizeProfile(updated));
      setError("");
    } catch (err) {
      setError(err.message || "Failed to unassign image.");
    } finally {
      setRemovingImageId("");
    }
  }

  async function refreshProfileAndPages() {
    const [nextProfile, nextPages] = await Promise.all([
      fetchProfile(numId),
      fetchPages(),
    ]);
    setProfile(normalizeProfile(nextProfile));
    setPages(Array.isArray(nextPages) ? nextPages : []);
  }

  async function handleAssignPageToProfile() {
    const normalized = pageDatasetInput.trim().toLowerCase();
    const match = assignablePages.find(
      (page) =>
        String(page.pageName || "")
          .trim()
          .toLowerCase() === normalized,
    );

    if (!match || !profile?._id) {
      setError("Choose a valid available page from the dataset.");
      return;
    }

    try {
      setIsSavingPageOwnership(true);
      await updatePage(match.id, { linkedIdentityId: profile._id });
      await refreshProfileAndPages();
      setPageDatasetInput("");
      setError("");
    } catch (err) {
      setError(err.message || "Failed to assign page.");
    } finally {
      setIsSavingPageOwnership(false);
    }
  }

  async function handleUnassignPageFromProfile() {
    if (!profile?.linkedPage?.id) return;

    try {
      setIsSavingPageOwnership(true);
      await updatePage(profile.linkedPage.id, { linkedIdentityId: "" });
      await refreshProfileAndPages();
      setPageDatasetInput("");
      setError("");
    } catch (err) {
      setError(err.message || "Failed to unassign page.");
    } finally {
      setIsSavingPageOwnership(false);
    }
  }

  function upTopLevel(field, value) {
    persistProfile((current) => ({ ...current, [field]: value }));
  }

  function upPersonal(field, value) {
    persistProfile((current) => ({
      ...current,
      personal: { ...current.personal, [field]: value },
    }));
  }

  function upWork(idx, field, value) {
    persistProfile((current) => ({
      ...current,
      work: current.work.map((w, i) =>
        i === idx ? { ...w, [field]: value } : w,
      ),
    }));
  }

  function addWork() {
    if (profile.work.length >= 3) return;
    persistProfile((current) => ({
      ...current,
      work: [
        ...current.work,
        {
          company: "",
          position: "",
          from: "",
          current: true,
          to: "",
          city: "",
        },
      ],
    }));
  }

  function removeWork(idx) {
    persistProfile((current) => ({
      ...current,
      work: current.work.filter((_, i) => i !== idx),
    }));
  }

  function upEduCollege(field, value) {
    persistProfile((current) => ({
      ...current,
      education: {
        ...current.education,
        college: { ...current.education.college, [field]: value },
      },
    }));
  }

  function upEduHS(field, value) {
    persistProfile((current) => ({
      ...current,
      education: {
        ...current.education,
        highSchool: { ...current.education.highSchool, [field]: value },
      },
    }));
  }

  function upInterest(key, value) {
    persistProfile((current) => ({
      ...current,
      interests: { ...current.interests, [key]: value },
    }));
  }

  function addTravel() {
    if (profile.travel.length >= 2) return;
    persistProfile((current) => ({
      ...current,
      travel: [...current.travel, { place: "", date: "" }],
    }));
  }

  function upTravel(idx, field, value) {
    persistProfile((current) => ({
      ...current,
      travel: current.travel.map((t, i) =>
        i === idx ? { ...t, [field]: value } : t,
      ),
    }));
  }

  function removeTravel(idx) {
    persistProfile((current) => ({
      ...current,
      travel: current.travel.filter((_, i) => i !== idx),
    }));
  }

  function trackedToday() {
    return (profile?.trackerLog || []).some((entry) => entry.date === TODAY);
  }

  function sortedTrackerLog() {
    return [...(profile?.trackerLog || [])]
      .map((entry, index) => ({ ...entry, _index: index }))
      .sort((a, b) => {
        if (a.date === b.date) return b._index - a._index;
        return String(b.date || "").localeCompare(String(a.date || ""));
      });
  }

  async function saveTrackerEntry() {
    if (!profile || !isAdmin || trackedToday()) {
      setIsTrackerModalOpen(false);
      setTrackerNote("");
      return;
    }

    await persistProfile((current) => ({
      ...current,
      trackerLog: [
        ...(current.trackerLog || []),
        { date: TODAY, note: trackerNote.trim() },
      ],
    }));

    setIsTrackerModalOpen(false);
    setTrackerNote("");
  }

  async function handleSubmitProfile() {
    if (!profile || !showMakerSubmit || !currentUser?.id) return;

    const hasSelectedEmail = (profile.emails || []).some(
      (entry) => entry.selected,
    );
    if (!hasSelectedEmail) {
      setSubmitError("Select an email before submitting this profile.");
      return;
    }

    setSubmittingProfile(true);
    setSubmitError("");

    const previousProfile = profile;

    try {
      const savedProfile = await updateProfile(numId, {
        ...profile,
        status: "Need Setup",
      });
      setProfile(normalizeProfile(savedProfile));

      const result = await updateAssignmentStatus(
        currentUser.id,
        profile.id,
        "completed",
      );
      if (result.user) {
        login(result.user);
      }
    } catch (err) {
      setProfile(previousProfile);
      setSubmitError(err.message || "Failed to submit profile.");
    } finally {
      setSubmittingProfile(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="empty-st">
          <div className="et">Loading profile</div>
          <div className="ed">Fetching profile details from the API...</div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="page">
        <div className="empty-st">
          <div className="et">Profile Not Found</div>
          <div className="ed">{error}</div>
          <br />
          <button
            className="btn-p"
            style={{ marginTop: "12px" }}
            onClick={() => navigate("/")}
          >
            Back to Profiles
          </button>
        </div>
      </div>
    );
  }

  const avatarColor = getAvatarColor(profile.id);
  const s = score(profile);
  const college = profile.education?.college || {};
  const hs = profile.education?.highSchool || {};
  const pageModelImages = [
    ...(profile.linkedPage?.assets || []).map((asset) => ({
      image: asset.imageId,
      assignedAt:
        profile.linkedPage?.updatedAt || profile.linkedPage?.createdAt || null,
      imageType: asset.type || asset.imageId?.type || "post",
      source: "page",
      pageName: profile.linkedPage?.pageName || "",
      pageLink: profile.linkedPage?.id ? `/pages/${profile.linkedPage.id}` : "",
    })),
    ...(profile.linkedPage?.posts || []).flatMap((post) =>
      (post.images || []).map((image) => ({
        image,
        assignedAt:
          post.createdAt ||
          profile.linkedPage?.updatedAt ||
          profile.linkedPage?.createdAt ||
          null,
        imageType: image.type || "post",
        source: "page",
        pageName: profile.linkedPage?.pageName || "",
        pageLink: profile.linkedPage?.id
          ? `/pages/${profile.linkedPage.id}`
          : "",
      })),
    ),
  ].filter((entry) => entry.image?.filename);
  const humanAssetImages = [
    ...(profile.images || []).map((entry) => ({
      ...entry,
      image: entry.imageId,
      imageType: entry.imageId?.type || "other",
      source: "human-asset",
      pageName: profile.linkedPage?.pageName || "",
      pageLink: profile.linkedPage?.id ? `/pages/${profile.linkedPage.id}` : "",
    })),
  ].filter((entry) => entry.image?.filename);
  const profileImages = [...humanAssetImages, ...pageModelImages];
  const assignablePages = pages.filter((page) => !page?.linkedIdentity);
  const imageSourceSections = [
    {
      key: "human-asset",
      title: "User Images",
      subtitle:
        "Images that are about the user and assigned directly to this profile.",
      items: humanAssetImages,
      empty: "No user images assigned yet.",
    },
    {
      key: "page-model",
      title: "Page Images",
      subtitle: profile.linkedPage
        ? "Images about the page that this user owns."
        : "Link a page to show page images here.",
      items: pageModelImages,
      empty: profile.linkedPage
        ? "No page images assigned yet."
        : "No linked page yet.",
    },
  ];
  const primaryProfileImage =
    (
      humanAssetImages.find((entry) => entry.imageType === "profile") ||
      humanAssetImages.find((entry) => entry.imageType === "cover") ||
      pageModelImages.find((entry) => entry.imageType === "profile") ||
      pageModelImages.find((entry) => entry.imageType === "cover") ||
      profileImages[0]
    )?.image?.filename || "";
  const trackerEntries = sortedTrackerLog();
  const hasTrackedToday = trackedToday();
  const makerAssignment = (currentUser?.profiles || []).find(
    (entry) => entry.profileId === profile.id,
  );
  const showMakerSubmit =
    isMaker && makerAssignment?.assignmentStatus === "pending";

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate("/")}>
        <svg viewBox="0 0 24 24">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        All Profiles
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
            primaryProfileImage
              ? {
                  backgroundImage: `linear-gradient(135deg, ${avatarColor}22, ${avatarColor}55), url(${primaryProfileImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background: `linear-gradient(135deg, ${avatarColor}18, ${avatarColor}35)`,
                }
          }
        >
          <div className="haw">
            {primaryProfileImage ? (
              <div
                className="hav hav-img-wrap"
                style={{ background: avatarColor }}
              >
                <img
                  src={primaryProfileImage}
                  alt={`${profile.firstName} ${profile.lastName}`}
                  className="hav-img"
                />
              </div>
            ) : (
              <div className="hav" style={{ background: avatarColor }}>
                {getInitials(profile.firstName, profile.lastName)}
              </div>
            )}
          </div>
        </div>
        <div className="hbody">
          <div className="htop">
            <div className="hero-main-col">
              <div className="hname">
                <span>
                  {displayFullName || `${profile.firstName} ${profile.lastName}`}
                </span>
                {profile.gender ? (
                  <span
                    className={`gender-badge ${getGenderBadgeClass(profile.gender)}`}
                  >
                    {profile.gender}
                  </span>
                ) : null}
              </div>
              <div className="hsub">
                {profile.work?.[0]?.position || "No role yet"} ·{" "}
                {profile.work?.[0]?.company || "No company yet"}
              </div>
              <div className="hbrow">
                <StatusSelect
                  value={profile.status}
                  onChange={(value) => upTopLevel("status", value)}
                  disabled={!writeable}
                />
                {profile.tags?.map((t, i) => (
                  <span key={`${t}-${i}`} className="tag tv">
                    {t}
                  </span>
                ))}
              </div>

              <div className="hbio-wrap hero-bio">
                <EditableText
                  value={profile.bio}
                  onSave={(v) => upTopLevel("bio", v)}
                  multiline
                  copyable
                  placeholder="Click to add a bio..."
                  editable={writeable}
                />
              </div>
            </div>
            <div className="hero-req-wrap hero-req-side">
              <div className="hero-req-head">
                <div className="hero-req-title">Requirements</div>
                <div className="hero-req-count">{s}/4</div>
              </div>
              <div className="hero-req-list">
                <label
                  className={`req-item req-compact ${profile.has2FA ? "ryes" : "rno"}`}
                >
                  <div className="req-icon">
                    <input
                      type="checkbox"
                      checked={!!profile.has2FA}
                      onChange={(e) => upTopLevel("has2FA", e.target.checked)}
                      disabled={!writeable}
                    />
                  </div>
                  <span className="req-name">2FA Enabled</span>
                </label>
                <label
                  className={`req-item req-compact ${hasPageUrl(profile) ? "ryes" : "rno"}`}
                >
                  <div className="req-icon">
                    {hasPageUrl(profile) ? (
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
                  <span className="req-name">Page Created</span>
                </label>
                <div
                  className={`req-item req-compact ${profile.friends >= 30 ? "ryes" : "rno"}`}
                >
                  <div className="req-icon">
                    {profile.friends >= 30 ? (
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
                  <span className="req-name">30+ Friends</span>
                </div>
                <label
                  className={`req-item req-compact ${profile.profileSetup ? "ryes" : "rno"}`}
                >
                  <div className="req-icon">
                    <input
                      type="checkbox"
                      checked={!!profile.profileSetup}
                      onChange={(e) =>
                        upTopLevel("profileSetup", e.target.checked)
                      }
                      disabled={!writeable}
                    />
                  </div>
                  <span className="req-name">Profile Set Up</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!writeable && (
        <div
          className="empty-st"
          style={{ padding: "16px 0 20px", textAlign: "left" }}
        >
          <div className="ed">{readOnlyMessage}</div>
        </div>
      )}

      <div className="dgrid">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <SectionCard title="Personal Details">
            <div className="dr">
              <div className="dl">Current City</div>
              <div className="dv">
                <EditableText
                  value={profile.city}
                  onSave={(v) => upTopLevel("city", v)}
                  copyable
                  editable={writeable}
                />
              </div>
            </div>
            <div className="dr">
              <div className="dl">Hometown</div>
              <div className="dv">
                <EditableText
                  value={profile.hometown}
                  onSave={(v) => upTopLevel("hometown", v)}
                  copyable
                  editable={writeable}
                />
              </div>
            </div>
            <div className="dr">
              <div className="dl">Relationship Status</div>
              <div
                className="dv"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <EditableText
                  value={profile.personal?.relationshipStatus}
                  onSave={(v) => upPersonal("relationshipStatus", v)}
                  placeholder="Relationship status"
                  editable={writeable}
                />
                {profile.personal?.relationshipStatus !== "Single" && (
                  <span style={{ fontSize: "11px", color: "var(--text3)" }}>
                    since{" "}
                    <EditableText
                      value={profile.personal?.relationshipStatusSince}
                      onSave={(v) => upPersonal("relationshipStatusSince", v)}
                      placeholder="add year"
                      editable={writeable}
                    />
                  </span>
                )}
              </div>
            </div>
            <div className="dr" style={{ borderBottom: "none" }}>
              <div className="dl">Languages</div>
              <div className="dv">
                <EditableTags
                  items={profile.personal?.languages || []}
                  onSave={(v) => upPersonal("languages", v)}
                  placeholder="Language..."
                  max={6}
                  editable={writeable}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Work Experience">
            {profile.work.map((item, idx) => (
              <WorkCard
                key={idx}
                item={item}
                onUpdate={(field, value) => upWork(idx, field, value)}
                onRemove={() => removeWork(idx)}
                editable={writeable}
              />
            ))}
            {writeable && profile.work.length < 3 && (
              <button className="add-item-btn" onClick={addWork}>
                + Add Work Experience
              </button>
            )}
          </SectionCard>

          <SectionCard title="Education">
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text2)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                College
              </div>
              <div className="dr" style={{ paddingTop: 0 }}>
                <div className="dl">School</div>
                <div className="dv">
                  <EditableText
                    value={college.name}
                    onSave={(v) => upEduCollege("name", v)}
                    placeholder="College name"
                    copyable
                    editable={writeable}
                  />
                </div>
              </div>
              <div className="dr">
                <div className="dl">Years</div>
                <div className="dv">
                  <span className="ef-inline-row">
                    <EditableText
                      value={college.from}
                      onSave={(v) => upEduCollege("from", v)}
                      placeholder="From"
                      editable={writeable}
                    />
                    {college.to && (
                      <span style={{ color: "var(--text3)" }}>-</span>
                    )}
                    <EditableText
                      value={college.to}
                      onSave={(v) => upEduCollege("to", v)}
                      placeholder="To (optional)"
                      editable={writeable}
                    />
                  </span>
                </div>
              </div>
              <div className="dr">
                <div className="dl">Degree</div>
                <div className="dv">
                  <EditableText
                    value={college.degree}
                    onSave={(v) => upEduCollege("degree", v)}
                    placeholder="Degree & field"
                    editable={writeable}
                  />
                </div>
              </div>
              <div className="dr">
                <div className="dl">Graduated</div>
                <div className="dv">
                  <label className="current-toggle">
                    <input
                      type="checkbox"
                      checked={!!college.graduated}
                      onChange={(e) =>
                        upEduCollege("graduated", e.target.checked)
                      }
                      disabled={!writeable}
                    />
                    {college.graduated ? "Yes" : "No"}
                  </label>
                </div>
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text2)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                High School
              </div>
              <div className="dr" style={{ paddingTop: 0 }}>
                <div className="dl">School</div>
                <div className="dv">
                  <EditableText
                    value={hs.name}
                    onSave={(v) => upEduHS("name", v)}
                    placeholder="School name"
                    editable={writeable}
                  />
                </div>
              </div>
              <div className="dr">
                <div className="dl">Years</div>
                <div className="dv">
                  <span className="ef-inline-row">
                    <EditableText
                      value={hs.from}
                      onSave={(v) => upEduHS("from", v)}
                      placeholder="From"
                      editable={writeable}
                    />
                    {hs.to && <span style={{ color: "var(--text3)" }}>-</span>}
                    <EditableText
                      value={hs.to}
                      onSave={(v) => upEduHS("to", v)}
                      placeholder="To (optional)"
                      editable={writeable}
                    />
                  </span>
                </div>
              </div>
              <div className="dr" style={{ borderBottom: "none" }}>
                <div className="dl">Graduated</div>
                <div className="dv">
                  <label className="current-toggle">
                    <input
                      type="checkbox"
                      checked={!!hs.graduated}
                      onChange={(e) => upEduHS("graduated", e.target.checked)}
                      disabled={!writeable}
                    />
                    {hs.graduated ? "Yes" : "No"}
                  </label>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Hobbies">
            <EditableTags
              items={profile.hobbies || []}
              onSave={(v) =>
                persistProfile((current) => ({ ...current, hobbies: v }))
              }
              placeholder="Hobby..."
              max={5}
              copyable
              editable={writeable}
            />
          </SectionCard>

          <SectionCard title="Travel">
            {profile.travel.map((item, idx) => (
              <TravelCard
                key={idx}
                item={item}
                onUpdate={(field, value) => upTravel(idx, field, value)}
                onRemove={() => removeTravel(idx)}
                editable={writeable}
              />
            ))}
            {writeable && profile.travel.length < 2 && (
              <button className="add-item-btn" onClick={addTravel}>
                + Add Travel
              </button>
            )}
          </SectionCard>

          <SectionCard title="Other Names">
            <EditableTags
              items={profile.otherNames || []}
              onSave={(v) =>
                persistProfile((current) => ({ ...current, otherNames: v }))
              }
              placeholder="Alias or nickname..."
              max={5}
              editable={writeable}
            />
          </SectionCard>

          <SectionCard title="Interests">
            <div
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              {[
                { key: "music", label: "Music" },
                { key: "tvShows", label: "TV Shows" },
                { key: "movies", label: "Movies" },
                { key: "games", label: "Games" },
                { key: "sportsTeams", label: "Sports Teams" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <div className="interest-group-label">{label}</div>
                  <EditableTags
                    items={profile.interests?.[key] || []}
                    onSave={(v) => upInterest(key, v)}
                    placeholder={`Add ${label.toLowerCase()}...`}
                    max={5}
                    copyable
                    editable={writeable}
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <SectionCard
            title="Tracker Log"
            badge={
              writeable ? (
                <button
                  type="button"
                  className={`btn-s${hasTrackedToday ? " done-btn" : ""}`}
                  onClick={() => {
                    if (!hasTrackedToday) setIsTrackerModalOpen(true);
                  }}
                  disabled={hasTrackedToday}
                  style={{
                    padding: "6px 10px",
                    fontSize: "11px",
                    opacity: hasTrackedToday ? 0.85 : 1,
                    cursor: hasTrackedToday ? "default" : "pointer",
                  }}
                >
                  {hasTrackedToday ? "Tracked Today" : "Mark Tracked Today"}
                </button>
              ) : null
            }
          >
            {trackerEntries.length ? (
              trackerEntries.map((entry, index) => (
                <div
                  key={`${entry.date}-${entry.note}-${index}`}
                  className="dr"
                  style={{
                    borderBottom:
                      index === trackerEntries.length - 1 ? "none" : undefined,
                  }}
                >
                  <div className="dl">{entry.date || "No date"}</div>
                  <div className="dv">{entry.note || "—"}</div>
                </div>
              ))
            ) : (
              <div className="muted">No tracker log entries yet.</div>
            )}
          </SectionCard>

          <SectionCard title="Notes">
            <EditableText
              value={profile.notes}
              onSave={(v) => upTopLevel("notes", v)}
              multiline
              placeholder="Add internal notes..."
              editable={writeable}
            />
          </SectionCard>

          <SectionCard title="Credentials">
            <div className="dr">
              <div className="dl">Email</div>
              <div className="dv">
                <EmailSelectField
                  profile={profile}
                  onChange={(value) =>
                    upTopLevel("emails", selectEmail(profile, value))
                  }
                  disabled={!canEditField("emails")}
                  confidential={canViewEmailCredentials}
                />
              </div>
            </div>
            <div className="dr">
              <div className="dl">Email Password</div>
              <div className="dv">
                <EditableText
                  value={reveal(profile.emailPassword, canViewEmailCredentials)}
                  onSave={(v) => upTopLevel("emailPassword", v)}
                  placeholder="Email password"
                  mono
                  copyable={canViewEmailCredentials}
                  editable={canEditField("emailPassword")}
                />
              </div>
            </div>
            <div className="dr">
              <div className="dl">Facebook Password</div>
              <div className="dv">
                <EditableText
                  value={reveal(
                    profile.facebookPassword,
                    canViewEmailCredentials,
                  )}
                  onSave={(v) => upTopLevel("facebookPassword", v)}
                  placeholder="Facebook password"
                  mono
                  copyable={canViewEmailCredentials}
                  editable={canEditField("facebookPassword")}
                />
              </div>
            </div>
            {showMakerSubmit && (
              <div className="dr">
                <div className="dl">Submit Profile?</div>
                <div className="dv">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="btn-p"
                      onClick={handleSubmitProfile}
                      disabled={submittingProfile}
                    >
                      {submittingProfile ? "Submitting..." : "Submit"}
                    </button>
                    {submitError ? (
                      <span style={{ color: "var(--red)", fontSize: "12px" }}>
                        {submitError}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text3)", fontSize: "12px" }}>
                        Requires a selected email before submission.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="dr">
              <div className="dl">Proxy</div>
              <div className="dv">
                <EditableText
                  value={reveal(profile.proxy, canViewProxy)}
                  onSave={(v) => upTopLevel("proxy", v)}
                  placeholder="Proxy"
                  mono
                  copyable={canViewProxy}
                  editable={writeable}
                />
              </div>
            </div>
            <div className="dr">
              <div className="dl">Proxy Location</div>
              <div className="dv">
                <EditableText
                  value={reveal(profile.proxyLocation, confidential)}
                  onSave={(v) => upTopLevel("proxyLocation", v)}
                  placeholder="Proxy location"
                  copyable={confidential}
                  editable={writeable}
                />
              </div>
            </div>
            <div className="dr">
              <div className="dl">Phone</div>
              <div className="dv">
                <EditableText
                  value={reveal(profile.phone, confidential)}
                  onSave={(v) => upTopLevel("phone", v)}
                  placeholder="Phone"
                  copyable={confidential}
                  editable={writeable}
                />
              </div>
            </div>
            <div className="dr">
              <div className="dl">Recovery Email</div>
              <div className="dv">
                <EditableText
                  value={reveal(profile.recoveryEmail, confidential)}
                  onSave={(v) => upTopLevel("recoveryEmail", v)}
                  placeholder="Recovery email"
                  copyable={confidential}
                  editable={writeable}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Account & Links">
            <InfoRow
              label="Profile Created"
              value={fmtDate(profile.profileCreated)}
            />
            <InfoRow
              label="Account Created"
              value={fmtDate(profile.accountCreated)}
            />
            <div className="dr">
              <div className="dl">Friends</div>
              <div className="dv">{Number(profile.friends || 0)} Friends</div>
            </div>
            <div className="dr">
              <div className="dl">Profile URL</div>
              <div className="dv mono">
                <EditableText
                  value={profile.profileUrl}
                  onSave={(v) => upTopLevel("profileUrl", v)}
                  placeholder="Profile URL"
                  mono
                  copyable
                  editable={canEditField("profileUrl")}
                />
              </div>
            </div>
            <div className="dr" style={{ borderBottom: "none" }}>
              <div className="dl">Page URL</div>
              <div className="dv mono">
                <EditableText
                  value={profile.pageUrl}
                  onSave={(v) => upTopLevel("pageUrl", v)}
                  placeholder="Page URL"
                  mono
                  copyable
                  editable={canEditField("pageUrl")}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Images Gallery">
            <>
              <div className="profile-gallery-shell">
                <div className="profile-image-gallery-head profile-image-gallery-head-redesign">
                  <div className="profile-gallery-summary">
                    <div className="profile-gallery-kicker">Image Library</div>
                    <div className="profile-gallery-total">
                      {profileImages.length} images
                    </div>
                    <div className="profile-gallery-subcopy">
                      Direct profile images and linked page assets are shown
                      here.
                    </div>
                  </div>
                  {profileImages.length ? (
                    <a
                      href={getProfileImagesDownloadUrl(profile.id)}
                      className="btn-s"
                    >
                      Download ZIP
                    </a>
                  ) : null}
                </div>

                <div className="profile-page-dataset profile-page-dataset-redesign">
                  <div className="profile-page-dataset-head">
                    <div className="profile-image-group-title">
                      Page Ownership
                    </div>
                    <div className="profile-image-date">
                      {profile.linkedPage
                        ? "This profile currently owns one page."
                        : "Assign an available page to this profile."}
                    </div>
                  </div>
                  {profile.linkedPage ? (
                    <div className="profile-page-ownership-card">
                      <div className="profile-page-ownership-main">
                        <div className="profile-page-ownership-name">
                          {profile.linkedPage.pageName}
                        </div>
                        <div className="profile-page-ownership-meta">
                          {(profile.linkedPage.assets || []).length} assets
                          {" · "}
                          {(profile.linkedPage.posts || []).length} posts
                        </div>
                      </div>
                      <div className="profile-page-ownership-actions">
                        <Link
                          to={`/pages/${profile.linkedPage.id}`}
                          className="image-asset-user-link"
                        >
                          Open page
                        </Link>
                        {canPersist ? (
                          <button
                            type="button"
                            className="profile-image-action"
                            onClick={handleUnassignPageFromProfile}
                            disabled={isSavingPageOwnership}
                          >
                            {isSavingPageOwnership
                              ? "Unassigning..."
                              : "Unassign page"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : assignablePages.length ? (
                    <div className="profile-page-dataset-actions">
                      <input
                        type="text"
                        list="profile-available-pages"
                        className="fsearch profile-page-dataset-input"
                        value={pageDatasetInput}
                        onChange={(e) => setPageDatasetInput(e.target.value)}
                        placeholder="Type a page name"
                        disabled={isSavingPageOwnership}
                      />
                      <datalist id="profile-available-pages">
                        {assignablePages.map((page) => (
                          <option key={page.id} value={page.pageName} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        className="btn-s"
                        onClick={handleAssignPageToProfile}
                        disabled={
                          isSavingPageOwnership || !pageDatasetInput.trim()
                        }
                      >
                        {isSavingPageOwnership ? "Assigning..." : "Assign Page"}
                      </button>
                    </div>
                  ) : (
                    <div className="muted">
                      No available pages without ownership.
                    </div>
                  )}
                </div>
              </div>
              {profileImages.length ? (
                <>
                  <div className="profile-image-groups">
                    {imageSourceSections.map((section) => (
                      <div
                        key={section.key}
                        className="profile-image-source-section"
                      >
                        {section.items.length ? (
                          <div className="profile-image-group">
                            <div className="profile-image-group-head">
                              <div className="profile-image-group-title-block">
                                <div className="profile-image-group-title">
                                  <span>{section.title}</span>
                                </div>
                                <div className="profile-image-source-subtitle">
                                  {section.subtitle}
                                </div>
                                {section.key === "page-model" &&
                                profile.linkedPage?.id ? (
                                  <div className="profile-image-group-subactions">
                                    <Link
                                      to={`/pages/${profile.linkedPage.id}`}
                                      className="image-asset-user-link"
                                    >
                                      Open page
                                    </Link>
                                    {canPersist ? (
                                      <button
                                        type="button"
                                        className="profile-image-action"
                                        onClick={handleUnassignPageFromProfile}
                                        disabled={isSavingPageOwnership}
                                      >
                                        {isSavingPageOwnership
                                          ? "Unassigning..."
                                          : "Unassign page"}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                              <div className="profile-image-group-count">
                                {section.items.length}
                              </div>
                            </div>
                            <div className="profile-image-grid">
                              {section.items.map((entry, index) => (
                                <div
                                  key={`${entry.image?._id || index}`}
                                  className="profile-image-tile"
                                >
                                  <div className="profile-image-frame">
                                    <img
                                      src={entry.image.filename}
                                      alt={`${profile.firstName} ${profile.lastName} ${index + 1}`}
                                      className="profile-image-img"
                                    />
                                  </div>
                                  <div className="profile-image-meta">
                                    <div className="profile-image-meta-top">
                                      <span
                                        className={`profile-image-source-pill ${section.key === "page-model" ? "page" : "profile"}`}
                                      >
                                        {section.key === "page-model"
                                          ? "Page"
                                          : "Profile"}
                                      </span>
                                      <span className="profile-image-date">
                                        {formatImageTypeLabel(
                                          entry.imageType || "other",
                                        ).replace(" Images", "")}
                                      </span>
                                    </div>
                                    <div className="profile-image-name">
                                      {section.key === "page-model"
                                        ? entry.image.filename.split("/").pop()
                                        : entry.image.annotation ||
                                          entry.image.filename.split("/").pop()}
                                    </div>
                                    <div className="profile-image-date">
                                      Assigned {fmtDate(entry.assignedAt)}
                                    </div>
                                    {section.key === "human-asset" &&
                                    canPersist ? (
                                      <button
                                        type="button"
                                        className="profile-image-action"
                                        onClick={() =>
                                          handleUnassignProfileImage(
                                            String(entry.image?._id || ""),
                                          )
                                        }
                                        disabled={
                                          removingImageId ===
                                          String(entry.image?._id || "")
                                        }
                                      >
                                        {removingImageId ===
                                        String(entry.image?._id || "")
                                          ? "Removing..."
                                          : "Unassign image"}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="muted">{section.empty}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="muted">
                  No images assigned to this profile yet.
                </div>
              )}
            </>
          </SectionCard>
        </div>
      </div>

      {isTrackerModalOpen && (
        <div
          className="npm-backdrop"
          onClick={() => setIsTrackerModalOpen(false)}
        >
          <div
            className="npm-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(520px, 100%)", maxHeight: "unset" }}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Tracker Entry</div>
                <h2 className="npm-title">Mark Profile As Tracked</h2>
              </div>
              <button
                className="npm-close"
                type="button"
                onClick={() => setIsTrackerModalOpen(false)}
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
                  onClick={() => {
                    setIsTrackerModalOpen(false);
                    setTrackerNote("");
                  }}
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
    </div>
  );
}
