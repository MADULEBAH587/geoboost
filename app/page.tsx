import { HomeStudentGate } from "@/components/HomeStudentGate";
import { totalQuestionBank } from "@/lib/data";
import { questions } from "@/lib/questions";

export default function Home(){
  return <main className="public-home">
    <header className="topbar public-topbar">
      <a className="brand" href="/"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>TINGKATAN 2</small></span></a>
      <a className="teacher-button" href="/guru">Panel Guru</a>
    </header>

    <section className="public-hero">
      <div className="contour contour-a"/><div className="contour contour-b"/>
      <div className="public-hero-copy">
        <span className="eyebrow">LATIHAN PENGUKUHAN INTERAKTIF GEOGRAFI</span>
        <h1>Belajar. Cuba.<br/><em>Kuasai Geografi.</em></h1>
        <p>GeoBoost menyusun latihan Bab 1–10, tugasan guru, pemulihan pintar, simulasi UASA dan rekod pencapaian dalam satu sistem yang mesra telefon.</p>
        <div className="public-trust"><span>✓ {questions.length} soalan aktif</span><span>✓ Tugasan kelas</span><span>✓ Simpan Automatik</span><span>✓ Analitik prestasi</span></div>
        <div className="byline">By Cikgu Zulhasif</div>
      </div>
      <div className="public-login-panel">
        <span className="eyebrow dark">AKSES MURID</span><h2>Masuk kelas anda</h2><p>Masukkan kod kelas. Pilih nama. Terus belajar.</p>
        <HomeStudentGate/>
        <div className="public-login-divider"><span>atau</span></div>
        <a className="secondary dark-button full center" href="/murid">Buka halaman Akses Murid</a>
      </div>
    </section>

    <section className="public-section public-steps">
      <div className="public-section-title"><span className="eyebrow dark">MUDAH UNTUK MURID</span><h2>Tiga langkah sahaja</h2></div>
      <div className="public-step-grid"><article><span>01</span><h3>Masukkan kod kelas</h3><p>Gunakan kod atau imbas QR yang diberi guru.</p></article><article><span>02</span><h3>Pilih nama</h3><p>Cari nama daripada senarai kelas dan sahkan identiti anda sebelum masuk.</p></article><article><span>03</span><h3>Terus belajar</h3><p>Lihat tugasan, sambung latihan dan pantau prestasi sendiri.</p></article></div>
    </section>

    <section className="public-section public-features">
      <div className="public-section-title"><span className="eyebrow dark">DALAM SATU TEMPAT</span><h2>Apa yang murid dapat?</h2></div>
      <div className="public-feature-grid"><article><span>📝</span><h3>Tugasan Guru</h3><p>Tugasan aktif, tarikh akhir dan rekod selesai.</p></article><article><span>📚</span><h3>Latihan Bab</h3><p>Bab 1–10 dengan aras Mudah, Sederhana dan KBAT.</p></article><article><span>🎯</span><h3>Pemulihan Pintar</h3><p>GeoBoost mengumpul soalan lemah untuk latihan semula.</p></article><article><span>📊</span><h3>Prestasi Saya</h3><p>Penguasaan bab, perkembangan markah, Mata Ilmu dan subtopik lemah.</p></article><article><span>🏆</span><h3>Simulasi UASA</h3><p>Masa menjawab, semak semula dan keputusan selepas selesai.</p></article><article><span>☁️</span><h3>Simpan Automatik</h3><p>Latihan belum siap boleh disambung tanpa bermula semula.</p></article></div>
    </section>

    <section className="public-cta"><div><small>BANK GEOBOOST</small><b>{totalQuestionBank}</b><span>soalan Geografi Tingkatan 2</span></div><a className="primary" href="/murid">Mula GeoBoost →</a></section>

    <footer><div className="footer-brand"><span className="brand-mark small">G</span><div><b>GeoBoost Tingkatan 2</b><small>Latihan Pengukuhan Interaktif Geografi</small></div></div><span>By Cikgu Zulhasif</span></footer>
  </main>;
}
