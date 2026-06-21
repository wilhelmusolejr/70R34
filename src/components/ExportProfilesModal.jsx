import { useEffect, useMemo, useState } from "react";
import { STATUS_COLORS, STATUS_OPTIONS } from "../constants/profileUi";
import {
  buildExportRows,
  downloadTextFile,
  exportFileBaseName,
  parseIdList,
  rowsToCsv,
  rowsToXls,
} from "../utils/exportProfiles";

// Manila date (YYYY-MM-DD) — matches the rest of the app's day handling.
function todayStamp() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function emptyState() {
  return {
    mode: "filtered", // filtered | status | ids
    statuses: ["Available"],
    idsText: "",
    format: "both", // csv | xls | both
    boostFriends: true,
  };
}

export function ExportProfilesModal({
  isOpen,
  onClose,
  profiles, // full visible (maker-scoped) set
  currentViewProfiles, // already filtered + sorted on the page
  onToast,
}) {
  const [form, setForm] = useState(() => emptyState());

  useEffect(() => {
    if (isOpen) setForm(emptyState());
  }, [isOpen]);

  const { matched, missingIds } = useMemo(() => {
    if (!isOpen) return { matched: [], missingIds: [] };

    if (form.mode === "filtered") {
      return { matched: currentViewProfiles || [], missingIds: [] };
    }

    if (form.mode === "status") {
      const set = new Set(form.statuses);
      return {
        matched: (profiles || []).filter((p) => set.has(p.status)),
        missingIds: [],
      };
    }

    // ids mode — preserve the order the ids were supplied in.
    const ids = parseIdList(form.idsText);
    const byId = new Map((profiles || []).map((p) => [String(p._id), p]));
    const matchedById = [];
    const missing = [];
    for (const id of ids) {
      const profile = byId.get(id);
      if (profile) matchedById.push(profile);
      else missing.push(id);
    }
    return { matched: matchedById, missingIds: missing };
  }, [isOpen, form, profiles, currentViewProfiles]);

  if (!isOpen) return null;

  function patch(next) {
    setForm((current) => ({ ...current, ...next }));
  }

  function toggleStatus(status) {
    setForm((current) => ({
      ...current,
      statuses: current.statuses.includes(status)
        ? current.statuses.filter((s) => s !== status)
        : [...current.statuses, status],
    }));
  }

  function exportScope() {
    if (form.mode === "filtered") return "view";
    if (form.mode === "ids") return "by-id";
    return form.statuses.join("+") || "status";
  }

  function handleExport() {
    if (matched.length === 0) return;
    const rows = buildExportRows(matched, { boostFriends: form.boostFriends });
    const base = exportFileBaseName({
      count: rows.length,
      scope: exportScope(),
      date: todayStamp(),
    });

    if (form.format === "csv" || form.format === "both") {
      downloadTextFile(`${base}.csv`, rowsToCsv(rows), "text/csv");
    }
    if (form.format === "xls" || form.format === "both") {
      downloadTextFile(
        `${base}.xls`,
        rowsToXls(rows),
        "application/vnd.ms-excel",
      );
    }

    onToast?.(
      `Exported ${rows.length} profile${rows.length === 1 ? "" : "s"}`,
    );
    onClose();
  }

  return (
    <div className="npm-backdrop" onClick={onClose}>
      <div
        className="npm-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(620px, 100%)", maxHeight: "90vh" }}
      >
        <div className="npm-header">
          <div>
            <div className="npm-kicker">Export</div>
            <h2 className="npm-title">Export profiles</h2>
          </div>
          <button className="npm-close" type="button" onClick={onClose}>
            x
          </button>
        </div>
        <div className="npm-body">
          <div
            style={{
              fontSize: 12,
              color: "var(--text2)",
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            Exports a credential sheet (name, email, passwords, profile URL,
            friends). Choose which profiles to include.
          </div>

          {/* Mode selector */}
          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            {[
              {
                key: "filtered",
                label: "Current view",
                hint: `${currentViewProfiles?.length || 0} profile(s) matching the page filters`,
              },
              {
                key: "status",
                label: "By status",
                hint: "Pick one or more statuses",
              },
              {
                key: "ids",
                label: "By IDs",
                hint: "Paste specific profile IDs",
              },
            ].map((opt) => (
              <label
                key={opt.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  border: `1px solid ${
                    form.mode === opt.key ? "var(--accent)" : "var(--border)"
                  }`,
                  background:
                    form.mode === opt.key ? "var(--surface2)" : "transparent",
                }}
              >
                <input
                  type="radio"
                  name="export-mode"
                  checked={form.mode === opt.key}
                  onChange={() => patch({ mode: opt.key })}
                  style={{ marginTop: 2 }}
                />
                <span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {opt.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "var(--text2)",
                    }}
                  >
                    {opt.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {/* Status picker */}
          {form.mode === "status" && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 14,
              }}
            >
              {STATUS_OPTIONS.map((status) => {
                const color = STATUS_COLORS[status] || "#64748B";
                const selected = form.statuses.includes(status);
                return (
                  <label
                    key={status}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 10px",
                      borderRadius: 999,
                      cursor: "pointer",
                      fontSize: 13,
                      color: selected ? color : "var(--text2)",
                      background: selected ? `${color}26` : "transparent",
                      border: `1px solid ${selected ? color : "var(--border)"}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleStatus(status)}
                      style={{ accentColor: color }}
                    />
                    {status}
                  </label>
                );
              })}
            </div>
          )}

          {/* IDs input */}
          {form.mode === "ids" && (
            <div style={{ marginBottom: 14 }}>
              <textarea
                className="npm-input npm-textarea"
                value={form.idsText}
                onChange={(e) => patch({ idsText: e.target.value })}
                placeholder={`Paste IDs — JSON array or comma/space/newline separated\n["665f0a…", "665f0b…"]`}
                style={{ minHeight: 110, fontFamily: "monospace", fontSize: 12 }}
              />
              {missingIds.length > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: STATUS_COLORS.Flagged,
                    marginTop: 6,
                  }}
                >
                  {missingIds.length} id(s) not found and will be skipped.
                </div>
              )}
            </div>
          )}

          {/* Format + options */}
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <label style={{ fontSize: 13, display: "flex", gap: 8 }}>
              <span style={{ color: "var(--text2)" }}>Format</span>
              <select
                className="npm-input"
                value={form.format}
                onChange={(e) => patch({ format: e.target.value })}
                style={{ maxWidth: 180 }}
              >
                <option value="both">CSV + Excel (.xls)</option>
                <option value="csv">CSV only</option>
                <option value="xls">Excel (.xls) only</option>
              </select>
            </label>
            <label
              style={{
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.boostFriends}
                onChange={(e) => patch({ boostFriends: e.target.checked })}
              />
              Boost friends below 30 (→ 30–40)
            </label>
          </div>

          <div className="npm-footer">
            <button type="button" className="btn-s" onClick={onClose}>
              Cancel
            </button>
            <div className="npm-footer-actions">
              <button
                type="button"
                className="btn-p"
                onClick={handleExport}
                disabled={matched.length === 0}
              >
                {matched.length === 0
                  ? "No profiles to export"
                  : `Export ${matched.length} profile${matched.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
