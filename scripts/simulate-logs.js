// Simulate a bot run against the Logs API using task.json.
//
// Reads ../task.json, posts the task descriptor to /api/logs/task, then runs a
// worker pool with `task.concurrency` workers. Each worker pulls the next
// profile from the queue and walks the step tree, pushing realistic info /
// warn logs to /api/logs/browser using `browserId = profileId` so the UI can
// render exactly one card per profile.
//
// Usage:
//   node scripts/simulate-logs.js
//   node scripts/simulate-logs.js https://7or34.space
//   SIMULATE_SPEED=0.1 node scripts/simulate-logs.js   # 10x faster waits
//
// Env:
//   LOGS_BASE_URL / VITE_API_URL — backend base URL (default http://localhost:4000)
//   SIMULATE_SPEED               — multiplier on wait durations (default 0.2)

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createLogsClient } from "./logs-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPEED = Number(process.env.SIMULATE_SPEED ?? "0.2") || 0.2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

function shortId(id) {
  return id ? `…${String(id).slice(-6)}` : "";
}

function waitMsFor(params) {
  if (!params) return 1000;
  if (Number.isFinite(params.duration)) return params.duration * 1000;
  if (Number.isFinite(params.min) && Number.isFinite(params.max)) {
    return randInt(params.min, params.max) * 1000;
  }
  return 1000;
}

// Pick `count` step indices to inject a transient warn or two — purely for
// demo flavor so the UI shows yellow/red dots occasionally.
function maybeBlip() {
  const r = Math.random();
  if (r < 0.04) return "error";
  if (r < 0.12) return "warn";
  return null;
}

async function runSteps(browser, steps, pathPrefix) {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const segment = `${i}.${step.type}`;
    const stepPath = pathPrefix ? `${pathPrefix}/${segment}` : segment;
    await browser.step(stepPath);

    switch (step.type) {
      case "wait": {
        const ms = Math.max(200, Math.floor(waitMsFor(step.params) * SPEED));
        await browser.info(`waiting ${(ms / 1000).toFixed(1)}s`);
        await sleep(ms);
        break;
      }

      case "facebook_signup": {
        await browser.info("launching hidemium browser");
        await sleep(600 * SPEED + 200);
        await browser.info("navigating to facebook.com/signup");
        await sleep(800 * SPEED + 200);
        if (Math.random() < 0.15) {
          await browser.warn("captcha challenge — solving");
          await sleep(1500 * SPEED + 400);
          await browser.info("captcha solved");
        }
        await browser.info("filling signup form");
        await sleep(1200 * SPEED + 300);
        await browser.info("submitting form");
        await sleep(900 * SPEED + 200);
        if (Math.random() < 0.08) {
          await browser.error("signup blocked — retrying with fresh identity");
          await sleep(1500 * SPEED + 300);
          await browser.info("retry succeeded");
        }
        await browser.info("signup complete");
        break;
      }

      case "visit_profile": {
        const pool = step.params?.pool || "default";
        await browser.info(`selecting target from pool "${pool}"`);
        await sleep(500 * SPEED + 200);
        await browser.info("opening profile");
        await sleep(700 * SPEED + 200);
        if (Array.isArray(step.steps) && step.steps.length > 0) {
          await runSteps(browser, step.steps, stepPath);
        }
        break;
      }

      case "like_posts": {
        const count = Number.isFinite(step.params?.count) ? step.params.count : 1;
        for (let j = 0; j < count; j++) {
          await sleep(900 * SPEED + 200);
          const blip = maybeBlip();
          if (blip === "warn") {
            await browser.warn(`like ${j + 1}/${count} retried`);
            await sleep(500 * SPEED + 100);
          } else if (blip === "error") {
            await browser.error(`like ${j + 1}/${count} failed`);
            continue;
          }
          await browser.info(`liked post ${j + 1}/${count}`);
        }
        break;
      }

      case "share_posts": {
        const count = Number.isFinite(step.params?.count) ? step.params.count : 1;
        for (let j = 0; j < count; j++) {
          await sleep(1100 * SPEED + 250);
          const blip = maybeBlip();
          if (blip === "warn") {
            await browser.warn(`share ${j + 1}/${count} — composer slow to open`);
            await sleep(600 * SPEED + 100);
          } else if (blip === "error") {
            await browser.error(`share ${j + 1}/${count} failed: network timeout`);
            continue;
          }
          await browser.info(`shared post ${j + 1}/${count}`);
        }
        break;
      }

      default: {
        await browser.info(`running step: ${step.type}`);
        await sleep(800 * SPEED + 200);
      }
    }
  }
}

async function runProfile(logs, profileId, steps) {
  // browserId = profileId so the LogsPage renders exactly one card per profile.
  const browser = logs.browser(profileId, {
    profileId,
    profileName: "",
    online: true,
  });

  await browser.info(`worker picked up ${shortId(profileId)}`);
  try {
    await runSteps(browser, steps, "");
    await browser.info("profile complete");
    await logs.markProcessed(profileId);
  } catch (err) {
    await browser.error(`fatal: ${err?.message || err}`);
  } finally {
    await browser.offline();
  }
}

async function main() {
  const baseUrl = process.argv[2];
  const taskPath = path.join(__dirname, "..", "task.json");
  const raw = await readFile(taskPath, "utf8");
  const task = JSON.parse(raw);

  const logs = createLogsClient(baseUrl ? { baseUrl } : undefined);

  console.log(`[simulate] resetting logs`);
  await logs.reset();

  console.log(
    `[simulate] starting task "${task.taskId}" — ${task.profiles.length} profiles, concurrency ${task.concurrency}, speed ×${SPEED}`,
  );
  await logs.startTask({
    taskId: task.taskId,
    concurrency: task.concurrency,
    blockMedia: task.blockMedia,
    profiles: task.profiles,
    steps: task.steps,
  });

  const queue = [...task.profiles];
  const concurrency = Math.max(1, Number(task.concurrency) || 1);

  let active = 0;
  const workers = Array.from({ length: concurrency }, async (_v, slot) => {
    while (queue.length > 0) {
      const profileId = queue.shift();
      if (!profileId) break;
      active++;
      console.log(
        `[simulate] worker ${slot + 1} → ${shortId(profileId)} (active=${active}, remaining=${queue.length})`,
      );
      try {
        await runProfile(logs, profileId, task.steps);
      } finally {
        active--;
      }
    }
  });

  await Promise.all(workers);
  console.log(`[simulate] done.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
