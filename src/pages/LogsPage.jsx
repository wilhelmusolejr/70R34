import { useEffect, useMemo, useRef, useState } from "react";
import "../App.css";

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

function BrowserColumn({ browser, levelFilter, search }) {
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        minWidth: 280,
        flex: "1 1 0",
        maxHeight: "calc(100vh - 360px)",
      }}
    >
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: statusDotColor(browser),
              boxShadow: `0 0 6px ${statusDotColor(browser)}`,
            }}
          />
          {browser.browserId}
        </div>
        <div style={{ color: "var(--text2)", fontSize: 12, marginTop: 2 }}>
          {browser.profileName || "—"}{" "}
          <span style={{ color: "var(--text3)", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace" }}>
            ({shortId(browser.profileId)})
          </span>
        </div>
        <div
          style={{
            marginTop: 8,
            padding: "6px 8px",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 11,
            color: "var(--text)",
            fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
          }}
        >
          <span style={{ color: "var(--text3)" }}>step: </span>
          {browser.currentStepPath || "—"}
        </div>
        <div
          style={{
            color: "var(--text3)",
            fontSize: 11,
            marginTop: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            {browser.logs.length} events
            {errorCount > 0 ? ` · ${errorCount} error${errorCount > 1 ? "s" : ""}` : ""}
          </span>
          <button
            type="button"
            className="btn-s"
            style={{ padding: "2px 8px", fontSize: 11 }}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "resume" : "pause"}
          </button>
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
    () => Object.values(browsersMap).sort((a, b) => a.browserId.localeCompare(b.browserId)),
    [browsersMap],
  );

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
