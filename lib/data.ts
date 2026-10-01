export type Chapter = {
  id: number;
  title: string;
  short: string;
  icon: string;
  questions: number;
  progress: number;
  best?: number;
  status: "complete" | "progress" | "new";
};

export const chapters: Chapter[] = [
  { id: 1, title: "Skala dan Jarak", short: "Skala, jarak mutlak & relatif", icon: "📏", questions: 32, progress: 100, best: 85, status: "complete" },
  { id: 2, title: "Peta Topografi", short: "Grid, simbol & tafsiran peta", icon: "🗺️", questions: 41, progress: 62, best: 62, status: "progress" },
  { id: 3, title: "Pengaruh Pergerakan Bumi", short: "Putaran, peredaran & musim", icon: "🌍", questions: 28, progress: 38, best: 58, status: "progress" },
  { id: 4, title: "Cuaca dan Iklim di Malaysia", short: "Iklim Khatulistiwa & perubahan cuaca", icon: "🌦️", questions: 38, progress: 0, status: "new" },
  { id: 5, title: "Pengangkutan di Malaysia", short: "Jaringan, awam & lestari", icon: "🚆", questions: 60, progress: 0, status: "new" },
  { id: 6, title: "Telekomunikasi di Malaysia", short: "Teknologi, kepentingan & etika", icon: "📡", questions: 38, progress: 0, status: "new" },
  { id: 7, title: "Kepelbagaian Iklim di Asia", short: "Zon iklim & kegiatan manusia", icon: "🌏", questions: 48, progress: 0, status: "new" },
  { id: 8, title: "Pengangkutan di Asia", short: "Jaringan & kemajuan pengangkutan", icon: "🚄", questions: 33, progress: 0, status: "new" },
  { id: 9, title: "Pemanasan Global", short: "Punca, kesan & langkah", icon: "🔥", questions: 35, progress: 0, status: "new" },
  { id: 10, title: "Teknologi Hijau", short: "Produk, kepentingan & amalan hijau", icon: "🌱", questions: 37, progress: 0, status: "new" }
];

export const totalQuestionBank = chapters.reduce((sum, c) => sum + c.questions, 0);
