// The player's activity: applications, saves, passes, and which trophies and
// level they've already celebrated. Guests keep it in this browser; logged-in
// players keep it in their account, so it follows them to every device.
import { loadCloudProgress, saveCloudProgress } from "./account.js";
import { emptyWallet } from "./shop.js";

const GUEST_STORAGE_KEYS = {
  applied: "appliedPostings",
  saved: "savedPostings",
  passed: "passedPostings",
  seen: "gameProgress",
  wallet: "wallet",
};
// Waits for a pause in swiping so a burst of swipes becomes one save.
const CLOUD_SAVE_DELAY_MS = 800;
const POSTING_STORES = ["applied", "saved", "passed"];

function emptySeen() {
  return { level: 1, seenAchievementIds: [] };
}

// Each store maps posting id -> what happened. Applications are { at, fresh, roleIds, metroIds };
// saves and passes are ISO dates. The store objects are never replaced, only refilled.
// The wallet holds purchases, opened chests, used streak freezes, and equipped items (see shop.js).
export const activity = { applied: {}, saved: {}, passed: {}, seen: emptySeen(), wallet: emptyWallet() };

let userId = null;
let cloudSaveTimer = null;
let onSyncStatus = () => {};

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readGuestActivity() {
  return Object.fromEntries(Object.entries(GUEST_STORAGE_KEYS).map(([part, key]) => [part, readJson(key)]));
}

function writeGuestActivity() {
  try {
    for (const [part, key] of Object.entries(GUEST_STORAGE_KEYS)) {
      localStorage.setItem(key, JSON.stringify(activity[part]));
    }
  } catch {
    onSyncStatus("local-error");
  }
}

function clearGuestActivity() {
  try {
    for (const key of Object.values(GUEST_STORAGE_KEYS)) localStorage.removeItem(key);
  } catch {
    // Nothing was stored if storage is blocked.
  }
}

// Older versions stored only the date an application was marked.
function normalizeApplications(applied) {
  return Object.fromEntries(
    Object.entries(applied ?? {}).map(([id, value]) => [id, typeof value === "string" ? { at: value } : value]),
  );
}

function replaceActivity(source) {
  for (const part of POSTING_STORES) {
    const store = activity[part];
    for (const id of Object.keys(store)) delete store[id];
    Object.assign(store, part === "applied" ? normalizeApplications(source.applied) : source[part] ?? {});
  }
  activity.seen = source.seen ?? emptySeen();
  activity.wallet = { ...emptyWallet(), ...source.wallet };
}

// The account's progress wins wherever both have an entry for the same posting.
function mergeActivity(account, guest) {
  const merged = {};
  for (const part of POSTING_STORES) merged[part] = { ...guest[part], ...account[part] };
  merged.seen = {
    level: Math.max(account.seen?.level ?? 1, guest.seen?.level ?? 1),
    seenAchievementIds: [...new Set([...(account.seen?.seenAchievementIds ?? []), ...(guest.seen?.seenAchievementIds ?? [])])],
    tourDone: Boolean(account.seen?.tourDone || guest.seen?.tourDone),
  };
  // Both sides' purchases and opened chests are kept; the account's equipped items win.
  const accountWallet = { ...emptyWallet(), ...account.wallet };
  const guestWallet = { ...emptyWallet(), ...guest.wallet };
  merged.wallet = {
    ...accountWallet,
    purchases: [...accountWallet.purchases, ...guestWallet.purchases],
    chests: [...accountWallet.chests, ...guestWallet.chests],
    freezesUsed: [...new Set([...accountWallet.freezesUsed, ...guestWallet.freezesUsed])],
  };
  return merged;
}

/** How much guest progress this browser holds, to offer moving it into an account. */
export function guestActivitySummary() {
  const guest = readGuestActivity();
  const applied = Object.keys(guest.applied ?? {}).length;
  const saved = Object.keys(guest.saved ?? {}).length;
  const passed = Object.keys(guest.passed ?? {}).length;
  return { applied, saved, isEmpty: applied + saved + passed === 0 };
}

/** Plays as a guest, with progress kept in this browser. */
export function useGuest() {
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = null;
  userId = null;
  replaceActivity(readGuestActivity());
}

/**
 * Switches to a logged-in player's saved progress. With includeGuestProgress, this
 * browser's guest progress moves into the account (and is cleared from the browser).
 * Throws if the account's progress can't be loaded, so nothing gets overwritten.
 */
export async function useAccount(id, { includeGuestProgress }) {
  const account = (await loadCloudProgress(id)) ?? {};
  userId = id;
  if (includeGuestProgress) {
    replaceActivity(mergeActivity(account, readGuestActivity()));
    clearGuestActivity();
    saveActivity();
  } else {
    replaceActivity(account);
  }
}

/** Saves after every change: right away for guests, shortly after for accounts. */
export function saveActivity() {
  if (!userId) {
    writeGuestActivity();
    return;
  }
  clearTimeout(cloudSaveTimer);
  onSyncStatus("saving");
  cloudSaveTimer = setTimeout(flushCloudSave, CLOUD_SAVE_DELAY_MS);
}

/** Sends a waiting save now (before logging out or leaving the page). */
export async function flushCloudSave() {
  if (!userId || cloudSaveTimer === null) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = null;
  try {
    await saveCloudProgress(userId, {
      applied: activity.applied,
      saved: activity.saved,
      passed: activity.passed,
      seen: activity.seen,
      wallet: activity.wallet,
    });
    onSyncStatus("saved");
  } catch {
    onSyncStatus("error");
  }
}

/** listener(status) hears "saving", "saved", "error", or "local-error". */
export function setSyncStatusListener(listener) {
  onSyncStatus = listener;
}
