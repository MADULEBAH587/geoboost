"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearStudentSession, getStudentSession, saveStudentSession, StudentSession } from "@/lib/session";
import { syncPendingAttempts, syncStudentProfile } from "@/lib/repository";
import { firebaseConfigured, signOutFirebaseUser } from "@/lib/firebase";
import { ClassRecord, normalizeClassCode, normalizeStudentName, validateClassCode } from "@/lib/classroom";
import { claimStudentAccess } from "@/lib/studentAccess";

export default function StudentLoginPage() {
  const router = useRouter();
  const [existing,setExisting]=useState<StudentSession|null>(null);
  const [classCode,setClassCode]=useState("");
  const [classRecord,setClassRecord]=useState<ClassRecord|null>(null);
  const [selectedStudentId,setSelectedStudentId]=useState("");
  const [searchName,setSearchName]=useState("");
  const [accessPin,setAccessPin]=useState("");
  const [confirming,setConfirming]=useState(false);
  const [checking,setChecking]=useState(false);
  const [saving,setSaving]=useState(false);
  const [note,setNote]=useState("");

  useEffect(()=>{
    const current=getStudentSession();
    setExisting(current);
    const params=new URLSearchParams(window.location.search);
    const fromLink=normalizeClassCode(params.get("class")||"");
    if(fromLink){
      setClassCode(fromLink);
      void findClass(fromLink);
    } else if(current?.classCode) {
      setClassCode(current.classCode);
    }
  },[]);

  const roster=useMemo(()=>classRecord?.studentRoster||[],[classRecord]);
  const filteredRoster=useMemo(()=>{
    const q=normalizeStudentName(searchName);
    return q ? roster.filter(student=>student.name.includes(q)) : roster;
  },[roster,searchName]);
  const selectedStudent=roster.find(student=>student.id===selectedStudentId)||null;

  async function findClass(code=classCode){
    const clean=normalizeClassCode(code);
    if(!clean){setNote("Masukkan kod kelas dahulu.");return}
    setChecking(true);setNote("");setClassRecord(null);setSelectedStudentId("");setConfirming(false);setAccessPin("");
    try{
      const found=await validateClassCode(clean);
      if(!found){setNote("Kod kelas tidak sah, kelas telah diarkib atau belum diaktifkan oleh guru.");return}
      setClassCode(found.code);setClassRecord(found);
      setNote(found.studentRoster.length
        ?"Kelas "+found.name+" dijumpai. Cari nama anda dan masukkan kod akses murid."
        :"Kelas "+found.name+" dijumpai tetapi senarai murid belum dimasukkan oleh guru.");
    }catch(error){
      console.error(error);setNote("Kod kelas tidak dapat disahkan. Semak Internet dan cuba semula.");
    }finally{setChecking(false)}
  }

  function chooseForConfirmation(e:FormEvent){
    e.preventDefault();
    if(!selectedStudent){setNote("Pilih nama anda daripada senarai kelas.");return}
    if(!/^\d{6}$/.test(accessPin.trim())){setNote("Masukkan kod akses 6 digit yang diberikan oleh guru.");return}
    setConfirming(true);setNote("");
  }

  async function confirmLogin(){
    if(!classRecord||!selectedStudent)return;
    setSaving(true);setNote("");
    try{
      await claimStudentAccess({
        classCode:classRecord.code,
        studentId:selectedStudent.id,
        pin:accessPin,
      });

      const prior=getStudentSession();
      const session:StudentSession={
        id:selectedStudent.id,
        name:selectedStudent.name,
        className:classRecord.name,
        classCode:classRecord.code,
        createdAt:prior?.id===selectedStudent.id?prior.createdAt:Date.now(),
        verifiedAt:Date.now(),
        pendingRoster:false,
      };
      saveStudentSession(session);

      if(firebaseConfigured){
        const result=await syncStudentProfile({
          localStudentId:selectedStudent.id,
          name:selectedStudent.name,
          className:classRecord.name,
          classCode:classRecord.code,
        });
        if(result.synced)await syncPendingAttempts();
        if(!result.synced){
          clearStudentSession();
          setNote("Pengesahan berjaya tetapi profil belum dapat diselaraskan. Cuba semula.");
          setSaving(false);
          return;
        }
      }
      router.push("/murid/utama");
    }catch(error:any){
      console.error(error);
      const code=String(error?.code||"");
      setNote(code.includes("permission-denied")
        ?"Kod akses tidak betul atau akses murid telah dinyahaktifkan. Semak kod dengan guru."
        :"Pengesahan murid gagal. Semak Internet dan cuba semula.");
      setConfirming(false);
      setSaving(false);
    }
  }

  async function logout(){
    clearStudentSession();
    try{await signOutFirebaseUser()}catch{}
    setExisting(null);setClassRecord(null);setSelectedStudentId("");setSearchName("");setAccessPin("");setConfirming(false);
  }

  return <main className="auth-shell student-login-shell">
    <section className="auth-card student-login-card">
      <a href="/" className="mini-brand"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>TINGKATAN 2</small></span></a>
      <span className="eyebrow dark">AKSES MURID · v2.1</span>
      <h1>Masuk GeoBoost</h1>
      <p>Masukkan <b>kod kelas</b>, pilih nama anda dan sahkan menggunakan <b>kod akses 6 digit</b> daripada guru.</p>

      {existing && !classRecord ? <div className="existing-student-card"><div><small>PERANTI INI</small><b>{existing.name}</b><span>{existing.className}</span></div><button onClick={()=>router.push("/murid/utama")}>Teruskan →</button></div>:null}

      {!classRecord ? <form onSubmit={(e)=>{e.preventDefault();void findClass()}} className="student-form">
        <label>Kod kelas<input value={classCode} onChange={e=>setClassCode(e.target.value.toUpperCase())} placeholder="Contoh: 2E26" autoCapitalize="characters" required autoFocus/></label>
        <button className="primary full" type="submit" disabled={checking}>{checking?"Menyemak kelas...":"Semak Kod Kelas →"}</button>
      </form>:!confirming?<form onSubmit={chooseForConfirmation} className="student-form">
        <div className="class-confirm"><div><small>KELAS DIJUMPAI</small><strong>{classRecord.name}</strong><span>Kod: {classRecord.code}</span></div><button type="button" onClick={()=>{setClassRecord(null);setSelectedStudentId("");setSearchName("");setAccessPin("")}}>Tukar</button></div>
        {roster.length>0?<><label>Cari nama<input value={searchName} onChange={e=>setSearchName(e.target.value)} placeholder="Taip sebahagian nama..."/></label><label>Nama murid<select value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)} size={Math.min(7,Math.max(2,filteredRoster.length))} required><option value="">— Pilih nama anda —</option>{filteredRoster.map(student=><option key={student.id} value={student.id}>{student.name}{roster.filter(x=>x.name===student.name).length>1?" · "+student.id.slice(-4):""}</option>)}</select></label><label>Kod akses 6 digit<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={accessPin} onChange={e=>setAccessPin(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Contoh: 483271" required/><span>Dapatkan kod ini daripada guru. Kod adalah unik untuk nama anda.</span></label><button className="primary full" type="submit" disabled={!selectedStudent||accessPin.length!==6}>Sahkan Identiti →</button></>:<div className="auth-note">Senarai murid untuk kelas ini belum tersedia. Minta guru masukkan nama murid terlebih dahulu.</div>}
      </form>:<div className="student-confirm-name">
        <span className="confirm-icon">🔐</span><small>PASTIKAN IDENTITI BETUL</small><h2>{selectedStudent?.name}</h2><p>Kelas <b>{classRecord.name}</b> · Kod <b>{classRecord.code}</b></p><div className="confirm-warning">GeoBoost akan mengikat sesi peranti ini kepada ID murid unik. Keputusan dan tugasan akan direkodkan pada profil ini.</div>
        <div className="confirm-actions"><button onClick={()=>setConfirming(false)}>← Betulkan</button><button className="primary" onClick={confirmLogin} disabled={saving}>{saving?"Mengesahkan...":"Ya, ini saya →"}</button></div>
      </div>}

      {existing?<button className="student-logout" type="button" onClick={logout}>Keluar murid tersimpan / guna akaun lain</button>:null}
      {note?<small className="auth-note">{note}</small>:null}
      <small className="auth-note">☁️ {firebaseConfigured?"Firebase aktif · identiti murid disahkan":"Mod peranti"}</small>
    </section>
  </main>;
}
