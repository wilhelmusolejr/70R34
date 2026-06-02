import { useEffect, useState } from "react";
import { bulkCreateProfiles } from "../api/profiles";
import { updateDefaultCountry } from "../api/auth";
import { STATUS_OPTIONS } from "../constants/profileUi";
import { useAuth } from "../context/AuthContext";
import { generateBatch } from "../generator/generate";
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY } from "../generator/countries/index.js";
import { buildIdentityPrompt } from "../utils/identityPrompt";

const DEFAULT_FORM = {
  count: 10,
  gender: "any",
  minAge: 25,
  maxAge: 45,
  emailDomain: "",
  status: "Pending Profile",
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

export function GenerateProfilesModal({
  isOpen,
  onClose,
  onGenerated,
  onToast,
}) {
  const { currentUser, login } = useAuth();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    const minAge = Number(form.minAge);
    const maxAge = Number(form.maxAge);

    if (count < 1 || count > 50) {
      setError("Count must be between 1 and 50.");
      return;
    }
    if (minAge < 25 || maxAge < 25) {
      setError("Ages must be at least 25.");
      return;
    }
    if (minAge >= maxAge) {
      setError("Min age must be less than max age.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const today = new Date().toLocaleDateString("en-CA");
      const profiles = generateBatch(count, {
        country: form.country,
        gender: form.gender,
        minAge,
        maxAge,
        emailDomain: form.emailDomain.trim() || "outlook.com",
        status: form.status,
      }).map((profile) => ({
        ...profile,
        profileCreated: today,
        identityPrompt: buildIdentityPrompt(profile),
      }));
      const result = await bulkCreateProfiles(profiles, currentUser?.id);
      if (result.user) {
        login(result.user);
      }

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
          // non-critical — don't block the generate flow
        }
      }

      onGenerated(result.profiles);
      onToast?.(`Generated ${result.created} profiles`);
      onClose();
    } catch (err) {
      setError(err.message || "Bulk create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="npm-backdrop" onClick={onClose}>
      <div className="npm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="npm-header">
          <div>
            <div className="npm-kicker">Auto-Generator</div>
            <h2 className="npm-title">Generate Profiles</h2>
          </div>
          <button className="npm-close" type="button" onClick={onClose}>
            x
          </button>
        </div>

        <div className="npm-body">
          <div className="npm-grid">
            <Field label="How many profiles?">
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
            <Field label="Gender">
              <select
                className="npm-input"
                value={form.gender}
                onChange={(e) => setField("gender", e.target.value)}
              >
                <option value="any">Any</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
            <Field label="Min Age">
              <input
                className="npm-input"
                type="number"
                min="25"
                max="54"
                value={form.minAge}
                onChange={(e) => setField("minAge", e.target.value)}
              />
            </Field>
            <Field label="Max Age">
              <input
                className="npm-input"
                type="number"
                min="26"
                max="55"
                value={form.maxAge}
                onChange={(e) => setField("maxAge", e.target.value)}
              />
            </Field>
            <Field label="Email Domain">
              <input
                className="npm-input"
                type="text"
                placeholder="outlook.com"
                value={form.emailDomain}
                onChange={(e) => setField("emailDomain", e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select
                className="npm-input"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="npm-footer">
            <button type="button" className="btn-s" onClick={onClose} disabled={saving}>
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
                {saving ? "Generating..." : `Generate ${Number(form.count) || 0} Profiles`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
