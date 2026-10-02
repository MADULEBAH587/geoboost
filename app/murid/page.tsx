"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearStudentSession, getStudentSession, saveStudentSession, StudentSession } from "@/lib/session";
import { syncPendingAttempts, syncStudentProfile } from "@/lib/repository";
import { firebaseConfigured, signOutFirebaseUser } from "@/lib/firebase";
import { ClassRecord, normalizeClassCode, normalizeStudentName, validateClassCode } from "@/lib/classroom";
import { registerStudentPresence } from "@/lib/studentPresence";

export default function StudentLoginPage() {
  const router = useRouter();
  const [existing,setExisting]=useState<StudentSession|null>(null);
  const [classCode,setClassCode]=useState("");
  const [classRecord,setClassRecord]=useState<ClassRecord|null>(null);
  const [selectedStudentId,setSelectedStudentId]=useState("");
  const [searchName,setSearchName]=useState("");
  const [confirmStage,setConfirmStage]=useState<0|1|2>(0);
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
    }else if(current?.classCode){
      setClassCode(current.classCode);
    }
  },[]);

  const roster=useMemo(()=>classRecord?.studentRoster||[],[classRecord]);
  const filteredRoster=useMemo(()=>{
    const q=normalizeStudentName(searchName);
    return q?roster.filter(student=>student.name.includes(q)):roster;
  },[roster,searchName]);
  const selectedStudent=roster.find(student=>student.id===selectedStudentId)||null;

  async function findClass(code=classCode){
    const clean=normalizeClassCode(code);
    if(!clean){setNote("Masukkan kod kelas dahulu.");return}
    setChecking(true);setNote("");setClassRecord(null);setSelectedStudentId("");setConfirmStage(0);
    try{
      const found=await validateClassCode(clean);
      if(!found){setNote("Kod kelas tidak sah, kelas telah diarkib atau belum diaktifkan oleh guru.");return}
      setClassCode(found.code);setClassRecord(found);
      setNote(found.studentRoster.length
        ?"Kelas "+found.name+" dijumpai. Cari dan pilih nama anda."
        :"Kelas "+found.name+" dijumpai tetapi senarai murid belum dimasukkan oleh guru.");
    }catch(error){
      console.error(error);setNote("Kod kelas tidak dapat disahkan. Semak Internet dan cuba semula.");
    }finally{setChecking(false)}
  }

  function chooseForConfirmation(e:FormEvent){
    e.preventDefault();
    if(!selectedStudent){setNote("Pilih nama anda daripada senarai kelas.");return}
    setConfirmStage(1);setNote("");
  }

  async function confirmLogin(){
    if(!classRecord||!selectedStudent)return;
    setSaving(true);setNote("");
    try{
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

      // Identiti murid disahkan oleh roster kelas. Simpan sesi dahulu supaya
      // kegagalan sync awan tidak pernah menghalang murid masuk ke GeoBoost.
      saveStudentSession(session);

      if(firebaseConfigured){
        try{
          const result=await syncStudentProfile({
            localStudentId:selectedStudent.id,
            name:selectedStudent.name,
            className:classRecord.name,
            classCode:classRecord.code,
          });
          if(result.synced){
            localStorage.removeItem("geoboost_cloud_profile_pending");
            try{
              await registerStudentPresence({
                classCode:classRecord.code,
                studentId:selectedStudent.id,
                studentName:selectedStudent.name,
              });
            }catch(error){console.warn("Student presence sync pending",error)}
            try{await syncPendingAttempts()}catch{}
          }else{
            localStorage.setItem("geoboost_cloud_profile_pending",JSON.stringify({
              ...session,
              errorCode:result.errorCode||"sync-pending",
              savedAt:Date.now(),
            }));
          }
        }catch(error:any){
          console.warn("Student cloud sync deferred",error);
          localStorage.setItem("geoboost_cloud_profile_pending",JSON.stringify({
            ...session,
            errorCode:String(error?.code||error?.message||"sync-pending"),
            savedAt:Date.now(),
          }));
        }
      }

      router.push("/murid/utama");
    }catch(error:any){
      console.error(error);
      const permission=String(error?.code||"").includes("permission-denied");
      setNote(permission
        ?"Nama ini belum dapat disahkan. Minta guru semak senarai kelas."
        :"Maklumat belum dapat disimpan. Cuba semula.");
      setConfirmStage(0);setSaving(false);
    }
  }

  async function logout(){
    clearStudentSession();
    try{await signOutFirebaseUser()}catch{}
    setExisting(null);setClassRecord(null);setSelectedStudentId("");setSearchName("");setConfirmStage(0);
  }

  return <main className="auth-shell student-login-shell">
    <section className="auth-card student-login-card">
      <a href="/" className="mini-brand"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>TINGKATAN 2</small></span></a>
      <span className="eyebrow dark">AKSES MURID</span>
      <h1>Masuk GeoBoost</h1>
      <p>Masukkan <b>kod kelas</b>, pilih nama anda dan buat <b>dua pengesahan ringkas</b>.</p>

      {existing&&!classRecord?<div className="existing-student-card"><div><small>PERANTI INI</small><b>{existing.name}</b><span>{existing.className}</span></div><button onClick={()=>router.push("/murid/utama")}>Teruskan →</button></div>:null}

      {!classRecord?<form onSubmit={(e)=>{e.preventDefault();void findClass()}} className="student-form">
        <label>Kod kelas<input value={classCode} onChange={e=>setClassCode(e.target.value.toUpperCase())} placeholder="Contoh: 2E26" autoCapitalize="characters" required autoFocus/></label>
        <button className="primary full" type="submit" disabled={checking}>{checking?"Menyemak kelas...":"Semak Kod Kelas →"}</button>
      </form>:confirmStage===0?<form onSubmit={chooseForConfirmation} className="student-form">
        <div className="class-confirm"><div><small>KELAS DIJUMPAI</small><strong>{classRecord.name}</strong><span>Kod: {classRecord.code}</span></div><button type="button" onClick={()=>{setClassRecord(null);setSelectedStudentId("");setSearchName("");setConfirmStage(0)}}>Tukar</button></div>
        {roster.length>0?<><label>Cari nama<input value={searchName} onChange={e=>setSearchName(e.target.value)} placeholder="Taip sebahagian nama..."/></label><label>Nama murid<select value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)} size={Math.min(8,Math.max(3,filteredRoster.length))} required><option value="">— Pilih nama anda —</option>{filteredRoster.map(student=><option key={student.id} value={student.id}>{student.name}{roster.filter(x=>x.name===student.name).length>1?" · "+student.id.slice(-4):""}</option>)}</select></label><button className="primary full" type="submit" disabled={!selectedStudent}>Ini Nama Saya →</button></>:<div className="auth-note">Senarai murid untuk kelas ini belum tersedia. Minta guru masukkan nama murid terlebih dahulu.</div>}
      </form>:confirmStage===1?<div className="student-confirm-name">
        <span className="confirm-icon">👤</span><small>PENGESAHAN 1 DARIPADA 2</small><h2>{selectedStudent?.name}</h2><p>Kelas <b>{classRecord.name}</b> · Kod <b>{classRecord.code}</b></p>
        <div className="confirm-warning">Adakah ini benar-benar nama anda? Pastikan anda tidak tersalah memilih nama rakan.</div>
        <div className="confirm-actions"><button onClick={()=>setConfirmStage(0)}>← Pilih semula</button><button className="primary" onClick={()=>setConfirmStage(2)}>Ya, ini saya →</button></div>
      </div>:<div className="student-confirm-name">
        <span className="confirm-icon">✅</span><small>PENGESAHAN AKHIR · 2 DARIPADA 2</small><h2>{selectedStudent?.name}</h2><p>Kelas <b>{classRecord.name}</b></p>
        <div className="confirm-warning">Semua latihan, tugasan dan markah selepas ini akan direkodkan atas nama ini. Tekan sahkan hanya jika maklumat di atas betul.</div>
        <div className="confirm-actions"><button onClick={()=>setConfirmStage(1)}>← Kembali</button><button className="primary" onClick={confirmLogin} disabled={saving}>{saving?"Menyimpan...":"Saya Sahkan & Masuk →"}</button></div>
      </div>}

      {existing?<button className="student-logout" type="button" onClick={logout}>Keluar murid tersimpan / guna nama lain</button>:null}
      {note?<small className="auth-note">{note}</small>:null}
      
    </section>
  </main>;
}
