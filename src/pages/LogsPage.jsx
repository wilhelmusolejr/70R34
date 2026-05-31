import { useEffect, useMemo, useRef, useState } from "react";
import "../App.css";
import { SafeImage } from "../components/SafeImage";
import { fetchProfile } from "../api/profiles";

const linkBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface2)",
  color: "var(--text)",
  fontSize: 11,
  fontWeight: 500,
  textDecoration: "none",
  lineHeight: 1,
};

function initialsFor(name) {
  return String(name || "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

function pickProfilePhoto(profile) {
  if (!profile) return "";
  if (profile.avatarUrl) return profile.avatarUrl;
  const entries = Array.isArray(profile.images) ? profile.images : [];
  const populated = entries
    .map((entry) => (entry && typeof entry.imageId === "object" ? entry.imageId : null))
    .filter(Boolean);
  const preferred =
    populated.find((img) =>
      (img?.tags || []).some((tag) => String(tag).toLowerCase() === "profile"),
    ) || populated[0];
  return preferred?.filename || "";
}

function resolveAssetUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  if (value.startsWith("/") && API_BASE) return `${API_BASE}${value}`;
  return value;
}

const API_BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  "";

function wsUrl() {
  const base = API_BASE || window.location.origin;
  const url = new URL("/api/logs/ws", base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

const LEVEL_FILTERS = [
  { value: "all",   label: "All" },
  { value: "info",  label: "Info" },
  { value: "warn",  label: "Warn" },
  { value: "error", label: "Error" },
];

function levelColor(level) {
  if (level === "error") return "#ef4444";
  if (level === "warn")  return "#eab308";
  return "var(--text2)";
}

function shortId(id) {
  return id ? `…${id.slice(-6)}` : "";
}

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function TaskPanel({ task, processedIds, browsers }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const total = task.profiles.length;
  const done = processedIds.length;
  const processedSet = new Set(processedIds);
  const inFlight = browsers.filter(
    (b) => b.online && b.profileId && !processedSet.has(b.profileId),
  ).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ color: "var(--text3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Active Task
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
            {task.taskId}
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
            concurrency {task.concurrency} · blockMedia {String(task.blockMedia)} · running {formatElapsed(now - task.startedAt)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
            {done} <span style={{ color: "var(--text3)", fontWeight: 500 }}>/ {total}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)" }}>
            {inFlight} in flight · {Math.max(0, total - done - inFlight)} queued
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          height: 8,
          background: "var(--surface2)",
          borderRadius: 4,
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--accent)",
            transition: "width 300ms ease",
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
        {pct}% complete
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Steps
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {task.steps.map((step, idx) => (
            <span
              key={idx}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface2)",
                color: "var(--text2)",
                fontSize: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
              }}
            >
              {idx + 1}. {step.type}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const KIND_BADGE = {
  active: { label: "active", bg: "#22c55e", fg: "#052e13" },
  pending: { label: "pending", bg: "#eab308", fg: "#3a2a05" },
  done: { label: "done", bg: "var(--surface2)", fg: "var(--text2)" },
};

function StatusBadge({ kind }) {
  const cfg = KIND_BADGE[kind] || KIND_BADGE.pending;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "2px 6px",
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.fg,
        border: kind === "done" ? "1px solid var(--border)" : "none",
      }}
    >
      {cfg.label}
    </span>
  );
}

function PendingCard({ profileId, profile }) {
  const fullName = profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
    : "";
  const displayName = fullName || shortId(profileId);
  const avatarUrl = resolveAssetUrl(pickProfilePhoto(profile));
  const fbUrl = profile?.profileUrl || "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background:
          "repeating-linear-gradient(45deg, var(--surface) 0 10px, var(--surface2) 10px 20px)",
        border: "1.5px dashed var(--border)",
        borderRadius: 10,
        padding: "14px",
        alignSelf: "start",
        position: "relative",
        minHeight: 130,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            overflow: "hidden",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            filter: "grayscale(80%)",
            flexShrink: 0,
          }}
        >
          <SafeImage
            src={avatarUrl}
            alt={displayName}
            initials={initialsFor(displayName)}
            initialsSeed={profileId}
            style={{ width: "100%", height: "100%", objectFit: "cover", fontSize: 14 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            title={displayName}
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text3)",
              fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
              marginTop: 2,
            }}
          >
            {shortId(profileId)}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {fbUrl ? (
              <a
                href={fbUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={linkBtnStyle}
                title={fbUrl}
              >
                Facebook ↗
              </a>
            ) : null}
            {profileId ? (
              <a
                href={`/profile/${profileId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={linkBtnStyle}
                title="Open profile page"
              >
                Profile ↗
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 8,
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          color: "var(--text3)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Queued — waiting for slot
        </span>
      </div>
    </div>
  );
}

function BrowserColumn({ kind, profileId, browser, profile, levelFilter, search }) {
  const scrollRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [showDoneLogs, setShowDoneLogs] = useState(false);

  const logs = useMemo(() => browser?.logs || [], [browser]);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== "all" && log.level !== levelFilter) return false;
      if (search && !log.msg.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, levelFilter, search]);

  useEffect(() => {
    if (paused) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered, paused]);

  const errorCount = logs.filter((l) => l.level === "error").length;
  const fullName = profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
    : "";
  const displayName =
    fullName || browser?.profileName || (profileId ? shortId(profileId) : browser?.browserId);
  const avatarUrl = resolveAssetUrl(pickProfilePhoto(profile));
  const fbUrl = profile?.profileUrl || "";
  const dotColor = kind === "active" ? "#22c55e" : "var(--text3)";
  const logsVisible = kind === "active" || (kind === "done" && showDoneLogs);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        maxHeight: logsVisible ? 380 : 140,
        opacity: kind === "done" && !showDoneLogs ? 0.78 : 1,
        alignSelf: "start",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: logsVisible ? "1px solid var(--border)" : "none",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div
            style={{
              position: "relative",
              width: 42,
              height: 42,
              flexShrink: 0,
              borderRadius: "50%",
              overflow: "hidden",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
            }}
          >
            <SafeImage
              src={avatarUrl}
              alt={displayName}
              initials={initialsFor(displayName)}
              initialsSeed={profileId || browser?.browserId}
              style={{ width: "100%", height: "100%", objectFit: "cover", fontSize: 14 }}
            />
            <span
              title={kind === "active" ? "online" : kind}
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: dotColor,
                border: "2px solid var(--surface)",
                boxShadow: `0 0 4px ${dotColor}`,
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                minWidth: 0,
              }}
            >
              <div
                title={displayName}
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {displayName}
              </div>
              <StatusBadge kind={kind} />
            </div>
            <div
              style={{
                color: "var(--text3)",
                fontSize: 11,
                fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
                marginTop: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={browser?.currentStepPath || ""}
            >
              <span style={{ color: "var(--text3)" }}>step: </span>
              <span style={{ color: "var(--text2)" }}>
                {kind === "pending"
                  ? "queued — not yet started"
                  : browser?.currentStepPath || (kind === "done" ? "completed" : "—")}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {fbUrl ? (
                <a
                  href={fbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkBtnStyle}
                  title={fbUrl}
                >
                  Facebook ↗
                </a>
              ) : null}
              {profileId ? (
                <a
                  href={`/profile/${profileId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkBtnStyle}
                  title="Open profile page"
                >
                  Profile ↗
                </a>
              ) : null}
            </div>
          </div>

          {kind === "active" ? (
            <button
              type="button"
              className="btn-s"
              style={{ padding: "2px 8px", fontSize: 11, flexShrink: 0 }}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? "resume" : "pause"}
            </button>
          ) : kind === "done" ? (
            <button
              type="button"
              className="btn-s"
              style={{ padding: "2px 8px", fontSize: 11, flexShrink: 0 }}
              onClick={() => setShowDoneLogs((v) => !v)}
              title={showDoneLogs ? "hide log history" : "show log history"}
            >
              {showDoneLogs ? "hide logs" : "show logs"}
            </button>
          ) : null}
        </div>

        <div
          style={{
            color: "var(--text3)",
            fontSize: 11,
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            {logs.length} events
            {errorCount > 0 ? ` · ${errorCount} error${errorCount > 1 ? "s" : ""}` : ""}
            {profileId ? (
              <span style={{ color: "var(--text3)", marginLeft: 6 }}>
                {shortId(profileId)}
              </span>
            ) : null}
          </span>
          {browser?.browserId && browser.browserId !== profileId ? (
            <span
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "1px 6px",
                color: "var(--text2)",
              }}
              title="browser id"
            >
              {browser.browserId}
            </span>
          ) : null}
        </div>
      </div>
      {logsVisible ? (
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 12px",
            fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
            fontSize: 12,
            lineHeight: 1.5,
            minHeight: 180,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ color: "var(--text3)", fontStyle: "italic" }}>No matching logs.</div>
          ) : (
            filtered.map((log, idx) => (
              <div key={idx} style={{ marginBottom: 6 }}>
                <span style={{ color: "var(--text3)" }}>{log.ts}</span>{" "}
                <span style={{ color: levelColor(log.level), fontWeight: 600, textTransform: "uppercase" }}>
                  {log.level}
                </span>{" "}
                <span style={{ color: "var(--text)" }}>{log.msg}</span>
              </div>
            ))
          )}
          <div style={{ marginTop: 8, color: "var(--text3)", fontStyle: "italic", fontSize: 11 }}>
            {kind === "done"
              ? "✓ run complete — final log history"
              : paused
                ? "⏸ paused"
                : "▼ live tailing…"}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ connected }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px dashed var(--border)",
        borderRadius: 12,
        padding: "40px 20px",
        textAlign: "center",
        color: "var(--text2)",
      }}
    >
      <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>
        {connected ? "Waiting for bot…" : "Connecting to log stream…"}
      </div>
      <div style={{ fontSize: 12 }}>
        Run the bot (POST <code>/api/logs/task</code>, then <code>/api/logs/browser</code>) to see live events here.
      </div>
    </div>
  );
}

export function LogsPage() {
  const [levelFilter, setLevelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [task, setTask] = useState(null);
  const [processedIds, setProcessedIds] = useState([]);
  const [browsersMap, setBrowsersMap] = useState({});
  const [connected, setConnected] = useState(false);
  const [profileCache, setProfileCache] = useState({});
  const fetchedProfileIdsRef = useRef(new Set());

  useEffect(() => {
    let socket = null;
    let reconnectTimer = null;
    let stopped = false;

    function handle(data) {
      if (data.type === "snapshot") {
        setTask(data.task);
        setProcessedIds(data.processed || []);
        const map = {};
        for (const b of data.browsers || []) map[b.browserId] = b;
        setBrowsersMap(map);
        return;
      }
      if (data.type === "task") {
        setTask(data.task);
        setProcessedIds([]);
        setBrowsersMap({});
        return;
      }
      if (data.type === "browser") {
        setBrowsersMap((prev) => ({ ...prev, [data.browser.browserId]: data.browser }));
        return;
      }
      if (data.type === "processed") {
        setProcessedIds((prev) =>
          prev.includes(data.profileId) ? prev : [...prev, data.profileId],
        );
        return;
      }
      if (data.type === "reset") {
        setTask(null);
        setProcessedIds([]);
        setBrowsersMap({});
      }
    }

    function connect() {
      if (stopped) return;
      socket = new WebSocket(wsUrl());

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (stopped) return;
        reconnectTimer = setTimeout(connect, 2000);
      };
      socket.onerror = () => {
        try {
          socket?.close();
        } catch {
          // ignore
        }
      };
      socket.onmessage = (ev) => {
        let data;
        try {
          data = JSON.parse(ev.data);
        } catch {
          return;
        }
        handle(data);
      };
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        socket?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  const browsers = useMemo(() => Object.values(browsersMap), [browsersMap]);

  const browsersByProfileId = useMemo(() => {
    const map = new Map();
    for (const b of browsers) {
      if (b.profileId) map.set(b.profileId, b);
    }
    return map;
  }, [browsers]);

  // One slot per profile in task.profiles. Each slot is active (currently
  // working, online), pending (not yet started), or done (processed). Active
  // takes priority — those are the live concurrency.
  const slots = useMemo(() => {
    const processedSet = new Set(processedIds);
    const profileIds = task?.profiles?.length
      ? task.profiles
      : // Fallback for ad-hoc bot runs without a task descriptor: derive from browsers.
        browsers.map((b) => b.profileId || b.browserId);

    const list = profileIds.map((profileId, index) => {
      const browser = browsersByProfileId.get(profileId) || null;
      let kind;
      if (processedSet.has(profileId)) kind = "done";
      else if (browser && browser.online) kind = "active";
      else if (browser) kind = "done"; // pushed events then went offline but not marked processed
      else kind = "pending";
      return { profileId, browser, kind, index };
    });

    const order = { active: 0, pending: 1, done: 2 };
    list.sort((a, b) => {
      if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
      return a.index - b.index;
    });
    return list;
  }, [task, browsers, browsersByProfileId, processedIds]);

  useEffect(() => {
    const ids = new Set();
    for (const s of slots) {
      if (s.profileId) ids.add(s.profileId);
    }
    for (const id of ids) {
      if (fetchedProfileIdsRef.current.has(id)) continue;
      fetchedProfileIdsRef.current.add(id);
      fetchProfile(id)
        .then((p) => {
          if (p) setProfileCache((prev) => ({ ...prev, [id]: p }));
        })
        .catch(() => {
          fetchedProfileIdsRef.current.delete(id);
        });
    }
  }, [slots]);

  async function handleClear() {
    try {
      await fetch(`${API_BASE}/api/logs/reset`, { method: "POST" });
    } catch {
      // ignore — SSE will update if it works
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Logs</h1>
          <p>
            Live stream from the L0r3a bot.{" "}
            <span style={{ color: connected ? "#22c55e" : "var(--text3)" }}>
              {connected ? "● connected" : "○ disconnected"}
            </span>
          </p>
        </div>
        <div className="hdr-acts" style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn-s" onClick={handleClear}>clear</button>
        </div>
      </div>

      {task ? (
        <TaskPanel task={task} processedIds={processedIds} browsers={browsers} />
      ) : (
        <EmptyState connected={connected} />
      )}

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginBottom: 16,
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ color: "var(--text2)", fontSize: 12 }}>level:</span>
          {LEVEL_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLevelFilter(opt.value)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: levelFilter === opt.value ? "var(--accent)" : "var(--surface2)",
                color: levelFilter === opt.value ? "#fff" : "var(--text)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="search messages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: "6px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--surface2)",
            color: "var(--text)",
            fontSize: 13,
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          alignItems: "start",
        }}
      >
        {slots.length === 0 ? (
          <div style={{ color: "var(--text3)", fontStyle: "italic", padding: 12 }}>
            No profiles in this task yet.
          </div>
        ) : (
          slots.map((slot) =>
            slot.kind === "pending" ? (
              <PendingCard
                key={slot.profileId}
                profileId={slot.profileId}
                profile={profileCache[slot.profileId]}
              />
            ) : (
              <BrowserColumn
                key={slot.profileId}
                kind={slot.kind}
                profileId={slot.profileId}
                browser={slot.browser}
                profile={profileCache[slot.profileId]}
                levelFilter={levelFilter}
                search={search}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

export default LogsPage;
