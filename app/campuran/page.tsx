"use client";

import { useEffect, useMemo, useState } from "react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { questions } from "@/lib/questions";

export default function MixedPracticePage() {
  const [settings, setSettings] = useState<{chapters:number[];size:number}|null>(null);
  useEffect(()=>{ try { setSettings(JSON.parse(localStorage.getItem("geoboost_mix_settings") || "null")); } catch { setSettings(null); } },[]);
  const bank = useMemo(()=> settings ? questions.filter(q=>settings.chapters.includes(q.chapter)) : [],[settings]);
  if (!settings) return <main className="quiz-shell"><div className="empty-state"><h1>Tetapan latih tubi belum ada</h1><a className="primary" href="/pantas">Pilih bab →</a></div></main>;
  return <PracticeRunner bank={bank} requested={settings.size} title={`Bab ${settings.chapters.join(", ")}`} eyebrow="Latih Tubi Pantas" mode="Latih Tubi" returnHref="/pantas" />;
}
