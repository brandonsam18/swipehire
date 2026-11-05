# SwipeHire

**Swipe through live internships in every field, track every application, and level up while you do it.**

👉 **Try it: [swipehire-app.web.app](https://swipehire-app.web.app)**

Applying to dozens of internships gets messy fast. SwipeHire puts thousands of current internships for every major, from business and healthcare to the arts and engineering, in one place, keeps track of where you've applied, and turns the grind into a game so it stays motivating.

## Features

- **Live internship deck.** Over 6,000 current postings: internships in every field from [Adzuna](https://www.adzuna.com), refreshed daily by a GitHub Action, plus computing internships from the community-maintained [SimplifyJobs list](https://github.com/SimplifyJobs/Summer2027-Internships).
- **Swipe to sort.** Drag a card (or use the arrow keys): left to pass, right to save for later, up when you've applied. Undo anytime.
- **Filters that matter.** 12 fields (Business & Finance, Healthcare, Education, Arts & Design, …), specific roles within computing, 10 metro areas and every US state, degree level, and term.
- **Game layer.** Earn XP for every application, climb 8 levels, keep a daily streak, finish daily quests, and unlock 13 trophies, with confetti.
- **Accounts that follow you.** Log in with email or Google and your progress syncs across your phone and laptop. Or play as a guest.
- **Company logos, light and dark mode,** and a layout that works on phones.

## Built with

- Tests with Node's built-in test runner: `npm test`

- Plain HTML, CSS, and JavaScript (ES modules), with no framework and no build step
- [Firebase](https://firebase.google.com) Authentication and Cloud Firestore for accounts and cloud saves; Firebase Hosting for the live site
- Internship data from [Jobs by Adzuna](https://www.adzuna.com) (fetched daily by `scripts/fetch-adzuna.mjs` in a GitHub Action, with the API key kept in repository secrets) and [SimplifyJobs](https://github.com/SimplifyJobs/Summer2027-Internships); company logos from Google's favicon service

Each player's progress is stored in their own Firestore document, and security rules allow only that player to read or write it.

## About

Built by Brandon ([@brandonsam18](https://github.com/brandonsam18)) as an independent project for CS 124 at the University of Illinois Urbana-Champaign, Fall 2026.
