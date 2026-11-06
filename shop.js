// Coins, the item shop, and loot chests. Like XP, coins earned are worked out
// from the player's activity, so un-marking an application takes its coins
// back. The wallet only records what the player did with them: purchases,
// opened chests (with their prize), streak freezes used, and what's equipped.

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
export const DEFAULT_THEME_ID = "teal";

export const STREAK_FREEZE = {
  id: "streak-freeze",
  icon: "🧊",
  name: "Streak freeze",
  description: "Miss a day without losing your streak. Used automatically.",
  cost: 150,
};

// Themes swap the app's colors (see the [data-palette] rules in styles.css).
export const THEMES = [
  { id: DEFAULT_THEME_ID, name: "Teal & Chiffon", cost: 0, swatch: ["#3d8d7a", "#fffacd"] },
  { id: "ocean", name: "Dreamy & Ocean", cost: 300, swatch: ["#006989", "#eaebed"] },
  { id: "classic", name: "Classic Arcade", cost: 500, swatch: ["#8b5cf6", "#22d3ee"] },
];

// Titles show under the player's level. Chest-only titles can't be bought.
export const TITLES = [
  { id: "offer-hunter", name: "Offer Hunter", cost: 100 },
  { id: "cover-letter-wizard", name: "Cover Letter Wizard", cost: 150 },
  { id: "resume-royalty", name: "Résumé Royalty", cost: 200 },
  { id: "swipe-master", name: "Swipe Master", cost: 250 },
  { id: "lucky-swiper", name: "Lucky Swiper", cost: null },
];

const BUYABLE_ITEMS = [STREAK_FREEZE, ...THEMES.filter((theme) => theme.cost > 0), ...TITLES.filter((title) => title.cost)];

export function emptyWallet() {
  return { purchases: [], chests: [], freezesUsed: [], theme: DEFAULT_THEME_ID, title: null };
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
  const ownedIds = new Set([DEFAULT_THEME_ID]);
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

/** Buys an item, recording it in the wallet. Returns false if it can't be bought. */
export function buyItem(itemId, progress, wallet, now = new Date()) {
  const item = BUYABLE_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item || purchaseBlocker(item, walletState(progress, wallet))) return false;
  wallet.purchases.push({ id: item.id, cost: item.cost, at: now.toISOString() });
  return true;
}

/**
 * Picks a chest prize. Coins are most common; a freeze, title, or theme the
 * player doesn't have yet turns into coins if they already have it.
 * @param random a function returning a number in [0, 1), like Math.random
 */
export function rollChestPrize(state, random = Math.random) {
  const coinPrize = (min, max) => ({ coins: min + Math.floor(random() * ((max - min) / 10 + 1)) * 10 });
  const roll = random();
  if (roll < 0.55) return coinPrize(40, 120);
  if (roll < 0.75) {
    return state.freezes < MAX_STREAK_FREEZES ? { itemId: STREAK_FREEZE.id } : coinPrize(80, 150);
  }
  if (roll < 0.93) {
    const newTitles = TITLES.filter((title) => !state.ownedIds.has(title.id));
    return newTitles.length > 0 ? { itemId: newTitles[Math.floor(random() * newTitles.length)].id } : coinPrize(100, 200);
  }
  const newThemes = THEMES.filter((theme) => !state.ownedIds.has(theme.id));
  return newThemes.length > 0 ? { itemId: newThemes[Math.floor(random() * newThemes.length)].id } : coinPrize(200, 300);
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
  const theme = THEMES.find((candidate) => candidate.id === prize.itemId);
  if (theme) return { icon: "🎨", text: `The ${theme.name} theme` };
  const title = TITLES.find((candidate) => candidate.id === prize.itemId);
  return { icon: "🏷️", text: `The title “${title?.name ?? prize.itemId}”` };
}

export function titleName(titleId) {
  return TITLES.find((title) => title.id === titleId)?.name ?? null;
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
