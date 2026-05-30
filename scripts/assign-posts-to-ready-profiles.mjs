// Assign every unassigned Post (profileId === null) to a Profile whose
// status === "Ready" AND that currently has no Post linked to it. 1:1 pairing,
// deterministic order (oldest post -> oldest profile).
//
// Dry-run by default. Pass --apply to actually write.
//
//   node scripts/assign-posts-to-ready-profiles.mjs                       # preview
//   node scripts/assign-posts-to-ready-profiles.mjs --apply               # execute
//   node scripts/assign-posts-to-ready-profiles.mjs --base-url http://localhost:4000 --apply

const DEFAULT_BASE_URL = "https://7or34.space";

function parseArgs(argv) {
  const args = { baseUrl: DEFAULT_BASE_URL, apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--base-url") {
      args.baseUrl = argv[i + 1] || args.baseUrl;
      i += 1;
    }
  }
  args.baseUrl = args.baseUrl.replace(/\/+$/, "");
  return args;
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) {
    const msg = parsed?.message || res.statusText;
    throw new Error(`POST ${url} -> ${res.status} ${msg}`);
  }
  return parsed;
}

function idOf(doc) {
  if (!doc) return "";
  const raw = doc._id ?? doc.id ?? "";
  return typeof raw === "string" ? raw : String(raw);
}

async function main() {
  const { baseUrl, apply } = parseArgs(process.argv.slice(2));
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Mode    : ${apply ? "APPLY (writes)" : "dry-run"}`);

  const [posts, readyProfiles] = await Promise.all([
    getJSON(`${baseUrl}/api/posts`),
    getJSON(`${baseUrl}/api/profiles?status=Ready`),
  ]);

  const takenProfileIds = new Set(
    posts.map((p) => (p.profileId ? String(p.profileId) : "")).filter(Boolean),
  );

  const unassignedPosts = posts
    .filter((p) => !p.profileId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const eligibleProfiles = readyProfiles
    .filter((p) => !takenProfileIds.has(idOf(p)))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  console.log(`Posts total           : ${posts.length}`);
  console.log(`Posts unassigned      : ${unassignedPosts.length}`);
  console.log(`Ready profiles total  : ${readyProfiles.length}`);
  console.log(`Ready & post-less     : ${eligibleProfiles.length}`);

  const pairs = [];
  for (let i = 0; i < Math.min(unassignedPosts.length, eligibleProfiles.length); i += 1) {
    pairs.push({ post: unassignedPosts[i], profile: eligibleProfiles[i] });
  }

  console.log(`Will pair             : ${pairs.length}`);
  const leftoverPosts = unassignedPosts.length - pairs.length;
  const leftoverProfiles = eligibleProfiles.length - pairs.length;
  if (leftoverPosts) console.log(`Leftover posts        : ${leftoverPosts} (no profile to give them to)`);
  if (leftoverProfiles) console.log(`Leftover profiles     : ${leftoverProfiles} (still post-less after run)`);

  console.log("\nPreview:");
  pairs.slice(0, 10).forEach(({ post, profile }, i) => {
    const name = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "(no name)";
    const caption = String(post.caption || "").replace(/\s+/g, " ").slice(0, 60);
    console.log(`  ${String(i + 1).padStart(2)}. post ${post._id}  ->  ${idOf(profile)}  ${name}  | ${caption}`);
  });
  if (pairs.length > 10) console.log(`  ... and ${pairs.length - 10} more`);

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write.");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const { post, profile } of pairs) {
    try {
      await postJSON(`${baseUrl}/api/posts/${post._id}/assign`, { profileId: idOf(profile) });
      ok += 1;
      process.stdout.write(".");
    } catch (err) {
      fail += 1;
      console.log(`\n  FAIL post ${post._id} -> ${idOf(profile)}: ${err.message}`);
    }
  }
  console.log(`\nDone. assigned=${ok} failed=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
