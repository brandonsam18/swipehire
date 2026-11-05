// Pop-up messages and confetti for game moments.

const TOAST_DURATION_MS = 2800;
// Older messages make room so pop-ups never cover the whole screen.
const MAX_TOASTS = 3;
const CONFETTI_DURATION_MS = 1800;
// The app's two colors (Ocean and Dreamy) and shades between them.
const CONFETTI_COLORS = ["#006989", "#eaebed", "#2a7c95", "#9cc2cf", "#00546e"];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let toastStack;

/**
 * Shows a short message at the top of the screen, clear of the deck buttons.
 * Hovering over it (or tapping it) dismisses it early. Variants: "xp", "quest", "trophy", "level".
 */
export function showToast(text, variant = "xp") {
  if (!toastStack) {
    toastStack = document.createElement("div");
    toastStack.className = "toast-stack";
    toastStack.setAttribute("role", "status");
    toastStack.setAttribute("aria-live", "polite");
    document.body.append(toastStack);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${variant}`;
  toast.textContent = text;
  toastStack.append(toast);
  while (toastStack.children.length > MAX_TOASTS) toastStack.firstElementChild.remove();

  const dismiss = () => {
    if (toast.classList.contains("leaving")) return;
    toast.classList.add("leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  };
  toast.addEventListener("pointerenter", dismiss);
  toast.addEventListener("click", dismiss);
  setTimeout(dismiss, TOAST_DURATION_MS);
}

/** Bursts confetti from the middle of the screen. Skipped when the device asks for less motion. */
export function burstConfetti(pieceCount = 120) {
  if (reducedMotion.matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.append(canvas);
  const context = canvas.getContext("2d");

  const pieces = Array.from({ length: pieceCount }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 10;
    return {
      x: canvas.width / 2,
      y: canvas.height / 2.5,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - 6,
      size: 6 + Math.random() * 6,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    };
  });

  const start = performance.now();
  function frame(time) {
    const elapsed = time - start;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = Math.max(0, 1 - elapsed / CONFETTI_DURATION_MS);
    for (const piece of pieces) {
      piece.velocityY += 0.35;
      piece.velocityX *= 0.99;
      piece.x += piece.velocityX;
      piece.y += piece.velocityY;
      piece.rotation += piece.spin;
      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.fillStyle = piece.color;
      context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
      context.restore();
    }
    if (elapsed < CONFETTI_DURATION_MS) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}
