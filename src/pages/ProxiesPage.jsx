import { useEffect, useMemo, useState } from "react";
import { bulkCreateProxies, fetchProxies } from "../api/proxies";
import { useAuth } from "../context/AuthContext";
import "../App.css";

const PROXY_TYPE_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "isp", label: "ISP" },
  { value: "datacenter", label: "Datacenter" },
  { value: "mobile", label: "Mobile" },
];

const PROXY_PROTOCOL_OPTIONS = [
  { value: "", label: "None" },
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
  { value: "socks5", label: "SOCKS5" },
];

const PROXY_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "dead", label: "Dead" },
  { value: "expired", label: "Expired" },
];

const PROXY_SOURCE_SUGGESTIONS = [
  "IPRoyal",
  "Bright Data",
  "Smartproxy",
  "SOAX",
  "Oxylabs",
  "ProxyEmpire",
  "NetNut",
  "Rayobyte",
];

const PROXY_COUNTRY_SUGGESTIONS = [
  "US",
  "UK",
  "CA",
  "DE",
  "FR",
  "NL",
  "JP",
  "PH",
  "SG",
  "AU",
  "BR",
  "IN",
];

function parseEntriesInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];

  if (text.startsWith("[")) {
    try {
      const normalized = text.replace(/'/g, '"');
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry || "").trim()).filter(Boolean);
      }
    } catch {
      // fall through to line-by-line parsing
    }
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^['"]|['"],?$/g, "").trim())
    .filter(Boolean);
}

function EmptyState({ title, description }) {
  return (
    <div className="empty-st">
      <div className="et">{title}</div>
      <div className="ed">{description}</div>
    </div>
  );
}

function ProxyStatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();
  const className =
    normalized === "active"
      ? "sa"
      : normalized === "pending"
        ? "sp"
        : "sg";

  const label =
    normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return (
    <span className={`sbadge ${className}`}>
      <span className="sdot2" />
      {label}
    </span>
  );
}

function formatProxyType(type) {
  if (!type) return "";
  if (type === "isp") return "ISP";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatLocation(proxy) {
  return [proxy.city, proxy.country].filter(Boolean).join(", ");
}

function ProxiesTable({ title, rows }) {
  if (!rows.length) {
    return (
      <div className="page-section">
        <div className="page-section-head">
          <h2>{title}</h2>
          <span>{rows.length} proxies</span>
        </div>
        <EmptyState
          title={`No ${title.toLowerCase()} proxies`}
          description="Seed or add a proxy to populate this pool."
        />
      </div>
    );
  }

  return (
    <div className="page-section">
      <div className="page-section-head">
        <h2>{title}</h2>
        <span>{rows.length} proxies</span>
      </div>
      <div className="twrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Label</th>
              <th>Status</th>
              <th>Type</th>
              <th>Source</th>
              <th>Host : Port</th>
              <th>Protocol</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((proxy) => (
              <tr key={`${title}-${proxy.id}`}>
                <td>
                  <div className="pcell">
                    <div>
                      <div className="pname">
                        {proxy.label || `${proxy.host}:${proxy.port}`}
                      </div>
                      <div className="pcity">
                        {proxy.tags?.length
                          ? proxy.tags.join(", ")
                          : "No tags"}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <ProxyStatusBadge status={proxy.status} />
                </td>
                <td>{formatProxyType(proxy.type) || <span className="nol">—</span>}</td>
                <td>{proxy.source || <span className="nol">No source</span>}</td>
                <td>
                  <div className="dcell">
                    <div className="dv">{proxy.host}</div>
                    <div className="da">Port {proxy.port}</div>
                  </div>
                </td>
                <td>
                  {proxy.protocol
                    ? proxy.protocol.toUpperCase()
                    : <span className="nol">—</span>}
                </td>
                <td>{formatLocation(proxy) || <span className="nol">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const INITIAL_FORM = {
  entriesText: "",
  type: "residential",
  protocol: "http",
  status: "pending",
  source: "",
  country: "",
  city: "",
  tags: "",
  notes: "",
};

export function ProxiesPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [proxies, setProxies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitInfo, setSubmitInfo] = useState("");
  const [guardMessage, setGuardMessage] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchProxies();
        if (!cancelled) {
          setProxies(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load proxies.");
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

  function resetForm() {
    setForm(INITIAL_FORM);
    setSubmitError("");
    setSubmitInfo("");
  }

  function ensureAdminAccess() {
    if (isAdmin) return true;
    setGuardMessage(
      currentUser
        ? "Only admin accounts can add proxies."
        : "You need to log in as an admin to add proxies.",
    );
    return false;
  }

  async function handleBulkAdd(event) {
    event.preventDefault();
    if (!ensureAdminAccess()) return;

    const entries = parseEntriesInput(form.entriesText);

    if (!entries.length) {
      setSubmitError(
        "Paste a JS-style array like ['host:port:user:pass', ...] or one entry per line.",
      );
      return;
    }

    const tags = form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setSubmitInfo("");

      const result = await bulkCreateProxies({
        entries,
        type: form.type,
        protocol: form.protocol || null,
        status: form.status,
        source: form.source.trim() || null,
        country: form.country.trim() || null,
        city: form.city.trim() || null,
        notes: form.notes.trim() || null,
        tags,
      });

      const created = result?.created || [];
      const invalid = result?.invalid || [];

      if (created.length) {
        setProxies((current) => [...created, ...current]);
      }

      if (created.length) {
        setIsModalOpen(false);
        resetForm();
        return;
      }

      if (invalid.length) {
        const duplicateCount = invalid.filter((entry) =>
          String(entry.reason || "").toLowerCase().startsWith("duplicate"),
        ).length;
        const malformedCount = invalid.length - duplicateCount;

        const parts = [];
        if (duplicateCount) {
          parts.push(
            `${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"}`,
          );
        }
        if (malformedCount) {
          parts.push(
            `${malformedCount} invalid format${malformedCount === 1 ? "" : "s"}`,
          );
        }

        setSubmitError(
          `Nothing added. All entries skipped: ${parts.join(", ")}.`,
        );
      }
    } catch (err) {
      setSubmitError(err.message || "Failed to add proxies.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const proxyRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return proxies.filter((proxy) => {
      if (!normalizedSearch) return true;

      return [
        proxy.label,
        proxy.host,
        proxy.source,
        proxy.type,
        proxy.status,
        proxy.country,
        proxy.city,
        proxy.protocol,
        ...(proxy.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [proxies, search]);

  const pendingProxies = proxyRows.filter((proxy) => proxy.status === "pending");
  const activeProxies = proxyRows.filter((proxy) => proxy.status === "active");
  const otherProxies = proxyRows.filter(
    (proxy) => !["pending", "active"].includes(proxy.status),
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Proxies</h1>
          <p>
            Pool of proxies available for assignment to profiles. Grouped by
            status.
          </p>
        </div>
        <button
          type="button"
          className="btn-p"
          onClick={() => {
            if (!ensureAdminAccess()) return;
            resetForm();
            setIsModalOpen(true);
          }}
        >
          Add Proxy
        </button>
      </div>

      <div className="stats-row">
        <div className="sc">
          <div className="snum">{proxyRows.length}</div>
          <div className="slabel">Total Proxies</div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--amber)" }}>
            {pendingProxies.length}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--amber)" }} />
            Pending
          </div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--accent)" }}>
            {activeProxies.length}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--accent)" }} />
            Active
          </div>
        </div>
        <div className="sc">
          <div className="snum">{otherProxies.length}</div>
          <div className="slabel">Other</div>
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
            placeholder="Search label, host, source, type, tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="rc">{proxyRows.length} proxies</span>
      </div>

      {loading ? (
        <EmptyState
          title="Loading proxies"
          description="Fetching proxy inventory from the API..."
        />
      ) : error ? (
        <EmptyState title="Unable to load proxies" description={error} />
      ) : (
        <div className="page-sections">
          <ProxiesTable title="Pending" rows={pendingProxies} />
          <ProxiesTable title="Active" rows={activeProxies} />
          <ProxiesTable title="Other" rows={otherProxies} />
        </div>
      )}

      {isModalOpen ? (
        <div
          className="npm-backdrop"
          onClick={isSubmitting ? undefined : () => setIsModalOpen(false)}
        >
          <div
            className="npm-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(720px, 100%)" }}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Proxy</div>
                <h2 className="npm-title">Add Proxies (Bulk)</h2>
              </div>
              <button
                className="npm-close"
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                x
              </button>
            </div>
            <form
              className="npm-body npm-form"
              onSubmit={handleBulkAdd}
              aria-busy={isSubmitting}
            >
              <fieldset className="npm-form-fieldset" disabled={isSubmitting}>
                <div className="npm-grid">
                  <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="npm-label">
                      Proxy Entries (JS array of host:port:user:pass strings)
                    </span>
                    <textarea
                      className="npm-input npm-textarea"
                      rows={8}
                      value={form.entriesText}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          entriesText: e.target.value,
                        }))
                      }
                      placeholder={
                        "['proxy.example.com:8080:user:pass', '1.2.3.4:3128']"
                      }
                    />
                    <span className="image-asset-helper">
                      Paste a JS-style array. User/pass optional. Invalid entries are skipped.
                    </span>
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Type</span>
                    <select
                      className="npm-input"
                      value={form.type}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          type: e.target.value,
                        }))
                      }
                    >
                      {PROXY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Protocol</span>
                    <select
                      className="npm-input"
                      value={form.protocol}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          protocol: e.target.value,
                        }))
                      }
                    >
                      {PROXY_PROTOCOL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Status</span>
                    <select
                      className="npm-input"
                      value={form.status}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          status: e.target.value,
                        }))
                      }
                    >
                      {PROXY_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Source (Brand)</span>
                    <input
                      className="npm-input"
                      list="proxy-source-suggestions"
                      value={form.source}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          source: e.target.value,
                        }))
                      }
                      placeholder="IPRoyal, Bright Data, ..."
                    />
                    <datalist id="proxy-source-suggestions">
                      {PROXY_SOURCE_SUGGESTIONS.map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Country</span>
                    <input
                      className="npm-input"
                      list="proxy-country-suggestions"
                      value={form.country}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          country: e.target.value,
                        }))
                      }
                      placeholder="US"
                    />
                    <datalist id="proxy-country-suggestions">
                      {PROXY_COUNTRY_SUGGESTIONS.map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">City</span>
                    <input
                      className="npm-input"
                      value={form.city}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          city: e.target.value,
                        }))
                      }
                      placeholder="New York"
                    />
                  </label>

                  <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="npm-label">Tags (comma-separated)</span>
                    <input
                      className="npm-input"
                      value={form.tags}
                      onChange={(e) =>
                        setForm((current) => ({
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
                      value={form.notes}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Optional notes about this batch..."
                    />
                  </label>
                </div>

                {submitError ? (
                  <div className="npm-submit-error">{submitError}</div>
                ) : null}
                {submitInfo ? (
                  <div className="image-asset-helper">{submitInfo}</div>
                ) : null}

                <div className="npm-footer">
                  <button
                    type="button"
                    className="btn-s"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <div className="npm-footer-actions">
                    <button type="submit" className="btn-p" disabled={isSubmitting}>
                      {isSubmitting ? "Adding..." : "Add Proxies"}
                    </button>
                  </div>
                </div>
              </fieldset>
              {isSubmitting ? (
                <div className="npm-loading-overlay">
                  <div className="npm-spinner" />
                  <div className="npm-loading-title">Adding proxies</div>
                  <div className="npm-loading-copy">
                    Parsing entries and saving them to the pool.
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
