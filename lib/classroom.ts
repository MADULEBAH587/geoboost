"use client";

import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { ensureAnonymousFirebaseUser, getFirebaseServices } from "./firebase";

export type ClassRecord = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  studentNames: string[];
};

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

function classFromData(id: string, data: Record<string, unknown>): ClassRecord {
  const names = Array.isArray(data.studentNames)
    ? data.studentNames.map((name) => normalizeStudentName(String(name))).filter(Boolean)
    : [];
  return {
    id,
    code: String(data.code || id),
    name: String(data.name || id),
    active: data.active !== false,
    studentNames: [...new Set(names)].sort((a, b) => a.localeCompare(b, "ms")),
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
  if (data.active === false) return null;
  return classFromData(snapshot.id, data);
}

export async function listClasses(): Promise<ClassRecord[]> {
  const services = getFirebaseServices();
  if (!services) return [];
  const snapshot = await getDocs(query(collection(services.db, "classes"), orderBy("name", "asc")));
  return snapshot.docs.map((item) => classFromData(item.id, item.data() as Record<string, unknown>));
}

export async function saveClass(input: { name: string; code: string }) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  const code = normalizeClassCode(input.code);
  const name = input.name.trim().toUpperCase();
  if (!code || !name) throw new Error("Nama dan kod kelas diperlukan");
  const ref = doc(services.db, "classes", code);
  const existing = await getDoc(ref);
  const studentNames = existing.exists() && Array.isArray(existing.data().studentNames)
    ? existing.data().studentNames
    : [];
  await setDoc(ref, { code, name, active: true, studentNames, updatedAt: serverTimestamp() }, { merge: true });
  return { id: code, code, name, active: true, studentNames: studentNames.map(String) } satisfies ClassRecord;
}

export async function saveClassRoster(classCode: string, names: string[]) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  const code = normalizeClassCode(classCode);
  const clean = [...new Set(names.map(normalizeStudentName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ms"));
  await setDoc(doc(services.db, "classes", code), {
    studentNames: clean,
    updatedAt: serverTimestamp(),
  }, { merge: true });
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


export async function removeClass(code: string) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  await deleteDoc(doc(services.db, "classes", normalizeClassCode(code)));
}
