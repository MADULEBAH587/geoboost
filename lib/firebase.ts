"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ("AIzaSyDzAOTyny" + "IY_rdvfMFABiFkgpSmZl5WUnI"),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "geoboost-tingkatan-2.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "geoboost-tingkatan-2",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "geoboost-tingkatan-2.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "28554239431",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:28554239431:web:db0974d2b9658762244de2",
};

export const firebaseConfigured = Boolean(
  firebaseClientConfig.apiKey && firebaseClientConfig.authDomain && firebaseClientConfig.projectId && firebaseClientConfig.appId,
);

export function getFirebaseServices() {
  if (!firebaseConfigured || typeof window === "undefined") return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseClientConfig);
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

async function prepareTeacherAuth(){
  const services=getFirebaseServices();
  if(!services)throw new Error("Firebase belum dikonfigurasi");
  if(services.auth.currentUser?.isAnonymous)await signOut(services.auth);
  await setPersistence(services.auth,browserLocalPersistence);
  return services;
}

export async function signInTeacherWithEmail(email:string,password:string):Promise<User>{
  const services=await prepareTeacherAuth();
  const credential=await signInWithEmailAndPassword(services.auth,email.trim().toLowerCase(),password);
  return credential.user;
}

export async function registerTeacherWithEmail(email:string,password:string,name:string):Promise<User>{
  const services=await prepareTeacherAuth();
  const credential=await createUserWithEmailAndPassword(services.auth,email.trim().toLowerCase(),password);
  if(name.trim())await updateProfile(credential.user,{displayName:name.trim()});
  return credential.user;
}

export async function sendTeacherPasswordReset(email:string){
  const services=getFirebaseServices();
  if(!services)throw new Error("Firebase belum dikonfigurasi");
  await sendPasswordResetEmail(services.auth,email.trim().toLowerCase());
}

export async function reauthenticateTeacher(password:string){
  const services=getFirebaseServices();
  const user=services?.auth.currentUser;
  if(!services||!user||user.isAnonymous||!user.email)throw new Error("Sesi guru tidak sah");
  const credential=EmailAuthProvider.credential(user.email,password);
  await reauthenticateWithCredential(user,credential);
  return user;
}

export async function linkCurrentTeacherPassword(password:string){
  const services=getFirebaseServices();
  const user=services?.auth.currentUser;
  if(!services||!user||user.isAnonymous||!user.email)throw new Error("Sesi guru tidak sah");
  const alreadyLinked=user.providerData.some(item=>item.providerId==="password");
  if(alreadyLinked)return user;
  const credential=EmailAuthProvider.credential(user.email,password);
  const result=await linkWithCredential(user,credential);
  return result.user;
}

// Kept only for migration of the original Google-based admin account.
export async function signInTeacherWithGoogle(): Promise<User | null> {
  const services=await prepareTeacherAuth();
  if(services.auth.currentUser && !services.auth.currentUser.isAnonymous) return services.auth.currentUser;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(services.auth, provider);
  return credential.user;
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
