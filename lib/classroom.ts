"use client";

import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
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

export type ClassRecord = {
  id: string;
  code: string;
  name: string;
  active: boolean;
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

export function stableStudentId(classCode: string, name: string) {
  const value = `${normalizeClassCode(classCode)}|${normalizeStudentName(name)}`;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `roster-${normalizeClassCode(classCode).toLowerCase()}-${(hash >>> 0).toString(36)}`;
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

function classFromData(id: string, data: Record<string, unknown>): ClassRecord {
  const names = Array.isArray(data.studentNames)
    ? data.studentNames.map((name) => normalizeStudentName(String(name))).filter(Boolean)
    : [];
  const rawOpen = Array.isArray(data.openChapters) ? data.openChapters.map(Number).filter((n)=>n>=1&&n<=10) : ALL_CHAPTERS;
  return {
    id,
    code: String(data.code || id),
    name: String(data.name || id),
    active: data.active !== false,
    studentNames: [...new Set(names)].sort((a, b) => a.localeCompare(b, "ms")),
    openChapters: [...new Set(rawOpen)].sort((a,b)=>a-b),
    assignments: cleanAssignments(data.assignments),
    academicYear: String(data.academicYear || new Date().getFullYear()),
    archived: data.archived === true,
  };
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

export async function listClasses(): Promise<ClassRecord[]> {
  const services = getFirebaseServices();
  if (!services) return [];
  const snapshot = await getDocs(query(collection(services.db, "classes"), orderBy("name", "asc")));
  return snapshot.docs.map((item) => classFromData(item.id, item.data() as Record<string, unknown>));
}

export async function saveClass(input: { name: string; code: string; academicYear?: string }) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  const code = normalizeClassCode(input.code);
  const name = input.name.trim().toUpperCase();
  if (!code || !name) throw new Error("Nama dan kod kelas diperlukan");
  const ref = doc(services.db, "classes", code);
  const existing = await getDoc(ref);
  const current = existing.exists() ? classFromData(existing.id, existing.data() as Record<string, unknown>) : null;
  const payload = {
    code,
    name,
    active: true,
    studentNames: current?.studentNames || [],
    openChapters: current?.openChapters || ALL_CHAPTERS,
    assignments: current?.assignments || [],
    academicYear: input.academicYear || current?.academicYear || String(new Date().getFullYear()),
    archived: current?.archived || false,
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
  return classFromData(code, payload as unknown as Record<string, unknown>);
}

export async function saveClassRoster(classCode: string, names: string[]) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  const code = normalizeClassCode(classCode);
  const clean = [...new Set(names.map(normalizeStudentName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ms"));
  await setDoc(doc(services.db, "classes", code), { studentNames: clean, updatedAt: serverTimestamp() }, { merge: true });
  return clean;
}

export async function addRosterStudent(classCode: string, name: string) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  const code = normalizeClassCode(classCode);
  const ref = doc(services.db, "classes", code);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Kelas tidak dijumpai");
  const current = classFromData(snapshot.id, snapshot.data() as Record<string, unknown>).studentNames;
  const next = [...new Set([...current, normalizeStudentName(name)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ms"));
  await setDoc(ref, { studentNames: next, updatedAt: serverTimestamp() }, { merge: true });
  return next;
}

export async function removeRosterStudent(classCode: string, name: string) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  const code = normalizeClassCode(classCode);
  const ref = doc(services.db, "classes", code);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return [];
  const target = normalizeStudentName(name);
  const current = classFromData(snapshot.id, snapshot.data() as Record<string, unknown>).studentNames;
  const next = current.filter((item) => normalizeStudentName(item) !== target);
  await setDoc(ref, { studentNames: next, updatedAt: serverTimestamp() }, { merge: true });
  return next;
}

export async function setOpenChapters(classCode: string, chapters: number[]) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  const code = normalizeClassCode(classCode);
  const clean = [...new Set(chapters.map(Number).filter((n)=>n>=1&&n<=10))].sort((a,b)=>a-b);
  await setDoc(doc(services.db, "classes", code), { openChapters: clean, updatedAt: serverTimestamp() }, { merge: true });
  return clean;
}

export async function saveAssignment(classCode: string, input: Omit<ClassAssignment, "id" | "createdAt"> & { id?: string; createdAt?: number }) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
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
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
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
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  const code = normalizeClassCode(classCode);
  await setDoc(doc(services.db, "classes", code), { archived, active: !archived, updatedAt: serverTimestamp() }, { merge: true });
  return archived;
}

export async function removeClass(code: string) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  await deleteDoc(doc(services.db, "classes", normalizeClassCode(code)));
}
