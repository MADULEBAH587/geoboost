"use client";

import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { ensureAnonymousFirebaseUser, getFirebaseServices } from "./firebase";

export type AttemptResponse = {
  questionId: string;
  subtopic: string;
  selected: string;
  answer: string;
  correct: boolean;
  difficulty: "easy" | "medium" | "kbat";
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
  const next = attempts.map((attempt) => attempt.id === id ? { ...attempt, firebaseSynced: true } : attempt);
  setLocalAttempts(next);
}

export async function syncStudentProfile(profile: { localStudentId: string; name: string; className: string; classCode?: string }) {
  const services = getFirebaseServices();
  if (!services) return { synced: false, uid: null as string | null };
  try {
    const user = await ensureAnonymousFirebaseUser();
    if (!user) return { synced: false, uid: null as string | null };
    await setDoc(doc(services.db, "students", user.uid), {
      name: profile.name,
      className: profile.className,
      classCode: profile.classCode || "",
      localStudentId: profile.localStudentId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { synced: true, uid: user.uid };
  } catch {
    return { synced: false, uid: null as string | null };
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
  const local = getLocalAttempts();
  const localAttempt = { ...attempt, firebaseSynced: false };
  local.unshift(localAttempt);
  setLocalAttempts(local);

  try {
    const synced = await uploadAttempt(localAttempt);
    if (synced) markAttemptSynced(attempt.id);
    return { synced, savedLocally: true };
  } catch {
    return { synced: false, savedLocally: true };
  }
}

export async function syncPendingAttempts(maxItems = 50) {
  const pending = getLocalAttempts().filter((attempt) => attempt.studentId !== "demo" && !attempt.firebaseSynced).slice(0, maxItems);
  if (!pending.length) return { attempted: 0, synced: 0 };
  let synced = 0;
  for (const attempt of pending) {
    try {
      if (await uploadAttempt(attempt)) {
        markAttemptSynced(attempt.id);
        synced++;
      }
    } catch {
      // Kekalkan rekod tempatan untuk cuba semula pada sesi berikutnya.
    }
  }
  return { attempted: pending.length, synced };
}

export async function getRemoteAttempts(): Promise<AttemptRecord[]> {
  const services = getFirebaseServices();
  if (!services) return [];
  const snap = await getDocs(query(collection(services.db, "attempts"), orderBy("completedAt", "desc"), limit(500)));
  return snap.docs.flatMap((snapshot) => {
    const data = snapshot.data() as Record<string, any>;
    if (data.className === "__QA__" || data.mode === "qa") return [];
    const completedAt = data.completedAt?.toMillis?.() ?? data.completedAt ?? Date.now();
    return [{
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
      completedAt,
      firebaseSynced: true,
    }];
  });
}
