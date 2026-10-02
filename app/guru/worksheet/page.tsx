"use client";

import { useEffect, useState } from "react";
import { questions, Question } from "@/lib/questions";
import { getCustomQuestions, mergeQuestionBanks } from "@/lib/customQuestions";

export default function WorksheetPage(){
  const [items,setItems]=useState<Question[]|null>(null);
  const [title,setTitle]=useState("Lembaran Latihan GeoBoost");
  useEffect(()=>{
    async function load(){
      const params=new URLSearchParams(window.location.search);
      const ids=(params.get("ids")||"").split(",").filter(Boolean);
      setTitle(params.get("title")||"Lembaran Latihan GeoBoost");
      const merged=mergeQuestionBanks(questions,await getCustomQuestions());
      setItems(ids.map(id=>merged.find(q=>q.id===id)).filter(Boolean) as Question[]);
    }
    load();
  },[]);
  if(items===null)return <main className="worksheet-page"><p>Memuatkan…</p></main>;
  return <main className="worksheet-page">
    <div className="worksheet-toolbar"><a href="/guru">← Panel Guru</a><button onClick={()=>window.print()}>Cetak / Simpan PDF</button></div>
    <header className="worksheet-header"><div><b>GEOBOOST TINGKATAN 2</b><span>By Cikgu Zulhasif</span></div><h1>{title}</h1><p>Nama: ________________________________ &nbsp;&nbsp; Kelas: __________ &nbsp;&nbsp; Tarikh: __________</p></header>
    <section className="worksheet-questions">{items.length?items.map((q,i)=><article key={q.id}><div className="worksheet-qhead"><b>{i+1}.</b><small>Bab {q.chapter} · {q.subtopic} · {q.difficulty.toUpperCase()}</small></div><p>{q.prompt}</p><div className="worksheet-options">{q.options.map((opt,j)=><span key={opt}><b>{String.fromCharCode(65+j)}</b> {opt}</span>)}</div></article>):<p>Tiada soalan dipilih.</p>}</section>
    <footer className="worksheet-footer">GeoBoost Tingkatan 2 · Latihan Pengukuhan Interaktif Geografi</footer>
  </main>;
}
