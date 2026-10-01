import { chapters } from "@/lib/data";
import { getQuestionsForChapter } from "@/lib/questions";
import { notFound } from "next/navigation";

export default async function ChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chapter = chapters.find((c) => c.id === Number(id));
  if (!chapter) notFound();
  const currentChapter = chapter!;
  const activeBank = getQuestionsForChapter(currentChapter.id);
  const easy = activeBank.filter(q=>q.difficulty === "easy").length;
  const medium = activeBank.filter(q=>q.difficulty === "medium").length;
  const kbat = activeBank.filter(q=>q.difficulty === "kbat").length;

  return (
    <main className="chapter-page">
      <header className="topbar compact"><a className="brand" href="/"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>TINGKATAN 2</small></span></a><a className="back" href="/">← Dashboard</a></header>
      <section className="chapter-hero">
        <span className="chapter-big-icon">{currentChapter.icon}</span><span className="eyebrow">BAB {currentChapter.id}</span><h1>{currentChapter.title}</h1><p>{currentChapter.short}</p>
        <div className="chapter-summary"><div><small>Bank sasaran</small><b>{currentChapter.questions}</b></div><div><small>Soalan aktif</small><b>{activeBank.length}</b></div><div><small>Aras</small><b>{easy}/{medium}/{kbat}</b></div></div>
      </section>
      <section className="section chapter-launch">
        <div className="launch-card featured"><span>🧠</span><div><small>MOD STANDARD · AKTIF</small><h2>Kuasai Konsep</h2><p>Set rawak daripada bank aktif bab ini. Jawapan dan penerangan dipaparkan serta-merta.</p></div><a className="launch-button active" href={`/latihan/${currentChapter.id}`}>Mula latihan →</a></div>
        <div className="launch-card"><span>🗺️</span><div><small>APLIKASI · AKTIF</small><h2>Aplikasi Geografi</h2><p>Fokus peta, rajah, graf, grid dan stimulus visual GeoBoost.</p></div><a className="launch-button active" href={`/aplikasi/${currentChapter.id}`}>Mula aplikasi →</a></div>
        <div className="launch-card"><span>🎯</span><div><small>PEMULIHAN · AKTIF</small><h2>Topik Lemah</h2><p>GeoBoost membina set daripada subtopik yang pernah dijawab salah.</p></div><a className="launch-button active" href="/pemulihan">Mula pemulihan →</a></div>
      </section>
    </main>
  );
}
