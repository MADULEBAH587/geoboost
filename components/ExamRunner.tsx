"use client";

import { useEffect, useMemo, useState } from "react";
import { buildQuestionSession } from "@/lib/questionEngine";
import { questions, Question } from "@/lib/questions";
import { getStudentSession } from "@/lib/session";
import { saveAttempt } from "@/lib/repository";
import { validateClassCode } from "@/lib/classroom";
import { GeoStimulus, stimulusForQuestion } from "@/components/GeoStimulus";
import { HotspotChoice, isHotspotQuestion } from "@/components/HotspotChoice";

function studentSyncBanner(synced:boolean|null){return synced===null?null:<div className={"sync-banner "+(synced?"online":"offline")}>{synced?"☁️ Rekod guru berjaya disimpan":"⚠️ Rekod masih di peranti ini dan BELUM masuk rekod guru. Pastikan Internet aktif dan buka semula portal murid untuk recovery."}</div>}

export function ExamRunner() {
  const [session,setSession]=useState<Question[]>([]);
  const [index,setIndex]=useState(0);
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [review,setReview]=useState<Record<string,boolean>>({});
  const [seconds,setSeconds]=useState(35*60);
  const [submitted,setSubmitted]=useState(false);
  const [saving,setSaving]=useState(false);
  const [score,setScore]=useState(0);
  const [synced,setSynced]=useState<boolean|null>(null);

  useEffect(()=>{
    async function init(){
      let bank=questions;
      const student=getStudentSession();
      if(student?.classCode){
        try{
          const record=await validateClassCode(student.classCode);
          if(record)bank=questions.filter(q=>record.openChapters.includes(q.chapter));
        }catch{}
      }
      setSession(buildQuestionSession(bank,Math.min(30,bank.length),{easy:12,medium:12,kbat:6}));
    }
    init();
  },[]);

  useEffect(()=>{
    if(submitted||!session.length)return;
    const timer=setInterval(()=>setSeconds(s=>{
      if(s<=1){clearInterval(timer);void finish();return 0}
      return s-1;
    }),1000);
    return()=>clearInterval(timer);
  },[submitted,session.length]);

  const current=session[index];
  const answered=Object.keys(answers).length;
  const minutes=String(Math.floor(seconds/60)).padStart(2,"0");
  const secs=String(seconds%60).padStart(2,"0");

  async function finish(){
    if(saving||submitted||!session.length)return;
    setSaving(true);
    const student=getStudentSession();
    const responses=session.map(q=>({
      questionId:q.id,subtopic:q.subtopic,selected:answers[q.id]||"",answer:q.answer,correct:answers[q.id]===q.answer,difficulty:q.difficulty,unsure:Boolean(review[q.id])
    }));
    const correct=responses.filter(r=>r.correct).length;
    const wrongSubtopics=[...new Set(responses.filter(r=>!r.correct).map(r=>r.subtopic))];
    const saved=await saveAttempt({
      id:crypto.randomUUID(),studentId:student?.id||"demo",studentName:student?.name||"Murid Demo",className:student?.className||"Demo",classCode:student?.classCode||"",
      chapter:0,label:"Simulasi UASA",mode:"UASA",score:correct,total:session.length,percentage:Math.round(correct/session.length*100),durationSeconds:35*60-seconds,wrongSubtopics,responses,completedAt:Date.now()
    });
    setSynced(saved.synced);setScore(correct);setSubmitted(true);setSaving(false);
  }

  if(!session.length)return <main className="quiz-shell"><div className="empty-state"><h1>Menyediakan simulasi UASA…</h1></div></main>;

  if(submitted){
    const pct=Math.round(score/session.length*100);
    return <main className="quiz-shell result-shell"><section className="result-card"><span className="result-icon">🏆</span><span className="eyebrow dark">SIMULASI UASA SELESAI</span><h1>{pct}%</h1><p>{score} daripada {session.length} jawapan betul.</p>{studentSyncBanner(synced)}<div className="result-stats"><div><small>Dijawab</small><b>{answered}/{session.length}</b></div><div><small>Ditanda</small><b>{Object.values(review).filter(Boolean).length}</b></div><div><small>Masa baki</small><b>{minutes}:{secs}</b></div></div><div className="result-actions"><a className="primary" href="/murid/prestasi">Lihat Prestasi</a><a className="secondary dark-button" href="/uasa">Cuba Lagi</a></div></section></main>;
  }

  const stimulus=stimulusForQuestion(current);
  return <main className="exam-shell">
    <header className="exam-top"><a href="/murid/latihan">← Keluar</a><div><small>SIMULASI UASA</small><b>Geografi Tingkatan 2</b></div><span className={seconds<300?"danger":""}>⏱ {minutes}:{secs}</span></header>
    <div className="exam-layout">
      <aside className="exam-nav"><div><b>{answered}/{session.length}</b><small>dijawab</small></div><div className="exam-number-grid">{session.map((q,i)=><button key={q.id} onClick={()=>setIndex(i)} className={(answers[q.id]?"answered ":"")+(review[q.id]?"review ":"")+(i===index?"current":"")}>{i+1}</button>)}</div><div className="exam-legend"><span>● Dijawab</span><span>★ Semak</span></div><button className="exam-submit" onClick={()=>{if(confirm("Hantar simulasi UASA sekarang?"))void finish()}} disabled={saving}>{saving?"Menghantar...":"Hantar Jawapan"}</button></aside>
      <section className="question-card exam-question">
        <div className="question-meta"><span>Soalan {index+1}</span><span>Bab {current.chapter}</span><span className={"difficulty "+current.difficulty}>{current.difficulty==="easy"?"MUDAH":current.difficulty==="medium"?"SEDERHANA":"KBAT"}</span></div>
        {stimulus?<GeoStimulus kind={stimulus}/>:null}<h1>{current.prompt}</h1>
        {isHotspotQuestion(current.id)?<HotspotChoice questionId={current.id} options={current.options} selected={answers[current.id]||null} disabled={false} onSelect={value=>setAnswers(a=>({...a,[current.id]:value}))}/>:<div className="option-list">{current.options.map((option,i)=><button key={option} onClick={()=>setAnswers(a=>({...a,[current.id]:option}))} className={"option "+(answers[current.id]===option?"selected":"")}><span>{String.fromCharCode(65+i)}</span><b>{option}</b></button>)}</div>}
        <div className="exam-actions"><button className={review[current.id]?"review-active":""} onClick={()=>setReview(r=>({...r,[current.id]:!r[current.id]}))}>⭐ {review[current.id]?"Ditanda":"Tanda untuk semak"}</button><div>{index>0?<button onClick={()=>setIndex(i=>i-1)}>← Sebelum</button>:null}{index<session.length-1?<button onClick={()=>setIndex(i=>i+1)}>Seterusnya →</button>:<button onClick={()=>{if(confirm("Hantar simulasi UASA sekarang?"))void finish()}}>Hantar →</button>}</div></div>
      </section>
    </div>
  </main>;
}
