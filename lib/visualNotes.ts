import type { StimulusKind } from "@/components/GeoStimulus";

export type VisualNoteTab = "quick" | "poster" | "slides" | "diagram";

export type VisualSlide = {
  kicker: string;
  title: string;
  bullets: string[];
  note?: string;
};

export type VisualNoteChapter = {
  chapter: number;
  title: string;
  subtitle: string;
  accent: string;
  stimulus: StimulusKind;
  quickFacts: { label: string; value: string; detail: string }[];
  posterBlocks: { title: string; points: string[] }[];
  slides: VisualSlide[];
};

export const visualNotes: VisualNoteChapter[] = [
  {
    chapter: 1,
    title: "Skala dan Jarak",
    subtitle: "Daripada ukuran atas peta kepada jarak sebenar",
    accent: "📏",
    stimulus: "scale",
    quickFacts: [
      { label: "Skala", value: "Nisbah", detail: "Jarak pada peta berbanding jarak sebenar di permukaan bumi." },
      { label: "Jarak mutlak", value: "m / km", detail: "Ukuran sebenar yang tetap dalam unit jarak." },
      { label: "Jarak relatif", value: "Masa / kos", detail: "Berubah mengikut cara perjalanan, masa dan kos." },
      { label: "Alat", value: "Pembaris / benang", detail: "Pembaris untuk jarak lurus; benang sesuai untuk jarak melengkung." },
    ],
    posterBlocks: [
      { title: "3 jenis skala", points: ["Skala penyata", "Skala lurus", "Pecahan wakilan"] },
      { title: "Cara kira", points: ["Ukur jarak pada peta", "Kenal pasti skala", "Tukar kepada jarak sebenar"] },
      { title: "Ingat", points: ["1 km = 100 000 cm", "Jarak lurus ≠ jarak melengkung", "Unit mesti ditukar dengan betul"] },
    ],
    slides: [
      { kicker: "1.1", title: "Kenali skala", bullets: ["Skala menunjukkan hubungan jarak peta dengan jarak sebenar.", "Skala boleh dinyatakan dalam ayat, garisan atau nisbah.", "Penyebut pecahan wakilan yang lebih kecil menunjukkan skala yang lebih besar."] },
      { kicker: "1.2", title: "Jarak mutlak & relatif", bullets: ["Jarak mutlak menggunakan meter atau kilometer.", "Jarak relatif bergantung pada masa dan kos.", "Dua tempat dengan jarak mutlak sama boleh mempunyai jarak relatif berbeza."] },
      { kicker: "1.3–1.4", title: "Menentukan jarak sebenar", bullets: ["Jarak lurus: pembaris, jangka tolok atau jalur kertas.", "Jarak melengkung: benang atau jalur kertas.", "Darabkan ukuran peta dengan nilai skala yang sepadan."] },
    ],
  },
  {
    chapter: 2,
    title: "Peta Topografi",
    subtitle: "Grid, simbol dan tafsiran pandang darat",
    accent: "🗺️",
    stimulus: "topogrid",
    quickFacts: [
      { label: "Timuran", value: "Menegak", detail: "Nilai bertambah ke arah timur dan dibaca dahulu." },
      { label: "Utaraan", value: "Melintang", detail: "Nilai bertambah ke arah utara dan dibaca selepas timuran." },
      { label: "RG 4 angka", value: "Kawasan", detail: "Sesuai untuk menentukan kawasan dalam satu segi empat grid." },
      { label: "RG 6 angka", value: "Objek", detail: "Lebih tepat untuk menentukan lokasi objek tertentu." },
    ],
    posterBlocks: [
      { title: "Pandang darat fizikal", points: ["Bentuk muka bumi", "Saliran", "Tumbuh-tumbuhan semula jadi"] },
      { title: "Pandang darat budaya", points: ["Petempatan", "Kegiatan ekonomi", "Kemudahan sosial", "Pengangkutan"] },
      { title: "Cara mentafsir", points: ["Lihat peta secara keseluruhan", "Kenal pasti ciri", "Hubung kait fizikal dengan budaya", "Sokong tafsiran dengan bukti peta"] },
    ],
    slides: [
      { kicker: "2.1–2.2", title: "Asas peta topografi", bullets: ["Peta topografi menggambarkan ciri fizikal dan budaya sesuatu kawasan.", "Peta lengkap mempunyai tajuk, petunjuk dan skala.", "Garisan timuran menegak; garisan utaraan melintang."] },
      { kicker: "2.3", title: "Rujukan grid", bullets: ["Baca timuran dahulu, kemudian utaraan.", "RG 4 angka menentukan kawasan.", "RG 6 angka menentukan objek dengan lebih spesifik."] },
      { kicker: "2.4–2.5", title: "Mentafsir hubungan", bullets: ["Tanah pamah memudahkan petempatan, pertanian dan pengangkutan.", "Tanah tinggi sesuai untuk kegiatan tertentu seperti tanaman hawa sederhana.", "Saliran dan bentuk muka bumi mempengaruhi pola guna tanah."] },
    ],
  },
  {
    chapter: 3,
    title: "Pengaruh Pergerakan Bumi",
    subtitle: "Putaran, peredaran dan kesannya",
    accent: "🌍",
    stimulus: "rotation",
    quickFacts: [
      { label: "Putaran", value: "24 jam", detail: "Bumi berputar pada paksinya dari barat ke timur." },
      { label: "Peredaran", value: "365¼ hari", detail: "Bumi beredar mengelilingi matahari dalam orbit elips." },
      { label: "Paksi", value: "23½°", detail: "Kecondongan paksi penting dalam perubahan musim." },
      { label: "Musim", value: "4 musim", detail: "Berlaku di kawasan beriklim sederhana akibat peredaran bumi." },
    ],
    posterBlocks: [
      { title: "Kesan putaran", points: ["Siang dan malam", "Perbezaan waktu tempatan", "Pembiasan angin lazim", "Pasang surut"] },
      { title: "Kesan peredaran", points: ["Empat musim", "Perubahan panjang siang dan malam", "Gerhana dalam kedudukan tertentu"] },
      { title: "Kata kunci", points: ["Barat → Timur", "24 jam", "365¼ hari", "Paksi condong 23½°"] },
    ],
    slides: [
      { kicker: "3.2", title: "Putaran bumi", bullets: ["Satu putaran lengkap mengambil masa 24 jam.", "Bahagian yang menghadap matahari mengalami siang.", "Bahagian yang membelakangi matahari mengalami malam."] },
      { kicker: "3.2", title: "Kesan putaran", bullets: ["Wujud perbezaan waktu tempatan.", "Arah angin lazim mengalami pembiasan.", "Tarikan bulan dan matahari berkaitan kejadian pasang surut."] },
      { kicker: "3.3", title: "Peredaran & musim", bullets: ["Satu peredaran lengkap mengambil masa 365¼ hari.", "Hemisfera utara dan selatan mengalami musim yang bertentangan.", "Ekuinoks berlaku apabila siang dan malam hampir sama panjang."] },
    ],
  },
  {
    chapter: 4,
    title: "Cuaca dan Iklim di Malaysia",
    subtitle: "Iklim Khatulistiwa dan pengaruhnya",
    accent: "🌦️",
    stimulus: "climate-my",
    quickFacts: [
      { label: "Iklim", value: "Khatulistiwa", detail: "Panas dan lembap sepanjang tahun." },
      { label: "Min suhu", value: "≈ 27°C", detail: "Suhu tinggi dan hampir sekata sepanjang tahun." },
      { label: "Hujan", value: "≈ 2 600 mm", detail: "Malaysia menerima hujan sepanjang tahun." },
      { label: "Perubahan", value: "El Niño / La Niña", detail: "Mempengaruhi taburan hujan dan keadaan cuaca." },
    ],
    posterBlocks: [
      { title: "Ciri iklim", points: ["Suhu tinggi", "Julat suhu tahunan kecil", "Hujan banyak", "Kelembapan tinggi"] },
      { title: "Pengaruh terhadap manusia", points: ["Pertanian", "Perikanan", "Pembalakan", "Pelancongan"] },
      { title: "Kesan kegiatan manusia", points: ["Pulau haba", "Hujan asid", "Jerebu", "Kesan rumah hijau"] },
    ],
    slides: [
      { kicker: "4.1", title: "Iklim Khatulistiwa", bullets: ["Malaysia panas dan lembap sepanjang tahun.", "Min suhu tahunan sekitar 27°C.", "Hujan tahunan tinggi dan taburannya dipengaruhi angin monsun."] },
      { kicker: "4.2–4.3", title: "Iklim & kegiatan manusia", bullets: ["Cuaca mempengaruhi pertanian, perikanan, pembalakan dan pelancongan.", "Monsun Timur Laut boleh menjejaskan perikanan di pantai timur.", "Aktiviti manusia boleh mencetuskan pulau haba, jerebu dan hujan asid."] },
      { kicker: "4.4", title: "El Niño & La Niña", bullets: ["El Niño dikaitkan dengan keadaan lebih panas dan kering.", "La Niña boleh membawa hujan luar biasa dan risiko banjir.", "Kesan berbeza mengikut lokasi dan tempoh kejadian."] },
    ],
  },
  {
    chapter: 5,
    title: "Pengangkutan di Malaysia",
    subtitle: "Jaringan, kepentingan dan kelestarian",
    accent: "🚆",
    stimulus: "transport-my",
    quickFacts: [
      { label: "Darat", value: "Jalan / rel", detail: "Menghubungkan petempatan, bandar dan pusat ekonomi." },
      { label: "Udara", value: "Lapangan terbang", detail: "Penting untuk perjalanan cepat dan kawasan jauh." },
      { label: "Air", value: "Pelabuhan", detail: "Menyokong perdagangan dan pergerakan kargo." },
      { label: "Lestari", value: "Kurang impak", detail: "Utamakan pengangkutan awam dan perjalanan yang lebih cekap." },
    ],
    posterBlocks: [
      { title: "Faktor jaringan", points: ["Bentuk muka bumi", "Kegiatan ekonomi", "Dasar kerajaan", "Kemajuan teknologi"] },
      { title: "Kepentingan", points: ["Meningkatkan ketersampaian", "Memajukan ekonomi", "Mewujudkan pekerjaan", "Menggalakkan pelancongan"] },
      { title: "Pengangkutan awam", points: ["Kurangkan kesesakan", "Kurangkan kos", "Kurangkan pencemaran", "Mudahkan pergerakan"] },
    ],
    slides: [
      { kicker: "5.1–5.3", title: "Jenis pengangkutan", bullets: ["Pengangkutan darat meliputi jalan raya dan rel.", "Pengangkutan udara mempercepat hubungan antara wilayah.", "Pengangkutan air penting untuk perdagangan dan kawasan pesisir."] },
      { kicker: "5.4–5.6", title: "Faktor & kepentingan", bullets: ["Bentuk muka bumi mempengaruhi kos pembinaan.", "Kegiatan ekonomi meningkatkan keperluan jaringan.", "Pengangkutan awam membantu ketersampaian dan mengurangkan kesesakan."] },
      { kicker: "5.7", title: "Pengangkutan lestari", bullets: ["Gunakan pengangkutan awam bila sesuai.", "Kurangkan kebergantungan pada kenderaan persendirian.", "Pilih kaedah perjalanan yang cekap tenaga dan rendah pencemaran."] },
    ],
  },
  {
    chapter: 6,
    title: "Telekomunikasi di Malaysia",
    subtitle: "Teknologi, kepentingan dan etika digital",
    accent: "📡",
    stimulus: "telecom",
    quickFacts: [
      { label: "Telekomunikasi", value: "Hubungan jarak jauh", detail: "Membolehkan pertukaran maklumat dengan cepat." },
      { label: "Kemajuan", value: "Satelit / Internet", detail: "Teknologi digital memperluas liputan dan keupayaan komunikasi." },
      { label: "Kepentingan", value: "Cepat & cekap", detail: "Menyokong pendidikan, kewangan, pentadbiran dan komunikasi." },
      { label: "Etika", value: "Sahih & selamat", detail: "Semak maklumat dan lindungi data peribadi." },
    ],
    posterBlocks: [
      { title: "Kepentingan", points: ["Hubungan lebih mudah", "Urusan lebih cekap", "E-pembelajaran", "Perbankan atas talian", "Ramalan cuaca"] },
      { title: "Etika penggunaan", points: ["Bersopan santun", "Semak kesahihan berita", "Jaga privasi & kata laluan", "Elak plagiat", "Gunakan untuk perkara bermanfaat"] },
      { title: "Kesan pembangunan", points: ["Peluang ekonomi", "Akses maklumat", "Integrasi negara", "Risiko penyalahgunaan jika tidak beretika"] },
    ],
    slides: [
      { kicker: "6.1–6.2", title: "Kemajuan alat telekomunikasi", bullets: ["Perkembangan satelit dan rangkaian digital mempercepat penyampaian maklumat.", "Telefon pintar dan Internet menggabungkan pelbagai fungsi komunikasi.", "Teknologi membolehkan maklumat dihantar merentasi jarak dengan pantas."] },
      { kicker: "6.3–6.4", title: "Kepentingan kepada negara", bullets: ["Menyokong pentadbiran dan urusan kerajaan.", "Memperluas pendidikan, perniagaan dan perbankan.", "Membantu ramalan cuaca serta penyebaran maklumat."] },
      { kicker: "6.5", title: "Etika digital", bullets: ["Semak kebenaran sesuatu berita.", "Jangan dedahkan kata laluan dan maklumat peribadi.", "Hormati hasil karya orang lain dan elakkan plagiat."] },
    ],
  },
  {
    chapter: 7,
    title: "Kepelbagaian Iklim di Asia",
    subtitle: "Zon iklim dan pengaruh terhadap kegiatan manusia",
    accent: "🌏",
    stimulus: "climate-asia",
    quickFacts: [
      { label: "Zon sejuk", value: "Utara Asia", detail: "Suhu sangat rendah dan musim sejuk panjang." },
      { label: "Sejuk sederhana", value: "Latitud tinggi sederhana", detail: "Mengalami perubahan musim yang jelas." },
      { label: "Panas sederhana", value: "Pertengahan Asia", detail: "Ciri suhu dan hujan berubah mengikut jenis iklim." },
      { label: "Panas", value: "Latitud rendah", detail: "Termasuk kawasan khatulistiwa dan gurun panas." },
    ],
    posterBlocks: [
      { title: "4 zon utama", points: ["Sejuk", "Sejuk sederhana", "Panas sederhana", "Panas"] },
      { title: "Apa perlu banding?", points: ["Suhu", "Jumlah & musim hujan", "Angin", "Tumbuhan", "Kegiatan manusia"] },
      { title: "Kegiatan manusia", points: ["Pertanian", "Perikanan", "Pembalakan", "Perindustrian", "Pelancongan", "Pengangkutan"] },
    ],
    slides: [
      { kicker: "7.1–7.2", title: "Asia mempunyai iklim yang pelbagai", bullets: ["Keluasan benua Asia menyebabkan perbezaan latitud dan iklim yang besar.", "Empat zon utama: sejuk, sejuk sederhana, panas sederhana dan panas.", "Suhu serta hujan berbeza antara zon."] },
      { kicker: "7.3–7.6", title: "Kenali zon iklim", bullets: ["Utara Asia lebih sejuk berbanding kawasan berhampiran khatulistiwa.", "Kawasan sederhana mengalami variasi musim lebih ketara.", "Kawasan panas merangkumi iklim lembap dan juga kawasan gurun."] },
      { kicker: "7.6", title: "Iklim mempengaruhi manusia", bullets: ["Jenis tanaman bergantung pada suhu dan hujan.", "Musim menentukan masa menjalankan sesetengah kegiatan.", "Pengangkutan, perikanan dan pelancongan turut dipengaruhi keadaan iklim."] },
    ],
  },
  {
    chapter: 8,
    title: "Jenis dan Kemajuan Pengangkutan di Asia",
    subtitle: "Darat, udara, air dan kesannya",
    accent: "🚄",
    stimulus: "transport-asia",
    quickFacts: [
      { label: "Darat", value: "Rel / jalan", detail: "Kereta api berkelajuan tinggi meningkatkan ketersampaian." },
      { label: "Udara", value: "Hab antarabangsa", detail: "Lapangan terbang menghubungkan bandar utama dunia." },
      { label: "Air", value: "Pelabuhan", detail: "Penting untuk perdagangan antarabangsa dan kargo." },
      { label: "Kesan", value: "Masyarakat / ekonomi / alam", detail: "Kemajuan membawa manfaat tetapi juga risiko alam sekitar." },
    ],
    posterBlocks: [
      { title: "Contoh kemajuan", points: ["Shinkansen di Jepun", "Lapangan terbang antarabangsa", "Pelabuhan utama Asia", "Jaringan rel moden"] },
      { title: "Kesan masyarakat", points: ["Masa perjalanan lebih singkat", "Ketersampaian meningkat", "Peluang pekerjaan", "Taraf hidup meningkat"] },
      { title: "Kesan alam sekitar", points: ["Boleh kurangkan pencemaran melalui teknologi cekap", "Pencemaran bunyi", "Pencemaran air", "Kemusnahan hutan"] },
    ],
    slides: [
      { kicker: "8.1", title: "Jenis pengangkutan di Asia", bullets: ["Pengangkutan darat, udara dan air saling melengkapi.", "Bandar besar berkembang sebagai hab pengangkutan.", "Lokasi strategik membantu perdagangan dan mobiliti."] },
      { kicker: "8.2", title: "Kemajuan teknologi", bullets: ["Kereta api laju memendekkan masa perjalanan.", "Lapangan terbang moden meningkatkan hubungan antarabangsa.", "Pelabuhan cekap mempercepat urusan kargo."] },
      { kicker: "8.3", title: "Kesan kemajuan", bullets: ["Masyarakat mendapat akses dan peluang pekerjaan.", "Ekonomi berkembang melalui perdagangan, pelancongan dan perkhidmatan.", "Alam sekitar boleh terjejas melalui bunyi, tumpahan minyak dan pembukaan hutan."] },
    ],
  },
  {
    chapter: 9,
    title: "Pemanasan Global",
    subtitle: "Punca, kesan dan langkah mengurangkannya",
    accent: "🔥",
    stimulus: "greenhouse",
    quickFacts: [
      { label: "Maksud", value: "Suhu bumi meningkat", detail: "Peningkatan suhu purata atmosfera bumi dalam jangka masa panjang." },
      { label: "Gas utama", value: "CO₂ / CH₄ / CFC", detail: "Gas rumah hijau memerangkap haba dalam atmosfera." },
      { label: "Kesan", value: "Aras laut & cuaca", detail: "Mempengaruhi sumber makanan, kesihatan dan ekosistem." },
      { label: "Tindakan", value: "Kurang pelepasan", detail: "Penggunaan tenaga cekap dan amalan lestari membantu mengurangkan kesan." },
    ],
    posterBlocks: [
      { title: "Faktor manusia", points: ["Pembakaran terbuka", "Pengangkutan", "Perindustrian", "Penjanaan tenaga", "Pertanian & penternakan"] },
      { title: "Kesan", points: ["Aras laut meningkat", "Gangguan cuaca", "Sumber makanan terjejas", "Masalah kesihatan", "Ekosistem marin terganggu"] },
      { title: "Langkah", points: ["Kurangkan pelepasan gas rumah hijau", "Jimat tenaga", "Gunakan tenaga lebih bersih", "Pelihara hutan", "Amalan 5R"] },
    ],
    slides: [
      { kicker: "9.1–9.2", title: "Mengapa bumi semakin panas?", bullets: ["Gas rumah hijau memerangkap sebahagian haba dalam atmosfera.", "Aktiviti manusia menambah pelepasan gas seperti karbon dioksida dan metana.", "Faktor semula jadi juga boleh mempengaruhi atmosfera."] },
      { kicker: "9.3", title: "Kesan pemanasan global", bullets: ["Pencairan ais menyumbang kepada peningkatan aras laut.", "Cuaca ekstrem boleh menjejaskan keselamatan dan harta benda.", "Pertanian, bekalan air, kesihatan dan ekosistem turut terjejas."] },
      { kicker: "9.4", title: "Apa yang boleh dibuat?", bullets: ["Kurangkan penggunaan tenaga yang membazir.", "Kurangkan pelepasan daripada pengangkutan dan pembakaran.", "Perbanyak amalan lestari, kitar semula dan pemeliharaan kawasan hijau."] },
    ],
  },
  {
    chapter: 10,
    title: "Teknologi Hijau",
    subtitle: "Teknologi untuk kehidupan dan alam yang lebih lestari",
    accent: "🌱",
    stimulus: "green-tech",
    quickFacts: [
      { label: "Konsep", value: "Pelihara alam", detail: "Produk, peralatan dan sistem yang memelihara alam sekitar dan sumber semula jadi." },
      { label: "Teras", value: "4", detail: "Tenaga, ekonomi, alam sekitar dan sosial." },
      { label: "Ciri", value: "Rendah impak", detail: "Jimat sumber, rendah pelepasan dan boleh menyokong kitar semula." },
      { label: "Amalan", value: "5R + jimat", detail: "Kurangkan sisa, jimat air dan tenaga serta pilih produk hijau." },
    ],
    posterBlocks: [
      { title: "4 teras", points: ["Tenaga", "Ekonomi", "Alam sekitar", "Sosial"] },
      { title: "Contoh produk", points: ["Kenderaan elektrik", "Kereta hibrid", "Biodiesel", "Panel solar", "Produk biodegradasi", "Baja kompos"] },
      { title: "Amalan harian", points: ["5R", "Penjimatan air", "Penjimatan tenaga", "Pengurangan sisa", "Pengangkutan awam", "Produk mesra alam"] },
    ],
    slides: [
      { kicker: "10.1–10.2", title: "Apa itu teknologi hijau?", bullets: ["Matlamatnya ialah mengurangkan kesan negatif aktiviti manusia.", "Produk hijau menjimatkan tenaga dan sumber serta mengurangkan kemerosotan alam.", "Pelepasan gas rumah hijau sepatutnya rendah atau sifar."] },
      { kicker: "10.3–10.4", title: "Produk & kepentingan", bullets: ["Tenaga: kenderaan cekap, biodiesel dan solar.", "Alam sekitar: produk biodegradasi dan kompos.", "Ekonomi dan sosial: teknologi hijau menyokong kualiti hidup serta peluang ekonomi."] },
      { kicker: "10.5", title: "Amalan teknologi hijau", bullets: ["Amalkan 5R dan pengasingan sisa.", "Kurangkan penggunaan barang pakai buang.", "Jimat air dan tenaga serta utamakan pengangkutan awam apabila sesuai."] },
    ],
  },
];

export function getVisualNote(chapter: number) {
  return visualNotes.find(item => item.chapter === chapter) || null;
}
