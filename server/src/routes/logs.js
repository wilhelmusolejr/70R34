import { Router } from "express";
import { WebSocketServer } from "ws";

const router = Router();

// In-memory state. The bot pushes events; the latest snapshot is held here
// so newly-connected WebSocket clients can hydrate immediately.
const state = {
  task: null,
  processed: [],
  browsers: new Map(),
};

const wss = new WebSocketServer({ noServer: true });

function snapshot() {
  return {
    type: "snapshot",
    task: state.task,
    processed: [...state.processed],
    browsers: Array.from(state.browsers.values()),
  };
}

function broadcast(event) {
  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      try {
        client.send(payload);
      } catch {
        // ignore — broken sockets get cleaned up by ws
      }
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

wss.on("connection", (socket) => {
  try {
    socket.send(JSON.stringify(snapshot()));
  } catch {
    // ignore
  }

  // ws ping/pong keepalive
  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
  });
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    try {
      socket.ping();
    } catch {
      // ignore
    }
  }
}, 25000);
heartbeat.unref?.();

export function attachLogsWebSocket(httpServer) {
  httpServer.on("upgrade", (request, socket, head) => {
    const { url } = request;
    if (!url) return;
    const pathname = url.split("?")[0];
    if (pathname !== "/api/logs/ws") return;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });
}

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
