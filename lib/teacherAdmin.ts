"use client";

import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseServices } from "./firebase";

export type TeacherRole = "admin" | "guru" | "viewer";
export type TeacherProfile = {
  uid: string;
  name: string;
  role: TeacherRole;
  active: boolean;
  email?: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  detail: string;
  by: string;
  createdAt: number;
};

const LOCAL_AUDIT_KEY = "geoboost_teacher_audit";

export async function getTeacherProfile(uid: string): Promise<TeacherProfile | null> {
  const services=getFirebaseServices();
  if(!services) return null;
  const snap=await getDoc(doc(services.db,"teachers",uid));
  if(!snap.exists()) return null;
  const data=snap.data() as Record<string,any>;
  const hasRole=["admin","guru","viewer"].includes(data.role);
  const role=(hasRole ? data.role : "admin") as TeacherRole;
  const profile={ uid, name:String(data.name||"Guru"), role, active:data.active!==false, email:String(data.email||services.auth.currentUser?.email||"") };
  if(!hasRole || typeof data.active!=="boolean"){
    try{
      await setDoc(doc(services.db,"teachers",uid),{
        name:profile.name,
        email:profile.email,
        role,
        active:true,
        email:profile.email||"",
    updatedAt:serverTimestamp(),
      },{merge:true});
    }catch{}
  }
  return profile;
}

export async function saveTeacherProfile(profile: TeacherProfile) {
  const services=getFirebaseServices();
  if(!services) throw new Error("Firebase belum dikonfigurasi");
  await setDoc(doc(services.db,"teachers",profile.uid),{
    name:profile.name,
    role:profile.role,
    active:profile.active,
    updatedAt:serverTimestamp(),
  },{merge:true});
}

export async function listTeacherProfiles(): Promise<TeacherProfile[]> {
  const services=getFirebaseServices();
  if(!services) return [];
  try{
    const snap=await getDocs(collection(services.db,"teachers"));
    return snap.docs.map(d=>{
      const data=d.data() as Record<string,any>;
      const role=(["admin","guru","viewer"].includes(data.role) ? data.role : "guru") as TeacherRole;
      return {uid:d.id,name:String(data.name||"Guru"),role,active:data.active!==false,email:String(data.email||"")};
    });
  }catch{return []}
}

function addLocalAudit(entry: Omit<AuditEntry,"id"|"createdAt">) {
  try{
    const current=JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY)||"[]") as AuditEntry[];
    current.unshift({id:crypto.randomUUID(),createdAt:Date.now(),...entry});
    localStorage.setItem(LOCAL_AUDIT_KEY,JSON.stringify(current.slice(0,300)));
  }catch{}
}

export function getLocalAudit(): AuditEntry[] {
  if(typeof window==="undefined") return [];
  try{return JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY)||"[]")}catch{return []}
}

export async function writeAudit(action:string,detail:string,by:string){
  addLocalAudit({action,detail,by});
  const services=getFirebaseServices();
  if(!services) return;
  try{
    await addDoc(collection(services.db,"auditLogs"),{action,detail,by,createdAt:serverTimestamp()});
  }catch{}
}

export async function getAuditLogs(): Promise<AuditEntry[]> {
  const services=getFirebaseServices();
  if(services){
    try{
      const snap=await getDocs(query(collection(services.db,"auditLogs"),orderBy("createdAt","desc")));
      return snap.docs.slice(0,300).map(d=>{
        const data=d.data() as Record<string,any>;
        return {id:d.id,action:String(data.action||""),detail:String(data.detail||""),by:String(data.by||""),createdAt:data.createdAt?.toMillis?.()??Date.now()};
      });
    }catch{}
  }
  return getLocalAudit();
}
