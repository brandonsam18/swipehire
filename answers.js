// The application helper's saved answers: the basics most applications ask
// for, plus the player's own question-and-answer pairs. Answers can include
// {company} and {role}, which are filled in from the posting being applied to.

export const PROFILE_FIELDS = [
  { id: "name", label: "Full name", type: "text", autocomplete: "name" },
  { id: "email", label: "Email", type: "email", autocomplete: "email" },
  { id: "phone", label: "Phone", type: "tel", autocomplete: "tel" },
  { id: "school", label: "School", type: "text", autocomplete: "organization" },
  { id: "major", label: "Major", type: "text", autocomplete: "off" },
  { id: "graduation", label: "Graduation date", type: "text", autocomplete: "off", placeholder: "May 2028" },
  { id: "gpa", label: "GPA", type: "text", autocomplete: "off", placeholder: "3.7" },
  { id: "linkedin", label: "LinkedIn", type: "url", autocomplete: "url", placeholder: "https://linkedin.com/in/…" },
  { id: "portfolio", label: "Portfolio or GitHub", type: "url", autocomplete: "url", placeholder: "https://…" },
  { id: "location", label: "Location", type: "text", autocomplete: "address-level2", placeholder: "Urbana, IL" },
  { id: "authorization", label: "Work authorization", type: "text", autocomplete: "off", placeholder: "U.S. citizen, no sponsorship needed" },
];

// Questions that come up on many applications, so new players have a place to start.
export const STARTER_QUESTIONS = [
  "Why do you want to work at {company}?",
  "Tell us about a project you're proud of.",
  "Describe a challenge you overcame and what you learned.",
];

// Longest answer we keep, so one runaway paste can't fill up the saved data.
export const MAX_ANSWER_LENGTH = 5000;

function newId() {
  return `answer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** A blank question-and-answer pair. */
export function newAnswer(question = "") {
  return { id: newId(), question, answer: "" };
}

/** Starting answers for a new player: empty basics and the starter questions. */
export function emptyAnswers() {
  return { profile: {}, custom: STARTER_QUESTIONS.map((question) => newAnswer(question)) };
}

/**
 * Fills in {company} and {role} from a posting. Without a posting, the
 * placeholders are left as they are so the player can see where they go.
 */
export function fillIn(text, posting = null) {
  if (!posting) return text;
  return text.replace(/\{company\}/gi, posting.company_name).replace(/\{role\}/gi, posting.title);
}

/** Whether text still has a placeholder that needs a posting to fill in. */
export function hasPlaceholder(text) {
  return /\{(company|role)\}/i.test(text);
}

/**
 * Combines two sets of answers: the first one's basics win where both have a
 * value, and saved answers from both are kept once each. The second set's
 * unanswered questions are skipped, so starter questions aren't doubled.
 */
export function mergeAnswers(primary, secondary) {
  const profile = { ...secondary?.profile };
  for (const [field, value] of Object.entries(primary?.profile ?? {})) {
    if (value) profile[field] = value;
  }
  const custom = [...(primary?.custom ?? [])];
  const ids = new Set(custom.map((answer) => answer.id));
  for (const answer of secondary?.custom ?? []) {
    if (!ids.has(answer.id) && answer.answer) custom.push(answer);
  }
  return { profile, custom };
}
