"use client";

import { useEffect, useState } from "react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { questions, Question } from "@/lib/questions";
import { getCustomQuestions, mergeQuestionBanks } from "@/lib/customQuestions";
import { getStudentSession } from "@/lib/session";

export default function BookmarkPage(){
  const [bank,setBank]=useState<Question[]|null>(null);
  useEffect(()=>{(async()=>{
    const student=getStudentSession();if(!student){setBank([]);return}
    try{
      const ids=JSON.parse(localStorage.getItem("geoboost_bookmarks_"+student.id)||"[]") as string[];
      const merged=mergeQuestionBanks(questions,await getCustomQuestions());
      setBank(ids.map(id=>merged.find(q=>q.id===id)).filter(Boolean) as Question[]);
    }catch{setBank([])}
  })()},[]);
  if(bank===null)return <main className="quiz-shell"><div className="empty-state"><h1>Memuatkan soalan disimpan…</h1></div></main>;
  if(!bank.length)return <main className="quiz-shell"><div className="empty-state"><span className="result-icon">🔖</span><h1>Belum ada soalan disimpan</h1><p>Tekan “Simpan” pada soalan yang anda mahu ulang kemudian.</p><a className="primary" href="/murid/latihan">Kembali</a></div></main>;
  return <PracticeRunner bank={bank} requested={Math.min(20,bank.length)} title="Soalan Disimpan Saya" eyebrow="SOALAN DISIMPAN" mode="bookmark" returnHref="/murid/latihan"/>;
}
