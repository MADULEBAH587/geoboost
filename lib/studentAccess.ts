"use client";

import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { ensureAnonymousFirebaseUser, getFirebaseServices } from "./firebase";
import type { ClassRecord } from "./classroom";

export type StudentAccessRecord = {
  id: string;
  classCode: string;
  studentId: string;
  name: string;
  pin: string;
  active: boolean;
};

function accessDocId(classCode: string, studentId: string) {
  return `${classCode}__${studentId}`;
}

function randomPin() {
  const value = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(value);
    return String(100000 + (value[0] % 900000));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function listStudentAccessCodes(classCode: string): Promise<StudentAccessRecord[]> {
  const services = getFirebaseServices();
  if (!services) return [];
  const snap = await getDocs(query(collection(services.db, "studentAccess"), where("classCode", "==", classCode)));
  return snap.docs.map(item => {
    const data = item.data() as Record<string, any>;
    return {
      id: item.id,
      classCode: String(data.classCode || classCode),
      studentId: String(data.studentId || ""),
      name: String(data.name || "Murid"),
      pin: String(data.pin || ""),
      active: data.active !== false,
    };
  }).sort((a,b)=>a.name.localeCompare(b.name,"ms"));
}

export async function ensureStudentAccessCodes(record: ClassRecord): Promise<StudentAccessRecord[]> {
  const services = getFirebaseServices();
  if (!services) return [];
  const current = await listStudentAccessCodes(record.code);
  const byStudent = new Map(current.map(item => [item.studentId, item]));
  const next: StudentAccessRecord[] = [];

  for (const student of record.studentRoster) {
    const existing = byStudent.get(student.id);
    const access: StudentAccessRecord = existing ? {
      ...existing,
      name: student.name,
      active: true,
    } : {
      id: accessDocId(record.code, student.id),
      classCode: record.code,
      studentId: student.id,
      name: student.name,
      pin: randomPin(),
      active: true,
    };
    await setDoc(doc(services.db, "studentAccess", access.id), {
      classCode: access.classCode,
      studentId: access.studentId,
      name: access.name,
      pin: access.pin,
      active: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    next.push(access);
  }

  const activeIds = new Set(record.studentRoster.map(student => student.id));
  for (const old of current) {
    if (!activeIds.has(old.studentId) && old.active) {
      await setDoc(doc(services.db, "studentAccess", old.id), {
        active: false,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  }

  return next.sort((a,b)=>a.name.localeCompare(b.name,"ms"));
}

export async function removeStudentAccessCode(classCode: string, studentId: string) {
  const services = getFirebaseServices();
  if (!services) return;
  await deleteDoc(doc(services.db, "studentAccess", accessDocId(classCode, studentId)));
}

export async function claimStudentAccess(input: {
  classCode: string;
  studentId: string;
  pin: string;
}) {
  const services = getFirebaseServices();
  if (!services) return { ok: false, uid: null as string | null };
  const user = await ensureAnonymousFirebaseUser();
  if (!user) return { ok: false, uid: null as string | null };
  await setDoc(doc(services.db, "studentClaims", user.uid), {
    classCode: input.classCode,
    studentId: input.studentId,
    pin: input.pin.trim(),
    createdAt: serverTimestamp(),
  }, { merge: false });
  return { ok: true, uid: user.uid };
}
