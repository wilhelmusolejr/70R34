import { useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import { CircleMarker, GeoJSON, MapContainer, Popup, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import countries110m from "world-atlas/countries-110m.json";
import { fetchProfiles } from "../api/profiles";
import { fetchPosts } from "../api/posts";
import { fetchPages } from "../api/pages";
import { fetchUsers } from "../api/auth";
import { STATUS_CLASS, STATUS_OPTIONS } from "../constants/profileUi";
import {
  buildLastSevenDays,
  countByDay,
  statusColor,
  sumValues,
  toLocalDateKey,
} from "../utils/dashboard";
import { buildProfileLocationPoints } from "../utils/profileLocations";
import "leaflet/dist/leaflet.css";
import "../App.css";

const WORLD_COUNTRIES = feature(countries110m, countries110m.objects.countries);

const COUNTRY_OPTIONS = [
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "IT", label: "Italy", flag: "🇮🇹" },
];

const MAKER_PALETTE = [
  "var(--blue, #0071e3)",
  "var(--green, #34c759)",
  "var(--amber, #ff9f0a)",
  "var(--red, #ff375f)",
  "var(--cyan, #30b0c7)",
  "var(--purple, #bf5af2)",
  "var(--orange, #ff6b35)",
  "var(--indigo, #5e5ce6)",
];

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
            onClick={onClear}
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

function SummaryCard({ label, value, hint }) {
  return (
    <div className="dashboard-summary-card">
      <div className="dashboard-summary-label">{label}</div>
      <div className="dashboard-summary-value">{value}</div>
      {hint ? <div className="dashboard-summary-hint">{hint}</div> : null}
    </div>
  );
}

function AttentionCard({ tone, label, value, sub, to }) {
  const inner = (
    <>
      <div className="dashboard-attention-value">{value}</div>
      <div className="dashboard-attention-label">{label}</div>
      <div className="dashboard-attention-sub">{sub}</div>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={`dashboard-attention-card tone-${tone}`}>
        {inner}
      </Link>
    );
  }
  return <div className={`dashboard-attention-card tone-${tone}`}>{inner}</div>;
}

function StatusDonut({ slices }) {
  // SVG donut using stroke-dasharray on a single circle, drawn in slices.
  const RADIUS = 70;
  const STROKE = 24;
  const CX = 100;
  const CY = 100;
  const circumference = 2 * Math.PI * RADIUS;
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  let offset = 0;

  return (
    <div className="dashboard-donut-wrap">
      <svg
        className="dashboard-donut"
        viewBox="0 0 200 200"
        role="img"
        aria-label="Profile status breakdown"
      >
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS}
          fill="none"
          stroke="var(--surface2)"
          strokeWidth={STROKE}
        />
        {total > 0 ? (
          slices.map((slice) => {
            if (slice.value === 0) return null;
            const fraction = slice.value / total;
            const dash = fraction * circumference;
            const gap = circumference - dash;
            const segment = (
              <circle
                key={slice.label}
                cx={CX}
                cy={CY}
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${CX} ${CY})`}
              >
                <title>{`${slice.label}: ${slice.value}`}</title>
              </circle>
            );
            offset += dash;
            return segment;
          })
        ) : null}
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          className="dashboard-donut-total"
        >
          {total}
        </text>
        <text
          x={CX}
          y={CY + 16}
          textAnchor="middle"
          className="dashboard-donut-sub"
        >
          total
        </text>
      </svg>
      <ul className="dashboard-donut-legend">
        {slices.map((slice) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <li key={slice.label}>
              <span
                className="dashboard-donut-swatch"
                style={{ background: slice.color }}
              />
              <span className="dashboard-donut-legend-label">
                {slice.label}
              </span>
              <span className="dashboard-donut-legend-value">
                {slice.value}
              </span>
              <span className="dashboard-donut-legend-pct">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MakerSubmissionsChart({
  makers,
  makerColor,
  days,
  submissionsByMaker,
  selectedKey,
  onSelectDay,
}) {
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
          const isSelected = selectedKey === day.key;

          return (
            <div
              key={day.key}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay?.(day.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDay?.(day.key);
                }
              }}
              className={`dashboard-chart-col dashboard-chart-col-clickable${
                day.isToday ? " is-today" : ""
              }${isSelected ? " is-selected" : ""}`}
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

function PageSetChart({ days, passed, failed, selectedKey, onSelectDay }) {
  // Stacked bar per day: profiles whose Set Page step was stamped that day,
  // split by whether the profile currently has a pageUrl (passed) or not
  // (failed). Note: pass/fail is current state, so older days are re-judged as
  // page URLs get backfilled.
  const max = Math.max(
    1,
    ...days.map((d) => (passed[d.key] || 0) + (failed[d.key] || 0)),
  );

  const hasAny = days.some(
    (d) => (passed[d.key] || 0) + (failed[d.key] || 0) > 0,
  );
  if (!hasAny) {
    return (
      <div className="dashboard-chart-empty">
        No Set Page steps stamped in the last 7 days.
      </div>
    );
  }

  return (
    <div className="dashboard-chart">
      <div className="dashboard-chart-grid">
        {days.map((day) => {
          const pass = passed[day.key] || 0;
          const fail = failed[day.key] || 0;
          const total = pass + fail;
          const isSelected = selectedKey === day.key;
          return (
            <div
              key={day.key}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay?.(isSelected ? null : day.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDay?.(isSelected ? null : day.key);
                }
              }}
              className={`dashboard-chart-col dashboard-chart-col-clickable${
                day.isToday ? " is-today" : ""
              }${isSelected ? " is-selected" : ""}`}
            >
              <div className="dashboard-chart-bars">
                {total > 0 ? (
                  <div
                    className="dashboard-pageset-stack"
                    style={{ height: `${Math.max(6, (total / max) * 100)}%` }}
                    title={`${day.label}: ${total} set · ${pass} passed · ${fail} failed`}
                  >
                    {fail > 0 ? (
                      <div
                        className="dashboard-pageset-seg dashboard-pageset-fail"
                        style={{ height: `${(fail / total) * 100}%` }}
                      >
                        <span className="dashboard-chart-bar-value">{fail}</span>
                      </div>
                    ) : null}
                    {pass > 0 ? (
                      <div
                        className="dashboard-pageset-seg dashboard-pageset-pass"
                        style={{ height: `${(pass / total) * 100}%` }}
                      >
                        <span className="dashboard-chart-bar-value">{pass}</span>
                      </div>
                    ) : null}
                  </div>
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
        <span className="dashboard-chart-legend-item">
          <span
            className="dashboard-chart-legend-dot"
            style={{ background: "var(--green, #34c759)" }}
          />
          Passed · has page URL
        </span>
        <span className="dashboard-chart-legend-item">
          <span
            className="dashboard-chart-legend-dot"
            style={{ background: "var(--red, #ff375f)" }}
          />
          Failed · no page URL
        </span>
      </div>
    </div>
  );
}

function TrendLineChart({ days, series }) {
  // series: [{ label, color, counts: { dateKey: number } }]
  const WIDTH = 720;
  const HEIGHT = 220;
  const PAD_L = 36;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 32;

  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;

  const allValues = series.flatMap((s) => days.map((d) => s.counts[d.key] || 0));
  const max = Math.max(1, ...allValues);

  const xFor = (i) => PAD_L + (i / (days.length - 1)) * innerW;
  const yFor = (v) => PAD_T + (1 - v / max) * innerH;

  return (
    <div className="dashboard-trend">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="dashboard-trend-svg"
        role="img"
        aria-label="Weekly trend"
      >
        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <line
            key={tick}
            x1={PAD_L}
            x2={WIDTH - PAD_R}
            y1={PAD_T + tick * innerH}
            y2={PAD_T + tick * innerH}
            stroke="var(--border)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        ))}
        {[0, 0.5, 1].map((tick) => (
          <text
            key={`label-${tick}`}
            x={PAD_L - 8}
            y={PAD_T + tick * innerH + 4}
            textAnchor="end"
            className="dashboard-trend-axis"
          >
            {Math.round(max * (1 - tick))}
          </text>
        ))}
        {days.map((day, i) => (
          <text
            key={`day-${day.key}`}
            x={xFor(i)}
            y={HEIGHT - PAD_B + 16}
            textAnchor="middle"
            className={`dashboard-trend-axis${day.isToday ? " is-today" : ""}`}
          >
            {day.weekday}
          </text>
        ))}
        {series.map((s) => {
          const points = days.map((d, i) => {
            const v = s.counts[d.key] || 0;
            return [xFor(i), yFor(v)];
          });
          const pathD = points
            .map(([x, y], idx) => `${idx === 0 ? "M" : "L"}${x},${y}`)
            .join(" ");
          const areaD = `${pathD} L${xFor(days.length - 1)},${yFor(0)} L${xFor(0)},${yFor(0)} Z`;
          return (
            <g key={s.label}>
              <path d={areaD} fill={s.color} fillOpacity="0.1" />
              <path
                d={pathD}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map(([x, y], i) => {
                const day = days[i];
                const v = s.counts[day.key] || 0;
                return (
                  <g key={`${s.label}-${day.key}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={day.isToday ? 4 : 3}
                      fill="var(--surface)"
                      stroke={s.color}
                      strokeWidth={day.isToday ? 2.5 : 1.5}
                    >
                      <title>{`${s.label} · ${day.label}: ${v}`}</title>
                    </circle>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="dashboard-trend-legend">
        {series.map((s) => (
          <span key={s.label} className="dashboard-trend-legend-item">
            <span
              className="dashboard-trend-legend-dot"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function PipelineFunnel({ stages, fallout }) {
  const max = Math.max(1, ...stages.map((s) => s.value), ...fallout.map((f) => f.value));
  return (
    <div className="dashboard-funnel">
      <div className="dashboard-funnel-track">
        {stages.map((stage) => {
          const pct = Math.round((stage.value / max) * 100);
          return (
            <div key={stage.label} className="dashboard-funnel-row">
              <div className="dashboard-funnel-label">{stage.label}</div>
              <div className="dashboard-funnel-bar-track">
                <div
                  className="dashboard-funnel-bar"
                  style={{
                    width: `${Math.max(4, pct)}%`,
                    background: stage.color,
                  }}
                  title={`${stage.label}: ${stage.value}`}
                >
                  <span className="dashboard-funnel-bar-value">
                    {stage.value}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {fallout.length ? (
        <div className="dashboard-funnel-fallout">
          <div className="dashboard-funnel-fallout-label">Fallout</div>
          {fallout.map((f) => {
            const pct = Math.round((f.value / max) * 100);
            return (
              <div key={f.label} className="dashboard-funnel-row">
                <div className="dashboard-funnel-label">{f.label}</div>
                <div className="dashboard-funnel-bar-track">
                  <div
                    className="dashboard-funnel-bar dashboard-funnel-bar-fallout"
                    style={{
                      width: `${Math.max(4, pct)}%`,
                      background: f.color,
                    }}
                    title={`${f.label}: ${f.value}`}
                  >
                    <span className="dashboard-funnel-bar-value">
                      {f.value}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MapAutoFit({ points, resetKey }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) {
      map.setView([20, 0], 2);
      return;
    }
    const bounds = points.map((point) => [point.lat, point.lon]);
    map.fitBounds(bounds, {
      padding: [42, 42],
      maxZoom: points.length === 1 ? 7 : 11,
    });
  }, [map, points, resetKey]);

  return null;
}

function ProfileLocationMap({ points, missing }) {
  const countryGroups = useMemo(() => {
    const groups = new Map();
    for (const point of points) {
      const country = point.country || "Unknown";
      if (!groups.has(country)) {
        groups.set(country, { country, count: 0, cities: 0 });
      }
      const group = groups.get(country);
      group.count += point.count;
      group.cities += 1;
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  }, [points]);
  const [selectedMapCountries, setSelectedMapCountries] = useState([]);
  const [resetMapKey, setResetMapKey] = useState(0);
  const visiblePoints = useMemo(() => {
    if (!selectedMapCountries.length) return points;
    return points.filter((point) => selectedMapCountries.includes(point.country));
  }, [points, selectedMapCountries]);
  const cityGroups = useMemo(() => {
    const groups = new Map();
    for (const point of visiblePoints) {
      const country = point.country || "Unknown";
      if (!groups.has(country)) {
        groups.set(country, {
          country,
          count: 0,
          cities: [],
        });
      }
      const group = groups.get(country);
      group.count += point.count;
      group.cities.push(point);
    }
    return [...groups.values()]
      .map((group) => ({
        ...group,
        cities: group.cities.sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.count - a.count);
  }, [visiblePoints]);
  const maxCount = Math.max(1, ...visiblePoints.map((point) => point.count));
  const palette = ["#2f80ed", "#27c46b", "#f59e0b"];

  const toggleMapCountry = (country) => {
    setSelectedMapCountries((current) =>
      current.length === 0
        ? countryGroups
            .map((group) => group.country)
            .filter((entry) => entry !== country)
        : current.includes(country)
        ? current.filter((entry) => entry !== country)
        : [...current, country],
    );
  };

  return (
    <div className="dashboard-location-map">
      <div className="dashboard-map-panel">
        <button
          type="button"
          className="dashboard-map-reset"
          onClick={() => setResetMapKey((current) => current + 1)}
        >
          Reset map
        </button>
        <MapContainer
          className="dashboard-leaflet-map"
          center={[20, 0]}
          zoom={2}
          minZoom={2}
          maxZoom={13}
          scrollWheelZoom
          worldCopyJump
          zoomControl
        >
          <GeoJSON
            data={WORLD_COUNTRIES}
            className="dashboard-map-geojson"
            style={() => ({
              color: "#444",
              weight: 0.7,
              fillColor: "#2f2f2f",
              fillOpacity: 0.9,
            })}
          />
          <MapAutoFit points={visiblePoints} resetKey={resetMapKey} />
          {visiblePoints.map((point, index) => {
            const radius = 6 + Math.sqrt(point.count / maxCount) * 14;
            const color = palette[index % palette.length];
            return (
              <CircleMarker
                key={point.key}
                center={[point.lat, point.lon]}
                radius={radius}
                pathOptions={{
                  color: "rgba(255,255,255,0.72)",
                  weight: 1.6,
                  fillColor: color,
                  fillOpacity: 0.76,
                }}
              >
                <Popup>
                  <div className="dashboard-map-popup">
                    <strong>
                      {point.city}, {point.country}
                    </strong>
                    <span>
                      {point.count} profile{point.count === 1 ? "" : "s"}
                    </span>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      <div className="dashboard-map-list">
        <div className="dashboard-map-list-head">
          <span>{visiblePoints.length} cities plotted</span>
          {missing ? <span>{missing} without coordinates</span> : null}
        </div>
        <details className="dashboard-map-filter" open>
          <summary>Countries</summary>
          <div className="dashboard-map-filter-options">
            <label className="dashboard-map-filter-row">
              <input
                type="checkbox"
                checked={selectedMapCountries.length === 0}
                onChange={() => setSelectedMapCountries([])}
              />
              <span>All countries</span>
              <em>{points.reduce((sum, point) => sum + point.count, 0)}</em>
            </label>
            {countryGroups.map((group) => (
              <label key={group.country} className="dashboard-map-filter-row">
                <input
                  type="checkbox"
                  checked={
                    selectedMapCountries.length === 0 ||
                    selectedMapCountries.includes(group.country)
                  }
                  onChange={() => toggleMapCountry(group.country)}
                />
                <span>{group.country}</span>
                <em>{group.count}</em>
              </label>
            ))}
          </div>
        </details>
        {cityGroups.length ? (
          <div className="dashboard-map-country-list">
            {cityGroups.map((group) => (
              <details key={group.country} className="dashboard-map-country-group">
                <summary>
                  <span>{group.country}</span>
                  <em>
                    {group.count} profile{group.count === 1 ? "" : "s"}
                  </em>
                </summary>
                <ol className="dashboard-map-city-list">
                  {group.cities.map((point) => (
                    <li key={point.key}>
                      <span className="dashboard-map-city-name">
                        {point.city}
                      </span>
                      <span className="dashboard-map-city-count">{point.count}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        ) : (
          <div className="dashboard-chart-empty">
            No current city values can be plotted for this view.
          </div>
        )}
      </div>
    </div>
  );
}

function toggleArrayValue(setter, value) {
  setter((current) =>
    current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value],
  );
}

export function DashboardPageV2() {
  const [profiles, setProfiles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [pages, setPages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedMakerIds, setSelectedMakerIds] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [infoModalMaker, setInfoModalMaker] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const [p, ps, pg, us] = await Promise.all([
          fetchProfiles().catch(() => []),
          fetchPosts().catch(() => []),
          fetchPages().catch(() => []),
          fetchUsers().catch(() => []),
        ]);
        if (cancelled) return;
        setProfiles(Array.isArray(p) ? p : []);
        setPosts(Array.isArray(ps) ? ps : []);
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

  // ----- Makers / colors -----
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
    return (id) => map.get(id) || "var(--text2)";
  }, [makers]);

  const visibleMakers = useMemo(
    () =>
      selectedMakerIds.length
        ? makers.filter((m) => selectedMakerIds.includes(m.id))
        : makers,
    [makers, selectedMakerIds],
  );

  // ----- Profile filtering -----
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

  // ----- Per-day series (current 7 days) -----
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
  const pagesCreated = useMemo(
    () => countByDay(pages, (p) => p.createdAt, days),
    [pages, days],
  );

  // ----- Set Page step: stamped per day, split by pass (has pageUrl) / fail -----
  const hasPageUrl = (p) => Boolean(p.pageUrl && String(p.pageUrl).trim());
  const pageSetPassed = useMemo(
    () =>
      countByDay(
        filteredProfiles.filter(
          (p) => p.onboarding?.pageSetAt && hasPageUrl(p),
        ),
        (p) => p.onboarding.pageSetAt,
        days,
      ),
    [filteredProfiles, days],
  );
  const pageSetFailed = useMemo(
    () =>
      countByDay(
        filteredProfiles.filter(
          (p) => p.onboarding?.pageSetAt && !hasPageUrl(p),
        ),
        (p) => p.onboarding.pageSetAt,
        days,
      ),
    [filteredProfiles, days],
  );
  const pageSetTotals = useMemo(
    () => ({
      passed: sumValues(pageSetPassed),
      failed: sumValues(pageSetFailed),
      today: {
        passed: pageSetPassed[todayKey] || 0,
        failed: pageSetFailed[todayKey] || 0,
      },
    }),
    [pageSetPassed, pageSetFailed, todayKey],
  );

  // Profiles whose Set Page step was stamped on the selected day (defaults to
  // today), split pass/fail. Drives the per-day breakdown under the chart.
  const [pageSetSelectedKey, setPageSetSelectedKey] = useState(todayKey);
  const pageSetDayProfiles = useMemo(() => {
    if (!pageSetSelectedKey) return { passed: [], failed: [] };
    const onDay = (p) =>
      p.onboarding?.pageSetAt &&
      toLocalDateKey(p.onboarding.pageSetAt) === pageSetSelectedKey;
    const sortByName = (a, b) =>
      `${a.firstName || ""} ${a.lastName || ""}`.localeCompare(
        `${b.firstName || ""} ${b.lastName || ""}`,
      );
    return {
      passed: filteredProfiles
        .filter((p) => onDay(p) && hasPageUrl(p))
        .sort(sortByName),
      failed: filteredProfiles
        .filter((p) => onDay(p) && !hasPageUrl(p))
        .sort(sortByName),
    };
  }, [filteredProfiles, pageSetSelectedKey]);
  const pageSetSelectedLabel = useMemo(
    () => days.find((d) => d.key === pageSetSelectedKey)?.label || "",
    [days, pageSetSelectedKey],
  );

  // Snapshot counts (not week-bucketed) — respect profile filters.
  const profilesRunning = useMemo(
    () => filteredProfiles.filter((p) => p.status === "Active").length,
    [filteredProfiles],
  );
  const profilesReady = useMemo(
    () => filteredProfiles.filter((p) => p.status === "Ready").length,
    [filteredProfiles],
  );

  // Tracker entries series for trend chart only.
  const trackerEntries = useMemo(() => {
    const flat = [];
    for (const profile of filteredProfiles) {
      for (const entry of profile.trackerLog || []) {
        if (entry?.date) flat.push({ date: entry.date });
      }
    }
    return countByDay(flat, (entry) => entry.date, days);
  }, [filteredProfiles, days]);

  // ----- Per-maker submissions for chart + Submitted today -----
  const profileIdToCountry = useMemo(() => {
    const map = new Map();
    for (const profile of profiles) {
      map.set(
        String(profile._id || profile.id || ""),
        (profile.country || "US").toUpperCase(),
      );
    }
    return map;
  }, [profiles]);
  const profileIdToStatus = useMemo(() => {
    const map = new Map();
    for (const profile of profiles) {
      map.set(
        String(profile._id || profile.id || ""),
        String(profile.status || ""),
      );
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

  // Which day the "Submitted" cards + maker modal reflect. Defaults to today,
  // but clicking a column in the submissions chart re-points it to that day.
  const [submittedSelectedKey, setSubmittedSelectedKey] = useState(todayKey);
  const submittedDay = useMemo(
    () => days.find((d) => d.key === submittedSelectedKey) || null,
    [days, submittedSelectedKey],
  );
  const submittedIsToday = submittedSelectedKey === todayKey;

  const submittedTodayByMaker = useMemo(
    () =>
      visibleMakers.map((maker) => ({
        maker,
        count: (submissionsByMaker[maker.id] || {})[submittedSelectedKey] || 0,
      })),
    [visibleMakers, submissionsByMaker, submittedSelectedKey],
  );

  // ----- Status breakdown (filtered) -----
  const statusBreakdown = useMemo(() => {
    const counts = Object.fromEntries(STATUS_OPTIONS.map((s) => [s, 0]));
    for (const profile of filteredProfiles) {
      const s = String(profile.status || "");
      if (s in counts) counts[s] += 1;
    }
    return STATUS_OPTIONS.map((label) => ({
      label,
      value: counts[label],
      color: statusColor(label),
    }));
  }, [filteredProfiles]);

  const profileLocationMap = useMemo(
    () => buildProfileLocationPoints(filteredProfiles),
    [filteredProfiles],
  );

  // ----- Attention row counts -----
  const attentionCounts = useMemo(() => {
    const flagged = filteredProfiles.filter((p) => p.status === "Flagged").length;
    const banned = filteredProfiles.filter((p) => p.status === "Banned").length;
    // Profiles whose status transitioned to "Banned" today (from statusHistory).
    const bannedToday = filteredProfiles.filter((p) =>
      (p.statusHistory || []).some(
        (h) => h.to === "Banned" && toLocalDateKey(h.at) === todayKey,
      ),
    ).length;
    const needsSetup = filteredProfiles.filter((p) =>
      ["Need Setup", "Pending Profile"].includes(p.status),
    ).length;
    const needChecking = filteredProfiles.filter(
      (p) => p.status === "Need Checking",
    ).length;
    const pendingAssignments = users
      .filter((u) => u.role === "maker")
      .reduce(
        (sum, user) =>
          sum +
          (user.profiles || []).filter(
            (a) => a.assignmentStatus === "pending",
          ).length,
        0,
      );
    return { flagged, banned, bannedToday, needsSetup, needChecking, pendingAssignments };
  }, [filteredProfiles, users, todayKey]);

  // ----- Totals -----
  const totals = {
    profiles: sumValues(profilesCreated),
    posts: sumValues(postsPublished),
    drafts: sumValues(postsCreated),
    pages: sumValues(pagesCreated),
    submittedToday: submittedTodayByMaker.reduce(
      (sum, entry) => sum + entry.count,
      0,
    ),
  };

  // ----- Pipeline funnel data -----
  const pipelineStages = useMemo(() => {
    const counts = {};
    for (const profile of filteredProfiles) {
      const s = String(profile.status || "");
      counts[s] = (counts[s] || 0) + 1;
    }
    return [
      { label: "Available", value: counts["Available"] || 0, color: statusColor("Available") },
      {
        label: "Need Setup / Pending",
        value: (counts["Need Setup"] || 0) + (counts["Pending Profile"] || 0) + (counts["Need Checking"] || 0),
        color: statusColor("Need Setup"),
      },
      { label: "Active", value: counts["Active"] || 0, color: statusColor("Active") },
      { label: "Ready", value: counts["Ready"] || 0, color: statusColor("Ready") },
      { label: "Delivered", value: counts["Delivered"] || 0, color: statusColor("Delivered") },
    ];
  }, [filteredProfiles]);

  const pipelineFallout = useMemo(() => {
    const counts = { Flagged: 0, Banned: 0 };
    for (const profile of filteredProfiles) {
      const s = String(profile.status || "");
      if (s in counts) counts[s] += 1;
    }
    return [
      { label: "Flagged", value: counts.Flagged, color: statusColor("Flagged") },
      { label: "Banned", value: counts.Banned, color: statusColor("Banned") },
    ];
  }, [filteredProfiles]);

  // ----- Trend series -----
  const trendSeries = [
    {
      label: "Profiles created",
      color: "var(--indigo, #5e5ce6)",
      counts: profilesCreated,
    },
    {
      label: "Posts published",
      color: "var(--green, #34c759)",
      counts: postsPublished,
    },
    {
      label: "Tracker entries",
      color: "var(--orange, #ff6b35)",
      counts: trackerEntries,
    },
  ];

  // ----- Filter options -----
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

  const hasActiveFilters =
    selectedMakerIds.length > 0 ||
    selectedCountries.length > 0 ||
    selectedStatuses.length > 0;

  const noProfilesAtAll = !loading && profiles.length === 0;
  const todayDateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="page">
      <div className="page-header dashboard-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Activity overview for the last 7 days · {todayDateLabel}
          </p>
        </div>
      </div>

      {error ? (
        <div className="empty-st">
          <div className="et">Could not load dashboard</div>
          <div className="ed">{error}</div>
        </div>
      ) : null}

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

      <div className="dashboard-section-head">
        <h2>Key metrics</h2>
        <span className="dashboard-section-sub">
          {hasActiveFilters ? "Profile metrics filtered · posts/pages global" : "Snapshots + last 7 days"}
        </span>
      </div>
      <div className="dashboard-summary">
        <SummaryCard
          label="Profiles running"
          value={profilesRunning}
          hint="status Active"
        />
        <SummaryCard
          label="Profiles ready"
          value={profilesReady}
          hint="status Ready"
        />
        <SummaryCard
          label="Profiles created"
          value={totals.profiles}
          hint="last 7 days"
        />
        <SummaryCard
          label="Posts published"
          value={totals.posts}
          hint="last 7 days"
        />
        <SummaryCard
          label="Posts drafted"
          value={totals.drafts}
          hint="last 7 days"
        />
        <SummaryCard
          label="Pages created"
          value={totals.pages}
          hint="last 7 days"
        />
      </div>

      <div className="dashboard-section-head">
        <h2>Attention</h2>
        <span className="dashboard-section-sub">
          Items needing follow-up this week
        </span>
      </div>
      <div className="dashboard-attention-row">
        <AttentionCard
          tone="danger"
          value={attentionCounts.flagged}
          label="Flagged"
          sub="under review"
          to="/profiles"
        />
        <AttentionCard
          tone="danger"
          value={attentionCounts.bannedToday}
          label="Banned today"
          sub="status changed to Banned today"
          to="/profiles"
        />
        <AttentionCard
          tone="danger"
          value={attentionCounts.banned}
          label="Banned (total)"
          sub="removed from rotation"
          to="/profiles"
        />
        <AttentionCard
          tone="warn"
          value={attentionCounts.needsSetup}
          label="Needs setup"
          sub="Need Setup / Pending Profile"
          to="/profiles"
        />
        <AttentionCard
          tone="warn"
          value={attentionCounts.needChecking}
          label="Need checking"
          sub="status Need Checking"
          to="/profiles"
        />
        <AttentionCard
          tone="info"
          value={attentionCounts.pendingAssignments}
          label="Pending assignments"
          sub="awaiting maker submit"
          to="/profiles"
        />
      </div>

      <div className="dashboard-section-head">
        <h2>Profile status breakdown</h2>
        <span className="dashboard-section-sub">
          {filteredProfiles.length} profiles in view
        </span>
      </div>
      <div className="dashboard-card">
        {loading ? (
          <div className="dashboard-chart-empty">Loading…</div>
        ) : noProfilesAtAll ? (
          <div className="dashboard-chart-empty">
            No profiles yet. Run the simulation seed or create a profile.
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="dashboard-chart-empty">
            No profiles match the current filters.
          </div>
        ) : (
          <StatusDonut slices={statusBreakdown} />
        )}
      </div>

      <div className="dashboard-section-head">
        <h2>Profile location map</h2>
        <span className="dashboard-section-sub">
          Current city from profiles in view
        </span>
      </div>
      <div className="dashboard-card">
        {loading ? (
          <div className="dashboard-chart-empty">Loading map...</div>
        ) : filteredProfiles.length === 0 ? (
          <div className="dashboard-chart-empty">No profiles in view.</div>
        ) : (
          <ProfileLocationMap
            points={profileLocationMap.points}
            missing={profileLocationMap.missing}
          />
        )}
      </div>

      <div className="dashboard-split">
        <aside className="dashboard-split-aside">
          <div className="dashboard-section-head">
            <h2>
              {submittedIsToday
                ? "Submitted today"
                : `Submitted · ${submittedDay?.label || submittedSelectedKey}`}
            </h2>
            <span className="dashboard-section-sub">
              <strong>{totals.submittedToday}</strong> total
              {submittedIsToday ? null : (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="dashboard-link-btn"
                    onClick={() => setSubmittedSelectedKey(todayKey)}
                  >
                    back to today
                  </button>
                </>
              )}
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
                    <button
                      type="button"
                      className="dashboard-submitted-info"
                      onClick={() => setInfoModalMaker(maker)}
                      aria-label={`Show profiles created by ${maker.username}`}
                      title={`Profiles created by ${maker.username}`}
                    >
                      ⓘ
                    </button>
                  </div>
                  <div className="dashboard-submitted-value">{count}</div>
                  <div className="dashboard-submitted-foot">
                    {submittedIsToday
                      ? "submitted today"
                      : `submitted ${submittedDay?.label || ""}`.trim()}
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
            <span className="dashboard-section-sub">
              Click a day to update the Submitted cards
            </span>
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
                selectedKey={submittedSelectedKey}
                onSelectDay={setSubmittedSelectedKey}
              />
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-section-head">
        <h2>Set Page · last 7 days</h2>
        <span className="dashboard-section-sub">
          <strong>{pageSetTotals.passed + pageSetTotals.failed}</strong> stamped
          {" · "}
          <span className="dashboard-pageset-stat-pass">
            {pageSetTotals.passed} passed
          </span>
          {" · "}
          <span className="dashboard-pageset-stat-fail">
            {pageSetTotals.failed} failed
          </span>
          {" · today "}
          {pageSetTotals.today.passed}/{pageSetTotals.today.passed +
            pageSetTotals.today.failed}{" "}
          ok
        </span>
      </div>
      <div className="dashboard-card">
        {loading ? (
          <div className="dashboard-chart-empty">Loading…</div>
        ) : (
          <>
            <PageSetChart
              days={days}
              passed={pageSetPassed}
              failed={pageSetFailed}
              selectedKey={pageSetSelectedKey}
              onSelectDay={setPageSetSelectedKey}
            />
            <div className="dashboard-pageset-day">
              {pageSetSelectedKey ? (
                <>
                  <div className="dashboard-pageset-day-head">
                    <strong>{pageSetSelectedLabel || pageSetSelectedKey}</strong>
                    <span>
                      {pageSetDayProfiles.passed.length +
                        pageSetDayProfiles.failed.length}{" "}
                      stamped · {pageSetDayProfiles.passed.length} passed ·{" "}
                      {pageSetDayProfiles.failed.length} failed
                    </span>
                  </div>
                  {pageSetDayProfiles.passed.length +
                  pageSetDayProfiles.failed.length ? (
                    <ul className="dashboard-pageset-day-list">
                      {[
                        ...pageSetDayProfiles.failed.map((p) => ({
                          p,
                          ok: false,
                        })),
                        ...pageSetDayProfiles.passed.map((p) => ({
                          p,
                          ok: true,
                        })),
                      ].map(({ p, ok }) => (
                        <li key={p._id}>
                          <Link to={`/profile/${p._id}`}>
                            {`${p.firstName || ""} ${p.lastName || ""}`.trim() ||
                              "(unnamed)"}
                          </Link>
                          <span
                            className={`dashboard-pageset-pill ${
                              ok
                                ? "dashboard-pageset-stat-pass"
                                : "dashboard-pageset-stat-fail"
                            }`}
                          >
                            {ok ? "passed" : "failed"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="dashboard-chart-empty">
                      No Set Page steps stamped on this day.
                    </div>
                  )}
                </>
              ) : (
                <div className="dashboard-pageset-day-hint">
                  Select a day above to see which profiles were set.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="dashboard-section-head">
        <h2>Weekly trend</h2>
        <span className="dashboard-section-sub">
          Profiles · Posts published · Tracker entries
        </span>
      </div>
      <div className="dashboard-card">
        {loading ? (
          <div className="dashboard-chart-empty">Loading trend…</div>
        ) : (
          <TrendLineChart days={days} series={trendSeries} />
        )}
      </div>

      <div className="dashboard-section-head">
        <h2>Profile pipeline</h2>
        <span className="dashboard-section-sub">
          From Available to Delivered, plus fallout
        </span>
      </div>
      <div className="dashboard-card">
        {loading ? (
          <div className="dashboard-chart-empty">Loading…</div>
        ) : filteredProfiles.length === 0 ? (
          <div className="dashboard-chart-empty">No profiles in view.</div>
        ) : (
          <PipelineFunnel stages={pipelineStages} fallout={pipelineFallout} />
        )}
      </div>

      {infoModalMaker ? (
        <MakerProfilesModal
          maker={infoModalMaker}
          profiles={profiles}
          dayKey={submittedSelectedKey}
          dayLabel={submittedDay?.label || ""}
          isToday={submittedIsToday}
          onClose={() => setInfoModalMaker(null)}
        />
      ) : null}
    </div>
  );
}

function MakerProfilesModal({ maker, profiles, dayKey, dayLabel, isToday, onClose }) {
  const profileById = new Map(
    profiles.map((p) => [String(p._id || p.id || ""), p]),
  );
  const submittedToday = (maker.profiles || [])
    .filter(
      (a) =>
        a.assignmentStatus === "completed" &&
        a.submittedAt &&
        toLocalDateKey(a.submittedAt) === dayKey,
    )
    .map((a) => ({
      assignment: a,
      profile: profileById.get(String(a.profileId || "")),
    }))
    .filter((entry) => entry.profile)
    .sort((a, b) => {
      const aTime = a.assignment.submittedAt
        ? new Date(a.assignment.submittedAt).getTime()
        : 0;
      const bTime = b.assignment.submittedAt
        ? new Date(b.assignment.submittedAt).getTime()
        : 0;
      return bTime - aTime;
    });

  return (
    <div className="npm-backdrop" onClick={onClose}>
      <div
        className="npm-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(720px, 100%)", maxHeight: "min(82vh, 720px)" }}
      >
        <div className="npm-header">
          <div>
            <div className="npm-kicker">Maker</div>
            <h2 className="npm-title">
              {maker.username} · {submittedToday.length} submitted{" "}
              {isToday ? "today" : dayLabel}
            </h2>
          </div>
          <button className="npm-close" type="button" onClick={onClose}>
            x
          </button>
        </div>
        <div className="npm-body">
          {submittedToday.length === 0 ? (
            <div className="dashboard-chart-empty">
              This maker hasn&apos;t submitted any profiles{" "}
              {isToday ? "today" : `on ${dayLabel}`}.
            </div>
          ) : (
            <ul className="dashboard-maker-profile-list">
              {submittedToday.map(({ assignment, profile }) => {
                const fullName =
                  [profile.firstName, profile.lastName]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || `Profile #${profile._id}`;
                const status = String(profile.status || "Available");
                const country = (profile.country || "US").toUpperCase();
                return (
                  <li
                    key={String(assignment.profileId)}
                    className="dashboard-maker-profile-row"
                  >
                    <span className="dashboard-maker-profile-flag">
                      {country === "IT" ? "🇮🇹" : "🇺🇸"}
                    </span>
                    <Link
                      to={`/profile/${profile._id}`}
                      className="dashboard-maker-profile-name"
                      onClick={onClose}
                    >
                      {fullName}
                    </Link>
                    <span
                      className={`sbadge ${STATUS_CLASS[status] || "sp"}`}
                    >
                      <span className="sdot2" />
                      {status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
