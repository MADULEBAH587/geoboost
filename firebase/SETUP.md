# Firebase production setup — GeoBoost v2.1

GeoBoost menggunakan Firebase sebagai pusat hubungan **Guru → Kelas → Murid → Tugasan → Keputusan**. Aplikasi murid masih menyimpan rekod lokal sementara, tetapi identiti, tugasan dan keputusan rasmi diselaraskan ke Firestore.

## Authentication
Aktifkan:
- Anonymous — untuk murid
- Google — untuk guru

## Struktur P1
- `teachers/{googleUid}` — profil guru, `role`, `active`
- `classes/{classCode}` — kelas dengan `ownerTeacherId`, roster ber-ID unik dan tugasan
- `studentAccess/{classCode__studentId}` — kod akses 6 digit per murid, hanya boleh dibaca guru
- `studentClaims/{anonymousUid}` — pengesahan identiti murid
- `students/{anonymousUid}` — profil murid yang telah disahkan
- `attempts/{attemptId}` — keputusan, respons item, tempoh dan subtopik lemah
- `progress/{anonymousUid}` — status live murid

## Guru pertama / migrasi P1
Tidak perlu cipta dokumen guru secara manual di Firebase Console.

1. Buka `/guru` dan log masuk Google.
2. Jika akaun guru belum wujud, tekan **Aktifkan Admin + Firebase P1**.
3. Gunakan akaun Google yang mempunyai akses pemilik/editor kepada projek Firebase `geoboost-tingkatan-2`.
4. Benarkan kebenaran Firebase yang diminta sekali sahaja.
5. GeoBoost akan:
   - menerbitkan Firestore Rules P1;
   - mencipta/menaik taraf akaun guru sebagai `role: "admin"`, `active: true`;
   - menambah `ownerTeacherId` kepada kelas legacy;
   - menukar roster lama kepada ID murid kekal;
   - menjana kod akses 6 digit untuk setiap murid.

Jika akaun admin sudah wujud tetapi Rules P1 belum diterbitkan, buka **Tetapan → Firebase P1 → Aktifkan Firebase P1**.

## Aliran murid
1. Murid masukkan kod kelas / scan QR.
2. Pilih nama daripada roster guru.
3. Masukkan kod akses 6 digit yang diberi guru.
4. Firestore mengesahkan `studentId + classCode + PIN` sebelum profil boleh dicipta.
5. Cubaan, tugasan dan live progress selepas itu mesti sepadan dengan profil murid yang disahkan.

Guru boleh salin senarai kod melalui **Murid → Salin Kod Akses**.

## Pemilikan kelas
- Guru biasa hanya boleh menyenaraikan dan mengurus kelas yang `ownerTeacherId` sama dengan UID Google mereka.
- Admin boleh melihat semua kelas.
- Analitik, profil murid, keputusan dan live monitoring guru biasa turut ditapis mengikut kelas milik mereka.

## Had percubaan
Had cubaan tugasan dikira daripada gabungan rekod lokal dan Firestore. Tukar telefon atau clear browser tidak mengosongkan kiraan cubaan rasmi yang telah diselaraskan.

## Firestore Rules
Sumber utama:
- `firebase/firestore.rules`
- salinan deploy automatik: `public/firestore.rules.txt`

## Indexes
`firebase/firestore.indexes.json` diselaraskan dengan schema semasa:
- `studentId + completedAt`
- `localStudentId + completedAt`
- `classCode + completedAt`

## Environment variables
Web App Firebase boleh ditetapkan melalui Vercel:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Konfigurasi fallback projek production turut tersedia dalam `lib/firebase.ts`.

## Nota Visual tanpa Cloud Storage
GeoBoost tidak menggunakan Firebase Cloud Storage untuk Nota Visual. Poster, gambar dan slide tambahan dimampatkan di pelayar kepada WebP dan disimpan sebagai dokumen Firestore berasingan (`visualNoteAssets` + `visualNotePayloads`). Had dalaman aplikasi ialah 480 KB bagi setiap imej dan 100 MB bagi keseluruhan pustaka media tambahan.
