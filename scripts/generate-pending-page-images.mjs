/* global process */
/**
 * Kick off brand-image generation for every Pending page on the platform.
 *
 * "Pending" = page has zero assets (matches the client-side derivation in
 * src/pages/PagesPage.jsx). We POST /api/pages/:id/generate-images (returns
 * 202 instantly) and then poll /api/pages/:id/generate-images/status until
 * each job is done. Concurrency is throttled to keep OpenAI rate-limits
 * happy — gpt-image-1 runs two parallel image calls per page internally,
 * so even CONCURRENCY=3 means up to 6 simultaneous OpenAI requests.
 *
 * Defaults: CONCURRENCY=1, MIN_INTERVAL_MS=60000 (one page per minute) to
 * stay under OpenAI's 5-images-per-minute rate limit on gpt-image-1 tier 1.
 *
 * Usage:
 *   node scripts/generate-pending-page-images.mjs
 *   API_BASE=http://localhost:4000 node scripts/generate-pending-page-images.mjs
 *   MIN_INTERVAL_MS=30000 node scripts/generate-pending-page-images.mjs   # faster pace
 *   CONCURRENCY=2 node scripts/generate-pending-page-images.mjs           # parallel
 *   COUNTRY=IT node scripts/generate-pending-page-images.mjs              # only IT
 *   LIMIT=5 node scripts/generate-pending-page-images.mjs                 # first 5 only
 *   DRY_RUN=1 node scripts/generate-pending-page-images.mjs               # list, don't run
 */

const API_BASE = (process.env.API_BASE || "https://7or34.space").replace(
  /\/+$/,
  "",
);
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || "1"));
const MIN_INTERVAL_MS = Number(process.env.MIN_INTERVAL_MS || 60_000);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || "5000");
const POLL_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS || 240_000);
const COUNTRY_FILTER = (process.env.COUNTRY || "").toUpperCase();
const LIMIT = Number(process.env.LIMIT || "0");
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmt(d = new Date()) {
  return d.toISOString().slice(11, 19);
}
function log(...args) {
  console.log(`[${fmt()}]`, ...args);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      body?.message || `${res.status} ${res.statusText} on ${url}`,
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function listPendingPages() {
  const pages = await fetchJson(`${API_BASE}/api/pages`);
  let pending = pages.filter((p) => !p.assets || p.assets.length === 0);
  if (COUNTRY_FILTER) {
    pending = pending.filter(
      (p) => (p.country || "").toUpperCase() === COUNTRY_FILTER,
    );
  }
  if (LIMIT > 0) pending = pending.slice(0, LIMIT);
  return pending;
}

async function startGeneration(pageId) {
  return fetchJson(`${API_BASE}/api/pages/${pageId}/generate-images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

async function pollUntilDone(pageId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    let status;
    try {
      status = await fetchJson(
        `${API_BASE}/api/pages/${pageId}/generate-images/status`,
      );
    } catch (err) {
      // Transient — keep polling.
      log(`  (poll error for ${pageId}: ${err.message}, retrying)`);
      continue;
    }
    if (status.status === "completed") return { ok: true, status };
    if (status.status === "failed") return { ok: false, status };
    if (status.status === "idle") {
      // Server forgot the job (restart, or never started). Surface it.
      return { ok: false, status, reason: "job vanished (server restart?)" };
    }
    // status === "running" — keep waiting.
  }
  return { ok: false, status: null, reason: `polling timed out after ${POLL_TIMEOUT_MS}ms` };
}

async function processOne(page) {
  const label = `${page.country || "??"} | ${page.pageName} (${page.id})`;
  try {
    log(`→ start  ${label}`);
    await startGeneration(page.id);
    const result = await pollUntilDone(page.id);
    if (result.ok) {
      const errs = result.status?.errors || [];
      const tag = errs.length > 0 ? "partial" : "ok";
      log(`✓ ${tag.padEnd(7)} ${label}${errs.length ? ` — ${errs.map((e) => `${e.slot}: ${e.message}`).join(", ")}` : ""}`);
      return { page, ok: true, partial: errs.length > 0, errs };
    }
    const msg = result.status?.error?.message || result.reason || "unknown";
    log(`✗ failed  ${label} — ${msg}`);
    return { page, ok: false, error: msg };
  } catch (err) {
    log(`✗ error   ${label} — ${err.message}`);
    return { page, ok: false, error: err.message };
  }
}

async function runWithConcurrency(items, concurrency, handler) {
  const results = [];
  const queue = items.slice();
  // Shared rolling clock so all workers respect MIN_INTERVAL_MS between starts,
  // even when concurrency > 1. At concurrency 1 it's just "wait until next tick".
  let nextStartAt = Date.now();

  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      const wait = nextStartAt - Date.now();
      if (wait > 0) {
        log(`  (pacing — waiting ${Math.ceil(wait / 1000)}s before next page)`);
        await sleep(wait);
      }
      nextStartAt = Date.now() + MIN_INTERVAL_MS;
      const result = await handler(item);
      results.push(result);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

async function main() {
  log(`API base: ${API_BASE}`);
  log(`Fetching pages...`);
  const pending = await listPendingPages();
  log(
    `Found ${pending.length} pending page(s)${COUNTRY_FILTER ? ` (country=${COUNTRY_FILTER})` : ""}${LIMIT ? ` (limited to ${LIMIT})` : ""}`,
  );

  if (!pending.length) {
    log("Nothing to do. Exiting.");
    return;
  }

  if (DRY_RUN) {
    pending.forEach((p, i) =>
      log(`  ${String(i + 1).padStart(3)}. ${p.country || "??"} | ${p.pageName} (${p.id})`),
    );
    log("DRY_RUN=1, exiting without firing anything.");
    return;
  }

  log(`Starting with concurrency=${CONCURRENCY}. Each page takes ~30–180s.`);
  const started = Date.now();
  const results = await runWithConcurrency(pending, CONCURRENCY, processOne);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const ok = results.filter((r) => r.ok && !r.partial).length;
  const partial = results.filter((r) => r.ok && r.partial).length;
  const failed = results.filter((r) => !r.ok).length;

  log("───────────────────────────────────────────");
  log(`Done in ${elapsed}s.   ok=${ok}  partial=${partial}  failed=${failed}`);

  if (failed > 0) {
    log("Failed pages:");
    results
      .filter((r) => !r.ok)
      .forEach((r) =>
        log(`  - ${r.page.country || "??"} | ${r.page.pageName} (${r.page.id}): ${r.error}`),
      );
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
