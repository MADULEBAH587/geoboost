"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearStudentSession, getStudentSession, saveStudentSession, StudentSession } from "@/lib/session";
import { syncPendingAttempts, syncStudentProfile } from "@/lib/repository";
import { firebaseConfigured, signOutFirebaseUser } from "@/lib/firebase";
import { ClassRecord, normalizeClassCode, normalizeStudentName, stableStudentId, validateClassCode } from "@/lib/classroom";

export default function StudentLoginPage() {
  const router = useRouter();
  const [existing,setExisting]=useState<StudentSession|null>(null);
  const [classCode,setClassCode]=useState("");
  const [classRecord,setClassRecord]=useState<ClassRecord|null>(null);
  const [selectedName,setSelectedName]=useState("");
  const [searchName,setSearchName]=useState("");
  const [manualMode,setManualMode]=useState(false);
  const [manualName,setManualName]=useState("");
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

  const roster=useMemo(()=>classRecord?.studentNames||[],[classRecord]);
  const filteredRoster=useMemo(()=>{
    const q=normalizeStudentName(searchName);
    return q ? roster.filter(name=>name.includes(q)) : roster;
  },[roster,searchName]);

  async function findClass(code=classCode){
    const clean=normalizeClassCode(code);
    if(!clean){setNote("Masukkan kod kelas dahulu.");return}
    setChecking(true);setNote("");setClassRecord(null);setSelectedName("");setManualMode(false);setConfirming(false);
    try{
      const found=await validateClassCode(clean);
      if(!found){setNote("Kod kelas tidak sah, kelas telah diarkib atau belum diaktifkan oleh guru.");return}
      setClassCode(found.code);setClassRecord(found);
      if(!found.studentNames.length)setManualMode(true);
      setNote(found.studentNames.length?"Kelas "+found.name+" dijumpai. Cari dan pilih nama anda.":"Kelas "+found.name+" dijumpai. Senarai nama belum dimasukkan — tambah nama anda.");
    }catch(error){
      console.error(error);setNote("Kod kelas tidak dapat disahkan. Semak Internet dan cuba semula.");
    }finally{setChecking(false)}
  }

  function chooseForConfirmation(e:FormEvent){
    e.preventDefault();
    const chosen=manualMode?normalizeStudentName(manualName):normalizeStudentName(selectedName);
    if(!chosen){setNote("Pilih nama atau masukkan nama penuh anda.");return}
    setConfirming(true);
  }

  async function confirmLogin(){
    if(!classRecord)return;
    const chosen=manualMode?normalizeStudentName(manualName):normalizeStudentName(selectedName);
    if(!chosen)return;
    setSaving(true);setNote("");
    try{
      const id=stableStudentId(classRecord.code,chosen);
      const prior=getStudentSession();
      const session:StudentSession={
        id,
        name:chosen,
        className:classRecord.name,
        classCode:classRecord.code,
        createdAt:prior?.id===id?prior.createdAt:Date.now(),
        pendingRoster:manualMode && !classRecord.studentNames.some(name=>normalizeStudentName(name)===chosen),
      };
      saveStudentSession(session);
      if(firebaseConfigured){
        const result=await syncStudentProfile({localStudentId:id,name:chosen,className:classRecord.name,classCode:classRecord.code});
        if(result.synced)await syncPendingAttempts();
        if(!result.synced){setNote("Profil disimpan pada peranti tetapi belum berjaya diselaraskan. Cuba semula.");setSaving(false);return}
      }
      router.push("/murid/utama");
    }catch(error){
      console.error(error);setNote("Profil tidak dapat disimpan. Cuba semula.");setSaving(false);
    }
  }

  async function logout(){
    clearStudentSession();
    try{await signOutFirebaseUser()}catch{}
    setExisting(null);setClassRecord(null);setSelectedName("");setManualName("");setSearchName("");setConfirming(false);
  }

  const chosen=manualMode?normalizeStudentName(manualName):normalizeStudentName(selectedName);

  return <main className="auth-shell student-login-shell">
    <section className="auth-card student-login-card">
      <a href="/" className="mini-brand"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>TINGKATAN 2</small></span></a>
      <span className="eyebrow dark">AKSES MURID · v2.0</span>
      <h1>Masuk GeoBoost</h1>
      <p>Masukkan <b>kod kelas</b> sahaja. Kemudian cari dan pilih nama anda. Tiada PIN diperlukan.</p>

      {existing && !classRecord ? <div className="existing-student-card"><div><small>PERANTI INI</small><b>{existing.name}</b><span>{existing.className}</span></div><button onClick={()=>router.push("/murid/utama")}>Teruskan →</button></div>:null}

      {!classRecord ? <form onSubmit={(e)=>{e.preventDefault();void findClass()}} className="student-form">
        <label>Kod kelas<input value={classCode} onChange={e=>setClassCode(e.target.value.toUpperCase())} placeholder="Contoh: 2E26" autoCapitalize="characters" required autoFocus/></label>
        <button className="primary full" type="submit" disabled={checking}>{checking?"Menyemak kelas...":"Semak Kod Kelas →"}</button>
      </form>:!confirming?<form onSubmit={chooseForConfirmation} className="student-form">
        <div className="class-confirm"><div><small>KELAS DIJUMPAI</small><strong>{classRecord.name}</strong><span>Kod: {classRecord.code}</span></div><button type="button" onClick={()=>{setClassRecord(null);setSelectedName("");setManualMode(false);setManualName("");setSearchName("")}}>Tukar</button></div>
        {!manualMode && roster.length>0?<><label>Cari nama<input value={searchName} onChange={e=>setSearchName(e.target.value)} placeholder="Taip sebahagian nama..."/></label><label>Nama murid<select value={selectedName} onChange={e=>setSelectedName(e.target.value)} size={Math.min(7,Math.max(2,filteredRoster.length))} required><option value="">— Pilih nama anda —</option>{filteredRoster.map(name=><option key={name} value={name}>{name}</option>)}</select></label></>:<label>Nama penuh<input value={manualName} onChange={e=>setManualName(e.target.value)} placeholder="Masukkan nama penuh" required/><span>Nama ini akan muncul dalam senarai semakan guru.</span></label>}
        {roster.length>0?<button className="manual-name-toggle" type="button" onClick={()=>{setManualMode(v=>!v);setSelectedName("");setManualName("");setSearchName("")}}>{manualMode?"← Kembali pilih nama":"Nama saya tiada dalam senarai"}</button>:null}
        <button className="primary full" type="submit" disabled={!chosen}>{manualMode?"Semak Nama →":"Pilih Nama →"}</button>
      </form>:<div className="student-confirm-name">
        <span className="confirm-icon">👤</span><small>PASTIKAN NAMA BETUL</small><h2>{chosen}</h2><p>Kelas <b>{classRecord.name}</b> · Kod <b>{classRecord.code}</b></p><div className="confirm-warning">Pastikan ini nama anda sebelum meneruskan. Peranti ini akan mengingati pilihan anda.</div>
        <div className="confirm-actions"><button onClick={()=>setConfirming(false)}>← Betulkan</button><button className="primary" onClick={confirmLogin} disabled={saving}>{saving?"Menyimpan...":"Ya, ini saya →"}</button></div>
      </div>}

      {existing?<button className="student-logout" type="button" onClick={logout}>Keluar murid tersimpan / guna akaun lain</button>:null}
      {note?<small className="auth-note">{note}</small>:null}
      <small className="auth-note">☁️ {firebaseConfigured?"Firebase aktif":"Mod peranti"}</small>
    </section>
  </main>;
}
