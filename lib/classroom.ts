"use client";

import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { ensureAnonymousFirebaseUser, getFirebaseServices } from "./firebase";

export type ClassAssignment = {
  id: string;
  title: string;
  chapter: number;
  questionCount: number;
  dueDate: string;
  active: boolean;
  createdAt: number;
  questionIds?: string[];
  maxAttempts?: number;
  targetStudentIds?: string[];
};

export type ClassStudent = {
  id: string;
  name: string;
};

export type ClassRecord = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  ownerTeacherId: string;
  studentRoster: ClassStudent[];
  studentNames: string[];
  openChapters: number[];
  assignments: ClassAssignment[];
  academicYear: string;
  archived: boolean;
};

const ALL_CHAPTERS = [1,2,3,4,5,6,7,8,9,10];

export function normalizeClassCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9_-]/g, "");
}

export function normalizeStudentName(name: string) {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

export function createStudentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return "stu_"+crypto.randomUUID();
  return "stu_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10);
}

// Legacy helper retained for old local records only. New roster entries use a stored unique student ID.
export function stableStudentId(classCode: string, name: string) {
  const value = `${normalizeClassCode(classCode)}|${normalizeStudentName(name)}`;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `legacy-${normalizeClassCode(classCode).toLowerCase()}-${(hash >>> 0).toString(36)}`;
}

function cleanAssignments(value: unknown): ClassAssignment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: any) => {
    const chapter = Number(item?.chapter || 0);
    if (!item?.id || !item?.title || chapter < 1 || chapter > 10) return [];
    return [{
      id: String(item.id),
      title: String(item.title),
      chapter,
      questionCount: Math.min(30, Math.max(1, Number(item.questionCount || 20))),
      dueDate: String(item.dueDate || ""),
      active: item.active !== false,
      createdAt: Number(item.createdAt || Date.now()),
      questionIds: Array.isArray(item.questionIds) ? item.questionIds.map(String).filter(Boolean) : [],
      maxAttempts: Math.min(10, Math.max(1, Number(item.maxAttempts || 3))),
      targetStudentIds: Array.isArray(item.targetStudentIds) ? item.targetStudentIds.map(String).filter(Boolean) : [],
    }];
  }).sort((a,b)=>b.createdAt-a.createdAt);
}

function cleanRoster(id: string, data: Record<string, unknown>): ClassStudent[] {
  const raw = Array.isArray(data.studentRoster) ? data.studentRoster : [];
  const roster = raw.flatMap((item: any) => {
    const name = normalizeStudentName(String(item?.name || ""));
    const studentId = String(item?.id || "").trim();
    return name && studentId ? [{ id: studentId, name }] : [];
  });
  if (roster.length) return roster;

  const names = Array.isArray(data.studentNames)
    ? data.studentNames.map((name) => normalizeStudentName(String(name))).filter(Boolean)
    : [];
  return names.map(name => ({ id: stableStudentId(id,name), name }));
}

function classFromData(id: string, data: Record<string, unknown>): ClassRecord {
  const studentRoster = cleanRoster(id,data);
  const rawOpen = Array.isArray(data.openChapters) ? data.openChapters.map(Number).filter((n)=>n>=1&&n<=10) : ALL_CHAPTERS;
  return {
    id,
    code: String(data.code || id),
    name: String(data.name || id),
    active: data.active !== false,
    ownerTeacherId: String(data.ownerTeacherId || ""),
    studentRoster,
    studentNames: studentRoster.map(student => student.name),
    openChapters: [...new Set(rawOpen)].sort((a,b)=>a-b),
    assignments: cleanAssignments(data.assignments),
    academicYear: String(data.academicYear || new Date().getFullYear()),
    archived: data.archived === true,
  };
}

function teacherUid() {
  const services = getFirebaseServices();
  const user = services?.auth.currentUser;
  if (!services || !user || user.isAnonymous) throw new Error("Log masuk guru diperlukan");
  return { services, uid: user.uid };
}

export async function validateClassCode(code: string): Promise<ClassRecord | null> {
  const clean = normalizeClassCode(code);
  if (!clean) return null;
  const services = getFirebaseServices();
  if (!services) return null;
  const user = await ensureAnonymousFirebaseUser();
  if (!user) return null;
  const snapshot = await getDoc(doc(services.db, "classes", clean));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, unknown>;
  if (data.active === false || data.archived === true) return null;
  return classFromData(snapshot.id, data);
}

export async function listClasses(role: "admin"|"guru"|"viewer" = "guru"): Promise<ClassRecord[]> {
  const { services, uid } = teacherUid();
  const snapshot = role === "admin"
    ? await getDocs(collection(services.db, "classes"))
    : await getDocs(query(collection(services.db, "classes"), where("ownerTeacherId", "==", uid)));

  const records: ClassRecord[] = [];
  for (const item of snapshot.docs) {
    let record = classFromData(item.id, item.data() as Record<string, unknown>);
    if (role === "admin" && !record.ownerTeacherId) {
      await setDoc(doc(services.db, "classes", record.code), {
        ownerTeacherId: uid,
        studentRoster: record.studentRoster,
        studentNames: record.studentNames,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      record = { ...record, ownerTeacherId: uid };
    }
    records.push(record);
  }
  return records.sort((a,b)=>a.name.localeCompare(b.name,"ms"));
}

export async function saveClass(input: { name: string; code: string; academicYear?: string }) {
  const { services, uid } = teacherUid();
  const code = normalizeClassCode(input.code);
  const name = input.name.trim().toUpperCase();
  if (!code || !name) throw new Error("Nama dan kod kelas diperlukan");
  const ref = doc(services.db, "classes", code);
  const existing = await getDoc(ref);
  const current = existing.exists() ? classFromData(existing.id, existing.data() as Record<string, unknown>) : null;
  if (current?.ownerTeacherId && current.ownerTeacherId !== uid) throw new Error("Kod kelas ini dimiliki guru lain");
  const studentRoster = current?.studentRoster || [];
  const payload = {
    code,
    name,
    ownerTeacherId: current?.ownerTeacherId || uid,
    active: true,
    studentRoster,
    studentNames: studentRoster.map(student=>student.name),
    openChapters: current?.openChapters || ALL_CHAPTERS,
    assignments: current?.assignments || [],
    academicYear: input.academicYear || current?.academicYear || String(new Date().getFullYear()),
    archived: current?.archived || false,
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
  return classFromData(code, payload as unknown as Record<string, unknown>);
}

function matchRoster(existing: ClassStudent[], names: string[]) {
  const pools = new Map<string, ClassStudent[]>();
  for (const student of existing) {
    const key = normalizeStudentName(student.name);
    pools.set(key,[...(pools.get(key)||[]),student]);
  }
  return names.map(rawName => {
    const name = normalizeStudentName(rawName);
    const pool = pools.get(name) || [];
    const found = pool.shift();
    pools.set(name,pool);
    return found || { id: createStudentId(), name };
  }).filter(student=>student.name);
}

export async function saveClassRoster(classCode: string, names: string[]) {
  const { services } = teacherUid();
  const code = normalizeClassCode(classCode);
  const ref = doc(services.db, "classes", code);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Kelas tidak dijumpai");
  const record = classFromData(snapshot.id, snapshot.data() as Record<string, unknown>);
  const studentRoster = matchRoster(record.studentRoster,names);
  await setDoc(ref, {
    studentRoster,
    studentNames: studentRoster.map(student=>student.name),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return studentRoster;
}

export async function addRosterStudent(classCode: string, name: string) {
  const { services } = teacherUid();
  const code = normalizeClassCode(classCode);
  const ref = doc(services.db, "classes", code);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Kelas tidak dijumpai");
  const record = classFromData(snapshot.id, snapshot.data() as Record<string, unknown>);
  const studentRoster = [...record.studentRoster, { id:createStudentId(), name:normalizeStudentName(name) }].filter(s=>s.name);
  await setDoc(ref, {
    studentRoster,
    studentNames: studentRoster.map(student=>student.name),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return studentRoster;
}

export async function removeRosterStudent(classCode: string, studentId: string) {
  const { services } = teacherUid();
  const code = normalizeClassCode(classCode);
  const ref = doc(services.db, "classes", code);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return [];
  const record = classFromData(snapshot.id, snapshot.data() as Record<string, unknown>);
  const studentRoster = record.studentRoster.filter(student => student.id !== studentId);
  await setDoc(ref, {
    studentRoster,
    studentNames: studentRoster.map(student=>student.name),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return studentRoster;
}

export async function setOpenChapters(classCode: string, chapters: number[]) {
  const { services } = teacherUid();
  const code = normalizeClassCode(classCode);
  const clean = [...new Set(chapters.map(Number).filter((n)=>n>=1&&n<=10))].sort((a,b)=>a-b);
  await setDoc(doc(services.db, "classes", code), { openChapters: clean, updatedAt: serverTimestamp() }, { merge: true });
  return clean;
}

export async function saveAssignment(classCode: string, input: Omit<ClassAssignment, "id" | "createdAt"> & { id?: string; createdAt?: number }) {
  const { services } = teacherUid();
  const code = normalizeClassCode(classCode);
  const ref = doc(services.db, "classes", code);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Kelas tidak dijumpai");
  const record = classFromData(snapshot.id, snapshot.data() as Record<string, unknown>);
  const assignment: ClassAssignment = {
    id: input.id || crypto.randomUUID(),
    title: input.title.trim(),
    chapter: Number(input.chapter),
    questionCount: Math.min(30, Math.max(1, Number(input.questionCount || 20))),
    dueDate: input.dueDate || "",
    active: input.active !== false,
    createdAt: input.createdAt || Date.now(),
    questionIds: Array.isArray(input.questionIds) ? [...new Set(input.questionIds.map(String))] : [],
    maxAttempts: Math.min(10, Math.max(1, Number(input.maxAttempts || 3))),
    targetStudentIds: Array.isArray(input.targetStudentIds) ? [...new Set(input.targetStudentIds.map(String))] : [],
  };
  const next = [assignment, ...record.assignments.filter((item)=>item.id!==assignment.id)].sort((a,b)=>b.createdAt-a.createdAt);
  await setDoc(ref, { assignments: next, updatedAt: serverTimestamp() }, { merge: true });
  return next;
}

export async function deleteAssignment(classCode: string, assignmentId: string) {
  const { services } = teacherUid();
  const code = normalizeClassCode(classCode);
  const ref = doc(services.db, "classes", code);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return [];
  const record = classFromData(snapshot.id, snapshot.data() as Record<string, unknown>);
  const next = record.assignments.filter((item)=>item.id!==assignmentId);
  await setDoc(ref, { assignments: next, updatedAt: serverTimestamp() }, { merge: true });
  return next;
}

export async function setClassArchived(classCode: string, archived: boolean) {
  const { services } = teacherUid();
  const code = normalizeClassCode(classCode);
  await setDoc(doc(services.db, "classes", code), { archived, active: !archived, updatedAt: serverTimestamp() }, { merge: true });
  return archived;
}

export async function removeClass(code: string) {
  const { services } = teacherUid();
  await deleteDoc(doc(services.db, "classes", normalizeClassCode(code)));
}
