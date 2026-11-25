-- ====================================================================
-- SIPESUR - Seed Data Resmi Kelurahan Suka Maju
-- Kecamatan Medan Johor, Kota Medan, Sumatera Utara
-- Password semua akun: Password123
-- Jalankan file ini di: Supabase Dashboard > SQL Editor > New Query
-- ====================================================================

-- Bersihkan data lama (urutan aman CASCADE)
TRUNCATE TABLE surat_keluar, disposisi, surat_masuk, activity_logs, notifikasi,
  surat, persetujuan, verifikasi, dokumen, pengajuan, persyaratan, jenis_surat,
  warga, profil_desa, berita, umkm, galeri_kegiatan, anggaran, users
  RESTART IDENTITY CASCADE;

-- ============================================================
-- 1. AKUN PENGGUNA (users)
-- password: Password123 (bcrypt hash)
-- ============================================================
INSERT INTO users (nama, email, username, nip, jabatan, telepon, password, role, status_verifikasi, must_change_password, aktif) VALUES
(
  'Admin IT Kelurahan',
  'admin@sipesur.test',
  'admin',
  '198001012005011001',
  'Pranata Komputer / IT Administrator Sistem',
  '081234567890',
  '$2a$10$fop9mOwiRNzSlxn31y5Hf.edXRoDUndD9IhVf5OhC8X3215F5QU2W',
  'admin',
  'terverifikasi',
  0,
  1
),
(
  'Siti Rohmah, S.AP',
  'petugas@sipesur.test',
  'petugas',
  '198505122010012003',
  'Petugas Pelayanan Administrasi',
  '081234567891',
  '$2a$10$fop9mOwiRNzSlxn31y5Hf.edXRoDUndD9IhVf5OhC8X3215F5QU2W',
  'petugas',
  'terverifikasi',
  0,
  1
),
(
  'Muhammad Iqbal Samosir, S.E., M.A.P.',
  'lurah@sipesur.test',
  'lurah',
  '198506122010011005',
  'Lurah Suka Maju',
  '0823-4123-5734',
  '$2a$10$fop9mOwiRNzSlxn31y5Hf.edXRoDUndD9IhVf5OhC8X3215F5QU2W',
  'lurah',
  'terverifikasi',
  0,
  1
),
(
  'Budi Santoso',
  'warga@sipesur.test',
  '3201010101900001',
  NULL,
  NULL,
  '081200000001',
  '$2a$10$fop9mOwiRNzSlxn31y5Hf.edXRoDUndD9IhVf5OhC8X3215F5QU2W',
  'warga',
  'terverifikasi',
  0,
  1
),
(
  'Ahmad Pratama',
  'ahmad.pratama@gmail.com',
  '3201010202950001',
  NULL,
  NULL,
  '081200000002',
  '$2a$10$fop9mOwiRNzSlxn31y5Hf.edXRoDUndD9IhVf5OhC8X3215F5QU2W',
  'warga',
  'menunggu_verifikasi',
  0,
  1
);

-- ============================================================
-- 2. DATA PROFIL WARGA (warga)
-- ============================================================
INSERT INTO warga (user_id, nik, no_kk, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, pekerjaan, telepon)
SELECT id, '3201010101900001', '3201010101900002', 'Medan', '1990-01-01', 'L',
  'Jl. STM No. 15 RT 02/RW 03, Kelurahan Suka Maju, Medan Johor', 'Karyawan Swasta', '081200000001'
FROM users WHERE username = '3201010101900001';

INSERT INTO warga (user_id, nik, no_kk, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, pekerjaan, telepon)
SELECT id, '3201010202950001', '3201010202950002', 'Medan', '1995-02-02', 'L',
  'Jl. Sakti Lubis No. 12 RT 01/RW 04, Kelurahan Suka Maju, Medan Johor', 'Wiraswasta', '081200000002'
FROM users WHERE username = '3201010202950001';

-- ============================================================
-- 3. PROFIL DESA & KOP SURAT DINAMIS (profil_desa)
-- ============================================================
INSERT INTO profil_desa (id, nama_desa, kecamatan, kabupaten_kota, provinsi, alamat, kode_pos, telepon, email, website, nama_lurah, nip_lurah, jabatan_lurah)
VALUES (1, 'Kelurahan Suka Maju', 'Kecamatan Medan Johor', 'Pemerintah Kota Medan', 'Sumatera Utara', 'Jl. STM No. 40, Kelurahan Suka Maju', '20146', '0823-4123-5734', 'kelurahan@pemkomedan.go.id', 'sukamaju.medan.go.id', 'Muhammad Iqbal Samosir, S.E., M.A.P.', '198506122010011005', 'Lurah Suka Maju')
ON CONFLICT (id) DO UPDATE SET
  nama_desa = EXCLUDED.nama_desa,
  kecamatan = EXCLUDED.kecamatan,
  kabupaten_kota = EXCLUDED.kabupaten_kota,
  provinsi = EXCLUDED.provinsi,
  alamat = EXCLUDED.alamat,
  kode_pos = EXCLUDED.kode_pos,
  telepon = EXCLUDED.telepon,
  email = EXCLUDED.email,
  website = EXCLUDED.website,
  nama_lurah = EXCLUDED.nama_lurah,
  nip_lurah = EXCLUDED.nip_lurah,
  jabatan_lurah = EXCLUDED.jabatan_lurah;

-- ============================================================
-- 4. JENIS SURAT & PERSYARATAN (jenis_surat, persyaratan)
-- ============================================================
INSERT INTO jenis_surat (kode, nama, template, form_fields, aktif) VALUES
('SKD', 'Surat Keterangan Domisili',
 'Orang tersebut benar berdomisili di wilayah Kelurahan Suka Maju.',
 '[{"name":"alamat_domisili","label":"Alamat Domisili"},{"name":"lama_tinggal","label":"Lama Tinggal"},{"name":"keperluan","label":"Keperluan"}]'::jsonb,
 1),
('SKTM', 'Surat Keterangan Tidak Mampu',
 'Orang tersebut benar tergolong keluarga kurang mampu.',
 '[{"name":"penghasilan","label":"Penghasilan per Bulan"},{"name":"jumlah_tanggungan","label":"Jumlah Tanggungan"},{"name":"keperluan","label":"Keperluan"}]'::jsonb,
 1),
('SKCK', 'Surat Pengantar SKCK',
 'Orang tersebut berkelakuan baik dan diberi pengantar untuk pengurusan SKCK.',
 '[{"name":"agama","label":"Agama"},{"name":"status_perkawinan","label":"Status Perkawinan"},{"name":"keperluan","label":"Keperluan"}]'::jsonb,
 1),
('SKU', 'Surat Keterangan Usaha',
 'Orang tersebut benar memiliki usaha di wilayah Kelurahan Suka Maju.',
 '[{"name":"nama_usaha","label":"Nama Usaha"},{"name":"jenis_usaha","label":"Jenis Usaha"},{"name":"alamat_usaha","label":"Alamat Usaha"},{"name":"lama_usaha","label":"Lama Usaha"}]'::jsonb,
 1),
('SKLH', 'Surat Keterangan Kelahiran',
 'Telah terjadi kelahiran sebagaimana data di atas.',
 '[{"name":"nama_bayi","label":"Nama Bayi"},{"name":"tempat_lahir_bayi","label":"Tempat Lahir Bayi"},{"name":"tanggal_lahir_bayi","label":"Tanggal Lahir Bayi"},{"name":"nama_ayah","label":"Nama Ayah"},{"name":"nama_ibu","label":"Nama Ibu"}]'::jsonb,
 1),
('SKM', 'Surat Keterangan Kematian',
 'Telah terjadi kematian sebagaimana data di atas.',
 '[{"name":"nama_almarhum","label":"Nama Almarhum"},{"name":"nik_almarhum","label":"NIK Almarhum"},{"name":"tanggal_meninggal","label":"Tanggal Meninggal"},{"name":"penyebab","label":"Penyebab"},{"name":"hubungan_pelapor","label":"Hubungan Pelapor"}]'::jsonb,
 1),
('SKBM', 'Surat Keterangan Belum Menikah',
 'Orang tersebut sampai saat ini belum pernah menikah.',
 '[{"name":"agama","label":"Agama"},{"name":"keperluan","label":"Keperluan"}]'::jsonb,
 1),
('SPP', 'Surat Pengantar Pindah',
 'Orang tersebut bermaksud pindah domisili sebagaimana data di atas.',
 '[{"name":"alamat_tujuan","label":"Alamat Tujuan"},{"name":"alasan_pindah","label":"Alasan Pindah"},{"name":"jumlah_pengikut","label":"Jumlah Pengikut"}]'::jsonb,
 1);

INSERT INTO persyaratan (jenis_surat_id, nama) VALUES
((SELECT id FROM jenis_surat WHERE kode='SKD'), 'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SKD'), 'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKD'), 'Surat Pengantar RT/RW'),
((SELECT id FROM jenis_surat WHERE kode='SKTM'), 'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SKTM'), 'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKTM'), 'Surat Pengantar RT/RW'),
((SELECT id FROM jenis_surat WHERE kode='SKCK'), 'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SKCK'), 'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKCK'), 'Pas Foto'),
((SELECT id FROM jenis_surat WHERE kode='SKU'), 'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SKU'), 'Foto Tempat Usaha'),
((SELECT id FROM jenis_surat WHERE kode='SKU'), 'Surat Pengantar RT/RW'),
((SELECT id FROM jenis_surat WHERE kode='SKLH'), 'KTP Pelapor'),
((SELECT id FROM jenis_surat WHERE kode='SKLH'), 'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKLH'), 'Surat Keterangan Lahir (Bidan/RS)'),
((SELECT id FROM jenis_surat WHERE kode='SKM'), 'KTP Pelapor'),
((SELECT id FROM jenis_surat WHERE kode='SKM'), 'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKM'), 'Surat Keterangan Kematian (RS/RT)'),
((SELECT id FROM jenis_surat WHERE kode='SKBM'), 'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SKBM'), 'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKBM'), 'Surat Pengantar RT/RW'),
((SELECT id FROM jenis_surat WHERE kode='SPP'), 'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SPP'), 'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SPP'), 'Pas Foto');

-- ============================================================
-- 5. BERITA, UMKM, GALERI & ANGGARAN
-- ============================================================
INSERT INTO berita (judul, isi, kategori, tanggal) VALUES
('Pawai Ta’aruf MTQ ke-59 Tingkat Kota Medan',
 'Lurah Tanjung Sari didampingi jajaran kelurahan turut ambil bagian dalam kemeriahan Pawai Ta’aruf MTQ ke-59 tingkat Kota Medan. Semangat MTQ bukan hanya tentang kompetisi, tetapi juga mempererat ukhuwah, memperkuat nilai keislaman, dan merajut persatuan dalam keberagaman.',
 'Berita', CURRENT_DATE),
('Jadwal Pelayanan Administrasi Kelurahan Suka Maju',
 'Diberitahukan kepada seluruh warga Kelurahan Suka Maju bahwa pelayanan administrasi surat-menyurat di kantor kelurahan dibuka setiap hari Senin hingga Jumat pukul 08.00 - 15.30 WIB. Permohonan surat online melalui SIPESUR dapat diajukan 24 jam.',
 'Pengumuman', CURRENT_DATE);

INSERT INTO umkm (nama, jenis, alamat, telepon, deskripsi) VALUES
('Kopi Suka Maju', 'Kuliner / Minuman', 'Jl. STM No. 42, Medan Johor', '081234567890', 'Kedai kopi khas nusantara dengan biji kopi pilihan Sumatera.'),
('Kerajinan Anyaman Maju Bersama', 'Kerajinan Tangan', 'Jl. Sakti Lubis No. 8, Medan Johor', '081234567891', 'Produk kerajinan anyaman bambu dan rotan berkualitas ekspor.');

INSERT INTO galeri_kegiatan (judul, deskripsi, url_foto, tanggal) VALUES
('Gotong Royong Kebersihan Lingkungan', 'Kegiatan gotong royong warga membersihkan drainase dan fasilitas umum di lingkungan Kelurahan Suka Maju.', 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800', CURRENT_DATE);

INSERT INTO anggaran (tahun, program, pagu, realisasi, sumber, keterangan) VALUES
(2026, 'Program Pelayanan Administrasi Kependudukan', 75000000.00, 48500000.00, 'APBD Kota Medan', 'Operasional digitalisasi pelayanan surat');

-- ============================================================
-- 6. VERIFIKASI HASIL SEED
-- ============================================================
SELECT 'Seed SIPESUR berhasil 100%!' AS status;
SELECT 'users' AS tabel, COUNT(*) AS jumlah FROM users
UNION ALL SELECT 'warga', COUNT(*) FROM warga
UNION ALL SELECT 'profil_desa', COUNT(*) FROM profil_desa
UNION ALL SELECT 'jenis_surat', COUNT(*) FROM jenis_surat
UNION ALL SELECT 'persyaratan', COUNT(*) FROM persyaratan
UNION ALL SELECT 'berita', COUNT(*) FROM berita
UNION ALL SELECT 'umkm', COUNT(*) FROM umkm
UNION ALL SELECT 'galeri_kegiatan', COUNT(*) FROM galeri_kegiatan
UNION ALL SELECT 'anggaran', COUNT(*) FROM anggaran;
