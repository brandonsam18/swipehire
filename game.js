// Game rules: XP, levels, streaks, daily quests, and trophies.
// Everything is calculated from the player's saved activity, so un-marking an
// application takes its XP back and nothing can get out of sync.

const XP_PER_APPLICATION = 100;
const XP_FRESH_BONUS = 25;
export const XP_PER_SAVE = 10;
export const FRESH_POSTING_DAYS = 3;

// Where an application stands. Applied is where every application starts; the
// next three are a ladder, and Rejected can happen at any point. Reaching a stage
// earns its reward once, and keeps it if the application is later rejected.
export const STAGES = [
  { id: "applied", name: "Applied", shortName: "Applied", icon: "✓", xp: 0, coins: 0 },
  { id: "assessment", name: "Online Assessment", shortName: "OA", icon: "📝", xp: 50, coins: 10 },
  { id: "interview", name: "Interview", shortName: "Interview", icon: "🎤", xp: 150, coins: 25 },
  { id: "offer", name: "Offer", shortName: "Offer", icon: "🎉", xp: 500, coins: 100 },
  { id: "rejected", name: "Rejected", shortName: "Rejected", icon: "🌧️", xp: 10, coins: 0 },
];
const STAGE_LADDER = ["applied", "assessment", "interview", "offer"];

export function stageById(stageId) {
  return STAGES.find((stage) => stage.id === stageId) ?? STAGES[0];
}

/** The stage an application is at now (older applications have none saved, so they're Applied). */
export function currentStage(application) {
  return stageById(application.stage).id;
}

/**
 * Moves an application to a stage, returning the updated application.
 * Moving forward records the new stage. Moving back to an earlier stage forgets
 * the later ones (and any rejection). Rejected keeps the stages already reached.
 */
export function withStage(application, stageId, now = new Date()) {
  const reached = { ...application.reached };
  if (stageId === "rejected") {
    reached.rejected ??= now.toISOString();
  } else {
    const index = STAGE_LADDER.indexOf(stageId);
    for (const laterStage of [...STAGE_LADDER.slice(index + 1), "rejected"]) delete reached[laterStage];
    if (stageId !== "applied") reached[stageId] ??= now.toISOString();
  }
  return { ...application, stage: stageId, reached };
}

/** Totals for the rewards every reached stage earns. */
function stageRewards(applications) {
  let xp = 0;
  let coins = 0;
  for (const application of applications) {
    for (const stageId of Object.keys(application.reached ?? {})) {
      xp += stageById(stageId).xp;
      coins += stageById(stageId).coins;
    }
  }
  return { xp, coins };
}

export const LEVELS = [
  { title: "Intern Hopeful", xp: 0 },
  { title: "Résumé Rookie", xp: 500 },
  { title: "Application Apprentice", xp: 1500 },
  { title: "Cover Letter Knight", xp: 3000 },
  { title: "Interview Hunter", xp: 5000 },
  { title: "Offer Chaser", xp: 8000 },
  { title: "Internship Legend", xp: 12000 },
  { title: "Offer Magnet", xp: 18000 },
];

export const QUESTS = [
  {
    id: "apply-three",
    icon: "🎯",
    name: "Apply to 3 internships",
    target: 3,
    xp: 150,
    progress: (day) => day.applications.length,
  },
  {
    id: "fresh-catch",
    icon: "🐟",
    name: "Apply to one posted in the last 3 days",
    target: 1,
    xp: 75,
    progress: (day) => day.applications.filter((application) => application.fresh).length,
  },
  {
    id: "scout",
    icon: "🔭",
    name: "Save 5 postings in Discover",
    target: 5,
    xp: 50,
    progress: (day) => day.saveCount,
  },
];

export const ACHIEVEMENTS = [
  { id: "first-steps", icon: "🚀", name: "First Steps", description: "Apply to your first internship", xp: 50, earned: (s) => s.applicationCount >= 1 },
  { id: "high-five", icon: "🖐️", name: "High Five", description: "Apply to 5 internships", xp: 100, earned: (s) => s.applicationCount >= 5 },
  { id: "double-digits", icon: "🔟", name: "Double Digits", description: "Apply to 10 internships", xp: 150, earned: (s) => s.applicationCount >= 10 },
  { id: "quarter-century", icon: "🏹", name: "Quarter Century", description: "Apply to 25 internships", xp: 250, earned: (s) => s.applicationCount >= 25 },
  { id: "fifty-club", icon: "🏆", name: "Fifty Club", description: "Apply to 50 internships", xp: 400, earned: (s) => s.applicationCount >= 50 },
  { id: "centurion", icon: "👑", name: "Centurion", description: "Apply to 100 internships", xp: 800, earned: (s) => s.applicationCount >= 100 },
  { id: "hat-trick", icon: "🎩", name: "Hat Trick", description: "Apply to 3 internships in one day", xp: 75, earned: (s) => s.mostInOneDay >= 3 },
  { id: "early-bird", icon: "🐦", name: "Early Bird", description: "Apply to a posting less than 3 days old", xp: 75, earned: (s) => s.freshCount >= 1 },
  { id: "chicago-local", icon: "🌆", name: "Chicago Local", description: "Apply to an internship in Chicagoland", xp: 75, earned: (s) => s.metroIds.has("chicagoland") },
  { id: "explorer", icon: "🧭", name: "Explorer", description: "Apply to 5 different kinds of roles", xp: 100, earned: (s) => s.roleIds.size >= 5 },
  { id: "on-fire", icon: "🔥", name: "On Fire", description: "Apply 3 days in a row", xp: 150, earned: (s) => s.bestStreak >= 3 },
  { id: "unstoppable", icon: "☄️", name: "Unstoppable", description: "Apply 7 days in a row", xp: 400, earned: (s) => s.bestStreak >= 7 },
  { id: "scout", icon: "🔭", name: "Scout", description: "Save 10 postings for later", xp: 50, earned: (s) => s.saveCount >= 10 },
  { id: "first-assessment", icon: "📝", name: "First Assessment", description: "Reach an online assessment", xp: 75, earned: (s) => s.reached.assessment >= 1 },
  { id: "first-interview", icon: "🎤", name: "First Interview", description: "Land an interview", xp: 150, earned: (s) => s.reached.interview >= 1 },
  { id: "offer-unlocked", icon: "🏅", name: "Offer Unlocked", description: "Get an internship offer", xp: 500, earned: (s) => s.reached.offer >= 1 },
];

/** Local calendar day as "YYYY-MM-DD", so days roll over at the player's midnight. */
export function dayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function previousDayKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return dayKey(new Date(year, month - 1, day - 1));
}

// Lengths of the current streak (ending today or yesterday) and the longest one.
function streaks(activeDays, todayKey) {
  let bestStreak = 0;
  for (const day of activeDays) {
    if (activeDays.has(previousDayKey(day))) continue;
    let length = 1;
    let next = day;
    for (;;) {
      const [year, month, date] = next.split("-").map(Number);
      next = dayKey(new Date(year, month - 1, date + 1));
      if (!activeDays.has(next)) break;
      length += 1;
    }
    bestStreak = Math.max(bestStreak, length);
  }

  let currentStreak = 0;
  let day = activeDays.has(todayKey) ? todayKey : previousDayKey(todayKey);
  while (activeDays.has(day)) {
    currentStreak += 1;
    day = previousDayKey(day);
  }
  return { currentStreak, bestStreak };
}

function groupByDay(applications, savedDates) {
  const days = new Map();
  const dayFor = (key) => {
    if (!days.has(key)) days.set(key, { applications: [], saveCount: 0 });
    return days.get(key);
  };
  for (const application of applications) dayFor(dayKey(new Date(application.at))).applications.push(application);
  for (const savedAt of savedDates) dayFor(dayKey(new Date(savedAt))).saveCount += 1;
  return days;
}

function levelFor(xp) {
  let index = 0;
  while (index + 1 < LEVELS.length && xp >= LEVELS[index + 1].xp) index += 1;
  const current = LEVELS[index];
  const next = LEVELS[index + 1];
  return {
    level: index + 1,
    title: current.title,
    nextTitle: next?.title ?? null,
    xpIntoLevel: xp - current.xp,
    xpForLevel: next ? next.xp - current.xp : null,
  };
}

/**
 * Works out the player's whole game state.
 * @param applications list of { at, fresh, roleIds, metroIds } (one per applied posting)
 * @param savedDates ISO dates of every saved posting
 * @param frozenDays "YYYY-MM-DD" days covered by a streak freeze, which count toward streaks
 */
export function computeProgress(applications, savedDates, { now = new Date(), frozenDays = [] } = {}) {
  const days = groupByDay(applications, savedDates);
  const todayKey = dayKey(now);
  const appliedDays = new Set([...days].filter(([, day]) => day.applications.length > 0).map(([key]) => key));
  const streakDays = new Set([...appliedDays, ...frozenDays]);
  const { currentStreak, bestStreak } = streaks(streakDays, todayKey);

  const stats = {
    applicationCount: applications.length,
    saveCount: savedDates.length,
    freshCount: applications.filter((application) => application.fresh).length,
    mostInOneDay: Math.max(0, ...[...days.values()].map((day) => day.applications.length)),
    roleIds: new Set(applications.flatMap((application) => application.roleIds ?? [])),
    metroIds: new Set(applications.flatMap((application) => application.metroIds ?? [])),
    bestStreak,
    // How many applications have ever reached each stage.
    reached: Object.fromEntries(
      STAGES.map((stage) => [stage.id, applications.filter((application) => application.reached?.[stage.id]).length]),
    ),
  };

  const achievements = ACHIEVEMENTS.map((achievement) => ({ ...achievement, unlocked: achievement.earned(stats) }));

  let questXp = 0;
  let questCompletions = 0;
  let perfectQuestDays = 0;
  for (const day of days.values()) {
    const doneQuests = QUESTS.filter((quest) => quest.progress(day) >= quest.target);
    questXp += doneQuests.reduce((total, quest) => total + quest.xp, 0);
    questCompletions += doneQuests.length;
    if (doneQuests.length === QUESTS.length) perfectQuestDays += 1;
  }
  const today = days.get(todayKey) ?? { applications: [], saveCount: 0 };
  const quests = QUESTS.map((quest) => {
    const progress = Math.min(quest.progress(today), quest.target);
    return { ...quest, progress, done: progress >= quest.target };
  });

  const stageReward = stageRewards(applications);
  const stageCounts = Object.fromEntries(STAGES.map((stage) => [stage.id, 0]));
  for (const application of applications) stageCounts[currentStage(application)] += 1;

  const xp =
    stageReward.xp +
    stats.applicationCount * XP_PER_APPLICATION +
    stats.freshCount * XP_FRESH_BONUS +
    stats.saveCount * XP_PER_SAVE +
    questXp +
    achievements.filter((achievement) => achievement.unlocked).reduce((total, achievement) => total + achievement.xp, 0);

  return {
    xp,
    ...levelFor(xp),
    currentStreak,
    bestStreak,
    applicationCount: stats.applicationCount,
    freshCount: stats.freshCount,
    saveCount: stats.saveCount,
    questCompletions,
    perfectQuestDays,
    trophyCount: achievements.filter((achievement) => achievement.unlocked).length,
    stageCoins: stageReward.coins,
    stageCounts,
    streakDays,
    todayKey,
    quests,
    achievements,
  };
}

/** XP earned by one application, for the "+XP" pop-up. */
export function applicationXp(application) {
  return XP_PER_APPLICATION + (application.fresh ? XP_FRESH_BONUS : 0);
}
