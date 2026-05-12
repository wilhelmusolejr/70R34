import { useEffect, useMemo, useRef, useState } from "react";
import "../App.css";

// ────────────────────────────────────────────────────────────────────────────
// Hardcoded mock — mirrors what the bot will send over SSE.
// Shape:
//   task        → { taskId, concurrency, profiles[], steps[], startedAt }
//   browsers[]  → { browserId, profileId, online, currentStepPath, logs[] }
//   processed[] → profileIds that finished
// ────────────────────────────────────────────────────────────────────────────

const MOCK_TASK = {
  taskId: "homepage-then-connect-loop",
  concurrency: 3,
  blockMedia: true,
  startedAt: Date.now() - 4 * 60 * 1000 - 23 * 1000,
  profiles: [
    "69e22287bb8fecced7bfda54", "69e22e3dbb8fecced7bfdaa0",
    "69f3585493738d563ce21827", "69f3585493738d563ce21828",
    "69f3585493738d563ce21829", "69f3585493738d563ce2182e",
    "69f36dd093738d563ce21912", "69f3f38993738d563ce21cef",
    "69f3f38993738d563ce21cf0", "69f3f38993738d563ce21cf2",
    "69f488af93738d563ce21fee", "69f488af93738d563ce21fef",
    "69f488af93738d563ce21ff1", "69f4b475e4db22596b581e27",
    "69f5c624497c702fe2920960", "69f5c624497c702fe2920961",
    "69f5c624497c702fe2920962", "69f5c624497c702fe2920963",
    "69f5df5d497c702fe29209df", "69f831de497c702fe2921a1d",
    "69f831de497c702fe2921a1f", "69f857a6497c702fe2921bf1",
    "69f85883497c702fe2921bfa", "69f85a71497c702fe2921c03",
    "69f85b36497c702fe2921c14", "69f85c44497c702fe2921c27",
    "69f85de8497c702fe2921c39", "69f85e43497c702fe2921c42",
    "69f85fbb497c702fe2921c58", "69f86029497c702fe2921c61",
    "69f8611a497c702fe2921c6a", "69f86260497c702fe2921c7c",
    "69f862da497c702fe2921c85", "69f86340497c702fe2921c8e",
    "69f86400497c702fe2921c9a", "69f86481497c702fe2921cad",
    "69f86569497c702fe2921cc4", "69f86782497c702fe2921ccd",
    "69fab5d4d7f59db2c21aeb16", "69fab5d4d7f59db2c21aeb18",
    "69fae777d7f59db2c21aece7", "69fae84ad7f59db2c21aed24",
    "69fae84ad7f59db2c21aed25", "69faf30ad7f59db2c21aee3e",
    "69fb09bad7f59db2c21aeed2", "69fb09bad7f59db2c21aeed3",
    "69fb09bad7f59db2c21aeed4",
  ],
  steps: [
    { type: "homepage_interaction" },
    { type: "accept_loop" },
    { type: "wait" },
    { type: "connect_loop" },
    { type: "wait" },
    { type: "visit_profile" },
    { type: "wait" },
  ],
};

// 12 of 47 profiles already processed
const PROCESSED_PROFILE_IDS = MOCK_TASK.profiles.slice(0, 12);

const MOCK_BROWSERS = [
  {
    browserId: "hidemium-1",
    profileId: "69f488af93738d563ce21fee",
    profileName: "Jane Doe",
    online: true,
    currentStepPath: "homepage_interaction › like_posts",
    logs: [
      { ts: "14:02:11", level: "info",  msg: "browser:online" },
      { ts: "14:02:11", level: "info",  msg: "Login successful" },
      { ts: "14:02:14", level: "warn",  msg: "Captcha appeared, solving…" },
      { ts: "14:02:18", level: "info",  msg: "Captcha solved" },
      { ts: "14:02:21", level: "info",  msg: "step:homepage_interaction start" },
      { ts: "14:02:24", level: "info",  msg: "scroll 38px (target 30–50)" },
      { ts: "14:02:29", level: "info",  msg: "like_posts → liked 1 of 2" },
      { ts: "14:02:33", level: "info",  msg: "like_posts → liked 2 of 2" },
    ],
  },
  {
    browserId: "hidemium-2",
    profileId: "69f5c624497c702fe2920960",
    profileName: "Mike Smith",
    online: true,
    currentStepPath: "connect_loop (3 / 7)",
    logs: [
      { ts: "14:02:09", level: "info",  msg: "browser:online" },
      { ts: "14:02:09", level: "info",  msg: "step:accept_loop start" },
      { ts: "14:02:13", level: "info",  msg: "accept_loop → 0 pending requests" },
      { ts: "14:02:17", level: "info",  msg: "step:wait 12s" },
      { ts: "14:02:29", level: "info",  msg: "step:connect_loop start (pool=users, count=7)" },
      { ts: "14:02:33", level: "info",  msg: "connect → Anna Lee (1/7)" },
      { ts: "14:02:37", level: "info",  msg: "connect → Tom Reyes (2/7)" },
      { ts: "14:02:41", level: "info",  msg: "connect → Lia Park (3/7)" },
    ],
  },
  {
    browserId: "hidemium-3",
    profileId: "69fae84ad7f59db2c21aed24",
    profileName: "Anna Lee",
    online: true,
    currentStepPath: "visit_profile › share_posts",
    logs: [
      { ts: "14:02:05", level: "info",  msg: "browser:online" },
      { ts: "14:02:05", level: "info",  msg: "Open profile page" },
      { ts: "14:02:08", level: "error", msg: "Proxy timeout (3 retries)" },
      { ts: "14:02:11", level: "info",  msg: "Reconnecting via fallback" },
      { ts: "14:02:14", level: "info",  msg: "Login successful" },
      { ts: "14:02:18", level: "info",  msg: "step:visit_profile start (pool=sharers)" },
      { ts: "14:02:24", level: "info",  msg: "scroll 34px (target 30–40)" },
      { ts: "14:02:31", level: "info",  msg: "share_posts → shared 1 of 1" },
    ],
  },
];

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
            {inFlight} in flight · {total - done - inFlight} queued
          </div>
        </div>
      </div>

      {/* Progress bar */}
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

      {/* Steps timeline */}
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
          {browser.profileName}{" "}
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

export function LogsPage() {
  const [levelFilter, setLevelFilter] = useState("all");
  const [search, setSearch] = useState("");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Logs</h1>
          <p>Live stream from the L0r3a bot. Mock data — bot will push real events over SSE.</p>
        </div>
        <div className="hdr-acts" style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn-s">pause all</button>
          <button type="button" className="btn-s">clear</button>
        </div>
      </div>

      <TaskPanel
        task={MOCK_TASK}
        processedIds={PROCESSED_PROFILE_IDS}
        browsers={MOCK_BROWSERS}
      />

      {/* Filter bar */}
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
        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text2)", fontSize: 12 }}>
          <input type="checkbox" defaultChecked /> auto-scroll
        </label>
      </div>

      {/* Browser columns */}
      <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        {MOCK_BROWSERS.map((browser) => (
          <BrowserColumn
            key={browser.browserId}
            browser={browser}
            levelFilter={levelFilter}
            search={search}
          />
        ))}
      </div>
    </div>
  );
}

export default LogsPage;
