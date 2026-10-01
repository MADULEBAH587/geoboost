# Firebase production setup — GeoBoost v1.1

GeoBoost menggunakan pendekatan **local-first**. Tanpa Firebase, latihan masih berfungsi dan keputusan disimpan pada peranti. Dengan Firebase, profil murid, cubaan dan analitik guru diselaraskan secara pusat.

## Authentication
Aktifkan:
- Anonymous — untuk murid
- Google — untuk guru

## Firestore
Cipta Cloud Firestore dalam Production mode, kemudian deploy:
- `firestore.rules`
- `firestore.indexes.json`

## Storage
`storage.rules` disediakan untuk aset tambahan pada masa hadapan. Stimulus utama v1.1 dibina sebagai SVG dalam aplikasi, jadi Storage bukan keperluan operasi asas.

## Environment variables
Salin nilai Web App Firebase ke:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Struktur koleksi
- `students/{firebaseUid}` — profil murid anonymous
- `attempts/{attemptId}` — markah, tempoh, subtopik lemah dan respons item
- `teachers/{googleUid}` — allowlist guru
- `classes/{classCode}` — nama kelas + kod kelas aktif
- `questions/`, `chapters/`, `settings/` — disediakan untuk peluasan sistem

## Akaun guru pertama
1. Guru log masuk Google di `/guru`.
2. Jika belum dibenarkan, UI akan memaparkan UID.
3. Cipta dokumen `teachers/{UID}` secara manual di Firebase Console.
4. Medan cadangan: `name`, `email`.
5. Log keluar dan masuk semula.

## Kod kelas
Selepas guru diberi akses, cipta kelas melalui Panel Guru. Kod kelas menjadi ID dokumen dalam `classes`. Murid yang mengetahui kod boleh mengesahkannya melalui operasi `get` tanpa dapat menyenaraikan semua kelas.

## Keselamatan v1.1
- Murid hanya membaca/mengemas kini profil sendiri.
- Murid hanya membaca cubaan yang dimiliki oleh UID Firebase sendiri.
- Cubaan divalidasi untuk jenis medan, julat peratus dan hubungan `score <= total`.
- Senarai semua kelas dan semua keputusan hanya boleh dibaca guru yang tersenarai dalam `teachers`.
- Halaman guru tidak dicache oleh service worker.
- PIN murid tidak dihantar ke Firestore.
