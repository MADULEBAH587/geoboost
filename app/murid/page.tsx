"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearStudentSession, getStudentSession, saveStudentSession } from "@/lib/session";
import { syncPendingAttempts, syncStudentProfile } from "@/lib/repository";
import { firebaseConfigured, signOutFirebaseUser } from "@/lib/firebase";
import { ClassRecord, normalizeClassCode, normalizeStudentName, stableStudentId, validateClassCode } from "@/lib/classroom";

export default function StudentLoginPage() {
  const router = useRouter();
  const [classCode, setClassCode] = useState("");
  const [classRecord, setClassRecord] = useState<ClassRecord | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    const existing = getStudentSession();
    if (existing) {
      setHasExisting(true);
      setClassCode(existing.classCode || "");
    }
    const params = new URLSearchParams(window.location.search);
    const fromLink = normalizeClassCode(params.get("class") || "");
    if (fromLink) setClassCode(fromLink);
  }, []);

  const roster = useMemo(() => classRecord?.studentNames || [], [classRecord]);

  async function checkClass(e?: FormEvent) {
    e?.preventDefault();
    const clean = normalizeClassCode(classCode);
    if (!clean) {
      setNote("Masukkan kod kelas dahulu.");
      return;
    }
    setChecking(true);
    setNote("");
    setClassRecord(null);
    setSelectedName("");
    setManualMode(false);
    try {
      const found = await validateClassCode(clean);
      if (!found) {
        setNote("Kod kelas tidak sah atau kelas belum diaktifkan oleh guru.");
        return;
      }
      setClassCode(found.code);
      setClassRecord(found);
      setNote(found.studentNames.length
        ? `Kelas ${found.name} dijumpai. Pilih nama anda.`
        : `Kelas ${found.name} dijumpai. Senarai nama belum dimasukkan — tambah nama anda secara manual.`);
      if (!found.studentNames.length) setManualMode(true);
    } catch (error) {
      console.error(error);
      setNote("Kod kelas tidak dapat disahkan. Semak Internet dan cuba semula.");
    } finally {
      setChecking(false);
    }
  }

  async function enterGeoBoost(e: FormEvent) {
    e.preventDefault();
    if (!classRecord) return;
    const chosen = manualMode ? normalizeStudentName(manualName) : normalizeStudentName(selectedName);
    if (!chosen) {
      setNote("Pilih nama atau masukkan nama penuh anda.");
      return;
    }
    setSaving(true);
    setNote("");
    try {
      const existing = getStudentSession();
      const id = stableStudentId(classRecord.code, chosen);
      const session = {
        id,
        name: chosen,
        className: classRecord.name,
        classCode: classRecord.code,
        createdAt: existing?.id === id ? existing.createdAt : Date.now(),
      };
      saveStudentSession(session);

      if (firebaseConfigured) {
        const result = await syncStudentProfile({
          localStudentId: session.id,
          name: session.name,
          className: session.className,
          classCode: session.classCode,
        });
        if (result.synced) await syncPendingAttempts();
        if (!result.synced) {
          setNote("Profil disimpan pada peranti tetapi belum berjaya diselaraskan. Cuba lagi kemudian.");
          setSaving(false);
          return;
        }
      }
      router.push("/");
    } catch (error) {
      console.error(error);
      setNote("Profil tidak dapat disimpan. Cuba semula.");
      setSaving(false);
    }
  }

  async function logoutStudent() {
    clearStudentSession();
    try { await signOutFirebaseUser(); } catch {}
    setHasExisting(false);
    setClassRecord(null);
    setSelectedName("");
    setManualName("");
    setManualMode(false);
    setNote("Sesi murid pada peranti ini telah ditutup.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a href="/" className="mini-brand"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>TINGKATAN 2</small></span></a>
        <span className="eyebrow dark">AKSES MURID · v1.2</span>
        <h1>Masuk GeoBoost</h1>
        <p>Masukkan <b>kod kelas</b>, kemudian pilih nama daripada senarai. Tiada PIN diperlukan.</p>

        {!classRecord ? (
          <form onSubmit={checkClass} className="student-form">
            <label>Kod kelas
              <input
                value={classCode}
                onChange={(e)=>setClassCode(e.target.value.toUpperCase())}
                placeholder="Contoh: 2E26"
                autoCapitalize="characters"
                required
              />
            </label>
            <button className="primary full" type="submit" disabled={checking}>
              {checking ? "Menyemak kelas..." : "Semak Kod Kelas →"}
            </button>
          </form>
        ) : (
          <form onSubmit={enterGeoBoost} className="student-form">
            <div className="class-confirm">
              <div><small>KELAS DIJUMPAI</small><strong>{classRecord.name}</strong><span>Kod: {classRecord.code}</span></div>
              <button type="button" onClick={()=>{setClassRecord(null);setSelectedName("");setManualMode(false);setManualName("");}}>Tukar</button>
            </div>

            {!manualMode && roster.length > 0 ? (
              <label>Nama murid
                <select value={selectedName} onChange={(e)=>setSelectedName(e.target.value)} required>
                  <option value="">— Pilih nama anda —</option>
                  {roster.map((name)=><option key={name} value={name}>{name}</option>)}
                </select>
              </label>
            ) : (
              <label>Nama penuh
                <input
                  value={manualName}
                  onChange={(e)=>setManualName(e.target.value)}
                  placeholder="Masukkan nama penuh"
                  required
                />
                <span>Nama ini akan muncul dalam senarai murid guru selepas anda masuk.</span>
              </label>
            )}

            {roster.length > 0 ? (
              <button className="manual-name-toggle" type="button" onClick={()=>{setManualMode(v=>!v);setSelectedName("");setManualName("");}}>
                {manualMode ? "← Kembali pilih nama" : "Nama saya tiada dalam senarai"}
              </button>
            ) : null}

            <button className="primary full" type="submit" disabled={saving || (!manualMode && !selectedName) || (manualMode && !manualName.trim())}>
              {saving ? "Menyimpan..." : "Masuk GeoBoost →"}
            </button>
          </form>
        )}

        {hasExisting ? <button className="student-logout" type="button" onClick={logoutStudent}>Keluar murid ini / guna akaun lain</button> : null}
        {note ? <small className="auth-note">{note}</small> : null}
        <small className="auth-note">☁️ {firebaseConfigured ? "Firebase aktif" : "Mod peranti"}</small>
      </section>
    </main>
  );
}
