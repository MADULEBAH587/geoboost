"use client";

export function StudentBottomNav({ active }: { active: "utama"|"tugasan"|"latihan"|"prestasi"|"profil" }) {
  const items = [
    ["utama","🏠","Utama"],
    ["tugasan","📝","Tugasan"],
    ["latihan","📚","Latihan"],
    ["prestasi","📊","Prestasi"],
    ["profil","👤","Profil"],
  ] as const;
  return (
    <nav className="student-bottom-nav" aria-label="Navigasi murid">
      {items.map(([id,icon,label])=><a key={id} className={active===id ? "active" : ""} href={"/murid/"+id}><span>{icon}</span><b>{label}</b></a>)}
    </nav>
  );
}
