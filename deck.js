// Swipeable card deck for Discover mode. Drag the top card (mouse or finger)
// left, right, or up; letting go past SWIPE_DISTANCE throws it off the deck.

const SWIPE_DISTANCE = 110;
const FLY_OUT_MS = 300;
const VISIBLE_CARDS = 3;

const FLY_OUT_TRANSFORMS = {
  left: "translate(-150vw, 40px) rotate(-30deg)",
  right: "translate(150vw, 40px) rotate(30deg)",
  up: "translate(0, -150vh) rotate(0deg)",
};

const STAMPS = [
  ["right", "stamp-save", "SAVE"],
  ["left", "stamp-pass", "PASS"],
  ["up", "stamp-apply", "APPLIED"],
];

// The card on top of the deck, and what to do when it is swiped.
let topCard = null;
let isFlying = false;

function directionOf(deltaX, deltaY) {
  if (-deltaY > SWIPE_DISTANCE && -deltaY > Math.abs(deltaX)) return "up";
  if (deltaX > SWIPE_DISTANCE) return "right";
  if (deltaX < -SWIPE_DISTANCE) return "left";
  return null;
}

function showStamps(card, deltaX, deltaY) {
  const strength = {
    right: Math.max(0, deltaX) / SWIPE_DISTANCE,
    left: Math.max(0, -deltaX) / SWIPE_DISTANCE,
    up: -deltaY > Math.abs(deltaX) ? Math.max(0, -deltaY) / SWIPE_DISTANCE : 0,
  };
  for (const [direction, className] of STAMPS) {
    card.querySelector(`.${className}`).style.opacity = String(Math.min(1, strength[direction]));
  }
}

function enableDragging(card, onRelease) {
  let start = null;

  card.addEventListener("pointerdown", (event) => {
    // Let links and buttons on the card work normally.
    if (event.target.closest("a, button") || isFlying) return;
    start = { x: event.clientX, y: event.clientY };
    card.setPointerCapture(event.pointerId);
    card.classList.add("dragging");
  });

  card.addEventListener("pointermove", (event) => {
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    card.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${deltaX / 18}deg)`;
    showStamps(card, deltaX, deltaY);
  });

  const release = (event) => {
    if (!start) return;
    const direction = directionOf(event.clientX - start.x, event.clientY - start.y);
    start = null;
    card.classList.remove("dragging");
    if (direction) {
      onRelease(direction);
    } else {
      card.style.transform = "";
      showStamps(card, 0, 0);
    }
  };
  card.addEventListener("pointerup", release);
  card.addEventListener("pointercancel", release);
}

/**
 * Shows the first few postings as a stacked deck.
 * buildCardContent(posting) returns the card's inner element.
 * onSwipe(posting, direction) runs after the top card leaves, with "left", "right", or "up".
 */
export function renderDeck(deckElement, postings, buildCardContent, onSwipe) {
  const visible = postings.slice(0, VISIBLE_CARDS);
  const cards = visible.map((posting, depth) => {
    const card = document.createElement("article");
    card.className = "deck-card";
    card.style.setProperty("--depth", String(depth));
    card.append(buildCardContent(posting));
    for (const [, className, label] of STAMPS) {
      const stamp = document.createElement("span");
      stamp.className = `stamp ${className}`;
      stamp.textContent = label;
      stamp.setAttribute("aria-hidden", "true");
      card.append(stamp);
    }
    return card;
  });

  topCard = null;
  if (cards.length > 0) {
    const [card] = cards;
    card.classList.add("top");
    topCard = { card, posting: visible[0], onSwipe };
    enableDragging(card, (direction) => swipeTopCard(direction));
  }
  // The top card goes last so it is drawn above the others.
  deckElement.replaceChildren(...cards.reverse());
}

/** Throws the top card off the deck, as if it were swiped in that direction. */
export function swipeTopCard(direction) {
  if (!topCard || isFlying) return;
  const { card, posting, onSwipe } = topCard;
  isFlying = true;
  card.classList.add("flying");
  showStamps(card, direction === "right" ? SWIPE_DISTANCE : direction === "left" ? -SWIPE_DISTANCE : 0, direction === "up" ? -SWIPE_DISTANCE : 0);
  card.style.transform = FLY_OUT_TRANSFORMS[direction];
  setTimeout(() => {
    isFlying = false;
    onSwipe(posting, direction);
  }, FLY_OUT_MS);
}
