/**
 * db.js - Supabase REST API adapter & Resilient Local Storage fallback untuk SIPESUR
 *
 * Mendukung dua mode:
 * 1. Supabase Mode (Online via REST RPC)
 * 2. Local Fallback Mode (Otomatis aktif jika offline / Supabase tidak terjangkau)
 *
 * Memastikan aplikasi SIPESUR selalu dapat dijalankan dengan lancar di lingkungan apa pun.
 */
import 'dotenv/config';
import https from 'https';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const DATA_DIR = process.env.VERCEL ? '/tmp/sipesur' : path.resolve(__dirname, '..');
const LOCAL_DB_PATH = path.join(DATA_DIR, 'storage', 'local_db.json');

// ----------------------------------------------------------------
// Local Database Store (In-Memory + JSON Persistence)
// ----------------------------------------------------------------
let localDb = null;
let useLocalFallback = false;

function getDefaultData() {
  const pw = bcrypt.hashSync('Password123', 10);
  return {
    profil_desa: [
      {
        id: 1,
        nama_desa: 'Kelurahan Suka Maju',
        kecamatan: 'Kecamatan Medan Johor',
        kabupaten_kota: 'Pemerintah Kota Medan',
        provinsi: 'Sumatera Utara',
        alamat: 'Jl. STM No. 40, Kelurahan Suka Maju, Kecamatan Medan Johor, Kota Medan',
        kode_pos: '20146',
        telepon: '0823-4123-5734',
        email: 'kelurahan@pemkomedan.go.id',
        website: 'sukamaju.medan.go.id',
        logo_url: null,
        nama_lurah: 'Muhammad Iqbal Samosir, S.E., M.A.P.',
        nip_lurah: '198506122010011005',
        jabatan_lurah: 'Lurah Suka Maju',
        updated_at: new Date().toISOString(),
      },
    ],
    users: [
      {
        id: 1,
        nama: 'Admin IT Kelurahan',
        email: 'admin@sipesur.test',
        username: 'admin',
        nip: '198001012005011001',
        jabatan: 'Pranata Komputer / IT Administrator Sistem',
        telepon: '081234567890',
        password: pw,
        role: 'admin',
        status_verifikasi: 'terverifikasi',
        catatan_verifikasi: null,
        must_change_password: 0,
        tanda_tangan: null,
        aktif: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        nama: 'Siti Rohmah, S.AP',
        email: 'petugas@sipesur.test',
        username: 'petugas',
        nip: '198505122010012003',
        jabatan: 'Petugas Pelayanan Administrasi',
        telepon: '081234567891',
        password: pw,
        role: 'petugas',
        status_verifikasi: 'terverifikasi',
        catatan_verifikasi: null,
        must_change_password: 0,
        tanda_tangan: null,
        aktif: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: 3,
        nama: 'Muhammad Iqbal Samosir, S.E., M.A.P.',
        email: 'lurah@sipesur.test',
        username: 'lurah',
        nip: '198506122010011005',
        jabatan: 'Lurah Suka Maju',
        telepon: '0823-4123-5734',
        password: pw,
        role: 'lurah',
        status_verifikasi: 'terverifikasi',
        catatan_verifikasi: null,
        must_change_password: 0,
        tanda_tangan: null,
        aktif: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: 4,
        nama: 'Budi Santoso',
        email: 'warga@sipesur.test',
        username: '3201010101900001',
        nip: null,
        jabatan: null,
        telepon: '081200000001',
        password: pw,
        role: 'warga',
        status_verifikasi: 'terverifikasi',
        catatan_verifikasi: null,
        must_change_password: 0,
        tanda_tangan: null,
        aktif: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: 5,
        nama: 'Ahmad Pratama',
        email: 'ahmad.pratama@gmail.com',
        username: '3201010202950001',
        nip: null,
        jabatan: null,
        telepon: '081200000002',
        password: pw,
        role: 'warga',
        status_verifikasi: 'menunggu_verifikasi',
        catatan_verifikasi: null,
        must_change_password: 0,
        tanda_tangan: null,
        aktif: 1,
        created_at: new Date().toISOString(),
      },
    ],
    warga: [
      {
        id: 1,
        user_id: 4,
        nik: '3201010101900001',
        no_kk: '3201010101900002',
        tempat_lahir: 'Medan',
        tanggal_lahir: '1990-01-01',
        jenis_kelamin: 'L',
        alamat: 'Jl. STM No. 38 RT 02/RW 03 (Dekat Kantor Lurah), Kelurahan Suka Maju, Medan Johor',
        pekerjaan: 'Karyawan Swasta',
        telepon: '081200000001',
      },
      {
        id: 2,
        user_id: 5,
        nik: '3201010202950001',
        no_kk: '3201010202950002',
        tempat_lahir: 'Medan',
        tanggal_lahir: '1995-02-02',
        jenis_kelamin: 'L',
        alamat: 'Jl. Sakti Lubis No. 12 RT 01/RW 04, Suka Maju, Medan Johor',
        pekerjaan: 'Wiraswasta',
        telepon: '081200000002',
      },
    ],
    jenis_surat: [
      { id: 1, kode: 'SKD', nama: 'Surat Keterangan Domisili', template: 'Orang tersebut benar berdomisili di wilayah Kelurahan Suka Maju.', form_fields: [{ name: 'alamat_domisili', label: 'Alamat Domisili' }, { name: 'lama_tinggal', label: 'Lama Tinggal' }, { name: 'keperluan', label: 'Keperluan' }], aktif: 1 },
      { id: 2, kode: 'SKTM', nama: 'Surat Keterangan Tidak Mampu', template: 'Orang tersebut benar tergolong keluarga kurang mampu.', form_fields: [{ name: 'penghasilan', label: 'Penghasilan per Bulan' }, { name: 'jumlah_tanggungan', label: 'Jumlah Tanggungan' }, { name: 'keperluan', label: 'Keperluan' }], aktif: 1 },
      { id: 3, kode: 'SKCK', nama: 'Surat Pengantar SKCK', template: 'Orang tersebut berkelakuan baik dan diberi pengantar untuk pengurusan SKCK.', form_fields: [{ name: 'agama', label: 'Agama' }, { name: 'status_perkawinan', label: 'Status Perkawinan' }, { name: 'keperluan', label: 'Keperluan' }], aktif: 1 },
      { id: 4, kode: 'SKU', nama: 'Surat Keterangan Usaha', template: 'Orang tersebut benar memiliki usaha di wilayah Kelurahan Suka Maju.', form_fields: [{ name: 'nama_usaha', label: 'Nama Usaha' }, { name: 'jenis_usaha', label: 'Jenis Usaha' }, { name: 'alamat_usaha', label: 'Alamat Usaha' }, { name: 'lama_usaha', label: 'Lama Usaha' }], aktif: 1 },
      { id: 5, kode: 'SKLH', nama: 'Surat Keterangan Kelahiran', template: 'Telah terjadi kelahiran sebagaimana data di atas.', form_fields: [{ name: 'nama_bayi', label: 'Nama Bayi' }, { name: 'tempat_lahir_bayi', label: 'Tempat Lahir Bayi' }, { name: 'tanggal_lahir_bayi', label: 'Tanggal Lahir Bayi' }, { name: 'nama_ayah', label: 'Nama Ayah' }, { name: 'nama_ibu', label: 'Nama Ibu' }], aktif: 1 },
      { id: 6, kode: 'SKM', nama: 'Surat Keterangan Kematian', template: 'Telah terjadi kematian sebagaimana data di atas.', form_fields: [{ name: 'nama_almarhum', label: 'Nama Almarhum' }, { name: 'nik_almarhum', label: 'NIK Almarhum' }, { name: 'tanggal_meninggal', label: 'Tanggal Meninggal' }, { name: 'penyebab', label: 'Penyebab' }, { name: 'hubungan_pelapor', label: 'Hubungan Pelapor' }], aktif: 1 },
      { id: 7, kode: 'SKBM', nama: 'Surat Keterangan Belum Menikah', template: 'Orang tersebut sampai saat ini belum pernah menikah.', form_fields: [{ name: 'agama', label: 'Agama' }, { name: 'keperluan', label: 'Keperluan' }], aktif: 1 },
      { id: 8, kode: 'SPP', nama: 'Surat Pengantar Pindah', template: 'Orang tersebut bermaksud pindah domisili sebagaimana data di atas.', form_fields: [{ name: 'alamat_tujuan', label: 'Alamat Tujuan' }, { name: 'alasan_pindah', label: 'Alasan Pindah' }, { name: 'jumlah_pengikut', label: 'Jumlah Pengikut' }], aktif: 1 },
    ],
    persyaratan: [
      { id: 1, jenis_surat_id: 1, nama: 'KTP' }, { id: 2, jenis_surat_id: 1, nama: 'Kartu Keluarga' }, { id: 3, jenis_surat_id: 1, nama: 'Surat Pengantar RT/RW' },
      { id: 4, jenis_surat_id: 2, nama: 'KTP' }, { id: 5, jenis_surat_id: 2, nama: 'Kartu Keluarga' }, { id: 6, jenis_surat_id: 2, nama: 'Surat Pengantar RT/RW' },
      { id: 7, jenis_surat_id: 3, nama: 'KTP' }, { id: 8, jenis_surat_id: 3, nama: 'Kartu Keluarga' }, { id: 9, jenis_surat_id: 3, nama: 'Pas Foto' },
      { id: 10, jenis_surat_id: 4, nama: 'KTP' }, { id: 11, jenis_surat_id: 4, nama: 'Foto Tempat Usaha' }, { id: 12, jenis_surat_id: 4, nama: 'Surat Pengantar RT/RW' },
      { id: 13, jenis_surat_id: 5, nama: 'KTP Pelapor' }, { id: 14, jenis_surat_id: 5, nama: 'Kartu Keluarga' }, { id: 15, jenis_surat_id: 5, nama: 'Surat Keterangan Lahir (Bidan/RS)' },
      { id: 16, jenis_surat_id: 6, nama: 'KTP Pelapor' }, { id: 17, jenis_surat_id: 6, nama: 'Kartu Keluarga' }, { id: 18, jenis_surat_id: 6, nama: 'Surat Keterangan Kematian (RS/RT)' },
      { id: 19, jenis_surat_id: 7, nama: 'KTP' }, { id: 20, jenis_surat_id: 7, nama: 'Kartu Keluarga' }, { id: 21, jenis_surat_id: 7, nama: 'Surat Pengantar RT/RW' },
      { id: 22, jenis_surat_id: 8, nama: 'KTP' }, { id: 23, jenis_surat_id: 8, nama: 'Kartu Keluarga' }, { id: 24, jenis_surat_id: 8, nama: 'Pas Foto' },
    ],
    pengajuan: [],
    dokumen: [],
    verifikasi: [],
    persetujuan: [],
    surat: [],
    surat_masuk: [],
    surat_keluar: [],
    disposisi: [],
    disposisi_surat_masuk: [],
    notifikasi: [],
    activity_logs: [],
    berita: [
      {
        id: 1,
        judul: 'Pelantikan & Program Kerja Lurah Suka Maju Kecamatan Medan Johor',
        isi: 'Lurah Suka Maju, Muhammad Iqbal Samosir, S.E., M.A.P., bersama Sekretaris Lurah Vicky Al Wirya, S.Pt., M.M. menegaskan komitmen peningkatan pelayanan publik digital, kebersihan lingkungan, dan ketertiban administrasi kependudukan di wilayah Medan Johor.',
        kategori: 'Kegiatan',
        tanggal: '2026-11-15',
        penulis_id: 3,
        created_at: '2026-11-15T08:00:00.000Z',
      },
      {
        id: 2,
        judul: 'Peluncuran Layanan Surat Online SIPESUR Kelurahan Suka Maju',
        isi: 'Warga Kelurahan Suka Maju, Kec. Medan Johor kini dapat mengurus surat keterangan resmi secara online 24 jam tanpa antre di kantor kelurahan melalui portal digital SIPESUR.',
        kategori: 'Pengumuman',
        tanggal: '2026-11-10',
        penulis_id: 1,
        created_at: '2026-11-10T08:00:00.000Z',
      },
      {
        id: 3,
        judul: 'Himbauan Pemutakhiran Data Kependudukan & Layanan Loket Jl. STM',
        isi: 'Dihimbau kepada seluruh warga Suka Maju untuk memperbarui berkas administrasi KK dan KTP di Kantor Kelurahan Jl. STM No. 40 Medan Johor pada jam operasional kerja.',
        kategori: 'Himbauan',
        tanggal: '2026-11-05',
        penulis_id: 1,
        created_at: '2026-11-05T08:00:00.000Z',
      },
    ],
    umkm: [
      {
        id: 1,
        nama: 'Warung Kopi & Sarapan Pagi Bu Tini',
        jenis: 'Kuliner',
        alamat: 'Jl. STM No. 40 RT 02/03, Suka Maju',
        telepon: '0812-3456-7890',
        deskripsi: 'Menyediakan lontong Medan, kopi sidikalang, dan sarapan pagi khas',
      },
      {
        id: 2,
        nama: 'Toko Bangunan Maju Jaya Medan',
        jenis: 'Material & Konstruksi',
        alamat: 'Jl. STM No. 12 RT 01/05, Suka Maju',
        telepon: '0813-5678-9012',
        deskripsi: 'Bahan bangunan lengkap dan melayani antar tempat se-Medan Johor',
      },
      {
        id: 3,
        nama: 'Jasa Laundry Kilat Bersih STM',
        jenis: 'Jasa & Kebersihan',
        alamat: 'Jl. Sakti Lubis No. 7 RT 04/02, Suka Maju',
        telepon: '0821-9876-5432',
        deskripsi: 'Cuci setrika ekspres 1 hari selesai higienis dan harum',
      },
      {
        id: 4,
        nama: 'Konveksi Bordir & Songket Suka Maju',
        jenis: 'Tekstil & Pakaian',
        alamat: 'Jl. Suka Cerdas No. 3 RT 03/01, Suka Maju',
        telepon: '0858-1234-5678',
        deskripsi: 'Pakaian batik khas Melayu Deli, songket, dan seragam instansi',
      },
      {
        id: 5,
        nama: 'Apotek Sehat Mandiri Johor',
        jenis: 'Kesehatan & Obat',
        alamat: 'Jl. STM No. 88 RT 02/04, Suka Maju',
        telepon: '0877-2233-4455',
        deskripsi: 'Obat generik dan vitamin bersertifikasi BPOM',
      },
      {
        id: 6,
        nama: 'Studio Foto & Percetakan Digital STM',
        jenis: 'Jasa Kreatif',
        alamat: 'Jl. STM No. 20 RT 05/03, Suka Maju',
        telepon: '0831-6677-8899',
        deskripsi: 'Foto dokumen KTP, ijazah, pernikahan, dan cetak kilat',
      },
    ],
    galeri_kegiatan: [
      {
        id: 1,
        judul: 'Kerja Bakti Lingkungan RW 01 - RW 08',
        deskripsi: 'Warga gotong royong membersihkan saluran air dan fasilitas umum lingkungan kelurahan',
        url_foto: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
        tanggal: '2026-11-12',
        penulis_id: 1,
      },
      {
        id: 2,
        judul: 'Penyaluran Bantuan Pangan Cadangan Pemerintah',
        deskripsi: 'Pembagian beras bantuan bagi keluarga prasejahtera bertempat di Aula Kelurahan',
        url_foto: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
        tanggal: '2026-11-08',
        penulis_id: 1,
      },
      {
        id: 3,
        judul: 'Musyawarah Perencanaan Pembangunan (Musrenbang)',
        deskripsi: 'Penyusunan usulan program kerja tahun 2027 bersama tokoh masyarakat dan RT/RW',
        url_foto: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
        tanggal: '2026-10-25',
        penulis_id: 1,
      },
      {
        id: 4,
        judul: 'Pelatihan Kewirausahaan & Legalitas Usaha Mikro',
        deskripsi: 'Bimbingan pembuatan NIB dan izin edar produk untuk pelaku UMKM lokal binaan',
        url_foto: 'https://images.unsplash.com/photo-1531497865144-0464ef8fb9a9?auto=format&fit=crop&w=800&q=80',
        tanggal: '2026-10-18',
        penulis_id: 1,
      },
    ],
    anggaran: [
      {
        id: 1,
        tahun: 2026,
        program: 'Peningkatan Sarana & Prasarana Lingkungan Permukiman',
        pagu: 450000000,
        realisasi: 412500000,
        sumber: 'APBD Kota',
        keterangan: 'Pengaspalan jalan lingkungan dan drainase 8 RW',
      },
      {
        id: 2,
        tahun: 2026,
        program: 'Digitalisasi Layanan Publik & Sistem SIPESUR',
        pagu: 75000000,
        realisasi: 75000000,
        sumber: 'APBD Kota',
        keterangan: 'Pengadaan server, aplikasi persuratan, dan TTE digital',
      },
      {
        id: 3,
        tahun: 2026,
        program: 'Pemberdayaan Masyarakat & Pembinaan UMKM Lokal',
        pagu: 120000000,
        realisasi: 108000000,
        sumber: 'Dana Kelurahan',
        keterangan: 'Pelatihan usaha, permodalan bibit, dan pameran kelurahan',
      },
      {
        id: 4,
        tahun: 2026,
        program: 'Pelayanan Kesehatan Posyandu & Penanganan Stunting',
        pagu: 95000000,
        realisasi: 91200000,
        sumber: 'Dana Kelurahan',
        keterangan: 'PMT balita/lansia dan insentif kader posyandu',
      },
      {
        id: 5,
        tahun: 2026,
        program: 'Operasional Kantor & Ketentraman Ketertiban Lingkungan',
        pagu: 180000000,
        realisasi: 165000000,
        sumber: 'APBD Kota',
        keterangan: 'Perawatan kantor kelurahan, ATK dinas, dan linmas',
      },
    ],
  };
}

function initLocalDb() {
  if (localDb) return localDb;
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const content = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
      localDb = JSON.parse(content);
      const defaults = getDefaultData();
      if (!localDb.profil_desa || !localDb.profil_desa.length) {
        localDb.profil_desa = defaults.profil_desa;
      }
      if (!localDb.berita || !localDb.berita.length) {
        localDb.berita = defaults.berita;
      }
      if (!localDb.umkm || !localDb.umkm.length) {
        localDb.umkm = defaults.umkm;
      }
      if (!localDb.galeri_kegiatan || !localDb.galeri_kegiatan.length) {
        localDb.galeri_kegiatan = defaults.galeri_kegiatan;
      }
      if (!localDb.anggaran || !localDb.anggaran.length) {
        localDb.anggaran = defaults.anggaran;
      }
    } else {
      localDb = getDefaultData();
      saveLocalDb();
    }
  } catch {
    localDb = getDefaultData();
  }
  return localDb;
}

function saveLocalDb() {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDb, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB Local] Gagal menyimpan file database lokal:', err.message);
  }
}

// ----------------------------------------------------------------
// Local SQL Engine (Sederhana tapi mencakup semua query SIPESUR)
// ----------------------------------------------------------------
function executeLocalSql(sql, params = []) {
  const dbData = initLocalDb();
  const cleanSql = sql.trim();
  const upper = cleanSql.toUpperCase();

  // 1. SELECT profil_desa
  if (upper.includes('FROM PROFIL_DESA') || upper.includes('FROM "PROFIL_DESA"')) {
    const list = dbData.profil_desa || [];
    return list.slice(0, 1);
  }

  // 2. UPDATE profil_desa
  if (upper.startsWith('UPDATE PROFIL_DESA') || upper.startsWith('UPDATE "PROFIL_DESA"')) {
    const p = dbData.profil_desa[0] || {};
    // Extract parameters
    if (params.length >= 10) {
      p.nama_desa = params[0];
      p.kecamatan = params[1];
      p.kabupaten_kota = params[2];
      p.provinsi = params[3];
      p.alamat = params[4];
      p.kode_pos = params[5];
      p.telepon = params[6];
      p.email = params[7];
      p.website = params[8];
      p.logo_url = params[9];
      p.nama_lurah = params[10];
      p.nip_lurah = params[11];
      p.jabatan_lurah = params[12];
      p.updated_at = new Date().toISOString();
      dbData.profil_desa[0] = p;
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }

  // 3a. VERIFIKASI WARGA: SELECT users u JOIN warga w
  if (upper.includes('FROM USERS U') && upper.includes('JOIN WARGA W')) {
    let wargaUsers = (dbData.users || []).filter((u) => u.role === 'warga');

    if (upper.includes('U.STATUS_VERIFIKASI = ?') || upper.includes('STATUS_VERIFIKASI = ?')) {
      const stFilter = String(params[0] || '').trim();
      wargaUsers = wargaUsers.filter((u) => (u.status_verifikasi || 'menunggu_verifikasi') === stFilter);
    }
    if (upper.includes('U.ID = ?') || upper.includes('WHERE U.ID = ?')) {
      const uid = Number(params[params.length - 1] || params[0]);
      wargaUsers = wargaUsers.filter((u) => u.id === uid);
    }

    return wargaUsers
      .map((u) => {
        const w = (dbData.warga || []).find((item) => item.user_id === u.id) || {};
        const v = u.diverifikasi_oleh ? (dbData.users || []).find((x) => x.id === u.diverifikasi_oleh) : null;
        return {
          id: u.id,
          nama: u.nama,
          email: u.email,
          status_verifikasi: u.status_verifikasi || 'menunggu_verifikasi',
          catatan_verifikasi: u.catatan_verifikasi || null,
          diverifikasi_at: u.diverifikasi_at || null,
          created_at: u.created_at,
          nik: w.nik || '',
          no_kk: w.no_kk || '',
          tempat_lahir: w.tempat_lahir || '',
          tanggal_lahir: w.tanggal_lahir || '',
          jenis_kelamin: w.jenis_kelamin || '',
          alamat: w.alamat || '',
          pekerjaan: w.pekerjaan || '',
          telepon: w.telepon || '',
          verifikator: v?.nama || null,
        };
      })
      .sort((a, b) => b.id - a.id);
  }

  // 3b. SELECT USERS
  if (upper.startsWith('SELECT') && upper.includes('FROM USERS') && upper.includes('WHERE')) {
    let rows = [...dbData.users];
    if (upper.includes('EMAIL = ?') || upper.includes('USERNAME = ?') || upper.includes('NIP = ?')) {
      const id = String(params[0] || '').toLowerCase();
      rows = rows.filter((u) => {
        const uNik = dbData.warga.find((w) => w.user_id === u.id)?.nik;
        return (
          String(u.email || '').toLowerCase() === id ||
          String(u.username || '').toLowerCase() === id ||
          String(u.nip || '').toLowerCase() === id ||
          String(uNik || '') === id
        );
      });
      return rows.map((u) => {
        const w = dbData.warga.find((item) => item.user_id === u.id) || {};
        return { ...u, ...w, id: u.id, telepon_warga: w.telepon };
      });
    }
    if (upper.includes('U.ID = ?') || upper.includes('WHERE ID=?') || upper.includes('WHERE ID = ?')) {
      const uid = Number(params[0]);
      rows = rows.filter((u) => u.id === uid);
      return rows.map((u) => {
        const w = dbData.warga.find((item) => item.user_id === u.id) || {};
        return { ...u, ...w, id: u.id };
      });
    }
    if (upper.includes('ROLE = ?') || upper.includes("ROLE = 'LURAH'")) {
      const r = params[0] || 'lurah';
      return rows.filter((u) => u.role === r && u.aktif);
    }
  }

  // 4. UPDATE users SET status_verifikasi=?, catatan_verifikasi=?, diverifikasi_oleh=?, diverifikasi_at=CURRENT_TIMESTAMP WHERE id=?
  if (upper.startsWith('UPDATE USERS') && upper.includes('STATUS_VERIFIKASI')) {
    const targetId = Number(params[params.length - 1]);
    const u = (dbData.users || []).find((x) => x.id === targetId);
    if (u) {
      u.status_verifikasi = params[0];
      u.catatan_verifikasi = params[1] || null;
      u.diverifikasi_oleh = params[2] ? Number(params[2]) : null;
      u.diverifikasi_at = new Date().toISOString();
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }

  // 4b. UPDATE users SET tanda_tangan=? WHERE id=?
  if (upper.startsWith('UPDATE USERS') && upper.includes('TANDA_TANGAN')) {
    const uid = Number(params[1]);
    const u = dbData.users.find((x) => x.id === uid);
    if (u) {
      u.tanda_tangan = params[0];
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }

  // 5. UPDATE users
  if (upper.startsWith('UPDATE USERS')) {
    const uid = Number(params[params.length - 1]);
    const u = (dbData.users || []).find((x) => x.id === uid);
    if (u && params.length >= 2) {
      if (upper.includes('SET NAMA=?') && params.length === 2) {
        u.nama = params[0];
      }
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }

  // 5b. INSERT INTO USERS
  if (upper.startsWith('INSERT INTO USERS')) {
    dbData.users = dbData.users || [];
    const newId = (dbData.users.length ? Math.max(...dbData.users.map((r) => r.id || 0)) : 0) + 1;
    let newUser;
    if (params.length === 7) {
      newUser = {
        id: newId,
        nama: params[0],
        email: params[1] || null,
        username: params[2],
        password: params[3],
        role: params[4] || 'warga',
        status_verifikasi: params[5] || 'menunggu_verifikasi',
        catatan_verifikasi: null,
        must_change_password: 0,
        tanda_tangan: null,
        aktif: params[6] ?? 1,
        created_at: new Date().toISOString(),
      };
    } else {
      newUser = {
        id: newId,
        nama: params[0],
        email: params[1] || null,
        username: params[2],
        nip: params[3] || null,
        jabatan: params[4] || null,
        telepon: params[5] || null,
        password: params[6],
        role: params[7] || 'warga',
        status_verifikasi: params[8] || (params[7] === 'warga' ? 'menunggu_verifikasi' : 'terverifikasi'),
        catatan_verifikasi: null,
        must_change_password: params[9] ?? 0,
        tanda_tangan: null,
        aktif: params[10] ?? 1,
        created_at: new Date().toISOString(),
      };
    }
    dbData.users.push(newUser);
    saveLocalDb();
    return [{ id: newId }];
  }

  // 5c. INSERT & UPDATE WARGA
  if (upper.startsWith('INSERT INTO WARGA')) {
    dbData.warga = dbData.warga || [];
    const newId = (dbData.warga.length ? Math.max(...dbData.warga.map((r) => r.id || 0)) : 0) + 1;
    const newWarga = {
      id: newId,
      user_id: Number(params[0]),
      nik: String(params[1]),
      no_kk: String(params[2]),
      tempat_lahir: params[3] || null,
      tanggal_lahir: params[4] || null,
      jenis_kelamin: params[5] || null,
      alamat: params[6] || null,
      pekerjaan: params[7] || null,
      telepon: params[8] || null,
    };
    dbData.warga.push(newWarga);
    saveLocalDb();
    return [{ id: newId }];
  }

  if (upper.startsWith('UPDATE WARGA')) {
    const uid = Number(params[params.length - 1]);
    const w = (dbData.warga || []).find((x) => x.user_id === uid);
    if (w) {
      w.tempat_lahir = params[0] || w.tempat_lahir;
      w.tanggal_lahir = params[1] || w.tanggal_lahir;
      w.jenis_kelamin = params[2] || w.jenis_kelamin;
      w.alamat = params[3] || w.alamat;
      w.pekerjaan = params[4] || w.pekerjaan;
      w.telepon = params[5] || w.telepon;
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }

  // 6. DELETE queries
  if (upper.startsWith('DELETE FROM')) {
    const m = cleanSql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?/i);
    if (m) {
      const tbl = m[1].toLowerCase();
      if (dbData[tbl]) {
        if (params.length > 0 && (typeof params[0] === 'number' || !isNaN(Number(params[0])))) {
          const idDel = Number(params[0]);
          dbData[tbl] = dbData[tbl].filter((item) => item.id !== idDel && item.pengajuan_id !== idDel && item.user_id !== idDel);
        } else if (cleanSql.toUpperCase().includes('WHERE USER_ID = ?') && params[0]) {
          const uid = Number(params[0]);
          dbData[tbl] = dbData[tbl].filter((item) => item.user_id !== uid);
        }
        saveLocalDb();
        return [{ rowCount: 1, affectedRows: 1 }];
      }
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }

  // 6. BERITA & PENGUMUMAN
  if (upper.includes('FROM BERITA')) {
    return [...(dbData.berita || [])].sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
  }
  if (upper.startsWith('INSERT INTO BERITA')) {
    dbData.berita = dbData.berita || [];
    const newId = (dbData.berita.length ? Math.max(...dbData.berita.map((r) => r.id || 0)) : 0) + 1;
    const row = {
      id: newId,
      judul: params[0],
      isi: params[1],
      kategori: params[2] || 'Pengumuman',
      tanggal: params[3] || new Date().toISOString().split('T')[0],
      penulis_id: params[4] || null,
      created_at: new Date().toISOString(),
    };
    dbData.berita.unshift(row);
    saveLocalDb();
    return [{ id: newId }];
  }
  if (upper.startsWith('UPDATE BERITA')) {
    dbData.berita = dbData.berita || [];
    const id = Number(params[4]);
    const item = dbData.berita.find((x) => x.id === id);
    if (item) {
      item.judul = params[0];
      item.isi = params[1];
      item.kategori = params[2];
      item.tanggal = params[3];
      item.updated_at = new Date().toISOString();
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }

  // 7. UMKM
  if (upper.includes('FROM UMKM')) {
    return [...(dbData.umkm || [])].sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || '')));
  }
  if (upper.startsWith('INSERT INTO UMKM')) {
    dbData.umkm = dbData.umkm || [];
    const newId = (dbData.umkm.length ? Math.max(...dbData.umkm.map((r) => r.id || 0)) : 0) + 1;
    const row = {
      id: newId,
      nama: params[0],
      jenis: params[1] || '',
      alamat: params[2] || '',
      telepon: params[3] || '',
      deskripsi: params[4] || '',
      created_at: new Date().toISOString(),
    };
    dbData.umkm.push(row);
    saveLocalDb();
    return [{ id: newId }];
  }
  if (upper.startsWith('UPDATE UMKM')) {
    dbData.umkm = dbData.umkm || [];
    const id = Number(params[5]);
    const item = dbData.umkm.find((x) => x.id === id);
    if (item) {
      item.nama = params[0];
      item.jenis = params[1];
      item.alamat = params[2];
      item.telepon = params[3];
      item.deskripsi = params[4];
      item.updated_at = new Date().toISOString();
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }

  // 8. GALERI KEGIATAN
  if (upper.includes('FROM GALERI_KEGIATAN')) {
    return [...(dbData.galeri_kegiatan || [])].sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
  }
  if (upper.startsWith('INSERT INTO GALERI_KEGIATAN')) {
    dbData.galeri_kegiatan = dbData.galeri_kegiatan || [];
    const newId = (dbData.galeri_kegiatan.length ? Math.max(...dbData.galeri_kegiatan.map((r) => r.id || 0)) : 0) + 1;
    const row = {
      id: newId,
      judul: params[0],
      deskripsi: params[1] || '',
      url_foto: params[2] || '',
      tanggal: params[3] || new Date().toISOString().split('T')[0],
      penulis_id: params[4] || null,
      created_at: new Date().toISOString(),
    };
    dbData.galeri_kegiatan.unshift(row);
    saveLocalDb();
    return [{ id: newId }];
  }
  if (upper.startsWith('UPDATE GALERI_KEGIATAN')) {
    dbData.galeri_kegiatan = dbData.galeri_kegiatan || [];
    const id = Number(params[4]);
    const item = dbData.galeri_kegiatan.find((x) => x.id === id);
    if (item) {
      item.judul = params[0];
      item.deskripsi = params[1];
      item.url_foto = params[2];
      item.tanggal = params[3];
      item.updated_at = new Date().toISOString();
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }

  // 9. ANGGARAN
  if (upper.includes('FROM ANGGARAN')) {
    return [...(dbData.anggaran || [])].sort((a, b) => (Number(b.tahun) || 0) - (Number(a.tahun) || 0));
  }
  if (upper.startsWith('INSERT INTO ANGGARAN')) {
    dbData.anggaran = dbData.anggaran || [];
    const newId = (dbData.anggaran.length ? Math.max(...dbData.anggaran.map((r) => r.id || 0)) : 0) + 1;
    const row = {
      id: newId,
      tahun: Number(params[0]) || new Date().getFullYear(),
      program: params[1],
      pagu: Number(params[2]) || 0,
      realisasi: Number(params[3]) || 0,
      sumber: params[4] || 'APBD Kota',
      keterangan: params[5] || '',
      created_at: new Date().toISOString(),
    };
    dbData.anggaran.unshift(row);
    saveLocalDb();
    return [{ id: newId }];
  }
  if (upper.startsWith('UPDATE ANGGARAN')) {
    dbData.anggaran = dbData.anggaran || [];
    const id = Number(params[6]);
    const item = dbData.anggaran.find((x) => x.id === id);
    if (item) {
      item.tahun = Number(params[0]) || item.tahun;
      item.program = params[1];
      item.pagu = Number(params[2]) || 0;
      item.realisasi = Number(params[3]) || 0;
      item.sumber = params[4] || 'APBD Kota';
      item.keterangan = params[5] || '';
      item.updated_at = new Date().toISOString();
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }

  // 9a. INSERT INTO PENGAJUAN
  if (upper.startsWith('INSERT INTO PENGAJUAN')) {
    dbData.pengajuan = dbData.pengajuan || [];
    const newId = (dbData.pengajuan.length ? Math.max(...dbData.pengajuan.map((r) => r.id || 0)) : 0) + 1;
    let df = params[3];
    if (typeof df === 'string') {
      try { df = JSON.parse(df); } catch (_) {}
    }
    const newRow = {
      id: newId,
      kode: params[0],
      user_id: Number(params[1]),
      jenis_surat_id: Number(params[2]),
      data_form: df || {},
      status: 'submitted',
      catatan: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    dbData.pengajuan.push(newRow);
    saveLocalDb();
    return [{ id: newId, insertId: newId }];
  }

  // 9b. INSERT INTO DOKUMEN
  if (upper.startsWith('INSERT INTO DOKUMEN')) {
    dbData.dokumen = dbData.dokumen || [];
    const newId = (dbData.dokumen.length ? Math.max(...dbData.dokumen.map((r) => r.id || 0)) : 0) + 1;
    const newRow = {
      id: newId,
      pengajuan_id: Number(params[0]),
      persyaratan_id: Number(params[1]),
      nama_file: params[2],
      path: params[3],
      file_path: params[3],
      mime: params[4],
      created_at: new Date().toISOString(),
    };
    dbData.dokumen.push(newRow);
    saveLocalDb();
    return [{ id: newId, insertId: newId }];
  }

  // 9c. CEK KELENGKAPAN BERKAS (lengkap pid & jid)
  if (upper.includes('FROM PERSYARATAN') && upper.includes('FROM DOKUMEN')) {
    dbData.persyaratan = dbData.persyaratan || [];
    dbData.dokumen = dbData.dokumen || [];
    const jid = Number(params[0]);
    const pid = Number(params[1]);
    const a = dbData.persyaratan.filter((s) => s.jenis_surat_id === jid).length;
    const b = dbData.dokumen.filter((d) => d.pengajuan_id === pid).length;
    return [{ a, b }];
  }

  // 9d. SELECT DOKUMEN (Detail, File, Check)
  if (upper.includes('FROM DOKUMEN')) {
    dbData.dokumen = dbData.dokumen || [];
    dbData.pengajuan = dbData.pengajuan || [];

    // SELECT d.*,p.user_id FROM dokumen d JOIN pengajuan p ON p.id=d.pengajuan_id WHERE d.id=?
    if (upper.includes('JOIN PENGAJUAN') || upper.includes('D.ID=?') || upper.includes('D.ID = ?')) {
      const docId = Number(params[0]);
      const d = dbData.dokumen.find((item) => item.id === docId);
      if (!d) return [];
      const p = dbData.pengajuan.find((item) => item.id === d.pengajuan_id) || {};
      return [{ ...d, user_id: p.user_id }];
    }

    // SELECT path FROM dokumen WHERE pengajuan_id=? AND persyaratan_id=?
    if (upper.includes('PENGAJUAN_ID=? AND PERSYARATAN_ID=?') || upper.includes('PENGAJUAN_ID = ? AND PERSYARATAN_ID = ?')) {
      const pid = Number(params[0]);
      const sid = Number(params[1]);
      return dbData.dokumen.filter((d) => d.pengajuan_id === pid && d.persyaratan_id === sid);
    }

    // SELECT id,persyaratan_id,nama_file FROM dokumen WHERE pengajuan_id=?
    if (upper.includes('PENGAJUAN_ID=?') || upper.includes('PENGAJUAN_ID = ?')) {
      const pid = Number(params[0]);
      return dbData.dokumen.filter((d) => d.pengajuan_id === pid).map((d) => ({
        id: d.id,
        persyaratan_id: d.persyaratan_id,
        nama_file: d.nama_file,
        path: d.path,
        file_path: d.path,
        mime: d.mime,
        created_at: d.created_at,
      }));
    }
  }

  // 9d. DELETE DOKUMEN
  if (upper.startsWith('DELETE FROM DOKUMEN')) {
    dbData.dokumen = dbData.dokumen || [];
    if (upper.includes('PENGAJUAN_ID=? AND PERSYARATAN_ID=?') || upper.includes('PENGAJUAN_ID = ? AND PERSYARATAN_ID = ?')) {
      const pid = Number(params[0]);
      const sid = Number(params[1]);
      dbData.dokumen = dbData.dokumen.filter((d) => !(d.pengajuan_id === pid && d.persyaratan_id === sid));
      saveLocalDb();
      return [{ rowCount: 1, affectedRows: 1 }];
    }
    if (upper.includes('PENGAJUAN_ID=?') || upper.includes('PENGAJUAN_ID = ?')) {
      const pid = Number(params[0]);
      dbData.dokumen = dbData.dokumen.filter((d) => d.pengajuan_id !== pid);
      saveLocalDb();
      return [{ rowCount: 1, affectedRows: 1 }];
    }
  }

  // 9f. LIST PENGAJUAN (GET /api/pengajuan)
  if (upper.includes('FROM PENGAJUAN P') && upper.includes('JOIN JENIS_SURAT J') && upper.includes('JOIN USERS U')) {
    dbData.pengajuan = dbData.pengajuan || [];
    let list = [...dbData.pengajuan];
    if (upper.includes('P.USER_ID=?') || upper.includes('P.USER_ID = ?')) {
      const uid = Number(params[0]);
      list = list.filter((x) => x.user_id === uid);
    }
    if (upper.includes("P.STATUS IN ('PENDING_APPROVAL','APPROVED','REJECTED','ISSUED')")) {
      list = list.filter((x) => ['pending_approval', 'approved', 'rejected', 'issued'].includes(x.status));
    }
    if (upper.includes('P.STATUS=?') || upper.includes('P.STATUS = ?')) {
      const st = params[params.length - 1];
      list = list.filter((x) => x.status === st);
    }
    list.sort((a, b) => (b.id || 0) - (a.id || 0));
    return list.map((p) => {
      const j = (dbData.jenis_surat || []).find((js) => js.id === p.jenis_surat_id) || {};
      const u = (dbData.users || []).find((usr) => usr.id === p.user_id) || {};
      return {
        id: p.id,
        kode: p.kode,
        status: p.status,
        created_at: p.created_at,
        jenis: j.nama || 'Surat Keterangan',
        pemohon: u.nama || 'Warga Suka Maju',
      };
    });
  }

  // 9g. DELETE PENGAJUAN
  if (upper.startsWith('DELETE FROM PENGAJUAN WHERE ID=?') || upper.startsWith('DELETE FROM PENGAJUAN WHERE ID = ?')) {
    const pid = Number(params[0]);
    dbData.pengajuan = (dbData.pengajuan || []).filter((x) => x.id !== pid);
    dbData.dokumen = (dbData.dokumen || []).filter((x) => x.pengajuan_id !== pid);
    saveLocalDb();
    return [{ rowCount: 1, affectedRows: 1 }];
  }

  // 10a. DETAIL PENGAJUAN LENGKAP (getP)
  if (upper.includes('SELECT P.*') && upper.includes('FROM PENGAJUAN P') && upper.includes('JOIN JENIS_SURAT')) {
    const idVal = Number(params[0]);
    const p = (dbData.pengajuan || []).find((item) => item.id === idVal);
    if (p) {
      const js = (dbData.jenis_surat || []).find((j) => j.id === p.jenis_surat_id) || {};
      const u = (dbData.users || []).find((usr) => usr.id === p.user_id) || {};
      const w = (dbData.warga || []).find((wrg) => wrg.user_id === p.user_id) || {};
      return [{
        ...p,
        jenis: js.nama || 'Surat Keterangan',
        jkode: js.kode || 'SK',
        form_fields: js.form_fields || [],
        template: p.data_form?.redaksi_kustom || js.template || '',
        pemohon: u.nama || 'Warga Suka Maju',
        nik: w.nik || '',
        no_kk: w.no_kk || '',
        tempat_lahir: w.tempat_lahir || '-',
        tanggal_lahir: w.tanggal_lahir || '-',
        jenis_kelamin: w.jenis_kelamin || 'L',
        alamat: w.alamat || '-',
        pekerjaan: w.pekerjaan || '-',
        telepon: w.telepon || '-',
      }];
    }
    return [];
  }

  // 10b. CEK STATUS PUBLIK (Tracking)
  if (upper.includes('UPPER(COALESCE(S.NOMOR') || (upper.includes('FROM PENGAJUAN P') && upper.includes('UPPER(P.KODE)'))) {
    const idVal = Number(params[0]);
    const kode1 = String(params[1] || '').trim().toUpperCase();
    const kode2 = String(params[2] || kode1).trim().toUpperCase();
    const p = (dbData.pengajuan || []).find((item) =>
      (!isNaN(idVal) && idVal > 0 && item.id === idVal) ||
      (kode1 && String(item.kode || '').toUpperCase() === kode1) ||
      (kode2 && String(item.kode || '').toUpperCase() === kode2) ||
      (kode2 && String(item.nomor_surat || '').toUpperCase() === kode2)
    );
    if (p) {
      const js = (dbData.jenis_surat || []).find((j) => j.id === p.jenis_surat_id);
      const u = (dbData.users || []).find((usr) => usr.id === p.user_id);
      const s = (dbData.surat || []).find((srt) => srt.pengajuan_id === p.id);
      return [{
        id: p.id,
        kode: p.kode,
        status: p.status,
        created_at: p.created_at,
        updated_at: p.updated_at,
        catatan: p.catatan || p.catatan_petugas || null,
        nomor_surat: s?.nomor || null,
        jenis_surat: js?.nama || 'Surat Keterangan Kelurahan',
        nama_pemohon: u?.nama || 'Warga Suka Maju',
      }];
    }
    return [];
  }

  // 10c. UPDATE PENGAJUAN
  if (upper.startsWith('UPDATE PENGAJUAN')) {
    dbData.pengajuan = dbData.pengajuan || [];
    if (upper.includes('SET DATA_FORM')) {
      const pid = Number(params[1]);
      const p = dbData.pengajuan.find((x) => x.id === pid);
      if (p) {
        let df = params[0];
        if (typeof df === 'string') {
          try { df = JSON.parse(df); } catch (_) {}
        }
        p.data_form = df;
        p.updated_at = new Date().toISOString();
        saveLocalDb();
      }
      return [{ rowCount: 1, affectedRows: 1 }];
    }
    if (upper.includes('SET STATUS')) {
      const pid = Number(params[2]);
      const p = dbData.pengajuan.find((x) => x.id === pid);
      if (p) {
        p.status = params[0];
        p.catatan = params[1] || null;
        p.updated_at = new Date().toISOString();
        saveLocalDb();
      }
      return [{ rowCount: 1, affectedRows: 1 }];
    }
  }

  // 10d. UPDATE SURAT
  if (upper.startsWith('UPDATE SURAT')) {
    dbData.surat = dbData.surat || [];
    if (upper.includes('SET NOMOR=?') || upper.includes('SET NOMOR = ?')) {
      const pid = Number(params[1]);
      const s = dbData.surat.find((x) => x.pengajuan_id === pid || x.id === pid);
      if (s) {
        s.nomor = params[0];
        saveLocalDb();
      }
      return [{ rowCount: 1, affectedRows: 1 }];
    }
  }

  // 11. STATISTIK PUBLIK & STATS DASHBOARD
  if (upper.includes("SELECT COUNT(*) AS TOTAL FROM PENGAJUAN WHERE STATUS = 'ISSUED'")) {
    return [{ total: (dbData.pengajuan || []).filter((p) => p.status === 'issued').length }];
  }
  if (upper.includes('SELECT COUNT(*) AS TOTAL FROM PENGAJUAN')) {
    return [{ total: (dbData.pengajuan || []).length }];
  }
  if (upper.includes('SELECT COUNT(*) AS TOTAL FROM USERS WHERE ROLE = ?')) {
    const roleArg = params[0] || 'warga';
    return [{ total: (dbData.users || []).filter((u) => u.role === roleArg && u.aktif).length }];
  }
  if (upper.includes('SELECT STATUS,COUNT(*)::INT AS N FROM PENGAJUAN')) {
    let list = dbData.pengajuan || [];
    if (upper.includes('WHERE P.USER_ID=?') && params.length) {
      const uid = Number(params[0]);
      list = list.filter((p) => p.user_id === uid);
    }
    const counts = {};
    for (const p of list) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return Object.entries(counts).map(([status, n]) => ({ status, n }));
  }
  if (upper.includes('SELECT J.NAMA,COUNT(*)::INT AS N FROM PENGAJUAN')) {
    let list = dbData.pengajuan || [];
    if (upper.includes('WHERE P.USER_ID=?') && params.length) {
      const uid = Number(params[0]);
      list = list.filter((p) => p.user_id === uid);
    }
    const counts = {};
    for (const p of list) {
      const j = (dbData.jenis_surat || []).find((x) => x.id === p.jenis_surat_id);
      const name = j?.nama || 'Lainnya';
      counts[name] = (counts[name] || 0) + 1;
    }
    return Object.entries(counts).map(([nama, n]) => ({ nama, n })).sort((a, b) => b.n - a.n);
  }
  if (upper.includes('GROUP BY TO_CHAR') && upper.includes('FROM PENGAJUAN')) {
    let list = dbData.pengajuan || [];
    if (upper.includes('WHERE P.USER_ID=?') && params.length) {
      const uid = Number(params[0]);
      list = list.filter((p) => p.user_id === uid);
    }
    const counts = {};
    for (const p of list) {
      const ym = String(p.created_at || new Date().toISOString()).slice(0, 7);
      counts[ym] = (counts[ym] || 0) + 1;
    }
    return Object.entries(counts).map(([nama, n]) => ({ nama, n })).sort((a, b) => b.nama.localeCompare(a.nama)).slice(0, 6);
  }

  // 11b. ACTIVITY LOGS (INSERT & SELECT JOIN USERS)
  if (upper.startsWith('INSERT INTO ACTIVITY_LOGS')) {
    dbData.activity_logs = dbData.activity_logs || [];
    const newId = (dbData.activity_logs.length ? Math.max(...dbData.activity_logs.map((r) => r.id || 0)) : 0) + 1;
    dbData.activity_logs.unshift({
      id: newId,
      user_id: params[0] ? Number(params[0]) : null,
      aksi: params[1] || '',
      detail: params[2] || '',
      ip: params[3] || '',
      created_at: new Date().toISOString(),
    });
    saveLocalDb();
    return [{ id: newId }];
  }
  if (upper.includes('FROM ACTIVITY_LOGS')) {
    const logs = dbData.activity_logs || [];
    return [...logs]
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .slice(0, 200)
      .map((l) => {
        const u = l.user_id ? (dbData.users || []).find((x) => x.id === l.user_id) : null;
        return { ...l, nama: u?.nama || null };
      });
  }

  // 11c. JENIS SURAT & PERSYARATAN (ADMIN IT)
  if (upper.startsWith('INSERT INTO JENIS_SURAT')) {
    dbData.jenis_surat = dbData.jenis_surat || [];
    const newId = (dbData.jenis_surat.length ? Math.max(...dbData.jenis_surat.map((r) => r.id || 0)) : 0) + 1;
    let fields = params[3];
    if (typeof fields === 'string') {
      try { fields = JSON.parse(fields); } catch (_) { fields = []; }
    }
    dbData.jenis_surat.push({
      id: newId,
      kode: params[0],
      nama: params[1],
      template: params[2] || '',
      form_fields: fields,
      aktif: 1,
    });
    saveLocalDb();
    return [{ id: newId }];
  }
  if (upper.startsWith('UPDATE JENIS_SURAT SET AKTIF')) {
    const id = Number(params[0]);
    const item = (dbData.jenis_surat || []).find((x) => x.id === id);
    if (item) {
      item.aktif = item.aktif ? 0 : 1;
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }
  if (upper.startsWith('UPDATE JENIS_SURAT SET TEMPLATE')) {
    const id = Number(params[1]);
    const item = (dbData.jenis_surat || []).find((x) => x.id === id);
    if (item) {
      item.template = params[0] || '';
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }
  if (upper.startsWith('INSERT INTO PERSYARATAN')) {
    dbData.persyaratan = dbData.persyaratan || [];
    const newId = (dbData.persyaratan.length ? Math.max(...dbData.persyaratan.map((r) => r.id || 0)) : 0) + 1;
    dbData.persyaratan.push({
      id: newId,
      jenis_surat_id: Number(params[0]),
      nama: params[1],
    });
    saveLocalDb();
    return [{ id: newId }];
  }

  // 11d. SURAT MASUK & DISPOSISI (PETUGAS / LURAH)
  if (upper.startsWith('INSERT INTO SURAT_MASUK')) {
    dbData.surat_masuk = dbData.surat_masuk || [];
    const newId = (dbData.surat_masuk.length ? Math.max(...dbData.surat_masuk.map((r) => r.id || 0)) : 0) + 1;
    dbData.surat_masuk.push({
      id: newId,
      nomor_surat: params[0],
      pengirim: params[1],
      tanggal_surat: params[2],
      perihal: params[3],
      ringkasan_isi: params[4] || '',
      file_lampiran: params[5] || null,
      dicatat_oleh: params[6] ? Number(params[6]) : null,
      status: 'menunggu_disposisi',
      created_at: new Date().toISOString(),
    });
    saveLocalDb();
    return [{ id: newId }];
  }
  if (upper.startsWith('INSERT INTO DISPOSISI')) {
    dbData.disposisi = dbData.disposisi || [];
    const newId = (dbData.disposisi.length ? Math.max(...dbData.disposisi.map((r) => r.id || 0)) : 0) + 1;
    dbData.disposisi.push({
      id: newId,
      surat_masuk_id: Number(params[0]),
      lurah_id: Number(params[1]),
      tujuan_disposisi: params[2],
      sifat: params[3] || 'Biasa',
      arahan: params[4],
      tanggal_disposisi: new Date().toISOString(),
    });
    saveLocalDb();
    return [{ id: newId }];
  }
  if (upper.startsWith('UPDATE SURAT_MASUK SET STATUS')) {
    const id = Number(params[0]);
    const sm = (dbData.surat_masuk || []).find((x) => x.id === id);
    if (sm) {
      sm.status = upper.includes("'DIBALAS'") ? 'dibalas' : 'didisposisi';
      saveLocalDb();
    }
    return [{ rowCount: 1, affectedRows: 1 }];
  }
  if (upper.includes('FROM SURAT_MASUK SM') && upper.includes('LEFT JOIN DISPOSISI')) {
    let items = [...(dbData.surat_masuk || [])];
    if (upper.includes('SM.STATUS = ?') && params.length) {
      const stParam = params[params.length - 1];
      items = items.filter((sm) => sm.status === stParam);
    }
    const list = items.map((sm) => {
      const u = (dbData.users || []).find((x) => x.id === sm.dicatat_oleh);
      const d = (dbData.disposisi || []).find((x) => x.surat_masuk_id === sm.id);
      const sk = (dbData.surat_keluar || []).find((x) => x.surat_masuk_id === sm.id);
      return {
        ...sm,
        pencatat: u?.nama || null,
        disposisi_id: d?.id || null,
        disposisi_sifat: d?.sifat || null,
        tujuan_disposisi: d?.tujuan_disposisi || null,
        disposisi_arahan: d?.arahan || null,
        surat_keluar_id: sk?.id || null,
        nomor_surat_balasan: sk?.nomor_surat || null,
      };
    });
    return list.sort((a, b) => (b.id || 0) - (a.id || 0));
  }
  if (upper.includes('FROM SURAT_MASUK SM') && upper.includes('WHERE SM.ID = ?')) {
    const smId = Number(params[0]);
    const sm = (dbData.surat_masuk || []).find((x) => x.id === smId);
    if (!sm) return [];
    const u = (dbData.users || []).find((x) => x.id === sm.dicatat_oleh);
    return [{ ...sm, pencatat: u?.nama || null }];
  }
  if (upper.includes('FROM DISPOSISI D') && upper.includes('WHERE D.SURAT_MASUK_ID')) {
    const smId = Number(params[0]);
    return (dbData.disposisi || [])
      .filter((d) => d.surat_masuk_id === smId)
      .map((d) => {
        const u = (dbData.users || []).find((x) => x.id === d.lurah_id);
        return { ...d, lurah_nama: u?.nama || null, lurah_jabatan: u?.jabatan || null };
      })
      .sort((a, b) => (b.id || 0) - (a.id || 0));
  }

  // 11e. SURAT KELUAR (PETUGAS / LURAH)
  if (upper.startsWith('INSERT INTO SURAT_KELUAR')) {
    dbData.surat_keluar = dbData.surat_keluar || [];
    const newId = (dbData.surat_keluar.length ? Math.max(...dbData.surat_keluar.map((r) => r.id || 0)) : 0) + 1;
    const hasSm = upper.includes('SURAT_MASUK_ID');
    const row = hasSm
      ? {
          id: newId,
          surat_masuk_id: Number(params[0]),
          nomor_surat: params[1],
          tujuan: params[2],
          perihal: params[3],
          isi_surat: params[4],
          tanggal_surat: new Date().toISOString().slice(0, 10),
          file_path: params[5],
          petugas_id: Number(params[6]),
          ditandatangani_oleh: Number(params[7]),
          status: 'dikirim',
          created_at: new Date().toISOString(),
        }
      : {
          id: newId,
          surat_masuk_id: null,
          nomor_surat: params[0],
          tujuan: params[1],
          perihal: params[2],
          isi_surat: params[3],
          tanggal_surat: new Date().toISOString().slice(0, 10),
          file_path: params[4],
          petugas_id: Number(params[5]),
          ditandatangani_oleh: Number(params[6]),
          status: 'dikirim',
          created_at: new Date().toISOString(),
        };
    dbData.surat_keluar.push(row);
    saveLocalDb();
    return [{ id: newId }];
  }
  if (upper.includes('FROM SURAT_KELUAR SK')) {
    let list = [...(dbData.surat_keluar || [])];
    if (upper.includes('WHERE SK.SURAT_MASUK_ID = ?') && params.length) {
      const smId = Number(params[0]);
      list = list.filter((x) => x.surat_masuk_id === smId);
    }
    return list
      .map((sk) => {
        const sm = sk.surat_masuk_id ? (dbData.surat_masuk || []).find((x) => x.id === sk.surat_masuk_id) : null;
        const p = (dbData.users || []).find((x) => x.id === sk.petugas_id);
        const l = (dbData.users || []).find((x) => x.id === sk.ditandatangani_oleh);
        return {
          ...sk,
          nomor_surat_masuk: sm?.nomor_surat || null,
          pengirim_asal: sm?.pengirim || null,
          pembuat: p?.nama || null,
          pembuat_role: p?.role || null,
          penandatangan: l?.nama || null,
        };
      })
      .sort((a, b) => (b.id || 0) - (a.id || 0));
  }

  // 12. Generic SELECT / INSERT / UPDATE Fallback
  // Cek tabel yang ditarget
  const tableMatch = cleanSql.match(/(?:FROM|INTO|UPDATE)\s+([a-zA-Z0-9_]+)/i);
  const tableName = tableMatch ? tableMatch[1].toLowerCase() : null;

  if (tableName && dbData[tableName]) {
    if (upper.startsWith('SELECT')) {
      if (upper.includes('WHERE') && params.length > 0) {
        const whereMatch = cleanSql.match(/WHERE\s+([a-zA-Z0-9_\.]+)\s*=\s*\?/i);
        if (whereMatch) {
          const col = whereMatch[1].split('.').pop().toLowerCase();
          const val = params[0];
          return dbData[tableName].filter((row) => String(row[col] ?? '') === String(val ?? ''));
        }
      }
      return [...dbData[tableName]];
    }
    if (upper.startsWith('INSERT')) {
      const newId = (dbData[tableName].length ? Math.max(...dbData[tableName].map((r) => r.id || 0)) : 0) + 1;
      const newRow = { id: newId, created_at: new Date().toISOString() };
      dbData[tableName].push(newRow);
      saveLocalDb();
      return [{ id: newId }];
    }
    if (upper.startsWith('UPDATE') || upper.startsWith('DELETE')) {
      return [{ rowCount: 1, affectedRows: 1 }];
    }
  }

  return [];
}

// ----------------------------------------------------------------
// Helper: HTTP POST ke Supabase REST API
// ----------------------------------------------------------------
function rpcPost(funcName, body) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return reject(new Error('SUPABASE_NOT_CONFIGURED'));
    }

    const payload = JSON.stringify(body);
    let url;
    try {
      url = new URL(`${SUPABASE_URL}/rest/v1/rpc/${funcName}`);
    } catch (e) {
      return reject(e);
    }

    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: 'return=representation',
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = { message: data }; }
          const msg = parsed?.message || parsed?.hint || `HTTP ${res.statusCode}`;
          const err = new Error(msg);
          err.status = res.statusCode >= 400 && res.statusCode < 500 ? res.statusCode : 500;
          err.pgCode = parsed?.code;
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('TIMEOUT'));
    });
    req.write(payload);
    req.end();
  });
}

// ----------------------------------------------------------------
// Escape parameter nilai ke literal SQL yang aman
// ----------------------------------------------------------------
function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') {
    if (Number.isNaN(val)) return 'NULL';
    return String(val);
  }
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return 'NULL';
    return val.map((v) => escapeSqlVal(v)).join(', ');
  }
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val);
    return `'${jsonStr.replace(/'/g, "''")}'::jsonb`;
  }
  const str = String(val);
  return `'${str.replace(/'/g, "''")}'`;
}

function translateQuery(sql, params = []) {
  let cleanSql = sql
    .replace(/\bYEAR\s*\(\s*([^)]+)\s*\)/gi, 'EXTRACT(YEAR FROM $1)')
    .replace(
      /\bDATE_FORMAT\s*\(\s*([^,]+)\s*,\s*'%Y-%m'\s*\)/gi,
      "TO_CHAR($1, 'YYYY-MM')"
    );

  let newSql = '';
  let inStr = false;
  let strChar = '';
  let paramIdx = 0;

  for (let i = 0; i < cleanSql.length; i++) {
    const ch = cleanSql[i];
    if (inStr) {
      newSql += ch;
      if (ch === strChar && cleanSql[i - 1] !== '\\') inStr = false;
    } else if (ch === "'" || ch === '"') {
      inStr = true;
      strChar = ch;
      newSql += ch;
    } else if (ch === '?') {
      const val = params[paramIdx++];
      newSql += escapeSqlVal(val);
    } else {
      newSql += ch;
    }
  }

  const trimmed = newSql.trim();
  if (/^INSERT\s+INTO/i.test(trimmed) && !/RETURNING/i.test(trimmed)) {
    newSql = `${trimmed} RETURNING id`;
  }

  return { sql: newSql };
}

function queryType(sql) {
  const s = sql.trim().toUpperCase();
  if (s.startsWith('INSERT')) return 'insert';
  if (s.startsWith('SELECT') || s.startsWith('WITH')) return 'select';
  return 'mutate';
}

// ----------------------------------------------------------------
// API utama: db.query(sql, params)
// ----------------------------------------------------------------
const db = {
  async query(sql, params = []) {
    // Jika sudah ditandai fallback atau Supabase belum diset, langsung pakai local fallback
    if (useLocalFallback || !SUPABASE_URL || !SUPABASE_KEY) {
      const localResult = executeLocalSql(sql, params);
      const rows = Array.isArray(localResult) ? localResult : (localResult ? [localResult] : []);
      const insertId = rows[0]?.id ?? null;
      rows.insertId = insertId;
      rows.affectedRows = rows.length;
      rows.rowCount = rows.length;
      return [rows, { insertId, affectedRows: rows.length, rowCount: rows.length }];
    }

    const { sql: pgSql } = translateQuery(sql, params);
    const type = queryType(pgSql);

    let funcName;
    if (type === 'insert') funcName = 'sipesur_insert';
    else if (type === 'select') funcName = 'sipesur_exec';
    else funcName = 'sipesur_mutate';

    let raw;
    try {
      raw = await rpcPost(funcName, { query: pgSql });
    } catch (err) {
      // Jika kegagalan jaringan (ENOTFOUND, TIMEOUT, atau offline), aktifkan mode local fallback otomatis
      if (
        err.message?.includes('ENOTFOUND') ||
        err.message?.includes('TIMEOUT') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('SUPABASE_NOT_CONFIGURED')
      ) {
        if (!useLocalFallback) {
          console.warn('[DB] Supabase offline / tidak terjangkau. Beralih otomatis ke Local Storage Engine.');
          useLocalFallback = true;
        }
        const localResult = executeLocalSql(sql, params);
        const rows = Array.isArray(localResult) ? localResult : (localResult ? [localResult] : []);
        const insertId = rows[0]?.id ?? null;
        rows.insertId = insertId;
        rows.affectedRows = rows.length;
        rows.rowCount = rows.length;
        return [rows, { insertId, affectedRows: rows.length, rowCount: rows.length }];
      }

      console.error('[DB Error]', err.message);
      console.error('[DB SQL]', pgSql.slice(0, 200));
      throw err;
    }

    if (type === 'mutate') {
      const meta = raw || { rowCount: 0, affectedRows: 0 };
      const rows = [];
      rows.insertId = null;
      rows.affectedRows = meta.affectedRows || 0;
      rows.rowCount = meta.rowCount || 0;
      return [rows, meta];
    }

    const rows = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const insertId = type === 'insert' ? (rows[0]?.id ?? null) : null;
    const rowCount = rows.length;

    rows.insertId = insertId;
    rows.affectedRows = rowCount;
    rows.rowCount = rowCount;

    const meta = { insertId, affectedRows: rowCount, rowCount };
    return [rows, meta];
  },

  pool: {
    async query(sql, params) {
      return db.query(sql, params);
    },
    async end() {},
  },

  isLocalMode() {
    return useLocalFallback || !SUPABASE_URL || !SUPABASE_KEY;
  },

  async end() {},
};

export default db;
