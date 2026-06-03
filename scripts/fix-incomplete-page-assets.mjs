/* global process */
/**
 * Fix pages that have exactly one of { profile, cover } brand assets by
 * generating ONLY the missing slot. Skips fully-empty pages (those are
 * "Pending" — use generate-pending-page-images.mjs for them) and pages that
 * already have both.
 *
 * Requires the server-side `slots` param on POST /api/pages/:id/generate-images
 * (added alongside this script). If you call this against an older server,
 * it would regenerate BOTH slots, leaving you with a duplicate of the asset
 * you already had — restart the backend first.
 *
 * Defaults: CONCURRENCY=1, MIN_INTERVAL_MS=60000 (same pacing as
 * generate-pending-page-images.mjs).
 *
 * Usage:
 *   node scripts/fix-incomplete-page-assets.mjs
 *   API_BASE=http://localhost:4000 node scripts/fix-incomplete-page-assets.mjs
 *   DRY_RUN=1 node scripts/fix-incomplete-page-assets.mjs        # list, don't run
 *   COUNTRY=IT node scripts/fix-incomplete-page-assets.mjs       # only IT
 *   LIMIT=5 node scripts/fix-incomplete-page-assets.mjs          # first 5 only
 *   MIN_INTERVAL_MS=30000 node scripts/fix-incomplete-page-assets.mjs
 */

const API_BASE = (process.env.API_BASE || "https://7or34.space").replace(
  /\/+$/,
  "",
);
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || "1"));
const MIN_INTERVAL_MS = Number(process.env.MIN_INTERVAL_MS || 60_000);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);
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

async function listIncompletePages() {
  const pages = await fetchJson(`${API_BASE}/api/pages`);
  const incomplete = [];
  for (const p of pages) {
    const types = new Set((p.assets || []).map((a) => a.type));
    const hasProfile = types.has("profile");
    const hasCover = types.has("cover");
    if (hasProfile === hasCover) continue; // 0 of 2 (pending) or 2 of 2 (complete)
    const missing = hasProfile ? "cover" : "profile";
    incomplete.push({
      id: p.id,
      pageName: p.pageName,
      country: p.country || "",
      missing,
    });
  }
  let filtered = incomplete;
  if (COUNTRY_FILTER) {
    filtered = filtered.filter(
      (p) => p.country.toUpperCase() === COUNTRY_FILTER,
    );
  }
  if (LIMIT > 0) filtered = filtered.slice(0, LIMIT);
  return filtered;
}

async function startGeneration(pageId, slot) {
  return fetchJson(`${API_BASE}/api/pages/${pageId}/generate-images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slots: [slot] }),
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
      log(`  (poll error for ${pageId}: ${err.message}, retrying)`);
      continue;
    }
    if (status.status === "completed") return { ok: true, status };
    if (status.status === "failed") return { ok: false, status };
    if (status.status === "idle") {
      return {
        ok: false,
        status,
        reason: "job vanished (server restart?)",
      };
    }
  }
  return {
    ok: false,
    status: null,
    reason: `polling timed out after ${POLL_TIMEOUT_MS}ms`,
  };
}

async function processOne(page) {
  const label = `${page.country || "??"} | ${page.pageName} (${page.id}) [+${page.missing}]`;
  try {
    log(`→ start  ${label}`);
    await startGeneration(page.id, page.missing);
    const result = await pollUntilDone(page.id);
    if (result.ok) {
      const errs = result.status?.errors || [];
      const tag = errs.length > 0 ? "partial" : "ok";
      log(
        `✓ ${tag.padEnd(7)} ${label}${errs.length ? ` — ${errs.map((e) => `${e.slot}: ${e.message}`).join(", ")}` : ""}`,
      );
      return { page, ok: true, partial: errs.length > 0 };
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
  const incomplete = await listIncompletePages();

  const missingProfile = incomplete.filter((p) => p.missing === "profile").length;
  const missingCover = incomplete.filter((p) => p.missing === "cover").length;
  log(
    `Found ${incomplete.length} incomplete page(s)${COUNTRY_FILTER ? ` (country=${COUNTRY_FILTER})` : ""}${LIMIT ? ` (limited to ${LIMIT})` : ""}`,
  );
  log(`  missing profile: ${missingProfile}, missing cover: ${missingCover}`);

  if (!incomplete.length) {
    log("Nothing to do. Exiting.");
    return;
  }

  if (DRY_RUN) {
    incomplete.forEach((p, i) =>
      log(
        `  ${String(i + 1).padStart(3)}. ${p.country || "??"} | ${p.pageName} (${p.id}) — needs ${p.missing}`,
      ),
    );
    log("DRY_RUN=1, exiting without firing anything.");
    return;
  }

  log(
    `Starting with concurrency=${CONCURRENCY}, MIN_INTERVAL_MS=${MIN_INTERVAL_MS}.`,
  );
  const started = Date.now();
  const results = await runWithConcurrency(incomplete, CONCURRENCY, processOne);
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
        log(
          `  - ${r.page.country || "??"} | ${r.page.pageName} (${r.page.id}) [+${r.page.missing}]: ${r.error}`,
        ),
      );
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
