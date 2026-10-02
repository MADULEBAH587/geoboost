"use client";

import { useEffect, useState } from "react";
import { chapters } from "@/lib/data";
import { getStudentSession } from "@/lib/session";

function chapterProgress(chapter:number){
  if(typeof window==="undefined")return 0;
  const student=getStudentSession();
  const key="geoboost_visual_notes_progress_"+(student?.id||"guest")+"_"+chapter;
  try{
    const seen=JSON.parse(localStorage.getItem(key)||"[]");
    return Math.min(100,Math.round((Array.isArray(seen)?seen.length:0)/4*100));
  }catch{return 0}
}

export function VisualNotesLibrary(){
  const [progress,setProgress]=useState<Record<number,number>>({});
  useEffect(()=>{
    setProgress(Object.fromEntries(chapters.map(ch=>[ch.id,chapterProgress(ch.id)])));
  },[]);
  const completed=chapters.filter(ch=>(progress[ch.id]||0)===100).length;

  return <main className="visual-library-page">
    <header className="topbar compact">
      <a className="brand" href="/murid/utama"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>NOTA VISUAL</small></span></a>
      <a className="back" href="/murid/utama">← Utama</a>
    </header>
    <section className="visual-library-hero">
      <div><span className="eyebrow">PERPUSTAKAAN GEOBOOST</span><h1>Nota Visual Bab 1–10</h1><p>Nota pantas, poster, slide dan rajah dalam satu tempat.</p></div>
      <div><small>SELESAI</small><b>{completed}/10</b><span>bab nota visual</span></div>
    </section>
    <section className="visual-library-grid">
      {chapters.map(ch=>{
        const value=progress[ch.id]||0;
        return <a key={ch.id} href={"/nota/"+ch.id} className="visual-library-card">
          <div className="visual-library-icon">{ch.icon}</div>
          <div className="visual-library-copy"><small>BAB {ch.id}</small><h2>{ch.title}</h2><p>{ch.short}</p></div>
          <div className="visual-library-card-progress"><div><i style={{width:value+"%"}}/></div><span>{value}%</span></div>
          <strong>{value===100?"Ulang nota":"Buka nota"} →</strong>
        </a>
      })}
    </section>
  </main>;
}
