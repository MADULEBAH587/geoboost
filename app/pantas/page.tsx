"use client";

import { useState } from "react";
import { chapters } from "@/lib/data";
import { useRouter } from "next/navigation";

export default function QuickSetupPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([1,2]);
  const [size, setSize] = useState(10);

  function toggle(id: number) {
    setSelected((current) => current.includes(id) ? current.filter(x=>x!==id) : [...current,id]);
  }

  function start() {
    if (!selected.length) return;
    localStorage.setItem("geoboost_mix_settings", JSON.stringify({ chapters: selected, size }));
    router.push("/campuran");
  }

  return (
    <main className="setup-shell">
      <header className="topbar compact"><a className="brand" href="/"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>TINGKATAN 2</small></span></a><a className="back" href="/">← Utama</a></header>
      <section className="setup-card">
        <span className="eyebrow dark">⚡ LATIH TUBI PANTAS</span><h1>Pilih bab untuk digabungkan</h1><p>GeoBoost akan memilih soalan rawak daripada bab yang dipilih.</p>
        <div className="chapter-picks">{chapters.map(c=><button key={c.id} onClick={()=>toggle(c.id)} className={selected.includes(c.id)?"picked":""}><span>{c.icon}</span><div><small>BAB {c.id}</small><b>{c.title}</b></div><i>{selected.includes(c.id)?"✓":"+"}</i></button>)}</div>
        <div className="size-row"><div><small>BILANGAN SOALAN</small><strong>{size} soalan</strong></div><div>{[10,15,20].map(n=><button key={n} className={size===n?"active":""} onClick={()=>setSize(n)}>{n}</button>)}</div></div>
        <button className="primary full" onClick={start} disabled={!selected.length}>Mula latih tubi →</button>
      </section>
    </main>
  );
}
