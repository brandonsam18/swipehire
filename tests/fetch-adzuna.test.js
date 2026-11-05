import assert from "node:assert/strict";
import { test } from "node:test";
import { mergePostings, postingFromAdzunaJob } from "../scripts/fetch-adzuna.mjs";

const NOW = Date.parse("2026-11-05T12:00:00Z") / 1000;
const DAY = 86400;

// Shaped like one result from Adzuna's search API.
function adzunaJob(overrides = {}) {
  return {
    id: "4900000001",
    title: "Marketing <strong>Intern</strong> - Summer 2027",
    created: "2026-11-01T09:30:00Z",
    redirect_url: "https://www.adzuna.com/land/ad/4900000001",
    company: { display_name: "Acme &amp; Co" },
    location: { display_name: "Chicago, Cook County", area: ["US", "Illinois", "Cook County", "Chicago"] },
    category: { tag: "pr-advertising-marketing-jobs", label: "PR, Advertising & Marketing Jobs" },
    ...overrides,
  };
}

test("an Adzuna internship becomes a posting shaped like the SimplifyJobs data", () => {
  const posting = postingFromAdzunaJob(adzunaJob(), NOW);
  assert.deepEqual(posting, {
    id: "adzuna-4900000001",
    source: "adzuna",
    company_name: "Acme & Co",
    title: "Marketing Intern - Summer 2027",
    category: "pr-advertising-marketing-jobs",
    locations: ["Chicago, IL"],
    terms: ["Summer 2027"],
    url: "https://www.adzuna.com/land/ad/4900000001",
    date_posted: Date.parse("2026-11-01T09:30:00Z") / 1000,
    date_updated: NOW,
    active: true,
  });
});

test("jobs that only mention 'internal' or 'international' are left out", () => {
  assert.equal(postingFromAdzunaJob(adzunaJob({ title: "Internal Auditor" }), NOW), null);
  assert.equal(postingFromAdzunaJob(adzunaJob({ title: "International Sales Manager" }), NOW), null);
});

test("a posting with only a state, or no location, still gets a readable place", () => {
  const stateOnly = postingFromAdzunaJob(adzunaJob({ location: { area: ["US", "Texas"] } }), NOW);
  assert.deepEqual(stateOnly.locations, ["Texas"]);
  const nowhere = postingFromAdzunaJob(adzunaJob({ location: undefined }), NOW);
  assert.deepEqual(nowhere.locations, ["United States"]);
});

function posting(id, daysOld, overrides = {}) {
  return { id, category: "teaching-jobs", date_posted: NOW - daysOld * DAY, date_updated: NOW - DAY, active: true, ...overrides };
}

test("a posting that disappears from Adzuna is kept but marked closed", () => {
  const merged = mergePostings([posting("a", 5), posting("b", 3)], [posting("b", 3)], new Map(), NOW);
  const closed = merged.find((item) => item.id === "a");
  assert.equal(closed.active, false);
  assert.equal(closed.date_updated, NOW);
  assert.equal(merged.find((item) => item.id === "b").active, true);
});

test("a posting missed only because its category had too many results stays open", () => {
  const cutoffs = new Map([["teaching-jobs", NOW - 2 * DAY]]);
  const merged = mergePostings([posting("old", 10)], [], cutoffs, NOW);
  assert.equal(merged[0].active, true);
});

test("closed postings are dropped after 60 days", () => {
  const longClosed = posting("gone", 120, { active: false, date_updated: NOW - 61 * DAY });
  const recentlyClosed = posting("kept", 30, { active: false, date_updated: NOW - 10 * DAY });
  const merged = mergePostings([longClosed, recentlyClosed], [], new Map(), NOW);
  assert.deepEqual(merged.map((item) => item.id), ["kept"]);
});

test("postings in a category skipped after server errors stay open", () => {
  const cutoffs = new Map([["teaching-jobs", Infinity]]);
  const merged = mergePostings([posting("a", 5)], [], cutoffs, NOW);
  assert.equal(merged[0].active, true);
});
