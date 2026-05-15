import { Router } from "express";

const router = Router();

// In-memory state. The bot pushes events; the latest snapshot is held here
// so newly-connected SSE clients can hydrate immediately.
const state = {
  task: null,
  processed: [],
  browsers: new Map(),
};

const subscribers = new Set();

function snapshot() {
  return {
    task: state.task,
    processed: [...state.processed],
    browsers: Array.from(state.browsers.values()),
  };
}

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of subscribers) {
    try {
      res.write(payload);
    } catch {
      // ignore broken pipes; the close handler cleans up
    }
  }
}

function nowTs() {
  return new Date().toTimeString().slice(0, 8);
}

function coerceLogs(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const level = ["info", "warn", "error"].includes(entry.level)
        ? entry.level
        : "info";
      const msg = String(entry.msg ?? "").trim();
      if (!msg) return null;
      const ts = entry.ts ? String(entry.ts) : nowTs();
      return { ts, level, msg };
    })
    .filter(Boolean);
}

router.get("/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ type: "snapshot", ...snapshot() })}\n\n`);

  subscribers.add(res);

  // Heartbeat so proxies don't kill idle connections.
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      // ignore
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    subscribers.delete(res);
  });
});

router.post("/task", (req, res) => {
  const body = req.body || {};
  const task = {
    taskId: String(body.taskId || "unnamed-task"),
    concurrency: Number.isFinite(body.concurrency) ? body.concurrency : 1,
    blockMedia: Boolean(body.blockMedia),
    startedAt: Number.isFinite(body.startedAt) ? body.startedAt : Date.now(),
    profiles: Array.isArray(body.profiles) ? body.profiles.map(String) : [],
    steps: Array.isArray(body.steps)
      ? body.steps.map((step) => ({ type: String(step?.type || "step") }))
      : [],
  };

  state.task = task;
  state.processed = [];
  state.browsers.clear();

  broadcast({ type: "task", task });
  res.json({ ok: true });
});

router.post("/browser", (req, res) => {
  const body = req.body || {};
  const browserId = String(body.browserId || "").trim();
  if (!browserId) {
    return res.status(400).json({ message: "browserId is required" });
  }

  const incomingLogs = coerceLogs(body.logs);
  const existing = state.browsers.get(browserId) || {
    browserId,
    profileId: null,
    profileName: "",
    online: true,
    currentStepPath: "",
    logs: [],
  };

  const next = {
    ...existing,
    profileId:
      body.profileId !== undefined ? String(body.profileId || "") : existing.profileId,
    profileName:
      body.profileName !== undefined
        ? String(body.profileName || "")
        : existing.profileName,
    online:
      body.online !== undefined ? Boolean(body.online) : existing.online,
    currentStepPath:
      body.currentStepPath !== undefined
        ? String(body.currentStepPath || "")
        : existing.currentStepPath,
    logs: existing.logs.concat(incomingLogs).slice(-500),
  };

  state.browsers.set(browserId, next);
  broadcast({ type: "browser", browser: next });
  res.json({ ok: true });
});

router.post("/processed", (req, res) => {
  const profileId = String(req.body?.profileId || "").trim();
  if (!profileId) {
    return res.status(400).json({ message: "profileId is required" });
  }
  if (!state.processed.includes(profileId)) {
    state.processed.push(profileId);
  }
  broadcast({ type: "processed", profileId });
  res.json({ ok: true });
});

router.post("/reset", (_req, res) => {
  state.task = null;
  state.processed = [];
  state.browsers.clear();
  broadcast({ type: "reset" });
  res.json({ ok: true });
});

export default router;
