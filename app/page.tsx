import { ChapterCard } from "@/components/ChapterCard";
import { ModeCard } from "@/components/ModeCard";
import { StudentSummary } from "@/components/StudentSummary";
import { chapters, totalQuestionBank } from "@/lib/data";
import { questions } from "@/lib/questions";

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="GeoBoost Tingkatan 2"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>TINGKATAN 2</small></span></a>
        <a className="teacher-button" href="/guru">Panel Guru</a>
      </header>

      <section className="hero" id="top">
        <div className="contour contour-a" /><div className="contour contour-b" />
        <div className="hero-copy">
          <span className="eyebrow">LATIHAN PENGUKUHAN INTERAKTIF GEOGRAFI</span>
          <h1>Belajar. Cuba.<br/><em>Kuasai Geografi.</em></h1>
          <p>Latihan Bab 1–10, pembetulan segera, pemulihan berasaskan subtopik dan rekod pencapaian dalam satu pengalaman yang mesra telefon.</p>
          <div className="hero-actions"><a className="primary" href="#bab">Mula Latihan <span>→</span></a><a className="secondary" href="/murid">👤 Akses Murid</a></div>
          <div className="byline">By Cikgu Zulhasif · v1.1</div>
        </div>
        <StudentSummary />
      </section>

      <section className="section modes">
        <div className="section-heading"><div><span className="eyebrow dark">PILIH CARA BELAJAR</span><h2>Mod GeoBoost</h2></div><p>Latihan Bab, Latih Tubi Pantas, Cabaran UASA dan Pemulihan kini aktif.</p></div>
        <div className="mode-grid">
          <ModeCard icon="📚" title="Latihan Bab" tag="AKTIF" text="Pilih Bab 1–10 dan jawab set rawak dengan maklum balas segera." href="#bab" />
          <ModeCard icon="⚡" title="Latih Tubi Pantas" tag="AKTIF" text="Gabungkan beberapa bab dalam satu set 10–20 soalan." href="/pantas" />
          <ModeCard icon="🏆" title="Cabaran UASA" tag="AKTIF" text="Set campuran semua bab dengan aras mudah, sederhana dan KBAT." href="/uasa" />
          <ModeCard icon="🎯" title="Pemulihan" tag="AKTIF" text="Bina set khusus daripada subtopik yang pernah dijawab salah." href="/pemulihan" />
        </div>
      </section>

      <section className="section chapter-section" id="bab">
        <div className="section-heading"><div><span className="eyebrow dark">BAB 1–10</span><h2>Pilih bab</h2></div><p>{questions.length} soalan aktif · sasaran bank {totalQuestionBank}.</p></div>
        <div className="chapter-grid">{chapters.map((chapter) => <ChapterCard key={chapter.id} chapter={chapter} />)}</div>
      </section>

      <footer><div className="footer-brand"><span className="brand-mark small">G</span><div><b>GeoBoost Tingkatan 2</b><small>Latihan Pengukuhan Interaktif Geografi</small></div></div><span>By Cikgu Zulhasif · v1.1</span></footer>
    </main>
  );
}
