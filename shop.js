// Coins, buying, loot chests, and equipping. Like XP, coins earned are worked
// out from the player's activity, so un-marking an application takes its coins
// back. The wallet only records what the player did with them: purchases,
// opened chests (with their prize), streak freezes used, and what's equipped.
// The items themselves are listed in items.js.
import { dayKey } from "./game.js";
import { DEFAULT_ITEM_IDS, RARITIES, SLOTS, itemById, pickChestItem, shopRotation, slotFor } from "./items.js";

export const COINS = {
  perApplication: 10,
  freshBonus: 5,
  perSave: 2,
  perQuest: 25,
  perTrophy: 50,
  perLevelUp: 100,
};

export const APPLICATIONS_PER_CHEST = 5;
export const MAX_STREAK_FREEZES = 2;
export const STREAK_FREEZE = {
  id: "streak-freeze",
  icon: "🧊",
  name: "Streak freeze",
  description: "Miss a day without losing your streak. Used automatically.",
  cost: 150,
};

export function emptyWallet() {
  const equipped = Object.fromEntries(SLOTS.map((slot) => [slot.walletKey, slot.defaultId]));
  return { purchases: [], chests: [], freezesUsed: [], ...equipped };
}

/** Coins earned from playing, before anything is spent. */
export function coinsEarned(progress) {
  return (
    progress.applicationCount * COINS.perApplication +
    progress.freshCount * COINS.freshBonus +
    progress.saveCount * COINS.perSave +
    progress.questCompletions * COINS.perQuest +
    progress.trophyCount * COINS.perTrophy +
    (progress.level - 1) * COINS.perLevelUp
  );
}

/** Chests earned: one per 5 applications, plus one for each day all daily quests were done. */
export function chestsEarned(progress) {
  return Math.floor(progress.applicationCount / APPLICATIONS_PER_CHEST) + progress.perfectQuestDays;
}

/** Everything the shop needs to show: balance, chests, freezes, and owned items. */
export function walletState(progress, wallet) {
  const spent = wallet.purchases.reduce((total, purchase) => total + purchase.cost, 0);
  const chestCoins = wallet.chests.reduce((total, chest) => total + (chest.prize.coins ?? 0), 0);
  const ownedIds = new Set(DEFAULT_ITEM_IDS);
  let freezesGained = 0;
  for (const itemId of [...wallet.purchases.map((purchase) => purchase.id), ...wallet.chests.map((chest) => chest.prize.itemId)]) {
    if (itemId === STREAK_FREEZE.id) freezesGained += 1;
    else if (itemId) ownedIds.add(itemId);
  }
  return {
    coins: coinsEarned(progress) + chestCoins - spent,
    chestsAvailable: Math.max(0, chestsEarned(progress) - wallet.chests.length),
    applicationsToNextChest: APPLICATIONS_PER_CHEST - (progress.applicationCount % APPLICATIONS_PER_CHEST),
    freezes: Math.max(0, freezesGained - wallet.freezesUsed.length),
    ownedIds,
  };
}

/** Why an item can't be bought right now, or null if it can. */
export function purchaseBlocker(item, state) {
  if (item.id === STREAK_FREEZE.id) {
    if (state.freezes >= MAX_STREAK_FREEZES) return `You can hold ${MAX_STREAK_FREEZES}`;
  } else if (state.ownedIds.has(item.id)) {
    return "Owned";
  }
  if (state.coins < item.cost) return `Need ${item.cost - state.coins} more`;
  return null;
}

/** Whether an item is for sale on this day: streak freezes always are, cosmetics only in that day's shop. */
export function isForSale(itemId, now = new Date()) {
  if (itemId === STREAK_FREEZE.id) return true;
  const { featured, daily } = shopRotation(dayKey(now));
  return featured.includes(itemId) || daily.includes(itemId);
}

/** Buys an item, recording it in the wallet. Returns false if it can't be bought. */
export function buyItem(itemId, progress, wallet, now = new Date()) {
  const item = itemId === STREAK_FREEZE.id ? STREAK_FREEZE : itemById(itemId);
  if (!item || !item.cost || !isForSale(itemId, now)) return false;
  if (purchaseBlocker(item, walletState(progress, wallet))) return false;
  wallet.purchases.push({ id: item.id, cost: item.cost, at: now.toISOString() });
  return true;
}

/**
 * Picks a chest prize: coins half the time, otherwise a streak freeze or a
 * cosmetic the player doesn't have yet (common ones more often than legendary).
 * Anything the player can't use turns into coins.
 * @param random a function returning a number in [0, 1), like Math.random
 */
export function rollChestPrize(state, random = Math.random) {
  const coinPrize = (min, max) => ({ coins: min + Math.floor(random() * ((max - min) / 10 + 1)) * 10 });
  const roll = random();
  if (roll < 0.5) return coinPrize(40, 120);
  if (roll < 0.65) {
    return state.freezes < MAX_STREAK_FREEZES ? { itemId: STREAK_FREEZE.id } : coinPrize(80, 150);
  }
  const itemId = pickChestItem(state.ownedIds, random);
  return itemId ? { itemId } : coinPrize(200, 300);
}

/** Opens one chest, recording its prize. Returns the prize, or null if no chest is waiting. */
export function openChest(progress, wallet, random = Math.random, now = new Date()) {
  const state = walletState(progress, wallet);
  if (state.chestsAvailable === 0) return null;
  const prize = rollChestPrize(state, random);
  wallet.chests.push({ at: now.toISOString(), prize });
  return prize;
}

/** A short description of a prize, for the reveal and pop-ups. */
export function describePrize(prize) {
  if (prize.coins) return { icon: "🪙", text: `${prize.coins} coins` };
  if (prize.itemId === STREAK_FREEZE.id) return { icon: STREAK_FREEZE.icon, text: "A streak freeze" };
  const item = itemById(prize.itemId);
  if (!item) return { icon: "🎁", text: "A mystery item" };
  const slot = slotFor(item.type);
  return { icon: slot.icon, text: `${RARITIES[item.rarity].name} ${slot.name.toLowerCase()}: ${item.name}` };
}

export function titleName(titleId) {
  return itemById(titleId)?.name ?? null;
}

/** Equips an owned item in its locker slot. Returns false if the player doesn't own it. */
export function equipItem(wallet, itemId, ownedIds) {
  const item = itemById(itemId);
  if (!item || !ownedIds.has(itemId)) return false;
  wallet[slotFor(item.type).walletKey] = itemId;
  return true;
}

/** Takes off the player's title (titles are the one slot that can be left empty). */
export function removeTitle(wallet) {
  wallet[slotFor("title").walletKey] = null;
}

/**
 * Days that streak freezes should cover so the current streak survives: the
 * missed days just before today, if the player applied on the day before
 * them and has a freeze for each. Returns [] when nothing needs covering.
 * @param activeDays Set of "YYYY-MM-DD" days with an application (or a freeze already used)
 */
export function daysToFreeze(activeDays, todayKey, freezes, previousDayKey) {
  const missed = [];
  let day = previousDayKey(todayKey);
  while (!activeDays.has(day)) {
    missed.push(day);
    if (missed.length > freezes) return [];
    day = previousDayKey(day);
  }
  return missed;
}

/** Coins earned by one application, for the "+coins" pop-up. */
export function applicationCoins(application) {
  return COINS.perApplication + (application.fresh ? COINS.freshBonus : 0);
}
