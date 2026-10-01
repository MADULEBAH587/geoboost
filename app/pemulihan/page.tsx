"use client";

import { useEffect, useMemo, useState } from "react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { getLocalAttempts } from "@/lib/repository";
import { getStudentSession } from "@/lib/session";
import { questions } from "@/lib/questions";

export default function RecoveryPage() {
  const [topics, setTopics] = useState<string[]>([]);
  useEffect(()=>{
    const student = getStudentSession();
    const attempts = getLocalAttempts().filter(a=>!student || a.studentId===student.id);
    const counts = new Map<string,number>();
    attempts.forEach(a=>a.wrongSubtopics.forEach(s=>counts.set(s,(counts.get(s)||0)+1)));
    setTopics([...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]));
  },[]);
  const bank = useMemo(()=> questions.filter(q=>topics.includes(q.subtopic)),[topics]);
  if (!topics.length) return <main className="quiz-shell"><div className="empty-state"><span style={{fontSize:42}}>🎯</span><h1>Belum ada topik lemah</h1><p>Jawab sekurang-kurangnya satu latihan bab dahulu. GeoBoost akan gunakan rekod kesalahan untuk membina set pemulihan.</p><a className="primary" href="/#bab">Pilih bab →</a></div></main>;
  return <PracticeRunner bank={bank} requested={10} title={`Pemulihan: ${topics.join(", ")}`} eyebrow="Pemulihan Pintar" mode="Pemulihan" returnHref="/" mix={{easy:3,medium:5,kbat:2}} />;
}
