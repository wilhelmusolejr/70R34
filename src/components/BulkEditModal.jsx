import { useEffect, useState } from "react";
import { STATUS_COLORS, STATUS_OPTIONS } from "../constants/profileUi";

function emptyForm() {
  return {
    status: { enabled: false, value: "" },
    tracker: { enabled: false, note: "" },
    tags: { enabled: false, action: "add", value: "" },
    flags: {
      has2FA: { enabled: false, value: true },
      profileSetup: { enabled: false, value: true },
      hasPage: { enabled: false, value: true },
    },
  };
}

function Section({ title, enabled, onToggle, disabled, children }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 12,
        background: enabled ? "var(--surface2)" : "transparent",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          fontWeight: 600,
          fontSize: 14,
          color: "var(--text)",
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={disabled}
        />
        {title}
      </label>
      {enabled ? (
        <div style={{ marginTop: 10, paddingLeft: 24 }}>{children}</div>
      ) : null}
    </div>
  );
}

export function BulkEditModal({
  isOpen,
  onClose,
  selectedCount,
  onApply,
  isApplying,
}) {
  const [form, setForm] = useState(() => emptyForm());

  useEffect(() => {
    if (isOpen) setForm(emptyForm());
  }, [isOpen]);

  if (!isOpen) return null;

  function setStatus(patch) {
    setForm((current) => ({ ...current, status: { ...current.status, ...patch } }));
  }
  function setTracker(patch) {
    setForm((current) => ({
      ...current,
      tracker: { ...current.tracker, ...patch },
    }));
  }
  function setTags(patch) {
    setForm((current) => ({ ...current, tags: { ...current.tags, ...patch } }));
  }
  function setFlag(key, patch) {
    setForm((current) => ({
      ...current,
      flags: {
        ...current.flags,
        [key]: { ...current.flags[key], ...patch },
      },
    }));
  }

  function hasAnyEnabled() {
    if (form.status.enabled && form.status.value) return true;
    if (form.tracker.enabled) return true;
    if (form.tags.enabled && form.tags.value.trim()) return true;
    if (
      form.flags.has2FA.enabled ||
      form.flags.profileSetup.enabled ||
      form.flags.hasPage.enabled
    ) {
      return true;
    }
    return false;
  }

  function handleApply() {
    if (!hasAnyEnabled()) return;
    const payload = {
      status:
        form.status.enabled && form.status.value
          ? { value: form.status.value }
          : null,
      tracker: form.tracker.enabled
        ? { note: form.tracker.note.trim() }
        : null,
      tags:
        form.tags.enabled && form.tags.value.trim()
          ? {
              action: form.tags.action,
              value: form.tags.value.trim(),
            }
          : null,
      flags: (() => {
        const out = {};
        if (form.flags.has2FA.enabled) out.has2FA = form.flags.has2FA.value;
        if (form.flags.profileSetup.enabled) {
          out.profileSetup = form.flags.profileSetup.value;
        }
        if (form.flags.hasPage.enabled) out.hasPage = form.flags.hasPage.value;
        return Object.keys(out).length ? out : null;
      })(),
    };
    onApply(payload);
  }

  return (
    <div
      className="npm-backdrop"
      onClick={isApplying ? undefined : onClose}
    >
      <div
        className="npm-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(640px, 100%)", maxHeight: "90vh" }}
      >
        <div className="npm-header">
          <div>
            <div className="npm-kicker">Quick Edit</div>
            <h2 className="npm-title">
              Bulk edit {selectedCount} profile
              {selectedCount === 1 ? "" : "s"}
            </h2>
          </div>
          <button
            className="npm-close"
            type="button"
            onClick={onClose}
            disabled={isApplying}
          >
            x
          </button>
        </div>
        <div className="npm-body" aria-busy={isApplying}>
          <div
            style={{
              fontSize: 12,
              color: "var(--text2)",
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            Toggle a section to include it in the update. Only enabled sections
            are sent — everything else is left untouched on each profile.
          </div>

          <Section
            title="Change Status"
            enabled={form.status.enabled}
            onToggle={(v) => setStatus({ enabled: v })}
            disabled={isApplying}
          >
            <select
              className="npm-input"
              value={form.status.value}
              onChange={(e) => setStatus({ value: e.target.value })}
              style={{
                color: STATUS_COLORS[form.status.value] || undefined,
                fontWeight: form.status.value ? 600 : undefined,
              }}
            >
              <option value="">Select a status…</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Section>

          <Section
            title="Mark Tracker Done Today"
            enabled={form.tracker.enabled}
            onToggle={(v) => setTracker({ enabled: v })}
            disabled={isApplying}
          >
            <input
              className="npm-input"
              placeholder="Optional note (applied to all)"
              value={form.tracker.note}
              onChange={(e) => setTracker({ note: e.target.value })}
            />
            <div
              style={{ fontSize: 11, color: "var(--text2)", marginTop: 6 }}
            >
              Profiles already tracked today are skipped.
            </div>
          </Section>

          <Section
            title="Add or Remove Tag"
            enabled={form.tags.enabled}
            onToggle={(v) => setTags({ enabled: v })}
            disabled={isApplying}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <select
                className="npm-input"
                value={form.tags.action}
                onChange={(e) => setTags({ action: e.target.value })}
                style={{ maxWidth: 140 }}
              >
                <option value="add">Add tag</option>
                <option value="remove">Remove tag</option>
              </select>
              <input
                className="npm-input"
                placeholder="tag-name"
                value={form.tags.value}
                onChange={(e) => setTags({ value: e.target.value })}
              />
            </div>
            <div
              style={{ fontSize: 11, color: "var(--text2)", marginTop: 6 }}
            >
              Adding is idempotent (no duplicates). Removing only affects
              profiles that have the tag.
            </div>
          </Section>

          <Section
            title="Set Requirement Flags"
            enabled={
              form.flags.has2FA.enabled ||
              form.flags.profileSetup.enabled ||
              form.flags.hasPage.enabled
            }
            onToggle={(v) => {
              setFlag("has2FA", { enabled: v });
              setFlag("profileSetup", { enabled: v });
              setFlag("hasPage", { enabled: v });
            }}
            disabled={isApplying}
          >
            {["has2FA", "profileSetup", "hasPage"].map((key) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.flags[key].enabled}
                  onChange={(e) =>
                    setFlag(key, { enabled: e.target.checked })
                  }
                />
                <span style={{ minWidth: 120, fontSize: 13 }}>{key}</span>
                <select
                  className="npm-input"
                  value={form.flags[key].value ? "true" : "false"}
                  onChange={(e) =>
                    setFlag(key, { value: e.target.value === "true" })
                  }
                  disabled={!form.flags[key].enabled}
                  style={{ maxWidth: 120 }}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
            ))}
          </Section>

          <div className="npm-footer">
            <button
              type="button"
              className="btn-s"
              onClick={onClose}
              disabled={isApplying}
            >
              Cancel
            </button>
            <div className="npm-footer-actions">
              <button
                type="button"
                className="btn-p"
                onClick={handleApply}
                disabled={isApplying || !hasAnyEnabled()}
              >
                {isApplying
                  ? "Applying…"
                  : `Apply to ${selectedCount} profile${
                      selectedCount === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          </div>

          {isApplying ? (
            <div className="npm-loading-overlay">
              <div className="npm-spinner" />
              <div className="npm-loading-title">Applying changes</div>
              <div className="npm-loading-copy">
                Patching {selectedCount} profile
                {selectedCount === 1 ? "" : "s"}. Keep this modal open.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
