import { useEffect, useId, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { updateAssignmentStatus } from "../api/auth";
import { fetchHumanAssets } from "../api/humanAssets";
import { fetchPages, updatePage } from "../api/pages";
import { getProfileImagesDownloadUrl } from "../api/profileDownloads";
import {
  addProxyLogEntry,
  createProfileProxy,
  fetchProfile,
  unassignProfileImage,
  updateProfile,
} from "../api/profiles";
import { updateProxy } from "../api/proxies";
import { SafeImage } from "../components/SafeImage";

const PROXY_TYPE_OPTIONS = ["residential", "isp", "datacenter", "mobile"];
const PROXY_PROTOCOL_OPTIONS = ["http", "https", "socks5"];
const PROXY_STATUS_OPTIONS = [
  "pending",
  "active",
  "inactive",
  "dead",
  "expired",
];
import { AVC, STATUS_CLASS, STATUS_OPTIONS } from "../constants/profileUi";
import { useAuth } from "../context/AuthContext";
import { canViewConfidential, mask, reveal } from "../utils/access";
import { buildIdentityPrompt } from "../utils/identityPrompt";
import "../App.css";

const MAKER_EDITABLE_FIELDS = new Set([
  "emails",
  "emailPassword",
  "facebookPassword",
  "profileUrl",
  "pageUrl",
  "proxy",
  "proxyLocation",
  "phone",
  "recoveryEmail",
]);

function getAvatarColor(id) {
  const str = String(id || "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVC[hash % AVC.length];
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

const TODAY = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Manila",
});

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
    proxies: [],
    proxyLog: [],
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
    identityPrompt: "",
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
    browsers: [],
  };
}

function serializeProfile(profile) {
  const { linkedPage: _linkedPage, linkedProxy: _linkedProxy, ...rest } = profile || {};

  const proxies = Array.isArray(rest.proxies)
    ? rest.proxies
        .map((entry) => {
          if (!entry) return null;
          const raw = entry.proxyId;
          const id =
            typeof raw === "object" && raw
              ? String(raw.id || raw._id || "")
              : String(raw || "");
          if (!id) return null;
          return {
            proxyId: id,
            assignedAt: entry.assignedAt || new Date().toISOString(),
          };
        })
        .filter(Boolean)
    : [];

  return {
    ...rest,
    pageId:
      typeof rest.pageId === "object" && rest.pageId
        ? String(rest.pageId.id || rest.pageId._id || "")
        : String(rest.pageId || ""),
    proxies,
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
    identityPrompt: raw?.identityPrompt || "",
    images: raw?.images || [],
    travel: raw?.travel || [],
    otherNames: raw?.otherNames || [],
    browsers: raw?.browsers || [],
    proxies: raw?.proxies || [],
    proxyLog: raw?.proxyLog || [],
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
  suggestions = null,
  numeric = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [copied, setCopied] = useState(false);
  const empty = value === 0 ? false : !value || String(value).trim() === "";
  const datalistId = useId();

  function save() {
    if (numeric) {
      const digits = String(draft).replace(/\D+/g, "");
      onSave(digits === "" ? 0 : Number(digits));
    } else {
      onSave(draft);
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(value === 0 || value ? String(value) : "");
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
          <>
            <input
              className={`ef-input${mono ? " ef-mono" : ""}`}
              value={draft}
              onChange={(e) =>
                setDraft(
                  numeric
                    ? e.target.value.replace(/\D+/g, "")
                    : e.target.value,
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
              list={suggestions ? datalistId : undefined}
              inputMode={numeric ? "numeric" : undefined}
              pattern={numeric ? "[0-9]*" : undefined}
              autoFocus
              readOnly={!editable}
            />
            {suggestions && (
              <datalist id={datalistId}>
                {suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
          </>
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
        {value === 0 || value ? (
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

function BrowserCard({ item, onUpdate, onRemove, editable = true }) {
  return (
    <div className="work-card">
      <div className="work-header">
        <div className="work-title">
          <EditableText
            value={item.browserId}
            onSave={(v) => onUpdate("browserId", v)}
            placeholder="Browser ID (UUID)"
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
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Provider:</span>
        <EditableText
          value={item.provider}
          onSave={(v) => onUpdate("provider", v)}
          placeholder="e.g. hidemium"
          editable={editable}
          suggestions={["hidemium", "gologin", "multilogin"]}
        />
      </div>
    </div>
  );
}

function ProxyCard({ item, onUpdate, onRemove, editable = true, canCopy = true }) {
  const [splitter, setSplitter] = useState("");

  function applySplitter(raw) {
    const value = String(raw || "").trim();
    if (!value) return;
    const parts = value.split(":");
    const host = parts[0] || "";
    const port = parts[1] || "";
    const username = parts[2] || "";
    const password = parts.slice(3).join(":");
    if (host) onUpdate("host", host);
    if (port) {
      const asNumber = Number(port);
      onUpdate("port", Number.isFinite(asNumber) ? asNumber : port);
    }
    if (username) onUpdate("username", username);
    if (password) onUpdate("password", password);
  }

  function handleSplitterChange(e) {
    const next = e.target.value;
    setSplitter(next);
    if (next.includes(":")) applySplitter(next);
  }

  function handleSplitterPaste(e) {
    const pasted = e.clipboardData?.getData("text") || "";
    if (pasted.includes(":")) {
      e.preventDefault();
      setSplitter(pasted);
      applySplitter(pasted);
    }
  }

  const hostPortLabel = [item.host, item.port].filter(Boolean).join(":") || "new proxy";

  return (
    <div className="work-card">
      <div className="work-header">
        <div className="work-title" style={{ fontFamily: "monospace" }}>
          {hostPortLabel}
        </div>
        {editable && (
          <button className="rm-btn" onClick={onRemove} title="Remove">
            x
          </button>
        )}
      </div>
      {editable && (
        <div className="work-meta">
          <span style={{ color: "var(--text3)", fontSize: "11px" }}>Paste:</span>
          <input
            className="ef-input"
            type="text"
            value={splitter}
            onChange={handleSplitterChange}
            onPaste={handleSplitterPaste}
            placeholder="host:port:user:pass"
            style={{ fontFamily: "monospace", flex: 1 }}
          />
        </div>
      )}
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Host:</span>
        <EditableText
          value={item.host || ""}
          onSave={(v) => onUpdate("host", v)}
          placeholder="e.g. gate.example.com"
          mono
          copyable={canCopy}
          editable={editable}
        />
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Port:</span>
        <EditableText
          value={item.port != null ? String(item.port) : ""}
          onSave={(v) => {
            const asNumber = Number(v);
            onUpdate("port", Number.isFinite(asNumber) && v !== "" ? asNumber : v);
          }}
          placeholder="e.g. 8080"
          mono
          copyable={canCopy}
          editable={editable}
        />
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Username:</span>
        <EditableText
          value={item.username || ""}
          onSave={(v) => onUpdate("username", v)}
          placeholder="auth user"
          mono
          copyable={canCopy}
          editable={editable}
        />
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Password:</span>
        <EditableText
          value={item.password || ""}
          onSave={(v) => onUpdate("password", v)}
          placeholder="auth password"
          mono
          copyable={canCopy}
          editable={editable}
        />
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Type:</span>
        <EditableText
          value={item.type || ""}
          onSave={(v) => onUpdate("type", v)}
          placeholder="residential / isp / datacenter / mobile"
          editable={editable}
          suggestions={PROXY_TYPE_OPTIONS}
        />
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Protocol:</span>
        <EditableText
          value={item.protocol || ""}
          onSave={(v) => onUpdate("protocol", v)}
          placeholder="http / https / socks5"
          editable={editable}
          suggestions={PROXY_PROTOCOL_OPTIONS}
        />
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Source:</span>
        <EditableText
          value={item.source || ""}
          onSave={(v) => onUpdate("source", v)}
          placeholder="e.g. marsproxy, brightdata"
          editable={editable}
          suggestions={["marsproxy", "rayobroxy", "brightdata", "soax"]}
        />
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Status:</span>
        <EditableText
          value={item.status || ""}
          onSave={(v) => onUpdate("status", v)}
          placeholder="pending / active / inactive / dead / expired"
          editable={editable}
          suggestions={PROXY_STATUS_OPTIONS}
        />
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Label:</span>
        <EditableText
          value={item.label || ""}
          onSave={(v) => onUpdate("label", v)}
          placeholder="optional label"
          editable={editable}
        />
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Country:</span>
        <EditableText
          value={item.country || ""}
          onSave={(v) => onUpdate("country", v)}
          placeholder="e.g. US"
          editable={editable}
        />
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>City:</span>
        <EditableText
          value={item.city || ""}
          onSave={(v) => onUpdate("city", v)}
          placeholder="optional city"
          editable={editable}
        />
      </div>
      <div className="work-meta">
        <span style={{ color: "var(--text3)", fontSize: "11px" }}>Notes:</span>
        <EditableText
          value={item.notes || ""}
          onSave={(v) => onUpdate("notes", v)}
          placeholder="notes"
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

function IdentityPromptCard({ profile, writeable, onSave, onRegenerate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.identityPrompt || "");
  const [copied, setCopied] = useState(false);
  const value = profile.identityPrompt || "";

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  async function save() {
    await onSave(draft);
    setEditing(false);
  }

  return (
    <div className="dc">
      <div className="dct" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>User Identity</span>
        {writeable && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="btn-s" style={{ padding: "4px 10px", fontSize: "11px" }} onClick={onRegenerate}>
              Regenerate
            </button>
            {!editing && (
              <button type="button" className="btn-s" style={{ padding: "4px 10px", fontSize: "11px" }} onClick={startEdit}>
                Edit
              </button>
            )}
          </div>
        )}
      </div>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 16px 16px" }}>
          <textarea
            className="ef-input ef-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            rows={8}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="ef-save" onClick={save}>Save</button>
            <button type="button" className="ef-cancel" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="dr" style={{ borderBottom: "none" }}>
          <div className="dv" style={{ whiteSpace: "pre-wrap", lineHeight: "1.6", flex: 1 }}>
            {value ? value : <em className="ef-empty">No identity prompt yet. Click Regenerate to build one from profile data.</em>}
          </div>
          {value && (
            <button type="button" className={`cpbtn${copied ? " ok" : ""}`} onClick={copy}>
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function JsonBlock({ profile }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(profile, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="dc" style={{ marginTop: "14px" }}>
      <div className="dct" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Raw JSON</span>
        <button className={`cpbtn${copied ? " ok" : ""}`} onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: "16px",
        fontSize: "11px",
        lineHeight: "1.6",
        color: "var(--text2)",
        background: "var(--surface2, var(--bg2))",
        borderRadius: "6px",
        overflowX: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}>
        {json}
      </pre>
    </div>
  );
}

export function ProfileDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, login } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [trackerNote, setTrackerNote] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [removingImageId, setRemovingImageId] = useState("");
  const [pages, setPages] = useState([]);
  const [imageIdToAssetId, setImageIdToAssetId] = useState({});
  const [pageDatasetInput, setPageDatasetInput] = useState("");
  const [isSavingPageOwnership, setIsSavingPageOwnership] = useState(false);
  const [isCheckingProxyIp, setIsCheckingProxyIp] = useState(false);
  const [proxyLogError, setProxyLogError] = useState("");
  const [isAddProxyModalOpen, setIsAddProxyModalOpen] = useState(false);
  const [addProxyForm, setAddProxyForm] = useState(() => ({
    entryText: "",
    type: "residential",
    protocol: "http",
    status: "pending",
    source: "",
    country: "",
    city: "",
    label: "",
    tags: "",
    notes: "",
  }));
  const [addProxyError, setAddProxyError] = useState("");
  const [isAddingProxy, setIsAddingProxy] = useState(false);
  const role = currentUser?.role || "";
  const isAdmin = role === "admin";
  const isMaker = role === "maker";
  const makerOwnsProfile =
    isMaker &&
    (currentUser?.profiles || []).some(
      (entry) => entry.profileId === profile?._id,
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
        const data = await fetchProfile(id);
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
  }, [id]);

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
    let cancelled = false;

    async function loadImageAssetMap() {
      try {
        const assets = await fetchHumanAssets();
        if (cancelled) return;
        const map = {};
        for (const asset of assets) {
          for (const img of asset.images || []) {
            if (img._id) map[String(img._id)] = String(asset._id || asset.id || "");
          }
        }
        setImageIdToAssetId(map);
      } catch {
        // non-critical, link just won't show
      }
    }

    loadImageAssetMap();
    return () => { cancelled = true; };
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
      const saved = await updateProfile(id, serializeProfile(nextProfile));
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
      const updated = await unassignProfileImage(id, imageId);
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
      fetchProfile(id),
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

  function addBrowser() {
    persistProfile((current) => ({
      ...current,
      browsers: [...(current.browsers || []), { browserId: "", provider: "" }],
    }));
  }

  function upBrowser(idx, field, value) {
    persistProfile((current) => ({
      ...current,
      browsers: (current.browsers || []).map((b, i) =>
        i === idx ? { ...b, [field]: value } : b,
      ),
    }));
  }

  function removeBrowser(idx) {
    persistProfile((current) => ({
      ...current,
      browsers: (current.browsers || []).filter((_, i) => i !== idx),
    }));
  }

  function openAddProxyModal() {
    if (!canPersist) return;
    setIsAddProxyModalOpen(true);
  }

  async function upProxy(idx, field, value) {
    const current = profile?.proxies || [];
    const target = current[idx];
    if (!target) return;

    const proxyId =
      (target.proxyId && (target.proxyId._id || target.proxyId.id)) ||
      (typeof target.proxyId === "string" ? target.proxyId : null);
    if (!proxyId) return;

    const previous = profile;
    setProfile((prev) => ({
      ...prev,
      proxies: (prev.proxies || []).map((entry, i) => {
        if (i !== idx) return entry;
        const populated =
          typeof entry.proxyId === "object" && entry.proxyId
            ? { ...entry.proxyId, [field]: value }
            : entry.proxyId;
        return { ...entry, proxyId: populated };
      }),
    }));

    try {
      const updated = await updateProxy(proxyId, { [field]: value });
      if (updated) {
        setProfile((prev) => ({
          ...prev,
          proxies: (prev.proxies || []).map((entry, i) =>
            i !== idx
              ? entry
              : {
                  ...entry,
                  proxyId:
                    typeof entry.proxyId === "object" && entry.proxyId
                      ? { ...entry.proxyId, ...updated }
                      : updated,
                },
          ),
        }));
      }
      setError("");
    } catch (err) {
      setProfile(previous);
      setError(err.message || "Failed to update proxy.");
    }
  }

  function removeProxy(idx) {
    persistProfile((current) => ({
      ...current,
      proxies: (current.proxies || []).filter((_, i) => i !== idx),
    }));
  }

  function resetAddProxyForm() {
    setAddProxyForm({
      entryText: "",
      type: "residential",
      protocol: "http",
      status: "pending",
      source: "",
      country: "",
      city: "",
      label: "",
      tags: "",
      notes: "",
    });
    setAddProxyError("");
  }

  function closeAddProxyModal() {
    if (isAddingProxy) return;
    setIsAddProxyModalOpen(false);
    resetAddProxyForm();
  }

  async function handleAddProxySubmit(event) {
    event.preventDefault();
    if (!profile?._id || !canPersist) return;

    const entry = String(addProxyForm.entryText || "").trim();
    if (!entry) {
      setAddProxyError("Enter a proxy in host:port:user:pass format.");
      return;
    }

    const tags = addProxyForm.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setIsAddingProxy(true);
    setAddProxyError("");
    try {
      const saved = await createProfileProxy(profile._id, {
        entry,
        type: addProxyForm.type,
        protocol: addProxyForm.protocol || null,
        status: addProxyForm.status,
        source: addProxyForm.source.trim() || null,
        country: addProxyForm.country.trim() || null,
        city: addProxyForm.city.trim() || null,
        label: addProxyForm.label.trim() || null,
        notes: addProxyForm.notes.trim() || null,
        tags,
      });
      setProfile(normalizeProfile(saved));
      setError("");
      setIsAddProxyModalOpen(false);
      resetAddProxyForm();
    } catch (err) {
      setAddProxyError(err.message || "Failed to add proxy.");
    } finally {
      setIsAddingProxy(false);
    }
  }

  async function recordProxyIpInfo() {
    if (!profile?._id || isCheckingProxyIp) return;

    setIsCheckingProxyIp(true);
    setProxyLogError("");
    try {
      const updated = await addProxyLogEntry(profile._id, {});
      setProfile(normalizeProfile(updated));
    } catch (err) {
      setProxyLogError(err.message || "Failed to record proxy IP info.");
    } finally {
      setIsCheckingProxyIp(false);
    }
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
    if (!profile || !isAdmin) {
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

  async function deleteTrackerEntry(index) {
    if (!profile || !writeable) return;
    await persistProfile((current) => ({
      ...current,
      trackerLog: (current.trackerLog || []).filter((_, i) => i !== index),
    }));
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
      const savedProfile = await updateProfile(id, {
        ...profile,
        status: "Need Setup",
      });
      setProfile(normalizeProfile(savedProfile));

      const result = await updateAssignmentStatus(
        currentUser.id,
        profile._id,
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

  const avatarColor = getAvatarColor(profile._id);
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
    (entry) => entry.profileId === profile._id,
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
            <div
              className="hav hav-img-wrap"
              style={{ background: avatarColor }}
            >
              <SafeImage
                src={primaryProfileImage}
                alt={`${profile.firstName} ${profile.lastName}`}
                className="hav-img"
                initials={(profile.firstName || profile.lastName || "?").charAt(0)}
                initialsSeed={profile._id}
                style={{ width: "100%", height: "100%", fontSize: "32px" }}
              />
            </div>
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
              {profile.dob ? (
                <div
                  className="hsub"
                  style={{ marginTop: "2px", fontSize: "12px" }}
                >
                  {(() => {
                    const date = new Date(profile.dob);
                    return Number.isNaN(date.getTime())
                      ? profile.dob
                      : date.toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        });
                  })()}
                </div>
              ) : null}
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
            {!isMaker && (
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
            )}
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
        {!isMaker && (
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

          <SectionCard title="Browsers">
            {(profile.browsers || []).map((item, idx) => (
              <BrowserCard
                key={idx}
                item={item}
                onUpdate={(field, value) => upBrowser(idx, field, value)}
                onRemove={() => removeBrowser(idx)}
                editable={writeable}
              />
            ))}
            {writeable && (
              <button className="add-item-btn" onClick={addBrowser}>
                + Add Browser
              </button>
            )}
          </SectionCard>

          <SectionCard title="Proxies">
            {(profile.proxies || []).map((entry, idx) => {
              const populated =
                typeof entry.proxyId === "object" && entry.proxyId
                  ? entry.proxyId
                  : {};
              const key =
                populated._id ||
                populated.id ||
                (typeof entry.proxyId === "string" ? entry.proxyId : idx);
              return (
                <ProxyCard
                  key={key}
                  item={populated}
                  onUpdate={(field, value) => upProxy(idx, field, value)}
                  onRemove={() => removeProxy(idx)}
                  editable={writeable}
                  canCopy={canViewProxy}
                />
              );
            })}
            {writeable && (
              <button className="add-item-btn" onClick={openAddProxyModal}>
                + Add Proxy
              </button>
            )}
          </SectionCard>

          <SectionCard
            title="Proxy Log"
            badge={
              writeable ? (
                <button
                  type="button"
                  className="btn-s"
                  onClick={recordProxyIpInfo}
                  disabled={isCheckingProxyIp}
                  style={{ padding: "6px 10px", fontSize: "11px" }}
                >
                  {isCheckingProxyIp ? "Checking..." : "Check IP info"}
                </button>
              ) : null
            }
          >
            {proxyLogError ? (
              <div
                className="dr"
                style={{ color: "var(--red)", fontSize: "12px" }}
              >
                {proxyLogError}
              </div>
            ) : null}
            {(profile.proxyLog || []).length ? (
              [...(profile.proxyLog || [])]
                .slice()
                .reverse()
                .map((entry, index) => (
                  <div key={`${entry.checkedAt}-${index}`} className="dr">
                    <div className="dl">
                      <div>{entry.ip || "-"}</div>
                      <div style={{ color: "var(--text3)", fontSize: "11px" }}>
                        {entry.checkedAt ? fmtDate(entry.checkedAt) : ""}
                      </div>
                    </div>
                    <div className="dv" style={{ fontSize: "12px" }}>
                      <div>
                        {[entry.city, entry.region, entry.country]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </div>
                      {entry.org ? (
                        <div style={{ color: "var(--text3)" }}>{entry.org}</div>
                      ) : null}
                      {entry.loc || entry.postal || entry.timezone ? (
                        <div
                          style={{
                            color: "var(--text3)",
                            fontSize: "11px",
                          }}
                        >
                          {[entry.loc, entry.postal, entry.timezone]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
            ) : (
              <div className="dr" style={{ color: "var(--text3)", fontSize: "12px" }}>
                No IP checks recorded yet.
              </div>
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
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {!isMaker && (
          <SectionCard
            title="Tracker Log"
            badge={
              writeable ? (
                <button
                  type="button"
                  className="btn-s"
                  onClick={() => setIsTrackerModalOpen(true)}
                  style={{ padding: "6px 10px", fontSize: "11px" }}
                >
                  {hasTrackedToday ? "Add Another Entry" : "Mark Tracked Today"}
                </button>
              ) : null
            }
          >
            {trackerEntries.length ? (
              trackerEntries.map((entry, index) => (
                <div
                  key={`${entry.date}-${entry._index}`}
                  className="dr"
                  style={{
                    borderBottom:
                      index === trackerEntries.length - 1 ? "none" : undefined,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div className="dl">{entry.date || "No date"}</div>
                  <div className="dv" style={{ flex: 1 }}>
                    {entry.note || "—"}
                  </div>
                  {writeable && (
                    <button
                      type="button"
                      className="btn-s"
                      onClick={() => deleteTrackerEntry(entry._index)}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        color: "var(--red)",
                      }}
                      title="Delete entry"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="muted">No tracker log entries yet.</div>
            )}
          </SectionCard>
          )}

          <SectionCard title="Notes">
            <EditableText
              value={profile.notes}
              onSave={(v) => upTopLevel("notes", v)}
              multiline
              placeholder="Add internal notes..."
              editable={isAdmin || canPersist}
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
            <div className="dr">
              <div className="dl">Proxy</div>
              <div className="dv">
                <EditableText
                  value={reveal(profile.proxy, canViewProxy)}
                  onSave={(v) => upTopLevel("proxy", v)}
                  placeholder="Proxy"
                  mono
                  copyable={canViewProxy}
                  editable={canEditField("proxy")}
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
                  editable={canEditField("proxyLocation")}
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
                  editable={canEditField("phone")}
                />
              </div>
            </div>
            <div className="dr" style={{ borderBottom: "none" }}>
              <div className="dl">Recovery Email</div>
              <div className="dv">
                <EditableText
                  value={reveal(profile.recoveryEmail, confidential)}
                  onSave={(v) => upTopLevel("recoveryEmail", v)}
                  placeholder="Recovery email"
                  copyable={confidential}
                  editable={canEditField("recoveryEmail")}
                />
              </div>
            </div>
          </SectionCard>

          {showMakerSubmit && (
            <SectionCard title="Submit Profile">
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "4px 2px",
                }}
              >
                <div style={{ fontSize: "13px", color: "var(--text2)" }}>
                  Once you've filled in the credentials and links, submit this
                  profile so an admin can finish setup.
                </div>
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
                    {submittingProfile ? "Submitting..." : "Submit Profile"}
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
            </SectionCard>
          )}

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
              <div className="dv">
                <EditableText
                  value={Number(profile.friends || 0)}
                  onSave={(v) => upTopLevel("friends", Number(v) || 0)}
                  placeholder="0"
                  numeric
                  editable={canEditField("friends")}
                />
              </div>
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

          {!isMaker && (
          <IdentityPromptCard
            profile={profile}
            writeable={writeable}
            onSave={(value) => upTopLevel("identityPrompt", value)}
            onRegenerate={() => upTopLevel("identityPrompt", buildIdentityPrompt(profile))}
          />
          )}

          {!isMaker && (
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
                      href={getProfileImagesDownloadUrl(profile._id)}
                      className="btn-s"
                      target="_blank"
                      rel="noopener noreferrer"
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
                        <a
                          href={`/pages/${profile.linkedPage.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="image-asset-user-link"
                        >
                          Open page
                        </a>
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
                                    <a
                                      href={`/pages/${profile.linkedPage.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="image-asset-user-link"
                                    >
                                      Open page
                                    </a>
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
                                    <SafeImage
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
                                    <div className="profile-image-date">
                                      Assigned {fmtDate(entry.assignedAt)}
                                    </div>
                                    {section.key === "human-asset" && imageIdToAssetId[String(entry.image?._id || "")] ? (
                                      <a
                                        href={`/images/${imageIdToAssetId[String(entry.image?._id || "")]}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="image-asset-user-link"
                                      >
                                        View asset
                                      </a>
                                    ) : null}
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
          )}
        </div>
      </div>

      {!isMaker && <JsonBlock profile={profile} />}

      {isAddProxyModalOpen && (
        <div
          className="npm-backdrop"
          onClick={isAddingProxy ? undefined : closeAddProxyModal}
        >
          <div
            className="npm-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(640px, 100%)" }}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Proxy</div>
                <h2 className="npm-title">Add Proxy</h2>
              </div>
              <button
                className="npm-close"
                type="button"
                onClick={closeAddProxyModal}
                disabled={isAddingProxy}
              >
                x
              </button>
            </div>
            <form
              className="npm-body npm-form"
              onSubmit={handleAddProxySubmit}
              aria-busy={isAddingProxy}
            >
              <fieldset className="npm-form-fieldset" disabled={isAddingProxy}>
                <div className="npm-grid">
                  <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="npm-label">Proxy (host:port:user:pass)</span>
                    <input
                      className="npm-input"
                      type="text"
                      value={addProxyForm.entryText}
                      onChange={(e) =>
                        setAddProxyForm((current) => ({
                          ...current,
                          entryText: e.target.value,
                        }))
                      }
                      placeholder="proxy.example.com:8080:user:pass"
                      style={{ fontFamily: "monospace" }}
                      autoFocus
                    />
                    <span className="image-asset-helper">
                      User/pass optional. Trimmed server-side.
                    </span>
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Type</span>
                    <select
                      className="npm-input"
                      value={addProxyForm.type}
                      onChange={(e) =>
                        setAddProxyForm((current) => ({
                          ...current,
                          type: e.target.value,
                        }))
                      }
                    >
                      {PROXY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Protocol</span>
                    <select
                      className="npm-input"
                      value={addProxyForm.protocol}
                      onChange={(e) =>
                        setAddProxyForm((current) => ({
                          ...current,
                          protocol: e.target.value,
                        }))
                      }
                    >
                      <option value="">None</option>
                      {PROXY_PROTOCOL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Status</span>
                    <select
                      className="npm-input"
                      value={addProxyForm.status}
                      onChange={(e) =>
                        setAddProxyForm((current) => ({
                          ...current,
                          status: e.target.value,
                        }))
                      }
                    >
                      {PROXY_STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Source</span>
                    <input
                      className="npm-input"
                      value={addProxyForm.source}
                      onChange={(e) =>
                        setAddProxyForm((current) => ({
                          ...current,
                          source: e.target.value,
                        }))
                      }
                      placeholder="IPRoyal, Bright Data, ..."
                    />
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Country</span>
                    <input
                      className="npm-input"
                      value={addProxyForm.country}
                      onChange={(e) =>
                        setAddProxyForm((current) => ({
                          ...current,
                          country: e.target.value,
                        }))
                      }
                      placeholder="US"
                    />
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">City</span>
                    <input
                      className="npm-input"
                      value={addProxyForm.city}
                      onChange={(e) =>
                        setAddProxyForm((current) => ({
                          ...current,
                          city: e.target.value,
                        }))
                      }
                      placeholder="New York"
                    />
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Label</span>
                    <input
                      className="npm-input"
                      value={addProxyForm.label}
                      onChange={(e) =>
                        setAddProxyForm((current) => ({
                          ...current,
                          label: e.target.value,
                        }))
                      }
                      placeholder="Optional label"
                    />
                  </label>

                  <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="npm-label">Tags (comma-separated)</span>
                    <input
                      className="npm-input"
                      value={addProxyForm.tags}
                      onChange={(e) =>
                        setAddProxyForm((current) => ({
                          ...current,
                          tags: e.target.value,
                        }))
                      }
                      placeholder="us, residential, pool-a"
                    />
                  </label>

                  <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="npm-label">Notes</span>
                    <textarea
                      className="npm-input npm-textarea"
                      rows={2}
                      value={addProxyForm.notes}
                      onChange={(e) =>
                        setAddProxyForm((current) => ({
                          ...current,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Optional notes..."
                    />
                  </label>
                </div>

                {addProxyError ? (
                  <div className="npm-submit-error">{addProxyError}</div>
                ) : null}

                <div className="npm-footer">
                  <button
                    type="button"
                    className="btn-s"
                    onClick={closeAddProxyModal}
                  >
                    Cancel
                  </button>
                  <div className="npm-footer-actions">
                    <button type="submit" className="btn-p" disabled={isAddingProxy}>
                      {isAddingProxy ? "Adding..." : "Add Proxy"}
                    </button>
                  </div>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

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
