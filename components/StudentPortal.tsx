"use client";

import { useEffect, useMemo, useState } from "react";
import { chapters } from "@/lib/data";
import { questions } from "@/lib/questions";
import { ClassRecord, validateClassCode } from "@/lib/classroom";
import { AttemptRecord, getLocalAttempts, getStudentCloudAttempts, repairCurrentStudentCloudRecords } from "@/lib/repository";
import { clearStudentSession, getStudentSession, StudentSession } from "@/lib/session";
import { firebaseConfigured, signOutFirebaseUser } from "@/lib/firebase";
import { registerStudentPresence } from "@/lib/studentPresence";
import { StudentBottomNav } from "@/components/StudentBottomNav";

type Section = "utama"|"tugasan"|"latihan"|"prestasi"|"profil";
type ResumeItem = { key:string; title:string; href:string; index:number; total:number; savedAt:number };

function mergeAttempts(local: AttemptRecord[], remote: AttemptRecord[]) {
  const map=new Map<string,AttemptRecord>();
  [...remote,...local].forEach(item=>map.set(item.id,item));
  return [...map.values()].sort((a,b)=>b.completedAt-a.completedAt);
}

function masteryLabel(value:number) {
  if(value>=80) return "Cemerlang";
  if(value>=60) return "Menguasai";
  if(value>0) return "Perlu Pengukuhan";
  return "Belum cuba";
}

export function StudentPortal({ section }: { section: Section }) {
  const [student,setStudent]=useState<StudentSession|null>(null);
  const [classRecord,setClassRecord]=useState<ClassRecord|null>(null);
  const [attempts,setAttempts]=useState<AttemptRecord[]>([]);
  const [resume,setResume]=useState<ResumeItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [assignmentTab,setAssignmentTab]=useState<"aktif"|"selesai"|"lewat">("aktif");
  const [bookmarks,setBookmarks]=useState<string[]>([]);

  useEffect(()=>{
    let live=true;
    async function load(){
      const current=getStudentSession();
      if(!current){ window.location.replace("/murid"); return; }
      setStudent(current);

      // Background repair: cloud sync retries automatically after login.
      // Local session remains usable even when Firestore rules/network are temporarily unavailable.
      if(firebaseConfigured){
        void (async()=>{
          try{
            const result=await repairCurrentStudentCloudRecords({
              localStudentId:current.id,
              name:current.name,
              className:current.className,
              classCode:current.classCode,
            });
            if(result.profileSynced){
              localStorage.removeItem("geoboost_cloud_profile_pending");
              try{
                await registerStudentPresence({
                  classCode:current.classCode,
                  studentId:current.id,
                  studentName:current.name,
                });
              }catch{}
            }
          }catch{}
        })();
      }

      const local=getLocalAttempts().filter(a=>a.studentId===current.id);
      let remote:AttemptRecord[]=[];
      try{ remote=await getStudentCloudAttempts(current.id); }catch{}
      if(!live)return;
      setAttempts(mergeAttempts(local,remote));
      try{ setClassRecord(await validateClassCode(current.classCode)); }catch{ setClassRecord(null); }
      try{
        const found:ResumeItem[]=[];
        for(let i=0;i<localStorage.length;i++){
          const key=localStorage.key(i)||"";
          if(!key.startsWith("geoboost_resume_"+current.id+"_")) continue;
          try{
            const data=JSON.parse(localStorage.getItem(key)||"{}");
            found.push({
              key,
              title:String(data.title||"Latihan belum selesai"),
              href:String(data.href||"/murid/latihan"),
              index:Number(data.index||0),
              total:Array.isArray(data.sessionIds)?data.sessionIds.length:0,
              savedAt:Number(data.savedAt||0),
            });
          }catch{}
        }
        setResume(found.sort((a,b)=>b.savedAt-a.savedAt));
      }catch{}
      try{setBookmarks(JSON.parse(localStorage.getItem("geoboost_bookmarks_"+current.id)||"[]"))}catch{}
      setLoading(false);
    }
    load();
    return()=>{live=false};
  },[]);

  useEffect(()=>{
    if(!student||!firebaseConfigured)return;
    let busy=false;
    const repair=async()=>{
      if(busy)return;
      busy=true;
      try{
        const result=await repairCurrentStudentCloudRecords({
          localStudentId:student.id,name:student.name,className:student.className,classCode:student.classCode,
        });
        if(result.synced>0){
          const local=getLocalAttempts().filter(a=>a.studentId===student.id);
          let remote:AttemptRecord[]=[];
          try{remote=await getStudentCloudAttempts(student.id)}catch{}
          setAttempts(mergeAttempts(local,remote));
        }
      }catch{}finally{busy=false}
    };
    const onOnline=()=>void repair();
    const onVisible=()=>{if(document.visibilityState==="visible")void repair()};
    window.addEventListener("online",onOnline);
    window.addEventListener("focus",onOnline);
    document.addEventListener("visibilitychange",onVisible);
    const timer=window.setInterval(()=>void repair(),60000);
    return()=>{window.removeEventListener("online",onOnline);window.removeEventListener("focus",onOnline);document.removeEventListener("visibilitychange",onVisible);window.clearInterval(timer)};
  },[student]);

  const own=attempts;
  const byChapter=useMemo(()=>chapters.map(ch=>{
    const list=own.filter(a=>a.chapter===ch.id);
    const best=list.length?Math.max(...list.map(a=>a.percentage)):0;
    const latest=list[0]?.percentage||0;
    return {...ch,best,latest,tries:list.length,label:masteryLabel(best)};
  }),[own]);

  const avg=own.length?Math.round(own.reduce((s,a)=>s+a.percentage,0)/own.length):0;
  const xp=own.reduce((s,a)=>s+a.score*10,0);
  const completedChapters=byChapter.filter(ch=>ch.best>=60).length;
  const unsureCount=own.reduce((s,a)=>s+(a.responses||[]).filter(r=>r.unsure).length,0);

  const weakTopics=useMemo(()=>{
    const map=new Map<string,number>();
    own.forEach(a=>a.responses?.forEach(r=>{if(!r.correct)map.set(r.subtopic,(map.get(r.subtopic)||0)+1)}));
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
  },[own]);

  const subtopicMastery=useMemo(()=>{
    const map=new Map<string,{correct:number,total:number}>();
    own.forEach(a=>a.responses?.forEach(r=>{
      const cur=map.get(r.subtopic)||{correct:0,total:0};
      cur.total++; if(r.correct)cur.correct++; map.set(r.subtopic,cur);
    }));
    return [...map.entries()].map(([topic,v])=>({topic,total:v.total,percentage:v.total?Math.round(v.correct/v.total*100):0})).sort((a,b)=>a.percentage-b.percentage);
  },[own]);

  const weakChapter=useMemo(()=>{
    const scored=byChapter.filter(ch=>ch.tries>0).sort((a,b)=>a.best-b.best);
    return scored[0]||null;
  },[byChapter]);

  const today=new Date().toISOString().slice(0,10);
  const assignments=useMemo(()=> {
    if(!student) return [];
    return (classRecord?.assignments||[]).filter(a=>!a.targetStudentIds?.length || a.targetStudentIds.includes(student.id));
  },[classRecord,student]);
  const assignmentInfo=assignments.map(item=>{
    const taskAttempts=own.filter(a=>a.mode===("tugasan:"+item.id));
    const best=taskAttempts.length?Math.max(...taskAttempts.map(a=>a.percentage)):0;
    const completed=taskAttempts.length>0;
    const late=!completed && !!item.dueDate && item.dueDate<today;
    return {item,taskAttempts,best,completed,late};
  });
  const filteredAssignments=assignmentInfo.filter(x=>assignmentTab==="selesai"?x.completed:assignmentTab==="lewat"?x.late:!x.completed&&!x.late&&x.item.active);

  const badges=[
    own.length>=1?["🎯","Langkah Pertama"]:null,
    own.length>=5?["🔥","5 Latihan Selesai"]:null,
    own.some(a=>a.percentage===100)?["🏆","Skor Sempurna"]:null,
    xp>=500?["⭐","500 Mata Ilmu"]:null,
    completedChapters>=5?["🗺️","5 Bab Dikuasai"]:null,
  ].filter(Boolean) as string[][];

  async function logout(){
    if(!window.confirm("Log keluar daripada akaun murid ini?")) return;
    clearStudentSession();
    try{await signOutFirebaseUser()}catch{}
    window.location.href="/murid";
  }

  if(loading||!student){
    return <main className="student-app-loading"><div className="student-loader">Memuatkan GeoBoost…</div></main>;
  }

  const assignmentCard=(x:(typeof assignmentInfo)[number])=><article className="student-task-card" key={x.item.id}>
    <div><small>{x.completed?"SELESAI":x.late?"LEWAT":"TUGASAN GURU"}</small><h3>{x.item.title}</h3><p>Bab {x.item.chapter} · {x.item.questionCount} soalan · maksimum {x.item.maxAttempts||3} percubaan</p>{x.item.dueDate?<span>Tarikh akhir {new Date(x.item.dueDate+"T00:00:00").toLocaleDateString("ms-MY")}</span>:null}</div>
    <div className="student-task-action">{x.completed?<><b>{x.best}%</b><a href={"/tugasan?class="+student.classCode+"&id="+x.item.id}>Ulang</a></>:<a className="primary" href={"/tugasan?class="+student.classCode+"&id="+x.item.id}>Mula →</a>}</div>
  </article>;

  return (
    <main className="student-app">
      <header className="student-app-top">
        <a className="brand" href="/murid/utama"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>TINGKATAN 2</small></span></a>
        <div className="student-top-actions"><a className="student-top-user" href="/murid/profil"><span>{student.name}</span><b>{student.className}</b></a><button className="student-header-logout" onClick={logout}>🚪 Log Keluar</button></div>
      </header>

      <section className="student-app-content">
        {section==="utama"?<>
          <div className="student-welcome">
            <div><span className="eyebrow dark">UTAMA</span><h1>Hai, {student.name.split(" ")[0]} 👋</h1><p>{student.className}</p></div>
            <div className="student-level"><small>⭐ Mata Ilmu</small><b>{xp}</b></div>
          </div>

          {student.pendingRoster?<div className="student-notice warn">⏳ Nama anda sedang menunggu semakan guru. Anda masih boleh menggunakan GeoBoost.</div>:null}

          {resume.length?<section className="student-focus-card resume"><div><small>SAMBUNG LATIHAN</small><h2>{resume[0].title}</h2><p>Soalan {Math.min(resume[0].index+1,resume[0].total)}/{resume[0].total} · kemajuan disimpan automatik.</p></div><a className="primary" href={resume[0].href}>Sambung →</a></section>:null}

          {assignmentInfo.some(x=>!x.completed&&!x.late&&x.item.active)?<section className="student-home-section"><div className="student-section-head"><div><small>PERLU DIBUAT</small><h2>Tugasan Guru</h2></div><a href="/murid/tugasan">Lihat semua →</a></div>{assignmentInfo.filter(x=>!x.completed&&!x.late&&x.item.active).slice(0,2).map(assignmentCard)}</section>:null}

          <section className="student-focus-card recommendation">
            <div><small>🎯 FOKUS UNTUK ANDA</small><h2>{weakChapter?"Kuatkan Bab "+weakChapter.id:"Mulakan latihan pertama"}</h2><p>{weakChapter?weakChapter.title+" · prestasi terbaik "+weakChapter.best+"%":"Pilih mana-mana bab yang telah dibuka oleh guru."}</p></div>
            <a className="primary" href={weakChapter?"/bab/"+weakChapter.id:"/murid/utama"}>{weakChapter?"Kuatkan Bab Ini":"Pilih Bab"} →</a>
          </section>

          <section className="student-home-section"><div className="student-section-head"><div><small>KEMAJUAN</small><h2>Bab Saya</h2></div></div><div className="student-chapter-compact">{byChapter.map(ch=>{const locked=classRecord?!classRecord.openChapters.includes(ch.id):false;return <a key={ch.id} className={locked?"locked":""} href={locked?"#":"/bab/"+ch.id}><span>{ch.icon}</span><div><small>BAB {ch.id}</small><b>{ch.title}</b><i>{locked?"🔒 Ditutup":ch.tries?ch.label:"Belum cuba"}</i></div><strong>{locked?"—":ch.best+"%"}</strong></a>})}</div></section>

          <section className="student-quick-grid"><a href="/harian"><span>⚡</span><b>Misi Hari Ini</b><small>5 soalan pantas</small></a><a href="/pemulihan"><span>🎯</span><b>Pemulihan Pintar</b><small>Fokus kelemahan</small></a><a href="/uasa"><span>🏆</span><b>Simulasi UASA</b><small>Simulasi peperiksaan</small></a></section>
          <section className="student-home-summary"><div><small>PRESTASI RINGKAS</small><b>{avg}% purata · {completedChapters}/10 bab dikuasai</b></div><a href="/murid/prestasi">Lihat perkembangan →</a></section>
          <button className="student-danger-button student-home-logout" onClick={logout}>🚪 Log Keluar Murid</button>
        </>:null}

        {section==="tugasan"?<>
          <div className="student-page-title"><span className="eyebrow dark">TUGASAN</span><h1>Tugasan Saya</h1><p>Semua tugasan daripada guru kelas anda.</p></div>
          <div className="student-tabs">{(["aktif","selesai","lewat"] as const).map(tab=><button key={tab} className={assignmentTab===tab?"active":""} onClick={()=>setAssignmentTab(tab)}>{tab==="aktif"?"Perlu Dibuat":tab==="selesai"?"Selesai":"Lewat"} <span>{assignmentInfo.filter(x=>tab==="selesai"?x.completed:tab==="lewat"?x.late:!x.completed&&!x.late&&x.item.active).length}</span></button>)}</div>
          <div className="student-task-list">{filteredAssignments.length?filteredAssignments.map(assignmentCard):<div className="student-empty">Tiada tugasan dalam kategori ini.</div>}</div>
        </>:null}

        {section==="latihan"?<>
          <div className="student-page-title"><span className="eyebrow dark">LATIHAN</span><h1>Pilih Cara Belajar</h1><p>Latihan kendiri, pemulihan, cabaran harian dan UASA.</p></div>
          <div className="student-mode-grid"><a href="/pantas"><span>⚡</span><h3>Latih Tubi Pantas</h3><p>Gabungkan bab yang telah dibuka.</p></a><a href="/pemulihan"><span>🎯</span><h3>Pemulihan</h3><p>Soalan berdasarkan kelemahan anda.</p></a><a href="/uasa"><span>🏆</span><h3>Cabaran UASA</h3><p>Simulasi tanpa jawapan segera.</p></a><a href="/ulang-salah"><span>🔁</span><h3>Ulang Soalan Salah</h3><p>Ulang soalan yang pernah dijawab salah.</p></a></div>
          <div className="student-section-head"><div><small>BAB 1–10</small><h2>Latihan Bab</h2></div></div>
          <div className="student-chapter-compact full">{byChapter.map(ch=>{const locked=classRecord?!classRecord.openChapters.includes(ch.id):false;return <a key={ch.id} className={locked?"locked":""} href={locked?"#":"/bab/"+ch.id}><span>{ch.icon}</span><div><small>BAB {ch.id}</small><b>{ch.title}</b><i>{locked?"Dikunci guru":ch.tries?ch.label:"Belum cuba"}</i></div><strong>{locked?"🔒":ch.best+"%"}</strong></a>})}</div>
          {bookmarks.length?<a className="student-notice bookmark-notice" href="/bookmark">🔖 Anda mempunyai <b>{bookmarks.length}</b> soalan disimpan. Tekan untuk ulang sekarang →</a>:null}
        </>:null}

        {section==="prestasi"?<>
          <div className="student-page-title"><span className="eyebrow dark">PRESTASI</span><h1>Prestasi Saya</h1><p>Jejak perkembangan dan fokus pada topik yang masih lemah.</p></div>
          <div className="student-metric-grid"><div><small>Purata</small><b>{avg}%</b><span>{masteryLabel(avg)}</span></div><div><small>Mata Ilmu</small><b>{xp}</b><span>{own.length} latihan</span></div><div><small>Bab dikuasai</small><b>{completedChapters}/10</b><span>sasaran ≥60%</span></div><div><small>Tidak pasti</small><b>{unsureCount}</b><span>jawapan ditanda</span></div></div>
          <section className="student-performance-panel"><div className="student-section-head"><div><small>PERKEMBANGAN</small><h2>10 latihan terakhir</h2></div></div><div className="student-trend">{own.slice(0,10).reverse().map((a,i)=><div key={a.id}><span style={{height:Math.max(8,a.percentage)+"%"}}></span><small>{a.percentage}%</small><i>{i+1}</i></div>)}</div></section>
          <section className="student-performance-panel"><div className="student-section-head"><div><small>PENGUASAAN</small><h2>Penguasaan Setiap Bab</h2></div></div><div className="mastery-list">{byChapter.map(ch=><div key={ch.id}><span>{ch.icon}</span><div><b>Bab {ch.id} · {ch.title}</b><div><i style={{width:ch.best+"%"}} /></div><small>{ch.label} · {ch.tries} percubaan</small></div><strong>{ch.best}%</strong></div>)}</div></section>
          <section className="student-performance-panel"><div className="student-section-head"><div><small>FOKUS</small><h2>Subtopik Perlu Pengukuhan</h2></div></div>{weakTopics.length?<div className="student-weak-list">{weakTopics.map(([topic,count])=><div key={topic}><b>{topic}</b><span>{count} kesalahan</span></div>)}</div>:<div className="student-empty">Belum cukup data. Lengkapkan latihan dahulu.</div>}</section>
          <section className="student-performance-panel"><div className="student-section-head"><div><small>PENGUASAAN SUBTOPIK</small><h2>Penguasaan Terperinci</h2></div></div>{subtopicMastery.length?<div className="subtopic-mastery-list">{subtopicMastery.map(item=><div key={item.topic}><div><b>{item.topic}</b><small>{item.total} jawapan direkodkan</small></div><div className="subtopic-track"><i style={{width:item.percentage+"%"}} /></div><strong>{item.percentage}%</strong></div>)}</div>:<div className="student-empty">Belum cukup data.</div>}</section>
        </>:null}

        {section==="profil"?<>
          <div className="student-page-title"><span className="eyebrow dark">PROFIL</span><h1>Profil Saya</h1><p>Maklumat diri dan pencapaian GeoBoost.</p></div>
          <section className="student-profile-main"><div className="student-profile-avatar">{student.name.split(/\s+/).slice(0,2).map(x=>x[0]).join("")}</div><h2>{student.name}</h2><p>{student.className} · Kod {student.classCode}</p><div className="student-profile-stats"><div><small>Mata Ilmu</small><b>{xp}</b></div><div><small>Percubaan</small><b>{own.length}</b></div><div><small>Soalan Disimpan</small><b>{bookmarks.length}</b></div></div></section>
          <section className="student-performance-panel"><div className="student-section-head"><div><small>PENCAPAIAN</small><h2>Lencana Saya</h2></div></div><div className="badge-grid">{badges.length?badges.map(([icon,label])=><div key={label}><span>{icon}</span><b>{label}</b></div>):<div className="student-empty">Lengkapkan latihan untuk membuka lencana.</div>}</div></section>
          
          <button className="student-danger-button" onClick={logout}>Keluar / Tukar Murid</button>
        </>:null}
      </section>
      <StudentBottomNav active={section}/>
    </main>
  );
}
