import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProfiles } from "../api/profiles";
import { fetchPosts } from "../api/posts";
import { fetchHumanAssets } from "../api/humanAssets";
import { fetchPages } from "../api/pages";
import { fetchUsers } from "../api/auth";
import { STATUS_OPTIONS } from "../constants/profileUi";
import "../App.css";

const COUNTRY_OPTIONS = [
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "IT", label: "Italy", flag: "🇮🇹" },
];

const MAKER_PALETTE = [
  "#5e5ce6",
  "#34c759",
  "#ff9f0a",
  "#ff375f",
  "#30b0c7",
  "#bf5af2",
  "#ff6b35",
  "#0071e3",
];

function toLocalDateKey(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildLastSevenDays() {
  const days = [];
  const now = new Date();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    days.push({
      key: toLocalDateKey(d),
      date: d,
      weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      isToday: offset === 0,
    });
  }
  return days;
}

function countByDay(items, keyGetter, days) {
  const counts = Object.fromEntries(days.map((d) => [d.key, 0]));
  for (const item of items) {
    const key = toLocalDateKey(keyGetter(item));
    if (key && key in counts) counts[key] += 1;
  }
  return counts;
}

function sumValues(obj) {
  return Object.values(obj).reduce((sum, n) => sum + n, 0);
}

function getCreatedById(profile) {
  const raw = profile?.createdBy;
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return String(raw.id || raw._id || "");
}

function MultiSelectFilter({ label, options, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === 0;
  return (
    <div className="dashboard-filter">
      <button
        type="button"
        className={`dashboard-filter-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="dashboard-filter-label">{label}</span>
        <span className="dashboard-filter-count">
          {allSelected ? "All" : `${selected.length} selected`}
        </span>
      </button>
      {open ? (
        <div
          className="dashboard-filter-menu"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            className="dashboard-filter-clear"
            onClick={() => {
              onClear();
            }}
          >
            Select all
          </button>
          {options.map((opt) => {
            const isChecked = selected.includes(opt.value);
            return (
              <label key={opt.value} className="dashboard-filter-row">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggle(opt.value)}
                />
                {opt.swatch ? (
                  <span
                    className="dashboard-filter-swatch"
                    style={{ background: opt.swatch }}
                  />
                ) : null}
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MetricRow({ label, accent, counts, days, total, link }) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <tr>
      <th scope="row" className="dashboard-metric-label">
        <span className="dashboard-metric-dot" style={{ background: accent }} />
        {link ? (
          <Link to={link} className="dashboard-metric-link">
            {label}
          </Link>
        ) : (
          label
        )}
      </th>
      {days.map((day) => {
        const value = counts[day.key] || 0;
        const intensity = value / max;
        return (
          <td
            key={day.key}
            className={`dashboard-metric-cell${day.isToday ? " is-today" : ""}`}
            style={{
              background:
                value > 0
                  ? `color-mix(in srgb, ${accent} ${Math.round(8 + intensity * 32)}%, transparent)`
                  : "transparent",
            }}
          >
            {value}
          </td>
        );
      })}
      <td className="dashboard-metric-total">{total}</td>
    </tr>
  );
}

function MakerSubmissionsChart({ makers, makerColor, days, submissionsByMaker }) {
  const allValues = makers.flatMap((maker) =>
    Object.values(submissionsByMaker[maker.id] || {}),
  );
  const max = Math.max(1, ...allValues);

  if (!makers.length) {
    return (
      <div className="dashboard-chart-empty">No makers match the filters.</div>
    );
  }

  return (
    <div className="dashboard-chart">
      <div className="dashboard-chart-grid">
        {days.map((day) => {
          const bars = makers
            .map((maker) => ({
              maker,
              value: (submissionsByMaker[maker.id] || {})[day.key] || 0,
            }))
            .filter((entry) => entry.value > 0);

          return (
            <div
              key={day.key}
              className={`dashboard-chart-col${day.isToday ? " is-today" : ""}`}
            >
              <div className="dashboard-chart-bars">
                {bars.length ? (
                  bars.map(({ maker, value }) => (
                    <div
                      key={maker.id}
                      className="dashboard-chart-bar"
                      title={`${maker.username}: ${value}`}
                      style={{
                        background: makerColor(maker.id),
                        height: `${Math.max(6, (value / max) * 100)}%`,
                      }}
                    >
                      <span className="dashboard-chart-bar-value">
                        {value}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="dashboard-chart-bar dashboard-chart-bar-empty" />
                )}
              </div>
              <div className="dashboard-chart-axis">
                <div className="dashboard-chart-weekday">{day.weekday}</div>
                <div className="dashboard-chart-day">{day.label}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="dashboard-chart-legend">
        {makers.map((maker) => (
          <span key={maker.id} className="dashboard-chart-legend-item">
            <span
              className="dashboard-chart-legend-dot"
              style={{ background: makerColor(maker.id) }}
            />
            {maker.username}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [profiles, setProfiles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [pages, setPages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedMakerIds, setSelectedMakerIds] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const [p, ps, a, pg, us] = await Promise.all([
          fetchProfiles().catch(() => []),
          fetchPosts().catch(() => []),
          fetchHumanAssets().catch(() => []),
          fetchPages().catch(() => []),
          fetchUsers().catch(() => []),
        ]);
        if (cancelled) return;
        setProfiles(Array.isArray(p) ? p : []);
        setPosts(Array.isArray(ps) ? ps : []);
        setAssets(Array.isArray(a) ? a : []);
        setPages(Array.isArray(pg) ? pg : []);
        setUsers(Array.isArray(us) ? us : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const days = useMemo(() => buildLastSevenDays(), []);
  const todayKey = days[days.length - 1]?.key;

  const makers = useMemo(
    () =>
      users
        .filter((user) => user.role === "maker")
        .map((user) => ({
          id: String(user.id || user._id || ""),
          username: user.username || "Maker",
          profiles: Array.isArray(user.profiles) ? user.profiles : [],
        }))
        .sort((a, b) => a.username.localeCompare(b.username)),
    [users],
  );

  const makerColor = useMemo(() => {
    const map = new Map();
    makers.forEach((maker, index) => {
      map.set(maker.id, MAKER_PALETTE[index % MAKER_PALETTE.length]);
    });
    return (id) => map.get(id) || "#888";
  }, [makers]);

  const visibleMakers = useMemo(
    () =>
      selectedMakerIds.length
        ? makers.filter((m) => selectedMakerIds.includes(m.id))
        : makers,
    [makers, selectedMakerIds],
  );

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      if (selectedCountries.length) {
        const country = (profile.country || "US").toUpperCase();
        if (!selectedCountries.includes(country)) return false;
      }
      if (selectedStatuses.length) {
        const status = String(profile.status || "");
        if (!selectedStatuses.includes(status)) return false;
      }
      if (selectedMakerIds.length) {
        const createdById = getCreatedById(profile);
        if (!selectedMakerIds.includes(createdById)) return false;
      }
      return true;
    });
  }, [profiles, selectedCountries, selectedStatuses, selectedMakerIds]);

  const profilesCreated = useMemo(
    () => countByDay(filteredProfiles, (p) => p.createdAt, days),
    [filteredProfiles, days],
  );
  const postsPublished = useMemo(
    () => countByDay(posts.filter((p) => p.postedAt), (p) => p.postedAt, days),
    [posts, days],
  );
  const postsCreated = useMemo(
    () => countByDay(posts, (p) => p.createdAt, days),
    [posts, days],
  );
  const assetsAdded = useMemo(
    () => countByDay(assets, (a) => a.createdAt, days),
    [assets, days],
  );
  const pagesCreated = useMemo(
    () => countByDay(pages, (p) => p.createdAt, days),
    [pages, days],
  );
  const trackerEntries = useMemo(() => {
    const flat = [];
    for (const profile of filteredProfiles) {
      for (const entry of profile.trackerLog || []) {
        if (entry?.date) flat.push({ date: entry.date });
      }
    }
    return countByDay(flat, (entry) => entry.date, days);
  }, [filteredProfiles, days]);

  const profileIdToCountry = useMemo(() => {
    const map = new Map();
    for (const profile of profiles) {
      map.set(String(profile._id || profile.id || ""), (profile.country || "US").toUpperCase());
    }
    return map;
  }, [profiles]);
  const profileIdToStatus = useMemo(() => {
    const map = new Map();
    for (const profile of profiles) {
      map.set(String(profile._id || profile.id || ""), String(profile.status || ""));
    }
    return map;
  }, [profiles]);

  function assignmentPassesFilters(assignment) {
    if (assignment.assignmentStatus !== "completed") return false;
    if (!assignment.submittedAt) return false;
    const profileId = String(assignment.profileId || "");
    if (selectedCountries.length) {
      const country = profileIdToCountry.get(profileId);
      if (!country || !selectedCountries.includes(country)) return false;
    }
    if (selectedStatuses.length) {
      const status = profileIdToStatus.get(profileId);
      if (!status || !selectedStatuses.includes(status)) return false;
    }
    return true;
  }

  const submissionsByMaker = useMemo(() => {
    const result = {};
    for (const maker of visibleMakers) {
      const submissions = (maker.profiles || []).filter(
        assignmentPassesFilters,
      );
      result[maker.id] = countByDay(
        submissions,
        (entry) => entry.submittedAt,
        days,
      );
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visibleMakers,
    days,
    profileIdToCountry,
    profileIdToStatus,
    selectedCountries,
    selectedStatuses,
  ]);

  const submittedTodayByMaker = useMemo(() => {
    return visibleMakers.map((maker) => ({
      maker,
      count: (submissionsByMaker[maker.id] || {})[todayKey] || 0,
    }));
  }, [visibleMakers, submissionsByMaker, todayKey]);

  const totals = {
    profiles: sumValues(profilesCreated),
    posts: sumValues(postsPublished),
    drafts: sumValues(postsCreated),
    assets: sumValues(assetsAdded),
    pages: sumValues(pagesCreated),
    trackers: sumValues(trackerEntries),
    submittedToday: submittedTodayByMaker.reduce(
      (sum, entry) => sum + entry.count,
      0,
    ),
  };

  const makerFilterOptions = makers.map((maker) => ({
    value: maker.id,
    label: maker.username,
    swatch: makerColor(maker.id),
  }));
  const countryFilterOptions = COUNTRY_OPTIONS.map((c) => ({
    value: c.code,
    label: `${c.flag} ${c.label}`,
  }));
  const statusFilterOptions = STATUS_OPTIONS.map((status) => ({
    value: status,
    label: status,
  }));

  function toggleArrayValue(setter, value) {
    setter((current) =>
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
  }

  const hasActiveFilters =
    selectedMakerIds.length > 0 ||
    selectedCountries.length > 0 ||
    selectedStatuses.length > 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Daily activity over the last 7 days.</p>
        </div>
      </div>

      {error ? (
        <div className="empty-st">
          <div className="et">Could not load dashboard</div>
          <div className="ed">{error}</div>
        </div>
      ) : null}

      <div className="dashboard-section-head">
        <h2>Weekly totals</h2>
      </div>
      <div className="dashboard-summary">
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-label">Profiles created</div>
          <div className="dashboard-summary-value">{totals.profiles}</div>
        </div>
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-label">Posts published</div>
          <div className="dashboard-summary-value">{totals.posts}</div>
        </div>
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-label">Posts drafted</div>
          <div className="dashboard-summary-value">{totals.drafts}</div>
        </div>
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-label">Image assets added</div>
          <div className="dashboard-summary-value">{totals.assets}</div>
        </div>
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-label">Pages created</div>
          <div className="dashboard-summary-value">{totals.pages}</div>
        </div>
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-label">Tracker entries</div>
          <div className="dashboard-summary-value">{totals.trackers}</div>
        </div>
      </div>

      <div className="dashboard-filter-bar">
        <MultiSelectFilter
          label="Makers"
          options={makerFilterOptions}
          selected={selectedMakerIds}
          onToggle={(v) => toggleArrayValue(setSelectedMakerIds, v)}
          onClear={() => setSelectedMakerIds([])}
        />
        <MultiSelectFilter
          label="Countries"
          options={countryFilterOptions}
          selected={selectedCountries}
          onToggle={(v) => toggleArrayValue(setSelectedCountries, v)}
          onClear={() => setSelectedCountries([])}
        />
        <MultiSelectFilter
          label="Profile statuses"
          options={statusFilterOptions}
          selected={selectedStatuses}
          onToggle={(v) => toggleArrayValue(setSelectedStatuses, v)}
          onClear={() => setSelectedStatuses([])}
        />
        {hasActiveFilters ? (
          <button
            type="button"
            className="dashboard-filter-reset"
            onClick={() => {
              setSelectedMakerIds([]);
              setSelectedCountries([]);
              setSelectedStatuses([]);
            }}
          >
            Reset filters
          </button>
        ) : null}
      </div>

      <div className="dashboard-split">
        <aside className="dashboard-split-aside">
          <div className="dashboard-section-head">
            <h2>Submitted today</h2>
            <span className="dashboard-section-sub">
              <strong>{totals.submittedToday}</strong> total
            </span>
          </div>
          <div className="dashboard-submitted-grid-2col">
            {visibleMakers.length ? (
              submittedTodayByMaker.map(({ maker, count }) => (
                <div key={maker.id} className="dashboard-submitted-card">
                  <div className="dashboard-submitted-head">
                    <span
                      className="dashboard-submitted-dot"
                      style={{ background: makerColor(maker.id) }}
                    />
                    <span className="dashboard-submitted-name">
                      {maker.username}
                    </span>
                  </div>
                  <div className="dashboard-submitted-value">{count}</div>
                  <div className="dashboard-submitted-foot">
                    submitted today
                  </div>
                </div>
              ))
            ) : (
              <div className="dashboard-chart-empty">
                No makers match the current filters.
              </div>
            )}
          </div>
        </aside>
        <div className="dashboard-split-main">
          <div className="dashboard-section-head">
            <h2>Submissions per maker · last 7 days</h2>
          </div>
          <div className="dashboard-chart-wrap">
            {loading ? (
              <div className="dashboard-chart-empty">Loading activity…</div>
            ) : (
              <MakerSubmissionsChart
                makers={visibleMakers}
                makerColor={makerColor}
                days={days}
                submissionsByMaker={submissionsByMaker}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
