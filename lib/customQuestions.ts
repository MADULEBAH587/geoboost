"use client";

import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import type { Difficulty, Question, QuestionType } from "./questions";
import { getFirebaseServices } from "./firebase";

export type CustomQuestion = Question & {
  custom: true;
  active: boolean;
  updatedAt?: number;
};

function fromData(id: string, data: Record<string, any>): CustomQuestion {
  const options = Array.isArray(data.options) ? data.options.map(String) : [];
  return {
    id,
    chapter: Number(data.chapter || 1),
    subtopic: String(data.subtopic || ""),
    difficulty: (["easy","medium","kbat"].includes(data.difficulty) ? data.difficulty : "medium") as Difficulty,
    type: (data.type === "tf" ? "tf" : "mcq") as QuestionType,
    prompt: String(data.prompt || ""),
    options,
    answer: String(data.answer || options[0] || ""),
    explanation: String(data.explanation || ""),
    custom: true,
    active: data.active !== false,
    updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? Date.now(),
  };
}

export async function getCustomQuestions(includeArchived = false): Promise<CustomQuestion[]> {
  const services = getFirebaseServices();
  if (!services) return [];
  try {
    const snap = await getDocs(collection(services.db,"questions"));
    return snap.docs.map(d=>fromData(d.id,d.data() as Record<string,any>)).filter(q=>includeArchived || q.active);
  } catch {
    return [];
  }
}

export async function saveCustomQuestion(input: Partial<CustomQuestion> & Pick<Question,"chapter"|"subtopic"|"difficulty"|"type"|"prompt"|"options"|"answer"|"explanation">) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  const id = input.id || ("CUST-"+Date.now().toString(36).toUpperCase());
  const options = input.options.map(String).map(x=>x.trim()).filter(Boolean);
  if (!input.prompt.trim() || options.length < 2 || !options.includes(input.answer)) throw new Error("Soalan atau jawapan tidak sah");
  await setDoc(doc(services.db,"questions",id), {
    chapter:Number(input.chapter),
    subtopic:input.subtopic.trim(),
    difficulty:input.difficulty,
    type:input.type,
    prompt:input.prompt.trim(),
    options,
    answer:input.answer,
    explanation:input.explanation.trim(),
    custom:true,
    active:input.active !== false,
    updatedAt:serverTimestamp(),
  }, { merge:true });
  return id;
}

export async function archiveCustomQuestion(id: string, active = false) {
  const services=getFirebaseServices();
  if(!services) throw new Error("Firebase belum dikonfigurasi");
  await setDoc(doc(services.db,"questions",id),{active,updatedAt:serverTimestamp()},{merge:true});
}

export async function deleteCustomQuestion(id: string) {
  const services=getFirebaseServices();
  if(!services) throw new Error("Firebase belum dikonfigurasi");
  await deleteDoc(doc(services.db,"questions",id));
}

export function mergeQuestionBanks(base: Question[], custom: Question[]) {
  const map=new Map<string,Question>();
  base.forEach(q=>map.set(q.id,q));
  custom.forEach(q=>map.set(q.id,q));
  return [...map.values()];
}
