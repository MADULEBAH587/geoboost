# Deploy GeoBoost ke Firebase + Vercel

## 1. Vercel
Repository production menggunakan Next.js dan deploy automatik daripada branch `main`.

URL production:
`https://geoboost-tingkatan-2.vercel.app`

## 2. Firebase Authentication
Dalam projek Firebase `geoboost-tingkatan-2`, aktifkan:
- Anonymous — murid
- Google — guru

## 3. Aktifkan Firebase P1 dari GeoBoost
GeoBoost v2.1 menyediakan setup tanpa perlu menyalin rules secara manual ke Firebase Console.

1. Buka `/guru`.
2. Log masuk dengan akaun Google pemilik/editor projek Firebase.
3. Jika belum ada akaun guru, tekan **Aktifkan Admin + Firebase P1**.
4. Jika akaun admin sudah ada, buka **Tetapan → Firebase P1** dan tekan **Aktifkan Firebase P1**.
5. Luluskan consent Google/Firebase sekali sahaja.

Sistem menerbitkan Firestore Rules, menyediakan admin pertama, memigrasi kelas legacy kepada `ownerTeacherId`, memberi ID unik kepada roster dan menjana kod akses murid.

## 4. Ujian aliran production
Selepas P1 aktif:
- Guru: `/guru` → Google login → Control Center.
- Guru cipta kelas dan masukkan/import roster.
- Guru tekan **Salin Kod Akses** untuk mendapatkan PIN murid.
- Murid: `/murid` → kod kelas → pilih nama → PIN 6 digit.
- Guru terbitkan tugasan.
- Murid menjawab tugasan.
- Percubaan muncul di Ringkasan/Laporan dan aktiviti muncul di Live Monitoring.
- Had percubaan tugasan kekal walaupun murid menggunakan peranti lain selepas rekod diselaraskan.

## 5. Deploy manual kecemasan
Fail rules dan indexes masih disimpan dalam folder `firebase/`. Jika setup dalam aplikasi tidak boleh digunakan, Firebase CLI boleh digunakan:
```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --config firebase/firebase.json --only firestore:rules,firestore:indexes
```

## Nota Visual
Nota Visual menggunakan Firestore sahaja untuk media tambahan dan tidak memerlukan Firebase Storage. Kandungan terbina dalam Bab 1–10 berada terus dalam kod aplikasi.
