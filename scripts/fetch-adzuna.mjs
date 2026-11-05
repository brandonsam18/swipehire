// Fetches current US internships in every field from the Adzuna job search
// API and writes them to data/adzuna-internships.json in the same shape as the
// SimplifyJobs list, so the app can show both together. A GitHub Action runs
// this daily (see .github/workflows/fetch-internships.yml).
//
// Usage: ADZUNA_APP_ID=... ADZUNA_APP_KEY=... node scripts/fetch-adzuna.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { ADZUNA_CATEGORIES } from "../fields.js";
import { STATE_NAMES } from "../locations.js";

const OUTPUT_FILE = "data/adzuna-internships.json";
const API_URL = "https://api.adzuna.com/v1/api/jobs/us/search";
// Adzuna's catch-all for entry-level jobs; its internships are sorted into fields by title.
const EXTRA_CATEGORIES = ["graduate-jobs"];
const RESULTS_PER_PAGE = 50;
// The free key allows about 2,500 requests a month, so one run stays under 60.
const MAX_PAGES_PER_CATEGORY = 2;
const MAX_DAYS_OLD = 60;
// The free key also allows 25 requests a minute.
const DELAY_BETWEEN_REQUESTS_MS = 2600;
// Closed postings are kept this long so saved ones can still say "closed".
const KEEP_CLOSED_DAYS = 60;
const SECONDS_PER_DAY = 86400;

// Adzuna's search matches "internal" and "international" too; only real internships pass this.
const INTERNSHIP_TITLE = /\bintern(s|ship|ships)?\b/i;
const TERM_IN_TITLE = /\b(Summer|Fall|Spring|Winter)\s+(20\d\d)\b/i;
const STATE_CODES_BY_NAME = Object.fromEntries(Object.entries(STATE_NAMES).map(([code, name]) => [name, code]));

function plainText(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Adzuna's area list (["US", state, county, city]) as "City, ST", like the SimplifyJobs data. */
function locationOf(area) {
  const [, stateName, , city] = area ?? [];
  const stateCode = STATE_CODES_BY_NAME[stateName];
  if (city && stateCode) return `${city}, ${stateCode}`;
  return stateName ?? "United States";
}

/** One Adzuna job as a SwipeHire posting, or null if it isn't an internship. */
export function postingFromAdzunaJob(job, nowSeconds) {
  const title = plainText(job.title ?? "");
  if (!INTERNSHIP_TITLE.test(title)) return null;
  const companyName = plainText(job.company?.display_name ?? "");
  if (!companyName || !job.redirect_url?.startsWith("https://")) return null;

  const locations = [locationOf(job.location?.area)];
  if (/\bremote\b/i.test(title)) locations.push("Remote in USA");
  const term = title.match(TERM_IN_TITLE);
  const posted = Math.floor(Date.parse(job.created) / 1000);
  return {
    id: `adzuna-${job.id}`,
    source: "adzuna",
    company_name: companyName,
    title,
    category: job.category?.tag ?? "unknown",
    locations,
    terms: term ? [`${capitalize(term[1])} ${term[2]}`] : [],
    url: job.redirect_url,
    date_posted: Number.isFinite(posted) ? posted : nowSeconds,
    date_updated: nowSeconds,
    active: true,
  };
}

/**
 * Combines this run's postings with the last run's. A posting that vanished from
 * Adzuna is marked closed, unless it was only missed because its category had
 * more postings than one run fetches (`cutoffs` maps such a category to the
 * oldest date fetched for it). Closed postings are dropped after KEEP_CLOSED_DAYS.
 */
export function mergePostings(previous, fetched, cutoffs, nowSeconds) {
  const merged = new Map(fetched.map((posting) => [posting.id, posting]));
  for (const posting of previous) {
    if (merged.has(posting.id)) continue;
    const tooOldToFetch = nowSeconds - posting.date_posted > MAX_DAYS_OLD * SECONDS_PER_DAY;
    const missedByPageLimit = posting.date_posted < (cutoffs.get(posting.category) ?? -Infinity);
    if (posting.active && (tooOldToFetch || !missedByPageLimit)) {
      merged.set(posting.id, { ...posting, active: false, date_updated: nowSeconds });
    } else if (posting.active || nowSeconds - posting.date_updated < KEEP_CLOSED_DAYS * SECONDS_PER_DAY) {
      merged.set(posting.id, posting);
    }
  }
  return [...merged.values()].sort((a, b) => b.date_posted - a.date_posted);
}

async function fetchPage(category, page, credentials) {
  const params = new URLSearchParams({
    ...credentials,
    results_per_page: String(RESULTS_PER_PAGE),
    what_or: "intern internship interns internships",
    category,
    max_days_old: String(MAX_DAYS_OLD),
    sort_by: "date",
    "content-type": "application/json",
  });
  const response = await fetch(`${API_URL}/${page}?${params}`);
  if (!response.ok) throw new Error(`Adzuna returned HTTP ${response.status} for ${category} page ${page}`);
  return (await response.json()).results ?? [];
}

async function readPreviousPostings() {
  try {
    return JSON.parse(await readFile(OUTPUT_FILE, "utf8"));
  } catch {
    return [];
  }
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  const { ADZUNA_APP_ID, ADZUNA_APP_KEY } = process.env;
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    throw new Error("Set ADZUNA_APP_ID and ADZUNA_APP_KEY (see README).");
  }
  const credentials = { app_id: ADZUNA_APP_ID, app_key: ADZUNA_APP_KEY };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const fetched = [];
  const cutoffs = new Map();

  for (const category of [...ADZUNA_CATEGORIES, ...EXTRA_CATEGORIES]) {
    for (let page = 1; page <= MAX_PAGES_PER_CATEGORY; page++) {
      const jobs = await fetchPage(category, page, credentials);
      await wait(DELAY_BETWEEN_REQUESTS_MS);
      const postings = jobs.map((job) => postingFromAdzunaJob(job, nowSeconds)).filter(Boolean);
      fetched.push(...postings);
      if (jobs.length < RESULTS_PER_PAGE) break;
      if (page === MAX_PAGES_PER_CATEGORY) {
        const oldestFetched = Math.min(...jobs.map((job) => Date.parse(job.created) / 1000).filter(Number.isFinite));
        cutoffs.set(category, oldestFetched);
      }
    }
  }

  // The same job can come back under two searches; keep one copy.
  const unique = [...new Map(fetched.map((posting) => [posting.id, posting])).values()];
  const postings = mergePostings(await readPreviousPostings(), unique, cutoffs, nowSeconds);
  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(postings)}\n`);
  const openCount = postings.filter((posting) => posting.active).length;
  console.log(`Wrote ${postings.length} postings (${openCount} open) to ${OUTPUT_FILE}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
