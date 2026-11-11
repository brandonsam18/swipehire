import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTER_QUESTIONS, emptyAnswers, fillIn, hasPlaceholder, mergeAnswers, newAnswer } from "../answers.js";

const posting = { company_name: "Google", title: "Software Engineering Intern" };

test("{company} and {role} are filled in from the posting", () => {
  const text = "I want to join {company} as a {role} because {Company} builds things I use.";
  assert.equal(
    fillIn(text, posting),
    "I want to join Google as a Software Engineering Intern because Google builds things I use.",
  );
});

test("without a posting, placeholders stay so the player can see them", () => {
  assert.equal(fillIn("Why {company}?"), "Why {company}?");
  assert.equal(hasPlaceholder("Why {company}?"), true);
  assert.equal(hasPlaceholder("Plain answer"), false);
});

test("new players start with the common questions and empty basics", () => {
  const answers = emptyAnswers();
  assert.deepEqual(answers.profile, {});
  assert.deepEqual(answers.custom.map((entry) => entry.question), STARTER_QUESTIONS);
  assert.notEqual(answers.custom[0].id, answers.custom[1].id);
});

test("merging guest answers into an account keeps the account's basics and both sides' written answers", () => {
  const account = { profile: { email: "me@school.edu", phone: "" }, custom: [{ ...newAnswer("Why us?"), answer: "Account answer" }] };
  const guest = {
    profile: { email: "old@mail.com", phone: "555-0100" },
    custom: [{ ...newAnswer("Project?"), answer: "Guest answer" }, newAnswer("Unanswered starter")],
  };
  const merged = mergeAnswers(account, guest);
  assert.deepEqual(merged.profile, { email: "me@school.edu", phone: "555-0100" });
  assert.deepEqual(merged.custom.map((entry) => entry.answer), ["Account answer", "Guest answer"]);
});
