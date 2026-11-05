import assert from "node:assert/strict";
import { test } from "node:test";
import { ADZUNA_CATEGORIES, FIELDS, fieldIdOf } from "../fields.js";

test("SimplifyJobs postings go to Computing & Data unless their category says otherwise", () => {
  assert.equal(fieldIdOf({ category: "Software", title: "Software Engineer Intern" }), "computing");
  assert.equal(fieldIdOf({ category: "Quant", title: "Quant Trader Intern" }), "business");
  assert.equal(fieldIdOf({ category: "Hardware", title: "ASIC Intern" }), "engineering");
});

test("Adzuna postings get their field from Adzuna's category", () => {
  const nursing = { source: "adzuna", category: "healthcare-nursing-jobs", title: "Nursing Intern" };
  assert.equal(fieldIdOf(nursing), "healthcare");
  const teaching = { source: "adzuna", category: "teaching-jobs", title: "Summer Intern" };
  assert.equal(fieldIdOf(teaching), "education");
});

test("Adzuna catch-all categories fall back to the title, then to Other", () => {
  const marketing = { source: "adzuna", category: "graduate-jobs", title: "Marketing Intern" };
  assert.equal(fieldIdOf(marketing), "marketing");
  const unclear = { source: "adzuna", category: "graduate-jobs", title: "Summer Intern" };
  assert.equal(fieldIdOf(unclear), "other");
});

test("every fetched Adzuna category belongs to exactly one field", () => {
  assert.equal(new Set(ADZUNA_CATEGORIES).size, ADZUNA_CATEGORIES.length);
  for (const field of FIELDS) {
    assert.ok(field.name && field.emoji, `${field.id} needs a name and emoji`);
  }
});
