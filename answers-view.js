// The Answers panel: the player's saved basics and question-and-answer pairs,
// each with a Copy button. Opened from a posting, it fills in {company} and
// {role} with that posting's details. Edits save as the player types.
import { activity, saveActivity } from "./activity.js";
import { MAX_ANSWER_LENGTH, PROFILE_FIELDS, fillIn, hasPlaceholder, newAnswer } from "./answers.js";

const COPIED_FEEDBACK_MS = 1500;

const answersDialog = document.getElementById("answers-dialog");
const contextLine = document.getElementById("answers-context");
const profileList = document.getElementById("profile-fields");
const customList = document.getElementById("custom-answers");

// The posting the panel was opened from, if any.
let currentPosting = null;

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// Puts text on the clipboard. Falls back to a hidden text box for browsers without the Clipboard API.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const helper = createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.className = "visually-hidden";
    answersDialog.append(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    return copied;
  }
}

/** A Copy button for whatever `getText()` returns, filled in for the current posting. */
function createCopyButton(getText, label) {
  const button = createElement("button", "button button-secondary copy-button", "Copy");
  button.type = "button";
  button.setAttribute("aria-label", `Copy ${label}`);
  const update = () => {
    button.disabled = !getText().trim();
  };
  button.addEventListener("click", async () => {
    const copied = await copyText(fillIn(getText(), currentPosting));
    button.textContent = copied ? "✓ Copied" : "Couldn't copy";
    button.classList.toggle("copied", copied);
    setTimeout(() => {
      button.textContent = "Copy";
      button.classList.remove("copied");
    }, COPIED_FEEDBACK_MS);
  });
  update();
  return { button, update };
}

function renderProfile() {
  const profile = activity.answers.profile;
  profileList.replaceChildren(
    ...PROFILE_FIELDS.map((field) => {
      const row = createElement("li", "answer-row");
      const inputId = `profile-${field.id}`;
      const label = createElement("label", "answer-label", field.label);
      label.htmlFor = inputId;
      const input = createElement("input", "answer-input");
      input.id = inputId;
      input.type = field.type;
      input.autocomplete = field.autocomplete;
      input.maxLength = 200;
      input.placeholder = field.placeholder ?? "";
      input.value = profile[field.id] ?? "";
      const { button, update } = createCopyButton(() => input.value, field.label);
      input.addEventListener("input", () => {
        profile[field.id] = input.value.trim();
        update();
        saveActivity();
      });
      const inputRow = createElement("div", "answer-input-row");
      inputRow.append(input, button);
      row.append(label, inputRow);
      return row;
    }),
  );
}

function createCustomAnswer(entry) {
  const item = createElement("li", "answer-card");
  const question = createElement("input", "answer-question");
  question.type = "text";
  question.maxLength = 300;
  question.placeholder = "Question, like “Why do you want to work at {company}?”";
  question.value = entry.question;
  question.setAttribute("aria-label", "Question");

  const answer = createElement("textarea", "answer-text");
  answer.rows = 4;
  answer.maxLength = MAX_ANSWER_LENGTH;
  answer.placeholder = "Your answer. Write {company} or {role} to have them filled in.";
  answer.value = entry.answer;
  answer.setAttribute("aria-label", `Answer to ${entry.question || "this question"}`);

  const preview = createElement("p", "answer-preview");
  const { button: copyButton, update } = createCopyButton(() => answer.value, entry.question || "answer");
  const deleteButton = createElement("button", "button button-secondary delete-answer", "Delete");
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Delete ${entry.question || "this answer"}`);
  deleteButton.addEventListener("click", () => {
    const hasText = entry.question.trim() || entry.answer.trim();
    if (hasText && !window.confirm(`Delete “${entry.question || "this answer"}”? This can't be undone.`)) return;
    activity.answers.custom = activity.answers.custom.filter((candidate) => candidate.id !== entry.id);
    saveActivity();
    renderCustomAnswers();
  });

  // Shows what the copy will say for this posting when the answer uses {company} or {role}.
  const updatePreview = () => {
    const showPreview = currentPosting && hasPlaceholder(answer.value);
    preview.hidden = !showPreview;
    preview.textContent = showPreview ? `Copies as: ${fillIn(answer.value, currentPosting)}` : "";
  };

  question.addEventListener("input", () => {
    entry.question = question.value;
    saveActivity();
  });
  answer.addEventListener("input", () => {
    entry.answer = answer.value;
    update();
    updatePreview();
    saveActivity();
  });
  updatePreview();

  const buttons = createElement("div", "answer-buttons");
  buttons.append(deleteButton, copyButton);
  item.append(question, answer, preview, buttons);
  return item;
}

function renderCustomAnswers() {
  const entries = activity.answers.custom;
  customList.replaceChildren(...entries.map(createCustomAnswer));
  if (entries.length === 0) {
    customList.append(createElement("li", "locker-empty", "No saved answers yet. Add one for a question you see often."));
  }
}

function renderContext() {
  contextLine.textContent = currentPosting
    ? `Filling in for ${currentPosting.company_name}: ${currentPosting.title}. {company} and {role} are filled in when you copy.`
    : "Open this from a posting's 📋 button to fill in {company} and {role} automatically.";
}

function renderAnswers() {
  renderContext();
  renderProfile();
  renderCustomAnswers();
}

/** Opens the Answers panel, filling in {company} and {role} from `posting` if given. */
export function openAnswers(posting = null) {
  currentPosting = posting;
  renderAnswers();
  answersDialog.showModal();
}

/** Redraws the panel if it's open (for example, after logging in loads different answers). */
export function refreshAnswers() {
  if (answersDialog.open) renderAnswers();
}

export function setUpAnswers() {
  document.getElementById("answers-close").addEventListener("click", () => answersDialog.close());
  answersDialog.addEventListener("click", (event) => {
    if (event.target === answersDialog) answersDialog.close();
  });
  document.getElementById("add-answer-button").addEventListener("click", () => {
    activity.answers.custom.push(newAnswer());
    saveActivity();
    renderCustomAnswers();
    customList.querySelector(".answer-card:last-child .answer-question")?.focus();
  });
}
