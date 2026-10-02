"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@/lib/questions";
import { buildQuestionSession, type SessionMix, standardMix } from "@/lib/questionEngine";
import { getStudentSession } from "@/lib/session";
import { getLocalAttempts, saveAttempt, saveLiveProgress, type AttemptResponse } from "@/lib/repository";
import { validateClassCode } from "@/lib/classroom";
import { GeoStimulus, stimulusForQuestion } from "@/components/GeoStimulus";
import { HotspotChoice, isHotspotQuestion } from "@/components/HotspotChoice";

type SavedPractice = {
  sessionIds: string[];
  index: number;
  selected: string | null;
  checked: boolean;
  unsure: boolean;
  responses: AttemptResponse[];
  startedAt: number;
  savedAt: number;
  title: string;
  href: string;
  mode: string;
  studentId: string;
};

export function PracticeRunner({
  bank, requested, title, eyebrow, mode, returnHref = "/", mix = standardMix,
}: {
  bank: Question[]; requested: number; title: string; eyebrow: string; mode: string; returnHref?: string; mix?: SessionMix;
}) {
  const [studentId,setStudentId]=useState("");
  const [session,setSession]=useState<Question[]>(()=>buildQuestionSession(bank,requested,mix));
  const [index,setIndex]=useState(0);
  const [selected,setSelected]=useState<string|null>(null);
  const [checked,setChecked]=useState(false);
  const [unsure,setUnsure]=useState(false);
  const [responses,setResponses]=useState<AttemptResponse[]>([]);
  const [done,setDone]=useState(false);
  const [synced,setSynced]=useState<boolean|null>(null);
  const [guest,setGuest]=useState(false);
  const [resumeReady,setResumeReady]=useState(false);
  const [resumed,setResumed]=useState(false);
  const [accessDenied,setAccessDenied]=useState(false);
  const [bookmarked,setBookmarked]=useState(false);
  const [improvement,setImprovement]=useState<number|null>(null);
  const startedAt=useRef(Date.now());
  const label=useMemo(()=>eyebrow||mode.toUpperCase(),[eyebrow,mode]);
  const saveKey=studentId ? "geoboost_resume_"+studentId+"_"+mode.replace(/[^a-z0-9]+/gi,"_")+"_"+title.replace(/[^a-z0-9]+/gi,"_").slice(0,50) : "";

  useEffect(()=>{
    const student=getStudentSession();
    setStudentId(student?.id||"guest");
  },[]);

  useEffect(()=>{
    if(!studentId)return;
    let active=true;
    async function prepare(){
      const student=getStudentSession();
      let allowedBank=bank;
      if(student?.classCode){
        try{
          const record=await validateClassCode(student.classCode);
          if(record){
            allowedBank=bank.filter(q=>record.openChapters.includes(q.chapter));
            if(!allowedBank.length){if(active)setAccessDenied(true);return}
            if(allowedBank.length!==bank.length && active){
              setSession(buildQuestionSession(allowedBank,Math.min(requested,allowedBank.length),mix));
            }
          }
        }catch{}
      }

      try{
        const raw=localStorage.getItem(saveKey);
        if(raw){
          const saved=JSON.parse(raw) as SavedPractice;
          const byId=new Map(allowedBank.map(q=>[q.id,q]));
          const restored=saved.sessionIds.map(id=>byId.get(id)).filter(Boolean) as Question[];
          if(restored.length===saved.sessionIds.length && restored.length>0 && saved.index<restored.length){
            setSession(restored);setIndex(saved.index);setSelected(saved.selected);setChecked(saved.checked);setUnsure(Boolean(saved.unsure));
            setResponses(Array.isArray(saved.responses)?saved.responses:[]);
            startedAt.current=saved.startedAt||Date.now();setResumed(true);
          }
        }
      }catch{}
      if(active)setResumeReady(true);
    }
    prepare();
    return()=>{active=false};
  },[studentId,saveKey,bank,requested,mix]);

  useEffect(()=>{
    if(!resumeReady||done||accessDenied||!session.length||!saveKey)return;
    const state:SavedPractice={sessionIds:session.map(q=>q.id),index,selected,checked,unsure,responses,startedAt:startedAt.current,savedAt:Date.now(),title,href:window.location.pathname+window.location.search,mode,studentId};
    localStorage.setItem(saveKey,JSON.stringify(state));
  },[resumeReady,done,accessDenied,saveKey,session,index,selected,checked,unsure,responses,title,mode,studentId]);

  const current=session[index];

  useEffect(()=>{
    if(!current||!studentId)return;
    try{
      const ids=JSON.parse(localStorage.getItem("geoboost_bookmarks_"+studentId)||"[]") as string[];
      setBookmarked(ids.includes(current.id));
    }catch{setBookmarked(false)}
  },[current?.id,studentId]);

  useEffect(()=>{
    if(!current||!studentId||studentId==="guest"||done)return;
    const student=getStudentSession();
    if(!student)return;
    void saveLiveProgress({
      localStudentId:student.id,studentName:student.name,className:student.className,classCode:student.classCode,
      title,mode,current:index+1,total:session.length,status:"active"
    }).catch(()=>{});
  },[current?.id,index,session.length,studentId,done,title,mode]);

  if(accessDenied)return <main className="quiz-shell"><div className="empty-state"><span className="result-icon">🔒</span><h1>Latihan ini belum dibuka</h1><p>Guru kelas anda belum membuka bab yang diperlukan untuk latihan ini.</p><a className="primary" href="/murid/latihan">← Kembali</a></div></main>;
  if(!session.length)return <main className="quiz-shell"><div className="empty-state"><h1>Tiada soalan untuk set ini</h1><p>Pilih latihan lain.</p><a className="primary" href={returnHref}>← Kembali</a></div></main>;

  const isCorrect=selected===current.answer;
  const progress=Math.round(((index+(checked?1:0))/session.length)*100);
  const stimulus=stimulusForQuestion(current);

  function toggleBookmark(){
    if(!studentId)return;
    try{
      const key="geoboost_bookmarks_"+studentId;
      const ids=JSON.parse(localStorage.getItem(key)||"[]") as string[];
      const next=ids.includes(current.id)?ids.filter(id=>id!==current.id):[current.id,...ids];
      localStorage.setItem(key,JSON.stringify(next.slice(0,100)));setBookmarked(!ids.includes(current.id));
    }catch{}
  }

  function checkAnswer(){
    if(!selected||checked)return;
    const response:AttemptResponse={questionId:current.id,subtopic:current.subtopic,selected,answer:current.answer,correct:selected===current.answer,difficulty:current.difficulty,unsure};
    setChecked(true);setResponses(a=>[...a,response]);
  }

  async function next(){
    if(index<session.length-1){setIndex(i=>i+1);setSelected(null);setChecked(false);setUnsure(false);return}

    const finalResponses=responses.length===session.length?responses:selected?[...responses,{questionId:current.id,subtopic:current.subtopic,selected,answer:current.answer,correct:selected===current.answer,difficulty:current.difficulty,unsure}]:responses;
    const score=finalResponses.filter(a=>a.correct).length;
    const student=getStudentSession();setGuest(!student);
    const durationSeconds=Math.max(1,Math.round((Date.now()-startedAt.current)/1000));
    const wrongSubtopics=[...new Set(finalResponses.filter(a=>!a.correct).map(a=>a.subtopic))];
    const uniqueChapters=[...new Set(session.map(q=>q.chapter))];
    const chapter=uniqueChapters.length===1?uniqueChapters[0]:0;
    const currentPercentage=Math.round(score/session.length*100);
    if(student){
      const previous=getLocalAttempts().find(a=>a.studentId===student.id && a.mode===mode && (chapter===0 || a.chapter===chapter));
      setImprovement(previous ? currentPercentage-previous.percentage : null);
    }
    const result=await saveAttempt({
      id:crypto.randomUUID(),studentId:student?.id||"demo",studentName:student?.name||"Murid Demo",className:student?.className||"Demo",classCode:student?.classCode||"",
      chapter,label:title,mode,score,total:session.length,percentage:currentPercentage,durationSeconds,wrongSubtopics,responses:finalResponses,completedAt:Date.now()
    });

    if(student){
      try{
        const key="geoboost_wrong_"+student.id;
        const currentWrong=JSON.parse(localStorage.getItem(key)||"{}") as Record<string,number>;
        finalResponses.forEach(r=>{if(r.correct){if(currentWrong[r.questionId])currentWrong[r.questionId]=Math.max(0,currentWrong[r.questionId]-1)}else currentWrong[r.questionId]=(currentWrong[r.questionId]||0)+1});
        Object.keys(currentWrong).forEach(id=>{if(currentWrong[id]<=0)delete currentWrong[id]});
        localStorage.setItem(key,JSON.stringify(currentWrong));
      }catch{}
      void saveLiveProgress({localStudentId:student.id,studentName:student.name,className:student.className,classCode:student.classCode,title,mode,current:session.length,total:session.length,status:"complete"}).catch(()=>{});
    }
    if(saveKey)localStorage.removeItem(saveKey);
    setResponses(finalResponses);setSynced(result.synced);setDone(true);
  }

  if(done){
    const score=responses.filter(a=>a.correct).length;
    const percentage=Math.round(score/session.length*100);
    const wrong=[...new Set(responses.filter(a=>!a.correct).map(a=>a.subtopic))];
    const wrongCount=responses.filter(a=>!a.correct).length;
    const uncertain=responses.filter(a=>a.unsure).length;
    const easy=responses.filter(a=>a.difficulty==="easy"),medium=responses.filter(a=>a.difficulty==="medium"),kbat=responses.filter(a=>a.difficulty==="kbat");
    const mastery=(items:AttemptResponse[])=>items.length?Math.round(items.filter(x=>x.correct).length/items.length*100):0;
    return <main className="quiz-shell result-shell"><section className="result-card">
      <span className="result-icon">{percentage>=80?"🏆":percentage>=60?"⭐":"🎯"}</span><span className="eyebrow dark">{label} SELESAI</span><h2 className="result-title">{title}</h2><h1>{percentage}%</h1><p>{score} daripada {session.length} jawapan betul.</p>
      <div className="result-stats"><div><small>Mata Ilmu</small><b>{score*10}</b></div><div><small>Mudah</small><b>{mastery(easy)}%</b></div><div><small>Sederhana</small><b>{mastery(medium)}%</b></div><div><small>KBAT</small><b>{mastery(kbat)}%</b></div></div>
      {improvement!==null?<div className={"sync-banner "+(improvement>=0?"online":"offline")}>{improvement>0?"📈 Naik "+improvement+"% berbanding percubaan terdahulu":improvement===0?"➡️ Sama seperti percubaan terdahulu":"📉 Turun "+Math.abs(improvement)+"% — cuba Pemulihan Pintar"}</div>:null}
      {uncertain>0?<div className="sync-banner offline">🤔 {uncertain} jawapan ditanda “Saya tak pasti” — sesuai untuk ulang kaji.</div>:null}
      {guest?<div className="sync-banner offline">Masuk sebagai murid untuk menyimpan markah dan kemajuan.</div>:<div className={"sync-banner "+(synced?"online":"offline")}>{synced?"Rekod berjaya disimpan":"Rekod belum selesai disimpan. Sistem akan cuba semula secara automatik."}</div>}
      {wrong.length>0?<div className="recovery-box"><span>🎯</span><div><small>Cadangan pemulihan</small><strong>{wrong.join(", ")}</strong></div></div>:null}
      <div className="result-actions"><a className="primary" href="/murid/utama">Utama</a>{wrongCount>0?<a className="secondary dark-button" href="/ulang-salah">Ulang Soalan Salah</a>:null}<a className="secondary dark-button" href="/pemulihan">Pemulihan</a></div>
    </section></main>;
  }

  return <main className="quiz-shell">
    <header className="quiz-topbar"><a href={returnHref}>← Keluar</a><div><small>{label}</small><strong>{title}</strong></div><span>{index+1}/{session.length}</span></header>
    <div className="quiz-progress"><span style={{width:progress+"%"}} /></div>
    {resumed?<div className="resume-banner">↩️ Latihan disambung dari jawapan terakhir.</div>:<div className="resume-banner subtle">Kemajuan disimpan secara automatik.</div>}
    <section className="question-card">
      <div className="question-toolbar"><div className="question-meta"><span>Bab {current.chapter} · {current.subtopic}</span><span className={"difficulty "+current.difficulty}>{current.difficulty==="easy"?"MUDAH":current.difficulty==="medium"?"SEDERHANA":"KBAT"}</span><span>{current.id}</span></div><button className={"bookmark-button "+(bookmarked?"active":"")} onClick={toggleBookmark}>{bookmarked?"🔖 Disimpan":"🔖 Simpan"}</button></div>
      {stimulus?<GeoStimulus kind={stimulus}/>:null}<h1>{current.prompt}</h1>
      {isHotspotQuestion(current.id)?<HotspotChoice questionId={current.id} options={current.options} selected={selected} disabled={checked} onSelect={setSelected}/>:<div className="option-list">{current.options.map((option,optionIndex)=>{const chosen=selected===option;const answerClass=checked?(option===current.answer?"correct":chosen?"wrong":""):chosen?"selected":"";return <button key={option+"-"+optionIndex} onClick={()=>!checked&&setSelected(option)} className={"option "+answerClass}><span>{String.fromCharCode(65+optionIndex)}</span><b>{option}</b></button>})}</div>}
      {!checked?<><button className={"unsure-button "+(unsure?"active":"")} type="button" onClick={()=>setUnsure(v=>!v)}>🤔 {unsure?"Ditanda: Saya tak pasti":"Saya tak pasti"}</button><button disabled={!selected} onClick={checkAnswer} className="primary full quiz-submit">Semak jawapan</button></>:<div className={"feedback "+(isCorrect?"good":"bad")}><div><strong>{isCorrect?"✓ Tepat! +10 Mata Ilmu":"Belum tepat"}</strong><p>{current.explanation}</p>{!isCorrect?<small>Jawapan: <b>{current.answer}</b></small>:null}</div><button onClick={next}>{index===session.length-1?"Lihat keputusan":"Seterusnya →"}</button></div>}
    </section>
  </main>;
}
