"use client";

import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "./firebase";

export type StudentLoginMode = "legacy-pin" | "double-confirm";

export async function getStudentLoginMode():Promise<StudentLoginMode>{
  const services=getFirebaseServices();
  if(!services)return "legacy-pin";
  try{
    const snap=await getDoc(doc(services.db,"settings","system"));
    if(!snap.exists())return "legacy-pin";
    return snap.data()?.studentLoginMode==="double-confirm"?"double-confirm":"legacy-pin";
  }catch{
    return "legacy-pin";
  }
}
