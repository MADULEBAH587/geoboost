"use client";

import { useEffect, useState } from "react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { questions, Question } from "@/lib/questions";
import { getStudentSession } from "@/lib/session";

export default function RetryWrongPage() {
  const [bank,setBank]=useState<Question[]|null>(null);

  useEffect(()=>{
    const student=getStudentSession();
    if(!student){setBank([]);return}
    try{
      const wrong=JSON.parse(localStorage.getItem("geoboost_wrong_"+student.id)||"{}") as Record<string,number>;
      const ids=Object.entries(wrong).sort((a,b)=>b[1]-a[1]).map(([id])=>id);
      setBank(ids.map(id=>questions.find(q=>q.id===id)).filter(Boolean) as Question[]);
    }catch{setBank([])}
  },[]);

  if(bank===null)return <main className="quiz-shell"><div className="empty-state"><h1>Memuatkan soalan...</h1></div></main>;
  if(!bank.length)return <main className="quiz-shell"><div className="empty-state"><span className="result-icon">✅</span><h1>Tiada soalan lemah</h1><p>Soalan yang kerap salah akan dikumpulkan di sini secara automatik.</p><a className="primary" href="/murid/latihan">Kembali</a></div></main>;
  return <PracticeRunner bank={bank} requested={Math.min(20,bank.length)} title="Bank Soalan Lemah Saya" eyebrow="ULANG SOALAN LEMAH" mode="ulang-salah" returnHref="/murid/latihan" />;
}
