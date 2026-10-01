"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ("AIzaSyCWJE" + "cgxR097iuw0AztYFJ7OIPUT3de-Oc"),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "geoboost-tingkatan-2.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "geoboost-tingkatan-2",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "geoboost-tingkatan-2.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "28554239431",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:28554239431:web:db0974d2b9658762244de2",
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

export function getFirebaseServices() {
  if (!firebaseConfigured || typeof window === "undefined") return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { app, auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
}

export async function ensureAnonymousFirebaseUser(): Promise<User | null> {
  const services = getFirebaseServices();
  if (!services) return null;
  if (services.auth.currentUser?.isAnonymous) return services.auth.currentUser;
  if (services.auth.currentUser && !services.auth.currentUser.isAnonymous) await signOut(services.auth);
  const credential = await signInAnonymously(services.auth);
  return credential.user;
}

export async function signInTeacherWithGoogle(): Promise<User | null> {
  const services = getFirebaseServices();
  if (!services) return null;
  if (services.auth.currentUser && !services.auth.currentUser.isAnonymous) return services.auth.currentUser;
  if (services.auth.currentUser?.isAnonymous) await signOut(services.auth);

  const provider = new GoogleAuthProvider();
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  if (isMobile) {
    await signInWithRedirect(services.auth, provider);
    return null;
  }

  try {
    const credential = await signInWithPopup(services.auth, provider);
    return credential.user;
  } catch (error: any) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(error?.code)) {
      await signInWithRedirect(services.auth, provider);
      return null;
    }
    throw error;
  }
}

export function watchFirebaseAuth(callback: (user: User | null) => void) {
  const services = getFirebaseServices();
  if (!services) return () => {};
  return onAuthStateChanged(services.auth, callback);
}

export async function signOutFirebaseUser() {
  const services = getFirebaseServices();
  if (!services) return;
  await signOut(services.auth);
}
