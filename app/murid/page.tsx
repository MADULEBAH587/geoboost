"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearStudentSession, getStudentSession, saveStudentSession } from "@/lib/session";
import { syncPendingAttempts, syncStudentProfile } from "@/lib/repository";
import { firebaseConfigured, signOutFirebaseUser } from "@/lib/firebase";
import { normalizeClassCode, validateClassCode } from "@/lib/classroom";

export default function StudentLoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    const existing = getStudentSession();
    if (existing) {
      setHasExisting(true);
      setName(existing.name); setClassName(existing.className); setClassCode(existing.classCode); setPin(existing.pin);
    }
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !className.trim()) return;
    setSaving(true);
    setNote("");
    const existing = getStudentSession();
    let resolvedClassName = className.trim().toUpperCase();
    const resolvedClassCode = normalizeClassCode(classCode);

    if (firebaseConfigured && resolvedClassCode) {
      try {
        const classRecord = await validateClassCode(resolvedClassCode);
        if (!classRecord) {
          setNote("Kod kelas tidak sah atau kelas belum diaktifkan oleh guru.");
          setSaving(false);
          return;
        }
        resolvedClassName = classRecord.name;
      } catch {
        setNote("Kod kelas tidak dapat disahkan. Cuba semula atau kosongkan kod kelas untuk mod peranti.");
        setSaving(false);
        return;
      }
    }

    const session = {
      id: existing?.id || crypto.randomUUID(),
      name: name.trim(),
      className: resolvedClassName,
      classCode: resolvedClassCode,
      pin: pin.trim(),
      createdAt: existing?.createdAt || Date.now(),
    };
    saveStudentSession(session);
    if (firebaseConfigured) {
      const result = await syncStudentProfile({ localStudentId: session.id, name: session.name, className: session.className, classCode: session.classCode, pin: session.pin });
      if (result.synced) await syncPendingAttempts();
      setNote(result.synced ? "Profil dan rekod tertunda diselaraskan ke Firebase." : "Profil disimpan pada peranti. Firebase tidak dapat dicapai.");
    }
    setSaving(false);
    router.push("/");
  }

  async function logoutStudent() {
    clearStudentSession();
    try { await signOutFirebaseUser(); } catch {}
    setHasExisting(false); setName(""); setClassName(""); setClassCode(""); setPin(""); setNote("Sesi murid pada peranti ini telah ditutup. Rekod latihan lama kekal untuk rujukan guru.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a href="/" className="mini-brand"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>TINGKATAN 2</small></span></a>
        <span className="eyebrow dark">AKSES MURID</span>
        <h1>Masuk GeoBoost</h1>
        <p>Nama dan kelas disimpan pada peranti. Jika Firebase aktif, profil dan keputusan akan turut diselaraskan secara pusat.</p>
        <form onSubmit={submit} className="student-form">
          <label>Nama murid<input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Contoh: Zul Aiman" required /></label>
          <div className="form-grid">
            <label>Kelas<input value={className} onChange={(e)=>setClassName(e.target.value)} placeholder="2E" required /></label>
            <label>Kod kelas<input value={classCode} onChange={(e)=>setClassCode(e.target.value)} placeholder="2E26" /></label>
          </div>
          <label>PIN murid <span>(opsyen · untuk kegunaan kelas)</span><input inputMode="numeric" value={pin} onChange={(e)=>setPin(e.target.value)} placeholder="••••" /></label>
          <button className="primary full" type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Masuk GeoBoost →"}</button>
        </form>
        {hasExisting ? <button className="student-logout" type="button" onClick={logoutStudent}>Keluar murid ini / guna akaun lain</button> : null}
        <small className="auth-note">v1.0 · {firebaseConfigured ? "Firebase dikesan" : "Mod peranti sehingga Firebase env diisi"}</small>
        {note ? <small className="auth-note">{note}</small> : null}
      </section>
    </main>
  );
}
