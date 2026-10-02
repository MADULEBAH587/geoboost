"use client";

import { useEffect, useState } from "react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { questions, Question } from "@/lib/questions";

export default function RetryWrongPage() {
  const [bank, setBank] = useState<Question[] | null>(null);
  const [title, setTitle] = useState("Ulang Soalan Salah");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("geoboost_last_wrong");
      if (!raw) { setBank([]); return; }
      const saved = JSON.parse(raw);
      const ids = Array.isArray(saved.ids) ? saved.ids.map(String) : [];
      const selected = ids.map((id:string)=>questions.find(q=>q.id===id)).filter(Boolean) as Question[];
      setTitle(saved.title ? "Ulang Salah · "+String(saved.title) : "Ulang Soalan Salah");
      setBank(selected);
    } catch {
      setBank([]);
    }
  }, []);

  if (bank === null) return <main className="quiz-shell"><div className="empty-state"><h1>Memuatkan soalan...</h1></div></main>;
  if (!bank.length) return <main className="quiz-shell"><div className="empty-state"><span className="result-icon">✅</span><h1>Tiada soalan salah untuk diulang</h1><p>Lengkapkan satu latihan dahulu.</p><a className="primary" href="/">Kembali</a></div></main>;

  return <PracticeRunner bank={bank} requested={bank.length} title={title} eyebrow="ULANG SOALAN SALAH" mode="ulang-salah" returnHref="/" />;
}
