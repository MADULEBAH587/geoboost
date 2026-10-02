"use client";

import { useEffect, useMemo, useState } from "react";
import { getStudentSession, StudentSession } from "@/lib/session";
import { getLocalAttempts, AttemptRecord } from "@/lib/repository";
import { ClassRecord, validateClassCode } from "@/lib/classroom";

export function StudentSummary() {
  const [student, setStudent] = useState<StudentSession | null>(null);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [classRecord, setClassRecord] = useState<ClassRecord | null>(null);

  useEffect(() => {
    const current = getStudentSession();
    setStudent(current);
    setAttempts(getLocalAttempts());
    if (current?.classCode) {
      validateClassCode(current.classCode).then(setClassRecord).catch(()=>setClassRecord(null));
    }
  }, []);

  const ownAttempts = useMemo(() => student ? attempts.filter(a => a.studentId === student.id) : [], [attempts, student]);
  const latestByChapter = useMemo(() => {
    const map = new Map<number, AttemptRecord>();
    ownAttempts.forEach(a => { if (a.chapter && !map.has(a.chapter)) map.set(a.chapter, a); });
    return map;
  }, [ownAttempts]);
  const completed = [...latestByChapter.values()].filter(a => a.percentage >= 60).length;
  const avg = latestByChapter.size ? Math.round([...latestByChapter.values()].reduce((s,a)=>s+a.percentage,0)/latestByChapter.size) : 0;
  const xp = ownAttempts.reduce((s,a)=>s+a.score*10,0);
  const weak = useMemo(() => {
    const counts = new Map<string, number>();
    ownAttempts.forEach((attempt) => attempt.wrongSubtopics.forEach((topic) => counts.set(topic, (counts.get(topic) || 0) + 1)));
    return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
  }, [ownAttempts]);
  const mastery = avg >= 80 ? "Cemerlang" : avg >= 60 ? "Menguasai" : avg > 0 ? "Perlu Pengukuhan" : "Belum dinilai";
  const today = new Date().toISOString().slice(0,10);
  const activeAssignments = (classRecord?.assignments || []).filter(item=>item.active && (!item.dueDate || item.dueDate >= today));

  if (!student) {
    return (
      <div className="hero-panel guest-panel">
        <div className="guest-icon">👋</div>
        <small className="eyebrow dark">BELUM MASUK</small>
        <h2>Mulakan sebagai murid</h2>
        <p>Masukkan kod kelas, kemudian pilih nama daripada senarai untuk merekodkan markah, XP dan latihan pemulihan.</p>
        <a className="primary full center" href="/murid">Masuk Murid →</a>
        <small className="guest-note">Firebase akan menyelaraskan rekod apabila konfigurasi projek disambungkan.</small>
      </div>
    );
  }

  return (
    <div className="hero-panel">
      <div className="student-line">
        <div className="avatar">{student.name.split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</div>
        <div><small>Selamat datang</small><strong>{student.name} · {student.className}</strong></div>
        <a className="pill" href="/murid">Tukar</a>
      </div>
      <div className="overall">
        <div><span>Penguasaan semasa · {mastery}</span><b>{avg}%</b></div>
        <div className="overall-track"><span style={{width:avg+"%"}} /></div>
      </div>
      <div className="stat-grid">
        <div><small>XP</small><b>{xp}</b><span>⭐</span></div>
        <div><small>Bab lulus</small><b>{completed}/10</b><span>✓</span></div>
        <div><small>Percubaan</small><b>{ownAttempts.length}</b><span>◎</span></div>
      </div>
      {activeAssignments.length ? <div className="student-assignments">
        <div className="student-assignments-head"><small>TUGASAN GURU</small><b>{activeAssignments.length} aktif</b></div>
        {activeAssignments.slice(0,2).map(item=><a key={item.id} href={"/tugasan?chapter="+item.chapter+"&count="+item.questionCount+"&title="+encodeURIComponent(item.title)}><div><strong>{item.title}</strong><small>Bab {item.chapter} · {item.questionCount} soalan{item.dueDate ? " · akhir "+new Date(item.dueDate+"T00:00:00").toLocaleDateString("ms-MY") : ""}</small></div><span>→</span></a>)}
      </div> : null}
      <div className="weakness">
        <span className="weak-icon">🎯</span>
        <div><small>Cadangan pengukuhan</small><strong>{weak ? "Ulang subtopik "+weak : "Lengkapkan satu latihan dahulu"}</strong></div>
        {weak ? <a className="weak-link" href="/pemulihan">Latih</a> : null}
      </div>
    </div>
  );
}
