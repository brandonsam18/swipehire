// Every cosmetic a player can collect, the locker slots they go in, and the
// item shop's daily rotation. Prices follow rarity; items with no cost can
// only be found in loot chests. Each slot has a free default everyone owns.

export const RARITIES = {
  common: { name: "Common", color: "#9aa1a9", weight: 50 },
  rare: { name: "Rare", color: "#3b82f6", weight: 30 },
  epic: { name: "Epic", color: "#a855f7", weight: 15 },
  legendary: { name: "Legendary", color: "#f59e0b", weight: 5 },
};

// Locker slots, in the order the locker shows them. `walletKey` is where the
// equipped item's id is saved in the wallet.
export const SLOTS = [
  { type: "skin", name: "Card skin", icon: "🃏", walletKey: "skin", defaultId: "standard" },
  { type: "celebration", name: "Celebration", icon: "🎉", walletKey: "celebration", defaultId: "confetti" },
  { type: "banner", name: "Profile banner", icon: "🖼️", walletKey: "banner", defaultId: "no-banner" },
  { type: "theme", name: "Theme", icon: "🎨", walletKey: "theme", defaultId: "teal" },
  { type: "title", name: "Title", icon: "🏷️", walletKey: "title", defaultId: null },
];

export const ITEMS = [
  // Card skins change how the swipe deck's cards look (see .skin-* in styles.css).
  { id: "standard", type: "skin", name: "Standard", rarity: "common", cost: 0, description: "The everyday card." },
  { id: "paper", type: "skin", name: "Paper & Ink", rarity: "common", cost: 150, description: "Notebook paper with a hand-inked edge." },
  { id: "neon", type: "skin", name: "Neon Edge", rarity: "rare", cost: 300, description: "A glowing neon outline on a dark card." },
  { id: "pixel", type: "skin", name: "Pixel Pop", rarity: "rare", cost: 300, description: "Chunky 8-bit borders and a pixel grid." },
  { id: "holo", type: "skin", name: "Holographic", rarity: "epic", cost: 500, description: "A rainbow shimmer that sweeps across the card." },
  { id: "gold-foil", type: "skin", name: "Gold Foil", rarity: "legendary", cost: 800, description: "Gleaming gold trim with a slow shine." },

  // Celebrations play when you apply (see celebrations.js).
  { id: "confetti", type: "celebration", name: "Confetti", rarity: "common", cost: 0, description: "A pop of confetti." },
  { id: "coin-rain", type: "celebration", name: "Coin Rain", rarity: "common", cost: 150, description: "Gold coins shower down the screen." },
  { id: "fireworks", type: "celebration", name: "Fireworks", rarity: "rare", cost: 300, description: "Fireworks burst across the sky." },
  { id: "rocket", type: "celebration", name: "Rocket Launch", rarity: "epic", cost: 500, description: "A rocket blasts off with a sparkling trail." },
  { id: "trophy-dance", type: "celebration", name: "Trophy Dance", rarity: "legendary", cost: 800, description: "A trophy spins and bounces in a ring of stars." },

  // Banners decorate the top of the player card (see .banner-* in styles.css).
  { id: "no-banner", type: "banner", name: "No banner", rarity: "common", cost: 0, description: "A clean player card." },
  { id: "sunset", type: "banner", name: "Sunset", rarity: "common", cost: 150, description: "A warm sun sinking into the horizon." },
  { id: "night-city", type: "banner", name: "Night City", rarity: "rare", cost: 300, description: "A skyline with lit-up windows." },
  { id: "deep-space", type: "banner", name: "Deep Space", rarity: "epic", cost: 500, description: "Stars and a ringed planet." },
  { id: "aurora", type: "banner", name: "Aurora", rarity: "legendary", cost: 800, description: "Northern lights rippling overhead." },

  // Themes swap the app's colors (see [data-palette] in styles.css).
  { id: "teal", type: "theme", name: "Teal & Chiffon", rarity: "common", cost: 0, description: "The default colors.", swatch: ["#3d8d7a", "#fffacd"] },
  { id: "ocean", type: "theme", name: "Dreamy & Ocean", rarity: "rare", cost: 300, description: "Soft gray and deep blue-teal.", swatch: ["#006989", "#eaebed"] },
  { id: "classic", type: "theme", name: "Classic Arcade", rarity: "epic", cost: 500, description: "The original purple and cyan.", swatch: ["#8b5cf6", "#22d3ee"] },

  // Titles show under the player's level.
  { id: "offer-hunter", type: "title", name: "Offer Hunter", rarity: "common", cost: 100, description: "Shown under your level." },
  { id: "cover-letter-wizard", type: "title", name: "Cover Letter Wizard", rarity: "common", cost: 150, description: "Shown under your level." },
  { id: "resume-royalty", type: "title", name: "Résumé Royalty", rarity: "rare", cost: 200, description: "Shown under your level." },
  { id: "swipe-master", type: "title", name: "Swipe Master", rarity: "rare", cost: 250, description: "Shown under your level." },
  { id: "lucky-swiper", type: "title", name: "Lucky Swiper", rarity: "legendary", cost: null, description: "Found only in loot chests." },
];

const ITEMS_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

export function itemById(itemId) {
  return ITEMS_BY_ID.get(itemId) ?? null;
}

export function slotFor(type) {
  return SLOTS.find((slot) => slot.type === type);
}

/** Items every player owns from the start: each slot's free default. */
export const DEFAULT_ITEM_IDS = ITEMS.filter((item) => item.cost === 0).map((item) => item.id);

// Items the shop can sell: not free, and not chest-only.
const SHOP_ITEMS = ITEMS.filter((item) => item.cost > 0);
export const FEATURED_COUNT = 2;
export const DAILY_COUNT = 4;

// A small seeded random number generator, so a given day always gets the same shop.
function seededRandom(seedText) {
  let seed = 0;
  for (const character of seedText) seed = (seed * 31 + character.charCodeAt(0)) | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom(items, count, random) {
  const pool = [...items];
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picked;
}

/**
 * The item shop for one day ("YYYY-MM-DD"): featured Epic and Legendary items
 * and daily Common and Rare ones. Everyone sees the same shop on the same day.
 */
export function shopRotation(dayKeyText) {
  const random = seededRandom(`swipehire-shop-${dayKeyText}`);
  const isPremium = (item) => item.rarity === "epic" || item.rarity === "legendary";
  return {
    featured: pickRandom(SHOP_ITEMS.filter(isPremium), FEATURED_COUNT, random).map((item) => item.id),
    daily: pickRandom(SHOP_ITEMS.filter((item) => !isPremium(item)), DAILY_COUNT, random).map((item) => item.id),
  };
}

/**
 * Picks a cosmetic for a loot chest, favoring common rarities, from the items
 * the player doesn't own yet. Returns null when they own everything.
 */
export function pickChestItem(ownedIds, random) {
  const candidates = ITEMS.filter((item) => item.cost !== 0 && !ownedIds.has(item.id));
  const totalWeight = candidates.reduce((total, item) => total + RARITIES[item.rarity].weight, 0);
  let roll = random() * totalWeight;
  for (const item of candidates) {
    roll -= RARITIES[item.rarity].weight;
    if (roll < 0) return item.id;
  }
  return candidates.at(-1)?.id ?? null;
}
