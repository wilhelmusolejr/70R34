// Flag a batch of profiles by EMAIL: set status -> "Flagged", set profileUrl
// from the given Facebook URL (when one is provided), and set emailPassword
// (when one is provided). Matches a target email against any address in the
// profile's emails[] (and recoveryEmail as a fallback).
//
// Dry-run by default. Pass --apply to actually write.
//
//   node scripts/flag-emails-update-url-password.mjs                  # preview
//   node scripts/flag-emails-update-url-password.mjs --apply          # execute
//   node scripts/flag-emails-update-url-password.mjs --base-url http://localhost:4000 --apply

const DEFAULT_BASE_URL = "https://7or34.space";

// email -> { url, emailPassword } changes to apply. url:null means "No Facebook"
// was noted, so we leave profileUrl alone.
const TARGETS = [
  {
    email: "adriano.desantis1981@outlook.com",
    url: "https://www.facebook.com/profile.php?id=61590186341416",
  },
  {
    email: "adolfo.vitali83@outlook.com",
    url: "https://www.facebook.com/profile.php?id=61590221229964",
  },
  {
    email: "mariangela.russo2000@outlook.com",
    url: "https://www.facebook.com/profile.php?id=61590639681944",
  },
  {
    email: "giovanni.romano1994@outlook.com",
    url: "https://www.facebook.com/profile.php?id=61590671480400",
  },
  {
    email: "salvatore.martini87@outlook.com",
    url: "https://www.facebook.com/profile.php?id=61590115784781",
  },
];

function parseArgs(argv) {
  const args = { baseUrl: DEFAULT_BASE_URL, apply: false, status: "Flagged" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--base-url") {
      args.baseUrl = argv[i + 1] || args.baseUrl;
      i += 1;
    } else if (a === "--status") {
      args.status = argv[i + 1] || args.status;
      i += 1;
    }
  }
  args.baseUrl = args.baseUrl.replace(/\/+$/, "");
  return args;
}

const norm = (value) => String(value || "").trim().toLowerCase();

function idOf(doc) {
  if (!doc) return "";
  const raw = doc._id ?? doc.id ?? "";
  return typeof raw === "string" ? raw : String(raw);
}

function addressesOf(profile) {
  const out = [];
  for (const e of profile.emails || []) {
    if (e?.address) out.push(norm(e.address));
  }
  if (profile.recoveryEmail) out.push(norm(profile.recoveryEmail));
  return out;
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.json();
}

async function patchJSON(url, body) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) {
    const msg = parsed?.message || res.statusText;
    throw new Error(`PATCH ${url} -> ${res.status} ${msg}`);
  }
  return parsed;
}

async function main() {
  const { baseUrl, apply, status } = parseArgs(process.argv.slice(2));
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Status  : ${status}`);
  console.log(`Mode    : ${apply ? "APPLY (writes)" : "dry-run"}\n`);

  const profiles = await getJSON(`${baseUrl}/api/profiles`);
  console.log(`Fetched ${profiles.length} profiles.\n`);

  const plans = [];
  const problems = [];

  for (const target of TARGETS) {
    const email = norm(target.email);
    const matches = profiles.filter((p) => addressesOf(p).includes(email));

    if (matches.length === 0) {
      problems.push(`NO MATCH   ${target.email}`);
      continue;
    }
    if (matches.length > 1) {
      problems.push(
        `AMBIGUOUS  ${target.email} -> ${matches.map(idOf).join(", ")}`,
      );
      continue;
    }

    const profile = matches[0];
    const changes = { status };
    if (target.url) changes.profileUrl = target.url;
    if (target.emailPassword) changes.emailPassword = target.emailPassword;

    plans.push({ target, profile, changes });
  }

  console.log("Planned updates:");
  plans.forEach(({ target, profile, changes }, i) => {
    const name =
      `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "(no name)";
    console.log(
      `  ${String(i + 1).padStart(2)}. ${idOf(profile)}  ${name}  [${profile.status}] <${target.email}>`,
    );
    console.log(`      status   : ${profile.status} -> ${changes.status}`);
    if (changes.profileUrl) {
      console.log(`      profileUrl: ${profile.profileUrl || "(empty)"} -> ${changes.profileUrl}`);
    } else {
      console.log(`      profileUrl: (left as-is, no URL given — "No Facebook")`);
    }
    if (changes.emailPassword) {
      console.log(`      emailPwd : ${profile.emailPassword || "(empty)"} -> ${changes.emailPassword}`);
    }
  });

  if (problems.length) {
    console.log("\nProblems (skipped):");
    problems.forEach((p) => console.log(`  - ${p}`));
  }

  console.log(`\nMatched ${plans.length}/${TARGETS.length}; problems: ${problems.length}`);

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write.");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const { target, profile, changes } of plans) {
    try {
      await patchJSON(`${baseUrl}/api/profiles/${idOf(profile)}`, changes);
      ok += 1;
      console.log(`  OK   ${target.email}`);
    } catch (err) {
      fail += 1;
      console.log(`  FAIL ${target.email}: ${err.message}`);
    }
  }
  console.log(`\nDone. updated=${ok} failed=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
