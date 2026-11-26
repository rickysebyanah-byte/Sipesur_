-- ====================================================================
-- SIPESUR - Setup Lengkap Supabase (Schema + Seed + RLS off + RPC)
-- Kelurahan Suka Maju, Kecamatan Medan Johor, Kota Medan
-- Jalankan seluruh file ini di:
--   Dashboard Supabase > SQL Editor > New Query > Paste > Run All
-- ====================================================================

-- ================================================================
-- 1. SCHEMA BERSIH (Urutan Drop Sesuai Relasi Foreign Key)
-- ================================================================
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
  role VARCHAR(20) NOT NULL DEFAULT 'warga'
    CHECK (role IN ('warga','petugas','lurah','admin')),
  status_verifikasi VARCHAR(30) NOT NULL DEFAULT 'menunggu_verifikasi'
    CHECK (status_verifikasi IN ('menunggu_verifikasi','terverifikasi','ditolak')),
  catatan_verifikasi TEXT,
  diverifikasi_oleh INT REFERENCES users(id) ON DELETE SET NULL,
  diverifikasi_at TIMESTAMPTZ,
  must_change_password SMALLINT NOT NULL DEFAULT 0,
  tanda_tangan TEXT,
  aktif SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel profil kependudukan warga
CREATE TABLE warga (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nik VARCHAR(16) UNIQUE NOT NULL,
  no_kk VARCHAR(16) NOT NULL,
  tempat_lahir VARCHAR(60),
  tanggal_lahir DATE,
  jenis_kelamin VARCHAR(5) CHECK (jenis_kelamin IN ('L','P')),
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

-- 4. Tabel dokumen persyaratan per jenis surat
CREATE TABLE persyaratan (
  id SERIAL PRIMARY KEY,
  jenis_surat_id INT NOT NULL REFERENCES jenis_surat(id) ON DELETE CASCADE,
  nama VARCHAR(100) NOT NULL
);

-- 5. Tabel pengajuan surat oleh warga
CREATE TABLE pengajuan (
  id SERIAL PRIMARY KEY,
  kode VARCHAR(20) UNIQUE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jenis_surat_id INT NOT NULL REFERENCES jenis_surat(id),
  data_form JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','revision_required',
                      'pending_approval','rejected','approved','issued')),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pengajuan_updated_at ON pengajuan;
CREATE TRIGGER trg_pengajuan_updated_at
  BEFORE UPDATE ON pengajuan
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Tabel dokumen berkas lampiran persyaratan
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

-- 7. Tabel riwayat verifikasi petugas
CREATE TABLE verifikasi (
  id SERIAL PRIMARY KEY,
  pengajuan_id INT NOT NULL REFERENCES pengajuan(id) ON DELETE CASCADE,
  petugas_id INT NOT NULL REFERENCES users(id),
  hasil VARCHAR(20) NOT NULL CHECK (hasil IN ('lengkap','revisi','ditolak')),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabel riwayat persetujuan lurah
CREATE TABLE persetujuan (
  id SERIAL PRIMARY KEY,
  pengajuan_id INT NOT NULL REFERENCES pengajuan(id) ON DELETE CASCADE,
  lurah_id INT NOT NULL REFERENCES users(id),
  hasil VARCHAR(20) NOT NULL CHECK (hasil IN ('setuju','tolak')),
  tanda_tangan TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabel surat resmi yang diterbitkan
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

-- 11. Tabel notifikasi
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

-- 15. Tabel galeri kegiatan kelurahan & warga
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

-- 17. Tabel surat masuk (agenda dinas)
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

-- Indeks performa
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_nip ON users(nip);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status_verifikasi);
CREATE INDEX IF NOT EXISTS idx_warga_nik ON warga(nik);
CREATE INDEX IF NOT EXISTS idx_warga_no_kk ON warga(no_kk);
CREATE INDEX IF NOT EXISTS idx_pengajuan_user ON pengajuan(user_id);
CREATE INDEX IF NOT EXISTS idx_pengajuan_status ON pengajuan(status);
CREATE INDEX IF NOT EXISTS idx_notifikasi_user ON notifikasi(user_id);
CREATE INDEX IF NOT EXISTS idx_surat_kode ON surat(kode_verifikasi);
CREATE INDEX IF NOT EXISTS idx_berita_tanggal ON berita(tanggal);
CREATE INDEX IF NOT EXISTS idx_surat_masuk_nomor ON surat_masuk(nomor_surat);
CREATE INDEX IF NOT EXISTS idx_surat_keluar_nomor ON surat_keluar(nomor_surat);

-- ================================================================
-- 2. NONAKTIFKAN ROW LEVEL SECURITY (Untuk Backend Node.js REST API)
-- ================================================================
ALTER TABLE users          DISABLE ROW LEVEL SECURITY;
ALTER TABLE warga          DISABLE ROW LEVEL SECURITY;
ALTER TABLE jenis_surat    DISABLE ROW LEVEL SECURITY;
ALTER TABLE persyaratan    DISABLE ROW LEVEL SECURITY;
ALTER TABLE pengajuan      DISABLE ROW LEVEL SECURITY;
ALTER TABLE dokumen        DISABLE ROW LEVEL SECURITY;
ALTER TABLE verifikasi     DISABLE ROW LEVEL SECURITY;
ALTER TABLE persetujuan    DISABLE ROW LEVEL SECURITY;
ALTER TABLE surat          DISABLE ROW LEVEL SECURITY;
ALTER TABLE profil_desa    DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifikasi     DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs  DISABLE ROW LEVEL SECURITY;
ALTER TABLE berita         DISABLE ROW LEVEL SECURITY;
ALTER TABLE umkm           DISABLE ROW LEVEL SECURITY;
ALTER TABLE galeri_kegiatan DISABLE ROW LEVEL SECURITY;
ALTER TABLE anggaran       DISABLE ROW LEVEL SECURITY;
ALTER TABLE surat_masuk    DISABLE ROW LEVEL SECURITY;
ALTER TABLE disposisi      DISABLE ROW LEVEL SECURITY;
ALTER TABLE surat_keluar   DISABLE ROW LEVEL SECURITY;

-- ================================================================
-- 3. FUNGSI RPC SUPABASE: Eksekusi SQL Aman via REST API
--    (Mendukung hingga 25 parameter secara dinamis)
-- ================================================================
CREATE OR REPLACE FUNCTION sipesur_exec(query text, params jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  param_array text[];
  i int;
  n int;
BEGIN
  n := jsonb_array_length(params);
  param_array := ARRAY[]::text[];
  FOR i IN 0..24 LOOP
    IF i < n THEN
      IF jsonb_typeof(params->i) = 'null' THEN
        param_array := array_append(param_array, NULL);
      ELSE
        param_array := array_append(param_array, (params->>i)::text);
      END IF;
    ELSE
      param_array := array_append(param_array, NULL);
    END IF;
  END LOOP;

  BEGIN
    EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query || ') t'
    INTO result
    USING param_array[1], param_array[2], param_array[3], param_array[4],
          param_array[5], param_array[6], param_array[7], param_array[8],
          param_array[9], param_array[10], param_array[11], param_array[12],
          param_array[13], param_array[14], param_array[15], param_array[16],
          param_array[17], param_array[18], param_array[19], param_array[20],
          param_array[21], param_array[22], param_array[23], param_array[24],
          param_array[25];
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SQL Error: % | Query: %', SQLERRM, left(query, 200);
  END;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION sipesur_insert(query text, params jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  param_array text[];
  i int;
  n int;
  insert_query text;
BEGIN
  n := jsonb_array_length(params);
  param_array := ARRAY[]::text[];
  FOR i IN 0..24 LOOP
    IF i < n THEN
      IF jsonb_typeof(params->i) = 'null' THEN
        param_array := array_append(param_array, NULL);
      ELSE
        param_array := array_append(param_array, (params->>i)::text);
      END IF;
    ELSE
      param_array := array_append(param_array, NULL);
    END IF;
  END LOOP;

  insert_query := query;
  IF position('RETURNING' IN upper(query)) = 0 THEN
    insert_query := query || ' RETURNING id';
  END IF;

  BEGIN
    EXECUTE 'WITH t AS (' || insert_query || ') SELECT jsonb_agg(row_to_json(t)) FROM t'
    INTO result
    USING param_array[1], param_array[2], param_array[3], param_array[4],
          param_array[5], param_array[6], param_array[7], param_array[8],
          param_array[9], param_array[10], param_array[11], param_array[12],
          param_array[13], param_array[14], param_array[15], param_array[16],
          param_array[17], param_array[18], param_array[19], param_array[20],
          param_array[21], param_array[22], param_array[23], param_array[24],
          param_array[25];
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SQL Error: % | Query: %', SQLERRM, left(query, 200);
  END;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION sipesur_mutate(query text, params jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  param_array text[];
  i int;
  n int;
  rc int;
BEGIN
  n := jsonb_array_length(params);
  param_array := ARRAY[]::text[];
  FOR i IN 0..24 LOOP
    IF i < n THEN
      IF jsonb_typeof(params->i) = 'null' THEN
        param_array := array_append(param_array, NULL);
      ELSE
        param_array := array_append(param_array, (params->>i)::text);
      END IF;
    ELSE
      param_array := array_append(param_array, NULL);
    END IF;
  END LOOP;

  BEGIN
    EXECUTE query
    USING param_array[1], param_array[2], param_array[3], param_array[4],
          param_array[5], param_array[6], param_array[7], param_array[8],
          param_array[9], param_array[10], param_array[11], param_array[12],
          param_array[13], param_array[14], param_array[15], param_array[16],
          param_array[17], param_array[18], param_array[19], param_array[20],
          param_array[21], param_array[22], param_array[23], param_array[24],
          param_array[25];
    GET DIAGNOSTICS rc = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SQL Error: % | Query: %', SQLERRM, left(query, 200);
  END;

  RETURN jsonb_build_object('rowCount', rc, 'affectedRows', rc);
END;
$$;

GRANT EXECUTE ON FUNCTION sipesur_exec(text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sipesur_insert(text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sipesur_mutate(text, jsonb) TO anon, authenticated, service_role;

-- ================================================================
-- 4. SEED DATA RESMI KELURAHAN SUKA MAJU
--    (Password semua akun: Password123)
-- ================================================================
INSERT INTO users (nama,email,username,nip,jabatan,telepon,password,role,status_verifikasi,must_change_password,aktif) VALUES
('Admin Kelurahan','admin@sipesur.test','admin','198001012005011001','Administrator Sistem','081234567890',
 '$2a$10$fop9mOwiRNzSlxn31y5Hf.edXRoDUndD9IhVf5OhC8X3215F5QU2W','admin','terverifikasi',0,1),
('Siti Rohmah, S.AP','petugas@sipesur.test','petugas','198505122010012003','Petugas Pelayanan Administrasi','081234567891',
 '$2a$10$fop9mOwiRNzSlxn31y5Hf.edXRoDUndD9IhVf5OhC8X3215F5QU2W','petugas','terverifikasi',0,1),
('Muhammad Iqbal Samosir, S.E., M.A.P.','lurah@sipesur.test','lurah','198506122010011005','Lurah Suka Maju','0823-4123-5734',
 '$2a$10$fop9mOwiRNzSlxn31y5Hf.edXRoDUndD9IhVf5OhC8X3215F5QU2W','lurah','terverifikasi',0,1),
('Budi Santoso','warga@sipesur.test','3201010101900001',NULL,NULL,'081200000001',
 '$2a$10$fop9mOwiRNzSlxn31y5Hf.edXRoDUndD9IhVf5OhC8X3215F5QU2W','warga','terverifikasi',0,1),
('Ahmad Pratama','ahmad.pratama@gmail.com','3201010202950001',NULL,NULL,'081200000002',
 '$2a$10$fop9mOwiRNzSlxn31y5Hf.edXRoDUndD9IhVf5OhC8X3215F5QU2W','warga','menunggu_verifikasi',0,1);

INSERT INTO warga (user_id,nik,no_kk,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,pekerjaan,telepon)
SELECT id,'3201010101900001','3201010101900002','Medan','1990-01-01','L',
       'Jl. STM No. 38 RT 02/RW 03 (Dekat Kantor Lurah), Kelurahan Suka Maju, Medan Johor','Karyawan Swasta','081200000001'
FROM users WHERE username='3201010101900001';

INSERT INTO warga (user_id,nik,no_kk,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,pekerjaan,telepon)
SELECT id,'3201010202950001','3201010202950002','Medan','1995-02-02','L',
       'Jl. Sakti Lubis No. 12 RT 01/RW 04, Kelurahan Suka Maju, Medan Johor','Wiraswasta','081200000002'
FROM users WHERE username='3201010202950001';

-- Profil Desa & Kop Surat Resmi
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

-- Jenis Surat & Persyaratan
INSERT INTO jenis_surat (kode,nama,template,form_fields,aktif) VALUES
('SKD','Surat Keterangan Domisili','Orang tersebut benar berdomisili di wilayah Kelurahan Suka Maju.',
 '[{"name":"alamat_domisili","label":"Alamat Domisili"},{"name":"lama_tinggal","label":"Lama Tinggal"},{"name":"keperluan","label":"Keperluan"}]'::jsonb,1),
('SKTM','Surat Keterangan Tidak Mampu','Orang tersebut benar tergolong keluarga kurang mampu.',
 '[{"name":"penghasilan","label":"Penghasilan per Bulan"},{"name":"jumlah_tanggungan","label":"Jumlah Tanggungan"},{"name":"keperluan","label":"Keperluan"}]'::jsonb,1),
('SKCK','Surat Pengantar SKCK','Orang tersebut berkelakuan baik dan diberi pengantar untuk pengurusan SKCK.',
 '[{"name":"agama","label":"Agama"},{"name":"status_perkawinan","label":"Status Perkawinan"},{"name":"keperluan","label":"Keperluan"}]'::jsonb,1),
('SKU','Surat Keterangan Usaha','Orang tersebut benar memiliki usaha di wilayah Kelurahan Suka Maju.',
 '[{"name":"nama_usaha","label":"Nama Usaha"},{"name":"jenis_usaha","label":"Jenis Usaha"},{"name":"alamat_usaha","label":"Alamat Usaha"},{"name":"lama_usaha","label":"Lama Usaha"}]'::jsonb,1),
('SKLH','Surat Keterangan Kelahiran','Telah terjadi kelahiran sebagaimana data di atas.',
 '[{"name":"nama_bayi","label":"Nama Bayi"},{"name":"tempat_lahir_bayi","label":"Tempat Lahir Bayi"},{"name":"tanggal_lahir_bayi","label":"Tanggal Lahir Bayi"},{"name":"nama_ayah","label":"Nama Ayah"},{"name":"nama_ibu","label":"Nama Ibu"}]'::jsonb,1),
('SKM','Surat Keterangan Kematian','Telah terjadi kematian sebagaimana data di atas.',
 '[{"name":"nama_almarhum","label":"Nama Almarhum"},{"name":"nik_almarhum","label":"NIK Almarhum"},{"name":"tanggal_meninggal","label":"Tanggal Meninggal"},{"name":"penyebab","label":"Penyebab"},{"name":"hubungan_pelapor","label":"Hubungan Pelapor"}]'::jsonb,1),
('SKBM','Surat Keterangan Belum Menikah','Orang tersebut sampai saat ini belum pernah menikah.',
 '[{"name":"agama","label":"Agama"},{"name":"keperluan","label":"Keperluan"}]'::jsonb,1),
('SPP','Surat Pengantar Pindah','Orang tersebut bermaksud pindah domisili sebagaimana data di atas.',
 '[{"name":"alamat_tujuan","label":"Alamat Tujuan"},{"name":"alasan_pindah","label":"Alasan Pindah"},{"name":"jumlah_pengikut","label":"Jumlah Pengikut"}]'::jsonb,1);

INSERT INTO persyaratan (jenis_surat_id,nama) VALUES
((SELECT id FROM jenis_surat WHERE kode='SKD'),'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SKD'),'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKD'),'Surat Pengantar RT/RW'),
((SELECT id FROM jenis_surat WHERE kode='SKTM'),'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SKTM'),'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKTM'),'Surat Pengantar RT/RW'),
((SELECT id FROM jenis_surat WHERE kode='SKCK'),'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SKCK'),'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKCK'),'Pas Foto'),
((SELECT id FROM jenis_surat WHERE kode='SKU'),'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SKU'),'Foto Tempat Usaha'),
((SELECT id FROM jenis_surat WHERE kode='SKU'),'Surat Pengantar RT/RW'),
((SELECT id FROM jenis_surat WHERE kode='SKLH'),'KTP Pelapor'),
((SELECT id FROM jenis_surat WHERE kode='SKLH'),'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKLH'),'Surat Keterangan Lahir (Bidan/RS)'),
((SELECT id FROM jenis_surat WHERE kode='SKM'),'KTP Pelapor'),
((SELECT id FROM jenis_surat WHERE kode='SKM'),'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKM'),'Surat Keterangan Kematian (RS/RT)'),
((SELECT id FROM jenis_surat WHERE kode='SKBM'),'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SKBM'),'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SKBM'),'Surat Pengantar RT/RW'),
((SELECT id FROM jenis_surat WHERE kode='SPP'),'KTP'),
((SELECT id FROM jenis_surat WHERE kode='SPP'),'Kartu Keluarga'),
((SELECT id FROM jenis_surat WHERE kode='SPP'),'Pas Foto');

-- Berita & Pengumuman Resmi
INSERT INTO berita (judul, isi, kategori, tanggal) VALUES
('Pawai Ta’aruf MTQ ke-59 Tingkat Kota Medan',
 'Lurah Tanjung Sari didampingi jajaran kelurahan turut ambil bagian dalam kemeriahan Pawai Ta’aruf MTQ ke-59 tingkat Kota Medan. Semangat MTQ bukan hanya tentang kompetisi, tetapi juga mempererat ukhuwah, memperkuat nilai keislaman, dan merajut persatuan dalam keberagaman.',
 'Berita', CURRENT_DATE),
('Jadwal Pelayanan Administrasi Kelurahan Suka Maju',
 'Diberitahukan kepada seluruh warga Kelurahan Suka Maju bahwa pelayanan administrasi surat-menyurat di kantor kelurahan dibuka setiap hari Senin hingga Jumat pukul 08.00 - 15.30 WIB. Permohonan surat online melalui SIPESUR dapat diajukan 24 jam.',
 'Pengumuman', CURRENT_DATE);

-- UMKM Warga
INSERT INTO umkm (nama, jenis, alamat, telepon, deskripsi) VALUES
('Kopi Suka Maju', 'Kuliner / Minuman', 'Jl. STM No. 42, Medan Johor', '081234567890', 'Kedai kopi khas nusantara dengan biji kopi pilihan Sumatera.'),
('Kerajinan Anyaman Maju Bersama', 'Kerajinan Tangan', 'Jl. Sakti Lubis No. 8, Medan Johor', '081234567891', 'Produk kerajinan anyaman bambu dan rotan berkualitas ekspor.');

-- Galeri Kegiatan
INSERT INTO galeri_kegiatan (judul, deskripsi, url_foto, tanggal) VALUES
('Gotong Royong Kebersihan Lingkungan', 'Kegiatan gotong royong warga membersihkan drainase dan fasilitas umum.', 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800', CURRENT_DATE);

-- Anggaran Transparansi
INSERT INTO anggaran (tahun, program, pagu, realisasi, sumber, keterangan) VALUES
(2026, 'Program Pelayanan Administrasi Kependudukan', 75000000.00, 48500000.00, 'APBD Kota Medan', 'Operasional digitalisasi pelayanan surat');

-- ================================================================
-- 5. VERIFIKASI AKHIR DATABASE
-- ================================================================
SELECT 'SIPESUR database siap dan tersinkronisasi 100%!' AS status,
  (SELECT COUNT(*) FROM users)::int AS users,
  (SELECT COUNT(*) FROM warga)::int AS warga,
  (SELECT COUNT(*) FROM jenis_surat)::int AS jenis_surat,
  (SELECT COUNT(*) FROM persyaratan)::int AS persyaratan,
  (SELECT COUNT(*) FROM profil_desa)::int AS profil_desa,
  (SELECT COUNT(*) FROM berita)::int AS berita;
