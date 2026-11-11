import assert from "node:assert/strict";
import { test } from "node:test";
import { computeProgress, currentStage, withStage } from "../game.js";
import { coinsEarned } from "../shop.js";

const NOW = new Date(2026, 10, 12, 15, 0);
const applied = { at: new Date(2026, 10, 1, 12, 0).toISOString(), fresh: false, roleIds: [] };

function progressFor(...applications) {
  return computeProgress(applications, [], { now: NOW });
}

test("applications without a saved stage count as Applied", () => {
  assert.equal(currentStage(applied), "applied");
  assert.equal(progressFor(applied).stageCounts.applied, 1);
});

test("reaching a stage earns its XP and coins", () => {
  const before = progressFor(applied);
  const interview = progressFor(withStage(applied, "interview", NOW));
  // 150 XP for the interview, plus 150 for the First Interview trophy.
  assert.equal(interview.xp - before.xp, 300);
  assert.ok(coinsEarned(interview) - coinsEarned(before) >= 25);
  assert.equal(interview.stageCounts.interview, 1);
  assert.ok(interview.achievements.find((trophy) => trophy.id === "first-interview").unlocked);
});

test("moving through every stage earns each one's reward", () => {
  const offer = ["assessment", "interview", "offer"].reduce((application, stage) => withStage(application, stage, NOW), applied);
  assert.deepEqual(Object.keys(offer.reached).sort(), ["assessment", "interview", "offer"]);
  assert.equal(progressFor(offer).stageCoins, 10 + 25 + 100);
});

test("a rejection keeps the rewards of stages already reached, plus its own small one", () => {
  const interviewed = withStage(withStage(applied, "assessment", NOW), "interview", NOW);
  const rejected = withStage(interviewed, "rejected", NOW);
  assert.equal(currentStage(rejected), "rejected");
  assert.equal(progressFor(rejected).xp - progressFor(interviewed).xp, 10);
  assert.equal(progressFor(rejected).stageCounts.rejected, 1);
});

test("moving back to an earlier stage takes back the later stages' rewards", () => {
  const offer = withStage(withStage(applied, "interview", NOW), "offer", NOW);
  const backToInterview = withStage(offer, "interview", NOW);
  assert.deepEqual(Object.keys(backToInterview.reached), ["interview"]);
  const backToApplied = withStage(withStage(offer, "rejected", NOW), "applied", NOW);
  assert.deepEqual(backToApplied.reached, {});
  assert.equal(progressFor(backToApplied).xp, progressFor(applied).xp);
});

test("the pipeline counts each application once, at its current stage", () => {
  const progress = progressFor(
    applied,
    withStage(applied, "assessment", NOW),
    withStage(withStage(applied, "interview", NOW), "rejected", NOW),
  );
  assert.deepEqual(progress.stageCounts, { applied: 1, assessment: 1, interview: 0, offer: 0, rejected: 1 });
});
