import { getCountry, DEFAULT_COUNTRY } from "./countries/index.js";
import { INTL_DESTINATIONS } from "./shared/travel.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

// Weighted count: heavier toward lower values
// weights[0] = weight for count 0, weights[1] for 1, etc.
function weightedCount(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function zeroPad(n) {
  return String(n).padStart(2, "0");
}

// Expand short region codes in a "City, XX" hometown label using the country's
// regionNameByCode map. Countries that already use full region names (e.g. Italy)
// won't match the regex and will pass through unchanged.
function expandRegionCodeInLocation(label, regionNameByCode = {}) {
  const match = String(label || "").match(/^(.*),\s([A-Z]{2,3})$/);
  if (!match) return label;
  const [, cityName, code] = match;
  const full = regionNameByCode[code];
  return full ? `${cityName}, ${full}` : label;
}

// YYYY-MM string within a reasonable range
function randYearMonth(startYear, endYear) {
  const y = randInt(startYear, endYear);
  const m = randInt(1, 12);
  return `${y}-${zeroPad(m)}`;
}

// ─── Email variants ──────────────────────────────────────────────────────────

function generateEmails(firstName, lastName, birthYear, emailDomains) {
  const fn = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const ln = lastName.toLowerCase().replace(/[^a-z]/g, "");
  const yy4 = String(birthYear);
  const yy2 = yy4.slice(2);
  const domain = pick(emailDomains);

  const variants = [
    `${fn}.${ln}@${domain}`,
    `${fn}.${ln}${yy4}@${domain}`,
    `${fn}.${ln}${yy2}@${domain}`,
    `${fn}${yy4}${ln}@${domain}`,
    `${fn}${yy2}${ln}@${domain}`,
  ];

  return variants.map((address) => ({ address, selected: false }));
}

// ─── Password generator ──────────────────────────────────────────────────────

// Simple, human-style pattern derived from the first name: leetspeak(name) +
// number + special, e.g. "L4ur4" -> "L4ur457@2". Leetifying the letters means
// the literal name never appears as a contiguous substring, which dodges the
// Outlook/Microsoft "password can't contain your name" rule. We leet vowels
// plus s/t so the result is several edits away from the name (clears Microsoft's
// fuzzy similarity check too) while staying recognizable. Every result has an
// uppercase letter (the leading initial), a digit and a symbol, and is at least
// MIN_PASSWORD_LENGTH characters — comfortably above both services' 8-char floor.
const LEET_MAP = { a: "4", e: "3", i: "1", o: "0", s: "5", t: "7" };
const MIN_PASSWORD_LENGTH = 10;

function leetifyName(firstName) {
  const cleaned = String(firstName || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!cleaned) return "User";

  // Keep the leading initial as a readable uppercase letter; leet the rest.
  const first = cleaned.charAt(0).toUpperCase();
  let changed = false;
  const rest = cleaned.slice(1).replace(/[aeiost]/g, (ch) => {
    changed = true;
    return LEET_MAP[ch];
  });

  // Names with no leetable letter after the first (e.g. "Bryn") keep the literal
  // name intact, so break it with a digit instead.
  if (!changed && rest) {
    return first + randInt(0, 9) + rest;
  }
  return first + rest;
}

function generatePassword(firstName) {
  const specials = ["!", "@", "#", "$", "!1", "@2", "#3"];
  const name = leetifyName(firstName);
  const special = pick(specials);

  // Start with a 2-digit number, then add digits until the whole password
  // reaches the minimum length.
  let digits = String(randInt(10, 99));
  while (name.length + digits.length + special.length < MIN_PASSWORD_LENGTH) {
    digits += String(randInt(0, 9));
  }

  return name + digits + special;
}

// ─── Work experience ─────────────────────────────────────────────────────────

function generateWorkExperiences(country, birthYear) {
  const industryKeysAll = Object.keys(country.industries);
  // 0 jobs: 5%, 1 job: 40%, 2 jobs: 40%, 3 jobs: 15%
  const count = weightedCount([5, 40, 40, 15]);
  if (count === 0) return [];

  const industryKeys = pickN(industryKeysAll, count);
  const currentYear = new Date().getFullYear();
  const startWorkYear = birthYear + 18;

  const jobs = [];
  let cursor = startWorkYear;

  for (let i = 0; i < count; i++) {
    const industry = country.industries[industryKeys[i]];
    const company = pick(industry.companies);
    const position = pick(industry.titles);

    const from = cursor + randInt(0, 2);
    const isCurrent = i === count - 1 && Math.random() < 0.65;
    const to = isCurrent ? null : Math.min(from + randInt(1, 4), currentYear);

    jobs.push({
      company,
      position,
      from: String(from),
      to: to ? String(to) : "",
      current: isCurrent,
      city: "",
    });

    cursor = to ? to : currentYear;
  }

  return jobs;
}

// ─── Education ───────────────────────────────────────────────────────────────

function generateEducation(country, regionCode, macroRegion, birthYear) {
  const hsByCode = country.education.highSchoolsByRegionCode || {};
  const collegesByMacro = country.education.collegesByMacroRegion || {};

  const hsPool = hsByCode[regionCode] || Object.values(hsByCode).flat();
  const collegePool = collegesByMacro[macroRegion] || Object.values(collegesByMacro).flat();

  const hsGraduated = Math.random() < 0.9;
  const hsFrom = birthYear + 14;
  const hsTo = birthYear + 18;

  const hasCollege = Math.random() < 0.7;
  const collegeGraduated = hasCollege && Math.random() < 0.65;
  const collegeFrom = birthYear + 18;
  const collegeTo = birthYear + 22;

  return {
    highSchool: {
      name: pick(hsPool),
      from: String(hsFrom),
      to: String(hsTo),
      graduated: hsGraduated,
    },
    college: hasCollege
      ? {
          name: pick(collegePool),
          from: String(collegeFrom),
          to: String(collegeTo),
          degree: collegeGraduated ? pick(country.education.degrees) : "",
          graduated: collegeGraduated,
        }
      : null,
  };
}

// ─── Personal details ────────────────────────────────────────────────────────

const RELATIONSHIP_STATUSES = [
  "Single",
  "In a Relationship",
  "Engaged",
  "Married",
  "In a civil union",
  "In a domestic partnership",
  "In an open relationship",
  "It's Complicated",
  "Separated",
  "Divorced",
  "Widowed",
];

// Weights: Single most common, Married next, others less frequent
const REL_STATUS_WEIGHTS = [30, 20, 8, 18, 3, 3, 4, 6, 3, 4, 1];

function pickRelationshipStatus() {
  return RELATIONSHIP_STATUSES[weightedCount(REL_STATUS_WEIGHTS)];
}

function generatePersonalDetails(country, birthYear) {
  const relStatus = pickRelationshipStatus();
  const isSingle = relStatus === "Single";

  const primaryLanguage = country.meta?.defaultLanguage || "English";
  const languagePool = country.interests?.languages || [primaryLanguage];

  // 1–3 languages, primary language always first
  const langCount = weightedCount([0, 50, 35, 15]); // 0=skip index so shift
  const extraLangs = pickN(
    languagePool.filter((l) => l !== primaryLanguage),
    langCount > 0 ? langCount - 1 : 0
  );
  const languages = langCount > 0 ? [primaryLanguage, ...extraLangs] : [primaryLanguage];

  return {
    relationshipStatus: relStatus,
    relationshipStatusSince: isSingle
      ? ""
      : String(randInt(birthYear + 18, new Date().getFullYear() - 1)),
    languages: languages.slice(0, 3),
  };
}

// ─── Travel ──────────────────────────────────────────────────────────────────

function generateTravel(birthYear) {
  // 40% no travel, 35% 1, 20% 2, 5% 3
  const count = weightedCount([40, 35, 20, 5]);
  if (count === 0) return [];

  const destinations = pickN(INTL_DESTINATIONS, count);
  return destinations.map((d) => ({
    place: d.place,
    date: randYearMonth(birthYear + 20, new Date().getFullYear()),
  }));
}

// ─── Interests via archetype ─────────────────────────────────────────────────

function generateInterests(country, archetype) {
  const pool = country.interests.archetypes[archetype];

  // max 3 per category, weighted lower
  const hobbyCount = weightedCount([0, 25, 50, 25]) + 1; // at least 1
  const musicCount = weightedCount([0, 30, 50, 20]) + 1;
  const tvCount = weightedCount([0, 35, 45, 20]) + 1;
  const movieCount = weightedCount([0, 35, 45, 20]) + 1;
  const gameCount = weightedCount([0, 50, 35, 15]);
  const sportCount = weightedCount([0, 40, 40, 20]);

  return {
    hobbies: pickN(pool.hobbies, Math.min(hobbyCount, 3)),
    music: pickN(pool.music, Math.min(musicCount, 3)),
    tvShows: pickN(pool.tvShows, Math.min(tvCount, 3)),
    movies: pickN(pool.movies, Math.min(movieCount, 3)),
    games: pickN(pool.games, Math.min(gameCount, 3)),
    sportsTeams: pickN(pool.sportsTeams, Math.min(sportCount, 3)),
  };
}

// ─── Other names (aliases) ───────────────────────────────────────────────────

function generateOtherNames(country) {
  // 60% no alias, 30% 1, 10% 2
  const count = weightedCount([60, 30, 10]);
  return pickN(country.interests.aliasNames, count);
}

// ─── Bio ──────────────────────────────────────────────────────────────────────

function fillTemplate(template, { firstName, title, company, city, hobby1, hobby2, trait1, trait2, quote, emoji1, emoji2 }) {
  return template
    .replace(/{firstName}/g, firstName)
    .replace(/{title}/g, title)
    .replace(/{company}/g, company)
    .replace(/{city}/g, city)
    .replace(/{trait1}/g, trait1)
    .replace(/{trait2}/g, trait2)
    .replace(/{hobby1}/g, hobby1)
    .replace(/{hobby2}/g, hobby2)
    .replace(/{quote}/g, quote)
    .replace(/{emoji1}/g, emoji1)
    .replace(/{emoji2}/g, emoji2)
    .replace(/girl\/guy/g, "person")
    .replace(/\s{2,}/g, " ")   // collapse double spaces from empty emoji slots
    .trim();
}

function generateBio(country, firstName, title, company, city, interests) {
  const {
    templates: BIO_TEMPLATES,
    quoteTemplates: QUOTE_TEMPLATES,
    quotes: QUOTES,
    motivationalQuotes: MOTIVATIONAL_QUOTES,
    emojis: BIO_EMOJIS,
    traits: TRAITS,
  } = country.bios;

  const trait1 = pick(TRAITS);
  let trait2 = pick(TRAITS);
  while (trait2 === trait1) trait2 = pick(TRAITS);

  const hobby1 = (interests.hobbies[0] || "exploring").toLowerCase();
  const hobby2 = (interests.hobbies[1] || "traveling").toLowerCase();

  const quotePool = Math.random() < 0.5 ? QUOTES : MOTIVATIONAL_QUOTES;
  const quote = pick(quotePool);

  // Emoji randomizer: 50% no emoji, 50% include 1–3 unique emojis
  const useEmoji = Math.random() < 0.5;
  const emojiCount = useEmoji ? randInt(1, 3) : 0;
  const chosenEmojis = pickN(BIO_EMOJIS, emojiCount);
  const emoji1 = chosenEmojis[0] || "";
  const emoji2 = chosenEmojis[1] || "";

  const vars = { firstName, title, company, city, hobby1, hobby2, trait1, trait2, quote, emoji1, emoji2 };

  const MAX_CHARS = 100;
  const MAX_ATTEMPTS = 40;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    // Quote templates only available when emoji is on (they rely on {emoji1})
    const useQuote = useEmoji && Math.random() < 0.3;
    const template = useQuote ? pick(QUOTE_TEMPLATES) : pick(BIO_TEMPLATES);
    const bio = fillTemplate(template, vars);
    if (bio.length <= MAX_CHARS) return bio;
  }

  // Fallback
  const shortest = [...BIO_TEMPLATES].sort((a, b) => a.length - b.length)[0];
  return fillTemplate(shortest, vars).slice(0, MAX_CHARS);
}

// ─── DOB ──────────────────────────────────────────────────────────────────────

function generateDOB(minAge = 25, maxAge = 45) {
  const currentYear = new Date().getFullYear();
  const birthYear = randInt(currentYear - maxAge, currentYear - minAge);
  const birthMonth = randInt(1, 12);
  const birthDay = randInt(1, 28);
  return {
    dob: `${birthYear}-${zeroPad(birthMonth)}-${zeroPad(birthDay)}`,
    birthYear,
  };
}

// ─── Main generator ──────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {"US"|"IT"} [params.country] — country code (default "US")
 * @param {"male"|"female"|"any"} [params.gender]
 * @param {number} [params.minAge]
 * @param {number} [params.maxAge]
 * @param {string} [params.emailDomain]
 * @param {string} [params.status]
 * @param {string[]} [params.tags]
 */
export function generateProfile(params = {}) {
  const {
    country: countryCode = DEFAULT_COUNTRY,
    gender = "any",
    minAge = 25,
    maxAge = 45,
    emailDomain = null,
    status = "Available",
    tags = [],
  } = params;

  const country = getCountry(countryCode);

  // Gender
  const resolvedGender =
    gender === "any" ? (Math.random() < 0.5 ? "male" : "female") : gender;
  const firstName =
    resolvedGender === "male" ? pick(country.names.male) : pick(country.names.female);
  const lastName = pick(country.names.last);

  // DOB
  const { dob, birthYear } = generateDOB(minAge, maxAge);

  // Location anchor
  const locationEntry = pick(country.locations.cities);
  const { city, region, regionCode, macroRegion } = locationEntry;
  const displayCity = `${city}, ${region}`;
  const hometownPool = country.locations.hometowns[city] || [displayCity];
  const hometown = expandRegionCodeInLocation(
    pick(hometownPool),
    country.locations.regionNameByCode,
  );

  // Archetype
  const archetype = pick(country.interests.archetypeKeys);

  // Education (anchored to region/macroRegion)
  const { highSchool, college } = generateEducation(country, regionCode, macroRegion, birthYear);

  // Work
  const work = generateWorkExperiences(country, birthYear);

  // Current job for bio
  const currentJob = work.find((w) => w.current) || work[work.length - 1];
  const bioTitle = currentJob?.position || "Professional";
  const bioCompany = currentJob?.company || "a local company";

  // Interests
  const interests = generateInterests(country, archetype);

  // Bio
  const bio = generateBio(country, firstName, bioTitle, bioCompany, displayCity, interests);

  // Personal
  const personal = generatePersonalDetails(country, birthYear);

  // Travel
  const travel = generateTravel(birthYear);

  // Emails
  const emails = generateEmails(
    firstName,
    lastName,
    birthYear,
    country.meta?.emailDomains || ["gmail.com"],
  ).map((e) => {
    if (emailDomain) {
      return { ...e, address: e.address.replace(/@.+$/, `@${emailDomain}`) };
    }
    return e;
  });
  const emailPassword = generatePassword(firstName);
  const facebookPassword = generatePassword(firstName);

  // Other names
  const otherNames = generateOtherNames(country);

  return {
    firstName,
    lastName,
    gender: resolvedGender.charAt(0).toUpperCase() + resolvedGender.slice(1),
    dob,
    country: country.code,
    city: displayCity,
    hometown,
    bio,
    status,
    tags: tags.length ? tags : [],

    emails,
    emailPassword,
    facebookPassword,

    work: work.length ? work : [],
    education: {
      highSchool,
      college: college || {},
    },
    personal,

    hobbies: interests.hobbies,
    interests: {
      music: interests.music,
      tvShows: interests.tvShows,
      movies: interests.movies,
      games: interests.games,
      sportsTeams: interests.sportsTeams,
    },

    otherNames,
    travel,

    friends: 0,
    has2FA: false,
    hasPage: false,
    profileSetup: false,
    profileCreated: "",
    accountCreated: "",

    phone: "",
    recoveryEmail: "",
    notes: "",
    websites: [],
    socialLinks: [],
    trackerLog: [],
  };
}

/**
 * Generate N unique profiles (unique by first email address)
 * @param {number} count
 * @param {object} params
 */
export function generateBatch(count, params = {}) {
  const seen = new Set();
  const results = [];
  let attempts = 0;
  const maxAttempts = count * 5;

  while (results.length < count && attempts < maxAttempts) {
    attempts++;
    const profile = generateProfile(params);
    const key = profile.emails[0]?.address;
    if (key && !seen.has(key)) {
      seen.add(key);
      results.push(profile);
    }
  }

  return results;
}
