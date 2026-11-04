import { accountsAvailable, logOut, watchUser } from "./account.js";
import {
  activity,
  flushCloudSave,
  guestActivitySummary,
  saveActivity,
  setSyncStatusListener,
  useAccount,
  useGuest,
} from "./activity.js";
import { burstConfetti, showToast } from "./celebrate.js";
import { renderDeck, swipeTopCard } from "./deck.js";
import { ACHIEVEMENTS, FRESH_POSTING_DAYS, XP_PER_SAVE, applicationXp, computeProgress } from "./game.js";
import { METRO_AREAS, STATE_NAMES, isRemoteUs, metroIdOf, stateCodeOf } from "./locations.js";
import { guessCompanyDomain, logoUrl } from "./logos.js";
import { ROLES, roleIdsOf } from "./roles.js";
import { setUpThemeToggle } from "./theme.js";
import {
  hideSplash,
  isSplashOpen,
  setLoadingStatus,
  setUpWelcomeScreen,
  showLoadingError,
  showLoadingScreen,
  showWelcomeScreen,
} from "./welcome.js";

const LISTINGS_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json";
const STORAGE_KEYS = {
  viewMode: "viewMode",
  playingAsGuest: "playingAsGuest",
};
const PAGE_SIZE = 50;
const SKELETON_CARD_COUNT = 6;
// Smaller icons are blurry when scaled up, so those companies keep their letter.
const MIN_LOGO_PIXELS = 32;
const AVATAR_COLORS = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#db2777", "#7c3aed", "#2563eb", "#dc2626"];

const searchInput = document.getElementById("search-input");
const filtersToggle = document.getElementById("filters-toggle");
const activeFilterCount = document.getElementById("active-filter-count");
const filterPanel = document.getElementById("filter-panel");
const locationSelect = document.getElementById("location-select");
const roleSelect = document.getElementById("role-select");
const degreeSelect = document.getElementById("degree-select");
const termSelect = document.getElementById("term-select");
const modeTabs = document.querySelectorAll(".mode-tab");
const discoverView = document.getElementById("discover-view");
const browseView = document.getElementById("browse-view");
const deck = document.getElementById("deck");
const deckCount = document.getElementById("deck-count");
const deckButtons = document.querySelectorAll(".deck-button[data-direction]");
const undoButton = document.getElementById("undo-button");
const statusTabs = document.querySelectorAll(".tab");
const summary = document.getElementById("summary");
const listMessage = document.getElementById("list-message");
const postingList = document.getElementById("posting-list");
const showMoreButton = document.getElementById("show-more-button");
const trophyDialog = document.getElementById("trophy-dialog");
const accountButton = document.getElementById("account-button");
const accountDialog = document.getElementById("account-dialog");
const syncStatus = document.getElementById("sync-status");

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Only conveniences (view mode, guest choice) are stored this way; they just won't be remembered.
  }
}

let allPostings = [];
let postingsLoaded = false;
// Each maps posting id -> what happened (see activity.js).
const appliedPostings = activity.applied;
const savedPostings = activity.saved;
const passedPostings = activity.passed;
let currentUser = null;
let userKnown = false;
let startupDone = false;
let viewMode = loadJson(STORAGE_KEYS.viewMode, "discover") === "browse" ? "browse" : "discover";
let statusFilter = "all";
let visibleCount = PAGE_SIZE;
const undoStack = [];
let progress = null;

// ---------- Helpers ----------

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function postingAgeDays(posting) {
  return (Date.now() / 1000 - posting.date_posted) / 86400;
}

function formatPostedAge(posting) {
  const days = Math.floor(postingAgeDays(posting));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDate(new Date(posting.date_posted * 1000));
}

function avatarColor(companyName) {
  let hash = 0;
  for (const character of companyName) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ---------- Filters ----------

function matchesFilters(posting) {
  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    const text = `${posting.company_name} ${posting.title}`.toLowerCase();
    if (!text.includes(query)) return false;
  }

  // Location values look like "all", "remote", "metro:<id>", or "state:<code>".
  const [locationKind, locationValue] = locationSelect.value.split(":");
  if (locationKind === "remote" && !posting.isRemoteUs) return false;
  if (locationKind === "metro" && !posting.metroIds.has(locationValue)) return false;
  if (locationKind === "state" && !posting.stateCodes.has(locationValue)) return false;

  if (roleSelect.value !== "all" && !posting.roleIds.has(roleSelect.value)) return false;
  if (termSelect.value !== "all" && !posting.terms.includes(termSelect.value)) return false;
  // Postings that don't list a degree aren't ruled out, so they match every degree.
  if (degreeSelect.value !== "all" && posting.degrees.length > 0 && !posting.degrees.includes(degreeSelect.value)) {
    return false;
  }
  return true;
}

function matchesStatus(posting) {
  if (statusFilter === "applied") return posting.id in appliedPostings;
  if (statusFilter === "saved") return posting.id in savedPostings && !(posting.id in appliedPostings);
  return true;
}

// Postings you haven't applied to, saved, or passed on yet.
function isUnseen(posting) {
  return !(posting.id in appliedPostings) && !(posting.id in savedPostings) && !(posting.id in passedPostings);
}

function updateFilterCount() {
  const activeCount = [roleSelect, locationSelect, degreeSelect, termSelect].filter((select) => select.value !== "all").length;
  activeFilterCount.textContent = String(activeCount);
  activeFilterCount.hidden = activeCount === 0;
}

// ---------- Posting pieces shared by cards and list ----------

// Colored first letter, replaced by the company's logo once it loads.
function createAvatar(posting) {
  const avatar = createElement("div", "avatar");
  avatar.style.backgroundColor = avatarColor(posting.company_name);
  avatar.setAttribute("aria-hidden", "true");
  avatar.append(createElement("span", "avatar-letter", posting.company_name.trim().charAt(0).toUpperCase()));

  const domain = guessCompanyDomain(posting.company_name, posting.url);
  if (!domain) return avatar;
  // The logo stays invisible in the badge until it loads, so a missing logo never shows as a broken image.
  const logo = createElement("img", "avatar-logo");
  logo.alt = "";
  logo.loading = "lazy";
  logo.addEventListener("load", () => {
    if (logo.naturalWidth < MIN_LOGO_PIXELS) return;
    avatar.classList.add("has-logo");
    avatar.style.backgroundColor = "";
  });
  logo.src = logoUrl(domain);
  avatar.append(logo);
  return avatar;
}

function createTag(text, variant = "") {
  return createElement("span", `tag ${variant}`.trim(), text);
}

// Short tag text for the degrees a posting accepts, or null if it doesn't list any.
function degreeTagText(degrees) {
  if (degrees.length === 0) return null;
  if (degrees.length === 1 && degrees[0] !== "Bachelor's") return `${degrees[0]} only`;
  return degrees.join(" · ");
}

const SPONSORSHIP_TAGS = {
  "Does Not Offer Sponsorship": "No visa sponsorship",
  "U.S. Citizenship is Required": "U.S. citizens only",
  "Offers Sponsorship": "Sponsors visas",
};

function createTags(posting) {
  const tags = createElement("div", "tags");
  const locationText =
    posting.locations.length > 2
      ? `${posting.locations.slice(0, 2).join(" · ")} +${posting.locations.length - 2} more`
      : posting.locations.join(" · ");
  if (locationText) tags.append(createTag(locationText));
  for (const term of posting.terms.filter((term) => term !== "N/A")) {
    tags.append(createTag(term));
  }
  const degreeText = degreeTagText(posting.degrees);
  if (degreeText) {
    const acceptsBachelors = posting.degrees.includes("Bachelor's") || posting.degrees.includes("Associate's");
    tags.append(createTag(`🎓 ${degreeText}`, acceptsBachelors ? "tag-requirement" : "tag-warning"));
  }
  const sponsorshipText = SPONSORSHIP_TAGS[posting.sponsorship];
  if (sponsorshipText) tags.append(createTag(sponsorshipText, "tag-warning"));
  if (postingAgeDays(posting) < FRESH_POSTING_DAYS) tags.append(createTag("✨ Fresh · +25 XP", "tag-new"));
  return tags;
}

function createApplyLink(posting, className) {
  const applyLink = createElement("a", className, "Apply ↗");
  applyLink.href = posting.url;
  applyLink.target = "_blank";
  applyLink.rel = "noopener";
  applyLink.setAttribute(
    "aria-label",
    `Apply to ${posting.title} at ${posting.company_name} (opens in a new tab and tracks it as applied)`,
  );
  // Opening the application tracks it automatically, so nobody has to come back and press "Mark applied".
  applyLink.addEventListener("click", () => {
    if (posting.id in appliedPostings) return;
    markApplied(posting);
    afterActivityChange();
  });
  return applyLink;
}

// ---------- Actions ----------

function markApplied(posting) {
  const application = {
    at: new Date().toISOString(),
    fresh: postingAgeDays(posting) < FRESH_POSTING_DAYS,
    roleIds: [...posting.roleIds],
    metroIds: [...posting.metroIds],
  };
  appliedPostings[posting.id] = application;
  showToast(`✓ Applied to ${posting.company_name}  +${applicationXp(application)} XP`, "xp");
}

function markSaved(posting) {
  savedPostings[posting.id] = new Date().toISOString();
  showToast(`★ Saved ${posting.company_name}  +${XP_PER_SAVE} XP`, "xp");
}

function afterActivityChange() {
  render();
  updateGame({ celebrate: true });
  saveActivity();
}

function toggleApplied(posting) {
  if (posting.id in appliedPostings) {
    delete appliedPostings[posting.id];
  } else {
    markApplied(posting);
  }
  afterActivityChange();
}

function toggleSaved(posting) {
  if (posting.id in savedPostings) {
    delete savedPostings[posting.id];
  } else {
    markSaved(posting);
  }
  afterActivityChange();
}

const SWIPE_ACTIONS = {
  left: { store: passedPostings, act: (posting) => (passedPostings[posting.id] = new Date().toISOString()) },
  right: { store: savedPostings, act: markSaved },
  up: { store: appliedPostings, act: markApplied },
};

function handleSwipe(posting, direction) {
  SWIPE_ACTIONS[direction].act(posting);
  undoStack.push({ posting, direction });
  afterActivityChange();
}

function undoLastSwipe() {
  const last = undoStack.pop();
  if (!last) return;
  delete SWIPE_ACTIONS[last.direction].store[last.posting.id];
  showToast(`↩ Brought back ${last.posting.company_name}`, "info");
  afterActivityChange();
}

// ---------- Game HUD ----------

function renderQuests(quests) {
  const questList = document.getElementById("quest-list");
  questList.replaceChildren(
    ...quests.map((quest) => {
      const item = createElement("li", `quest${quest.done ? " done" : ""}`);
      const label = createElement("div", "quest-label");
      label.append(
        createElement("span", "quest-icon", quest.done ? "✅" : quest.icon),
        createElement("span", "quest-name", quest.name),
        createElement("span", "quest-reward", `+${quest.xp} XP`),
      );
      const bar = createElement("div", "quest-bar");
      const fill = createElement("div", "quest-fill");
      fill.style.width = `${(quest.progress / quest.target) * 100}%`;
      bar.append(fill);
      item.append(label, bar, createElement("span", "quest-count", `${quest.progress} / ${quest.target}`));
      return item;
    }),
  );
}

function renderTrophies(achievements) {
  const grid = document.getElementById("trophy-grid");
  grid.replaceChildren(
    ...achievements.map((achievement) => {
      const item = createElement("li", `trophy${achievement.unlocked ? " unlocked" : ""}`);
      item.append(
        createElement("span", "trophy-icon", achievement.unlocked ? achievement.icon : "🔒"),
        createElement("span", "trophy-name", achievement.name),
        createElement("span", "trophy-description", achievement.description),
        createElement("span", "trophy-reward", `+${achievement.xp} XP`),
      );
      return item;
    }),
  );
}

function renderHud() {
  document.getElementById("level-number").textContent = String(progress.level);
  document.getElementById("topbar-level").textContent = String(progress.level);
  document.getElementById("level-title").textContent = progress.title;
  document.getElementById("streak-value").textContent = String(progress.currentStreak);
  document.getElementById("topbar-streak").textContent = String(progress.currentStreak);
  document.getElementById("applied-total").textContent = String(progress.applicationCount);
  const unlockedCount = progress.achievements.filter((achievement) => achievement.unlocked).length;
  document.getElementById("trophy-count").textContent = `${unlockedCount}/${ACHIEVEMENTS.length}`;

  const xpBar = document.getElementById("xp-bar");
  const xpFill = document.getElementById("xp-fill");
  const xpText = document.getElementById("xp-text");
  if (progress.xpForLevel) {
    xpFill.style.width = `${(progress.xpIntoLevel / progress.xpForLevel) * 100}%`;
    xpBar.setAttribute("aria-valuemax", String(progress.xpForLevel));
    xpBar.setAttribute("aria-valuenow", String(progress.xpIntoLevel));
    xpText.textContent = `${progress.xpIntoLevel} / ${progress.xpForLevel} XP to ${progress.nextTitle} · ${progress.xp} XP total`;
  } else {
    xpFill.style.width = "100%";
    xpText.textContent = `Max level! ${progress.xp} XP total`;
  }

  renderQuests(progress.quests);
  renderTrophies(progress.achievements);
}

// Celebrates anything new since the last update: finished quests, trophies, and level-ups.
function celebrateChanges(previous, current, seenAchievementIds, previousLevel) {
  let isBigMoment = false;
  current.quests.forEach((quest, index) => {
    if (quest.done && !previous.quests[index].done) {
      showToast(`${quest.icon} Quest complete: ${quest.name}  +${quest.xp} XP`, "quest");
    }
  });
  for (const achievement of current.achievements) {
    if (achievement.unlocked && !seenAchievementIds.has(achievement.id)) {
      showToast(`${achievement.icon} Trophy unlocked: ${achievement.name}  +${achievement.xp} XP`, "trophy");
      isBigMoment = true;
    }
  }
  if (current.level > previousLevel) {
    showToast(`⬆️ Level ${current.level} reached: ${current.title}!`, "level");
    isBigMoment = true;
  }
  if (isBigMoment) burstConfetti();
}

function updateGame({ celebrate }) {
  const previous = progress;
  progress = computeProgress(Object.values(appliedPostings), Object.values(savedPostings));
  const seenAchievementIds = new Set(activity.seen.seenAchievementIds);
  if (celebrate && previous) {
    celebrateChanges(previous, progress, seenAchievementIds, activity.seen.level);
  }
  for (const achievement of progress.achievements) {
    if (achievement.unlocked) seenAchievementIds.add(achievement.id);
  }
  activity.seen = { level: progress.level, seenAchievementIds: [...seenAchievementIds] };
  renderHud();
}

// ---------- Discover (card deck) ----------

function buildDeckCardContent(posting) {
  const content = createElement("div", "deck-card-content");
  const header = createElement("div", "deck-card-header");
  const company = createElement("div", "deck-card-company");
  company.append(createElement("p", "company", posting.company_name), createElement("p", "posted", formatPostedAge(posting)));
  header.append(createAvatar(posting), company);

  const footer = createElement("div", "deck-card-footer");
  footer.append(createApplyLink(posting, "button button-secondary"));

  content.append(header, createElement("h2", "deck-card-title", posting.title), createTags(posting), footer);
  return content;
}

function renderDiscover() {
  undoButton.disabled = undoStack.length === 0;
  if (!postingsLoaded) return;
  const deckPostings = allPostings.filter((posting) => matchesFilters(posting) && isUnseen(posting));
  renderDeck(deck, deckPostings, buildDeckCardContent, handleSwipe);
  for (const button of deckButtons) button.disabled = deckPostings.length === 0;

  if (deckPostings.length === 0) {
    const emptyState = createElement("div", "deck-empty");
    emptyState.append(
      createElement("span", "deck-empty-icon", "🎉"),
      createElement("p", "deck-empty-title", "You've cleared this deck!"),
      createElement("p", "deck-empty-text", "Change the filters for a new deck, or check back tomorrow for fresh postings."),
    );
    deck.replaceChildren(emptyState);
    deckCount.textContent = "";
  } else {
    const noun = deckPostings.length === 1 ? "card" : "cards";
    deckCount.textContent = `${deckPostings.length.toLocaleString()} ${noun} left in this deck`;
  }
}

// ---------- Browse (list) ----------

function createPostingItem(posting) {
  const application = appliedPostings[posting.id];
  const isSaved = posting.id in savedPostings;
  const item = createElement("li", "posting");
  item.classList.toggle("applied", Boolean(application));

  const info = createElement("div", "posting-info");
  info.append(
    createElement("p", "company", posting.company_name),
    createElement("h2", "title", posting.title),
    createTags(posting),
  );

  const saveButton = createElement("button", "button button-secondary save-button", isSaved ? "★" : "☆");
  saveButton.type = "button";
  saveButton.setAttribute("aria-pressed", String(isSaved));
  saveButton.setAttribute("aria-label", isSaved ? "Remove from saved" : "Save for later");
  saveButton.addEventListener("click", () => toggleSaved(posting));

  const appliedButton = createElement(
    "button",
    "button applied-button",
    application ? `✓ Applied ${formatDate(new Date(application.at))}` : "Mark applied",
  );
  appliedButton.type = "button";
  appliedButton.setAttribute("aria-pressed", String(Boolean(application)));
  appliedButton.addEventListener("click", () => toggleApplied(posting));

  const buttons = createElement("div", "posting-buttons");
  buttons.append(createApplyLink(posting, "button button-secondary"), saveButton, appliedButton);
  const actions = createElement("div", "posting-actions");
  actions.append(createElement("span", "posted", formatPostedAge(posting)), buttons);

  item.append(createAvatar(posting), info, actions);
  return item;
}

function createSkeletonItem() {
  const item = createElement("li", "posting skeleton");
  item.setAttribute("aria-hidden", "true");
  const info = createElement("div", "posting-info");
  info.append(createElement("div", "skeleton-line short"), createElement("div", "skeleton-line"));
  item.append(createElement("div", "avatar"), info);
  return item;
}

const EMPTY_LIST_TEXT = {
  applied: "No applications yet. Swipe up in Discover or press \"Mark applied\" after you apply.",
  saved: "Nothing saved yet. Swipe right in Discover or press ☆ to save postings for later.",
  all: "No internships match these filters. Try clearing the search or picking \"Anywhere\".",
};

function renderBrowse() {
  if (!postingsLoaded) return;
  const matching = allPostings.filter((posting) => matchesFilters(posting) && matchesStatus(posting));
  const noun = matching.length === 1 ? "internship" : "internships";
  summary.textContent = `${matching.length.toLocaleString()} ${noun}`;
  postingList.replaceChildren(...matching.slice(0, visibleCount).map(createPostingItem));
  showMoreButton.hidden = matching.length <= visibleCount;
  listMessage.hidden = matching.length > 0;
  listMessage.textContent = EMPTY_LIST_TEXT[statusFilter];
}

// ---------- Page ----------

function render() {
  updateFilterCount();
  discoverView.hidden = viewMode !== "discover";
  browseView.hidden = viewMode !== "browse";
  for (const tab of modeTabs) tab.setAttribute("aria-selected", String(tab.dataset.mode === viewMode));
  if (viewMode === "discover") {
    renderDiscover();
  } else {
    renderBrowse();
  }
}

function resetAndRender() {
  visibleCount = PAGE_SIZE;
  render();
}

function fillSelect(select, values) {
  for (const value of values) {
    select.append(new Option(value, value));
  }
}

function countBy(postings, getKeys) {
  const counts = new Map();
  for (const posting of postings) {
    for (const key of getKeys(posting)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function createOptionGroup(label, options) {
  const group = document.createElement("optgroup");
  group.label = label;
  for (const [text, value, count] of options) {
    group.append(new Option(`${text} (${count.toLocaleString()})`, value));
  }
  return group;
}

// Adds every role that has at least one posting, with posting counts.
function fillRoleSelect() {
  const roleCounts = countBy(allPostings, (posting) => posting.roleIds);
  for (const role of ROLES.filter((role) => roleCounts.has(role.id))) {
    roleSelect.append(new Option(`${role.name} (${roleCounts.get(role.id).toLocaleString()})`, role.id));
  }
}

// Adds metro areas and states that have at least one posting, with posting counts.
function fillLocationSelect() {
  const remoteCount = allPostings.filter((posting) => posting.isRemoteUs).length;
  locationSelect.querySelector('option[value="remote"]').textContent = `Remote in the US (${remoteCount})`;

  const metroCounts = countBy(allPostings, (posting) => posting.metroIds);
  const metroOptions = METRO_AREAS.filter((metro) => metroCounts.has(metro.id)).map((metro) => [
    metro.name,
    `metro:${metro.id}`,
    metroCounts.get(metro.id),
  ]);

  const stateCounts = countBy(allPostings, (posting) => posting.stateCodes);
  const stateOptions = Object.entries(STATE_NAMES)
    .filter(([code]) => stateCounts.has(code))
    .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB))
    .map(([code, name]) => [name, `state:${code}`, stateCounts.get(code)]);

  locationSelect.append(createOptionGroup("Metro areas", metroOptions), createOptionGroup("States", stateOptions));
}

function showLoading() {
  postingList.replaceChildren(...Array.from({ length: SKELETON_CARD_COUNT }, createSkeletonItem));
  summary.textContent = "Loading the latest internships…";
  const loadingCard = createElement("div", "deck-card deck-loading");
  loadingCard.append(createElement("span", "deck-empty-icon", "🃏"), createElement("p", "deck-empty-title", "Shuffling the deck…"));
  deck.replaceChildren(loadingCard);
  deckCount.textContent = "";
}

async function loadPostings() {
  showLoading();
  try {
    const response = await fetch(LISTINGS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const listings = await response.json();
    allPostings = listings
      .filter((posting) => posting.active && posting.is_visible !== false)
      .sort((a, b) => b.date_posted - a.date_posted);
    for (const posting of allPostings) {
      posting.stateCodes = new Set(posting.locations.map(stateCodeOf).filter(Boolean));
      posting.metroIds = new Set(posting.locations.map(metroIdOf).filter(Boolean));
      posting.isRemoteUs = posting.locations.some(isRemoteUs);
      posting.roleIds = new Set(roleIdsOf(posting));
      posting.degrees ??= [];
    }
  } catch (error) {
    showLoadingError(`Couldn't load internships (${error.message}). Check your connection and try again.`, () => {
      showLoadingScreen();
      loadPostings();
    });
    return;
  }

  const terms = new Set(allPostings.flatMap((posting) => posting.terms));
  fillSelect(termSelect, [...terms].filter((term) => term !== "N/A").sort());
  fillRoleSelect();
  fillLocationSelect();
  postingsLoaded = true;
  setLoadingStatus(`Dealt ${allPostings.length.toLocaleString()} internships!`);
  finishStartup();
}

// ---------- Accounts ----------

// Opens the game once both the internships and the player's account have loaded.
function finishStartup() {
  if (startupDone || !postingsLoaded || !userKnown) return;
  startupDone = true;
  render();
  if (currentUser || loadJson(STORAGE_KEYS.playingAsGuest, false)) {
    hideSplash();
  } else {
    showWelcomeScreen({ closable: false });
  }
}

function renderAccountButton() {
  accountButton.hidden = !accountsAvailable;
  if (currentUser) {
    const name = currentUser.displayName || currentUser.email || "?";
    accountButton.textContent = name.trim().charAt(0).toUpperCase();
    accountButton.classList.add("signed-in");
    accountButton.setAttribute("aria-label", "Your account");
    document.getElementById("account-email").textContent = currentUser.email ?? name;
  } else {
    accountButton.textContent = "Log in";
    accountButton.classList.remove("signed-in");
    accountButton.removeAttribute("aria-label");
  }
}

// Offers to move this browser's guest progress into the account that just logged in.
function shouldMoveGuestProgress() {
  const guest = guestActivitySummary();
  if (guest.isEmpty) return false;
  return window.confirm(
    `This browser has guest progress (${guest.applied} applied, ${guest.saved} saved). Add it to your account?`,
  );
}

async function handleUserChanged(user) {
  if (userKnown && (user?.uid ?? null) === (currentUser?.uid ?? null)) return;
  if (user) {
    try {
      await useAccount(user.uid, { includeGuestProgress: shouldMoveGuestProgress() });
    } catch {
      showToast("Couldn't load your saved progress. Check your connection and log in again.", "error");
      await logOut();
      return;
    }
    currentUser = user;
    syncStatus.textContent = "✓ Your progress saves to your account automatically.";
  } else {
    useGuest();
    currentUser = null;
  }

  undoStack.length = 0;
  progress = null;
  updateGame({ celebrate: false });
  renderAccountButton();
  if (startupDone) {
    resetAndRender();
    if (user && isSplashOpen()) {
      hideSplash();
      showToast(`👋 Welcome, ${user.displayName || user.email}!`, "info");
    }
  }
  userKnown = true;
  finishStartup();
}

const SYNC_STATUS_TEXT = {
  saving: "Saving…",
  saved: "✓ Progress saved to your account.",
  error: "⚠️ Couldn't save just now. Your next move will try again.",
};

function handleSyncStatus(status) {
  if (status === "local-error") {
    showToast("Couldn't save your progress in this browser (private mode?)", "error");
    return;
  }
  syncStatus.textContent = SYNC_STATUS_TEXT[status];
  if (status === "error") showToast("Couldn't save to your account. Check your connection.", "error");
}

async function handleLogOut() {
  await flushCloudSave();
  await logOut();
  accountDialog.close();
  saveJson(STORAGE_KEYS.playingAsGuest, false);
  showWelcomeScreen({ closable: true });
}

function playAsGuest() {
  saveJson(STORAGE_KEYS.playingAsGuest, true);
  hideSplash();
}

function selectStatusTab(selectedTab) {
  for (const tab of statusTabs) {
    tab.setAttribute("aria-selected", String(tab === selectedTab));
  }
  statusFilter = selectedTab.dataset.status;
  resetAndRender();
}

function setViewMode(mode) {
  viewMode = mode;
  saveJson(STORAGE_KEYS.viewMode, mode);
  resetAndRender();
}

const ARROW_DIRECTIONS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up" };

function handleKeyDown(event) {
  const direction = ARROW_DIRECTIONS[event.key];
  if (!direction || viewMode !== "discover" || trophyDialog.open || accountDialog.open || isSplashOpen()) return;
  if (event.target.closest("input, select, textarea")) return;
  event.preventDefault();
  swipeTopCard(direction);
}

for (const control of [roleSelect, locationSelect, degreeSelect, termSelect]) {
  control.addEventListener("change", resetAndRender);
}
for (const tab of statusTabs) {
  tab.addEventListener("click", () => selectStatusTab(tab));
}
for (const tab of modeTabs) {
  tab.addEventListener("click", () => setViewMode(tab.dataset.mode));
}
for (const button of deckButtons) {
  button.addEventListener("click", () => swipeTopCard(button.dataset.direction));
}
undoButton.addEventListener("click", undoLastSwipe);
searchInput.addEventListener("input", resetAndRender);
filtersToggle.addEventListener("click", () => {
  const isOpen = filterPanel.classList.toggle("open");
  filtersToggle.setAttribute("aria-expanded", String(isOpen));
});
showMoreButton.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  render();
});
document.getElementById("trophies-button").addEventListener("click", () => trophyDialog.showModal());
document.getElementById("trophy-close").addEventListener("click", () => trophyDialog.close());
trophyDialog.addEventListener("click", (event) => {
  if (event.target === trophyDialog) trophyDialog.close();
});
document.addEventListener("keydown", handleKeyDown);
accountButton.addEventListener("click", () => {
  if (currentUser) {
    accountDialog.showModal();
  } else {
    showWelcomeScreen({ closable: true });
  }
});
document.getElementById("account-close").addEventListener("click", () => accountDialog.close());
accountDialog.addEventListener("click", (event) => {
  if (event.target === accountDialog) accountDialog.close();
});
document.getElementById("log-out-button").addEventListener("click", handleLogOut);
// Sends any waiting save before the tab is hidden or closed.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushCloudSave();
});

showLoadingScreen();
setUpThemeToggle(document.getElementById("theme-toggle"));
setUpWelcomeScreen({ onGuest: playAsGuest });
setSyncStatusListener(handleSyncStatus);
renderAccountButton();
watchUser(handleUserChanged);
loadPostings();
