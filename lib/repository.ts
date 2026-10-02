"use client";

import { collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { ensureAnonymousFirebaseUser, getFirebaseServices } from "./firebase";

export type AttemptResponse = {
  questionId: string;
  subtopic: string;
  selected: string;
  answer: string;
  correct: boolean;
  difficulty: "easy" | "medium" | "kbat";
  unsure?: boolean;
};

export type RegisteredStudent = {
  uid: string;
  localStudentId: string;
  name: string;
  className: string;
  classCode: string;
  updatedAt: number;
};

export type AttemptRecord = {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  classCode?: string;
  chapter: number;
  label?: string;
  mode?: string;
  score: number;
  total: number;
  percentage: number;
  durationSeconds: number;
  wrongSubtopics: string[];
  responses?: AttemptResponse[];
  completedAt: number;
  firebaseSynced?: boolean;
};

export type LiveProgress = {
  uid: string;
  localStudentId: string;
  studentName: string;
  className: string;
  classCode: string;
  title: string;
  mode: string;
  current: number;
  total: number;
  status: "active" | "complete";
  updatedAt: number;
};

const KEY = "geoboost_attempts";

export function getLocalAttempts(): AttemptRecord[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

function setLocalAttempts(attempts: AttemptRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(attempts.slice(0, 500)));
}

function markAttemptSynced(id: string) {
  const attempts = getLocalAttempts();
  setLocalAttempts(attempts.map(attempt => attempt.id === id ? { ...attempt, firebaseSynced: true } : attempt));
}

export async function syncStudentProfile(profile: { localStudentId: string; name: string; className: string; classCode?: string }) {
  const services = getFirebaseServices();
  if (!services) return { synced: false, uid: null as string | null, errorCode: "firebase-unavailable" };
  try {
    const user = await ensureAnonymousFirebaseUser();
    if (!user) return { synced: false, uid: null as string | null, errorCode: "anonymous-auth-failed" };
    await setDoc(doc(services.db, "students", user.uid), {
      name: profile.name,
      className: profile.className,
      classCode: profile.classCode || "",
      localStudentId: profile.localStudentId,
      updatedAt: serverTimestamp(),
    });
    return { synced: true, uid: user.uid, errorCode: "" };
  } catch (error:any) {
    console.error("syncStudentProfile failed", error);
    return {
      synced: false,
      uid: null as string | null,
      errorCode: String(error?.code || error?.message || "student-profile-sync-failed"),
    };
  }
}

async function uploadAttempt(attempt: AttemptRecord) {
  const services = getFirebaseServices();
  if (!services) return false;
  const user = await ensureAnonymousFirebaseUser();
  if (!user) return false;
  await setDoc(doc(services.db, "attempts", attempt.id), {
    id: attempt.id,
    studentId: user.uid,
    localStudentId: attempt.studentId,
    studentName: attempt.studentName,
    className: attempt.className,
    classCode: attempt.classCode || "",
    chapter: attempt.chapter,
    label: attempt.label || "",
    mode: attempt.mode || "",
    score: attempt.score,
    total: attempt.total,
    percentage: attempt.percentage,
    durationSeconds: attempt.durationSeconds,
    wrongSubtopics: attempt.wrongSubtopics,
    responses: attempt.responses || [],
    completedAt: serverTimestamp(),
  }, { merge: true });
  return true;
}

export async function saveAttempt(attempt: AttemptRecord) {
  if (attempt.studentId === "demo") return { synced: false, savedLocally: false };
  const localAttempt = { ...attempt, firebaseSynced: false };
  setLocalAttempts([localAttempt, ...getLocalAttempts()]);
  try {
    const synced = await uploadAttempt(localAttempt);
    if (synced) markAttemptSynced(attempt.id);
    return { synced, savedLocally: true };
  } catch {
    return { synced: false, savedLocally: true };
  }
}

export async function syncPendingAttempts(maxItems = 50) {
  const pending = getLocalAttempts().filter(attempt => attempt.studentId !== "demo" && !attempt.firebaseSynced).slice(0, maxItems);
  let synced = 0;
  for (const attempt of pending) {
    try {
      if (await uploadAttempt(attempt)) { markAttemptSynced(attempt.id); synced++; }
    } catch {}
  }
  return { attempted: pending.length, synced };
}

function fromAttemptDoc(snapshot: any): AttemptRecord {
  const data = snapshot.data() as Record<string, any>;
  return {
    id: data.id || snapshot.id,
    studentId: data.localStudentId || data.studentId || "",
    studentName: data.studentName || "Murid",
    className: data.className || "-",
    classCode: data.classCode || "",
    chapter: Number(data.chapter || 0),
    label: data.label || "",
    mode: data.mode || "",
    score: Number(data.score || 0),
    total: Number(data.total || 0),
    percentage: Number(data.percentage || 0),
    durationSeconds: Number(data.durationSeconds || 0),
    wrongSubtopics: Array.isArray(data.wrongSubtopics) ? data.wrongSubtopics : [],
    responses: Array.isArray(data.responses) ? data.responses : [],
    completedAt: data.completedAt?.toMillis?.() ?? data.completedAt ?? Date.now(),
    firebaseSynced: true,
  };
}

export async function getRemoteAttempts(classCodes: string[] = [], allowAll = false): Promise<AttemptRecord[]> {
  const services = getFirebaseServices();
  if (!services) return [];
  if (!allowAll && !classCodes.length) return [];
  const source = allowAll
    ? query(collection(services.db, "attempts"), orderBy("completedAt", "desc"), limit(1000))
    : query(collection(services.db, "attempts"), where("classCode", "in", classCodes.slice(0,30)), limit(1000));
  const snap = await getDocs(source);
  return snap.docs.flatMap(snapshot => {
    const item = fromAttemptDoc(snapshot);
    return item.className === "__QA__" || item.mode === "qa" ? [] : [item];
  }).sort((a,b)=>b.completedAt-a.completedAt);
}

export async function getStudentCloudAttempts(localStudentId: string): Promise<AttemptRecord[]> {
  const services = getFirebaseServices();
  if (!services) return [];
  const user = await ensureAnonymousFirebaseUser();
  if (!user) return [];
  const found = new Map<string, AttemptRecord>();
  try {
    const own = await getDocs(query(collection(services.db, "attempts"), where("studentId","==",user.uid), limit(500)));
    own.docs.forEach(d => { const item=fromAttemptDoc(d); found.set(item.id,item); });
  } catch {}
  try {
    const cross = await getDocs(query(collection(services.db, "attempts"), where("localStudentId","==",localStudentId), limit(500)));
    cross.docs.forEach(d => { const item=fromAttemptDoc(d); found.set(item.id,item); });
  } catch {}
  return [...found.values()].sort((a,b)=>b.completedAt-a.completedAt);
}

export async function getRemoteStudents(classCodes: string[] = [], allowAll = false): Promise<RegisteredStudent[]> {
  const services = getFirebaseServices();
  if (!services) return [];
  if (!allowAll && !classCodes.length) return [];
  const source = allowAll
    ? query(collection(services.db, "students"), orderBy("updatedAt", "desc"), limit(1000))
    : query(collection(services.db, "students"), where("classCode", "in", classCodes.slice(0,30)), limit(1000));
  const snap = await getDocs(source);
  return snap.docs.map(snapshot => {
    const data = snapshot.data() as Record<string, any>;
    return {
      uid: snapshot.id,
      localStudentId: String(data.localStudentId || ""),
      name: String(data.name || "Murid"),
      className: String(data.className || "-"),
      classCode: String(data.classCode || ""),
      updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? Date.now(),
    };
  }).sort((a,b)=>b.updatedAt-a.updatedAt);
}

export async function saveLiveProgress(input: Omit<LiveProgress,"uid"|"updatedAt">) {
  const services = getFirebaseServices();
  if (!services) return;
  const user = await ensureAnonymousFirebaseUser();
  if (!user) return;
  await setDoc(doc(services.db,"progress",user.uid), {
    ...input,
    studentId: user.uid,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function watchLiveProgress(callback: (items: LiveProgress[]) => void, classCodes: string[] = [], allowAll = false) {
  const services = getFirebaseServices();
  if (!services) return () => {};
  if (!allowAll && !classCodes.length) { callback([]); return () => {}; }
  const source = allowAll
    ? collection(services.db,"progress")
    : query(collection(services.db,"progress"),where("classCode","in",classCodes.slice(0,30)));
  return onSnapshot(source, snap => {
    const items = snap.docs.map(d => {
      const data=d.data() as Record<string,any>;
      return {
        uid:d.id,
        localStudentId:String(data.localStudentId||""),
        studentName:String(data.studentName||"Murid"),
        className:String(data.className||"-"),
        classCode:String(data.classCode||""),
        title:String(data.title||"Latihan"),
        mode:String(data.mode||""),
        current:Number(data.current||0),
        total:Number(data.total||0),
        status:data.status==="complete" ? "complete" : "active",
        updatedAt:data.updatedAt?.toMillis?.() ?? Date.now(),
      } satisfies LiveProgress;
    });
    callback(items.sort((a,b)=>b.updatedAt-a.updatedAt));
  },()=>callback([]));
}

export async function deleteRemoteAttempt(id: string) {
  const services=getFirebaseServices();
  if(!services) throw new Error("Firebase belum dikonfigurasi");
  await deleteDoc(doc(services.db,"attempts",id));
}
