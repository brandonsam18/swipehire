// Accounts and cloud saves, using Firebase Authentication and Cloud Firestore.
// Firebase is only downloaded when firebase-config.js has a project config;
// without one the app runs in guest mode, saving progress in the browser.
import { FIREBASE_CONFIG } from "./firebase-config.js";

const FIREBASE_URL = "https://www.gstatic.com/firebasejs/13.2.0";

export const accountsAvailable = Boolean(FIREBASE_CONFIG);

let firebase = null;

async function loadFirebase() {
  if (firebase) return firebase;
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`${FIREBASE_URL}/firebase-app.js`),
    import(`${FIREBASE_URL}/firebase-auth.js`),
    import(`${FIREBASE_URL}/firebase-firestore.js`),
  ]);
  const app = appModule.initializeApp(FIREBASE_CONFIG);
  firebase = {
    auth: authModule.getAuth(app),
    db: firestoreModule.getFirestore(app),
    ...authModule,
    ...firestoreModule,
  };
  return firebase;
}

/**
 * Calls onChange(user) with the signed-in user (or null) right away and again
 * whenever someone logs in or out. Falls back to guest mode if Firebase can't load.
 */
export async function watchUser(onChange) {
  if (!accountsAvailable) {
    onChange(null);
    return;
  }
  try {
    const { auth, onAuthStateChanged } = await loadFirebase();
    onAuthStateChanged(auth, onChange);
  } catch {
    onChange(null);
  }
}

export async function createAccount(email, password) {
  const { auth, createUserWithEmailAndPassword } = await loadFirebase();
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function logIn(email, password) {
  const { auth, signInWithEmailAndPassword } = await loadFirebase();
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logInWithGoogle() {
  const { auth, signInWithPopup, GoogleAuthProvider } = await loadFirebase();
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function sendPasswordReset(email) {
  const { auth, sendPasswordResetEmail } = await loadFirebase();
  await sendPasswordResetEmail(auth, email);
}

export async function logOut() {
  const { auth, signOut } = await loadFirebase();
  await signOut(auth);
}

/** The player's saved progress, or null for a brand-new account. */
export async function loadCloudProgress(userId) {
  const { db, doc, getDoc } = await loadFirebase();
  const snapshot = await getDoc(doc(db, "users", userId));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveCloudProgress(userId, progress) {
  const { db, doc, setDoc, serverTimestamp } = await loadFirebase();
  await setDoc(doc(db, "users", userId), { ...progress, updatedAt: serverTimestamp() });
}

const ERROR_MESSAGES = {
  "auth/invalid-email": "That doesn't look like an email address.",
  "auth/invalid-credential": "Wrong email or password.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/user-not-found": "No account uses that email yet. Create one instead?",
  "auth/email-already-in-use": "An account already uses that email. Try logging in instead.",
  "auth/weak-password": "Passwords need at least 6 characters.",
  "auth/missing-password": "Enter your password.",
  "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
  "auth/network-request-failed": "Couldn't reach the server. Check your connection.",
  "auth/popup-closed-by-user": "The Google window was closed before signing in.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups and try again.",
  "auth/unauthorized-domain": "This website isn't on the Firebase project's allowed list yet.",
};

/** A message a player can act on, for a Firebase error. */
export function friendlyError(error) {
  return ERROR_MESSAGES[error?.code] ?? "Something went wrong. Check your connection and try again.";
}
