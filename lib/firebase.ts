"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
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
  const credential = await signInWithPopup(services.auth, new GoogleAuthProvider());
  return credential.user;
}

export async function signOutFirebaseUser() {
  const services = getFirebaseServices();
  if (!services) return;
  await signOut(services.auth);
}
