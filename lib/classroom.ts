"use client";

import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { ensureAnonymousFirebaseUser, getFirebaseServices } from "./firebase";

export type ClassRecord = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export function normalizeClassCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9_-]/g, "");
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
  return { id: snapshot.id, code: clean, name: String(data.name || clean), active: data.active !== false };
}

export async function listClasses(): Promise<ClassRecord[]> {
  const services = getFirebaseServices();
  if (!services) return [];
  const snapshot = await getDocs(query(collection(services.db, "classes"), orderBy("name", "asc")));
  return snapshot.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    return { id: item.id, code: String(data.code || item.id), name: String(data.name || item.id), active: data.active !== false };
  });
}

export async function saveClass(input: { name: string; code: string }) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  const code = normalizeClassCode(input.code);
  const name = input.name.trim().toUpperCase();
  if (!code || !name) throw new Error("Nama dan kod kelas diperlukan");
  await setDoc(doc(services.db, "classes", code), { code, name, active: true, updatedAt: serverTimestamp() }, { merge: true });
  return { id: code, code, name, active: true } satisfies ClassRecord;
}

export async function removeClass(code: string) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  await deleteDoc(doc(services.db, "classes", normalizeClassCode(code)));
}
