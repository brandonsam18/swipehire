import assert from "node:assert/strict";
import { test } from "node:test";
import { computeProgress, dayKey, previousDayKey } from "../game.js";
import { ITEMS, itemById, shopRotation } from "../items.js";
import {
  MAX_STREAK_FREEZES,
  STREAK_FREEZE,
  buyItem,
  chestsEarned,
  coinsEarned,
  daysToFreeze,
  emptyWallet,
  equipItem,
  openChest,
  rollChestPrize,
  walletState,
} from "../shop.js";

const NOW = new Date(2026, 10, 6, 15, 0);

// One application per entry, on the given local day of November 2026.
function applicationsOn(...days) {
  return days.map((day) => ({ at: new Date(2026, 10, day, 12, 0).toISOString(), fresh: false, roleIds: [] }));
}

// A random() that returns these numbers in order.
function sequence(...numbers) {
  let index = 0;
  return () => numbers[index++ % numbers.length];
}

test("coins come from applications, fresh bonuses, saves, quests, trophies, and levels", () => {
  const base = { applicationCount: 0, freshCount: 0, saveCount: 0, questCompletions: 0, trophyCount: 0, level: 1 };
  assert.equal(coinsEarned(base), 0);
  assert.equal(coinsEarned({ ...base, applicationCount: 3 }), 30);
  assert.equal(coinsEarned({ ...base, applicationCount: 1, freshCount: 1 }), 15);
  assert.equal(coinsEarned({ ...base, saveCount: 5, questCompletions: 2 }), 60);
  assert.equal(coinsEarned({ ...base, trophyCount: 1, level: 3 }), 250);
});

test("a chest is earned for every 5 applications", () => {
  const four = computeProgress(applicationsOn(1, 1, 2, 2), [], { now: NOW });
  const five = computeProgress(applicationsOn(1, 1, 2, 2, 3), [], { now: NOW });
  assert.equal(chestsEarned(four), 0);
  assert.equal(chestsEarned(five), 1);
  assert.equal(walletState(four, emptyWallet()).applicationsToNextChest, 1);
});

test("opening a chest records its prize and uses up the chest", () => {
  const progress = computeProgress(applicationsOn(1, 1, 2, 2, 3), [], { now: NOW });
  const wallet = emptyWallet();
  const prize = openChest(progress, wallet, sequence(0.1, 0.5));
  assert.deepEqual(prize, { coins: 80 });
  assert.equal(walletState(progress, wallet).chestsAvailable, 0);
  assert.equal(openChest(progress, wallet), null);
  assert.equal(walletState(progress, wallet).coins, coinsEarned(progress) + 80);
});

test("chest prizes the player already owns turn into coins", () => {
  const state = { freezes: MAX_STREAK_FREEZES, ownedIds: new Set() };
  const prize = rollChestPrize(state, sequence(0.6, 0));
  assert.ok(prize.coins >= 80, "a full freeze stock gives coins instead");
});

test("buying spends coins, and items can't be bought twice or without enough coins", () => {
  const progress = computeProgress(applicationsOn(1, 2, 3, 4, 5, 6), [], { now: NOW });
  const wallet = emptyWallet();
  const before = walletState(progress, wallet).coins;
  const { daily } = shopRotation(dayKey(NOW));
  const affordable = daily.map(itemById).find((item) => item.cost <= before);
  assert.ok(affordable, `expected a daily item costing at most ${before} coins`);
  assert.equal(buyItem(affordable.id, progress, wallet, NOW), true);
  assert.equal(walletState(progress, wallet).coins, before - affordable.cost);
  assert.equal(buyItem(affordable.id, progress, wallet, NOW), false);
});

test("only today's shop items can be bought, but streak freezes always can", () => {
  const rich = { applicationCount: 0, freshCount: 0, saveCount: 0, questCompletions: 0, trophyCount: 0, level: 50, perfectQuestDays: 0 };
  const { featured, daily } = shopRotation(dayKey(NOW));
  const notToday = ITEMS.find((item) => item.cost > 0 && !featured.includes(item.id) && !daily.includes(item.id));
  assert.equal(buyItem(notToday.id, rich, emptyWallet(), NOW), false);
  assert.equal(buyItem(featured[0], rich, emptyWallet(), NOW), true);
  assert.equal(buyItem(STREAK_FREEZE.id, rich, emptyWallet(), NOW), true);
});

test("equipping needs the item, and puts it in its own locker slot", () => {
  const wallet = emptyWallet();
  assert.equal(equipItem(wallet, "neon", new Set(["neon"])), true);
  assert.equal(wallet.skin, "neon");
  assert.equal(equipItem(wallet, "aurora", new Set()), false);
  assert.equal(wallet.banner, "no-banner");
});

test("a bought streak freeze covers a missed day so the streak survives", () => {
  // Applied Nov 3 and 4, missed Nov 5, and today is Nov 6.
  const progress = computeProgress(applicationsOn(3, 4), [], { now: NOW });
  assert.equal(progress.currentStreak, 0);
  const missed = daysToFreeze(progress.streakDays, progress.todayKey, 1, previousDayKey);
  assert.deepEqual(missed, ["2026-11-05"]);
  const saved = computeProgress(applicationsOn(3, 4), [], { now: NOW, frozenDays: missed });
  assert.equal(saved.currentStreak, 3);
});

test("freezes aren't used when there aren't enough to save the streak", () => {
  const progress = computeProgress(applicationsOn(2), [], { now: NOW });
  // Missed Nov 3, 4, and 5: three days, but at most two freezes.
  assert.deepEqual(daysToFreeze(progress.streakDays, progress.todayKey, 2, previousDayKey), []);
  // Applied yesterday: nothing to cover.
  const fine = computeProgress(applicationsOn(5), [], { now: NOW });
  assert.deepEqual(daysToFreeze(fine.streakDays, fine.todayKey, 2, previousDayKey), []);
});

test("used freezes are subtracted from the ones the player has", () => {
  const progress = computeProgress(applicationsOn(1, 2, 3, 4, 5, 6), [], { now: NOW });
  const wallet = emptyWallet();
  wallet.purchases.push({ id: STREAK_FREEZE.id, cost: STREAK_FREEZE.cost, at: NOW.toISOString() });
  assert.equal(walletState(progress, wallet).freezes, 1);
  wallet.freezesUsed.push("2026-11-05");
  assert.equal(walletState(progress, wallet).freezes, 0);
});
