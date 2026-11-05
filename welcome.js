// The loading screen shown while internships download, and the welcome screen
// where players log in, create an account, or continue as a guest.
import { accountsAvailable, createAccount, friendlyError, logIn, logInWithGoogle, sendPasswordReset } from "./account.js";

const TIPS = [
  "Tip: swipe right to save a posting for later.",
  "Tip: postings under 3 days old are worth +25 bonus XP.",
  "Tip: apply 3 days in a row to unlock 🔥 On Fire.",
  "Tip: use the Field filter to get a deck of just your major's internships.",
  "Tip: press ↑ on your keyboard to mark the top card applied.",
];
const TIP_INTERVAL_MS = 2400;
const SPLASH_FADE_MS = 350;
const MIN_PASSWORD_LENGTH = 6;

const splash = document.getElementById("splash");
const loadingSection = document.getElementById("splash-loading");
const statusText = document.getElementById("splash-status");
const tipText = document.getElementById("splash-tip");
const errorSection = document.getElementById("splash-error");
const errorText = document.getElementById("splash-error-text");
const retryButton = document.getElementById("splash-retry");
const welcomeSection = document.getElementById("welcome");
const closeButton = document.getElementById("splash-close");
const accountOptions = document.getElementById("account-options");
const accountsUnavailable = document.getElementById("accounts-unavailable");
const authTabs = document.querySelectorAll(".auth-tab");
const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("auth-email");
const passwordInput = document.getElementById("auth-password");
const authMessage = document.getElementById("auth-message");
const submitButton = document.getElementById("auth-submit");
const forgotPasswordButton = document.getElementById("forgot-password");
const googleButton = document.getElementById("google-sign-in");
const guestButton = document.getElementById("guest-button");

let authMode = "log-in";
let tipTimer = null;
let retryHandler = null;

function showSection(section) {
  for (const candidate of [loadingSection, errorSection, welcomeSection]) {
    candidate.hidden = candidate !== section;
  }
}

function openSplash() {
  splash.hidden = false;
  splash.classList.remove("leaving");
  document.body.classList.add("splash-open");
}

function startTips() {
  let tipIndex = 0;
  tipText.textContent = TIPS[tipIndex];
  clearInterval(tipTimer);
  tipTimer = setInterval(() => {
    tipIndex = (tipIndex + 1) % TIPS.length;
    tipText.textContent = TIPS[tipIndex];
  }, TIP_INTERVAL_MS);
}

export function isSplashOpen() {
  return !splash.hidden;
}

export function showLoadingScreen() {
  openSplash();
  closeButton.hidden = true;
  showSection(loadingSection);
  statusText.textContent = "Shuffling the deck…";
  startTips();
}

export function setLoadingStatus(text) {
  statusText.textContent = text;
}

/** Shows what went wrong while loading, with a button that runs onRetry. */
export function showLoadingError(text, onRetry) {
  clearInterval(tipTimer);
  openSplash();
  showSection(errorSection);
  errorText.textContent = text;
  retryHandler = onRetry;
}

/** closable adds a ✕ for getting back to the game (when opened from the Log in button). */
export function showWelcomeScreen({ closable }) {
  clearInterval(tipTimer);
  openSplash();
  showSection(welcomeSection);
  closeButton.hidden = !closable;
  accountOptions.hidden = !accountsAvailable;
  accountsUnavailable.hidden = accountsAvailable;
  setBusy(false);
  showAuthMessage("");
  if (accountsAvailable) emailInput.focus();
}

export function hideSplash() {
  clearInterval(tipTimer);
  document.body.classList.remove("splash-open");
  splash.classList.add("leaving");
  setTimeout(() => {
    splash.hidden = true;
    splash.classList.remove("leaving");
    passwordInput.value = "";
  }, SPLASH_FADE_MS);
}

function showAuthMessage(text, kind = "error") {
  authMessage.textContent = text;
  authMessage.hidden = !text;
  authMessage.classList.toggle("info", kind === "info");
}

function setBusy(isBusy, label) {
  for (const control of [submitButton, googleButton, forgotPasswordButton, guestButton, emailInput, passwordInput]) {
    control.disabled = isBusy;
  }
  submitButton.textContent = isBusy ? label : authMode === "log-in" ? "Log in" : "Create account";
}

function selectAuthMode(mode) {
  authMode = mode;
  for (const tab of authTabs) tab.setAttribute("aria-selected", String(tab.dataset.authMode === mode));
  submitButton.textContent = mode === "log-in" ? "Log in" : "Create account";
  passwordInput.autocomplete = mode === "log-in" ? "current-password" : "new-password";
  forgotPasswordButton.hidden = mode !== "log-in";
  showAuthMessage("");
}

// Problems we can catch before asking the server, or null if the form looks fine.
function formProblem(email, password) {
  if (!email) return "Enter your email address.";
  if (!emailInput.checkValidity()) return "That doesn't look like an email address.";
  if (!password) return "Enter your password.";
  if (authMode === "sign-up" && password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

async function submitAuthForm(event) {
  event.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const problem = formProblem(email, password);
  if (problem) {
    showAuthMessage(problem);
    return;
  }
  showAuthMessage("");
  setBusy(true, authMode === "log-in" ? "Logging in…" : "Creating account…");
  try {
    // On success, the app hears about the new user and closes this screen.
    await (authMode === "log-in" ? logIn(email, password) : createAccount(email, password));
  } catch (error) {
    setBusy(false);
    showAuthMessage(friendlyError(error));
  }
}

async function signInWithGoogle() {
  showAuthMessage("");
  setBusy(true, "Waiting for Google…");
  try {
    await logInWithGoogle();
  } catch (error) {
    setBusy(false);
    showAuthMessage(friendlyError(error));
  }
}

async function resetPassword() {
  const email = emailInput.value.trim();
  if (!email || !emailInput.checkValidity()) {
    showAuthMessage("Type your email above first, then press \"Forgot password?\" again.");
    return;
  }
  try {
    await sendPasswordReset(email);
    showAuthMessage(`If an account uses ${email}, a reset link is on its way. Check your inbox.`, "info");
  } catch (error) {
    showAuthMessage(friendlyError(error));
  }
}

/** Wires up the welcome screen. onGuest runs when the player chooses to play as a guest. */
export function setUpWelcomeScreen({ onGuest }) {
  for (const tab of authTabs) tab.addEventListener("click", () => selectAuthMode(tab.dataset.authMode));
  authForm.addEventListener("submit", submitAuthForm);
  googleButton.addEventListener("click", signInWithGoogle);
  forgotPasswordButton.addEventListener("click", resetPassword);
  guestButton.addEventListener("click", onGuest);
  closeButton.addEventListener("click", hideSplash);
  retryButton.addEventListener("click", () => retryHandler?.());
}
