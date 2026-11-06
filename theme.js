// Light / dark mode. The page starts with the theme set by the script in
// index.html's <head>; this module runs the sun/moon toggle button.

const THEME_STORAGE_KEY = "theme";
const deviceDarkMode = window.matchMedia("(prefers-color-scheme: dark)");

function savedTheme() {
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    return theme === "light" || theme === "dark" ? theme : null;
  } catch {
    return null;
  }
}

function applyTheme(theme, button) {
  document.documentElement.dataset.theme = theme;
  const otherTheme = theme === "dark" ? "light" : "dark";
  button.textContent = theme === "dark" ? "☀️" : "🌙";
  button.setAttribute("aria-label", `Switch to ${otherTheme} mode`);
  button.title = `Switch to ${otherTheme} mode`;
}

/** Wires up the toggle button. Until the player picks a theme, it follows the device setting. */
export function setUpThemeToggle(button) {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light", button);

  button.addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(theme, button);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The switch still works for this visit; it just won't be remembered.
    }
  });

  deviceDarkMode.addEventListener("change", (event) => {
    if (!savedTheme()) applyTheme(event.matches ? "dark" : "light", button);
  });
}

const PALETTE_STORAGE_KEY = "palette";
const DEFAULT_PALETTE = "teal";
// Each theme's color for the browser bar on phones. The logo itself never changes.
const PALETTE_BAR_COLORS = {
  teal: "#3d8d7a",
  ocean: "#006989",
  classic: "#7c3aed",
};

/** Shows a shop theme's colors (see [data-palette] in styles.css) and remembers it for the next visit. */
export function applyPalette(paletteId) {
  const id = PALETTE_BAR_COLORS[paletteId] ? paletteId : DEFAULT_PALETTE;
  if (id !== DEFAULT_PALETTE) {
    document.documentElement.dataset.palette = id;
  } else {
    delete document.documentElement.dataset.palette;
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PALETTE_BAR_COLORS[id]);
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, id);
  } catch {
    // The theme still shows; it just won't be ready before the page loads next time.
  }
}
