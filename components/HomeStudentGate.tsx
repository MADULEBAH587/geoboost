"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudentSession } from "@/lib/session";
import { normalizeClassCode } from "@/lib/classroom";

export function HomeStudentGate(){
  const router=useRouter();
  const [code,setCode]=useState("");
  useEffect(()=>{
    const student=getStudentSession();
    if(student)router.replace("/murid/utama");
  },[router]);
  function submit(e:FormEvent){
    e.preventDefault();
    const clean=normalizeClassCode(code);
    if(clean)router.push("/murid?class="+encodeURIComponent(clean));
  }
  return <form className="home-class-entry" onSubmit={submit}><label>Kod kelas</label><div><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Contoh: 2E26" aria-label="Kod kelas"/><button type="submit">Masuk →</button></div><small>Selepas kod disahkan, pilih nama dan buat dua pengesahan ringkas.</small></form>;
}
