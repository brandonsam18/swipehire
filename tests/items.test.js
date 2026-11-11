import assert from "node:assert/strict";
import { test } from "node:test";
import { DAILY_COUNT, DEFAULT_ITEM_IDS, FEATURED_COUNT, ITEMS, SLOTS, itemById, pickChestItem, shopRotation } from "../items.js";

test("every locker slot has a free default item everyone owns", () => {
  for (const slot of SLOTS.filter((candidate) => candidate.defaultId)) {
    assert.ok(DEFAULT_ITEM_IDS.includes(slot.defaultId), `${slot.type} default should be free`);
    assert.equal(itemById(slot.defaultId).type, slot.type);
  }
});

test("the shop is the same all day and changes from one day to the next", () => {
  assert.deepEqual(shopRotation("2026-11-11"), shopRotation("2026-11-11"));
  const week = ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"].map((day) => JSON.stringify(shopRotation(day)));
  assert.ok(new Set(week).size > 1, "a week of shops shouldn't all be identical");
});

test("featured items are Epic or Legendary, daily items Common or Rare, and all can be bought", () => {
  for (const day of ["2026-11-11", "2026-12-25", "2027-03-01"]) {
    const { featured, daily } = shopRotation(day);
    assert.equal(featured.length, FEATURED_COUNT);
    assert.equal(daily.length, DAILY_COUNT);
    assert.equal(new Set([...featured, ...daily]).size, FEATURED_COUNT + DAILY_COUNT);
    for (const id of featured) assert.ok(["epic", "legendary"].includes(itemById(id).rarity));
    for (const id of daily) assert.ok(["common", "rare"].includes(itemById(id).rarity));
    for (const id of [...featured, ...daily]) assert.ok(itemById(id).cost > 0, `${id} should have a price`);
  }
});

test("chests only drop items the player doesn't own, and nothing once they own everything", () => {
  const ownsAllButAurora = new Set(ITEMS.map((item) => item.id).filter((id) => id !== "aurora"));
  assert.equal(pickChestItem(ownsAllButAurora, () => 0.5), "aurora");
  assert.equal(pickChestItem(new Set(ITEMS.map((item) => item.id)), () => 0.5), null);
});

test("chest drops favor common items over legendary ones", () => {
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const counts = { common: 0, legendary: 0 };
  for (let draw = 0; draw < 2000; draw++) {
    const rarity = itemById(pickChestItem(new Set(DEFAULT_ITEM_IDS), random)).rarity;
    if (rarity in counts) counts[rarity] += 1;
  }
  assert.ok(counts.common > counts.legendary * 2, `common ${counts.common} vs legendary ${counts.legendary}`);
});
