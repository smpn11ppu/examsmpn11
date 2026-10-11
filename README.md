# CBTKU — Aplikasi Ujian Online Terproteksi

Aplikasi Ujian Online Terproteksi berbasis web untuk institusi pendidikan dengan pengelolaan ujian terpusat, pengacakan soal & opsi per sesi, autosave real-time dengan pemulihan sinkronisasi offline, pencatatan pelanggaran integritas (proctoring), dan dukungan penuh **Safe Exam Browser (SEB)**.

---

## 🚀 Fitur Unggulan Sesuai PRD v1.0

1. **Autentikasi & Manajemen Akun**
   - Peran **Admin** dan **Murid**.
   - Admin default: `admin` / `admin` (Wajib ganti password saat login pertama).
   - Murid default: `siswa01` / `siswa11` (Wajib ganti password saat login pertama).
   - Hash password aman (`bcryptjs`), cookie HTTP-only, dan pembatasan percobaan login (Rate Limiting).

2. **Manajemen Kelas & Murid**
   - CRUD data kelas dengan penghitungan jumlah peserta didik.
   - CRUD data murid dengan status aktif/nonaktif dan reset password ke `siswa11`.
   - **Impor Massal Excel (.xlsx) / CSV** dengan template unduhan, validasi kolom, dan laporan baris sukses/gagal.

3. **Mata Pelajaran & Bank Soal (5 Tipe Soal)**
   - CRUD mata pelajaran dan kurikulum.
   - Bank soal mendukung **5 jenis soal**:
     1. **Pilihan Ganda (Single Choice)**
     2. **Pilihan Ganda Kompleks (Multi-Select)**
     3. **Benar / Salah (True / False)**
     4. **Menjodohkan (Matching Pairs)**
     5. **Esai / Uraian (Essay with Rubric)**
   - Kunci jawaban dirahasiakan di server dan tidak pernah dikirim ke browser murid selama ujian.
   - Pratinjau soal (Question Preview) langsung dari bank soal.

4. **Pengaturan Ujian & Token Real-time**
   - Pengaturan jadwal mulai & berakhir, durasi ujian (menit), batas percobaan, dan target kelas.
   - Mode keamanan: **Browser Biasa Terproteksi** atau **Safe Exam Browser (SEB)**.
   - Opsi pengacakan urutan soal dan pengacakan opsi pilihan ganda tersimpan per sesi murid (konsisten saat refresh).
   - Generator Token ujian (6 karakter) dengan masa aktif dan pembatasan pemakaian.

5. **Mesin Pengerjaan Ujian (Workstation)**
   - **Timer Sinkron Server**: Menghitung mundur berdasarkan waktu server (tahan manipulasi jam perangkat). Auto-submit saat waktu habis.
   - **Autosave Real-time**: Indikator status visual (*Menyimpan...*, *Tersimpan di server*, *Offline / Disimpan lokal*).
   - **Resiliensi Jaringan**: Penyimpanan lokal sementara saat koneksi terputus dan sinkronisasi otomatis idempoten saat online kembali.
   - **Navigasi Soal**: Penanda status warna (*Sudah dijawab: Hijau*, *Ragu-ragu: Kuning*, *Belum dijawab: Abu-abu*).

6. **Pengawasan Integritas & Deteksi Pelanggaran (Live Proctoring)**
   - Pemantauan live status pengerjaan setiap siswa dengan auto-refresh setiap 5 detik.
   - Deteksi otomatis:
     - Perpindahan tab peramban (*tab switch*)
     - Kehilangan fokus jendela (*window blur*)
     - Keluar dari mode layar penuh (*fullscreen exit*)
     - Upaya klik kanan / salin-tempel (*context menu & shortcut blocking*)
   - Modal peringatan dengan pencatatan jumlah pelanggaran real-time di server pengawas.
   - Aksi pengawas: **Paksa Kumpul** dan **Reset Sesi**.

7. **Koreksi Esai & Penilaian Otomatis**
   - Penilaian otomatis untuk soal objektif (Pilihan Ganda, Multi-Select, Benar/Salah, Menjodohkan).
   - Antarmuka koreksi esai manual untuk guru dilengkapi acuan jawaban dan rubrik penilaian.
   - Kendali rilis/publikasi nilai ke murid (manual atau otomatis).

8. **Ekspor Laporan Hasil & Log Integritas**
   - Ekspor nilai lengkap ke format **Excel (.xlsx)** dan **CSV**.
   - Ekspor kronologi log pelanggaran ke format **Excel (.xlsx)** dan **CSV**.

9. **Dukungan Safe Exam Browser (SEB)**
   - Generator file konfigurasi `.seb` XML siap unduh untuk kiosk mode.
   - Deteksi User-Agent & SEB verification header.

---

## 🛠️ Panduan Menjalankan Aplikasi

### Persyaratan Sistem
- Node.js versi 20+ (Termasuk Node.js v24 yang terpasang di sistem ini)
- Menggunakan built-in `node:sqlite` (Zero external native dependency / no Visual Studio C++ needed)

### Menjalankan Server & Antarmuka (Development)
```powershell
# Di folder root d:\CBTKU
npm run dev
```
Aplikasi akan aktif pada:
- **Frontend (Vite UI)**: `http://localhost:3000/`
- **Backend API Server**: `http://localhost:5000/`

### Kredensial Pengujian Awal

| Peran | Username | Password Awal | Keterangan |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin` | Wajib ganti password saat login pertama |
| **Siswa 1** | `siswa01` | `siswa11` | Budi Santoso (Kelas X IPA 1) |
| **Siswa 2** | `siswa02` | `siswa11` | Siti Rahmawati (Kelas X IPA 1) |
| **Token Ujian** | `CBT2026` | - | Token aktif ujian simulasi Biologi |
