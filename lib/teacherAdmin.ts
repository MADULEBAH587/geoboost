"use client";

import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseServices } from "./firebase";

export type TeacherRole = "admin" | "guru" | "viewer";
export type TeacherStatus = "pending" | "active" | "suspended" | "rejected";
export type TeacherProfile = {
  uid: string;
  name: string;
  role: TeacherRole;
  active: boolean;
  status?: TeacherStatus;
  email?: string;
  createdAt?: number;
  updatedAt?: number;
  lastSeenAt?: number;
};

export type AuditEntry = {
  id: string;
  action: string;
  detail: string;
  by: string;
  createdAt: number;
};

const LOCAL_AUDIT_KEY = "geoboost_teacher_audit";

function timestamp(value:any){
  return value?.toMillis?.() ?? (typeof value==="number" ? value : undefined);
}

function profileFromData(uid:string,data:Record<string,any>,fallbackEmail=""):TeacherProfile{
  const hasRole=["admin","guru","viewer"].includes(data.role);
  const role=(hasRole ? data.role : "admin") as TeacherRole;
  const rawStatus=["pending","active","suspended","rejected"].includes(data.status)
    ? data.status as TeacherStatus
    : (data.active===false ? "suspended" : "active");
  const active=rawStatus==="active" && data.active!==false;
  return {
    uid,
    name:String(data.name||"Guru"),
    role,
    active,
    status:rawStatus,
    email:String(data.email||fallbackEmail||""),
    createdAt:timestamp(data.createdAt),
    updatedAt:timestamp(data.updatedAt),
    lastSeenAt:timestamp(data.lastSeenAt),
  };
}

export async function getTeacherProfile(uid: string): Promise<TeacherProfile | null> {
  const services=getFirebaseServices();
  if(!services) return null;
  const snap=await getDoc(doc(services.db,"teachers",uid));
  if(!snap.exists()) return null;
  const data=snap.data() as Record<string,any>;
  const profile=profileFromData(uid,data,services.auth.currentUser?.email||"");

  // Preserve the original administrator created before status/role fields existed.
  const hasRole=["admin","guru","viewer"].includes(data.role);
  const hasStatus=["pending","active","suspended","rejected"].includes(data.status);
  if(!hasRole || !hasStatus || typeof data.active!=="boolean"){
    try{
      await setDoc(doc(services.db,"teachers",uid),{
        name:profile.name,
        email:profile.email||"",
        role:profile.role,
        status:profile.status||"active",
        active:profile.active,
        updatedAt:serverTimestamp(),
      },{merge:true});
    }catch{}
  }
  return profile;
}

export async function registerTeacherRequest(input:{uid:string;name:string;email:string}){
  const services=getFirebaseServices();
  if(!services)throw new Error("Firebase belum dikonfigurasi");
  const name=input.name.trim();
  const email=input.email.trim().toLowerCase();
  if(!name||!email)throw new Error("Nama dan email diperlukan");
  await setDoc(doc(services.db,"teachers",input.uid),{
    name,
    email,
    role:"guru",
    status:"pending",
    active:false,
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp(),
  },{merge:false});
  return {uid:input.uid,name,email,role:"guru" as const,status:"pending" as const,active:false};
}

export async function saveTeacherProfile(profile: TeacherProfile) {
  const services=getFirebaseServices();
  if(!services) throw new Error("Firebase belum dikonfigurasi");
  const status=(profile.status || (profile.active ? "active" : "suspended")) as TeacherStatus;
  await setDoc(doc(services.db,"teachers",profile.uid),{
    name:profile.name,
    email:profile.email||"",
    role:profile.role,
    status,
    active:status==="active",
    updatedAt:serverTimestamp(),
  },{merge:true});
}

export async function listTeacherProfiles(): Promise<TeacherProfile[]> {
  const services=getFirebaseServices();
  if(!services) return [];
  try{
    const snap=await getDocs(collection(services.db,"teachers"));
    const rank:Record<TeacherStatus,number>={pending:0,active:1,suspended:2,rejected:3};
    return snap.docs.map(d=>profileFromData(d.id,d.data() as Record<string,any>))
      .sort((a,b)=>(rank[a.status||"active"]-rank[b.status||"active"])||a.name.localeCompare(b.name,"ms"));
  }catch{return []}
}

export async function touchTeacherLastSeen(uid:string){
  const services=getFirebaseServices();
  if(!services)return;
  try{
    await setDoc(doc(services.db,"teachers",uid),{lastSeenAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
  }catch{}
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
