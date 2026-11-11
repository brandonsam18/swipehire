// Celebrations: the animation that plays when the player applies, chosen in
// the locker (see items.js). Each is drawn here with a canvas or a few
// animated elements, so they look the same everywhere and load instantly.
import { burstConfetti, effectsLayer } from "./celebrate.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Bright colors for fireworks and sparkles; celebrations are the same in every theme.
const SPARK_COLORS = ["#f6c343", "#ff6b6b", "#4dd4ff", "#a78bfa", "#6ee7a0", "#ffffff"];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomColor() {
  return SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)];
}

/**
 * Runs a full-screen canvas animation. `draw(context, elapsed, size)` is called
 * every frame until `durationMs` passes, then the canvas is removed.
 */
function runCanvas(durationMs, draw) {
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  effectsLayer().append(canvas);
  const context = canvas.getContext("2d");
  const start = performance.now();
  function frame(time) {
    const elapsed = time - start;
    context.clearRect(0, 0, canvas.width, canvas.height);
    draw(context, elapsed, { width: canvas.width, height: canvas.height });
    if (elapsed < durationMs) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}

function coinRain() {
  const coin = new Image();
  coin.src = "coin.svg";
  const coins = Array.from({ length: 40 }, () => ({
    x: Math.random(),
    startY: randomBetween(-0.35, -0.02),
    size: randomBetween(22, 40),
    // Screen heights per second, so coins fall at the same speed on every device.
    speed: randomBetween(0.55, 0.95),
    spinSpeed: randomBetween(6, 10),
  }));
  runCanvas(2200, (context, elapsed, { width, height }) => {
    const seconds = elapsed / 1000;
    context.globalAlpha = Math.min(1, (2200 - elapsed) / 400);
    for (const piece of coins) {
      const y = (piece.startY + piece.speed * seconds) * height;
      // Squashing the coin's width makes it look like it's flipping as it falls.
      const flip = Math.abs(Math.cos(piece.spinSpeed * seconds));
      context.drawImage(coin, piece.x * width - (piece.size * flip) / 2, y, piece.size * flip, piece.size);
    }
  });
}

function fireworks() {
  const bursts = Array.from({ length: 5 }, (_, index) => ({
    x: randomBetween(0.2, 0.8),
    y: randomBetween(0.15, 0.45),
    at: index * 280,
    color: randomColor(),
    sparks: Array.from({ length: 36 }, (_, spark) => ({
      angle: (spark / 36) * Math.PI * 2,
      speed: randomBetween(2.2, 4.2),
    })),
  }));
  runCanvas(2400, (context, elapsed, { width, height }) => {
    for (const burst of bursts) {
      const age = elapsed - burst.at;
      if (age < 0 || age > 1200) continue;
      const fade = 1 - age / 1200;
      context.globalAlpha = fade;
      context.fillStyle = burst.color;
      for (const spark of burst.sparks) {
        const distance = spark.speed * age * 0.09;
        const x = burst.x * width + Math.cos(spark.angle) * distance;
        // Sparks drift down a little as they fade, like real fireworks.
        const y = burst.y * height + Math.sin(spark.angle) * distance + (age * age) / 40000;
        context.beginPath();
        context.arc(x, y, 2.6 * fade + 0.8, 0, Math.PI * 2);
        context.fill();
      }
    }
  });
}

// Adds an element that plays a CSS animation once, then removes itself.
function playOverlay(className, content) {
  const overlay = document.createElement("div");
  overlay.className = `celebration-overlay ${className}`;
  overlay.setAttribute("aria-hidden", "true");
  overlay.append(...content);
  effectsLayer().append(overlay);
  overlay.addEventListener("animationend", (event) => {
    if (event.target === overlay) overlay.remove();
  });
}

function emojiElement(className, emoji) {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = emoji;
  return element;
}

function rocketLaunch() {
  playOverlay("rocket-launch", [emojiElement("rocket", "🚀")]);
  const sparks = Array.from({ length: 70 }, () => ({
    x: 0.5 + randomBetween(-0.03, 0.03),
    startAt: randomBetween(0, 1100),
    drift: randomBetween(-1.5, 1.5),
    color: randomColor(),
  }));
  runCanvas(1900, (context, elapsed, { width, height }) => {
    // The rocket climbs from the bottom to above the top in 1.4 seconds (see .rocket in styles.css).
    for (const spark of sparks) {
      const age = elapsed - spark.startAt;
      if (age < 0 || age > 700) continue;
      const launchY = height * (1 - spark.startAt / 1400) + 30;
      context.globalAlpha = 1 - age / 700;
      context.fillStyle = spark.color;
      context.beginPath();
      context.arc(spark.x * width + spark.drift * age * 0.06, launchY + age * 0.08, 3, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function trophyDance() {
  const stars = Array.from({ length: 8 }, (_, index) => {
    const star = emojiElement("trophy-star", "⭐");
    star.style.setProperty("--angle", `${index * 45}deg`);
    return star;
  });
  playOverlay("trophy-dance", [emojiElement("dancing-trophy", "🏆"), ...stars]);
  burstConfetti(60);
}

const CELEBRATIONS = {
  confetti: () => burstConfetti(80),
  "coin-rain": coinRain,
  fireworks,
  rocket: rocketLaunch,
  "trophy-dance": trophyDance,
};

/** Plays a celebration by its item id, falling back to confetti. Skipped when the device asks for less motion. */
export function playCelebration(celebrationId) {
  if (reducedMotion.matches) return;
  (CELEBRATIONS[celebrationId] ?? CELEBRATIONS.confetti)();
}
