"use client";

import { deleteDoc, doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { getFirebaseServices } from "./firebase";

export async function startAdminEditSession(targetTeacherId:string,minutes=15){
  const services=getFirebaseServices();
  const user=services?.auth.currentUser;
  if(!services||!user||user.isAnonymous)throw new Error("Sesi admin tidak sah");
  const expiresAtMs=Date.now()+minutes*60*1000;
  await setDoc(doc(services.db,"adminEditSessions",user.uid),{
    adminUid:user.uid,
    targetTeacherId,
    expiresAt:Timestamp.fromMillis(expiresAtMs),
    createdAt:serverTimestamp(),
  },{merge:false});
  return expiresAtMs;
}

export async function endAdminEditSession(){
  const services=getFirebaseServices();
  const user=services?.auth.currentUser;
  if(!services||!user||user.isAnonymous)return;
  try{await deleteDoc(doc(services.db,"adminEditSessions",user.uid))}catch{}
}
