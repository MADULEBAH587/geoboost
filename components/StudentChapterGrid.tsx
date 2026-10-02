"use client";

import { useEffect, useState } from "react";
import type { Chapter } from "@/lib/data";
import { ChapterCard } from "@/components/ChapterCard";
import { getStudentSession } from "@/lib/session";
import { validateClassCode } from "@/lib/classroom";

export function StudentChapterGrid({ chapters }: { chapters: Chapter[] }) {
  const [openChapters, setOpenChapters] = useState<number[] | null>(null);

  useEffect(() => {
    const student = getStudentSession();
    if (!student?.classCode) {
      setOpenChapters(chapters.map(ch=>ch.id));
      return;
    }
    validateClassCode(student.classCode)
      .then(record => setOpenChapters(record?.openChapters || chapters.map(ch=>ch.id)))
      .catch(() => setOpenChapters(chapters.map(ch=>ch.id)));
  }, [chapters]);

  return <div className="chapter-grid">{chapters.map(chapter => <ChapterCard key={chapter.id} chapter={chapter} locked={openChapters ? !openChapters.includes(chapter.id) : false} />)}</div>;
}
