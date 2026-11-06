// The game's coin. Messages are written with 🪙 (easy to read in code and
// tests), and this swaps each one for the drawn gold coin in coin.svg, which
// looks the same on every device (the emoji is a dull silver on some).

export const COIN = "🪙";

function createCoinIcon() {
  const icon = document.createElement("img");
  icon.src = "coin.svg";
  icon.alt = "coins";
  icon.className = "coin-icon";
  return icon;
}

/** Sets an element's text, showing each 🪙 as the coin icon. */
export function setTextWithCoins(element, text) {
  const parts = text.split(COIN);
  element.replaceChildren();
  parts.forEach((part, index) => {
    if (index > 0) element.append(createCoinIcon());
    if (part) element.append(part);
  });
}
