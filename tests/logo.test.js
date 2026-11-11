// The SwipeHire logo is neutral charcoal, white, and gray in every shop theme (PLAN.md, 2026-11-06).
// These tests read the files the browser actually loads, so a change that ties the logo to a theme
// color, or regenerated icons in the wrong colors, fails here instead of going live unnoticed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inflateSync } from "node:zlib";

const CHARCOAL = "#1f2328";
const LETTERS = "#ffffff";
const SWIPE_BAR = "#9aa1a9";

const projectFile = (name) => readFileSync(new URL(`../${name}`, import.meta.url));
const projectText = (name) => projectFile(name).toString("utf8");

/** The stroke colors of the S, the H, and the swipe bar, in that order. */
const strokeColors = (svgText) => [...svgText.matchAll(/<path[^>]*stroke="([^"]+)"/g)].map((match) => match[1].toLowerCase());

test("the logo file (browser tab icon) is charcoal with white letters and a gray swipe bar", () => {
  const logo = projectText("logo.svg");
  assert.match(logo, new RegExp(`<rect[^>]*fill="${CHARCOAL}"`, "i"));
  assert.deepEqual(strokeColors(logo), [LETTERS, LETTERS, SWIPE_BAR]);
});

test("the top bar and loading card draw the logo in the same fixed colors", () => {
  const html = projectText("index.html");
  const letters = html.match(/<g id="sh-letters"[\s\S]*?<\/g>/)?.[0];
  assert.ok(letters, "index.html should define the shared #sh-letters drawing");
  assert.deepEqual(strokeColors(letters), [LETTERS, LETTERS, SWIPE_BAR]);

  const topBarMark = html.match(/<svg class="brand-mark"[\s\S]*?<\/svg>/)?.[0];
  assert.ok(topBarMark, "index.html should have the top bar logo");
  assert.match(topBarMark, new RegExp(`<rect[^>]*fill="${CHARCOAL}"`, "i"));

  const css = projectText("styles.css");
  const splashFront = css.match(/\.splash-card-front\s*\{([^}]*)\}/)?.[1];
  assert.ok(splashFront, "styles.css should style the loading card's front card");
  assert.match(splashFront, new RegExp(`background:\\s*${CHARCOAL}\\s*;`, "i"));
});

test("no style rule colors the logo with a theme variable", () => {
  const css = projectText("styles.css");
  const logoSelector = /brand-mark|sh-letters|logo-defs|splash-card-front/;
  const colorWithVariable = /(?:^|[;\s])(?:fill|stroke|color|background(?:-color)?)\s*:[^;]*var\(/;
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (logoSelector.test(selector)) {
      assert.doesNotMatch(body, colorWithVariable, `"${selector.trim()}" ties the logo to a theme color`);
    }
  }
});

/** Decodes an 8-bit RGBA, non-interlaced PNG (how the app icons are saved) into its pixels. */
function decodePng(bytes) {
  assert.equal(bytes.toString("latin1", 1, 4), "PNG", "not a PNG file");
  let width = 0;
  let height = 0;
  const imageData = [];
  for (let offset = 8; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, "icons should use 8 bits per channel");
      assert.equal(data[9], 6, "icons should be RGBA");
      assert.equal(data[12], 0, "icons should not be interlaced");
    } else if (type === "IDAT") {
      imageData.push(data);
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(imageData));
  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const pixels = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (rowLength + 1)];
    const row = raw.subarray(y * (rowLength + 1) + 1, (y + 1) * (rowLength + 1));
    for (let x = 0; x < rowLength; x++) {
      const left = x >= bytesPerPixel ? pixels[y * rowLength + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[(y - 1) * rowLength + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[(y - 1) * rowLength + x - bytesPerPixel] : 0;
      const paeth = () => {
        const estimate = left + up - upLeft;
        const [toLeft, toUp, toUpLeft] = [left, up, upLeft].map((value) => Math.abs(estimate - value));
        if (toLeft <= toUp && toLeft <= toUpLeft) return left;
        return toUp <= toUpLeft ? up : upLeft;
      };
      const predicted = [0, left, up, (left + up) >> 1, paeth()][filter];
      pixels[y * rowLength + x] = (row[x] + predicted) & 0xff;
    }
  }
  return { width, height, colorAt: (fx, fy) => {
    const start = (Math.floor(height * fy) * width + Math.floor(width * fx)) * bytesPerPixel;
    return [...pixels.subarray(start, start + 3)];
  } };
}

const hexToRgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

/** Icons are resized drawings, so their edges blend a little; a teal or purple icon is far outside this. */
function assertCloseTo(actual, hex, what) {
  const expected = hexToRgb(hex);
  const farthest = Math.max(...actual.map((channel, i) => Math.abs(channel - expected[i])));
  assert.ok(farthest <= 12, `${what} is rgb(${actual}), expected about ${hex}`);
}

for (const icon of ["icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"]) {
  test(`the phone icon ${icon} is the charcoal logo`, () => {
    const png = decodePng(projectFile(icon));
    assertCloseTo(png.colorAt(0.5, 0.08), CHARCOAL, `${icon}'s background`);
    assertCloseTo(png.colorAt(0.5, 0.5), SWIPE_BAR, `${icon}'s swipe bar`);
  });
}
