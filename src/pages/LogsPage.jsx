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
    populated.find(
      (img) => String(img.type || "").trim().toLowerCase() === "profile",
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

function statusDotColor(browser) {
  if (!browser.online) return "var(--text3)";
  const hasRecentError = browser.logs.some((l) => l.level === "error");
  if (hasRecentError) return "#ef4444";
  return "#22c55e";
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
  const inFlight = browsers.filter((b) => b.online).length;
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

function BrowserColumn({ browser, profile, levelFilter, search }) {
  const scrollRef = useRef(null);
  const [paused, setPaused] = useState(false);

  const filtered = useMemo(() => {
    return browser.logs.filter((log) => {
      if (levelFilter !== "all" && log.level !== levelFilter) return false;
      if (search && !log.msg.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [browser.logs, levelFilter, search]);

  useEffect(() => {
    if (paused) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered, paused]);

  const errorCount = browser.logs.filter((l) => l.level === "error").length;
  const fullName = profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
    : "";
  const displayName = fullName || browser.profileName || browser.browserId;
  const avatarUrl = resolveAssetUrl(pickProfilePhoto(profile));
  const fbUrl = profile?.profileUrl || "";
  const dotColor = statusDotColor(browser);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        minWidth: 300,
        flex: "1 1 0",
        maxHeight: 380,
      }}
    >
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
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
              initialsSeed={browser.profileId || browser.browserId}
              style={{ width: "100%", height: "100%", objectFit: "cover", fontSize: 14 }}
            />
            <span
              title={browser.online ? "online" : "offline"}
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
              title={displayName}
              style={{
                fontWeight: 700,
                fontSize: 14,
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
                color: "var(--text3)",
                fontSize: 11,
                fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
                marginTop: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={browser.currentStepPath || ""}
            >
              <span style={{ color: "var(--text3)" }}>step: </span>
              <span style={{ color: "var(--text2)" }}>{browser.currentStepPath || "—"}</span>
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
              {browser.profileId ? (
                <a
                  href={`/profile/${browser.profileId}`}
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

          <button
            type="button"
            className="btn-s"
            style={{ padding: "2px 8px", fontSize: 11, flexShrink: 0 }}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "resume" : "pause"}
          </button>
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
            {browser.logs.length} events
            {errorCount > 0 ? ` · ${errorCount} error${errorCount > 1 ? "s" : ""}` : ""}
            {browser.profileId ? (
              <span style={{ color: "var(--text3)", marginLeft: 6 }}>
                {shortId(browser.profileId)}
              </span>
            ) : null}
          </span>
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
        </div>
      </div>
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
          {paused ? "⏸ paused" : "▼ live tailing…"}
        </div>
      </div>
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

  const browsers = useMemo(
    () =>
      Object.values(browsersMap).sort((a, b) => {
        // Online (still pushing) first, offline (done) last.
        if (Boolean(a.online) !== Boolean(b.online)) {
          return a.online ? -1 : 1;
        }
        // Stable secondary sort so cards don't jump around mid-tail.
        return a.browserId.localeCompare(b.browserId);
      }),
    [browsersMap],
  );

  useEffect(() => {
    const ids = new Set();
    for (const b of browsers) {
      if (b.profileId) ids.add(b.profileId);
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
  }, [browsers]);

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

      <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        {browsers.length === 0 ? (
          <div style={{ color: "var(--text3)", fontStyle: "italic", padding: 12 }}>
            No active browsers yet.
          </div>
        ) : (
          browsers.map((browser) => (
            <BrowserColumn
              key={browser.browserId}
              browser={browser}
              profile={profileCache[browser.profileId]}
              levelFilter={levelFilter}
              search={search}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default LogsPage;
