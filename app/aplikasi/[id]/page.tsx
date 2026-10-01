"use client";

import { use } from "react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { stimulusForQuestion } from "@/components/GeoStimulus";
import { chapters } from "@/lib/data";
import { getQuestionsForChapter } from "@/lib/questions";

export default function ApplicationPracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const chapterId = Number(id);
  const chapter = chapters.find((c)=>c.id===chapterId);
  if (!chapter) return <main className="quiz-shell"><div className="empty-state"><h1>Bab tidak dijumpai</h1><a className="primary" href="/">← Dashboard</a></div></main>;
  const bank = getQuestionsForChapter(chapterId).filter(q=>Boolean(stimulusForQuestion(q)));
  return <PracticeRunner bank={bank} requested={Math.min(15, bank.length)} title={`Aplikasi · Bab ${chapterId}`} eyebrow="Aplikasi Geografi" mode="Aplikasi" returnHref={`/bab/${chapterId}`} mix={{easy:4,medium:7,kbat:4}} />;
}
