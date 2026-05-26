import { useEffect, useMemo, useState } from "react";
import {
  createSharer,
  deleteSharer,
  fetchSharers,
} from "../api/sharers";
import { useAuth } from "../context/AuthContext";
import { canWrite } from "../utils/access";
import "../App.css";

const SHARER_TYPE_OPTIONS = [
  { value: "profile", label: "Profile" },
  { value: "page", label: "Page" },
  { value: "group", label: "Group" },
  { value: "unknown", label: "Unknown" },
];

const SHARER_COUNTRY_SUGGESTIONS = [
  "US",
  "UK",
  "CA",
  "IT",
  "DE",
  "FR",
  "NL",
  "ES",
  "PT",
  "JP",
  "PH",
  "SG",
  "AU",
  "BR",
  "IN",
];

const INITIAL_FORM = {
  url: "",
  country: "",
  type: "profile",
  label: "",
};

function EmptyState({ title, description }) {
  return (
    <div className="empty-st">
      <div className="et">{title}</div>
      <div className="ed">{description}</div>
    </div>
  );
}

function CountryFlag({ country }) {
  const code = String(country || "").toUpperCase();
  if (code.length !== 2) {
    return <span className="sbadge sg">{code || "—"}</span>;
  }
  return <span className="sbadge sp">{code}</span>;
}

function SharersTable({ country, rows, canDelete, onDelete, deletingId }) {
  return (
    <div className="page-section">
      <div className="page-section-head">
        <h2>
          <CountryFlag country={country} /> {country}
        </h2>
        <span>
          {rows.length} sharer{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="twrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>URL</th>
              <th>Type</th>
              <th>Label</th>
              <th>Added</th>
              {canDelete ? <th aria-label="actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((sharer) => (
              <tr key={sharer.id}>
                <td>
                  <a
                    className="dv"
                    href={sharer.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ wordBreak: "break-all" }}
                  >
                    {sharer.url}
                  </a>
                </td>
                <td>
                  {sharer.type
                    ? sharer.type.charAt(0).toUpperCase() + sharer.type.slice(1)
                    : <span className="nol">—</span>}
                </td>
                <td>{sharer.label || <span className="nol">—</span>}</td>
                <td>
                  {sharer.createdAt
                    ? new Date(sharer.createdAt).toLocaleDateString()
                    : <span className="nol">—</span>}
                </td>
                {canDelete ? (
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn-s"
                      onClick={() => onDelete(sharer)}
                      disabled={deletingId === sharer.id}
                    >
                      {deletingId === sharer.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SharersPage() {
  const { currentUser } = useAuth();
  const canEdit = canWrite(currentUser);

  const [sharers, setSharers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [guardMessage, setGuardMessage] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchSharers();
        if (!cancelled) {
          setSharers(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load sharers.");
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
  }

  function ensureWriteAccess() {
    if (canEdit) return true;
    setGuardMessage(
      currentUser
        ? "Your account doesn't have permission to manage sharers."
        : "You need to log in to manage sharers.",
    );
    return false;
  }

  async function handleAdd(event) {
    event.preventDefault();
    if (!ensureWriteAccess()) return;

    const url = form.url.trim();
    const country = form.country.trim().toUpperCase();

    if (!url) {
      setSubmitError("URL is required.");
      return;
    }
    if (country.length !== 2) {
      setSubmitError("Country must be a 2-letter code (e.g. US, IT).");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");

      const created = await createSharer({
        url,
        country,
        type: form.type,
        label: form.label.trim() || null,
      });

      if (created?.id) {
        setSharers((current) => [created, ...current]);
        setIsModalOpen(false);
        resetForm();
      }
    } catch (err) {
      setSubmitError(err.message || "Failed to add sharer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(sharer) {
    if (!ensureWriteAccess()) return;
    const confirmed = window.confirm(
      `Delete this sharer?\n\n${sharer.url}`,
    );
    if (!confirmed) return;

    try {
      setDeletingId(sharer.id);
      await deleteSharer(sharer.id);
      setSharers((current) => current.filter((item) => item.id !== sharer.id));
    } catch (err) {
      window.alert(err.message || "Failed to delete sharer.");
    } finally {
      setDeletingId("");
    }
  }

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedCountry = countryFilter.trim().toUpperCase();

    return sharers.filter((sharer) => {
      if (normalizedCountry && sharer.country !== normalizedCountry) {
        return false;
      }
      if (!normalizedSearch) return true;

      return [
        sharer.url,
        sharer.country,
        sharer.type,
        sharer.label,
        ...(sharer.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [sharers, search, countryFilter]);

  const groupedByCountry = useMemo(() => {
    const groups = new Map();
    for (const sharer of filteredRows) {
      const key = sharer.country || "—";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(sharer);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRows]);

  const countryOptions = useMemo(() => {
    const set = new Set(sharers.map((sharer) => sharer.country).filter(Boolean));
    return Array.from(set).sort();
  }, [sharers]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Sharers</h1>
          <p>
            Pool of Facebook URLs (profiles, pages, groups) grouped by country.
          </p>
        </div>
        <button
          type="button"
          className="btn-p"
          onClick={() => {
            if (!ensureWriteAccess()) return;
            resetForm();
            setIsModalOpen(true);
          }}
        >
          Add Sharer
        </button>
      </div>

      <div className="stats-row">
        <div className="sc">
          <div className="snum">{filteredRows.length}</div>
          <div className="slabel">Total Sharers</div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--accent)" }}>
            {groupedByCountry.length}
          </div>
          <div className="slabel">Countries</div>
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
            placeholder="Search URL, label, country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="npm-input"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          style={{ maxWidth: 160 }}
        >
          <option value="">All countries</option>
          {countryOptions.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
        <span className="rc">
          {filteredRows.length} sharer{filteredRows.length === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <EmptyState
          title="Loading sharers"
          description="Fetching sharers from the API..."
        />
      ) : error ? (
        <EmptyState title="Unable to load sharers" description={error} />
      ) : groupedByCountry.length === 0 ? (
        <EmptyState
          title="No sharers yet"
          description="Add a Facebook URL with a country code to get started."
        />
      ) : (
        <div className="page-sections">
          {groupedByCountry.map(([country, rows]) => (
            <SharersTable
              key={country}
              country={country}
              rows={rows}
              canDelete={canEdit}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          ))}
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
            style={{ width: "min(560px, 100%)" }}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Sharer</div>
                <h2 className="npm-title">Add Sharer</h2>
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
              onSubmit={handleAdd}
              aria-busy={isSubmitting}
            >
              <fieldset className="npm-form-fieldset" disabled={isSubmitting}>
                <div className="npm-grid">
                  <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="npm-label">Facebook URL</span>
                    <input
                      className="npm-input"
                      type="url"
                      value={form.url}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          url: e.target.value,
                        }))
                      }
                      placeholder="https://facebook.com/some.profile"
                      autoFocus
                    />
                  </label>

                  <label className="npm-field">
                    <span className="npm-label">Country (2-letter code)</span>
                    <input
                      className="npm-input"
                      list="sharer-country-suggestions"
                      value={form.country}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          country: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="US"
                      maxLength={2}
                    />
                    <datalist id="sharer-country-suggestions">
                      {SHARER_COUNTRY_SUGGESTIONS.map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
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
                      {SHARER_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="npm-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="npm-label">Label (optional)</span>
                    <input
                      className="npm-input"
                      value={form.label}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          label: e.target.value,
                        }))
                      }
                      placeholder="e.g. John Smith - main account"
                    />
                  </label>
                </div>

                {submitError ? (
                  <div className="npm-submit-error">{submitError}</div>
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
                      {isSubmitting ? "Adding..." : "Add Sharer"}
                    </button>
                  </div>
                </div>
              </fieldset>
              {isSubmitting ? (
                <div className="npm-loading-overlay">
                  <div className="npm-spinner" />
                  <div className="npm-loading-title">Adding sharer</div>
                  <div className="npm-loading-copy">
                    Saving to the database.
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
                <h2 className="npm-title">Permission Required</h2>
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
