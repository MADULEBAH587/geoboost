"use client";

export function StudentBottomNav({ active }: { active: "utama"|"tugasan"|"latihan"|"prestasi"|"profil" }) {
  const items = [
    ["utama","🏠","Utama","/murid/utama"],
    ["tugasan","📝","Tugasan","/murid/tugasan"],
    ["ulang","🔁","Ulang Salah","/ulang-salah"],
  ] as const;
  return (
    <nav className="student-bottom-nav" aria-label="Navigasi murid">
      {items.map(([id,icon,label,href])=><a key={id} className={active===id ? "active" : ""} href={href}><span>{icon}</span><b>{label}</b></a>)}
    </nav>
  );
}
