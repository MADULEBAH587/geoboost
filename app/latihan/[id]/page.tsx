"use client";

import { use } from "react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { chapters } from "@/lib/data";
import { getQuestionsForChapter } from "@/lib/questions";

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const chapterId = Number(id);
  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) return <main className="quiz-shell"><div className="empty-state"><h1>Bab tidak dijumpai</h1><a className="primary" href="/">← Dashboard</a></div></main>;
  return <PracticeRunner bank={getQuestionsForChapter(chapterId)} requested={20} title={`Bab ${chapterId} · ${chapter.title}`} eyebrow="Latihan Bab" mode="Bab" returnHref={`/bab/${chapterId}`} />;
}
