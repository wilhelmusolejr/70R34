import { useEffect, useState } from "react";
import { createProfile, updateProfile } from "../api/profiles";
import { useAuth } from "../context/AuthContext";
import { buildIdentityPrompt } from "../utils/identityPrompt";
import { STATUS_OPTIONS } from "../constants/profileUi";
import { generateProfile } from "../generator/generate";

const TABS = [
  "Basic Information",
  "Credentials",
  "Work",
  "Education",
  "Personal Info",
  "Travel",
  "Account",
];

const RELATIONSHIP_OPTIONS = [
  "",
  "Single",
  "In a Relationship",
  "Married",
  "It's Complicated",
  "Widowed",
  "Separated",
  "Divorced",
];

const AUTO_FILL_OPTIONS = {
  none: "none",
  random: "random",
};

function createEmptyWork() {
  return {
    company: "",
    position: "",
    from: "",
    to: "",
    current: false,
    city: "",
  };
}

function createEmptyTravel() {
  return {
    place: "",
    date: "",
  };
}

function createEmptyProfile() {
  const today = new Date().toLocaleDateString("en-CA");

  return {
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    email: "",
    emails: [],
    emailPassword: "",
    facebookPassword: "",
    city: "",
    hometown: "",
    bio: "",
    status: "Need Setup",
    profileUrl: "",
    pageUrl: "",
    tags: [],
    profileCreated: today,
    accountCreated: today,
    friends: 0,
    has2FA: false,
    hasPage: false,
    profileSetup: false,
    phone: "",
    recoveryEmail: "",
    notes: "",
    websites: [],
    socialLinks: [],
    trackerLog: [],
    avatarUrl: "",
    coverPhotoUrl: "",
    personal: {
      relationshipStatus: "",
      relationshipStatusSince: "",
      languages: [],
    },
    work: [createEmptyWork()],
    education: {
      college: {
        name: "",
        from: "",
        to: "",
        graduated: false,
        degree: "",
      },
      highSchool: {
        name: "",
        from: "",
        to: "",
        graduated: false,
        degree: "",
      },
    },
    hobbies: [],
    interests: {
      music: [],
      tvShows: [],
      movies: [],
      games: [],
      sportsTeams: [],
    },
    travel: [createEmptyTravel()],
    otherNames: [],
  };
}

function parseList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({ label, error, children }) {
  return (
    <label className="npm-field">
      <span className="npm-label">{label}</span>
      {children}
      {error ? <span className="npm-error">{error}</span> : null}
    </label>
  );
}

function SectionTitle({ title, action }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        marginBottom: "12px",
      }}
    >
      <div className="npm-label" style={{ marginBottom: 0 }}>
        {title}
      </div>
      {action}
    </div>
  );
}

function normalizeRelationshipStatus(status) {
  if (RELATIONSHIP_OPTIONS.includes(status)) {
    return status;
  }

  if (status === "Engaged" || status === "In an open relationship") {
    return "In a Relationship";
  }

  if (status === "In a civil union" || status === "In a domestic partnership") {
    return "Married";
  }

  return "";
}

export function NewProfileModal({
  isOpen,
  onClose,
  onCreated,
  onToast,
}) {
  const { currentUser, login } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState(() => createEmptyProfile());
  const [autoFillMode, setAutoFillMode] = useState(AUTO_FILL_OPTIONS.none);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(createEmptyProfile());
      setErrors({});
      setSubmitError("");
      setActiveTab(0);
      setAutoFillMode(AUTO_FILL_OPTIONS.none);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setNested(section, field, value) {
    setForm((current) => ({
      ...current,
      [section]: { ...current[section], [field]: value },
    }));
  }

  function setEducation(level, field, value) {
    setForm((current) => ({
      ...current,
      education: {
        ...current.education,
        [level]: {
          ...current.education[level],
          [field]: value,
        },
      },
    }));
  }

  function updateWork(index, field, value) {
    setForm((current) => ({
      ...current,
      work: current.work.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function addWork() {
    setForm((current) => ({
      ...current,
      work: [...current.work, createEmptyWork()],
    }));
  }

  function removeWork(index) {
    setForm((current) => ({
      ...current,
      work:
        current.work.length === 1
          ? [createEmptyWork()]
          : current.work.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateTravel(index, field, value) {
    setForm((current) => ({
      ...current,
      travel: current.travel.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function addTravel() {
    setForm((current) => ({
      ...current,
      travel: [...current.travel, createEmptyTravel()],
    }));
  }

  function removeTravel(index) {
    setForm((current) => ({
      ...current,
      travel:
        current.travel.length === 1
          ? [createEmptyTravel()]
          : current.travel.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function applyRandomAutofill() {
    const generated = generateProfile();

    setForm((current) => ({
      ...current,
      bio: generated.bio || current.bio,
      work: generated.work?.length ? generated.work : [createEmptyWork()],
      city: generated.city || current.city,
      hometown: generated.hometown || current.hometown,
      education: {
        college: {
          ...createEmptyProfile().education.college,
          ...(generated.education?.college || {}),
        },
        highSchool: {
          ...createEmptyProfile().education.highSchool,
          ...(generated.education?.highSchool || {}),
        },
      },
      personal: {
        relationshipStatus: normalizeRelationshipStatus(
          generated.personal?.relationshipStatus || "",
        ),
        relationshipStatusSince:
          generated.personal?.relationshipStatusSince || "",
        languages: generated.personal?.languages || [],
      },
      travel: generated.travel?.length
        ? generated.travel
        : [createEmptyTravel()],
      hobbiesInput: (generated.hobbies || []).join(", "),
      languagesInput: (generated.personal?.languages || []).join(", "),
    }));
  }

  function handleAutoFillModeChange(mode) {
    setAutoFillMode(mode);

    if (mode === AUTO_FILL_OPTIONS.random) {
      applyRandomAutofill();
    }
  }

  function validate(currentForm) {
    const nextErrors = {};

    if (!currentForm.firstName.trim()) {
      nextErrors.firstName = "First name is required.";
    }
    if (!currentForm.lastName.trim()) {
      nextErrors.lastName = "Last name is required.";
    }
    if (!currentForm.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!currentForm.email.includes("@")) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!currentForm.emailPassword.trim()) {
      nextErrors.emailPassword = "Email password is required.";
    }
    if (!currentForm.facebookPassword.trim()) {
      nextErrors.facebookPassword = "Facebook password is required.";
    }
    if (!currentForm.profileCreated) {
      nextErrors.profileCreated = "Profile created date is required.";
    }
    if (!currentForm.accountCreated) {
      nextErrors.accountCreated = "Account created date is required.";
    }

    return nextErrors;
  }

  function getFirstErrorTab(nextErrors) {
    if (nextErrors.firstName || nextErrors.lastName) {
      return 0;
    }
    if (
      nextErrors.email ||
      nextErrors.emailPassword ||
      nextErrors.facebookPassword
    ) {
      return 1;
    }
    if (nextErrors.profileCreated || nextErrors.accountCreated) {
      return 6;
    }
    return 0;
  }

  const tabHasError = {
    0: ["firstName", "lastName"].some((key) => errors[key]),
    1: ["email", "emailPassword", "facebookPassword"].some(
      (key) => errors[key],
    ),
    2: false,
    3: false,
    4: false,
    5: false,
    6: ["profileCreated", "accountCreated"].some((key) => errors[key]),
  };

  async function handleSubmit(e) {
    e.preventDefault();

    const nextErrors = validate(form);
    setErrors(nextErrors);
    setSubmitError("");

    if (Object.keys(nextErrors).length > 0) {
      setActiveTab(getFirstErrorTab(nextErrors));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        emails: form.email.trim()
          ? [{ address: form.email.trim(), selected: true }]
          : [],
        hobbies: parseList(form.hobbiesInput || ""),
        otherNames: parseList(form.otherNamesInput || ""),
        personal: {
          ...form.personal,
          languages: parseList(form.languagesInput || ""),
        },
        work: form.work.map((item) => ({
          ...item,
          to: item.current ? "" : item.to,
        })),
      };

      delete payload.email;
      delete payload.hobbiesInput;
      delete payload.otherNamesInput;
      delete payload.languagesInput;

      const result = await createProfile(payload, currentUser?.id);
      if (result.user) {
        login(result.user);
      }

      const identityPrompt = buildIdentityPrompt(result.profile);
      if (identityPrompt) {
        try {
          await updateProfile(result.profile._id, { identityPrompt });
        } catch {
          // non-critical, prompt can be regenerated from detail page
        }
      }

      onCreated(result.profile);
      onToast?.(`Profile created successfully.`);
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Failed to create profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="npm-backdrop" onClick={onClose}>
      <div
        className="npm-modal npm-modal-fixed"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="npm-header">
          <div>
            <div className="npm-kicker">Manual Profile Entry</div>
            <h2 className="npm-title">Create Profile</h2>
          </div>
          <button className="npm-close" type="button" onClick={onClose}>
            x
          </button>
        </div>

        <div className="npm-tabs" role="tablist" aria-label="New profile tabs">
          {TABS.map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={`npm-tab ${activeTab === index ? "active" : ""}${tabHasError[index] ? " error" : ""}`}
              onClick={() => setActiveTab(index)}
            >
              <span>{tab}</span>
            </button>
          ))}
        </div>

        <div className="npm-autofill">
          <div className="npm-label">Auto Fill</div>
          <div className="npm-autofill-options">
            <label className="npm-radio-option">
              <input
                type="radio"
                name="new-profile-autofill"
                checked={autoFillMode === AUTO_FILL_OPTIONS.random}
                onChange={() =>
                  handleAutoFillModeChange(AUTO_FILL_OPTIONS.random)
                }
              />
              <span>Auto fill up random data</span>
            </label>
            <label className="npm-radio-option">
              <input
                type="radio"
                name="new-profile-autofill"
                checked={autoFillMode === AUTO_FILL_OPTIONS.none}
                onChange={() =>
                  handleAutoFillModeChange(AUTO_FILL_OPTIONS.none)
                }
              />
              <span>None</span>
            </label>
          </div>
        </div>

        <form className="npm-body npm-body-fixed" onSubmit={handleSubmit}>
          <div className="npm-body-content">
            {activeTab === 0 && (
              <div className="npm-grid">
                <Field label="First Name" error={errors.firstName}>
                  <input
                    className="npm-input"
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                  />
                </Field>
                <Field label="Last Name" error={errors.lastName}>
                  <input
                    className="npm-input"
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                  />
                </Field>
                <Field label="Gender">
                  <select
                    className="npm-input"
                    value={form.gender}
                    onChange={(e) => setField("gender", e.target.value)}
                  >
                    <option value="">Select gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-Binary">Non-Binary</option>
                  </select>
                </Field>
                <Field label="Date of Birth">
                  <input
                    className="npm-input"
                    placeholder="MM-DD-YYYY"
                    value={form.dob}
                    onChange={(e) => setField("dob", e.target.value)}
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
            )}

            {activeTab === 1 && (
              <div className="npm-grid">
                <Field label="Email" error={errors.email}>
                  <input
                    className="npm-input"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                </Field>
                <Field label="Email Password" error={errors.emailPassword}>
                  <input
                    className="npm-input"
                    value={form.emailPassword}
                    onChange={(e) => setField("emailPassword", e.target.value)}
                  />
                </Field>
                <Field
                  label="Facebook Password"
                  error={errors.facebookPassword}
                >
                  <input
                    className="npm-input"
                    value={form.facebookPassword}
                    onChange={(e) =>
                      setField("facebookPassword", e.target.value)
                    }
                  />
                </Field>
              </div>
            )}

            {activeTab === 2 && (
              <div>
                <SectionTitle
                  title="Work Experience"
                  action={
                    <button
                      type="button"
                      className="add-item-btn"
                      onClick={addWork}
                    >
                      + Add
                    </button>
                  }
                />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  {form.work.map((item, index) => (
                    <div key={index} className="work-card">
                      <div className="work-header">
                        <div style={{ fontWeight: 600, color: "var(--text2)" }}>
                          Work #{index + 1}
                        </div>
                        {form.work.length > 1 && (
                          <button
                            type="button"
                            className="rm-btn"
                            onClick={() => removeWork(index)}
                            title="Remove"
                          >
                            x
                          </button>
                        )}
                      </div>
                      <div className="npm-grid">
                        <Field label="Name">
                          <input
                            className="npm-input"
                            value={item.company}
                            onChange={(e) =>
                              updateWork(index, "company", e.target.value)
                            }
                          />
                        </Field>
                        <Field label="Position">
                          <input
                            className="npm-input"
                            value={item.position}
                            onChange={(e) =>
                              updateWork(index, "position", e.target.value)
                            }
                          />
                        </Field>
                        <Field label="From">
                          <input
                            className="npm-input"
                            value={item.from}
                            onChange={(e) =>
                              updateWork(index, "from", e.target.value)
                            }
                          />
                        </Field>
                        {!item.current && (
                          <Field label="To">
                            <input
                              className="npm-input"
                              value={item.to}
                              onChange={(e) =>
                                updateWork(index, "to", e.target.value)
                              }
                            />
                          </Field>
                        )}
                        <Field label="Current">
                          <label className="current-toggle">
                            <input
                              type="checkbox"
                              checked={item.current}
                              onChange={(e) =>
                                updateWork(index, "current", e.target.checked)
                              }
                            />
                            Current role
                          </label>
                        </Field>
                        <Field label="City">
                          <input
                            className="npm-input"
                            value={item.city}
                            onChange={(e) =>
                              updateWork(index, "city", e.target.value)
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 3 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                <div>
                  <SectionTitle title="College" />
                  <div className="npm-grid">
                    <Field label="College Name">
                      <input
                        className="npm-input"
                        value={form.education.college.name}
                        onChange={(e) =>
                          setEducation("college", "name", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="College From">
                      <input
                        className="npm-input"
                        value={form.education.college.from}
                        onChange={(e) =>
                          setEducation("college", "from", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="College To">
                      <input
                        className="npm-input"
                        value={form.education.college.to}
                        onChange={(e) =>
                          setEducation("college", "to", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="College Graduated">
                      <label className="current-toggle">
                        <input
                          type="checkbox"
                          checked={form.education.college.graduated}
                          onChange={(e) =>
                            setEducation(
                              "college",
                              "graduated",
                              e.target.checked,
                            )
                          }
                        />
                        Graduated
                      </label>
                    </Field>
                    <Field label="College Degree">
                      <input
                        className="npm-input"
                        value={form.education.college.degree}
                        onChange={(e) =>
                          setEducation("college", "degree", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="High School" />
                  <div className="npm-grid">
                    <Field label="Highschool Name">
                      <input
                        className="npm-input"
                        value={form.education.highSchool.name}
                        onChange={(e) =>
                          setEducation("highSchool", "name", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Highschool From">
                      <input
                        className="npm-input"
                        value={form.education.highSchool.from}
                        onChange={(e) =>
                          setEducation("highSchool", "from", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Highschool To">
                      <input
                        className="npm-input"
                        value={form.education.highSchool.to}
                        onChange={(e) =>
                          setEducation("highSchool", "to", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Highschool Graduated">
                      <label className="current-toggle">
                        <input
                          type="checkbox"
                          checked={form.education.highSchool.graduated}
                          onChange={(e) =>
                            setEducation(
                              "highSchool",
                              "graduated",
                              e.target.checked,
                            )
                          }
                        />
                        Graduated
                      </label>
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 4 && (
              <div className="npm-grid">
                <Field label="Current City">
                  <input
                    className="npm-input"
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                  />
                </Field>
                <Field label="Hometown">
                  <input
                    className="npm-input"
                    value={form.hometown}
                    onChange={(e) => setField("hometown", e.target.value)}
                  />
                </Field>
                <Field label="Relationship Status">
                  <select
                    className="npm-input"
                    value={form.personal.relationshipStatus}
                    onChange={(e) =>
                      setNested(
                        "personal",
                        "relationshipStatus",
                        e.target.value,
                      )
                    }
                  >
                    <option value="">Select relationship status</option>
                    {RELATIONSHIP_OPTIONS.filter(Boolean).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Relationship Since">
                  <input
                    className="npm-input"
                    value={form.personal.relationshipStatusSince}
                    onChange={(e) =>
                      setNested(
                        "personal",
                        "relationshipStatusSince",
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Languages">
                  <input
                    className="npm-input"
                    placeholder="English, Spanish"
                    value={form.languagesInput || ""}
                    onChange={(e) => setField("languagesInput", e.target.value)}
                  />
                </Field>
                <Field label="Hobbies">
                  <input
                    className="npm-input"
                    placeholder="Hiking, Pottery"
                    value={form.hobbiesInput || ""}
                    onChange={(e) => setField("hobbiesInput", e.target.value)}
                  />
                </Field>
                <Field label="Other Names">
                  <input
                    className="npm-input"
                    placeholder="Alias, nickname"
                    value={form.otherNamesInput || ""}
                    onChange={(e) =>
                      setField("otherNamesInput", e.target.value)
                    }
                  />
                </Field>
                <Field label="Bio">
                  <textarea
                    className="npm-input npm-textarea"
                    value={form.bio}
                    onChange={(e) => setField("bio", e.target.value)}
                  />
                </Field>
              </div>
            )}

            {activeTab === 5 && (
              <div>
                <SectionTitle
                  title="Travel"
                  action={
                    <button
                      type="button"
                      className="add-item-btn"
                      onClick={addTravel}
                    >
                      + Add
                    </button>
                  }
                />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  {form.travel.map((item, index) => (
                    <div key={index} className="work-card">
                      <div className="work-header">
                        <div style={{ fontWeight: 600, color: "var(--text2)" }}>
                          Travel #{index + 1}
                        </div>
                        {form.travel.length > 1 && (
                          <button
                            type="button"
                            className="rm-btn"
                            onClick={() => removeTravel(index)}
                            title="Remove"
                          >
                            x
                          </button>
                        )}
                      </div>
                      <div className="npm-grid">
                        <Field label="Name">
                          <input
                            className="npm-input"
                            value={item.place}
                            onChange={(e) =>
                              updateTravel(index, "place", e.target.value)
                            }
                          />
                        </Field>
                        <Field label="Date">
                          <input
                            className="npm-input"
                            placeholder="YYYY-MM"
                            value={item.date}
                            onChange={(e) =>
                              updateTravel(index, "date", e.target.value)
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 6 && (
              <div className="npm-grid">
                <Field label="Profile Created" error={errors.profileCreated}>
                  <input
                    className="npm-input"
                    type="date"
                    value={form.profileCreated}
                    onChange={(e) => setField("profileCreated", e.target.value)}
                  />
                </Field>
                <Field label="Account Created" error={errors.accountCreated}>
                  <input
                    className="npm-input"
                    type="date"
                    value={form.accountCreated}
                    onChange={(e) => setField("accountCreated", e.target.value)}
                  />
                </Field>
                <Field label="Profile URL">
                  <input
                    className="npm-input"
                    placeholder="https://facebook.com/your-profile"
                    value={form.profileUrl}
                    onChange={(e) => setField("profileUrl", e.target.value)}
                  />
                </Field>
                <Field label="Page URL">
                  <input
                    className="npm-input"
                    placeholder="https://facebook.com/your-page"
                    value={form.pageUrl}
                    onChange={(e) => setField("pageUrl", e.target.value)}
                  />
                </Field>
              </div>
            )}

            {submitError ? (
              <div className="npm-submit-error">{submitError}</div>
            ) : null}
          </div>

          <div className="npm-footer">
            <button
              type="button"
              className="btn-s"
              onClick={() =>
                setActiveTab((current) => Math.max(current - 1, 0))
              }
              disabled={activeTab === 0}
            >
              Previous
            </button>
            <div className="npm-footer-actions">
              {activeTab < TABS.length - 1 ? (
                <button
                  type="button"
                  className="btn-p"
                  onClick={() =>
                    setActiveTab((current) =>
                      Math.min(current + 1, TABS.length - 1),
                    )
                  }
                >
                  Next Tab
                </button>
              ) : (
                <button type="submit" className="btn-p" disabled={saving}>
                  {saving ? "Creating..." : "Create Profile"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
