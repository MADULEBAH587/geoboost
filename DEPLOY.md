# Deploy GeoBoost ke Firebase + Vercel

## 1. Firebase
1. Cipta projek baharu di Firebase Console.
2. Tambah **Web App**.
3. Authentication → Sign-in method → aktifkan **Anonymous** dan **Google**.
4. Firestore Database → Create database → Production mode.
5. Salin konfigurasi Web App ke `.env.local` atau Vercel Environment Variables:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
6. Deploy rules dan indexes dalam folder `firebase/`.

Contoh dengan Firebase CLI:
```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --config firebase/firebase.json --only firestore:rules,firestore:indexes,storage
```

## 2. Akaun guru pertama
1. Deploy aplikasi dahulu atau jalankan secara lokal.
2. Buka `/guru` dan log masuk menggunakan Google.
3. Salin UID guru yang dipaparkan jika akses belum diberikan.
4. Di Firestore, cipta dokumen `teachers/{UID}` dengan contoh medan:
```json
{
  "name": "Cikgu Zulhasif",
  "email": "email-guru@example.com"
}
```
5. Log masuk semula di `/guru`.

## 3. Kelas
Dalam Panel Guru, tambah nama kelas dan kod seperti `2E` / `2E26`. Murid yang memasukkan kod kelas akan disahkan terhadap dokumen `classes/{KOD}`.

## 4. Vercel
Import repository/folder GeoBoost sebagai projek baharu, pilih Next.js, tambah keenam-enam environment variables Firebase, kemudian deploy.

Jika menggunakan Vercel CLI:
```bash
npx vercel
npx vercel --prod
```

## 5. Semakan selepas deploy
- `/` dashboard terbuka
- `/murid` boleh simpan profil
- Bab 1–10 boleh mula latihan
- pilihan jawapan berubah kedudukan antara sesi
- `/guru` boleh log masuk Google selepas UID didaftarkan
- kelas boleh dicipta dan kod kelas murid boleh disahkan
- keputusan murid muncul di panel guru
- PWA boleh ditambah ke Home Screen
