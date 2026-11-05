# SwipeHire

**Swipe through live tech internships, track every application, and level up while you do it.**

👉 **Try it: [swipehire-app.web.app](https://swipehire-app.web.app)**

Applying to dozens of internships gets messy fast. SwipeHire puts nearly every current software engineering and tech internship in one place, keeps track of where you've applied, and turns the grind into a game so it stays motivating.

## Features

- **Live internship deck.** Over 5,000 current postings, pulled fresh from the community-maintained [SimplifyJobs list](https://github.com/SimplifyJobs/Summer2027-Internships) every time you open the app.
- **Swipe to sort.** Drag a card (or use the arrow keys): left to pass, right to save for later, up when you've applied. Undo anytime.
- **Filters that matter.** 20 specific roles (Backend, Machine Learning, Embedded, Quant, …), 10 metro areas and every US state, degree level, and term.
- **Game layer.** Earn XP for every application, climb 8 levels, keep a daily streak, finish daily quests, and unlock 13 trophies, with confetti.
- **Accounts that follow you.** Log in with email or Google and your progress syncs across your phone and laptop. Or play as a guest.
- **Company logos, light and dark mode,** and a layout that works on phones.

## Built with

- Plain HTML, CSS, and JavaScript (ES modules), with no framework and no build step
- [Firebase](https://firebase.google.com) Authentication and Cloud Firestore for accounts and cloud saves; Firebase Hosting for the live site
- Internship data from [SimplifyJobs](https://github.com/SimplifyJobs/Summer2027-Internships); company logos from Google's favicon service

Each player's progress is stored in their own Firestore document, and security rules allow only that player to read or write it.

## About

Built by Brandon ([@brandonsam18](https://github.com/brandonsam18)) as an independent project for CS 124 at the University of Illinois Urbana-Champaign, Fall 2026.
