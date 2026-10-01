import type { Question } from "@/lib/questions";

export type StimulusKind =
  | "scale"
  | "topogrid"
  | "topomap"
  | "rotation"
  | "seasons"
  | "climate-my"
  | "monsoon"
  | "transport-my"
  | "telecom"
  | "climate-asia"
  | "transport-asia"
  | "greenhouse"
  | "green-tech";

export function stimulusForQuestion(question: Question): StimulusKind | null {
  const { chapter, subtopic, id } = question;
  if (chapter === 1 && ["1.1","1.3","1.4"].includes(subtopic)) return "scale";
  if (chapter === 2 && ["2.2","2.3"].includes(subtopic)) return "topogrid";
  if (chapter === 2 && ["2.4","2.5"].includes(subtopic)) return "topomap";
  if (chapter === 3 && subtopic === "3.2") return "rotation";
  if (chapter === 3 && subtopic === "3.3") return "seasons";
  if (chapter === 4 && subtopic === "4.1") return "climate-my";
  if (chapter === 4 && ["4.2","4.4"].includes(subtopic)) return "monsoon";
  if (chapter === 4 && subtopic === "4.3") return "greenhouse";
  if (chapter === 5) return "transport-my";
  if (chapter === 6) return "telecom";
  if (chapter === 7) return "climate-asia";
  if (chapter === 8) return "transport-asia";
  if (chapter === 9) return "greenhouse";
  if (chapter === 10) return "green-tech";
  if (id === "GB03-028") return "seasons";
  return null;
}

export function GeoStimulus({ kind }: { kind: StimulusKind }) {
  const common = { role: "img", "aria-label": `Stimulus Geografi ${kind}` } as const;

  if (kind === "scale") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-MAP-1A</span><b>Peta Skala & Jarak</b></div>
      <svg {...common} viewBox="0 0 720 320" className="stimulus-svg">
        <rect width="720" height="320" rx="22" fill="#eef8f5" />
        <path d="M20 245 C120 185 150 205 240 150 S370 80 455 125 S570 210 700 90" fill="none" stroke="#2f7da0" strokeWidth="18" opacity=".65"/>
        <path d="M55 270 L180 185 L310 220 L460 150 L640 210" fill="none" stroke="#334155" strokeWidth="7" strokeLinecap="round"/>
        <path d="M95 55 L95 180 L250 180 L250 65" fill="none" stroke="#8b5e3c" strokeWidth="4" strokeDasharray="8 8"/>
        <circle cx="180" cy="185" r="10" fill="#0f766e"/><circle cx="460" cy="150" r="10" fill="#0f766e"/>
        <g fontFamily="Arial" fontSize="18" fill="#0f172a" fontWeight="700">
          <text x="125" y="170">Sekolah</text><text x="475" y="140">Hospital</text><text x="565" y="235">Balai Polis</text><text x="80" y="45">Kampung Aman</text>
        </g>
        <g transform="translate(500 265)" fontFamily="Arial" fill="#0f172a">
          <text x="0" y="-18" fontSize="13" fontWeight="700">SKALA LURUS</text>
          <line x1="0" y1="0" x2="160" y2="0" stroke="#0f172a" strokeWidth="4"/>
          {[0,40,80,120,160].map((x,i)=><g key={x}><line x1={x} y1="-8" x2={x} y2="8" stroke="#0f172a" strokeWidth="3"/><text x={x-5} y="26" fontSize="12">{i*2}</text></g>)}
          <text x="176" y="26" fontSize="12">km</text>
        </g>
        <g transform="translate(650 32)" fontFamily="Arial" fill="#0f172a"><text x="0" y="0" fontWeight="700">U</text><path d="M7 12 L7 50" stroke="#0f172a" strokeWidth="3"/><path d="M7 12 L-1 25 M7 12 L15 25" stroke="#0f172a" strokeWidth="3"/></g>
      </svg>
      <small className="stimulus-note">Skala contoh: 1 cm mewakili 2 km. Rajah dibina semula khas untuk GeoBoost.</small>
    </div>
  );

  if (kind === "topogrid") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-GRID-2A</span><b>Garisan Timuran & Utaraan</b></div>
      <svg {...common} viewBox="0 0 720 360" className="stimulus-svg">
        <rect width="720" height="360" rx="22" fill="#f8fafc" />
        <g transform="translate(95 35)" stroke="#64748b" strokeWidth="2">
          {[0,100,200,300,400,500].map((x)=><line key={`v${x}`} x1={x} y1="0" x2={x} y2="270" />)}
          {[0,54,108,162,216,270].map((y)=><line key={`h${y}`} x1="0" y1={y} x2="500" y2={y} />)}
          <rect x="100" y="54" width="100" height="54" fill="#dff7ee" opacity=".95"/>
          <circle cx="160" cy="82" r="9" fill="#e11d48" stroke="white" strokeWidth="3"/>
          <text x="174" y="88" fill="#0f172a" stroke="none" fontFamily="Arial" fontSize="16" fontWeight="700">Sek.</text>
          <g fill="#0f172a" stroke="none" fontFamily="Arial" fontSize="14" fontWeight="700">
            {[30,31,32,33,34,35].map((n,i)=><text key={n} x={i*100-8} y="300">{n}</text>)}
            {[55,54,53,52,51,50].map((n,i)=><text key={n} x="-38" y={i*54+6}>{n}</text>)}
          </g>
        </g>
        <g fontFamily="Arial" fill="#334155" fontSize="15"><text x="300" y="342">TIMURAN →</text><text x="14" y="195" transform="rotate(-90 14 195)">UTARAAN →</text></g>
        <g transform="translate(625 45)" fontFamily="Arial" fill="#0f172a"><text fontWeight="700">U</text><path d="M7 12 L7 52" stroke="#0f172a" strokeWidth="3"/><path d="M7 12 L0 25 M7 12 L14 25" stroke="#0f172a" strokeWidth="3"/></g>
      </svg>
      <small className="stimulus-note">Baca timuran dahulu, kemudian utaraan. Petak berwarna menunjukkan contoh segi empat grid.</small>
    </div>
  );

  if (kind === "topomap") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-TOPO-2B</span><b>Peta Topografi Bukit Murni</b></div>
      <svg {...common} viewBox="0 0 720 360" className="stimulus-svg">
        <rect width="720" height="360" rx="22" fill="#f4f8ef" />
        <g opacity=".6" fill="none" stroke="#9a7b4f" strokeWidth="2">
          <ellipse cx="120" cy="250" rx="88" ry="55"/><ellipse cx="120" cy="250" rx="66" ry="39"/><ellipse cx="120" cy="250" rx="42" ry="24"/>
          <ellipse cx="620" cy="70" rx="72" ry="45"/><ellipse cx="620" cy="70" rx="48" ry="28"/>
        </g>
        <path d="M350 0 C330 55 390 92 350 145 S300 235 370 360" fill="none" stroke="#3b82a0" strokeWidth="15" opacity=".75"/>
        <path d="M25 180 L690 180" stroke="#334155" strokeWidth="7"/><path d="M450 25 L450 330" stroke="#334155" strokeWidth="7"/>
        <g fill="#d9b46b" opacity=".8"><rect x="250" y="215" width="80" height="55"/><rect x="475" y="205" width="85" height="60"/></g>
        <g fill="#86b96a" opacity=".85"><circle cx="585" cy="115" r="45"/><circle cx="650" cy="135" r="38"/><circle cx="610" cy="165" r="32"/></g>
        <g fill="#ef4444" stroke="white" strokeWidth="3"><circle cx="445" cy="180" r="8"/><circle cx="472" cy="180" r="8"/><circle cx="500" cy="180" r="8"/></g>
        <g fontFamily="Arial" fontSize="15" fill="#0f172a" fontWeight="700"><text x="65" y="242">Bukit Murni</text><text x="385" y="142">Sungai Aman</text><text x="400" y="165">Pekan Harmoni</text><text x="252" y="290">Sawah padi</text><text x="480" y="290">Ladang getah</text><text x="585" y="225">Hutan</text></g>
        <g transform="translate(20 20)" fontFamily="Arial" fontSize="12" fill="#334155"><text fontWeight="700">PETUNJUK</text><text y="20">— Jalan raya</text><text y="38">≈ Sungai</text><text y="56">● Petempatan</text><text y="74">▰ Pertanian</text></g>
      </svg>
      <small className="stimulus-note">Gunakan bentuk muka bumi, saliran, guna tanah dan pola petempatan untuk membuat tafsiran.</small>
    </div>
  );

  if (kind === "rotation") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-EARTH-3A</span><b>Putaran Bumi</b></div>
      <svg {...common} viewBox="0 0 720 340" className="stimulus-svg dark-svg">
        <defs><linearGradient id="earthDay" x1="0" x2="1"><stop offset="0" stopColor="#17365d"/><stop offset=".5" stopColor="#1f6fa7"/><stop offset="1" stopColor="#58c4dd"/></linearGradient></defs>
        <rect width="720" height="340" rx="22" fill="#07182d"/>
        <circle cx="110" cy="170" r="65" fill="#ffd166"/><g stroke="#ffd166" strokeWidth="4" opacity=".65">{[[110,80,110,45],[110,260,110,295],[20,170,55,170],[165,170,200,170]].map((p,i)=><line key={i} x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]}/>)}</g>
        <circle cx="485" cy="170" r="100" fill="url(#earthDay)"/><path d="M485 65 L520 275" stroke="#f8fafc" strokeWidth="4" opacity=".75"/><path d="M535 90 C605 125 610 210 545 250" fill="none" stroke="#67e8f9" strokeWidth="5" strokeLinecap="round"/><path d="M545 250 l18 -5 l-8 -17" fill="none" stroke="#67e8f9" strokeWidth="5"/>
        <text x="432" y="315" fill="#f8fafc" fontFamily="Arial" fontSize="15">Barat ← bumi berputar → Timur</text><text x="458" y="55" fill="#f8fafc" fontFamily="Arial" fontSize="15">Paksi condong 23½°</text>
        <text x="82" y="170" fill="#6b4e00" fontFamily="Arial" fontWeight="700">Matahari</text><text x="425" y="174" fill="#fff" fontFamily="Arial" fontWeight="700">SIANG</text><text x="535" y="174" fill="#fff" fontFamily="Arial" fontWeight="700">MALAM</text>
      </svg>
      <small className="stimulus-note">Satu putaran lengkap mengambil masa 24 jam dan berlaku dari barat ke timur.</small>
    </div>
  );

  if (kind === "seasons") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-SEASON-3D</span><b>Peredaran Bumi & Empat Musim</b></div>
      <svg {...common} viewBox="0 0 720 390" className="stimulus-svg">
        <rect width="720" height="390" rx="22" fill="#f8fafc"/>
        <ellipse cx="360" cy="195" rx="255" ry="125" fill="none" stroke="#94a3b8" strokeWidth="3" strokeDasharray="7 7"/>
        <circle cx="360" cy="195" r="52" fill="#ffd166"/>
        {[[360,55,"21 Jun","Musim panas U"],[615,195,"23 Sep","Ekuinoks"],[360,335,"22 Dis","Musim sejuk U"],[105,195,"21 Mac","Ekuinoks"]].map(([x,y,a,b],i)=><g key={i}><circle cx={Number(x)} cy={Number(y)} r="34" fill="#2f7da0"/><line x1={Number(x)-8} y1={Number(y)-42} x2={Number(x)+8} y2={Number(y)+42} stroke="#0f172a" strokeWidth="3"/><text x={Number(x)-33} y={Number(y)+58} fontFamily="Arial" fontSize="13" fontWeight="700" fill="#0f172a">{String(a)}</text><text x={Number(x)-42} y={Number(y)+76} fontFamily="Arial" fontSize="12" fill="#475569">{String(b)}</text></g>)}
        <text x="331" y="201" fontFamily="Arial" fontWeight="700" fill="#6b4e00">Matahari</text>
      </svg>
      <small className="stimulus-note">Kecondongan paksi dan peredaran bumi menyebabkan perubahan musim serta panjang siang dan malam.</small>
    </div>
  );

  if (kind === "climate-my") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-CLIMATE-4A</span><b>Graf Iklim Khatulistiwa</b></div>
      <svg {...common} viewBox="0 0 720 360" className="stimulus-svg">
        <rect width="720" height="360" rx="22" fill="#f8fafc"/>
        <g transform="translate(70 35)">
          <line x1="0" y1="260" x2="590" y2="260" stroke="#64748b" strokeWidth="2"/><line x1="0" y1="0" x2="0" y2="260" stroke="#64748b" strokeWidth="2"/>
          {[136,156,95,127,227,181,200,151,234,251,331,314].map((v,i)=>{const h=v*.62;return <rect key={i} x={i*47+8} y={260-h} width="25" height={h} rx="5" fill="#69a9c2"/>})}
          <polyline points={[27.9,27.7,28.6,29.1,28.6,27.8,27.6,28,27.5,27.4,27,26.9].map((v,i)=>`${i*47+20},${210-(v-26)*45}`).join(" ")} fill="none" stroke="#f97316" strokeWidth="4"/>
          {"JFMAMJJASOND".split("").map((m,i)=><text key={i} x={i*47+16} y="286" fontFamily="Arial" fontSize="12" fill="#334155">{m}</text>)}
          <text x="-5" y="-10" fontFamily="Arial" fontSize="13" fill="#334155">Hujan (mm)</text><text x="490" y="20" fontFamily="Arial" fontSize="13" fill="#f97316">Suhu ~27°C</text>
        </g>
      </svg>
      <small className="stimulus-note">Corak utama: suhu tinggi dan hampir sekata, hujan banyak sepanjang tahun.</small>
    </div>
  );

  if (kind === "monsoon") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-MONSOON-4B</span><b>Angin Monsun & Malaysia</b></div>
      <svg {...common} viewBox="0 0 720 340" className="stimulus-svg">
        <rect width="720" height="340" rx="22" fill="#eef7fb"/>
        <path d="M280 70 C330 55 380 80 385 120 C410 140 395 185 360 195 C350 250 310 270 275 235 C240 260 215 225 225 195 C190 170 205 125 235 115 C235 88 255 74 280 70Z" fill="#d3e4bf" stroke="#6c8a57" strokeWidth="3"/>
        <text x="263" y="165" fontFamily="Arial" fontWeight="700" fill="#35502a">Malaysia</text>
        <path d="M595 50 C500 70 450 105 390 135" fill="none" stroke="#2563eb" strokeWidth="8" strokeLinecap="round"/><path d="M390 135 l28 -4 l-12 -24" fill="none" stroke="#2563eb" strokeWidth="8"/>
        <text x="480" y="42" fontFamily="Arial" fontWeight="700" fill="#1d4ed8">Monsun Timur Laut</text>
        <path d="M90 285 C180 250 230 235 285 210" fill="none" stroke="#ea580c" strokeWidth="8" strokeLinecap="round"/><path d="M285 210 l-27 3 l10 24" fill="none" stroke="#ea580c" strokeWidth="8"/>
        <text x="45" y="315" fontFamily="Arial" fontWeight="700" fill="#c2410c">Monsun Barat Daya</text>
        <text x="510" y="180" fontFamily="Arial" fontSize="14" fill="#475569">Hujan lebat pantai timur</text><text x="70" y="225" fontFamily="Arial" fontSize="14" fill="#475569">Hujan sederhana</text>
      </svg>
      <small className="stimulus-note">Rajah skematik untuk membantu memahami arah dan pengaruh angin monsun.</small>
    </div>
  );

  if (kind === "transport-my") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-TRANS-5A</span><b>Jaringan Pengangkutan Malaysia</b></div>
      <svg {...common} viewBox="0 0 720 350" className="stimulus-svg">
        <rect width="720" height="350" rx="22" fill="#f7fbff"/>
        <path d="M160 45 C115 90 125 150 155 185 C180 215 185 280 220 315 C255 270 250 215 238 170 C228 125 218 72 160 45Z" fill="#d8e7c8" stroke="#6b8f58" strokeWidth="3"/>
        <path d="M500 80 C555 65 650 90 670 145 C640 175 560 170 500 145 C455 130 430 110 500 80Z" fill="#d8e7c8" stroke="#6b8f58" strokeWidth="3"/>
        <path d="M180 70 L198 295" stroke="#ef4444" strokeWidth="6"/><path d="M468 122 C520 108 590 116 650 140" stroke="#ef4444" strokeWidth="6" fill="none"/>
        <g fill="#1d4ed8" stroke="white" strokeWidth="2">{[[188,210],[208,290],[520,120],[620,140],[145,110]].map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="8"/>)}</g>
        <g fontFamily="Arial" fontSize="13" fill="#0f172a"><text x="90" y="32">Semenanjung</text><text x="535" y="62">Sabah & Sarawak</text><text x="210" y="210">Kuala Lumpur</text><text x="212" y="315">Johor Bahru</text><text x="525" y="105">Kuching</text><text x="620" y="125">Kota Kinabalu</text></g>
      </svg>
      <small className="stimulus-note">Gunakan jaringan, bentuk muka bumi dan lokasi bandar untuk menghubungkaitkan fungsi pengangkutan.</small>
    </div>
  );

  if (kind === "telecom") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-TELCO-6A</span><b>Rangkaian Telekomunikasi</b></div>
      <svg {...common} viewBox="0 0 720 330" className="stimulus-svg">
        <rect width="720" height="330" rx="22" fill="#f7f7ff"/>
        <circle cx="360" cy="160" r="55" fill="#3b82f6"/><text x="327" y="166" fontFamily="Arial" fontWeight="700" fill="white">Internet</text>
        {[[120,75,"📱","Telefon pintar"],[600,75,"🛰️","Satelit"],[120,250,"💻","Komputer"],[600,250,"🏦","e-Perbankan"]].map(([x,y,ico,label],i)=><g key={i}><line x1="360" y1="160" x2={Number(x)} y2={Number(y)} stroke="#94a3b8" strokeWidth="4"/><circle cx={Number(x)} cy={Number(y)} r="47" fill="#e7eefc" stroke="#94a3b8" strokeWidth="2"/><text x={Number(x)-14} y={Number(y)+7} fontSize="26">{String(ico)}</text><text x={Number(x)-52} y={Number(y)+70} fontFamily="Arial" fontSize="13" fill="#334155">{String(label)}</text></g>)}
      </svg>
      <small className="stimulus-note">Telekomunikasi menghubungkan individu, perkhidmatan, maklumat dan sistem digital merentasi jarak.</small>
    </div>
  );

  if (kind === "climate-asia") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-ASIA-7A</span><b>Zon Iklim Asia</b></div>
      <svg {...common} viewBox="0 0 720 350" className="stimulus-svg">
        <rect width="720" height="350" rx="22" fill="#f8fafc"/>
        <path d="M105 45 C210 15 350 25 470 60 C560 85 630 120 655 175 C595 210 545 220 475 235 C390 255 335 300 245 305 C170 280 130 230 100 175 C75 125 72 85 105 45Z" fill="#e5e7eb" stroke="#64748b" strokeWidth="3"/>
        <path d="M100 58 C240 25 500 50 625 120" stroke="#7dd3fc" strokeWidth="34" opacity=".9"/><path d="M94 115 C260 80 520 105 648 170" stroke="#a7f3d0" strokeWidth="38" opacity=".85"/><path d="M102 180 C255 150 520 170 640 225" stroke="#fde68a" strokeWidth="42" opacity=".85"/><path d="M130 245 C280 220 490 235 575 270" stroke="#fdba74" strokeWidth="48" opacity=".9"/>
        <g fontFamily="Arial" fontSize="14" fontWeight="700" fill="#0f172a"><text x="520" y="70">SEJUK</text><text x="500" y="130">SEJUK SEDERHANA</text><text x="450" y="200">PANAS SEDERHANA</text><text x="395" y="275">PANAS</text></g>
      </svg>
      <small className="stimulus-note">Peta skematik zon iklim. Kedudukan latitud membantu menjelaskan perubahan suhu dari selatan ke utara.</small>
    </div>
  );

  if (kind === "transport-asia") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-TRANS-8A</span><b>Hab & Jaringan Pengangkutan Asia</b></div>
      <svg {...common} viewBox="0 0 720 350" className="stimulus-svg">
        <rect width="720" height="350" rx="22" fill="#f8fafc"/>
        <path d="M85 60 C180 30 350 30 500 70 C600 100 650 165 610 215 C540 250 460 250 400 285 C300 305 210 280 150 230 C95 185 62 110 85 60Z" fill="#e6efe0" stroke="#6b8f58" strokeWidth="3"/>
        <path d="M130 90 C250 70 390 85 545 170" fill="none" stroke="#dc2626" strokeWidth="5" strokeDasharray="10 7"/>
        <path d="M260 210 C330 180 410 165 535 145" fill="none" stroke="#2563eb" strokeWidth="5"/>
        {[[520,130,"Jepun","🚄"],[210,190,"India","🚆"],[390,235,"Singapura","⚓"],[165,105,"Rusia","🚆"],[495,245,"Dubai","✈️"],[450,170,"Hong Kong","⚓"]].map(([x,y,label,ico],i)=><g key={i}><circle cx={Number(x)} cy={Number(y)} r="18" fill="white" stroke="#475569" strokeWidth="2"/><text x={Number(x)-10} y={Number(y)+7} fontSize="18">{String(ico)}</text><text x={Number(x)+24} y={Number(y)+5} fontFamily="Arial" fontSize="13" fontWeight="700" fill="#0f172a">{String(label)}</text></g>)}
      </svg>
      <small className="stimulus-note">Kenal pasti hubungan antara jaringan darat, udara dan air dengan ketersampaian serta pembangunan ekonomi.</small>
    </div>
  );

  if (kind === "greenhouse") return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-GHG-9A</span><b>Kesan Rumah Hijau</b></div>
      <svg {...common} viewBox="0 0 720 350" className="stimulus-svg">
        <defs><linearGradient id="skyHeat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dbeafe"/><stop offset="1" stopColor="#fff7ed"/></linearGradient></defs>
        <rect width="720" height="350" rx="22" fill="url(#skyHeat)"/>
        <circle cx="105" cy="80" r="48" fill="#ffd166"/>
        <path d="M155 95 L330 180" stroke="#f59e0b" strokeWidth="9"/><path d="M330 180 l-23 -3 l8 -18" fill="none" stroke="#f59e0b" strokeWidth="7"/>
        <path d="M330 230 C390 190 410 110 455 70" fill="none" stroke="#ef4444" strokeWidth="8"/><path d="M455 70 l-18 14 l20 10" fill="none" stroke="#ef4444" strokeWidth="7"/>
        <path d="M458 75 C520 135 500 205 435 235" fill="none" stroke="#ef4444" strokeWidth="8" strokeDasharray="8 7"/>
        <path d="M0 285 Q360 235 720 285 L720 350 L0 350Z" fill="#6b8f58"/>
        <g fontFamily="Arial" fontSize="14" fill="#0f172a"><text x="165" y="105">Pancaran matahari</text><text x="430" y="55">Sebahagian haba ke angkasa</text><text x="470" y="175">Haba terperangkap</text><text x="310" y="315" fontWeight="700">Gas rumah hijau: CO₂ · CH₄ · CFC · N₂O</text></g>
      </svg>
      <small className="stimulus-note">Pertambahan gas rumah hijau meningkatkan jumlah haba yang terperangkap dalam atmosfera.</small>
    </div>
  );

  return (
    <div className="stimulus-card">
      <div className="stimulus-title"><span>GB-GREEN-10A</span><b>Empat Teras Teknologi Hijau</b></div>
      <svg {...common} viewBox="0 0 720 340" className="stimulus-svg">
        <rect width="720" height="340" rx="22" fill="#f3faf5"/>
        <circle cx="360" cy="170" r="72" fill="#0f766e"/><text x="316" y="164" fontFamily="Arial" fontWeight="700" fill="white">TEKNOLOGI</text><text x="336" y="188" fontFamily="Arial" fontWeight="700" fill="white">HIJAU</text>
        {[[155,75,"⚡","Tenaga"],[565,75,"💼","Ekonomi"],[155,265,"🌿","Alam sekitar"],[565,265,"👥","Sosial"]].map(([x,y,ico,label],i)=><g key={i}><line x1="360" y1="170" x2={Number(x)} y2={Number(y)} stroke="#86b99a" strokeWidth="5"/><circle cx={Number(x)} cy={Number(y)} r="52" fill="white" stroke="#86b99a" strokeWidth="3"/><text x={Number(x)-15} y={Number(y)+5} fontSize="27">{String(ico)}</text><text x={Number(x)-48} y={Number(y)+75} fontFamily="Arial" fontWeight="700" fill="#234235">{String(label)}</text></g>)}
      </svg>
      <small className="stimulus-note">Produk dan amalan teknologi hijau menyeimbangkan tenaga, ekonomi, alam sekitar dan sosial.</small>
    </div>
  );
}
