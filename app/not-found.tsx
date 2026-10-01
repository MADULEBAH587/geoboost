export default function NotFound() {
  return (
    <main className="quiz-shell">
      <div className="empty-state">
        <span style={{fontSize:42}}>🧭</span>
        <h1>Halaman tidak dijumpai</h1>
        <p>Kembali ke dashboard GeoBoost dan pilih modul yang tersedia.</p>
        <a className="primary" href="/">← Dashboard</a>
      </div>
    </main>
  );
}
