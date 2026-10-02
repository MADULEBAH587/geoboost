"use client";

import { useEffect, useState } from "react";
import type { Chapter } from "@/lib/data";
import { getLocalAttempts } from "@/lib/repository";
import { getStudentSession } from "@/lib/session";

export function ChapterCard({ chapter, locked = false }: { chapter: Chapter; locked?: boolean }) {
  const [best, setBest] = useState<number | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(()=>{
    const student = getStudentSession();
    const attempts = student ? getLocalAttempts().filter(a=>a.chapter===chapter.id && a.studentId===student.id) : [];
    setTries(attempts.length);
    if (attempts.length) setBest(Math.max(...attempts.map(a=>a.percentage)));
  },[chapter.id]);

  const progress = best ?? 0;
  const buttonText = locked ? "Dikunci guru" : tries ? "Ulang latihan" : "Mula";
  const status = locked ? "locked" : best == null ? "new" : best >= 60 ? "complete" : "progress";

  return (
    <article className={"chapter-card"+(locked ? " locked" : "")}>
      <div className="chapter-top"><div className="chapter-icon" aria-hidden>{chapter.icon}</div><div className="chapter-number">BAB {chapter.id}</div><div className={"status-dot "+status} title={status} /></div>
      <h3>{chapter.title}</h3><p>{chapter.short}</p>
      <div className="meta-row"><span>{chapter.questions} soalan bank</span><span>{locked ? "🔒 Belum dibuka" : best != null ? "Terbaik "+best+"%" : "Belum cuba"}</span></div>
      <div className="progress-track" aria-label={"Kemajuan "+progress+"%"}><span style={{ width: progress+"%" }} /></div>
      {locked ? <button className="chapter-button locked-button" disabled>{buttonText}</button> : <a className="chapter-button" href={"/bab/"+chapter.id}>{buttonText}<span>→</span></a>}
    </article>
  );
}
