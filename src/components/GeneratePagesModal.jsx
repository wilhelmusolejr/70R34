import { useEffect, useMemo, useState } from "react";
import { bulkCreatePages } from "../api/pages";
import { updateDefaultCountry } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES, generatePageInformation } from "../generator/pages";
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY } from "../generator/countries/index.js";

const DEFAULT_FORM = {
  count: 10,
  category: "any",
  country: DEFAULT_COUNTRY,
};

function Field({ label, children }) {
  return (
    <label className="npm-field">
      <span className="npm-label">{label}</span>
      {children}
    </label>
  );
}

export function GeneratePagesModal({ isOpen, onClose, onGenerated, onToast }) {
  const { currentUser, login } = useAuth();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sortedCategoryNames = useMemo(
    () =>
      CATEGORIES.map((entry) => entry.category).sort((a, b) =>
        a.localeCompare(b),
      ),
    [],
  );

  useEffect(() => {
    if (isOpen) {
      setForm({
        ...DEFAULT_FORM,
        country: currentUser?.defaultCountry || DEFAULT_COUNTRY,
      });
      setSaving(false);
      setError("");
    }
  }, [isOpen, currentUser?.defaultCountry]);

  if (!isOpen) return null;

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleGenerate() {
    const count = Number(form.count);

    if (!Number.isFinite(count) || count < 1 || count > 50) {
      setError("Count must be between 1 and 50.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const generated = [];
      for (let i = 0; i < count; i += 1) {
        let entry = generatePageInformation({ country: form.country });
        if (form.category && form.category !== "any") {
          let attempts = 0;
          while (entry.category !== form.category && attempts < 60) {
            entry = generatePageInformation({ country: form.country });
            attempts += 1;
          }
        }
        generated.push(entry);
      }

      const result = await bulkCreatePages(generated);

      // Remember the selected country as the user's default for next time.
      if (
        currentUser?.id &&
        form.country &&
        form.country !== (currentUser.defaultCountry || DEFAULT_COUNTRY)
      ) {
        try {
          const updated = await updateDefaultCountry(currentUser.id, form.country);
          if (updated?.user) login(updated.user);
        } catch {
          // non-critical
        }
      }

      onGenerated?.(result.pages || []);
      onToast?.(`Generated ${result.created} pages`);
      onClose();
    } catch (err) {
      setError(err.message || "Bulk create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="npm-backdrop" onClick={saving ? undefined : onClose}>
      <div className="npm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="npm-header">
          <div>
            <div className="npm-kicker">Auto-Generator</div>
            <h2 className="npm-title">Generate Pages</h2>
          </div>
          <button
            className="npm-close"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            x
          </button>
        </div>

        <div className="npm-body">
          <div className="npm-grid">
            <Field label="How many pages?">
              <input
                className="npm-input"
                type="number"
                min="1"
                max="50"
                value={form.count}
                onChange={(e) => setField("count", e.target.value)}
              />
            </Field>
            <Field label="Country">
              <select
                className="npm-input"
                value={form.country}
                onChange={(e) => setField("country", e.target.value)}
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select
                className="npm-input"
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
              >
                <option value="any">Any (random mix)</option>
                {sortedCategoryNames.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="npm-footer">
            <button
              type="button"
              className="btn-s"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <div className="npm-footer-actions">
              {error ? (
                <div className="npm-submit-error" style={{ margin: 0 }}>
                  {error}
                </div>
              ) : null}
              <button
                type="button"
                className="btn-p"
                onClick={handleGenerate}
                disabled={saving}
              >
                {saving
                  ? "Generating..."
                  : `Generate ${Number(form.count) || 0} Pages`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
