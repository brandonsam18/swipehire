// The shop window: the Item shop tab (loot chests, today's featured and daily
// items, power-ups) and the Locker tab (equip what you own in each slot).
// The rules live in shop.js and the items in items.js; this file draws them.
import { activity } from "./activity.js";
import { burstConfetti, showToast } from "./celebrate.js";
import { playCelebration } from "./celebrations.js";
import { setTextWithCoins } from "./coin-icon.js";
import { dayKey } from "./game.js";
import { ITEMS, RARITIES, SLOTS, itemById, shopRotation } from "./items.js";
import {
  MAX_STREAK_FREEZES,
  STREAK_FREEZE,
  buyItem,
  describePrize,
  equipItem,
  openChest,
  purchaseBlocker,
  removeTitle,
  walletState,
} from "./shop.js";

const CHEST_OPENING_MS = 650;

const shopDialog = document.getElementById("shop-dialog");
const shopTabs = shopDialog.querySelectorAll(".shop-tab");

let getProgress = () => null;
let onWalletChange = () => {};
// The last chest's prize stays on screen until the shop closes.
let chestRevealText = null;
let selectedTab = "shop";

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createButton(text, onClick, { disabled = false, primary = false } = {}) {
  const button = createElement("button", `button ${primary ? "applied-button" : "button-secondary"}`);
  button.type = "button";
  button.disabled = disabled;
  setTextWithCoins(button, text);
  button.addEventListener("click", onClick);
  return button;
}

// A small picture of what an item does: a mini card, banner, swatch, or icon.
function createPreview(item) {
  const preview = createElement("div", `item-preview preview-${item.type}`);
  preview.setAttribute("aria-hidden", "true");
  if (item.type === "skin") {
    const card = createElement("div", `mini-card skin-${item.id}`);
    card.append(createElement("span", "mini-card-line"), createElement("span", "mini-card-line short"));
    preview.append(card);
  } else if (item.type === "banner") {
    preview.append(createElement("div", `mini-banner banner-${item.id}`));
  } else if (item.type === "theme") {
    const swatch = createElement("div", "theme-swatch");
    for (const color of item.swatch) {
      const half = createElement("span");
      half.style.background = color;
      swatch.append(half);
    }
    preview.append(swatch);
  } else {
    const slot = SLOTS.find((candidate) => candidate.type === item.type);
    preview.append(createElement("span", "preview-icon", item.type === "title" ? "🏷️" : slot.icon));
  }
  return preview;
}

function createItemTile(item, actionButton, { owned = false, equipped = false } = {}) {
  const rarity = RARITIES[item.rarity];
  const tile = createElement("li", `item-tile rarity-${item.rarity}${equipped ? " equipped" : ""}`);
  tile.style.setProperty("--rarity", rarity.color);
  const slot = SLOTS.find((candidate) => candidate.type === item.type);
  const label = createElement("p", "item-rarity", `${rarity.name} ${slot.name.toLowerCase()}`);
  const name = createElement("p", "item-name", item.name);
  const description = createElement("p", "item-description", item.description);
  tile.append(createPreview(item), label, name, description);
  if (item.type === "celebration") {
    tile.append(createButton("▶ Preview", () => playCelebration(item.id)));
  }
  if (owned && !equipped) tile.append(createElement("p", "item-owned", "✓ In your locker"));
  tile.append(actionButton);
  return tile;
}

function createShopTile(itemId, wallet) {
  const item = itemById(itemId);
  const owned = wallet.ownedIds.has(item.id);
  const blocker = purchaseBlocker(item, wallet);
  const button = owned
    ? createButton("Owned", () => {}, { disabled: true })
    : createButton(blocker ?? `Buy · ${item.cost} 🪙`, () => handleBuy(item), { disabled: Boolean(blocker), primary: !blocker });
  return createItemTile(item, button, { owned });
}

function timeUntilMidnight(now = new Date()) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const minutes = Math.max(1, Math.round((midnight - now) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function renderChestStage(wallet) {
  const stage = document.getElementById("chest-stage");
  if (stage.classList.contains("opening")) return;
  stage.classList.toggle("has-chest", wallet.chestsAvailable > 0);
  document.getElementById("chest-text").textContent =
    wallet.chestsAvailable > 0
      ? `You have ${wallet.chestsAvailable} chest${wallet.chestsAvailable === 1 ? "" : "s"} to open!`
      : `Next chest in ${wallet.applicationsToNextChest} application${wallet.applicationsToNextChest === 1 ? "" : "s"}, or finish all 3 daily quests.`;
  document.getElementById("open-chest-button").disabled = wallet.chestsAvailable === 0;
  const prizeText = document.getElementById("chest-prize");
  prizeText.hidden = !chestRevealText;
  setTextWithCoins(prizeText, chestRevealText ?? "");
}

function renderItemShop(wallet) {
  renderChestStage(wallet);
  const rotation = shopRotation(dayKey(new Date()));
  document.getElementById("shop-refresh").textContent = `New items in ${timeUntilMidnight()}`;
  document.getElementById("featured-list").replaceChildren(...rotation.featured.map((id) => createShopTile(id, wallet)));
  document.getElementById("daily-list").replaceChildren(...rotation.daily.map((id) => createShopTile(id, wallet)));

  const freezeBlocker = purchaseBlocker(STREAK_FREEZE, wallet);
  const freezeItem = createElement("li", "shop-item");
  const info = createElement("div", "shop-item-info");
  info.append(
    createElement("p", "shop-item-name", STREAK_FREEZE.name),
    createElement("p", "shop-item-detail", `${STREAK_FREEZE.description} You have ${wallet.freezes} of ${MAX_STREAK_FREEZES}.`),
  );
  freezeItem.append(
    createElement("span", "shop-item-icon", STREAK_FREEZE.icon),
    info,
    createButton(freezeBlocker ?? `Buy · ${STREAK_FREEZE.cost} 🪙`, () => handleBuy(STREAK_FREEZE), {
      disabled: Boolean(freezeBlocker),
      primary: !freezeBlocker,
    }),
  );
  document.getElementById("freeze-list").replaceChildren(freezeItem);
}

function renderLocker(wallet) {
  const sections = SLOTS.map((slot) => {
    const owned = ITEMS.filter((item) => item.type === slot.type && wallet.ownedIds.has(item.id));
    const total = ITEMS.filter((item) => item.type === slot.type).length;
    const section = createElement("section", "locker-slot");
    const heading = createElement("h3", "shop-section-title", `${slot.icon} ${slot.name} · ${owned.length}/${total} collected`);
    const list = createElement("ul", "item-grid");
    const equippedId = activity.wallet[slot.walletKey];
    for (const item of owned) {
      const equipped = equippedId === item.id;
      const button =
        slot.type === "title" && equipped
          ? createButton("Take off", () => handleRemoveTitle())
          : createButton(equipped ? "Equipped" : "Equip", () => handleEquip(item), { disabled: equipped, primary: !equipped });
      list.append(createItemTile(item, button, { equipped }));
    }
    if (owned.length === 0) {
      list.append(createElement("li", "locker-empty", "Nothing here yet. Check the item shop or open a chest."));
    }
    section.append(heading, list);
    return section;
  });
  document.getElementById("locker-slots").replaceChildren(...sections);
}

/** Redraws the open tab with the player's current coins and items (only while the shop is open). */
export function renderShop() {
  const progress = getProgress();
  if (!progress || !shopDialog.open) return;
  const wallet = walletState(progress, activity.wallet);
  setTextWithCoins(document.getElementById("shop-coins"), `🪙 ${Math.max(0, wallet.coins)}`);
  for (const tab of shopTabs) tab.setAttribute("aria-selected", String(tab.dataset.tab === selectedTab));
  document.getElementById("item-shop-panel").hidden = selectedTab !== "shop";
  document.getElementById("locker-panel").hidden = selectedTab !== "locker";
  if (selectedTab === "shop") renderItemShop(wallet);
  else renderLocker(wallet);
}

function handleBuy(item) {
  const progress = getProgress();
  if (!buyItem(item.id, progress, activity.wallet)) return;
  // Bought looks are put on right away, so buying one shows what it does.
  if (item.id !== STREAK_FREEZE.id) equipItem(activity.wallet, item.id, walletState(progress, activity.wallet).ownedIds);
  showToast(`🛒 Bought ${item.name}  −${item.cost} 🪙`, "info");
  if (item.type === "celebration") playCelebration(item.id);
  onWalletChange();
}

function handleEquip(item) {
  equipItem(activity.wallet, item.id, walletState(getProgress(), activity.wallet).ownedIds);
  if (item.type === "celebration") playCelebration(item.id);
  onWalletChange();
}

function handleRemoveTitle() {
  removeTitle(activity.wallet);
  onWalletChange();
}

function handleOpenChest() {
  const stage = document.getElementById("chest-stage");
  if (stage.classList.contains("opening")) return;
  document.getElementById("open-chest-button").disabled = true;
  stage.classList.remove("revealed");
  stage.classList.add("opening");
  chestRevealText = null;
  document.getElementById("chest-prize").hidden = true;
  setTimeout(() => {
    stage.classList.remove("opening");
    const prize = openChest(getProgress(), activity.wallet);
    if (!prize) {
      renderShop();
      return;
    }
    const { icon, text } = describePrize(prize);
    chestRevealText = `${icon} You got: ${text}!`;
    stage.classList.add("revealed");
    burstConfetti();
    showToast(`🎁 Chest opened: ${text}!`, "trophy");
    onWalletChange();
  }, CHEST_OPENING_MS);
}

function selectTab(tab) {
  selectedTab = tab;
  renderShop();
}

/** Opens the shop window on a tab ("shop" or "locker"). */
export function openShop(tab = "shop") {
  chestRevealText = null;
  document.getElementById("chest-stage").classList.remove("revealed");
  selectedTab = tab;
  shopDialog.showModal();
  renderShop();
}

/**
 * Wires up the shop window. `progressSource()` returns the player's current
 * game progress; `walletChanged()` runs after any purchase, equip, or chest.
 */
export function setUpShop({ progressSource, walletChanged }) {
  getProgress = progressSource;
  onWalletChange = walletChanged;
  for (const tab of shopTabs) tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  document.getElementById("shop-close").addEventListener("click", () => shopDialog.close());
  document.getElementById("open-chest-button").addEventListener("click", handleOpenChest);
  shopDialog.addEventListener("click", (event) => {
    if (event.target === shopDialog) shopDialog.close();
  });
}
