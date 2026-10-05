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
    // Submission must be self-sufficient. Student login intentionally remains
    // usable during a temporary cloud failure, so never assume the Firestore
    // student profile already exists when the learner finishes an exercise.
    const profile = await syncStudentProfile({
      localStudentId: attempt.studentId,
      name: attempt.studentName,
      className: attempt.className,
      classCode: attempt.classCode || "",
    });
    if (!profile.synced) {
      console.error("saveAttempt profile prerequisite failed", profile.errorCode);
      return { synced: false, savedLocally: true };
    }
    const synced = await uploadAttempt(localAttempt);
    if (synced) markAttemptSynced(attempt.id);
    return { synced, savedLocally: true };
  } catch (error) {
    console.error("saveAttempt cloud upload failed", error);
    // Keep the attempt locally. StudentPortal/login will retry only this student's
    // records after the roster-backed cloud profile is restored.
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

export async function repairCurrentStudentCloudRecords(profile: { localStudentId: string; name: string; className: string; classCode: string }) {
  const syncedProfile = await syncStudentProfile(profile);
  if (!syncedProfile.synced) return { profileSynced:false, attempted:0, synced:0 };
  // Reconcile ALL local records for the current roster student, not only records
  // previously marked unsynced. Older builds could mark a local attempt as synced
  // while its cloud identity/class metadata was stale. setDoc(merge) is idempotent,
  // so replaying the current student's attempts safely repairs Ethan-like cases.
  const pending = getLocalAttempts()
    .filter(attempt => attempt.studentId === profile.localStudentId)
    .slice(0, 500)
    .map(attempt => ({...attempt, studentName:profile.name, className:profile.className, classCode:profile.classCode}));
  let synced=0;
  for(const attempt of pending){
    try{ if(await uploadAttempt(attempt)){ markAttemptSynced(attempt.id); synced++; } }catch{}
  }
  return { profileSynced:true, attempted:pending.length, synced };
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
  const codes=[...new Set(classCodes.map(code=>String(code||"").trim()).filter(Boolean))];
  if (!allowAll && !codes.length) return [];
  const sources = allowAll
    ? [query(collection(services.db, "attempts"), orderBy("completedAt", "desc"), limit(1000))]
    : codes.map(code=>query(collection(services.db, "attempts"), where("classCode", "==", code), limit(1000)));
  const settled=await Promise.allSettled(sources.map(source=>getDocs(source)));
  const snapshots=settled.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);
  if(!snapshots.length&&settled.some(result=>result.status==="rejected")){
    throw (settled.find(result=>result.status==="rejected") as PromiseRejectedResult).reason;
  }
  settled.forEach(result=>{if(result.status==="rejected")console.error("Attempt class fetch failed",result.reason)});
  const found=new Map<string,AttemptRecord>();
  snapshots.forEach(snap=>snap.docs.forEach(snapshot=>{
    const item=fromAttemptDoc(snapshot);
    if(item.className!=="__QA__"&&item.mode!=="qa")found.set(item.id,item);
  }));
  return [...found.values()].sort((a,b)=>b.completedAt-a.completedAt);
}

export function watchRemoteAttempts(
  callback: (items: AttemptRecord[]) => void,
  classCodes: string[] = [],
  allowAll = false,
  onError?: (error: unknown) => void,
) {
  const services = getFirebaseServices();
  if (!services) { callback([]); return () => {}; }
  const codes=[...new Set(classCodes.map(code=>String(code||"").trim()).filter(Boolean))];
  if (!allowAll && !codes.length) { callback([]); return () => {}; }

  if(allowAll){
    const source=query(collection(services.db,"attempts"),orderBy("completedAt","desc"),limit(1000));
    return onSnapshot(source,snap=>{
      const items=snap.docs.flatMap(snapshot=>{
        const item=fromAttemptDoc(snapshot);
        return item.className==="__QA__"||item.mode==="qa"?[]:[item];
      }).sort((a,b)=>b.completedAt-a.completedAt);
      callback(items);
    },error=>{console.error("watchRemoteAttempts failed",error);onError?.(error)});
  }

  const byClass=new Map<string,AttemptRecord[]>();
  const emit=()=>{
    const found=new Map<string,AttemptRecord>();
    byClass.forEach(items=>items.forEach(item=>found.set(item.id,item)));
    callback([...found.values()].sort((a,b)=>b.completedAt-a.completedAt));
  };
  const stops=codes.map(code=>{
    const source=query(collection(services.db,"attempts"),where("classCode","==",code),limit(1000));
    return onSnapshot(source,snap=>{
      byClass.set(code,snap.docs.flatMap(snapshot=>{
        const item=fromAttemptDoc(snapshot);
        return item.className==="__QA__"||item.mode==="qa"?[]:[item];
      }));
      emit();
    },error=>{
      console.error("watchRemoteAttempts failed for "+code,error);
      onError?.(error);
    });
  });
  return ()=>stops.forEach(stop=>stop());
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
  if (!services) return false;
  // Cloud-first: every progress write establishes the roster-backed cloud
  // identity first. This makes each answer independent from login-time sync.
  const profile=await syncStudentProfile({
    localStudentId:input.localStudentId,
    name:input.studentName,
    className:input.className,
    classCode:input.classCode,
  });
  if(!profile.synced||!profile.uid)return false;
  await setDoc(doc(services.db,"progress",profile.uid), {
    ...input,
    studentId: profile.uid,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return true;
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
