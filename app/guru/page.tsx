"use client";

import { useEffect, useMemo, useState } from "react";
import { chapters } from "@/lib/data";
import { questions } from "@/lib/questions";
import { AttemptRecord, getLocalAttempts, getRemoteAttempts } from "@/lib/repository";
import { firebaseConfigured, getFirebaseServices, signInTeacherWithGoogle, signOutFirebaseUser, watchFirebaseAuth } from "@/lib/firebase";
import { ClassRecord, listClasses, removeClass, saveClass } from "@/lib/classroom";

type Source = "local" | "firebase";

function downloadCsv(attempts: AttemptRecord[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"','""')}"`;
  const rows = [["Nama","Kelas","Bab/Mod","Markah","Jumlah","Peratus","Tempoh(s)","Subtopik lemah","Tarikh"], ...attempts.map(a=>[
    a.studentName, a.className, a.chapter ? `Bab ${a.chapter}` : (a.label || a.mode || "Campuran"), a.score, a.total, a.percentage, a.durationSeconds, a.wrongSubtopics.join(" | "), new Date(a.completedAt).toLocaleString("ms-MY")
  ])];
  const csv = rows.map(r=>r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff"+csv], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`geoboost-laporan-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

export default function TeacherPage() {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [source, setSource] = useState<Source>("local");
  const [message, setMessage] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherUid, setTeacherUid] = useState("");
  const [classFilter, setClassFilter] = useState("SEMUA");
  const [chapterFilter, setChapterFilter] = useState(0);
  const [managedClasses, setManagedClasses] = useState<ClassRecord[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [newClassCode, setNewClassCode] = useState("");

  async function loadTeacherData(user: { email: string | null; uid: string }) {
    setTeacherEmail(user.email || "Guru");
    setTeacherUid(user.uid);
    const remote = await getRemoteAttempts();
    const remoteClasses = await listClasses();
    setManagedClasses(remoteClasses);
    setAttempts(remote);
    setSource("firebase");
    setMessage(`Berjaya memuat ${remote.length} rekod pusat.`);
  }

  useEffect(() => {
    setAttempts(getLocalAttempts().filter(a=>a.studentId!=="demo"));
    const stop = watchFirebaseAuth((user) => {
      if (user && !user.isAnonymous) {
        loadTeacherData(user).catch((error: any) => {
          console.error(error);
          setTeacherEmail(user.email || "Guru");
          setTeacherUid(user.uid);
          setSource("local");
          const detail = error?.code ? ` (${error.code})` : "";
          setMessage(`Akaun Google dikesan tetapi akses pusat belum tersedia.${detail}`);
        });
      }
    });
    return stop;
  }, []);

  async function connectTeacher() {
    setMessage("Menyambung ke Firebase...");
    try {
      const user = await signInTeacherWithGoogle();
      if (!user) { setMessage("Log masuk Google tidak selesai."); return; }
      await loadTeacherData(user);
    } catch (error: any) {
      console.error(error);
      const detail = error?.code ? ` (${error.code})` : "";
      setMessage(`Akaun ini belum diberi akses guru dalam koleksi teachers, atau Firestore belum disediakan.${detail}`);
    }
  }

  async function disconnectTeacher() {
    await signOutFirebaseUser();
    setTeacherEmail(""); setTeacherUid(""); setSource("local"); setAttempts(getLocalAttempts().filter(a=>a.studentId!=="demo")); setManagedClasses([]); setMessage("Kembali ke data pada peranti ini.");
  }

  async function addClass() {
    if (!newClassName.trim() || !newClassCode.trim()) return;
    try {
      const saved = await saveClass({ name: newClassName, code: newClassCode });
      setManagedClasses((current) => [...current.filter((item) => item.code !== saved.code), saved].sort((a,b)=>a.name.localeCompare(b.name)));
      setNewClassName(""); setNewClassCode(""); setMessage(`Kelas ${saved.name} (${saved.code}) disimpan.`);
    } catch (error) {
      console.error(error); setMessage("Kelas tidak dapat disimpan. Pastikan akaun guru telah diberi akses Firestore.");
    }
  }

  async function deleteClass(code: string) {
    if (!confirm(`Padam kelas ${code}?`)) return;
    try {
      await removeClass(code);
      setManagedClasses((current)=>current.filter((item)=>item.code!==code));
      setMessage(`Kelas ${code} dipadam.`);
    } catch (error) {
      console.error(error); setMessage("Kelas tidak dapat dipadam.");
    }
  }

  const classes = useMemo(() => ["SEMUA", ...Array.from(new Set([...attempts.map(a=>a.className), ...managedClasses.map(c=>c.name)].filter(Boolean))).sort()], [attempts, managedClasses]);
  const filtered = useMemo(() => attempts.filter(a => (classFilter === "SEMUA" || a.className === classFilter) && (!chapterFilter || a.chapter === chapterFilter)), [attempts,classFilter,chapterFilter]);

  const stats = useMemo(() => {
    const avg = filtered.length ? Math.round(filtered.reduce((s,a)=>s+a.percentage,0)/filtered.length) : 0;
    const students = new Set(filtered.map(a=>a.studentId || `${a.studentName}|${a.className}`)).size;
    const passed = filtered.filter(a=>a.percentage>=60).length;
    return { avg, students, completed: filtered.length, passRate: filtered.length ? Math.round(passed/filtered.length*100) : 0 };
  }, [filtered]);

  const weak = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach(a=>a.wrongSubtopics.forEach(s=>counts.set(s,(counts.get(s)||0)+1)));
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
  }, [filtered]);

  const missedItems = useMemo(() => {
    const counts = new Map<string, {wrong:number,total:number}>();
    filtered.forEach(a=>a.responses?.forEach(r=>{
      const cur=counts.get(r.questionId)||{wrong:0,total:0}; cur.total++; if(!r.correct)cur.wrong++; counts.set(r.questionId,cur);
    }));
    return [...counts.entries()].map(([id,v])=>({id,...v,rate:v.total?Math.round(v.wrong/v.total*100):0})).filter(x=>x.total>=1).sort((a,b)=>b.rate-a.rate || b.wrong-a.wrong).slice(0,6);
  }, [filtered]);

  return (
    <main className="teacher-shell">
      <header className="teacher-nav"><a className="brand" href="/"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>CONTROL CENTER</small></span></a><a className="back" href="/">← Murid</a></header>
      <section className="teacher-head"><span className="eyebrow dark">PANEL GURU · v1.1</span><h1>GeoBoost Control Center</h1><p>Analisis kelas, subtopik lemah dan item yang paling kerap salah. Data pusat aktif apabila Firebase disambungkan dan akaun guru dibenarkan.</p>
        <div className="teacher-connect">
          <span className={`source-pill ${source}`}>{source === "firebase" ? "☁️ Firebase" : "📱 Peranti"}</span>
          {firebaseConfigured ? (source === "firebase" ? <><b>{teacherEmail}</b><button onClick={disconnectTeacher}>Log keluar</button></> : <button className="teacher-login" onClick={connectTeacher}>Masuk Google Guru</button>) : <span>Firebase env belum diisi</span>}
        </div>
        {message ? <div className="teacher-message">{message}</div> : null}
        {teacherUid && source !== "firebase" ? <div className="teacher-bootstrap"><div><small>UID UNTUK AKTIFKAN ADMIN</small><code>{teacherUid}</code><span>{teacherEmail || "Akaun Google guru"}</span></div><button onClick={async()=>{await navigator.clipboard.writeText(teacherUid); setMessage("UID guru telah disalin.");}}>Salin UID</button></div> : null}
      </section>

      <section className="teacher-content">
        <div className="filter-bar">
          <label>Kelas<select value={classFilter} onChange={e=>setClassFilter(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></label>
          <label>Bab<select value={chapterFilter} onChange={e=>setChapterFilter(Number(e.target.value))}><option value={0}>Semua Bab</option>{chapters.map(c=><option key={c.id} value={c.id}>Bab {c.id}</option>)}</select></label>
          <button onClick={()=>downloadCsv(filtered)} disabled={!filtered.length}>Eksport CSV</button>
        </div>

        <div className="teacher-stats"><div><small>Murid</small><b>{stats.students}</b></div><div><small>Latihan selesai</small><b>{stats.completed}</b></div><div><small>Purata</small><b>{stats.avg}%</b></div><div><small>Kadar ≥60%</small><b>{stats.passRate}%</b></div><div><small>Bank aktif</small><b>{questions.length}</b></div></div>
        <div className="teacher-grid">
          <section className="panel"><div className="panel-title"><div><small>TERKINI</small><h2>Percubaan murid</h2></div><span>{filtered.length}</span></div>{filtered.length ? <div className="attempt-table">{filtered.slice(0,15).map(a=><div className="attempt-row" key={a.id}><div><strong>{a.studentName}</strong><small>{a.className} · {a.chapter ? `Bab ${a.chapter}` : (a.label || a.mode || "Campuran")}</small></div><b>{a.percentage}%</b><span>{new Date(a.completedAt).toLocaleDateString("ms-MY")}</span></div>)}</div> : <div className="panel-empty">Belum ada rekod untuk penapis ini.</div>}</section>
          <section className="panel"><div className="panel-title"><div><small>PEMULIHAN</small><h2>Subtopik perlu perhatian</h2></div></div>{weak.length ? weak.map(([topic,count],i)=><div className="weak-row" key={topic}><span>#{i+1} · {topic}</span><div><i style={{width:`${Math.min(100,count*14)}%`}} /></div><b>{count}</b></div>) : <div className="panel-empty">Analisis akan muncul selepas terdapat jawapan salah.</div>}</section>
        </div>

        <section className="panel"><div className="panel-title"><div><small>ANALISIS ITEM</small><h2>Soalan paling kerap salah</h2></div></div>{missedItems.length ? <div className="item-analysis">{missedItems.map(x=>{const q=questions.find(q=>q.id===x.id);return <div key={x.id}><span>{x.id}</span><div><strong>{q?.prompt || "Soalan"}</strong><small>{x.wrong}/{x.total} salah</small></div><b>{x.rate}%</b></div>})}</div> : <div className="panel-empty">Rekod GeoBoost menyimpan respons per item. Analisis akan terbina selepas murid menjawab set baharu.</div>}</section>


        {source === "firebase" ? <section className="panel class-manager"><div className="panel-title"><div><small>PENGURUSAN KELAS</small><h2>Kod kelas murid</h2></div><span>{managedClasses.length}</span></div><p className="class-help">Cipta kod kelas untuk mengesahkan murid yang masuk melalui halaman Akses Murid. Kod tidak peka huruf besar/kecil.</p><div className="class-create"><input value={newClassName} onChange={e=>setNewClassName(e.target.value)} placeholder="Nama kelas · contoh 2E"/><input value={newClassCode} onChange={e=>setNewClassCode(e.target.value)} placeholder="Kod · contoh 2E26"/><button onClick={addClass} disabled={!newClassName.trim() || !newClassCode.trim()}>Tambah kelas</button></div>{managedClasses.length ? <div className="class-list">{managedClasses.map(item=><div key={item.code}><div><strong>{item.name}</strong><small>{item.code}</small></div><span>{item.active ? "Aktif" : "Tidak aktif"}</span><button onClick={()=>deleteClass(item.code)}>Padam</button></div>)}</div> : <div className="panel-empty">Belum ada kelas dalam Firestore.</div>}</section> : null}

        <section className="panel chapter-status"><div className="panel-title"><div><small>KANDUNGAN</small><h2>Status bank Bab 1–10</h2></div></div><div className="teacher-chapters">{chapters.map(c=><div key={c.id}><span>{c.icon}</span><div><small>BAB {c.id}</small><strong>{c.title}</strong></div><b>{questions.filter(q=>q.chapter===c.id).length} soalan</b></div>)}</div></section>
      </section>
    </main>
  );
}
