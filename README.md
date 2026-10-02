# GeoBoost Tingkatan 2 v2.5
**Latihan Pengukuhan Interaktif Geografi — By Cikgu Zulhasif**

GeoBoost ialah aplikasi Next.js/PWA untuk latihan Geografi Tingkatan 2 Bab 1–10. Aplikasi boleh berjalan secara local-first pada peranti; apabila Firebase dikonfigurasi, profil murid dan keputusan diselaraskan ke Firestore untuk analitik pusat guru.

## Bank soalan
- Bab 1: 32
- Bab 2: 41
- Bab 3: 28
- Bab 4: 38
- Bab 5: 60
- Bab 6: 38
- Bab 7: 48
- Bab 8: 33
- Bab 9: 35
- Bab 10: 37
- **Jumlah: 390/390**

Pilihan jawapan diacak pada setiap sesi supaya jawapan betul tidak kekal pada posisi yang sama.

## Fungsi murid
- Akses nama + kelas + kod kelas
- Kod kelas boleh disahkan melalui Firestore apabila Firebase aktif
- Latihan Bab 1–10, 20 soalan rawak
- Campuran aras Mudah / Sederhana / KBAT
- Maklum balas dan penerangan serta-merta
- Latih Tubi Pantas 10 / 15 / 20 soalan
- Cabaran UASA 30 soalan
- Pemulihan pintar berdasarkan subtopik yang kerap salah
- Mata Ilmu, markah terbaik dan sejarah percubaan
- Mod Aplikasi Geografi dengan stimulus SVG
- Item hotspot untuk grid dan zon iklim
- Rekod local-first dengan retry sync Firebase
- PWA + service worker + ikon 192/512
- Pertukaran murid pada peranti berkongsi tanpa mencampurkan kemajuan

## Fungsi guru
- Google Sign-in
- Analitik kelas dan bab
- Purata, kadar ≥60%, bilangan murid dan percubaan
- Subtopik paling lemah
- Analisis item yang paling kerap salah
- Eksport CSV
- Pengurusan kod kelas Firestore
- Paparan 390 item bank aktif

## Stimulus visual
Stimulus SVG dibina semula khusus untuk GeoBoost: skala & jarak, grid/topografi, putaran dan peredaran bumi, graf iklim Malaysia, monsun, pengangkutan Malaysia, telekomunikasi, zon iklim Asia, pengangkutan Asia, kesan rumah hijau dan teknologi hijau.

## Jalankan secara lokal
```bash
npm install
npm run qa
npm run dev
```

## Firebase
Salin `.env.example` kepada `.env.local`, isi konfigurasi Firebase Web App dan ikuti `firebase/SETUP.md`.

## Vercel
Ikuti `DEPLOY.md`. Projek Vercel disarankan menggunakan nama `geoboost-tingkatan-2`.

## QA
```bash
npm run bank:check
npm run production:check
npm run qa
npm run build
```
`bank:check` mengesahkan jumlah 390, ID unik, prompt unik, jawapan sah dan agihan setiap bab. `production:check` mengesahkan fail production utama, aset PWA dan pengacakan pilihan jawapan.

## Nota Visual
- Nota visual Bab 1–10: Nota Pantas, Poster, Slide dan Peta/Rajah.
- Murid boleh menjejak bahagian yang telah dilihat dan terus ke latihan selepas lengkap.
- Panel guru mempunyai pengurusan Nota Visual untuk poster, imej, slide dan rajah tambahan.
- Imej tambahan dimampatkan kepada WebP (maksimum 480 KB setiap imej) dan disimpan dalam Firestore sedia ada; Firebase Cloud Storage tidak digunakan.
- Had dalaman pustaka media tambahan ditetapkan kepada 100 MB untuk memastikan penggunaan kekal ringan.

<!-- Production trigger: Nota Visual -->
