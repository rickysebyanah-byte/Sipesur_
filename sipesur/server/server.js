import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import db from './db.js';
import { buatPdf, buatPdfSuratDinas } from './pdf.js';

const SECRET = process.env.JWT_SECRET || 'sipesur-jwt-secret-key-32-chars-long';
if (process.env.VERCEL && !process.env.JWT_SECRET) {
  console.warn('[SIPESUR] JWT_SECRET belum diisi di Environment Variables Vercel.');
}

// URL publik aplikasi: dipakai untuk tautan QR pada surat.
// Urutan: CLIENT_URL -> domain produksi Vercel -> localhost.
const CLIENT =
  process.env.CLIENT_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  'http://localhost:5173';

// Di Vercel, satu-satunya folder yang bisa ditulis adalah /tmp (sementara, hilang saat instance berganti).
const DATA_DIR = process.env.VERCEL ? '/tmp/sipesur' : process.cwd();

const app = express();
const q = async (s, p = []) => (await db.query(s, p))[0];
const fail = (s, m) => Object.assign(new Error(m), { status: s });
const ah = (f) => (a, b, n) => f(a, b, n).catch(n);
const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Helper untuk sensor / masking data NIK dan No KK
const maskId = (str) => {
  if (!str || str.length < 16) return str || '-';
  return str.slice(0, 6) + '******' + str.slice(12);
};

const log = async (req, aksi, detail = '', customUserId = undefined) => {
  try {
    const uid = customUserId !== undefined ? customUserId : (req.user?.id || null);
    await q('INSERT INTO activity_logs(user_id,aksi,detail,ip) VALUES(?,?,?,?)', [
      uid,
      aksi,
      String(detail).slice(0, 250),
      req.ip,
    ]);
  } catch (err) {
    console.warn('Gagal mencatat activity log (diabaikan agar proses utama tidak terganggu):', err?.message || err);
  }
};

const notif = (uid, pesan) =>
  q('INSERT INTO notifikasi(user_id,pesan) VALUES(?,?)', [uid, pesan]);

const notifRole = (r, pesan) =>
  q('INSERT INTO notifikasi(user_id,pesan) SELECT id,? FROM users WHERE role=? AND aktif=1', [pesan, r]);

// Middleware Keamanan & CORS
app.use(
  helmet({ crossOriginResourcePolicy: false }),
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin === CLIENT ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      callback(null, true);
    },
    credentials: true,
  }),
  express.json({ limit: '200mb' }),
  express.urlencoded({ limit: '200mb', extended: true }),
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 600 })
);

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { message: 'Terlalu banyak percobaan, coba lagi nanti dalam 15 menit' },
});

const registerLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  message: { message: 'Terlalu banyak pendaftaran dari perangkat ini, coba lagi nanti' },
});

const auth = (req, res, next) => {
  try {
    const raw = (req.headers.authorization || '').replace('Bearer ', '').trim() || req.query.token;
    if (!raw) throw new Error('NO_TOKEN');
    req.user = jwt.verify(raw, SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Sesi berakhir, silakan login kembali' });
  }
};

const role = (...r) => (req, res, next) =>
  r.includes(req.user.role) ? next() : res.status(403).json({ message: 'Akses ditolak' });

const upload = multer({
  storage: multer.diskStorage({
    destination: (r, f, cb) => {
      const dir = path.join(DATA_DIR, 'uploads');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (r, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase()),
  }),
  limits: {
    // Tanpa batasan ukuran berkas (bebas ukuran gambar & dokumen)
    fileSize: Infinity,
    fieldSize: Infinity,
  },
  fileFilter: (r, f, cb) => {
    // Menerima semua format gambar (JPG, JPEG, PNG, WEBP, GIF, BMP, SVG, TIFF) serta dokumen PDF
    const isImage = (f.mimetype && f.mimetype.startsWith('image/')) || /\.(jpe?g|png|webp|gif|bmp|svg|tiff?)$/i.test(f.originalname);
    const isPdf = f.mimetype === 'application/pdf' || /\.pdf$/i.test(f.originalname);
    if (isImage || isPdf) {
      return cb(null, true);
    }
    return cb(fail(400, 'Format berkas tidak didukung. Harap unggah berkas Gambar atau PDF.'));
  },
});

const getP = async (id, user) => {
  if (user.role === 'warga') {
    const [uc] = await q('SELECT status_verifikasi FROM users WHERE id=?', [user.id]);
    if (uc?.status_verifikasi !== 'terverifikasi') {
      throw fail(403, 'Akun Anda belum terverifikasi oleh petugas kelurahan.');
    }
  }
  const [p] = await q(
    'SELECT p.*, j.nama AS jenis, j.kode AS jkode, j.form_fields, j.template, u.nama AS pemohon, w.nik, w.no_kk, w.tempat_lahir, w.tanggal_lahir, w.jenis_kelamin, w.alamat, w.pekerjaan, w.telepon FROM pengajuan p JOIN jenis_surat j ON j.id=p.jenis_surat_id JOIN users u ON u.id=p.user_id LEFT JOIN warga w ON w.user_id=p.user_id WHERE p.id=?',
    [id]
  );
  if (!p) throw fail(404, 'Pengajuan tidak ditemukan');
  if (user.role === 'warga' && p.user_id !== user.id) throw fail(403, 'Akses ditolak');
  if (typeof p.data_form === 'string') {
    try { p.data_form = JSON.parse(p.data_form); } catch { }
  }
  if (typeof p.form_fields === 'string') {
    try { p.form_fields = JSON.parse(p.form_fields); } catch { }
  }
  if (p.data_form && p.data_form.redaksi_kustom) {
    p.template = p.data_form.redaksi_kustom;
  }
  return p;
};

const move = async (id, from, to, catatan) => {
  const [r] = await db.query(
    'UPDATE pengajuan SET status=?, catatan=? WHERE id=? AND status IN (?)',
    [to, catatan || null, id, from]
  );
  if (!r.affectedRows) throw fail(409, 'Status pengajuan tidak sesuai untuk aksi ini');
};

async function saveDocs(files, pid, jid) {
  const syar = await q('SELECT id FROM persyaratan WHERE jenis_surat_id=?', [jid]);
  for (const f of files) {
    const s = syar.find((x) => 'doc_' + x.id === f.fieldname);
    if (!s) {
      fs.unlink(f.path, () => { });
      continue;
    }
    const oldDocs = await q('SELECT path FROM dokumen WHERE pengajuan_id=? AND persyaratan_id=?', [pid, s.id]);
    oldDocs.forEach((o) => fs.unlink(o.path, () => { }));
    await q('DELETE FROM dokumen WHERE pengajuan_id=? AND persyaratan_id=?', [pid, s.id]);
    await q(
      'INSERT INTO dokumen(pengajuan_id,persyaratan_id,nama_file,path,mime) VALUES(?,?,?,?,?)',
      [pid, s.id, f.originalname, f.path, f.mimetype]
    );
  }
}

const lengkap = async (pid, jid) => {
  const [c] = await q(
    'SELECT (SELECT COUNT(*)::int FROM persyaratan WHERE jenis_surat_id=?) AS a, (SELECT COUNT(*)::int FROM dokumen WHERE pengajuan_id=?) AS b',
    [jid, pid]
  );
  return parseInt(c?.a || 0, 10) === parseInt(c?.b || 0, 10);
};

/* ====================================================================
   1. FITUR AUTENTIKASI & REGISTRASI WARGA
   ==================================================================== */

/**
 * Pendaftaran Akun Warga Mandiri
 * Data: NIK (16 digit), No KK (16 digit), Nama, Tempat/Tgl Lahir, Jenis Kelamin,
 * Alamat lengkap, No HP/WA, Email (opsional), Password, Konfirmasi Password, Persetujuan Syarat.
 */
app.post(
  '/api/auth/register',
  registerLimit,
  ah(async (req, res) => {
    const {
      nik,
      no_kk,
      nama,
      tempat_lahir,
      tanggal_lahir,
      jenis_kelamin,
      alamat,
      pekerjaan,
      telepon,
      email,
      password,
      konfirmasi_password,
      setuju_syarat,
    } = req.body;

    // 1. Validasi Syarat & Ketentuan
    if (!setuju_syarat) {
      throw fail(400, 'Anda wajib menyetujui syarat dan ketentuan layanan SIPESUR.');
    }

    // 2. Validasi NIK & No KK (Tepat 16 digit angka)
    const cleanNik = String(nik || '').trim();
    const cleanKk = String(no_kk || '').trim();
    if (!/^\d{16}$/.test(cleanNik)) {
      throw fail(400, 'NIK harus tepat 16 digit angka.');
    }
    if (!/^\d{16}$/.test(cleanKk)) {
      throw fail(400, 'Nomor Kartu Keluarga (KK) harus tepat 16 digit angka.');
    }

    // 3. Validasi Nama & Data Diri Wajib
    if (!nama || nama.trim().length < 3) {
      throw fail(400, 'Nama lengkap minimal 3 karakter.');
    }
    if (!tempat_lahir || !tempat_lahir.trim()) {
      throw fail(400, 'Tempat lahir wajib diisi.');
    }
    if (!tanggal_lahir || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal_lahir)) {
      throw fail(400, 'Tanggal lahir wajib diisi dengan format yang benar.');
    }
    if (!['L', 'P'].includes(jenis_kelamin)) {
      throw fail(400, 'Jenis kelamin harus L (Laki-laki) atau P (Perempuan).');
    }
    if (!alamat || alamat.trim().length < 5) {
      throw fail(400, 'Alamat lengkap wajib diisi (minimal 5 karakter).');
    }
    if (!telepon || telepon.trim().length < 9) {
      throw fail(400, 'Nomor HP/WhatsApp wajib diisi minimal 9 digit.');
    }

    // 4. Validasi Email (Opsional, tapi jika diisi format harus valid)
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    if (cleanEmail && !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      throw fail(400, 'Format email tidak valid.');
    }

    // 5. Validasi Standar Keamanan Password
    const pw = String(password || '');
    if (pw.length < 8) {
      throw fail(400, 'Password minimal 8 karakter.');
    }
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
      throw fail(400, 'Password harus mengombinasikan huruf dan angka.');
    }
    if (pw !== konfirmasi_password) {
      throw fail(400, 'Konfirmasi password tidak sama dengan password.');
    }

    // 6. Cek Keunikan NIK di database
    const [existingNik] = await q('SELECT id FROM warga WHERE nik=?', [cleanNik]);
    if (existingNik) {
      throw fail(409, 'NIK sudah terdaftar dalam sistem SIPESUR.');
    }

    // 7. Cek Keunikan Email jika diisi
    if (cleanEmail) {
      const [existingEmail] = await q('SELECT id FROM users WHERE email=?', [cleanEmail]);
      if (existingEmail) {
        throw fail(409, 'Email sudah terdaftar dalam sistem.');
      }
    }

    // 8. Hash Password & Simpan Akun dengan status 'menunggu_verifikasi'
    const passwordHash = await bcrypt.hash(pw, 10);
    const [userRes] = await db.query(
      'INSERT INTO users(nama,email,username,password,role,status_verifikasi,aktif) VALUES(?,?,?,?,?,?,?)',
      [
        nama.trim(),
        cleanEmail || null,
        cleanNik, // Username default warga adalah NIK
        passwordHash,
        'warga',
        'menunggu_verifikasi',
        1,
      ]
    );

    await q(
      'INSERT INTO warga(user_id,nik,no_kk,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,pekerjaan,telepon) VALUES(?,?,?,?,?,?,?,?,?)',
      [
        userRes.insertId,
        cleanNik,
        cleanKk,
        tempat_lahir.trim(),
        tanggal_lahir,
        jenis_kelamin,
        alamat.trim(),
        pekerjaan ? pekerjaan.trim() : null,
        telepon.trim(),
      ]
    );

    // Kirim notifikasi ke petugas kelurahan bahwa ada pendaftaran baru
    await notifRole(
      'petugas',
      `Pendaftaran warga baru: ${nama.trim()} (NIK ${maskId(cleanNik)}) menunggu verifikasi data.`
    );

    req.user = { id: userRes.insertId };
    await log(req, 'REGISTER_WARGA', `NIK: ${maskId(cleanNik)}, Nama: ${nama.trim()}`);

    res.status(201).json({
      message:
        'Pendaftaran berhasil! Akun Anda saat ini berstatus Menunggu Verifikasi oleh petugas kelurahan. Anda dapat login untuk memantau status verifikasi.',
      status_verifikasi: 'menunggu_verifikasi',
      nik_masked: maskId(cleanNik),
    });
  })
);

/**
 * Halaman Login Terpadu
 * - Warga login menggunakan NIK atau Email + Password.
 * - Petugas / Lurah login menggunakan NIP, Username, atau Email + Password.
 * - Admin login menggunakan Username atau Email + Password.
 */
app.post(
  '/api/auth/login',
  loginLimit,
  ah(async (req, res) => {
    const identifier = String(req.body.identifier || req.body.email || '').trim();
    const password = String(req.body.password || '');

    if (!identifier || !password) {
      throw fail(400, 'NIK / NIP / Username / Email dan password wajib diisi.');
    }

    // Cari pengguna berdasarkan identifier (Email / Username / NIP / NIK Warga)
    const [u] = await q(
      `SELECT u.*, w.nik, w.no_kk, w.tempat_lahir, w.tanggal_lahir, w.jenis_kelamin, w.alamat, w.pekerjaan, w.telepon AS telepon_warga
       FROM users u
       LEFT JOIN warga w ON w.user_id = u.id
       WHERE u.email = ? OR u.username = ? OR u.nip = ? OR w.nik = ?`,
      [identifier, identifier, identifier, identifier]
    );

    if (!u || !(await bcrypt.compare(password, u.password))) {
      throw fail(401, 'Kredensial salah: NIK / NIP / Username / Email atau password tidak cocok.');
    }

    if (!u.aktif) {
      throw fail(403, 'Akun Anda telah dinonaktifkan oleh Administrator. Silakan hubungi kantor kelurahan.');
    }

    // Cek jika akun warga ditolak verifikasinya
    if (u.role === 'warga' && u.status_verifikasi === 'ditolak') {
      throw fail(
        403,
        `Pendaftaran akun Anda ditolak oleh petugas kelurahan. Catatan: ${u.catatan_verifikasi || 'Data tidak sesuai dokumen kependudukan'
        }. Silakan hubungi kantor kelurahan.`
      );
    }

    req.user = u;
    await log(req, 'LOGIN');

    const token = jwt.sign(
      {
        id: u.id,
        role: u.role,
        nama: u.nama,
        status_verifikasi: u.status_verifikasi,
        must_change_password: Boolean(u.must_change_password),
      },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: u.id,
        nama: u.nama,
        email: u.email,
        username: u.username,
        nip: u.nip,
        jabatan: u.jabatan,
        role: u.role,
        status_verifikasi: u.status_verifikasi,
        catatan_verifikasi: u.catatan_verifikasi,
        must_change_password: Boolean(u.must_change_password),
        nik_masked: u.nik ? maskId(u.nik) : null,
      },
      notice:
        u.role === 'warga' && u.status_verifikasi === 'menunggu_verifikasi'
          ? 'Akun Anda sedang Menunggu Verifikasi oleh petugas. Layanan pengajuan surat akan aktif setelah akun diverifikasi.'
          : null,
    });
  })
);

/**
 * Ganti Password (Wajib untuk Akun Pemerintahan saat login perdana, atau warga mengubah password mandiri)
 */
app.post(
  '/api/auth/ganti-password',
  auth,
  ah(async (req, res) => {
    const { password_lama, password_baru, konfirmasi_password } = req.body;
    if (!password_lama || !password_baru) {
      throw fail(400, 'Password lama dan password baru wajib diisi.');
    }
    if (password_baru.length < 8 || !/[A-Za-z]/.test(password_baru) || !/\d/.test(password_baru)) {
      throw fail(400, 'Password baru minimal 8 karakter dan mengombinasikan huruf serta angka.');
    }
    if (password_baru !== konfirmasi_password) {
      throw fail(400, 'Konfirmasi password baru tidak cocok.');
    }

    const [u] = await q('SELECT password FROM users WHERE id=?', [req.user.id]);
    if (!u || !(await bcrypt.compare(password_lama, u.password))) {
      throw fail(400, 'Password saat ini salah.');
    }

    const newHash = await bcrypt.hash(password_baru, 10);
    await q('UPDATE users SET password=?, must_change_password=0 WHERE id=?', [newHash, req.user.id]);

    await log(req, 'GANTI_PASSWORD');
    res.json({ message: 'Password berhasil diubah. Silakan gunakan password baru untuk login berikutnya.' });
  })
);

/**
 * Profil Pengguna Saat Ini
 */
app.get(
  '/api/me',
  auth,
  ah(async (req, res) => {
    const [u] = await q(
      `SELECT u.id, u.nama, u.email, u.username, u.nip, u.jabatan, u.role, u.status_verifikasi,
              u.catatan_verifikasi, u.must_change_password, u.aktif,
              w.nik, w.no_kk, w.tempat_lahir, w.tanggal_lahir, w.jenis_kelamin, w.alamat, w.pekerjaan, w.telepon
       FROM users u
       LEFT JOIN warga w ON w.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!u) throw fail(404, 'Pengguna tidak ditemukan');

    res.json({
      ...u,
      nik_masked: u.nik ? maskId(u.nik) : null,
      no_kk_masked: u.no_kk ? maskId(u.no_kk) : null,
    });
  })
);

app.put(
  '/api/profil',
  auth,
  role('warga'),
  ah(async (req, res) => {
    const b = req.body;
    if (!b.nama || b.nama.trim().length < 3) throw fail(400, 'Nama minimal 3 karakter.');
    await q('UPDATE users SET nama=? WHERE id=?', [b.nama.trim(), req.user.id]);
    await q(
      'UPDATE warga SET tempat_lahir=?,tanggal_lahir=?,jenis_kelamin=?,alamat=?,pekerjaan=?,telepon=? WHERE user_id=?',
      [
        b.tempat_lahir || null,
        b.tanggal_lahir || null,
        ['L', 'P'].includes(b.jenis_kelamin) ? b.jenis_kelamin : null,
        b.alamat || null,
        b.pekerjaan || null,
        b.telepon || null,
        req.user.id,
      ]
    );
    await log(req, 'UPDATE_PROFIL');
    res.json({ message: 'Profil berhasil disimpan.' });
  })
);

/**
 * Hapus Akun Sendiri Secara Mandiri (Self-Service Account Deletion)
 * Endpoint: DELETE /api/profil dan DELETE /api/users/me
 * Menghapus seluruh data pribadi, kependudukan, pengajuan, dokumen, dan notifikasi pemilik akun.
 */
const handleHapusAkunSendiri = async (req, res) => {
  const userId = req.user.id;
  const { password } = req.body || {};

  if (!password || !password.trim()) {
    throw fail(400, 'Silakan masukkan kata sandi Anda untuk mengonfirmasi penghapusan akun.');
  }

  const [u] = await q('SELECT id, nama, username, email, role, password FROM users WHERE id=?', [userId]);
  if (!u) throw fail(404, 'Data akun pengguna tidak ditemukan.');

  const match = await bcrypt.compare(password.trim(), u.password);
  if (!match) {
    throw fail(400, 'Kata sandi salah. Demi keamanan, penghapusan akun dibatalkan.');
  }

  // Jika admin, pastikan bukan satu-satunya admin aktif agar sistem tidak terkunci
  if (u.role === 'admin') {
    const otherAdmins = await q("SELECT id FROM users WHERE role='admin' AND aktif=1 AND id != ?", [userId]);
    if (!otherAdmins.length) {
      throw fail(400, 'Tidak dapat menghapus akun: Anda adalah satu-satunya Administrator aktif pada sistem.');
    }
  }

  // 1. Catat audit log penghapusan akun mandiri secara permanen
  // Gunakan user_id = null agar integritas foreign key di database tetap terjaga setelah akun dihapus
  await log(req, 'HAPUS_AKUN_SENDIRI', `User ID: ${userId}, Nama: ${u.nama || u.username}, Role: ${u.role}`, null);

  // 2. Ambil semua pengajuan milik user dan bersihkan berkas fisik serta relasinya
  const pengajuanList = await q('SELECT id FROM pengajuan WHERE user_id=?', [userId]);
  for (const p of pengajuanList) {
    // Bersihkan berkas fisik surat jika ada
    const surats = await q('SELECT file_path FROM surat WHERE pengajuan_id=?', [p.id]);
    for (const s of surats) {
      if (s.file_path && fs.existsSync(s.file_path)) {
        try { fs.unlinkSync(s.file_path); } catch (_) {}
      }
    }
    // Bersihkan berkas fisik dokumen persyaratan jika ada
    const doks = await q('SELECT file_path FROM dokumen WHERE pengajuan_id=?', [p.id]);
    for (const d of doks) {
      if (d.file_path && fs.existsSync(d.file_path)) {
        try { fs.unlinkSync(d.file_path); } catch (_) {}
      }
    }

    await q('DELETE FROM surat WHERE pengajuan_id=?', [p.id]);
    await q('DELETE FROM persetujuan WHERE pengajuan_id=?', [p.id]);
    await q('DELETE FROM verifikasi WHERE pengajuan_id=?', [p.id]);
    await q('DELETE FROM dokumen WHERE pengajuan_id=?', [p.id]);
  }
  await q('DELETE FROM pengajuan WHERE user_id=?', [userId]);

  // 3. Hapus data kependudukan (warga) dan notifikasi
  await q('DELETE FROM warga WHERE user_id=?', [userId]);
  await q('DELETE FROM notifikasi WHERE user_id=?', [userId]);

  // 4. Set NULL referensi di log aktivitas, artikel berita, dan berkas dinas jika ada
  try {
    await q('UPDATE activity_logs SET user_id=NULL WHERE user_id=?', [userId]);
    await q('UPDATE berita SET penulis_id=NULL WHERE penulis_id=?', [userId]);
    await q('UPDATE galeri_kegiatan SET penulis_id=NULL WHERE penulis_id=?', [userId]);
    await q('UPDATE users SET diverifikasi_oleh=NULL WHERE diverifikasi_oleh=?', [userId]);
    await q('UPDATE surat_masuk SET dicatat_oleh=NULL WHERE dicatat_oleh=?', [userId]);
    await q('UPDATE disposisi SET diberikan_oleh=NULL WHERE diberikan_oleh=?', [userId]);
    await q('UPDATE surat_keluar SET petugas_id=NULL WHERE petugas_id=?', [userId]);
    await q('UPDATE surat_keluar SET ditandatangani_oleh=NULL WHERE ditandatangani_oleh=?', [userId]);
  } catch (_) {}

  // 5. Hapus akun user secara permanen
  await q('DELETE FROM users WHERE id=?', [userId]);

  res.json({ message: 'Akun Anda telah berhasil dihapus secara permanen dari sistem SIPESUR.' });
};

app.delete('/api/profil', auth, ah(handleHapusAkunSendiri));
app.delete('/api/users/me', auth, ah(handleHapusAkunSendiri));

/* ====================================================================
   PROFIL DESA & KOP SURAT DINAMIS (ADMIN, PETUGAS, LURAH)
   ==================================================================== */

/* ====================================================================
   BERITA & PENGUMUMAN KELURAHAN (PUBLIK BACA, PETUGAS & LURAH KELOLA)
   ==================================================================== */

app.get('/api/berita', ah(async (req, res) => {
  const rows = await q('SELECT * FROM berita ORDER BY tanggal DESC, id DESC LIMIT 50');
  res.json(rows);
}));

app.post('/api/berita', auth, role('petugas', 'lurah'), ah(async (req, res) => {
  const { judul, isi, kategori, tanggal } = req.body;
  if (!judul || !judul.trim()) throw fail(400, 'Judul berita wajib diisi');
  if (!isi || !isi.trim()) throw fail(400, 'Isi berita wajib diisi');
  const tgl = tanggal || new Date().toISOString().split('T')[0];
  const kat = kategori || 'Pengumuman';
  await q('INSERT INTO berita (judul, isi, kategori, tanggal, penulis_id) VALUES (?, ?, ?, ?, ?)',
    [judul.trim(), isi.trim(), kat, tgl, req.user.id]);
  await log(req, 'TAMBAH_BERITA', judul.trim());
  res.status(201).json({ message: 'Berita berhasil ditambahkan' });
}));

app.put('/api/berita/:id', auth, role('petugas', 'lurah'), ah(async (req, res) => {
  const { judul, isi, kategori, tanggal } = req.body;
  if (!judul || !judul.trim()) throw fail(400, 'Judul berita wajib diisi');
  await q('UPDATE berita SET judul=?, isi=?, kategori=?, tanggal=?, updated_at=NOW() WHERE id=?',
    [judul.trim(), isi.trim(), kategori || 'Pengumuman', tanggal, req.params.id]);
  await log(req, 'UPDATE_BERITA', judul.trim());
  res.json({ message: 'Berita berhasil diperbarui' });
}));

app.delete('/api/berita/:id', auth, role('petugas', 'lurah'), ah(async (req, res) => {
  await q('DELETE FROM berita WHERE id=?', [req.params.id]);
  await log(req, 'HAPUS_BERITA', `id=${req.params.id}`);
  res.json({ message: 'Berita berhasil dihapus' });
}));

/* ====================================================================
   DIREKTORI UMKM LOKAL (PUBLIK BACA, PETUGAS & LURAH KELOLA)
   ==================================================================== */

app.get('/api/umkm', ah(async (req, res) => {
  const rows = await q('SELECT * FROM umkm ORDER BY nama ASC');
  res.json(rows);
}));

app.post('/api/umkm', auth, role('petugas', 'lurah'), ah(async (req, res) => {
  const { nama, jenis, alamat, telepon, deskripsi } = req.body;
  if (!nama || !nama.trim()) throw fail(400, 'Nama UMKM wajib diisi');
  await q('INSERT INTO umkm (nama, jenis, alamat, telepon, deskripsi) VALUES (?, ?, ?, ?, ?)',
    [nama.trim(), jenis || '', alamat || '', telepon || '', deskripsi || '']);
  await log(req, 'TAMBAH_UMKM', nama.trim());
  res.status(201).json({ message: 'UMKM berhasil ditambahkan' });
}));

app.put('/api/umkm/:id', auth, role('petugas', 'lurah'), ah(async (req, res) => {
  const { nama, jenis, alamat, telepon, deskripsi } = req.body;
  if (!nama || !nama.trim()) throw fail(400, 'Nama UMKM wajib diisi');
  await q('UPDATE umkm SET nama=?, jenis=?, alamat=?, telepon=?, deskripsi=?, updated_at=NOW() WHERE id=?',
    [nama.trim(), jenis || '', alamat || '', telepon || '', deskripsi || '', req.params.id]);
  await log(req, 'UPDATE_UMKM', nama.trim());
  res.json({ message: 'UMKM berhasil diperbarui' });
}));

app.delete('/api/umkm/:id', auth, role('petugas', 'lurah'), ah(async (req, res) => {
  await q('DELETE FROM umkm WHERE id=?', [req.params.id]);
  await log(req, 'HAPUS_UMKM', `id=${req.params.id}`);
  res.json({ message: 'UMKM berhasil dihapus' });
}));

/* ====================================================================
   GALERI KEGIATAN KELURAHAN (PUBLIK BACA, PETUGAS & LURAH KELOLA)
   ==================================================================== */

app.get('/api/galeri', ah(async (req, res) => {
  const rows = await q('SELECT * FROM galeri_kegiatan ORDER BY tanggal DESC, id DESC LIMIT 30');
  res.json(rows);
}));

app.post('/api/galeri', auth, role('petugas', 'lurah'), ah(async (req, res) => {
  const { judul, deskripsi, url_foto, tanggal } = req.body;
  if (!judul || !judul.trim()) throw fail(400, 'Judul kegiatan wajib diisi');
  if (!url_foto || !url_foto.trim()) throw fail(400, 'URL/data foto wajib diisi');
  const tgl = tanggal || new Date().toISOString().split('T')[0];
  await q('INSERT INTO galeri_kegiatan (judul, deskripsi, url_foto, tanggal, penulis_id) VALUES (?, ?, ?, ?, ?)',
    [judul.trim(), deskripsi || '', url_foto.trim(), tgl, req.user.id]);
  await log(req, 'TAMBAH_GALERI', judul.trim());
  res.status(201).json({ message: 'Foto kegiatan berhasil ditambahkan' });
}));

app.put('/api/galeri/:id', auth, role('petugas', 'lurah'), ah(async (req, res) => {
  const { judul, deskripsi, url_foto, tanggal } = req.body;
  if (!judul || !judul.trim()) throw fail(400, 'Judul kegiatan wajib diisi');
  await q('UPDATE galeri_kegiatan SET judul=?, deskripsi=?, url_foto=?, tanggal=?, updated_at=NOW() WHERE id=?',
    [judul.trim(), deskripsi || '', url_foto || '', tanggal, req.params.id]);
  await log(req, 'UPDATE_GALERI', judul.trim());
  res.json({ message: 'Foto kegiatan berhasil diperbarui' });
}));

app.delete('/api/galeri/:id', auth, role('petugas', 'lurah'), ah(async (req, res) => {
  await q('DELETE FROM galeri_kegiatan WHERE id=?', [req.params.id]);
  await log(req, 'HAPUS_GALERI', `id=${req.params.id}`);
  res.json({ message: 'Foto kegiatan berhasil dihapus' });
}));

/* ====================================================================
   TRANSPARANSI ANGGARAN KELURAHAN (PUBLIK BACA, EKSKLUSIF LURAH KELOLA)
   ==================================================================== */

app.get('/api/anggaran', ah(async (req, res) => {
  const rows = await q('SELECT * FROM anggaran ORDER BY tahun DESC, id DESC');
  res.json(rows);
}));

app.post('/api/anggaran', auth, role('lurah'), ah(async (req, res) => {
  const { tahun, program, pagu, realisasi, sumber, keterangan } = req.body;
  if (!tahun) throw fail(400, 'Tahun anggaran wajib diisi');
  if (!program || !program.trim()) throw fail(400, 'Program/kegiatan wajib diisi');
  await q('INSERT INTO anggaran (tahun, program, pagu, realisasi, sumber, keterangan) VALUES (?, ?, ?, ?, ?, ?)',
    [tahun, program.trim(), pagu || 0, realisasi || 0, sumber || 'APBD', keterangan || '']);
  await log(req, 'TAMBAH_ANGGARAN', `${tahun}: ${program}`);
  res.status(201).json({ message: 'Data anggaran berhasil ditambahkan' });
}));

app.put('/api/anggaran/:id', auth, role('lurah'), ah(async (req, res) => {
  const { tahun, program, pagu, realisasi, sumber, keterangan } = req.body;
  if (!program || !program.trim()) throw fail(400, 'Program/kegiatan wajib diisi');
  await q('UPDATE anggaran SET tahun=?, program=?, pagu=?, realisasi=?, sumber=?, keterangan=?, updated_at=NOW() WHERE id=?',
    [tahun, program.trim(), pagu || 0, realisasi || 0, sumber || 'APBD', keterangan || '', req.params.id]);
  await log(req, 'UPDATE_ANGGARAN', program.trim());
  res.json({ message: 'Data anggaran berhasil diperbarui' });
}));

app.delete('/api/anggaran/:id', auth, role('lurah'), ah(async (req, res) => {
  await q('DELETE FROM anggaran WHERE id=?', [req.params.id]);
  await log(req, 'HAPUS_ANGGARAN', `id=${req.params.id}`);
  res.json({ message: 'Data anggaran berhasil dihapus' });
}));

/* ====================================================================
   CEK STATUS PENGAJUAN PUBLIK (TANPA LOGIN)
   ==================================================================== */

app.get('/api/cek-status/:kode', ah(async (req, res) => {
  const kodeRaw = req.params.kode.trim();
  const kodeUpper = kodeRaw.toUpperCase();
  const idNum = /^\d+$/.test(kodeRaw) ? parseInt(kodeRaw, 10) : -1;

  // Cari berdasarkan ID pengajuan, kode unik pengajuan, atau nomor surat resmi
  const rows = await q(`
    SELECT p.id, p.kode, p.status, p.created_at, p.updated_at,
           p.catatan, j.nama AS jenis_surat,
           u.nama AS nama_pemohon,
           s.nomor AS nomor_surat
    FROM pengajuan p
    JOIN jenis_surat j ON p.jenis_surat_id = j.id
    JOIN users u ON p.user_id = u.id
    LEFT JOIN surat s ON s.pengajuan_id = p.id
    WHERE p.id = ? OR UPPER(p.kode) = ? OR UPPER(COALESCE(s.nomor, '')) = ?
    LIMIT 1
  `, [idNum, kodeUpper, kodeUpper]);
  if (!rows.length) throw fail(404, 'Pengajuan tidak ditemukan. Periksa kembali nomor atau kode tracking Anda.');
  const r = rows[0];
  res.json({
    id: r.id,
    kode: r.kode,
    nomor_surat: r.nomor_surat || null,
    jenis_surat: r.jenis_surat,
    nama_pemohon: r.nama_pemohon ? r.nama_pemohon.split(' ')[0] + '***' : '***',
    status: r.status,
    tanggal_pengajuan: r.created_at,
    tanggal_update: r.updated_at,
    catatan: r.catatan || null,
  });
}));

/* ====================================================================
   STATISTIK KELURAHAN PUBLIK (UNTUK LANDING PAGE)
   ==================================================================== */

app.get('/api/statistik-publik', ah(async (req, res) => {
  const [jml] = await q('SELECT COUNT(*) AS total FROM pengajuan');
  const [terbit] = await q("SELECT COUNT(*) AS total FROM pengajuan WHERE status = 'issued'");
  const [warga] = await q('SELECT COUNT(*) AS total FROM users WHERE role = ? AND aktif = 1', ['warga']);
  res.json({
    total_pengajuan: jml?.total || 0,
    total_terbit: terbit?.total || 0,
    total_warga: warga?.total || 0,
  });
}));

app.get(
  '/api/profil-desa',
  ah(async (req, res) => {
    const rows = await q('SELECT * FROM profil_desa ORDER BY id ASC LIMIT 1');
    const desa = rows[0] || {
      id: 1,
      nama_desa: 'Kelurahan Suka Maju',
      kecamatan: 'Kecamatan Medan Johor',
      kabupaten_kota: 'Pemerintah Kota Medan',
      provinsi: 'Sumatera Utara',
      alamat: 'Jl. STM No. 40, Kelurahan Suka Maju',
      kode_pos: '20146',
      telepon: '0823-4123-5734',
      email: 'kelurahan@pemkomedan.go.id',
      website: 'sukamaju.medan.go.id',
      logo_url: null,
      nama_lurah: 'Muhammad Iqbal Samosir, S.E., M.A.P.',
      nip_lurah: '198506122010011005',
      jabatan_lurah: 'Lurah Suka Maju',
    };
    res.json(desa);
  })
);

app.put(
  '/api/profil-desa',
  auth,
  role('admin', 'lurah'),
  ah(async (req, res) => {
    const b = req.body;
    const rows = await q('SELECT id FROM profil_desa ORDER BY id ASC LIMIT 1');
    if (rows.length) {
      await q(
        `UPDATE profil_desa SET
          nama_desa = ?, kecamatan = ?, kabupaten_kota = ?, provinsi = ?,
          alamat = ?, kode_pos = ?, telepon = ?, email = ?, website = ?,
          logo_url = ?, nama_lurah = ?, nip_lurah = ?, jabatan_lurah = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          b.nama_desa || 'Kelurahan Suka Maju',
          b.kecamatan || 'Kecamatan Medan Johor',
          b.kabupaten_kota || 'Pemerintah Kota Medan',
          b.provinsi || 'Sumatera Utara',
          b.alamat || 'Jl. STM No. 40, Kelurahan Suka Maju',
          b.kode_pos || '20146',
          b.telepon || '0823-4123-5734',
          b.email || 'kelurahan@pemkomedan.go.id',
          b.website || 'sukamaju.medan.go.id',
          b.logo_url || null,
          b.nama_lurah || 'Muhammad Iqbal Samosir, S.E., M.A.P.',
          b.nip_lurah || '198506122010011005',
          b.jabatan_lurah || 'Lurah Suka Maju',
          rows[0].id,
        ]
      );
    } else {
      await q(
        `INSERT INTO profil_desa (nama_desa, kecamatan, kabupaten_kota, provinsi, alamat, kode_pos, telepon, email, website, logo_url, nama_lurah, nip_lurah, jabatan_lurah)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          b.nama_desa || 'Kelurahan Suka Maju',
          b.kecamatan || 'Kecamatan Medan Johor',
          b.kabupaten_kota || 'Pemerintah Kota Medan',
          b.provinsi || 'Sumatera Utara',
          b.alamat || 'Jl. STM No. 40, Kelurahan Suka Maju',
          b.kode_pos || '20146',
          b.telepon || '0823-4123-5734',
          b.email || 'kelurahan@pemkomedan.go.id',
          b.website || 'sukamaju.medan.go.id',
          b.logo_url || null,
          b.nama_lurah || 'Muhammad Iqbal Samosir, S.E., M.A.P.',
          b.nip_lurah || '198506122010011005',
          b.jabatan_lurah || 'Lurah Suka Maju',
        ]
      );
    }
    await log(req, 'UPDATE_PROFIL_DESA', `Profil desa & kop surat diperbarui: ${b.nama_desa}`);
    res.json({ message: 'Profil desa dan kop surat dinamis berhasil disimpan!' });
  })
);

app.post(
  '/api/profil-desa/logo',
  auth,
  role('admin', 'lurah'),
  upload.single('logo'),
  ah(async (req, res) => {
    if (!req.file) throw fail(400, 'Berkas logo kelurahan wajib diunggah.');
    const base64Data = `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString('base64')}`;
    const rows = await q('SELECT id FROM profil_desa ORDER BY id ASC LIMIT 1');
    if (rows.length) {
      await q('UPDATE profil_desa SET logo_url = ?, updated_at = NOW() WHERE id = ?', [base64Data, rows[0].id]);
    } else {
      await q('INSERT INTO profil_desa (nama_desa, logo_url) VALUES (?, ?)', ['Kelurahan Suka Maju', base64Data]);
    }
    await log(req, 'UPDATE_LOGO_DESA', req.file.originalname);
    res.json({ message: 'Logo kelurahan berhasil diunggah dan diterapkan ke kop surat', logo_url: base64Data });
  })
);

/* ====================================================================
   TANDA TANGAN DIGITAL PEJABAT / LURAH (BEDA ORANG BEDA TANDA TANGAN)
   ==================================================================== */

app.get(
  '/api/users/signature',
  auth,
  ah(async (req, res) => {
    const [u] = await q('SELECT tanda_tangan, nama, nip, jabatan, role FROM users WHERE id=?', [req.user.id]);
    res.json({
      tanda_tangan: u?.tanda_tangan || null,
      nama: u?.nama,
      nip: u?.nip,
      jabatan: u?.jabatan,
      role: u?.role,
    });
  })
);

app.post(
  '/api/users/signature',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const { tanda_tangan } = req.body;
    if (!tanda_tangan || typeof tanda_tangan !== 'string' || !tanda_tangan.startsWith('data:image')) {
      throw fail(400, 'Format tanda tangan digital tidak valid (harus data gambar PNG/JPEG).');
    }
    await q('UPDATE users SET tanda_tangan = ? WHERE id = ?', [tanda_tangan, req.user.id]);
    await log(req, 'UPDATE_TANDA_TANGAN', `User: ${req.user.nama}`);
    res.json({ message: 'Tanda tangan digital Anda berhasil disimpan!' });
  })
);

app.get(
  '/api/users/lurah-list',
  auth,
  ah(async (req, res) => {
    const rows = await q(
      "SELECT id, nama, nip, jabatan, role, (tanda_tangan IS NOT NULL AND tanda_tangan != '') AS has_signature FROM users WHERE role IN ('lurah', 'petugas') AND aktif = 1 ORDER BY role DESC, id ASC"
    );
    res.json(rows);
  })
);

/* ====================================================================
   2. FITUR VERIFIKASI AKUN WARGA (PETUGAS LOKET & SUPERVISI LURAH)
   ==================================================================== */

app.get(
  '/api/verifikasi-warga',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const st = req.query.status || 'menunggu_verifikasi';
    const where = st === 'all' ? "WHERE u.role = 'warga'" : "WHERE u.role = 'warga' AND u.status_verifikasi = ?";
    const params = st === 'all' ? [] : [st];

    const rows = await q(
      `SELECT u.id, u.nama, u.email, u.status_verifikasi, u.catatan_verifikasi, u.diverifikasi_at, u.created_at,
              w.nik, w.no_kk, w.tempat_lahir, w.tanggal_lahir, w.jenis_kelamin, w.alamat, w.pekerjaan, w.telepon
       FROM users u
       JOIN warga w ON w.user_id = u.id
       ${where}
       ORDER BY u.id DESC`,
      params
    );

    res.json(
      rows.map((r) => ({
        ...r,
        nik_masked: maskId(r.nik),
        no_kk_masked: maskId(r.no_kk),
      }))
    );
  })
);

app.get(
  '/api/verifikasi-warga/:id',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const [w] = await q(
      `SELECT u.id, u.nama, u.email, u.status_verifikasi, u.catatan_verifikasi, u.diverifikasi_at, u.created_at,
              w.nik, w.no_kk, w.tempat_lahir, w.tanggal_lahir, w.jenis_kelamin, w.alamat, w.pekerjaan, w.telepon,
              v.nama AS verifikator
       FROM users u
       JOIN warga w ON w.user_id = u.id
       LEFT JOIN users v ON v.id = u.diverifikasi_oleh
       WHERE u.id = ? AND u.role = 'warga'`,
      [req.params.id]
    );
    if (!w) throw fail(404, 'Data warga tidak ditemukan');
    res.json({
      ...w,
      nik_masked: maskId(w.nik),
      no_kk_masked: maskId(w.no_kk),
    });
  })
);

app.post(
  '/api/verifikasi-warga/:id',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const { hasil, catatan } = req.body;
    if (!['terverifikasi', 'ditolak'].includes(hasil)) {
      throw fail(400, 'Hasil verifikasi harus "terverifikasi" atau "ditolak".');
    }
    if (hasil === 'ditolak' && !(catatan || '').trim()) {
      throw fail(400, 'Alasan penolakan verifikasi wajib diisi.');
    }

    const [u] = await q("SELECT id, nama, role FROM users WHERE id=? AND role='warga'", [req.params.id]);
    if (!u) throw fail(404, 'Akun warga tidak ditemukan.');

    await q(
      'UPDATE users SET status_verifikasi=?, catatan_verifikasi=?, diverifikasi_oleh=?, diverifikasi_at=CURRENT_TIMESTAMP WHERE id=?',
      [hasil, catatan || null, req.user.id, u.id]
    );

    const pesan =
      hasil === 'terverifikasi'
        ? 'Selamat! Akun kependudukan Anda telah diverifikasi oleh petugas kelurahan. Anda sekarang dapat mengakses layanan pengajuan surat resmi.'
        : `Verifikasi akun Anda ditolak oleh petugas kelurahan. Alasan: ${catatan}. Silakan hubungi kantor kelurahan.`;

    await notif(u.id, pesan);
    await log(req, 'VERIFIKASI_WARGA_' + hasil.toUpperCase(), `User ID: ${u.id}, Nama: ${u.nama}`);

    res.json({ message: `Akun warga berhasil ${hasil === 'terverifikasi' ? 'diverifikasi' : 'ditolak'}.` });
  })
);

/* ====================================================================
   3. FITUR PENDAFTARAN AKUN PEMERINTAHAN (ADMINISTRATOR)
   ==================================================================== */

app.get(
  '/api/admin/users',
  auth,
  role('admin'),
  ah(async (req, res) => {
    res.json(
      await q(
        `SELECT id, nama, email, username, nip, jabatan, telepon, role, status_verifikasi, must_change_password, aktif, created_at
         FROM users
         ORDER BY id ASC`
      )
    );
  })
);

app.post(
  '/api/admin/users',
  auth,
  role('admin'),
  ah(async (req, res) => {
    const { nama, username, nip, jabatan, telepon, email, role: r, password_sementara } = req.body;

    if (!nama || nama.trim().length < 3) throw fail(400, 'Nama lengkap minimal 3 karakter.');
    if (!username || username.trim().length < 4) throw fail(400, 'NIP atau username kedinasan minimal 4 karakter.');
    if (!['petugas', 'lurah', 'admin'].includes(r)) throw fail(400, 'Role harus Petugas, Lurah, atau Admin.');
    if (!password_sementara || password_sementara.length < 8) {
      throw fail(400, 'Password sementara minimal 8 karakter.');
    }

    // Cek keunikan username / NIP
    const existingUsername = await q('SELECT id FROM users WHERE username=? OR nip=?', [username.trim(), nip || username.trim()]);
    if (existingUsername.length) throw fail(409, 'Username atau NIP sudah digunakan pengguna lain.');

    if (email) {
      const existingEmail = await q('SELECT id FROM users WHERE email=?', [email.trim()]);
      if (existingEmail.length) throw fail(409, 'Email kedinasan sudah terdaftar.');
    }

    const pwHash = await bcrypt.hash(password_sementara, 10);
    await q(
      `INSERT INTO users(nama, email, username, nip, jabatan, telepon, password, role, status_verifikasi, must_change_password, aktif)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [
        nama.trim(),
        email ? email.trim() : null,
        username.trim(),
        nip ? nip.trim() : username.trim(),
        jabatan ? jabatan.trim() : null,
        telepon ? telepon.trim() : null,
        pwHash,
        r,
        'terverifikasi',
        1, // Wajib ganti password saat login pertama
        1,
      ]
    );

    await log(req, 'TAMBAH_AKUN_PEMERINTAHAN', `Role: ${r}, Username: ${username}, Nama: ${nama}`);
    res.status(201).json({ message: 'Akun kedinasan berhasil dibuat dengan password sementara.' });
  })
);

app.patch(
  '/api/admin/users/:id/aktif',
  auth,
  role('admin'),
  ah(async (req, res) => {
    if (+req.params.id === req.user.id) throw fail(400, 'Tidak dapat menonaktifkan akun sendiri');
    await q('UPDATE users SET aktif=1-aktif WHERE id=?', [req.params.id]);
    await log(req, 'TOGGLE_USER', req.params.id);
    res.json({ message: 'Status keaktifan akun berhasil diubah.' });
  })
);

app.delete(
  '/api/admin/users/:id',
  auth,
  role('admin'),
  ah(async (req, res) => {
    const id = +req.params.id;
    if (id === req.user.id) throw fail(400, 'Tidak dapat menghapus akun sendiri');
    const [u] = await q('SELECT id, role FROM users WHERE id=?', [id]);
    if (!u) throw fail(404, 'Pengguna tidak ditemukan');
    // 1. Bersihkan berkas fisik dan riwayat pengajuan surat jika ada
    const pengajuanList = await q('SELECT id FROM pengajuan WHERE user_id=?', [id]);
    for (const p of pengajuanList) {
      const surats = await q('SELECT file_path FROM surat WHERE pengajuan_id=?', [p.id]);
      for (const s of surats) {
        if (s.file_path && fs.existsSync(s.file_path)) {
          try { fs.unlinkSync(s.file_path); } catch (_) {}
        }
      }
      const doks = await q('SELECT file_path FROM dokumen WHERE pengajuan_id=?', [p.id]);
      for (const d of doks) {
        if (d.file_path && fs.existsSync(d.file_path)) {
          try { fs.unlinkSync(d.file_path); } catch (_) {}
        }
      }
      await q('DELETE FROM surat WHERE pengajuan_id=?', [p.id]);
      await q('DELETE FROM persetujuan WHERE pengajuan_id=?', [p.id]);
      await q('DELETE FROM verifikasi WHERE pengajuan_id=?', [p.id]);
      await q('DELETE FROM dokumen WHERE pengajuan_id=?', [p.id]);
    }
    await q('DELETE FROM pengajuan WHERE user_id=?', [id]);

    // 2. Hapus data kependudukan (warga) dan notifikasi
    await q('DELETE FROM warga WHERE user_id=?', [id]);
    await q('DELETE FROM notifikasi WHERE user_id=?', [id]);

    // 3. Set NULL referensi di tabel lain jika ada
    try {
      await q('UPDATE activity_logs SET user_id=NULL WHERE user_id=?', [id]);
      await q('UPDATE berita SET penulis_id=NULL WHERE penulis_id=?', [id]);
      await q('UPDATE galeri_kegiatan SET penulis_id=NULL WHERE penulis_id=?', [id]);
      await q('UPDATE users SET diverifikasi_oleh=NULL WHERE diverifikasi_oleh=?', [id]);
      await q('UPDATE surat_masuk SET dicatat_oleh=NULL WHERE dicatat_oleh=?', [id]);
      await q('UPDATE disposisi SET diberikan_oleh=NULL WHERE diberikan_oleh=?', [id]);
      await q('UPDATE surat_keluar SET petugas_id=NULL WHERE petugas_id=?', [id]);
      await q('UPDATE surat_keluar SET ditandatangani_oleh=NULL WHERE ditandatangani_oleh=?', [id]);
    } catch (_) {}

    // 4. Catat log audit sebelum eksekusi delete user
    await log(req, 'HAPUS_USER', `ID: ${id}, Role: ${u.role}`);

    // 5. Hapus akun pengguna
    await q('DELETE FROM users WHERE id=?', [id]);
    res.json({ message: 'Akun pengguna berhasil dihapus dari sistem.' });
  })
);

/* ====================================================================
   4. JENIS SURAT & PENGAJUAN SURAT
   ==================================================================== */

app.get(
  '/api/jenis-surat',
  auth,
  ah(async (req, res) => {
    const js = await q(
      'SELECT * FROM jenis_surat' + (req.user.role === 'warga' ? ' WHERE aktif=1' : '') + ' ORDER BY id ASC'
    );
    const ps = await q('SELECT * FROM persyaratan ORDER BY id ASC');
    res.json(
      js.map((j) => ({
        ...j,
        form_fields: typeof j.form_fields === 'string' ? JSON.parse(j.form_fields) : j.form_fields,
        persyaratan: ps.filter((x) => x.jenis_surat_id === j.id),
      }))
    );
  })
);

app.post(
  '/api/pengajuan',
  auth,
  role('warga'),
  upload.any(),
  ah(async (req, res) => {
    // Pastikan akun warga sudah terverifikasi
    const [userCheck] = await q('SELECT status_verifikasi FROM users WHERE id=?', [req.user.id]);
    if (userCheck?.status_verifikasi !== 'terverifikasi') {
      throw fail(
        403,
        'Akun Anda belum terverifikasi oleh petugas kelurahan. Silakan tunggu hingga verifikasi disetujui untuk mengajukan surat.'
      );
    }

    const jid = +req.body.jenis_surat_id;
    const [j] = await q('SELECT * FROM jenis_surat WHERE id=? AND aktif=1', [jid]);
    if (!j) throw fail(400, 'Jenis surat tidak valid');

    let data;
    try {
      data = typeof req.body.data_form === 'string' ? JSON.parse(req.body.data_form || '{}') : (req.body.data_form || {});
    } catch {
      throw fail(400, 'Data form tidak valid');
    }

    const fields = typeof j.form_fields === 'string' ? JSON.parse(j.form_fields) : j.form_fields;
    for (const f of fields) {
      if (!String(data[f.name] || '').trim()) throw fail(400, f.label + ' wajib diisi');
    }

    const [w] = await q('SELECT alamat FROM warga WHERE user_id=?', [req.user.id]);
    if (!w?.alamat) throw fail(400, 'Lengkapi profil (alamat dll.) terlebih dahulu di menu Profil');

    const miss = (await q('SELECT id,nama FROM persyaratan WHERE jenis_surat_id=?', [jid])).filter(
      (s) => !(req.files || []).some((f) => f.fieldname === 'doc_' + s.id)
    );
    if (miss.length) throw fail(400, 'Dokumen belum lengkap: ' + miss.map((m) => m.nama).join(', '));

    const kode = 'PGJ-' + Date.now().toString(36).toUpperCase();
    const [r] = await db.query(
      'INSERT INTO pengajuan(kode,user_id,jenis_surat_id,data_form) VALUES(?,?,?,?)',
      [kode, req.user.id, jid, JSON.stringify(data)]
    );

    await saveDocs(req.files || [], r.insertId, jid);
    await notifRole('petugas', `Pengajuan baru ${kode} (${j.nama})`);
    await notif(req.user.id, `Pengajuan ${kode} berhasil dikirim`);
    await log(req, 'AJUKAN_SURAT', kode);
    res.status(201).json({ id: r.insertId, kode });
  })
);

app.get(
  '/api/pengajuan',
  auth,
  role('warga', 'petugas', 'lurah'),
  ah(async (req, res) => {
    const c = [], p = [];
    if (req.user.role === 'warga') {
      const [userCheck] = await q('SELECT status_verifikasi FROM users WHERE id=?', [req.user.id]);
      if (userCheck?.status_verifikasi !== 'terverifikasi') return res.json([]);
      c.push('p.user_id=?');
      p.push(req.user.id);
    }
    if (req.user.role === 'lurah') {
      c.push("p.status IN ('pending_approval','approved','rejected','issued')");
    }
    if (req.query.status) {
      c.push('p.status=?');
      p.push(req.query.status);
    }
    res.json(
      await q(
        `SELECT p.id,p.kode,p.status,p.created_at,j.nama AS jenis,u.nama AS pemohon FROM pengajuan p JOIN jenis_surat j ON j.id=p.jenis_surat_id JOIN users u ON u.id=p.user_id ${c.length ? 'WHERE ' + c.join(' AND ') : ''
        } ORDER BY p.id DESC`,
        p
      )
    );
  })
);

app.get(
  '/api/pengajuan/:id',
  auth,
  ah(async (req, res) => {
    const p = await getP(req.params.id, req.user);
    const suratList = await q(
      `SELECT s.id, s.nomor, s.terbit_at, s.kode_verifikasi, s.file_path, s.lurah_nama, s.lurah_nip, s.tanda_tangan, s.kop_data,
              u.nama AS persetujuan_lurah_nama, u.nip AS persetujuan_lurah_nip, u.jabatan AS persetujuan_lurah_jabatan,
              ps.tanda_tangan AS persetujuan_ttd
       FROM surat s
       LEFT JOIN persetujuan ps ON ps.pengajuan_id = s.pengajuan_id AND ps.hasil='setuju'
       LEFT JOIN users u ON u.id = ps.lurah_id
       WHERE s.pengajuan_id=?
       ORDER BY s.id DESC LIMIT 1`,
      [p.id]
    );
    const surat = suratList[0] || null;

    // Ambil profil desa untuk kop surat cetak
    const [desaList] = await q('SELECT * FROM profil_desa ORDER BY id ASC LIMIT 1');
    const kop = desaList || {
      nama_desa: 'Kelurahan Suka Maju',
      kecamatan: 'Kecamatan Medan Johor',
      kabupaten_kota: 'Pemerintah Kota Medan',
      provinsi: 'Sumatera Utara',
      alamat: 'Jl. STM No. 40, Kelurahan Suka Maju',
      kode_pos: '20146',
      telepon: '0823-4123-5734',
      email: 'kelurahan@pemkomedan.go.id',
      website: 'sukamaju.medan.go.id',
      logo_url: null,
      nama_lurah: 'Muhammad Iqbal Samosir, S.E., M.A.P.',
      nip_lurah: '198506122010011005',
      jabatan_lurah: 'Lurah Suka Maju',
    };

    res.json({
      p: {
        ...p,
        nik_masked: maskId(p.nik),
      },
      syarat: await q('SELECT * FROM persyaratan WHERE jenis_surat_id=?', [p.jenis_surat_id]),
      dokumen: await q('SELECT id,persyaratan_id,nama_file FROM dokumen WHERE pengajuan_id=?', [p.id]),
      riwayat: await q(
        "SELECT 'Verifikasi' AS tipe,v.hasil,v.catatan,v.created_at,u.nama AS oleh FROM verifikasi v JOIN users u ON u.id=v.petugas_id WHERE v.pengajuan_id=? UNION ALL SELECT 'Persetujuan' AS tipe,s.hasil,s.catatan,s.created_at,u.nama AS oleh FROM persetujuan s JOIN users u ON u.id=s.lurah_id WHERE s.pengajuan_id=? ORDER BY created_at",
        [p.id, p.id]
      ),
      surat,
      kop,
    });
  })
);

app.post(
  '/api/pengajuan/:id/revisi',
  auth,
  role('warga'),
  upload.any(),
  ah(async (req, res) => {
    const p = await getP(req.params.id, req.user);
    if (p.status !== 'revision_required') throw fail(409, 'Pengajuan tidak sedang meminta revisi');
    await saveDocs(req.files || [], p.id, p.jenis_surat_id);
    if (!(await lengkap(p.id, p.jenis_surat_id))) throw fail(400, 'Dokumen masih belum lengkap');
    await move(p.id, ['revision_required'], 'submitted');
    await notifRole('petugas', `Pengajuan ${p.kode} telah direvisi warga`);
    await log(req, 'REVISI', p.kode);
    res.json({ message: 'ok' });
  })
);

app.post(
  '/api/pengajuan/:id/mulai',
  auth,
  role('petugas'),
  ah(async (req, res) => {
    const p = await getP(req.params.id, req.user);
    await move(p.id, ['submitted'], 'under_review');
    await notif(p.user_id, `Pengajuan ${p.kode} sedang diperiksa petugas`);
    await log(req, 'MULAI_PERIKSA', p.kode);
    res.json({ message: 'ok' });
  })
);

app.post(
  '/api/pengajuan/:id/verifikasi',
  auth,
  role('petugas'),
  ah(async (req, res) => {
    const { hasil, catatan } = req.body;
    const to = { lengkap: 'pending_approval', revisi: 'revision_required', ditolak: 'rejected' }[hasil];
    if (!to) throw fail(400, 'Hasil tidak valid');
    if (hasil !== 'lengkap' && !(catatan || '').trim()) throw fail(400, 'Catatan wajib diisi');
    const p = await getP(req.params.id, req.user);
    if (hasil === 'lengkap' && !(await lengkap(p.id, p.jenis_surat_id))) throw fail(400, 'Dokumen belum lengkap');
    await move(p.id, ['under_review'], to, catatan);
    await q('INSERT INTO verifikasi(pengajuan_id,petugas_id,hasil,catatan) VALUES(?,?,?,?)', [
      p.id,
      req.user.id,
      hasil,
      catatan || null,
    ]);
    await notif(
      p.user_id,
      `Pengajuan ${p.kode}: ${{ lengkap: 'dokumen lengkap, menunggu persetujuan Lurah', revisi: 'perlu revisi', ditolak: 'ditolak' }[hasil]
      }`
    );
    if (hasil === 'lengkap') await notifRole('lurah', `Pengajuan ${p.kode} menunggu persetujuan`);
    await log(req, 'VERIFIKASI_' + hasil.toUpperCase(), p.kode);
    res.json({ message: 'ok' });
  })
);

/* ====================================================================
   HELPER PENERBITAN SURAT OTOMATIS / MANUAL
   ==================================================================== */
async function prosesTerbitkanSurat(pengajuanId, actorUser, signatureOverride = null, forceRegenerate = false) {
  const pList = await q('SELECT * FROM pengajuan WHERE id=?', [pengajuanId]);
  if (!pList || !pList.length) throw fail(404, 'Data pengajuan tidak ditemukan');
  const p = pList[0];

  const [j] = await q('SELECT * FROM jenis_surat WHERE id=?', [p.jenis_surat_id]);
  if (!j) throw fail(500, 'Data jenis surat tidak ditemukan');

  // Ambil profil desa aktif untuk Kop Surat dinamis
  const [desaList] = await q('SELECT * FROM profil_desa ORDER BY id ASC LIMIT 1');
  const kop = desaList || {
    nama_desa: 'Kelurahan Suka Maju',
    kecamatan: 'Kecamatan Medan Johor',
    kabupaten_kota: 'Pemerintah Kota Medan',
    provinsi: 'Sumatera Utara',
    alamat: 'Jl. STM No. 40, Kelurahan Suka Maju',
    kode_pos: '20146',
    telepon: '0823-4123-5734',
    email: 'kelurahan@pemkomedan.go.id',
    website: 'sukamaju.medan.go.id',
    logo_url: null,
    nama_lurah: 'Muhammad Iqbal Samosir, S.E., M.A.P.',
    nip_lurah: '198506122010011005',
    jabatan_lurah: 'Lurah Suka Maju',
  };

  // Ambil data lurah spesifik yang menyetujui (beda orang beda tanda tangan)
  const [l] = await q(
    "SELECT u.id, u.nama, u.nip, u.jabatan, u.tanda_tangan, ps.tanda_tangan AS tanda_tangan_persetujuan FROM persetujuan ps JOIN users u ON u.id=ps.lurah_id WHERE ps.pengajuan_id=? AND ps.hasil='setuju' ORDER BY ps.id DESC LIMIT 1",
    [p.id]
  );

  const lurahNama = l?.nama || kop.nama_lurah || actorUser?.nama || 'Muhammad Iqbal Samosir, S.E., M.A.P.';
  const lurahNip = l?.nip || kop.nip_lurah || actorUser?.nip || '198506122010011005';
  const lurahJabatan = l?.jabatan || kop.jabatan_lurah || actorUser?.jabatan || 'Lurah Suka Maju';
  const lurahTtd = signatureOverride || l?.tanda_tangan_persetujuan || l?.tanda_tangan || actorUser?.tanda_tangan || null;

  const [w] = await q(
    'SELECT u.nama, w.nik, w.no_kk, w.tempat_lahir, w.tanggal_lahir, w.jenis_kelamin, w.alamat, w.pekerjaan, w.telepon FROM users u JOIN warga w ON w.user_id=u.id WHERE u.id=?',
    [p.user_id]
  );
  if (!w) throw fail(500, 'Data kependudukan warga pemohon tidak ditemukan');

  const existingSurat = await q('SELECT id, nomor, kode_verifikasi, file_path, lurah_nama, lurah_nip, tanda_tangan, kop_data FROM surat WHERE pengajuan_id=?', [p.id]);
  let nomor, kode, file;

  if (existingSurat.length) {
    const s = existingSurat[0];
    nomor = s.nomor;
    kode = s.kode_verifikasi;
    file = path.resolve(s.file_path);

    const isOldMock = (str) => !str || /merdeka|contoh|sukamaju(?!\.medan)|\(021\)|12345/i.test(String(str));
    const mustRegenerate = forceRegenerate || !fs.existsSync(file) || isOldMock(s.lurah_nama) || isOldMock(s.lurah_nip);

    // Jika forceRegenerate ATAU file fisik belum ada atau terhapus atau data lama, buat ulang PDF dengan data dinamis
    if (mustRegenerate) {
      const storageDir = path.join(DATA_DIR, 'storage', 'surat');
      fs.mkdirSync(storageDir, { recursive: true });
      file = path.join(storageDir, `${kode}.pdf`);
      const fields = typeof j.form_fields === 'string' ? JSON.parse(j.form_fields) : (j.form_fields || []);
      const data = typeof p.data_form === 'string' ? JSON.parse(p.data_form || '{}') : (p.data_form || {});
      const now = new Date();

      await buatPdf(
        {
          nomor,
          jenis: j.nama,
          kode: j.kode,
          template: data?.redaksi_kustom || j.template || '',
          pembuka: data?.pembuka_kustom,
          penutup: data?.penutup_kustom,
          fields,
          data,
          warga: {
            nama: w.nama,
            nik: w.nik,
            tempat_lahir: w.tempat_lahir || '-',
            tanggal_lahir: w.tanggal_lahir ? String(w.tanggal_lahir).slice(0, 10) : '-',
            jenis_kelamin: w.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan',
            alamat: w.alamat || '-',
            pekerjaan: w.pekerjaan || '-',
            telepon: w.telepon || '-',
          },
          kop,
          lurah: !isOldMock(s.lurah_nama) ? s.lurah_nama : lurahNama,
          nip: !isOldMock(s.lurah_nip) ? s.lurah_nip : lurahNip,
          jabatan: lurahJabatan,
          tanda_tangan: s.tanda_tangan || lurahTtd,
          url: `${process.env.CLIENT_URL || CLIENT}/verifikasi/${kode}`,
          tanggal: now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        },
        file
      );
    }

    if (path.resolve(s.file_path) !== file) {
      await q('UPDATE surat SET file_path=? WHERE id=?', [file, s.id]);
    }
    await q("UPDATE pengajuan SET status='issued', updated_at=NOW() WHERE id=?", [p.id]);
    return { nomor, kode, file };
  }

  // Jika belum ada di tabel surat, buat baru
  const now = new Date();
  const tahun = now.getFullYear();
  const cRes = await q('SELECT COUNT(*) AS c FROM surat WHERE EXTRACT(YEAR FROM terbit_at)=?', [tahun]);
  const n = parseInt(cRes[0]?.c || 0, 10) + 1;
  const kodeDesa = (kop.nama_desa || 'SKM').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'SKM';
  nomor = `${String(n).padStart(3, '0')}/${j.kode}/KEL-${kodeDesa}/${ROM[now.getMonth()]}/${tahun}`;
  kode = crypto.randomBytes(8).toString('hex');

  const storageDir = path.join(DATA_DIR, 'storage', 'surat');
  fs.mkdirSync(storageDir, { recursive: true });
  file = path.join(storageDir, `${kode}.pdf`);

  const fields = typeof j.form_fields === 'string' ? JSON.parse(j.form_fields) : (j.form_fields || []);
  const data = typeof p.data_form === 'string' ? JSON.parse(p.data_form || '{}') : (p.data_form || {});

  // Buat PDF dengan KOP dinamis dan Tanda Tangan asli Lurah
  await buatPdf(
    {
      nomor,
      jenis: j.nama,
      kode: j.kode,
      template: data?.redaksi_kustom || j.template || '',
      fields,
      data,
      warga: {
        nama: w.nama,
        nik: w.nik,
        tempat_lahir: w.tempat_lahir || '-',
        tanggal_lahir: w.tanggal_lahir ? String(w.tanggal_lahir).slice(0, 10) : '-',
        jenis_kelamin: w.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan',
        alamat: w.alamat || '-',
        pekerjaan: w.pekerjaan || '-',
        telepon: w.telepon || '-',
      },
      kop,
      lurah: lurahNama,
      nip: lurahNip,
      jabatan: lurahJabatan,
      tanda_tangan: lurahTtd,
      url: `${process.env.CLIENT_URL || CLIENT}/verifikasi/${kode}`,
      tanggal: now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    },
    file
  );

  if (!fs.existsSync(file)) {
    throw fail(500, 'File PDF tidak berhasil dibuat pada penyimpanan.');
  }

  await q(
    'INSERT INTO surat(pengajuan_id,nomor,kode_verifikasi,file_path,petugas_id,lurah_nama,lurah_nip,tanda_tangan,kop_data) VALUES(?,?,?,?,?,?,?,?,?)',
    [p.id, nomor, kode, file, actorUser.id, lurahNama, lurahNip, lurahTtd, JSON.stringify(kop)]
  );
  await q("UPDATE pengajuan SET status='issued', updated_at=NOW() WHERE id=?", [p.id]);
  await notif(
    p.user_id,
    `Surat ${p.kode} (${j.nama}) telah diterbitkan dengan nomor ${nomor} dan siap dicetak/diunduh di menu "Surat Saya".`
  );
  return { nomor, kode, file };
}

app.post(
  '/api/pengajuan/:id/persetujuan',
  auth,
  role('lurah'),
  ah(async (req, res) => {
    const { hasil, catatan, tanda_tangan, redaksi, nomor } = req.body;
    if (!['setuju', 'tolak'].includes(hasil)) throw fail(400, 'Hasil tidak valid');
    if (hasil === 'tolak' && !(catatan || '').trim()) throw fail(400, 'Alasan penolakan wajib diisi');
    const p = await getP(req.params.id, req.user);

    // Ambil tanda tangan: dari body (jika baru digambar di canvas) atau dari profil akun lurah yang login
    let ttdToSave = tanda_tangan || null;
    if (!ttdToSave) {
      const [u] = await q('SELECT tanda_tangan FROM users WHERE id=?', [req.user.id]);
      ttdToSave = u?.tanda_tangan || null;
    } else {
      // Sekaligus perbarui tanda tangan di profil lurah agar tersimpan untuk berikutnya
      await q('UPDATE users SET tanda_tangan=? WHERE id=?', [ttdToSave, req.user.id]);
    }

    // Simpan isi naskah/redaksi yang diisi Lurah ke data_form sebelum pengesahan
    if (hasil === 'setuju' && (redaksi || nomor)) {
      const currentData = typeof p.data_form === 'object' && p.data_form ? { ...p.data_form } : {};
      if (redaksi) currentData.redaksi_kustom = redaksi;
      if (nomor) currentData.nomor_surat = nomor;
      await q('UPDATE pengajuan SET data_form=?::jsonb WHERE id=?', [JSON.stringify(currentData), p.id]);
      // Perbarui objek p agar dipakai saat prosesTerbitkanSurat
      p.data_form = currentData;
    }

    await move(p.id, ['pending_approval'], hasil === 'setuju' ? 'approved' : 'rejected', catatan);
    await q('INSERT INTO persetujuan(pengajuan_id,lurah_id,hasil,catatan,tanda_tangan) VALUES(?,?,?,?,?)', [
      p.id,
      req.user.id,
      hasil,
      catatan || null,
      ttdToSave,
    ]);
    await notif(p.user_id, `Pengajuan ${p.kode} ${hasil === 'setuju' ? 'disetujui Lurah' : 'ditolak Lurah'}`);

    // Jika Lurah menyetujui, langsung terbitkan surat PDF secara otomatis dengan tanda tangan asli Lurah tersebut
    if (hasil === 'setuju') {
      try {
        const sRes = await prosesTerbitkanSurat(p.id, req.user, ttdToSave);
        await log(req, 'PERSETUJUAN_SETUJU_OTOMATIS_TERBIT', `Pengajuan: ${p.kode}, Nomor Surat: ${sRes.nomor}, Penandatangan: ${req.user.nama}`);
        return res.json({ message: 'ok', nomor: sRes.nomor, status: 'issued' });
      } catch (autoErr) {
        console.error('[Auto Terbit Gagal, fallback to approved]', autoErr);
        await notifRole('petugas', `Pengajuan ${p.kode} disetujui Lurah, siap diterbitkan oleh petugas.`);
      }
    }

    await log(req, 'PERSETUJUAN_' + hasil.toUpperCase(), p.kode);
    res.json({ message: 'ok' });
  })
);

app.post(
  '/api/pengajuan/:id/terbitkan',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const p = await getP(req.params.id, req.user);
    if (!['approved', 'pending_approval', 'issued'].includes(p.status)) {
      throw fail(409, 'Pengajuan belum disetujui Lurah');
    }
    const sRes = await prosesTerbitkanSurat(p.id, req.user);
    await log(req, 'TERBITKAN_SURAT', `Nomor: ${sRes.nomor}, Pengajuan: ${p.kode}`);
    res.json({ nomor: sRes.nomor, kode: sRes.kode, message: 'Surat berhasil diterbitkan' });
  })
);

app.get(
  '/api/pengajuan/:id/surat',
  auth,
  ah(async (req, res) => {
    const p = await getP(req.params.id, req.user);
    let [s] = await q('SELECT * FROM surat WHERE pengajuan_id=?', [p.id]);

    // Jika surat di database belum ada namun status sudah approved, terbitkan otomatis
    if (!s && p.status === 'approved') {
      s = await prosesTerbitkanSurat(p.id, req.user);
    }

    if (!s) throw fail(404, 'Surat belum terbit untuk pengajuan ini');

    let fullPath = path.resolve(s.file_path);
    // Jika file fisik belum ada atau hilang atau ada instruksi regenerasi, lakukan generate ulang secara otomatis
    if (req.query.refresh || req.query.regenerate || !fs.existsSync(fullPath)) {
      try {
        await prosesTerbitkanSurat(p.id, req.user, true);
        const [updatedS] = await q('SELECT * FROM surat WHERE pengajuan_id=?', [p.id]);
        if (updatedS) {
          s = updatedS;
          fullPath = path.resolve(s.file_path);
        }
      } catch (genErr) {
        console.error('[Regenerate Surat Error]', genErr);
      }
    }

    if (!fs.existsSync(fullPath)) {
      throw fail(404, 'Berkas fisik surat PDF tidak ditemukan di sistem penyimpanan.');
    }

    await log(req, 'UNDUH_SURAT', `Nomor: ${s.nomor}, Pengajuan ID: ${p.id}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Surat-${s.nomor.replace(/[/\\?%*:|"<>]/g, '_')}.pdf"`);
    res.sendFile(fullPath);
  })
);

app.get(
  '/api/dokumen/:id/file',
  auth,
  ah(async (req, res) => {
    const [d] = await q('SELECT d.*,p.user_id FROM dokumen d JOIN pengajuan p ON p.id=d.pengajuan_id WHERE d.id=?', [
      req.params.id,
    ]);
    if (!d) throw fail(404, 'Dokumen tidak ditemukan');
    if (req.user.role === 'warga' && d.user_id !== req.user.id) throw fail(403, 'Akses ditolak');

    let filePath = d.path ? path.resolve(d.path) : null;
    if (!filePath || !fs.existsSync(filePath)) {
      // Coba cari di folder uploads dengan nama file
      const fallback = path.join(DATA_DIR, 'uploads', path.basename(d.path || ''));
      if (fs.existsSync(fallback)) {
        filePath = fallback;
      } else {
        throw fail(404, 'Berkas fisik dokumen persyaratan tidak ditemukan di server.');
      }
    }

    const mime = d.mime || (d.nama_file?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(d.nama_file || 'dokumen')}"`);
    res.sendFile(filePath);
  })
);

/* ====================================================================
   5. VERIFIKASI PUBLIK, NOTIFIKASI, ARSIP, STATISTIK, SURAT SAYA
   ==================================================================== */

app.get(
  '/api/surat-saya',
  auth,
  role('warga'),
  ah(async (req, res) => {
    const [userCheck] = await q('SELECT status_verifikasi FROM users WHERE id=?', [req.user.id]);
    if (userCheck?.status_verifikasi !== 'terverifikasi') return res.json([]);

    const rows = await q(
      `SELECT s.id, s.nomor, s.kode_verifikasi, s.terbit_at, s.pengajuan_id,
              j.nama AS jenis, j.kode, p.kode AS kode_pengajuan,
              u_lurah.nama AS lurah_nama, u_lurah.jabatan AS lurah_jabatan
       FROM surat s
       JOIN pengajuan p ON p.id = s.pengajuan_id
       JOIN jenis_surat j ON j.id = p.jenis_surat_id
       LEFT JOIN persetujuan ps ON ps.pengajuan_id = p.id AND ps.hasil = 'setuju'
       LEFT JOIN users u_lurah ON u_lurah.id = ps.lurah_id
       WHERE p.user_id = ?
       ORDER BY s.id DESC`,
      [req.user.id]
    );
    res.json(rows);
  })
);



app.get(
  '/api/verifikasi/:kode',
  ah(async (req, res) => {
    const [s] = await q(
      `SELECT s.nomor, s.terbit_at, s.kode_verifikasi,
              j.nama AS jenis, j.kode AS jenis_kode,
              u.nama AS pemohon, p.status, p.kode AS kode_pengajuan,
              w.nik
       FROM surat s
       JOIN pengajuan p ON p.id = s.pengajuan_id
       JOIN jenis_surat j ON j.id = p.jenis_surat_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN warga w ON w.user_id = u.id
       WHERE s.kode_verifikasi = ?`,
      [req.params.kode]
    );
    if (!s) {
      return res.status(404).json({
        valid: false,
        message: 'Dokumen surat dengan kode verifikasi ini tidak ditemukan di pangkalan data resmi SIPESUR.',
      });
    }

    // Masking nama belakang dan NIK agar privasi terlindungi
    const namaTersensor = s.pemohon
      ? s.pemohon.split(' ').map((n, idx) => (idx === 0 ? n : n[0] + '***')).join(' ')
      : 'Warga';

    res.json({
      valid: true,
      nomor: s.nomor,
      jenis: s.jenis,
      jenis_kode: s.jenis_kode,
      pemohon: namaTersensor,
      nik_masked: s.nik ? maskId(s.nik) : null,
      instansi: 'Pemerintah Kota Medan',
      kelurahan: 'Kelurahan Suka Maju, Kecamatan Medan Johor',
      pejabat_penandatangan: 'Lurah Suka Maju',
      terbit_at: s.terbit_at,
      status_surat: s.status === 'issued' ? 'Diterbitkan (Sah & Berlaku)' : 'Dibatalkan / Tidak Berlaku',
      keterangan: 'Surat ini diterbitkan secara digital melalui Sistem Informasi Pelayanan Surat Kelurahan (SIPESUR). Keabsahan dokumen dijamin sesuai data yang tersimpan dalam sistem informasi kependudukan resmi kelurahan.',
    });
  })
);

app.get(
  '/api/notifikasi',
  auth,
  ah(async (req, res) =>
    res.json(await q('SELECT * FROM notifikasi WHERE user_id=? ORDER BY id DESC LIMIT 50', [req.user.id]))
  )
);

app.post(
  '/api/notifikasi/baca',
  auth,
  ah(async (req, res) => {
    await q('UPDATE notifikasi SET dibaca=1 WHERE user_id=?', [req.user.id]);
    res.json({ message: 'ok' });
  })
);

app.delete(
  '/api/notifikasi/:id',
  auth,
  ah(async (req, res) => {
    await q('DELETE FROM notifikasi WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ message: 'Notifikasi berhasil dihapus' });
  })
);

app.delete(
  '/api/notifikasi',
  auth,
  ah(async (req, res) => {
    await q('DELETE FROM notifikasi WHERE user_id=?', [req.user.id]);
    res.json({ message: 'Semua notifikasi berhasil dibersihkan' });
  })
);

app.get(
  '/api/arsip',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const k = `%${req.query.q || ''}%`;
    res.json(
      await q(
        'SELECT s.pengajuan_id,s.nomor,s.terbit_at,j.nama AS jenis,u.nama AS pemohon FROM surat s JOIN pengajuan p ON p.id=s.pengajuan_id JOIN jenis_surat j ON j.id=p.jenis_surat_id JOIN users u ON u.id=p.user_id WHERE s.nomor ILIKE ? OR u.nama ILIKE ? OR j.nama ILIKE ? ORDER BY s.id DESC',
        [k, k, k]
      )
    );
  })
);

app.get(
  '/api/stats',
  auth,
  ah(async (req, res) => {
    const [w, p] = req.user.role === 'warga' ? ['WHERE p.user_id=?', [req.user.id]] : ['', []];
    const st = {};
    const statusCounts = await q(`SELECT status,COUNT(*)::int AS n FROM pengajuan p ${w} GROUP BY status`, p);
    statusCounts.forEach((r) => (st[r.status] = parseInt(r.n, 10)));

    const payload = {
      status: st,
      jenis: await q(
        `SELECT j.nama,COUNT(*)::int AS n FROM pengajuan p JOIN jenis_surat j ON j.id=p.jenis_surat_id ${w} GROUP BY j.nama ORDER BY n DESC`,
        p
      ),
      bulan: await q(
        `SELECT TO_CHAR(p.created_at,'YYYY-MM') AS nama,COUNT(*)::int AS n FROM pengajuan p ${w} GROUP BY TO_CHAR(p.created_at,'YYYY-MM') ORDER BY nama DESC LIMIT 6`,
        p
      ),
    };

    if (['petugas', 'lurah'].includes(req.user.role)) {
      const allUsers = await q('SELECT id, nama, role, status_verifikasi, aktif, created_at FROM users');
      const wargaUsers = (allUsers || []).filter((u) => u.role === 'warga');
      payload.warga_pending = wargaUsers.filter((u) => (u.status_verifikasi || 'menunggu_verifikasi') === 'menunggu_verifikasi').length;
      payload.warga_terverifikasi = wargaUsers.filter((u) => u.status_verifikasi === 'terverifikasi').length;

      const smAll = await q('SELECT id, nomor_surat, pengirim, perihal, tanggal_surat, status, created_at FROM surat_masuk');
      payload.sm_menunggu = (smAll || []).filter((x) => x.status === 'menunggu_disposisi').length;
      payload.sm_didisposisi = (smAll || []).filter((x) => x.status === 'didisposisi').length;
      payload.sm_dibalas = (smAll || []).filter((x) => x.status === 'dibalas').length;

      const skAll = await q('SELECT id FROM surat_keluar');
      payload.sk_total = (skAll || []).length;

      const angAll = await q('SELECT pagu, realisasi FROM anggaran');
      const totalPagu = (angAll || []).reduce((a, c) => a + (Number(c.pagu) || 0), 0);
      const totalReal = (angAll || []).reduce((a, c) => a + (Number(c.realisasi) || 0), 0);
      payload.anggaran = {
        total_pagu: totalPagu,
        total_realisasi: totalReal,
        persen: totalPagu > 0 ? Math.round((totalReal / totalPagu) * 100) : 0,
      };

      const [meSig] = await q('SELECT tanda_tangan FROM users WHERE id=?', [req.user.id]);
      payload.has_signature = Boolean(meSig?.tanda_tangan);

      const allPengajuan = await q(
        `SELECT p.id,p.kode,p.status,p.created_at,j.nama AS jenis,u.nama AS pemohon FROM pengajuan p JOIN jenis_surat j ON j.id=p.jenis_surat_id JOIN users u ON u.id=p.user_id ORDER BY p.id DESC`
      );
      if (req.user.role === 'lurah') {
        payload.antrean_pengajuan = (allPengajuan || []).filter((x) => x.status === 'pending_approval').slice(0, 6);
        payload.antrean_surat_masuk = (smAll || []).filter((x) => x.status === 'menunggu_disposisi').sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 6);
      } else {
        payload.antrean_pengajuan = (allPengajuan || []).filter((x) => ['submitted', 'under_review', 'approved'].includes(x.status)).slice(0, 6);
        payload.antrean_surat_masuk = (smAll || []).filter((x) => x.status === 'didisposisi').sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 6);
        payload.antrean_warga = wargaUsers.filter((u) => (u.status_verifikasi || 'menunggu_verifikasi') === 'menunggu_verifikasi').sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5);
      }
    }

    res.json(payload);
  })
);

/* ====================================================================
   6. ADMIN SETTINGS (JENIS SURAT, PERSYARATAN, AUDIT LOGS)
   ==================================================================== */
const adm = [auth, role('admin')];

app.post(
  '/api/admin/jenis-surat',
  ...adm,
  ah(async (req, res) => {
    const { kode, nama, template, fields } = req.body;
    if (!kode || !nama || !fields) throw fail(400, 'Kode, nama, dan field wajib diisi');
    const f = fields.split('|').map((x) => {
      const [name, label] = x.split(':');
      return { name: name.trim(), label: (label || name).trim() };
    });
    if ((await q('SELECT id FROM jenis_surat WHERE kode=?', [kode])).length) throw fail(409, 'Kode sudah dipakai');
    await q('INSERT INTO jenis_surat(kode,nama,template,form_fields) VALUES(?,?,?,?)', [
      kode.toUpperCase(),
      nama,
      template || '',
      JSON.stringify(f),
    ]);
    await log(req, 'TAMBAH_JENIS', kode);
    res.status(201).json({ message: 'ok' });
  })
);

app.patch(
  '/api/admin/jenis-surat/:id/aktif',
  ...adm,
  ah(async (req, res) => {
    await q('UPDATE jenis_surat SET aktif=1-aktif WHERE id=?', [req.params.id]);
    await log(req, 'TOGGLE_JENIS', req.params.id);
    res.json({ message: 'ok' });
  })
);

app.delete(
  '/api/admin/jenis-surat/:id',
  ...adm,
  ah(async (req, res) => {
    const id = req.params.id;
    // Cek apakah ada pengajuan aktif terkait jenis ini
    const aktif = await q(
      "SELECT id FROM pengajuan WHERE jenis_surat_id=? AND status NOT IN ('issued','rejected') LIMIT 1",
      [id]
    );
    if (aktif.length) throw fail(409, 'Tidak dapat menghapus: masih ada pengajuan aktif untuk jenis surat ini.');
    await q('DELETE FROM persyaratan WHERE jenis_surat_id=?', [id]);
    await q('DELETE FROM jenis_surat WHERE id=?', [id]);
    await log(req, 'HAPUS_JENIS_SURAT', `ID: ${id}`);
    res.json({ message: 'Jenis surat berhasil dihapus dari sistem.' });
  })
);

app.put(
  '/api/admin/jenis-surat/:id/template',
  ...adm,
  ah(async (req, res) => {
    const { template } = req.body;
    await q('UPDATE jenis_surat SET template=? WHERE id=?', [template || '', req.params.id]);
    await log(req, 'UPDATE_TEMPLATE_JENIS', `ID: ${req.params.id}`);
    res.json({ message: 'Template naskah surat berhasil diperbarui' });
  })
);

app.post(
  '/api/admin/persyaratan',
  ...adm,
  ah(async (req, res) => {
    if (!req.body.nama) throw fail(400, 'Nama wajib diisi');
    await q('INSERT INTO persyaratan(jenis_surat_id,nama) VALUES(?,?)', [req.body.jenis_surat_id, req.body.nama]);
    await log(req, 'TAMBAH_PERSYARATAN', req.body.nama);
    res.status(201).json({ message: 'ok' });
  })
);

app.delete(
  '/api/admin/persyaratan/:id',
  ...adm,
  ah(async (req, res) => {
    try {
      await q('DELETE FROM persyaratan WHERE id=?', [req.params.id]);
    } catch {
      throw fail(409, 'Persyaratan sudah dipakai dokumen pengajuan');
    }
    await log(req, 'HAPUS_PERSYARATAN', req.params.id);
    res.json({ message: 'ok' });
  })
);

app.get(
  '/api/admin/logs',
  ...adm,
  ah(async (req, res) =>
    res.json(await q('SELECT l.*,u.nama FROM activity_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 200'))
  )
);

app.get(
  '/api/admin/system-status',
  ...adm,
  ah(async (req, res) => {
    const users = await q('SELECT id, nama, role, status_verifikasi, aktif, created_at FROM users');
    const jenis = await q('SELECT id, kode, nama, aktif FROM jenis_surat');
    const syarat = await q('SELECT id FROM persyaratan');
    const logs = await q('SELECT l.*, u.nama FROM activity_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 200');
    const [desa] = await q('SELECT nama_desa, logo_url, website, email FROM profil_desa ORDER BY id ASC LIMIT 1');

    const byRole = { admin: 0, lurah: 0, petugas: 0, warga: 0 };
    let aktifCount = 0;
    let nonaktifCount = 0;
    let wargaTerverifikasi = 0;
    let wargaPending = 0;
    let wargaDitolak = 0;

    for (const u of users || []) {
      if (byRole[u.role] !== undefined) byRole[u.role] += 1;
      if (u.aktif) aktifCount += 1;
      else nonaktifCount += 1;
      if (u.role === 'warga') {
        if (u.status_verifikasi === 'terverifikasi') wargaTerverifikasi += 1;
        else if (u.status_verifikasi === 'ditolak') wargaDitolak += 1;
        else wargaPending += 1;
      }
    }

    const jenisAktif = (jenis || []).filter((j) => Number(j.aktif) === 1).length;
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const logsToday = (logs || []).filter((l) => String(l.created_at || '').startsWith(todayPrefix)).length;

    res.json({
      server: {
        status: 'online',
        node_version: process.version,
        uptime_seconds: Math.floor(process.uptime()),
        db_mode: db.isLocalMode() ? 'Local Storage Fallback (Offline Mode)' : 'Supabase PostgreSQL Cloud',
        is_local_mode: db.isLocalMode(),
        upload_policy: 'Tanpa Batasan Ukuran (Unlimited Media)',
        auth_method: 'JWT Bearer + Query Token',
      },
      users: {
        total: (users || []).length,
        aktif: aktifCount,
        nonaktif: nonaktifCount,
        by_role: byRole,
        warga_verifikasi: {
          terverifikasi: wargaTerverifikasi,
          menunggu: wargaPending,
          ditolak: wargaDitolak,
        },
      },
      master: {
        jenis_total: (jenis || []).length,
        jenis_aktif: jenisAktif,
        jenis_nonaktif: (jenis || []).length - jenisAktif,
        persyaratan_total: (syarat || []).length,
      },
      portal: {
        nama_desa: desa?.nama_desa || 'Kelurahan Suka Maju',
        has_logo: Boolean(desa?.logo_url),
        website: desa?.website || '-',
        email: desa?.email || '-',
      },
      security: {
        total_logs: (logs || []).length,
        logs_today: logsToday,
        recent_logs: (logs || []).slice(0, 6),
      },
    });
  })
);

/* ====================================================================
   7. TATA KELOLA PERSURATAN KEDINASAN (PETUGAS TATA USAHA & LURAH)
   ==================================================================== */

// Daftar Surat Masuk
app.get(
  '/api/surat-masuk',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const qSearch = req.query.q ? `%${req.query.q}%` : null;
    const status = req.query.status || null;
    let whereClauses = [];
    let params = [];

    if (qSearch) {
      whereClauses.push('(sm.nomor_surat ILIKE ? OR sm.pengirim ILIKE ? OR sm.perihal ILIKE ?)');
      params.push(qSearch, qSearch, qSearch);
    }
    if (status && status !== 'all') {
      whereClauses.push('sm.status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const rows = await q(
      `SELECT sm.*, u.nama AS pencatat,
              d.id AS disposisi_id, d.sifat AS disposisi_sifat, d.tujuan_disposisi, d.arahan AS disposisi_arahan,
              sk.id AS surat_keluar_id, sk.nomor_surat AS nomor_surat_balasan
       FROM surat_masuk sm
       LEFT JOIN users u ON u.id = sm.dicatat_oleh
       LEFT JOIN disposisi d ON d.surat_masuk_id = sm.id
       LEFT JOIN surat_keluar sk ON sk.surat_masuk_id = sm.id
       ${whereSql}
       ORDER BY sm.id DESC`,
      params
    );
    res.json(rows);
  })
);

// Catat Surat Masuk Baru (Petugas Tata Usaha / Lurah)
app.post(
  '/api/surat-masuk',
  auth,
  role('petugas', 'lurah'),
  upload.single('lampiran'),
  ah(async (req, res) => {
    const { nomor_surat, pengirim, tanggal_surat, perihal, ringkasan_isi } = req.body;
    if (!nomor_surat || !pengirim || !tanggal_surat || !perihal) {
      throw fail(400, 'Nomor surat, pengirim, tanggal surat, dan perihal wajib diisi');
    }

    const filePath = req.file ? req.file.path : null;

    const [r] = await db.query(
      `INSERT INTO surat_masuk (nomor_surat, pengirim, tanggal_surat, perihal, ringkasan_isi, file_lampiran, dicatat_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [nomor_surat, pengirim, tanggal_surat, perihal, ringkasan_isi || '', filePath, req.user.id]
    );

    // Beri notifikasi ke Lurah bahwa ada surat masuk yang memerlukan disposisi
    await notifRole('lurah', `📬 Surat masuk baru dari ${pengirim} (Nomor: ${nomor_surat}) perihal "${perihal}". Menunggu disposisi Lurah.`);
    await log(req, 'CATAT_SURAT_MASUK', `Nomor: ${nomor_surat}, Pengirim: ${pengirim}`);

    res.status(201).json({ id: r[0]?.id || r.insertId, message: 'Surat masuk berhasil dicatat' });
  })
);

// Detail Surat Masuk + Riwayat Disposisi + Surat Balasan
app.get(
  '/api/surat-masuk/:id',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const sm = await q('SELECT sm.*, u.nama AS pencatat FROM surat_masuk sm LEFT JOIN users u ON u.id = sm.dicatat_oleh WHERE sm.id = ?', [req.params.id]);
    if (!sm.length) throw fail(404, 'Surat masuk tidak ditemukan');

    const disp = await q(
      `SELECT d.*, u.nama AS lurah_nama, u.jabatan AS lurah_jabatan
       FROM disposisi d
       LEFT JOIN users u ON u.id = d.lurah_id
       WHERE d.surat_masuk_id = ?
       ORDER BY d.id DESC`,
      [req.params.id]
    );

    const balasan = await q(
      `SELECT sk.*, p.nama AS pembuat, l.nama AS penandatangan
       FROM surat_keluar sk
       LEFT JOIN users p ON p.id = sk.petugas_id
       LEFT JOIN users l ON l.id = sk.ditandatangani_oleh
       WHERE sk.surat_masuk_id = ?
       ORDER BY sk.id DESC`,
      [req.params.id]
    );

    res.json({
      surat: sm[0],
      disposisi: disp,
      balasan: balasan,
    });
  })
);

// Berikan Lembar Disposisi Lurah (Eksklusif Lurah)
app.post(
  '/api/surat-masuk/:id/disposisi',
  auth,
  role('lurah'),
  ah(async (req, res) => {
    const { tujuan_disposisi, sifat, arahan } = req.body;
    if (!tujuan_disposisi || !arahan || !arahan.trim()) {
      throw fail(400, 'Tujuan disposisi dan instruksi arahan Lurah wajib diisi');
    }

    const sm = await q('SELECT * FROM surat_masuk WHERE id = ?', [req.params.id]);
    if (!sm.length) throw fail(404, 'Surat masuk tidak ditemukan');

    await q(
      `INSERT INTO disposisi (surat_masuk_id, lurah_id, tujuan_disposisi, sifat, arahan)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, req.user.id, tujuan_disposisi, sifat || 'Biasa', arahan.trim()]
    );

    await q("UPDATE surat_masuk SET status = 'didisposisi' WHERE id = ?", [req.params.id]);

    await notifRole('petugas', `📋 Disposisi Lurah untuk surat masuk ${sm[0].nomor_surat}: "${arahan}". Ditujukan kepada: ${tujuan_disposisi}.`);
    await log(req, 'DISPOSISI_LURAH', `Surat: ${sm[0].nomor_surat}, Kepada: ${tujuan_disposisi}`);

    res.json({ message: 'Lembar disposisi Lurah berhasil disimpan' });
  })
);

// Buat Surat Balasan Resmi Kedinasan atas Surat Masuk
app.post(
  '/api/surat-masuk/:id/balas',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const { perihal, isi_surat } = req.body;
    if (!perihal || !isi_surat || !isi_surat.trim()) {
      throw fail(400, 'Perihal dan isi surat balasan wajib diisi');
    }

    const smList = await q('SELECT * FROM surat_masuk WHERE id = ?', [req.params.id]);
    if (!smList.length) throw fail(404, 'Surat masuk tidak ditemukan');
    const sm = smList[0];

    const now = new Date();
    const tahun = now.getFullYear();
    const skRows = await q('SELECT id, created_at FROM surat_keluar');
    const countThisYear = (skRows || []).filter((x) => !x.created_at || String(x.created_at).startsWith(String(tahun))).length;
    const n = countThisYear + 1;
    const nomorSuratKeluar = `005/${String(n).padStart(3, '0')}/KEL-SKM/${ROM[now.getMonth()]}/${tahun}`;

    // Ambil data lurah penandatangan resmi
    const [lurah] = await q("SELECT id, nama, jabatan, nip, tanda_tangan FROM users WHERE role = 'lurah' AND aktif = 1 ORDER BY id ASC LIMIT 1");

    const storageDir = path.join(DATA_DIR, 'storage', 'surat_keluar');
    fs.mkdirSync(storageDir, { recursive: true });
    const kodeFile = crypto.randomBytes(6).toString('hex');
    const file = path.join(storageDir, `Surat-Balasan-${kodeFile}.pdf`);

    const [profil] = await q('SELECT * FROM profil_desa LIMIT 1');
    const tanggalStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Buat PDF surat dinas
    await buatPdfSuratDinas(
      {
        nomor: nomorSuratKeluar,
        tujuan: sm.pengirim,
        perihal: perihal,
        isi: isi_surat.trim(),
        tanggal: tanggalStr,
        kop: profil || {},
        lurah: lurah?.nama || profil?.nama_lurah || 'Muhammad Iqbal Samosir, S.E., M.A.P.',
        nip: lurah?.nip || profil?.nip_lurah || '198506122010011005',
        jabatan: lurah?.jabatan || profil?.jabatan_lurah || 'Lurah Suka Maju',
        tanda_tangan: lurah?.tanda_tangan || null,
      },
      file
    );

    const [r] = await db.query(
      `INSERT INTO surat_keluar (surat_masuk_id, nomor_surat, tujuan, perihal, isi_surat, tanggal_surat, file_path, petugas_id, ditandatangani_oleh, status)
       VALUES (?, ?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, 'dikirim') RETURNING id`,
      [sm.id, nomorSuratKeluar, sm.pengirim, perihal, isi_surat.trim(), file, req.user.id, lurah?.id || req.user.id]
    );

    await q("UPDATE surat_masuk SET status = 'dibalas' WHERE id = ?", [sm.id]);

    await notifRole('lurah', `📨 Surat balasan resmi telah diterbitkan untuk ${sm.pengirim} dengan Nomor: ${nomorSuratKeluar}`);
    await log(req, 'BUAT_SURAT_BALASAN', `Nomor Balasan: ${nomorSuratKeluar}, Atas Surat Masuk: ${sm.nomor_surat}`);

    res.status(201).json({
      id: r[0]?.id || r.insertId,
      nomor_surat: nomorSuratKeluar,
      message: 'Surat balasan resmi berhasil diterbitkan dan diarsipkan',
    });
  })
);

// Daftar Semua Surat Keluar / Surat Dinas
app.get(
  '/api/surat-keluar',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const qSearch = req.query.q ? `%${req.query.q}%` : null;
    let whereSql = '';
    let params = [];
    if (qSearch) {
      whereSql = 'WHERE sk.nomor_surat ILIKE ? OR sk.tujuan ILIKE ? OR sk.perihal ILIKE ?';
      params = [qSearch, qSearch, qSearch];
    }

    const rows = await q(
      `SELECT sk.*, sm.nomor_surat AS nomor_surat_masuk, sm.pengirim AS pengirim_asal,
              p.nama AS pembuat, p.role AS pembuat_role, l.nama AS penandatangan
       FROM surat_keluar sk
       LEFT JOIN surat_masuk sm ON sm.id = sk.surat_masuk_id
       LEFT JOIN users p ON p.id = sk.petugas_id
       LEFT JOIN users l ON l.id = sk.ditandatangani_oleh
       ${whereSql}
       ORDER BY sk.id DESC`,
      params
    );
    res.json(rows);
  })
);

// Buat Surat Keluar / Surat Dinas Mandiri (Petugas Tata Usaha / Lurah)
app.post(
  '/api/surat-keluar',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const { tujuan, perihal, isi_surat } = req.body;
    if (!tujuan || !tujuan.trim()) throw fail(400, 'Tujuan / penerima surat dinas wajib diisi');
    if (!perihal || !perihal.trim()) throw fail(400, 'Perihal surat wajib diisi');
    if (!isi_surat || !isi_surat.trim()) throw fail(400, 'Isi redaksi surat dinas wajib diisi');

    const now = new Date();
    const tahun = now.getFullYear();
    const skRows = await q('SELECT id, created_at FROM surat_keluar');
    const countThisYear = (skRows || []).filter((x) => !x.created_at || String(x.created_at).startsWith(String(tahun))).length;
    const n = countThisYear + 1;
    const nomorSuratKeluar = `005/${String(n).padStart(3, '0')}/KEL-SKM/${ROM[now.getMonth()]}/${tahun}`;

    // Ambil data profil desa & kop surat
    const [desaList] = await q('SELECT * FROM profil_desa ORDER BY id ASC LIMIT 1');
    const kop = desaList || {
      nama_desa: 'Kelurahan Suka Maju',
      kecamatan: 'Kecamatan Medan Johor',
      kabupaten_kota: 'Pemerintah Kota Medan',
      provinsi: 'Sumatera Utara',
      alamat: 'Jl. STM No. 40, Kelurahan Suka Maju',
      kode_pos: '20146',
      telepon: '0823-4123-5734',
    };

    // Ambil data lurah penandatangan resmi
    const [lurah] = await q("SELECT id, nama, jabatan, nip, tanda_tangan FROM users WHERE role = 'lurah' AND aktif = 1 ORDER BY id ASC LIMIT 1");

    const storageDir = path.join(DATA_DIR, 'storage', 'surat_keluar');
    fs.mkdirSync(storageDir, { recursive: true });
    const kodeFile = crypto.randomBytes(6).toString('hex');
    const file = path.join(storageDir, `Surat-Dinas-${kodeFile}.pdf`);

    const tanggalStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Buat PDF surat dinas resmi dengan KOP Kelurahan Dinamis & TTE Lurah Asli
    await buatPdfSuratDinas(
      {
        nomor: nomorSuratKeluar,
        tujuan: tujuan.trim(),
        perihal: perihal.trim(),
        isi: isi_surat.trim(),
        tanggal: tanggalStr,
        kop,
        lurah: lurah?.nama || kop.nama_lurah || 'Muhammad Iqbal Samosir, S.E., M.A.P.',
        nip: lurah?.nip || kop.nip_lurah || '198506122010011005',
        jabatan: lurah?.jabatan || kop.jabatan_lurah || 'Lurah Suka Maju',
        tanda_tangan: lurah?.tanda_tangan || null,
      },
      file
    );

    const [r] = await db.query(
      `INSERT INTO surat_keluar (nomor_surat, tujuan, perihal, isi_surat, tanggal_surat, file_path, petugas_id, ditandatangani_oleh, status)
       VALUES (?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, 'dikirim') RETURNING id`,
      [nomorSuratKeluar, tujuan.trim(), perihal.trim(), isi_surat.trim(), file, req.user.id, lurah?.id || req.user.id]
    );

    if (req.user.role !== 'lurah') {
      await notifRole('lurah', `📤 Surat dinas keluar baru diterbitkan oleh ${req.user.nama}: "${perihal}" kepada ${tujuan} (Nomor: ${nomorSuratKeluar})`);
    }
    await log(req, 'BUAT_SURAT_KELUAR', `Nomor: ${nomorSuratKeluar}, Tujuan: ${tujuan}`);

    res.status(201).json({
      id: r[0]?.id || r.insertId,
      nomor_surat: nomorSuratKeluar,
      message: 'Surat dinas resmi berhasil dibuat dan diarsipkan',
    });
  })
);

// Unduh PDF Surat Keluar / Balasan
app.get(
  '/api/surat-keluar/:id/pdf',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const sk = await q('SELECT * FROM surat_keluar WHERE id = ?', [req.params.id]);
    if (!sk.length) throw fail(404, 'Data surat keluar tidak ditemukan');
    const s = sk[0];

    const fullPath = s.file_path ? path.resolve(s.file_path) : null;
    if (req.query.refresh || req.query.regenerate || !fullPath || !fs.existsSync(fullPath)) {
      // Buat ulang jika file belum ada atau diminta refresh
      const storageDir = path.join(DATA_DIR, 'storage', 'surat_keluar');
      fs.mkdirSync(storageDir, { recursive: true });
      const kodeFile = crypto.randomBytes(6).toString('hex');
      const newFile = path.join(storageDir, `Surat-Keluar-${kodeFile}.pdf`);

      const [lurah] = await q("SELECT nama, nip, jabatan, tanda_tangan FROM users WHERE id = ?", [s.ditandatangani_oleh]);
      const [profil] = await q('SELECT * FROM profil_desa LIMIT 1');
      const now = new Date(s.tanggal_surat || s.created_at);
      const tanggalStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      await buatPdfSuratDinas(
        {
          nomor: s.nomor_surat,
          tujuan: s.tujuan,
          perihal: s.perihal,
          isi: s.isi_surat,
          tanggal: tanggalStr,
          kop: profil || {},
          lurah: lurah?.nama || profil?.nama_lurah || 'Muhammad Iqbal Samosir, S.E., M.A.P.',
          nip: lurah?.nip || profil?.nip_lurah || '198506122010011005',
          jabatan: lurah?.jabatan || profil?.jabatan_lurah || 'Lurah Suka Maju',
          tanda_tangan: lurah?.tanda_tangan || null,
        },
        newFile
      );

      await q('UPDATE surat_keluar SET file_path = ? WHERE id = ?', [newFile, s.id]);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Surat-${s.nomor_surat.replace(/[/\\?%*:|"<>]/g, '_')}.pdf"`);
      return res.sendFile(newFile);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Surat-${s.nomor_surat.replace(/[/\\?%*:|"<>]/g, '_')}.pdf"`);
    res.sendFile(fullPath);
  })
);

// Hapus surat keluar
app.delete(
  '/api/surat-keluar/:id',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const [sk] = await q('SELECT * FROM surat_keluar WHERE id=?', [req.params.id]);
    if (!sk) throw fail(404, 'Surat keluar tidak ditemukan');
    if (sk.file_path && fs.existsSync(sk.file_path)) {
      try { fs.unlinkSync(sk.file_path); } catch { }
    }
    await q('DELETE FROM surat_keluar WHERE id=?', [req.params.id]);
    await log(req, 'HAPUS_SURAT_KELUAR', `ID: ${req.params.id}, Nomor: ${sk.nomor_surat}`);
    res.json({ message: 'Surat keluar berhasil dihapus dari sistem.' });
  })
);

// Hapus surat masuk
app.delete(
  '/api/surat-masuk/:id',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const [sm] = await q('SELECT * FROM surat_masuk WHERE id=?', [req.params.id]);
    if (!sm) throw fail(404, 'Surat masuk tidak ditemukan');
    await q('DELETE FROM disposisi WHERE surat_masuk_id=?', [req.params.id]);
    await q('DELETE FROM surat_masuk WHERE id=?', [req.params.id]);
    await log(req, 'HAPUS_SURAT_MASUK', `ID: ${req.params.id}, Nomor: ${sm.nomor_surat}`);
    res.json({ message: 'Surat masuk berhasil dihapus dari sistem.' });
  })
);

// Update / sesuaikan redaksi isi naskah surat (sebelum atau sesudah terbit)
app.put(
  '/api/pengajuan/:id/redaksi',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const { redaksi, pembuka, penutup, nomor } = req.body;
    const p = await getP(req.params.id, req.user);

    let currentData = typeof p.data_form === 'string' ? JSON.parse(p.data_form || '{}') : (p.data_form || {});
    if (redaksi !== undefined) currentData.redaksi_kustom = redaksi;
    if (pembuka !== undefined) currentData.pembuka_kustom = pembuka;
    if (penutup !== undefined) currentData.penutup_kustom = penutup;

    await q('UPDATE pengajuan SET data_form=?::jsonb WHERE id=?', [JSON.stringify(currentData), p.id]);

    if (nomor) {
      await q('UPDATE surat SET nomor=? WHERE pengajuan_id=?', [nomor, p.id]);
    }

    // Jika berkas PDF surat sudah pernah dibuat, regenerate otomatis dengan teks baru
    const [s] = await q('SELECT * FROM surat WHERE pengajuan_id=?', [p.id]);
    if (s) {
      try {
        await prosesTerbitkanSurat(p.id, req.user, null, true);
      } catch (err) {
        console.warn('[PDF Regenerate Error]', err.message);
      }
    }

    await log(req, 'UPDATE_REDAKSI_SURAT', `Pengajuan: ${p.kode}, Pengubah: ${req.user.nama}`);
    res.json({ message: 'Isi redaksi surat berhasil disimpan dan diperbarui!', data_form: currentData });
  })
);

// Hapus / batalkan pengajuan surat
app.delete(
  '/api/pengajuan/:id',
  auth,
  ah(async (req, res) => {
    const p = await getP(req.params.id, req.user);
    if (req.user.role === 'warga') {
      if (p.user_id !== req.user.id) throw fail(403, 'Akses ditolak');
      if (['issued'].includes(p.status)) {
        throw fail(400, 'Surat yang sudah terbit resmi tidak dapat dibatalkan');
      }
    } else if (!['petugas', 'lurah'].includes(req.user.role)) {
      throw fail(403, 'Akses ditolak');
    }

    const [s] = await q('SELECT file_path FROM surat WHERE pengajuan_id=?', [p.id]);
    if (s?.file_path && fs.existsSync(s.file_path)) {
      try { fs.unlinkSync(s.file_path); } catch { }
    }

    await q('DELETE FROM dokumen WHERE pengajuan_id=?', [p.id]);
    await q('DELETE FROM verifikasi WHERE pengajuan_id=?', [p.id]);
    await q('DELETE FROM persetujuan WHERE pengajuan_id=?', [p.id]);
    await q('DELETE FROM surat WHERE pengajuan_id=?', [p.id]);
    await q('DELETE FROM pengajuan WHERE id=?', [p.id]);

    await log(req, 'HAPUS_PENGAJUAN', `Pengajuan ${p.kode} (ID: ${p.id}) dihapus oleh ${req.user.nama}`);
    res.json({ message: 'Pengajuan surat berhasil dibatalkan / dihapus dari sistem.' });
  })
);

// Hapus arsip surat
app.delete(
  '/api/arsip/:pengajuan_id',
  auth,
  role('petugas', 'lurah'),
  ah(async (req, res) => {
    const pid = req.params.pengajuan_id;
    const [s] = await q('SELECT file_path, nomor FROM surat WHERE pengajuan_id=?', [pid]);
    if (s?.file_path && fs.existsSync(s.file_path)) {
      try { fs.unlinkSync(s.file_path); } catch { }
    }
    await q('DELETE FROM surat WHERE pengajuan_id=?', [pid]);
    await q("UPDATE pengajuan SET status='rejected', catatan='Surat dibatalkan dari arsip' WHERE id=?", [pid]);
    await log(req, 'HAPUS_ARSIP_SURAT', `Pengajuan ID: ${pid}, Nomor: ${s?.nomor || '-'}`);
    res.json({ message: 'Surat berhasil dihapus dari arsip kelurahan.' });
  })
);

// Endpoint utama
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SIPESUR Backend API aktif',
    version: '1.0.0',
    status: 'online'
  });
});

// Endpoint health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy'
  });
});

// Handler 404 HARUS setelah semua endpoint
app.use((req, res) => {
  res.status(404).json({
    message: 'Endpoint tidak ditemukan'
  });
});

app.use((e, req, res, next) => {
  const s = e.status || (e.name === 'MulterError' ? 400 : 500);
  if (s >= 400) (req.files || []).forEach((f) => fs.unlink(f.path, () => { }));
  if (s === 500) console.error('API Error:', e.message || e);

  let msg = e.message;
  if (e.code === 'ECONNREFUSED' || e.code === 'EACCES' || e.message?.includes('connect') || e.message?.includes('password')) {
    msg = e.message || 'Koneksi ke Supabase gagal: Pastikan password database Supabase sudah diisi di .env';
  }
  res.status(s).json({ message: msg || 'Kesalahan server' });
});

const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`SIPESUR API berjalan di port ${PORT}`));
}

export default app;
