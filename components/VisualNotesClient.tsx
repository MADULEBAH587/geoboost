"use client";

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { GeoStimulus } from "@/components/GeoStimulus";
import { getStudentSession } from "@/lib/session";
import type { VisualNoteChapter, VisualNoteTab } from "@/lib/visualNotes";
import { getVisualAssetPayload, listVisualAssets, type VisualAssetMeta } from "@/lib/visualNotesMedia";

const TABS:{id:VisualNoteTab;icon:string;label:string}[]=[
  {id:"quick",icon:"⚡",label:"Nota Pantas"},
  {id:"poster",icon:"🖼️",label:"Poster"},
  {id:"slides",icon:"▣",label:"Slide"},
  {id:"diagram",icon:"🗺️",label:"Peta & Rajah"},
];

function progressKey(chapter:number){
  const student=getStudentSession();
  return "geoboost_visual_notes_progress_"+(student?.id||"guest")+"_"+chapter;
}

function getSeen(chapter:number):VisualNoteTab[]{
  if(typeof window==="undefined")return [];
  try{return JSON.parse(localStorage.getItem(progressKey(chapter))||"[]")}catch{return []}
}

function saveSeen(chapter:number,tab:VisualNoteTab){
  const current=getSeen(chapter);
  if(current.includes(tab))return current;
  const next=[...current,tab];
  localStorage.setItem(progressKey(chapter),JSON.stringify(next));
  return next;
}

function assetLabel(item:VisualAssetMeta){
  if(item.category==="poster")return "Poster tambahan";
  if(item.category==="slide")return "Slide tambahan";
  return "Peta / rajah tambahan";
}

export function VisualNotesClient({note}:{note:VisualNoteChapter}){
  const [tab,setTab]=useState<VisualNoteTab>("quick");
  const [seen,setSeen]=useState<VisualNoteTab[]>([]);
  const [slide,setSlide]=useState(0);
  const [assets,setAssets]=useState<VisualAssetMeta[]>([]);
  const [viewer,setViewer]=useState<{item:VisualAssetMeta;dataUrl:string}|null>(null);
  const [loadingAsset,setLoadingAsset]=useState("");
  const touchStart=useRef<number|null>(null);

  useEffect(()=>{
    const initial=getSeen(note.chapter);
    const next=saveSeen(note.chapter,"quick");
    setSeen(next.length?next:initial);
    void listVisualAssets(note.chapter).then(setAssets);
  },[note.chapter]);

  const progress=Math.round(seen.length/TABS.length*100);
  const categoryAssets=useMemo(()=>{
    if(tab==="poster")return assets.filter(x=>x.category==="poster");
    if(tab==="slides")return assets.filter(x=>x.category==="slide");
    if(tab==="diagram")return assets.filter(x=>x.category==="diagram");
    return [];
  },[assets,tab]);

  function chooseTab(next:VisualNoteTab){
    setTab(next);
    setSeen(saveSeen(note.chapter,next));
  }

  function nextSlide(){
    setSlide(v=>Math.min(note.slides.length-1,v+1));
  }
  function prevSlide(){
    setSlide(v=>Math.max(0,v-1));
  }

  async function openAsset(item:VisualAssetMeta){
    setLoadingAsset(item.id);
    const dataUrl=await getVisualAssetPayload(item.id);
    setLoadingAsset("");
    if(dataUrl)setViewer({item,dataUrl});
  }

  function onTouchStart(e:TouchEvent){touchStart.current=e.changedTouches[0]?.clientX??null}
  function onTouchEnd(e:TouchEvent){
    if(touchStart.current===null)return;
    const end=e.changedTouches[0]?.clientX??touchStart.current;
    const dx=end-touchStart.current;
    if(Math.abs(dx)>45){if(dx<0)nextSlide();else prevSlide()}
    touchStart.current=null;
  }

  return <main className="visual-notes-page">
    <header className="topbar compact visual-note-topbar">
      <a className="brand" href="/murid/utama"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>NOTA VISUAL</small></span></a>
      <a className="back" href={"/bab/"+note.chapter}>← Bab {note.chapter}</a>
    </header>

    <section className="visual-note-hero">
      <div>
        <span className="eyebrow">BAB {note.chapter} · NOTA VISUAL</span>
        <h1><span>{note.accent}</span>{note.title}</h1>
        <p>{note.subtitle}</p>
      </div>
      <div className="visual-note-progress">
        <div><small>KEMAJUAN NOTA</small><b>{progress}%</b></div>
        <div><i style={{width:progress+"%"}}/></div>
        <span>{seen.length}/4 bahagian telah dilihat</span>
      </div>
    </section>

    <nav className="visual-note-tabs" aria-label="Bahagian nota">
      {TABS.map(item=><button key={item.id} onClick={()=>chooseTab(item.id)} className={tab===item.id?"active":""}><span>{item.icon}</span><b>{item.label}</b>{seen.includes(item.id)?<i>✓</i>:null}</button>)}
    </nav>

    <section className="visual-note-body">
      {tab==="quick"?<div className="visual-quick-grid">
        {note.quickFacts.map((item,i)=><article key={item.label}>
          <span>{String(i+1).padStart(2,"0")}</span><small>{item.label}</small><h2>{item.value}</h2><p>{item.detail}</p>
        </article>)}
      </div>:null}

      {tab==="poster"?<>
        <article className="visual-poster">
          <div className="visual-poster-head"><div><small>GEOBOOST · BAB {note.chapter}</small><h2>{note.title}</h2><p>{note.subtitle}</p></div><span>{note.accent}</span></div>
          <div className="visual-poster-grid">{note.posterBlocks.map((block,i)=><section key={block.title}><b>{String(i+1).padStart(2,"0")}</b><h3>{block.title}</h3><ul>{block.points.map(point=><li key={point}>{point}</li>)}</ul></section>)}</div>
          <footer><strong>INGAT:</strong><span>Baca kata kunci → faham hubungan → cuba latihan.</span></footer>
        </article>
        {categoryAssets.length?<MediaStrip items={categoryAssets} loadingId={loadingAsset} onOpen={openAsset}/>:null}
      </>:null}

      {tab==="slides"?<>
        <div className="visual-slide-shell" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="visual-slide-top"><span>{note.slides[slide].kicker}</span><b>{slide+1} / {note.slides.length}</b></div>
          <article className="visual-slide">
            <small>GEOBOOST SLIDE · BAB {note.chapter}</small>
            <h2>{note.slides[slide].title}</h2>
            <ul>{note.slides[slide].bullets.map((point,i)=><li key={point}><span>{i+1}</span><p>{point}</p></li>)}</ul>
            {note.slides[slide].note?<blockquote>{note.slides[slide].note}</blockquote>:null}
          </article>
          <div className="visual-slide-controls">
            <button onClick={prevSlide} disabled={slide===0}>← Sebelum</button>
            <div>{note.slides.map((_,i)=><button aria-label={"Slide "+(i+1)} key={i} className={i===slide?"active":""} onClick={()=>setSlide(i)}/>)}</div>
            <button onClick={nextSlide} disabled={slide===note.slides.length-1}>Seterusnya →</button>
          </div>
          <small className="visual-swipe-note">Di telefon: leret kiri / kanan untuk tukar slide.</small>
        </div>
        {categoryAssets.length?<MediaStrip items={categoryAssets} loadingId={loadingAsset} onOpen={openAsset}/>:null}
      </>:null}

      {tab==="diagram"?<>
        <div className="visual-diagram-panel">
          <div className="visual-section-label"><span>RAJAH TERBINA DALAM</span><b>Gunakan visual untuk faham konsep</b></div>
          <GeoStimulus kind={note.stimulus}/>
        </div>
        {categoryAssets.length?<MediaStrip items={categoryAssets} loadingId={loadingAsset} onOpen={openAsset}/>:null}
      </>:null}

      {progress===100?<section className="visual-complete">
        <span>🎉</span><div><small>NOTA SELESAI</small><h2>Uji kefahaman Bab {note.chapter}</h2><p>Anda sudah melihat semua bahagian nota visual. Teruskan dengan latihan untuk mengukuhkan ingatan.</p></div>
        <a className="primary" href={"/latihan/"+note.chapter}>Mula Latihan →</a>
      </section>:null}
    </section>

    {viewer?<div className="visual-viewer" onMouseDown={()=>setViewer(null)}>
      <div onMouseDown={e=>e.stopPropagation()}>
        <header><div><small>{assetLabel(viewer.item)}</small><b>{viewer.item.title}</b></div><button onClick={()=>setViewer(null)}>×</button></header>
        <div className="visual-viewer-image"><img src={viewer.dataUrl} alt={viewer.item.title}/></div>
        <small>Gunakan pinch-to-zoom pada telefon atau zoom pelayar jika perlu.</small>
      </div>
    </div>:null}
  </main>;
}

function MediaStrip({items,loadingId,onOpen}:{items:VisualAssetMeta[];loadingId:string;onOpen:(item:VisualAssetMeta)=>void}){
  return <section className="visual-extra-media">
    <div className="visual-section-label"><span>BAHAN TAMBAHAN GURU</span><b>{items.length} bahan</b></div>
    <div>{items.map(item=><button key={item.id} onClick={()=>onOpen(item)} disabled={loadingId===item.id}>
      <span>{item.category==="poster"?"🖼️":item.category==="slide"?"▣":"🗺️"}</span>
      <div><small>{assetLabel(item)}</small><b>{item.title}</b></div>
      <i>{loadingId===item.id?"Memuat...":"Buka →"}</i>
    </button>)}</div>
  </section>;
}
