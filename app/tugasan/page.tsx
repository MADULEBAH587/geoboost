"use client";

import { useEffect, useState } from "react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { getQuestionsForChapter, Question } from "@/lib/questions";

export default function AssignmentPage() {
  const [bank, setBank] = useState<Question[] | null>(null);
  const [count, setCount] = useState(20);
  const [title, setTitle] = useState("Tugasan GeoBoost");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chapter = Number(params.get("chapter") || 0);
    const requested = Math.min(20, Math.max(5, Number(params.get("count") || 20)));
    const taskTitle = params.get("title") || "Tugasan GeoBoost";
    setCount(requested);
    setTitle(taskTitle);
    setBank(chapter >= 1 && chapter <= 10 ? getQuestionsForChapter(chapter) : []);
  }, []);

  if (bank === null) return <main className="quiz-shell"><div className="empty-state"><h1>Memuatkan tugasan...</h1></div></main>;
  if (!bank.length) return <main className="quiz-shell"><div className="empty-state"><h1>Tugasan tidak sah</h1><p>Kembali ke dashboard murid dan buka tugasan daripada kad Tugasan Guru.</p><a className="primary" href="/">Kembali</a></div></main>;

  return <PracticeRunner bank={bank} requested={Math.min(count,bank.length)} title={title} eyebrow="TUGASAN GURU" mode="tugasan" returnHref="/" />;
}
