// The first-time walkthrough: a spotlight that dims the page except one part
// of the app, with a card explaining it. It starts on its own for new players
// and can be replayed from the "?" button in the top bar.

export const TOUR_STEPS = [
  {
    targets: ["#deck"],
    title: "Swipe through internships",
    text: "Swipe right to save, up when you've applied, and left to pass. You can also use the buttons just below the cards or your arrow keys.",
  },
  {
    targets: [".toolbar"],
    title: "Find your kind of internship",
    text: "Search, or open Filters to pick your field, location, degree, and term for a deck that fits you.",
  },
  {
    targets: ["#player-card"],
    title: "Level up as you apply",
    text: "Every application earns XP and coins. Level up, unlock trophies, and apply each day to keep your streak alive.",
  },
  {
    targets: [".quests"],
    title: "Daily quests",
    text: "New quests every day. Finish them for bonus XP and coins, and finish all three for a loot chest.",
  },
  {
    targets: ["#shop-button"],
    title: "Shop and locker",
    text: "Spend coins on card skins, celebrations, banners, and themes, with new items every day. Open your loot chests here too.",
  },
];

// Space around the highlighted area, and between it and the step card.
const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 14;
const VIEWPORT_MARGIN = 16;
// How long to wait for smooth scrolling to bring a step into view.
const SCROLL_SETTLE_MS = 400;
// Steps scroll to just under the sticky top bar, leaving room for the card below them.
const SCROLL_TOP_OFFSET = 88;

let overlay = null;
let stepIndex = 0;
let onClose = () => {};
let settleTimer = null;

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** The smallest rectangle around all of a step's targets that are on screen. */
function targetRect(step) {
  const rects = step.targets
    .map((selector) => document.querySelector(selector))
    .filter((element) => element && element.offsetParent !== null)
    .map((element) => element.getBoundingClientRect());
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { left, top, width: right - left, height: bottom - top, bottom };
}

// Puts the spotlight over the step's targets and the card below them (or
// above, if there's more room there), kept inside the screen.
function position() {
  if (!overlay) return;
  const spotlight = overlay.querySelector(".tour-spotlight");
  const card = overlay.querySelector(".tour-card");
  const rect = targetRect(TOUR_STEPS[stepIndex]);
  if (!rect) {
    spotlight.hidden = true;
    card.style.left = `${(window.innerWidth - card.offsetWidth) / 2}px`;
    card.style.top = `${(window.innerHeight - card.offsetHeight) / 2}px`;
    return;
  }
  spotlight.hidden = false;
  spotlight.style.left = `${rect.left - SPOTLIGHT_PADDING}px`;
  spotlight.style.top = `${rect.top - SPOTLIGHT_PADDING}px`;
  spotlight.style.width = `${rect.width + SPOTLIGHT_PADDING * 2}px`;
  spotlight.style.height = `${rect.height + SPOTLIGHT_PADDING * 2}px`;

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const cardHeight = card.offsetHeight;
  let top =
    spaceBelow >= cardHeight + CARD_GAP + SPOTLIGHT_PADDING || spaceBelow >= spaceAbove
      ? rect.bottom + SPOTLIGHT_PADDING + CARD_GAP
      : rect.top - SPOTLIGHT_PADDING - CARD_GAP - cardHeight;
  top = Math.min(Math.max(top, VIEWPORT_MARGIN), window.innerHeight - cardHeight - VIEWPORT_MARGIN);
  const centeredLeft = rect.left + rect.width / 2 - card.offsetWidth / 2;
  const left = Math.min(Math.max(centeredLeft, VIEWPORT_MARGIN), window.innerWidth - card.offsetWidth - VIEWPORT_MARGIN);
  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
}

function showStep(index) {
  stepIndex = index;
  const step = TOUR_STEPS[index];
  const isLast = index === TOUR_STEPS.length - 1;
  overlay.querySelector(".tour-count").textContent = `${index + 1} of ${TOUR_STEPS.length}`;
  overlay.querySelector(".tour-title").textContent = step.title;
  overlay.querySelector(".tour-text").textContent = step.text;
  overlay.querySelector(".tour-back").disabled = index === 0;
  const nextButton = overlay.querySelector(".tour-next");
  nextButton.textContent = isLast ? "Start swiping" : "Next";

  // Bring the step into view, then place the spotlight once scrolling settles.
  const firstTarget = document.querySelector(step.targets[0]);
  if (firstTarget) {
    const top = firstTarget.getBoundingClientRect().top + window.scrollY - SCROLL_TOP_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }
  position();
  clearTimeout(settleTimer);
  settleTimer = setTimeout(position, SCROLL_SETTLE_MS);
  nextButton.focus({ preventScroll: true });
}

function closeTour() {
  if (!overlay) return;
  clearTimeout(settleTimer);
  window.removeEventListener("resize", position);
  window.removeEventListener("scroll", position, true);
  document.removeEventListener("keydown", handleKey, true);
  overlay.remove();
  overlay = null;
  document.body.classList.remove("tour-open");
  onClose();
}

function goTo(index) {
  if (index >= TOUR_STEPS.length) closeTour();
  else if (index >= 0) showStep(index);
}

// Arrow keys and Enter move through the tour (and don't swipe cards behind it); Escape skips it.
function handleKey(event) {
  const actions = {
    Escape: () => closeTour(),
    ArrowRight: () => goTo(stepIndex + 1),
    Enter: () => goTo(stepIndex + 1),
    ArrowLeft: () => goTo(stepIndex - 1),
  };
  const action = actions[event.key];
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  action();
}

function buildOverlay() {
  const root = createElement("div", "tour");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "tour-title");
  root.setAttribute("aria-describedby", "tour-text");

  const card = createElement("div", "tour-card");
  const header = createElement("div", "tour-header");
  const skipButton = createElement("button", "tour-skip", "Skip tour");
  skipButton.type = "button";
  skipButton.addEventListener("click", closeTour);
  header.append(createElement("span", "tour-count"), skipButton);

  const title = createElement("h2", "tour-title");
  title.id = "tour-title";
  const text = createElement("p", "tour-text");
  text.id = "tour-text";

  const buttons = createElement("div", "tour-buttons");
  const backButton = createElement("button", "button button-secondary tour-back", "Back");
  backButton.type = "button";
  backButton.addEventListener("click", () => goTo(stepIndex - 1));
  const nextButton = createElement("button", "button applied-button tour-next", "Next");
  nextButton.type = "button";
  nextButton.addEventListener("click", () => goTo(stepIndex + 1));
  buttons.append(backButton, nextButton);

  card.append(header, title, text, buttons);
  root.append(createElement("div", "tour-spotlight"), card);
  return root;
}

export function isTourOpen() {
  return overlay !== null;
}

/**
 * Starts the tour from the first step. `closed()` runs when it's finished or
 * skipped, so the app can remember the player has seen it.
 */
export function startTour({ closed = () => {} } = {}) {
  if (overlay) return;
  onClose = closed;
  overlay = buildOverlay();
  document.body.append(overlay);
  document.body.classList.add("tour-open");
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);
  document.addEventListener("keydown", handleKey, true);
  showStep(0);
}
