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
  deleteAssignment,
  listClasses,
  normalizeStudentName,
  removeClass,
  removeRosterStudent,
  saveAssignment,
  saveClass,
  saveClassRoster,
  setOpenChapters,
} from "@/lib/classroom";

type Source = "local" | "firebase";
type TeacherSection = "dashboard" | "classes" | "students" | "assignments" | "analytics" | "reports" | "bank" | "settings";

const NAV: { id: TeacherSection; icon: string; label: string }[] = [
  { id: "dashboard", icon: "▦", label: "Ringkasan" },
  { id: "classes", icon: "🏫", label: "Kelas" },
  { id: "students", icon: "👥", label: "Murid" },
  { id: "assignments", icon: "📝", label: "Tugasan" },
  { id: "analytics", icon: "📊", label: "Analitik" },
  { id: "reports", icon: "🖨️", label: "Laporan" },
  { id: "bank", icon: "🗂️", label: "Bank Soalan" },
  { id: "settings", icon: "⚙️", label: "Tetapan" },
];

function downloadCsv(attempts: AttemptRecord[]) {
  const esc = (v: unknown) => '"' + String(v ?? "").replaceAll('"','""') + '"';
  const rows = [["Nama","Kelas","Bab/Mod","Markah","Jumlah","Peratus","Tempoh(s)","Subtopik lemah","Tarikh"], ...attempts.map(a=>[
    a.studentName, a.className, a.chapter ? "Bab " + a.chapter : (a.label || a.mode || "Campuran"),
    a.score, a.total, a.percentage, a.durationSeconds, a.wrongSubtopics.join(" | "),
    new Date(a.completedAt).toLocaleString("ms-MY")
  ])];
  const csv = rows.map(r=>r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff"+csv], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url;
  a.download="geoboost-laporan-"+new Date().toISOString().slice(0,10)+".csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function TeacherPage() {
  const [activeSection, setActiveSection] = useState<TeacherSection>("dashboard");
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
  const [selectedStudentKey, setSelectedStudentKey] = useState("");
  const [assignmentClassCode, setAssignmentClassCode] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentChapter, setAssignmentChapter] = useState(1);
  const [assignmentCount, setAssignmentCount] = useState(20);
  const [assignmentDue, setAssignmentDue] = useState("");
  const [bankChapter, setBankChapter] = useState(1);

  function patchClass(code: string, patch: Partial<ClassRecord>) {
    setManagedClasses(current => current.map(item => item.code === code ? { ...item, ...patch } : item));
  }

  async function loadTeacherData(user: { email: string | null; uid: string }) {
    setTeacherEmail(user.email || "Guru");
    setTeacherUid(user.uid);
    const [remote, remoteClasses, remoteStudents] = await Promise.all([
      getRemoteAttempts(), listClasses(), getRemoteStudents(),
    ]);
    setManagedClasses(remoteClasses);
    setRegisteredStudents(remoteStudents);
    setAttempts(remote);
    setSource("firebase");
    setRosterClassCode(current => current || remoteClasses[0]?.code || "");
    setAssignmentClassCode(current => current || remoteClasses[0]?.code || "");
    setMessage("Berjaya memuat "+remote.length+" rekod pusat dan "+remoteStudents.length+" profil murid.");
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
          const detail = error?.code ? " ("+error.code+")" : "";
          setMessage("Akaun Google dikesan tetapi akses pusat belum tersedia."+detail);
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
      const detail = error?.code ? " ("+error.code+")" : "";
      setMessage("Akaun ini belum diberi akses guru dalam koleksi teachers, atau Firestore belum disediakan."+detail);
    }
  }

  async function disconnectTeacher() {
    await signOutFirebaseUser();
    setTeacherEmail(""); setTeacherUid(""); setSource("local");
    setAttempts(getLocalAttempts().filter(a=>a.studentId!=="demo"));
    setManagedClasses([]); setRegisteredStudents([]);
    setRosterClassCode(""); setAssignmentClassCode("");
    setMessage("Kembali ke data pada peranti ini.");
  }

  async function addClass() {
    if (!newClassName.trim() || !newClassCode.trim()) return;
    try {
      const saved = await saveClass({ name: newClassName, code: newClassCode });
      setManagedClasses(current => [...current.filter(item => item.code !== saved.code), saved].sort((a,b)=>a.name.localeCompare(b.name)));
      setRosterClassCode(current=>current || saved.code);
      setAssignmentClassCode(current=>current || saved.code);
      setNewClassName(""); setNewClassCode("");
      setMessage("Kelas "+saved.name+" ("+saved.code+") disimpan.");
    } catch (error) {
      console.error(error);
      setMessage("Kelas tidak dapat disimpan.");
    }
  }

  async function deleteClass(code: string) {
    if (!confirm("Padam kelas "+code+"?")) return;
    try {
      await removeClass(code);
      setManagedClasses(current=>current.filter(item=>item.code!==code));
      setRosterClassCode(current=>current===code ? "" : current);
      setAssignmentClassCode(current=>current===code ? "" : current);
      setMessage("Kelas "+code+" dipadam.");
    } catch (error) {
      console.error(error);
      setMessage("Kelas tidak dapat dipadam.");
    }
  }

  async function toggleChapter(code: string, chapter: number) {
    const item = managedClasses.find(c=>c.code===code);
    if (!item) return;
    const next = item.openChapters.includes(chapter)
      ? item.openChapters.filter(id=>id!==chapter)
      : [...item.openChapters, chapter].sort((a,b)=>a-b);
    try {
      const saved = await setOpenChapters(code, next);
      patchClass(code, { openChapters: saved });
      setMessage("Akses bab kelas "+item.name+" dikemas kini.");
    } catch (error) {
      console.error(error);
      setMessage("Akses bab tidak dapat dikemas kini.");
    }
  }

  function updateRosterState(code: string, studentNames: string[]) {
    patchClass(code, { studentNames });
  }

  async function addStudentToRoster(name = manualStudentName) {
    if (!rosterClassCode || !name.trim()) return;
    try {
      const names = await addRosterStudent(rosterClassCode, name);
      updateRosterState(rosterClassCode, names);
      setManualStudentName("");
      setMessage(normalizeStudentName(name)+" ditambah ke senarai kelas.");
    } catch (error) {
      console.error(error);
      setMessage("Nama murid tidak dapat ditambah.");
    }
  }

  async function removeStudentFromRoster(name: string) {
    if (!rosterClassCode || !confirm("Buang "+name+" daripada senarai login kelas?")) return;
    try {
      const names = await removeRosterStudent(rosterClassCode, name);
      updateRosterState(rosterClassCode, names);
      setMessage(name+" dibuang daripada senarai login kelas.");
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
      const firstNonEmpty = rows.findIndex(row=>row.some(cell=>String(cell).trim()));
      if (firstNonEmpty < 0) throw new Error("Fail kosong");
      const header = rows[firstNonEmpty].map(cell=>String(cell).trim().toLowerCase());
      let nameColumn = header.findIndex(cell=>["nama","nama murid","nama pelajar","name","student","student name"].includes(cell));
      let start = firstNonEmpty;
      if (nameColumn >= 0) start = firstNonEmpty + 1; else nameColumn = 0;
      const imported = rows.slice(start).map(row=>normalizeStudentName(String(row[nameColumn] || ""))).filter(name=>name.length >= 2);
      if (!imported.length) throw new Error("Tiada nama ditemui");
      const current = managedClasses.find(item=>item.code===rosterClassCode)?.studentNames || [];
      const merged = [...new Set([...current, ...imported])].sort((a,b)=>a.localeCompare(b,"ms"));
      const saved = await saveClassRoster(rosterClassCode, merged);
      updateRosterState(rosterClassCode, saved);
      setMessage("Import selesai: "+imported.length+" nama dibaca, "+saved.length+" nama unik.");
    } catch (error) {
      console.error(error);
      setMessage("Import gagal. Gunakan Excel/CSV dengan nama pada kolum pertama atau tajuk 'Nama'.");
    } finally {
      setImporting(false);
    }
  }

  async function copyStudentLink(code: string) {
    const link = window.location.origin+"/murid?class="+encodeURIComponent(code);
    await navigator.clipboard.writeText(link);
    setMessage("Link murid untuk kelas "+code+" telah disalin.");
  }

  async function createAssignment() {
    if (!assignmentClassCode || !assignmentTitle.trim()) return;
    try {
      const next = await saveAssignment(assignmentClassCode, {
        title: assignmentTitle,
        chapter: assignmentChapter,
        questionCount: assignmentCount,
        dueDate: assignmentDue,
        active: true,
      });
      patchClass(assignmentClassCode, { assignments: next });
      setAssignmentTitle(""); setAssignmentDue("");
      setMessage("Tugasan baharu berjaya diterbitkan.");
    } catch (error) {
      console.error(error);
      setMessage("Tugasan tidak dapat disimpan.");
    }
  }

  async function removeAssignmentItem(classCode: string, id: string) {
    if (!confirm("Padam tugasan ini?")) return;
    try {
      const next = await deleteAssignment(classCode, id);
      patchClass(classCode, { assignments: next });
      setMessage("Tugasan dipadam.");
    } catch (error) {
      console.error(error);
      setMessage("Tugasan tidak dapat dipadam.");
    }
  }

  async function toggleAssignmentActive(classCode: string, id: string) {
    const item = managedClasses.find(c=>c.code===classCode)?.assignments.find(a=>a.id===id);
    if (!item) return;
    try {
      const next = await saveAssignment(classCode, { ...item, active: !item.active });
      patchClass(classCode, { assignments: next });
      setMessage(item.active ? "Tugasan ditutup." : "Tugasan diaktifkan.");
    } catch (error) {
      console.error(error);
      setMessage("Status tugasan tidak dapat dikemas kini.");
    }
  }

  const classes = useMemo(() => ["SEMUA", ...Array.from(new Set([...attempts.map(a=>a.className), ...managedClasses.map(c=>c.name)].filter(Boolean))).sort()], [attempts, managedClasses]);
  const filtered = useMemo(() => attempts.filter(a => (classFilter === "SEMUA" || a.className === classFilter) && (!chapterFilter || a.chapter === chapterFilter)), [attempts,classFilter,chapterFilter]);
  const stats = useMemo(() => {
    const avg = filtered.length ? Math.round(filtered.reduce((s,a)=>s+a.percentage,0)/filtered.length) : 0;
    const students = new Set(filtered.map(a=>a.studentId || a.studentName+"|"+a.className)).size;
    const passed = filtered.filter(a=>a.percentage>=60).length;
    return { avg, students, completed: filtered.length, passRate: filtered.length ? Math.round(passed/filtered.length*100) : 0 };
  }, [filtered]);

  const weak = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach(a=>a.wrongSubtopics.forEach(s=>counts.set(s,(counts.get(s)||0)+1)));
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
  }, [filtered]);

  const missedItems = useMemo(() => {
    const counts = new Map<string, {wrong:number,total:number}>();
    filtered.forEach(a=>a.responses?.forEach(r=>{
      const cur=counts.get(r.questionId)||{wrong:0,total:0};
      cur.total++; if(!r.correct) cur.wrong++; counts.set(r.questionId,cur);
    }));
    return [...counts.entries()].map(([id,v])=>({id,...v,rate:v.total?Math.round(v.wrong/v.total*100):0}))
      .filter(x=>x.total>=1).sort((a,b)=>b.rate-a.rate || b.wrong-a.wrong).slice(0,10);
  }, [filtered]);

  const rosterClass = managedClasses.find(item=>item.code===rosterClassCode) || null;
  const selfRegistered = registeredStudents.filter(student=>student.classCode===rosterClassCode);
  const selfAddedNotRoster = selfRegistered.filter(student=>!rosterClass?.studentNames.some(name=>normalizeStudentName(name)===normalizeStudentName(student.name)));
  const assignmentClass = managedClasses.find(item=>item.code===assignmentClassCode) || null;

  const studentDirectory = useMemo(() => {
    const map = new Map<string, RegisteredStudent>();
    registeredStudents.forEach(student => {
      const key = student.localStudentId || student.name+"|"+student.classCode;
      if (!map.has(key)) map.set(key, student);
    });
    return [...map.entries()].sort((a,b)=>a[1].name.localeCompare(b[1].name,"ms"));
  }, [registeredStudents]);
  const selectedStudent = studentDirectory.find(([key])=>key===selectedStudentKey)?.[1] || null;
  const selectedStudentAttempts = selectedStudent ? attempts.filter(a =>
    (selectedStudent.localStudentId && a.studentId===selectedStudent.localStudentId) ||
    (a.studentName===selectedStudent.name && a.className===selectedStudent.className)
  ) : [];

  const bankItems = questions.filter(q=>q.chapter===bankChapter);
  const bankStats = {
    easy: bankItems.filter(q=>q.difficulty==="easy").length,
    medium: bankItems.filter(q=>q.difficulty==="medium").length,
    kbat: bankItems.filter(q=>q.difficulty==="kbat").length,
  };

  const filterBar = <div className="filter-bar">
    <label>Kelas<select value={classFilter} onChange={e=>setClassFilter(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Bab<select value={chapterFilter} onChange={e=>setChapterFilter(Number(e.target.value))}><option value={0}>Semua Bab</option>{chapters.map(c=><option key={c.id} value={c.id}>Bab {c.id}</option>)}</select></label>
  </div>;

  return (
    <main className="teacher-app">
      <aside className="teacher-sidebar">
        <a className="teacher-side-brand" href="/"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>CONTROL CENTER</small></span></a>
        <nav>{NAV.map(item=><button key={item.id} className={activeSection===item.id ? "active" : ""} onClick={()=>setActiveSection(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="teacher-side-account">
          <span className={"source-pill "+source}>{source === "firebase" ? "☁️ Firebase" : "📱 Peranti"}</span>
          <small>{teacherEmail || "Belum login guru"}</small>
          {firebaseConfigured ? (source==="firebase" ? <button onClick={disconnectTeacher}>Log keluar</button> : <button onClick={connectTeacher}>Masuk Google Guru</button>) : null}
          <a href="/">← Paparan murid</a>
        </div>
      </aside>

      <div className="teacher-main">
        <header className="teacher-mobile-nav">
          <a className="brand" href="/"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>GURU</small></span></a>
          <select value={activeSection} onChange={e=>setActiveSection(e.target.value as TeacherSection)}>
            {NAV.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </header>

        <section className="teacher-head">
          <span className="eyebrow dark">PANEL GURU · v1.3</span>
          <h1>{NAV.find(item=>item.id===activeSection)?.label}</h1>
          <p>GeoBoost Control Center — pengurusan kelas, murid, tugasan, analitik dan laporan dalam satu panel.</p>
          {message ? <div className="teacher-message">{message}</div> : null}
          {teacherUid && source !== "firebase" ? <div className="teacher-bootstrap"><div><small>UID UNTUK AKTIFKAN ADMIN</small><code>{teacherUid}</code><span>{teacherEmail || "Akaun Google guru"}</span></div><button onClick={async()=>{await navigator.clipboard.writeText(teacherUid);setMessage("UID guru telah disalin.");}}>Salin UID</button></div> : null}
        </section>

        <section className="teacher-content">
          {activeSection==="dashboard" ? <>
            <div className="teacher-stats"><div><small>Murid</small><b>{stats.students}</b></div><div><small>Latihan selesai</small><b>{stats.completed}</b></div><div><small>Purata</small><b>{stats.avg}%</b></div><div><small>Kadar ≥60%</small><b>{stats.passRate}%</b></div><div><small>Bank aktif</small><b>{questions.length}</b></div></div>
            <div className="teacher-grid">
              <section className="panel"><div className="panel-title"><div><small>TERKINI</small><h2>Percubaan murid</h2></div><span>{attempts.length}</span></div>{attempts.length ? <div className="attempt-table">{attempts.slice(0,12).map(a=><div className="attempt-row" key={a.id}><div><strong>{a.studentName}</strong><small>{a.className} · {a.chapter ? "Bab "+a.chapter : (a.label || a.mode || "Campuran")}</small></div><b>{a.percentage}%</b><span>{new Date(a.completedAt).toLocaleDateString("ms-MY")}</span></div>)}</div> : <div className="panel-empty">Belum ada rekod murid.</div>}</section>
              <section className="panel"><div className="panel-title"><div><small>PEMULIHAN</small><h2>Subtopik perlu perhatian</h2></div></div>{weak.length ? weak.slice(0,6).map(([topic,count],i)=><div className="weak-row" key={topic}><span>#{i+1}</span><div><i style={{width:Math.min(100,count*14)+"%"}} /></div><b>{count}</b><small>{topic}</small></div>) : <div className="panel-empty">Analisis akan muncul selepas terdapat jawapan salah.</div>}</section>
            </div>
          </> : null}

          {activeSection==="classes" ? <section className="panel class-manager">
            <div className="panel-title"><div><small>PENGURUSAN KELAS</small><h2>Kelas, kod akses & bab dibuka</h2></div><span>{managedClasses.length}</span></div>
            <p className="class-help">Murid hanya perlukan kod kelas. Guru boleh buka atau tutup bab untuk setiap kelas.</p>
            <div className="class-create"><input value={newClassName} onChange={e=>setNewClassName(e.target.value)} placeholder="Nama kelas · contoh 2E"/><input value={newClassCode} onChange={e=>setNewClassCode(e.target.value)} placeholder="Kod · contoh 2E26"/><button onClick={addClass} disabled={!newClassName.trim() || !newClassCode.trim()}>Tambah kelas</button></div>
            {managedClasses.length ? <div className="class-cards">{managedClasses.map(item=><article key={item.code} className="class-admin-card"><div className="class-admin-head"><div><strong>{item.name}</strong><small>{item.code} · {item.studentNames.length} murid · {item.openChapters.length}/10 bab dibuka</small></div><div className="class-actions"><button onClick={()=>copyStudentLink(item.code)}>Salin link</button><button className="danger" onClick={()=>deleteClass(item.code)}>Padam</button></div></div><div className="chapter-access-grid">{chapters.map(ch=><button key={ch.id} className={item.openChapters.includes(ch.id) ? "open" : "closed"} onClick={()=>toggleChapter(item.code,ch.id)}><span>Bab {ch.id}</span><b>{item.openChapters.includes(ch.id) ? "Dibuka" : "Ditutup"}</b></button>)}</div></article>)}</div> : <div className="panel-empty">Belum ada kelas. Cipta kelas pertama untuk bermula.</div>}
          </section> : null}

          {activeSection==="students" ? <section className="panel roster-manager">
            <div className="panel-title"><div><small>PENGURUSAN MURID</small><h2>Senarai murid</h2></div><span>{studentDirectory.length}</span></div>
            {!managedClasses.length ? <div className="panel-empty">Cipta kelas dahulu.</div> : <>
              <div className="roster-toolbar">
                <label>Kelas<select value={rosterClassCode} onChange={e=>setRosterClassCode(e.target.value)}>{managedClasses.map(item=><option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}</select></label>
                <div className="roster-add"><input value={manualStudentName} onChange={e=>setManualStudentName(e.target.value)} placeholder="Nama penuh murid"/><button onClick={()=>addStudentToRoster()} disabled={!manualStudentName.trim()}>Tambah manual</button></div>
                <label className="import-button">{importing ? "Mengimport..." : "Import Excel / CSV"}<input type="file" accept=".xlsx,.xls,.csv,.txt" disabled={importing} onChange={importStudents}/></label>
              </div>
              {selfAddedNotRoster.length ? <div className="self-added-box"><strong>Nama ditambah sendiri oleh murid</strong><p>Semak dan masukkan ke dropdown rasmi kelas.</p>{selfAddedNotRoster.map(student=><div key={student.uid}><span>{student.name}</span><button onClick={()=>addStudentToRoster(student.name)}>Masuk Senarai</button></div>)}</div> : null}
              <div className="student-admin-layout">
                <div>{rosterClass?.studentNames.length ? <div className="roster-list">{rosterClass.studentNames.map((name,index)=>{const profile=selfRegistered.find(s=>normalizeStudentName(s.name)===normalizeStudentName(name));const key=profile?.localStudentId || name+"|"+rosterClassCode;return <div key={name} className={selectedStudentKey===key ? "selected" : ""}><span>{index+1}</span><strong onClick={()=>profile && setSelectedStudentKey(key)}>{name}</strong><small>{profile ? "Pernah masuk GeoBoost" : "Belum masuk"}</small><button onClick={()=>removeStudentFromRoster(name)}>Buang</button></div>})}</div> : <div className="panel-empty">Belum ada nama. Tambah manual atau import Excel/CSV.</div>}</div>
                <div className="student-profile-card">{selectedStudent ? <><small>PROFIL MURID</small><h3>{selectedStudent.name}</h3><p>{selectedStudent.className} · {selectedStudentAttempts.length} percubaan</p><div className="profile-metrics"><div><span>Purata</span><b>{selectedStudentAttempts.length ? Math.round(selectedStudentAttempts.reduce((s,a)=>s+a.percentage,0)/selectedStudentAttempts.length) : 0}%</b></div><div><span>Terbaik</span><b>{selectedStudentAttempts.length ? Math.max(...selectedStudentAttempts.map(a=>a.percentage)) : 0}%</b></div></div>{selectedStudentAttempts.slice(0,6).map(a=><div className="profile-attempt" key={a.id}><span>{a.chapter ? "Bab "+a.chapter : a.mode}</span><b>{a.percentage}%</b></div>)}</> : <><small>PROFIL MURID</small><h3>Pilih murid</h3><p>Klik nama murid yang pernah masuk GeoBoost untuk melihat statistik individu.</p></>}</div>
              </div>
            </>}
          </section> : null}

          {activeSection==="assignments" ? <section className="panel assignment-manager">
            <div className="panel-title"><div><small>TUGASAN KELAS</small><h2>Cipta & pantau tugasan</h2></div><span>{managedClasses.reduce((s,c)=>s+c.assignments.length,0)}</span></div>
            {!managedClasses.length ? <div className="panel-empty">Cipta kelas dahulu.</div> : <>
              <div className="assignment-create">
                <label>Kelas<select value={assignmentClassCode} onChange={e=>setAssignmentClassCode(e.target.value)}>{managedClasses.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
                <label>Tajuk<input value={assignmentTitle} onChange={e=>setAssignmentTitle(e.target.value)} placeholder="Contoh: Pengukuhan Bab 7"/></label>
                <label>Bab<select value={assignmentChapter} onChange={e=>setAssignmentChapter(Number(e.target.value))}>{chapters.map(ch=><option key={ch.id} value={ch.id}>Bab {ch.id}</option>)}</select></label>
                <label>Soalan<select value={assignmentCount} onChange={e=>setAssignmentCount(Number(e.target.value))}>{[5,10,15,20].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
                <label>Tarikh akhir<input type="date" value={assignmentDue} onChange={e=>setAssignmentDue(e.target.value)}/></label>
                <button onClick={createAssignment} disabled={!assignmentTitle.trim()}>Terbitkan tugasan</button>
              </div>
              <div className="assignment-list">{assignmentClass?.assignments.length ? assignmentClass.assignments.map(item=><div key={item.id}><div><strong>{item.title}</strong><small>Bab {item.chapter} · {item.questionCount} soalan{item.dueDate ? " · Akhir "+new Date(item.dueDate+"T00:00:00").toLocaleDateString("ms-MY") : ""}</small></div><span className={item.active ? "active" : "inactive"}>{item.active ? "Aktif" : "Ditutup"}</span><button onClick={()=>toggleAssignmentActive(assignmentClass.code,item.id)}>{item.active ? "Tutup" : "Buka"}</button><button className="danger" onClick={()=>removeAssignmentItem(assignmentClass.code,item.id)}>Padam</button></div>) : <div className="panel-empty">Belum ada tugasan untuk kelas ini.</div>}</div>
            </>}
          </section> : null}

          {activeSection==="analytics" ? <>
            {filterBar}
            <div className="teacher-grid"><section className="panel"><div className="panel-title"><div><small>PEMULIHAN</small><h2>Subtopik perlu perhatian</h2></div></div>{weak.length ? weak.map(([topic,count],i)=><div className="weak-row detailed" key={topic}><span>#{i+1}</span><div><i style={{width:Math.min(100,count*12)+"%"}} /></div><b>{count}</b><small>{topic}</small></div>) : <div className="panel-empty">Belum ada data.</div>}</section><section className="panel"><div className="panel-title"><div><small>RINGKASAN</small><h2>Prestasi penapis</h2></div></div><div className="analytics-summary"><div><span>Purata</span><b>{stats.avg}%</b></div><div><span>Percubaan</span><b>{stats.completed}</b></div><div><span>Kadar ≥60%</span><b>{stats.passRate}%</b></div></div></section></div>
            <section className="panel"><div className="panel-title"><div><small>ANALISIS ITEM</small><h2>Soalan paling kerap salah</h2></div></div>{missedItems.length ? <div className="item-analysis">{missedItems.map(x=>{const q=questions.find(q=>q.id===x.id);return <div key={x.id}><span>{x.id}</span><div><strong>{q?.prompt || "Soalan"}</strong><small>{x.wrong}/{x.total} salah</small></div><b>{x.rate}%</b></div>})}</div> : <div className="panel-empty">Analisis akan terbina selepas murid menjawab latihan.</div>}</section>
          </> : null}

          {activeSection==="reports" ? <section className="panel report-panel">
            <div className="panel-title"><div><small>LAPORAN</small><h2>Laporan prestasi</h2></div><div className="report-actions"><button onClick={()=>downloadCsv(filtered)} disabled={!filtered.length}>Eksport CSV</button><button onClick={()=>window.print()} disabled={!filtered.length}>Cetak / Simpan PDF</button></div></div>
            {filterBar}
            <div className="report-summary"><div><span>Murid</span><b>{stats.students}</b></div><div><span>Percubaan</span><b>{stats.completed}</b></div><div><span>Purata</span><b>{stats.avg}%</b></div><div><span>≥60%</span><b>{stats.passRate}%</b></div></div>
            {filtered.length ? <table className="report-table"><thead><tr><th>Nama</th><th>Kelas</th><th>Bab</th><th>Markah</th><th>%</th><th>Tarikh</th></tr></thead><tbody>{filtered.map(a=><tr key={a.id}><td>{a.studentName}</td><td>{a.className}</td><td>{a.chapter ? "Bab "+a.chapter : a.mode}</td><td>{a.score}/{a.total}</td><td>{a.percentage}%</td><td>{new Date(a.completedAt).toLocaleDateString("ms-MY")}</td></tr>)}</tbody></table> : <div className="panel-empty">Tiada rekod untuk laporan ini.</div>}
          </section> : null}

          {activeSection==="bank" ? <section className="panel bank-manager">
            <div className="panel-title"><div><small>BANK SOALAN</small><h2>390 soalan GeoBoost</h2></div><span>{questions.length}</span></div>
            <div className="bank-toolbar"><label>Bab<select value={bankChapter} onChange={e=>setBankChapter(Number(e.target.value))}>{chapters.map(ch=><option key={ch.id} value={ch.id}>Bab {ch.id} · {ch.title}</option>)}</select></label><div><span>Mudah <b>{bankStats.easy}</b></span><span>Sederhana <b>{bankStats.medium}</b></span><span>KBAT <b>{bankStats.kbat}</b></span></div></div>
            <div className="bank-list">{bankItems.map(q=><div key={q.id}><span>{q.id}</span><div><strong>{q.prompt}</strong><small>{q.subtopic}</small></div><b className={"difficulty "+q.difficulty}>{q.difficulty==="easy" ? "MUDAH" : q.difficulty==="medium" ? "SEDERHANA" : "KBAT"}</b></div>)}</div>
          </section> : null}

          {activeSection==="settings" ? <section className="panel settings-panel">
            <div className="panel-title"><div><small>TETAPAN SISTEM</small><h2>GeoBoost v1.3</h2></div></div>
            <div className="settings-grid"><div><span>Sumber data</span><b>{source==="firebase" ? "Firebase pusat" : "Peranti"}</b></div><div><span>Akaun guru</span><b>{teacherEmail || "Belum login"}</b></div><div><span>Jumlah kelas</span><b>{managedClasses.length}</b></div><div><span>Bank soalan</span><b>{questions.length}</b></div></div>
            <div className="settings-note"><strong>Aliran murid</strong><p>Kod kelas → pilih nama → latihan. PIN tidak digunakan. Bab yang ditutup guru tidak boleh dimulakan oleh murid kelas tersebut.</p></div>
          </section> : null}
        </section>
      </div>
    </main>
  );
}
