"use client";

import { PracticeRunner } from "@/components/PracticeRunner";
import { questions } from "@/lib/questions";

export default function UASAPage() {
  return <PracticeRunner bank={questions} requested={30} title="Cabaran UASA · Bab 1–10" eyebrow="Cabaran UASA" mode="UASA" returnHref="/" mix={{easy:12,medium:12,kbat:6}} />;
}
