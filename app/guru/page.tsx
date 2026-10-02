"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { chapters } from "@/lib/data";
import { questions } from "@/lib/questions";
import {
  AttemptRecord,
  RegisteredStudent,
  getLocalAttempts,
  getRemoteAttempts,
  getRemoteStudents,
} from "@/lib/repository";
import {
  firebaseConfigured,
  signInTeacherWithGoogle,
  signOutFirebaseUser,
  watchFirebaseAuth,
} from "@/lib/firebase";
import {
  ClassRecord,
  addRosterStudent,
  listClasses,
  normalizeStudentName,
  removeClass,
  removeRosterStudent,
  saveClass,
  saveClassRoster,
} from "@/lib/classroom";

type Source = "local" | "firebase";

function downloadCsv(attempts: AttemptRecord[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"','""')}"`;
  const rows = [["Nama","Kelas","Bab/Mod","Markah","Jumlah","Peratus","Tempoh(s)","Subtopik lemah","Tarikh"], ...attempts.map(a=>[
    a.studentName, a.className, a.chapter ? `Bab ${a.chapter}` : (a.label || a.mode || "Campuran"), a.score, a.total, a.percentage, a.durationSeconds, a.wrongSubtopics.join(" | "), new Date(a.completedAt).toLocaleString("ms-MY")
  ])];
  const csv = rows.map(r=>r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff"+csv], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url;
  a.download=`geoboost-laporan-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TeacherPage() {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudent[]>([]);
  const [source, setSource] = useState<Source>("local");
  const [message, setMessage] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherUid, setTeacherUid] = useState("");
  const [classFilter, setClassFilter] = useState("SEMUA");
  const [chapterFilter, setChapterFilter] = useState(0);
  const [managedClasses, setManagedClasses] = useState<ClassRecord[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [newClassCode, setNewClassCode] = useState("");
  const [rosterClassCode, setRosterClassCode] = useState("");
  const [manualStudentName, setManualStudentName] = useState("");
  const [importing, setImporting] = useState(false);

  async function loadTeacherData(user: { email: string | null; uid: string }) {
    setTeacherEmail(user.email || "Guru");
    setTeacherUid(user.uid);
    const [remote, remoteClasses, remoteStudents] = await Promise.all([
      getRemoteAttempts(),
      listClasses(),
      getRemoteStudents(),
    ]);
    setManagedClasses(remoteClasses);
    setRegisteredStudents(remoteStudents);
    setAttempts(remote);
    setSource("firebase");
    setRosterClassCode((current) => current || remoteClasses[0]?.code || "");
    setMessage(`Berjaya memuat ${remote.length} rekod pusat dan ${remoteStudents.length} profil murid.`);
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
    setTeacherEmail("");
    setTeacherUid("");
    setSource("local");
    setAttempts(getLocalAttempts().filter(a=>a.studentId!=="demo"));
    setManagedClasses([]);
    setRegisteredStudents([]);
    setRosterClassCode("");
    setMessage("Kembali ke data pada peranti ini.");
  }

  async function addClass() {
    if (!newClassName.trim() || !newClassCode.trim()) return;
    try {
      const saved = await saveClass({ name: newClassName, code: newClassCode });
      setManagedClasses((current) => [...current.filter((item) => item.code !== saved.code), saved].sort((a,b)=>a.name.localeCompare(b.name)));
      setRosterClassCode((current)=>current || saved.code);
      setNewClassName("");
      setNewClassCode("");
      setMessage(`Kelas ${saved.name} (${saved.code}) disimpan.`);
    } catch (error) {
      console.error(error);
      setMessage("Kelas tidak dapat disimpan. Pastikan akaun guru telah diberi akses Firestore.");
    }
  }

  async function deleteClass(code: string) {
    if (!confirm(`Padam kelas ${code}? Senarai nama dalam kelas ini tidak lagi boleh digunakan untuk login.`)) return;
    try {
      await removeClass(code);
      setManagedClasses((current)=>current.filter((item)=>item.code!==code));
      setRosterClassCode((current)=>current===code ? "" : current);
      setMessage(`Kelas ${code} dipadam.`);
    } catch (error) {
      console.error(error);
      setMessage("Kelas tidak dapat dipadam.");
    }
  }

  function updateRosterState(code: string, studentNames: string[]) {
    setManagedClasses((current)=>current.map((item)=>item.code===code ? {...item, studentNames} : item));
  }

  async function addStudentToRoster(name = manualStudentName) {
    if (!rosterClassCode || !name.trim()) return;
    try {
      const names = await addRosterStudent(rosterClassCode, name);
      updateRosterState(rosterClassCode, names);
      setManualStudentName("");
      setMessage(`${normalizeStudentName(name)} ditambah ke senarai kelas.`);
    } catch (error) {
      console.error(error);
      setMessage("Nama murid tidak dapat ditambah.");
    }
  }

  async function removeStudentFromRoster(name: string) {
    if (!rosterClassCode || !confirm(`Buang ${name} daripada senarai login kelas?`)) return;
    try {
      const names = await removeRosterStudent(rosterClassCode, name);
      updateRosterState(rosterClassCode, names);
      setMessage(`${name} dibuang daripada senarai login kelas.`);
    } catch (error) {
      console.error(error);
      setMessage("Nama murid tidak dapat dibuang.");
    }
  }

  async function importStudents(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !rosterClassCode) return;
    setImporting(true);
    setMessage("Membaca fail senarai murid...");
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
      const firstNonEmpty = rows.findIndex((row)=>row.some((cell)=>String(cell).trim()));
      if (firstNonEmpty < 0) throw new Error("Fail kosong");
      const header = rows[firstNonEmpty].map((cell)=>String(cell).trim().toLowerCase());
      let nameColumn = header.findIndex((cell)=>["nama","nama murid","nama pelajar","name","student","student name"].includes(cell));
      let start = firstNonEmpty;
      if (nameColumn >= 0) start = firstNonEmpty + 1;
      else nameColumn = 0;

      const imported = rows.slice(start)
        .map((row)=>normalizeStudentName(String(row[nameColumn] || "")))
        .filter((name)=>name.length >= 2);

      if (!imported.length) throw new Error("Tiada nama ditemui");
      const current = managedClasses.find((item)=>item.code===rosterClassCode)?.studentNames || [];
      const merged = [...new Set([...current, ...imported])].sort((a,b)=>a.localeCompare(b,"ms"));
      const saved = await saveClassRoster(rosterClassCode, merged);
      updateRosterState(rosterClassCode, saved);
      setMessage(`Import selesai: ${imported.length} nama dibaca, ${saved.length} nama unik dalam kelas.`);
    } catch (error) {
      console.error(error);
      setMessage("Import gagal. Gunakan fail Excel/CSV yang mempunyai nama murid pada kolum pertama atau tajuk 'Nama'.");
    } finally {
      setImporting(false);
    }
  }

  async function copyStudentLink(code: string) {
    const link = `${window.location.origin}/murid?class=${encodeURIComponent(code)}`;
    await navigator.clipboard.writeText(link);
    setMessage(`Link murid untuk kelas ${code} telah disalin.`);
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
      const cur=counts.get(r.questionId)||{wrong:0,total:0};
      cur.total++;
      if(!r.correct) cur.wrong++;
      counts.set(r.questionId,cur);
    }));
    return [...counts.entries()]
      .map(([id,v])=>({id,...v,rate:v.total?Math.round(v.wrong/v.total*100):0}))
      .filter(x=>x.total>=1)
      .sort((a,b)=>b.rate-a.rate || b.wrong-a.wrong)
      .slice(0,6);
  }, [filtered]);

  const rosterClass = managedClasses.find((item)=>item.code===rosterClassCode) || null;
  const selfRegistered = registeredStudents.filter((student)=>student.classCode===rosterClassCode);
  const selfAddedNotRoster = selfRegistered.filter((student)=>
    !rosterClass?.studentNames.some((name)=>normalizeStudentName(name)===normalizeStudentName(student.name))
  );

  return (
    <main className="teacher-shell">
      <header className="teacher-nav"><a className="brand" href="/"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>CONTROL CENTER</small></span></a><a className="back" href="/">← Murid</a></header>
      <section className="teacher-head">
        <span className="eyebrow dark">PANEL GURU · v1.2</span>
        <h1>GeoBoost Control Center</h1>
        <p>Urus kelas dan senarai murid, import Excel/CSV, pantau pencapaian dan kenal pasti subtopik yang memerlukan intervensi.</p>
        <div className="teacher-connect">
          <span className={`source-pill ${source}`}>{source === "firebase" ? "☁️ Firebase" : "📱 Peranti"}</span>
          {firebaseConfigured ? (source === "firebase"
            ? <><b>{teacherEmail}</b><button onClick={disconnectTeacher}>Log keluar</button></>
            : <button className="teacher-login" onClick={connectTeacher}>Masuk Google Guru</button>
          ) : <span>Firebase env belum diisi</span>}
        </div>
        {message ? <div className="teacher-message">{message}</div> : null}
        {teacherUid && source !== "firebase" ? <div className="teacher-bootstrap"><div><small>UID UNTUK AKTIFKAN ADMIN</small><code>{teacherUid}</code><span>{teacherEmail || "Akaun Google guru"}</span></div><button onClick={async()=>{await navigator.clipboard.writeText(teacherUid);setMessage("UID guru telah disalin.");}}>Salin UID</button></div> : null}
      </section>

      <section className="teacher-content">
        <div className="filter-bar">
          <label>Kelas<select value={classFilter} onChange={e=>setClassFilter(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></label>
          <label>Bab<select value={chapterFilter} onChange={e=>setChapterFilter(Number(e.target.value))}><option value={0}>Semua Bab</option>{chapters.map(c=><option key={c.id} value={c.id}>Bab {c.id}</option>)}</select></label>
          <button onClick={()=>downloadCsv(filtered)} disabled={!filtered.length}>Eksport CSV</button>
        </div>

        <div className="teacher-stats"><div><small>Murid</small><b>{stats.students}</b></div><div><small>Latihan selesai</small><b>{stats.completed}</b></div><div><small>Purata</small><b>{stats.avg}%</b></div><div><small>Kadar ≥60%</small><b>{stats.passRate}%</b></div><div><small>Bank aktif</small><b>{questions.length}</b></div></div>

        {source === "firebase" ? <>
          <section className="panel class-manager">
            <div className="panel-title"><div><small>PENGURUSAN KELAS</small><h2>Kelas & kod akses</h2></div><span>{managedClasses.length}</span></div>
            <p className="class-help">Murid hanya perlukan kod kelas. PIN tidak digunakan.</p>
            <div className="class-create">
              <input value={newClassName} onChange={e=>setNewClassName(e.target.value)} placeholder="Nama kelas · contoh 2E"/>
              <input value={newClassCode} onChange={e=>setNewClassCode(e.target.value)} placeholder="Kod · contoh 2E26"/>
              <button onClick={addClass} disabled={!newClassName.trim() || !newClassCode.trim()}>Tambah kelas</button>
            </div>
            {managedClasses.length ? <div className="class-list">{managedClasses.map(item=><div key={item.code}><div><strong>{item.name}</strong><small>{item.code} · {item.studentNames.length} nama</small></div><span>{item.active ? "Aktif" : "Tidak aktif"}</span><div className="class-actions"><button onClick={()=>copyStudentLink(item.code)}>Salin link</button><button className="danger" onClick={()=>deleteClass(item.code)}>Padam</button></div></div>)}</div> : <div className="panel-empty">Belum ada kelas dalam Firestore.</div>}
          </section>

          <section className="panel roster-manager">
            <div className="panel-title"><div><small>PENGURUSAN MURID</small><h2>Senarai nama kelas</h2></div><span>{rosterClass?.studentNames.length || 0}</span></div>
            {!managedClasses.length ? <div className="panel-empty">Cipta kelas dahulu sebelum memasukkan senarai murid.</div> : <>
              <div className="roster-toolbar">
                <label>Kelas<select value={rosterClassCode} onChange={e=>setRosterClassCode(e.target.value)}>{managedClasses.map(item=><option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}</select></label>
                <div className="roster-add"><input value={manualStudentName} onChange={e=>setManualStudentName(e.target.value)} placeholder="Nama penuh murid"/><button onClick={()=>addStudentToRoster()} disabled={!manualStudentName.trim()}>Tambah manual</button></div>
                <label className="import-button">{importing ? "Mengimport..." : "Import Excel / CSV"}<input type="file" accept=".xlsx,.xls,.csv,.txt" disabled={importing} onChange={importStudents}/></label>
              </div>

              {selfAddedNotRoster.length ? <div className="self-added-box"><strong>Nama ditambah sendiri oleh murid</strong><p>Nama ini sudah masuk ke list guru tetapi belum berada dalam dropdown rasmi kelas.</p>{selfAddedNotRoster.map(student=><div key={student.uid}><span>{student.name}</span><button onClick={()=>addStudentToRoster(student.name)}>Masuk Senarai</button></div>)}</div> : null}

              {rosterClass?.studentNames.length ? <div className="roster-list">{rosterClass.studentNames.map((name,index)=><div key={name}><span>{index+1}</span><strong>{name}</strong><small>{selfRegistered.some(s=>normalizeStudentName(s.name)===normalizeStudentName(name)) ? "Pernah masuk GeoBoost" : "Belum masuk"}</small><button onClick={()=>removeStudentFromRoster(name)}>Buang</button></div>)}</div> : <div className="panel-empty">Belum ada nama. Tambah manual atau import fail Excel/CSV.</div>}
            </>}
          </section>
        </> : null}

        <div className="teacher-grid">
          <section className="panel"><div className="panel-title"><div><small>TERKINI</small><h2>Percubaan murid</h2></div><span>{filtered.length}</span></div>{filtered.length ? <div className="attempt-table">{filtered.slice(0,15).map(a=><div className="attempt-row" key={a.id}><div><strong>{a.studentName}</strong><small>{a.className} · {a.chapter ? `Bab ${a.chapter}` : (a.label || a.mode || "Campuran")}</small></div><b>{a.percentage}%</b><span>{new Date(a.completedAt).toLocaleDateString("ms-MY")}</span></div>)}</div> : <div className="panel-empty">Belum ada rekod untuk penapis ini.</div>}</section>
          <section className="panel"><div className="panel-title"><div><small>PEMULIHAN</small><h2>Subtopik perlu perhatian</h2></div></div>{weak.length ? weak.map(([topic,count],i)=><div className="weak-row" key={topic}><span>#{i+1} · {topic}</span><div><i style={{width:`${Math.min(100,count*14)}%`}} /></div><b>{count}</b></div>) : <div className="panel-empty">Analisis akan muncul selepas terdapat jawapan salah.</div>}</section>
        </div>

        <section className="panel"><div className="panel-title"><div><small>ANALISIS ITEM</small><h2>Soalan paling kerap salah</h2></div></div>{missedItems.length ? <div className="item-analysis">{missedItems.map(x=>{const q=questions.find(q=>q.id===x.id);return <div key={x.id}><span>{x.id}</span><div><strong>{q?.prompt || "Soalan"}</strong><small>{x.wrong}/{x.total} salah</small></div><b>{x.rate}%</b></div>})}</div> : <div className="panel-empty">Analisis akan terbina selepas murid menjawab latihan.</div>}</section>

        <section className="panel chapter-status"><div className="panel-title"><div><small>KANDUNGAN</small><h2>Status bank Bab 1–10</h2></div></div><div className="teacher-chapters">{chapters.map(c=><div key={c.id}><span>{c.icon}</span><div><small>BAB {c.id}</small><strong>{c.title}</strong></div><b>{questions.filter(q=>q.chapter===c.id).length} soalan</b></div>)}</div></section>
      </section>
    </main>
  );
}
