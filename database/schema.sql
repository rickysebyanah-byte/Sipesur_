-- ====================================================================
-- SIPESUR (Sistem Informasi Pelayanan Surat Kelurahan)
-- Database Schema for Supabase / PostgreSQL
-- Kelurahan Suka Maju, Kecamatan Medan Johor, Kota Medan
-- CATATAN: Untuk setup Supabase lengkap beserta fungsi RPC & akun demo,
-- gunakan database/setup_supabase.sql (atau jalankan database/seed.sql setelah file ini).
-- ====================================================================

DROP TABLE IF EXISTS surat_keluar CASCADE;
DROP TABLE IF EXISTS disposisi CASCADE;
DROP TABLE IF EXISTS surat_masuk CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS notifikasi CASCADE;
DROP TABLE IF EXISTS surat CASCADE;
DROP TABLE IF EXISTS persetujuan CASCADE;
DROP TABLE IF EXISTS verifikasi CASCADE;
DROP TABLE IF EXISTS dokumen CASCADE;
DROP TABLE IF EXISTS pengajuan CASCADE;
DROP TABLE IF EXISTS persyaratan CASCADE;
DROP TABLE IF EXISTS jenis_surat CASCADE;
DROP TABLE IF EXISTS warga CASCADE;
DROP TABLE IF EXISTS profil_desa CASCADE;
DROP TABLE IF EXISTS berita CASCADE;
DROP TABLE IF EXISTS umkm CASCADE;
DROP TABLE IF EXISTS galeri_kegiatan CASCADE;
DROP TABLE IF EXISTS anggaran CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Tabel users (Akun Warga, Petugas, Lurah, Admin)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  username VARCHAR(60) UNIQUE,
  nip VARCHAR(30) UNIQUE,
  jabatan VARCHAR(100),
  telepon VARCHAR(20),
  password VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'warga' CHECK (role IN ('warga', 'petugas', 'lurah', 'admin')),
  status_verifikasi VARCHAR(30) NOT NULL DEFAULT 'menunggu_verifikasi' CHECK (status_verifikasi IN ('menunggu_verifikasi', 'terverifikasi', 'ditolak')),
  catatan_verifikasi TEXT,
  diverifikasi_oleh INT REFERENCES users(id) ON DELETE SET NULL,
  diverifikasi_at TIMESTAMPTZ,
  must_change_password SMALLINT NOT NULL DEFAULT 0,
  tanda_tangan TEXT,
  reset_token VARCHAR(20),
  reset_expires_at TIMESTAMPTZ,
  aktif SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel profil warga lengkap
CREATE TABLE warga (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nik VARCHAR(16) UNIQUE NOT NULL,
  no_kk VARCHAR(16) NOT NULL,
  tempat_lahir VARCHAR(60),
  tanggal_lahir DATE,
  jenis_kelamin VARCHAR(5) CHECK (jenis_kelamin IN ('L', 'P')),
  alamat TEXT,
  pekerjaan VARCHAR(60),
  telepon VARCHAR(20)
);

-- 3. Tabel jenis surat kelurahan
CREATE TABLE jenis_surat (
  id SERIAL PRIMARY KEY,
  kode VARCHAR(10) UNIQUE NOT NULL,
  nama VARCHAR(100) NOT NULL,
  template TEXT,
  form_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  aktif SMALLINT NOT NULL DEFAULT 1
);

-- 4. Tabel dokumen persyaratan tiap jenis surat
CREATE TABLE persyaratan (
  id SERIAL PRIMARY KEY,
  jenis_surat_id INT NOT NULL REFERENCES jenis_surat(id) ON DELETE CASCADE,
  nama VARCHAR(100) NOT NULL
);

-- 5. Tabel pengajuan permohonan surat
CREATE TABLE pengajuan (
  id SERIAL PRIMARY KEY,
  kode VARCHAR(20) UNIQUE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jenis_surat_id INT NOT NULL REFERENCES jenis_surat(id),
  data_form JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',
    'under_review',
    'revision_required',
    'pending_approval',
    'rejected',
    'approved',
    'issued'
  )),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trigger untuk update updated_at otomatis pada tabel pengajuan
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pengajuan_updated_at ON pengajuan;
CREATE TRIGGER trigger_pengajuan_updated_at
BEFORE UPDATE ON pengajuan
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 6. Tabel berkas dokumen yang diunggah pemohon
CREATE TABLE dokumen (
  id SERIAL PRIMARY KEY,
  pengajuan_id INT NOT NULL REFERENCES pengajuan(id) ON DELETE CASCADE,
  persyaratan_id INT NOT NULL REFERENCES persyaratan(id),
  nama_file VARCHAR(200),
  path VARCHAR(255),
  mime VARCHAR(50),
  file_data TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabel riwayat verifikasi berkas oleh petugas
CREATE TABLE verifikasi (
  id SERIAL PRIMARY KEY,
  pengajuan_id INT NOT NULL REFERENCES pengajuan(id) ON DELETE CASCADE,
  petugas_id INT NOT NULL REFERENCES users(id),
  hasil VARCHAR(20) NOT NULL CHECK (hasil IN ('lengkap', 'revisi', 'ditolak')),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabel riwayat persetujuan oleh Lurah
CREATE TABLE persetujuan (
  id SERIAL PRIMARY KEY,
  pengajuan_id INT NOT NULL REFERENCES pengajuan(id) ON DELETE CASCADE,
  lurah_id INT NOT NULL REFERENCES users(id),
  hasil VARCHAR(20) NOT NULL CHECK (hasil IN ('setuju', 'tolak')),
  tanda_tangan TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabel surat resmi yang telah diterbitkan
CREATE TABLE surat (
  id SERIAL PRIMARY KEY,
  pengajuan_id INT UNIQUE NOT NULL REFERENCES pengajuan(id),
  nomor VARCHAR(60) UNIQUE NOT NULL,
  kode_verifikasi VARCHAR(40) UNIQUE NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  petugas_id INT NOT NULL REFERENCES users(id),
  lurah_nama VARCHAR(100),
  lurah_nip VARCHAR(30),
  tanda_tangan TEXT,
  kop_data JSONB,
  terbit_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Tabel profil desa & kop surat dinamis
CREATE TABLE profil_desa (
  id SERIAL PRIMARY KEY,
  nama_desa VARCHAR(100) NOT NULL DEFAULT 'Kelurahan Suka Maju',
  kecamatan VARCHAR(100) NOT NULL DEFAULT 'Kecamatan Medan Johor',
  kabupaten_kota VARCHAR(100) NOT NULL DEFAULT 'Pemerintah Kota Medan',
  provinsi VARCHAR(100) NOT NULL DEFAULT 'Sumatera Utara',
  alamat TEXT NOT NULL DEFAULT 'Jl. STM No. 40, Kelurahan Suka Maju',
  kode_pos VARCHAR(10) NOT NULL DEFAULT '20146',
  telepon VARCHAR(30) NOT NULL DEFAULT '0823-4123-5734',
  email VARCHAR(100) NOT NULL DEFAULT 'kelurahan@pemkomedan.go.id',
  website VARCHAR(100) NOT NULL DEFAULT 'sukamaju.medan.go.id',
  logo_url TEXT,
  hero_bg_urls TEXT,
  nama_lurah VARCHAR(100) NOT NULL DEFAULT 'Muhammad Iqbal Samosir, S.E., M.A.P.',
  nip_lurah VARCHAR(30) NOT NULL DEFAULT '198506122010011005',
  jabatan_lurah VARCHAR(100) NOT NULL DEFAULT 'Lurah Suka Maju',
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Tabel notifikasi pengguna
CREATE TABLE notifikasi (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pesan VARCHAR(255) NOT NULL,
  dibaca SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Tabel log aktivitas audit sistem
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  aksi VARCHAR(60) NOT NULL,
  detail VARCHAR(255),
  ip VARCHAR(60),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. Tabel berita & pengumuman kelurahan
CREATE TABLE berita (
  id SERIAL PRIMARY KEY,
  judul VARCHAR(255) NOT NULL,
  isi TEXT NOT NULL,
  kategori VARCHAR(50) DEFAULT 'Pengumuman',
  tanggal DATE DEFAULT CURRENT_DATE,
  penulis_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. Tabel direktori UMKM lokal
CREATE TABLE umkm (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(150) NOT NULL,
  jenis VARCHAR(80),
  alamat TEXT,
  telepon VARCHAR(50),
  deskripsi TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. Tabel galeri kegiatan warga & kelurahan
CREATE TABLE galeri_kegiatan (
  id SERIAL PRIMARY KEY,
  judul VARCHAR(200) NOT NULL,
  deskripsi TEXT,
  url_foto TEXT NOT NULL,
  tanggal DATE DEFAULT CURRENT_DATE,
  penulis_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. Tabel transparansi anggaran kelurahan
CREATE TABLE anggaran (
  id SERIAL PRIMARY KEY,
  tahun INT NOT NULL,
  program VARCHAR(255) NOT NULL,
  pagu NUMERIC(15,2) DEFAULT 0,
  realisasi NUMERIC(15,2) DEFAULT 0,
  sumber VARCHAR(100) DEFAULT 'APBD Kota Medan',
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 17. Tabel surat masuk (agenda dinas kelurahan)
CREATE TABLE surat_masuk (
  id SERIAL PRIMARY KEY,
  nomor_surat VARCHAR(100) NOT NULL,
  pengirim VARCHAR(150) NOT NULL,
  tanggal_surat DATE NOT NULL,
  perihal VARCHAR(255) NOT NULL,
  ringkasan_isi TEXT,
  file_lampiran VARCHAR(255),
  dicatat_oleh INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'menunggu_disposisi',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 18. Tabel lembar disposisi lurah
CREATE TABLE disposisi (
  id SERIAL PRIMARY KEY,
  surat_masuk_id INT NOT NULL REFERENCES surat_masuk(id) ON DELETE CASCADE,
  diberikan_oleh INT REFERENCES users(id) ON DELETE SET NULL,
  tujuan_disposisi VARCHAR(100) NOT NULL,
  sifat VARCHAR(30) DEFAULT 'biasa',
  arahan TEXT NOT NULL,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 19. Tabel surat keluar (surat dinas kelurahan)
CREATE TABLE surat_keluar (
  id SERIAL PRIMARY KEY,
  surat_masuk_id INT REFERENCES surat_masuk(id) ON DELETE SET NULL,
  nomor_surat VARCHAR(100) NOT NULL,
  tujuan VARCHAR(150) NOT NULL,
  perihal VARCHAR(255) NOT NULL,
  isi_surat TEXT NOT NULL,
  tanggal_surat DATE DEFAULT CURRENT_DATE,
  file_path VARCHAR(255),
  petugas_id INT REFERENCES users(id) ON DELETE SET NULL,
  ditandatangani_oleh INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indeks untuk performa query
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_nip ON users(nip);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status_verifikasi ON users(status_verifikasi);
CREATE INDEX IF NOT EXISTS idx_warga_nik ON warga(nik);
CREATE INDEX IF NOT EXISTS idx_warga_no_kk ON warga(no_kk);
CREATE INDEX IF NOT EXISTS idx_pengajuan_user ON pengajuan(user_id);
CREATE INDEX IF NOT EXISTS idx_pengajuan_status ON pengajuan(status);
CREATE INDEX IF NOT EXISTS idx_notifikasi_user ON notifikasi(user_id);
CREATE INDEX IF NOT EXISTS idx_surat_kode_verifikasi ON surat(kode_verifikasi);
CREATE INDEX IF NOT EXISTS idx_berita_tanggal ON berita(tanggal);
CREATE INDEX IF NOT EXISTS idx_surat_masuk_nomor ON surat_masuk(nomor_surat);
CREATE INDEX IF NOT EXISTS idx_surat_keluar_nomor ON surat_keluar(nomor_surat);
