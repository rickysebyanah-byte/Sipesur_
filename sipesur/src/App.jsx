import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, NavLink, Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import api, { openBlob, downloadPdf, viewPdf, getFileUrl } from './api';
import SignaturePad from './components/SignaturePad';
import ModalCetakSurat from './components/ModalCetakSurat';
import ProfilDesa from './components/ProfilDesa';
import ModalPersetujuanLurah from './components/ModalPersetujuanLurah';

const Ctx = createContext();
const useAuth = () => useContext(Ctx);

const ST = {
  submitted: 'Diajukan',
  under_review: 'Sedang diperiksa',
  revision_required: 'Perlu revisi',
  pending_approval: 'Menunggu Lurah',
  rejected: 'Ditolak',
  approved: 'Disetujui',
  issued: 'Terbit',
};

const COL = {
  submitted: 'bg-slate-100 text-slate-800 border-slate-300',
  under_review: 'bg-sky-50 text-sky-900 border-sky-400',
  revision_required: 'bg-amber-50 text-amber-900 border-amber-400',
  pending_approval: 'bg-brand-50 text-brand-900 border-brand-500 font-semibold',
  rejected: 'bg-rose-50 text-rose-900 border-rose-400',
  approved: 'bg-indigo-50 text-indigo-900 border-indigo-400',
  // Surat yang sudah terbit diberi tanda cap kantor elegan
  issued: 'bg-brand-700 text-white border-brand-800 font-bold shadow-xs',
};

const ST_WARGA = {
  menunggu_verifikasi: 'Menunggu verifikasi',
  terverifikasi: 'Terverifikasi',
  ditolak: 'Verifikasi ditolak',
};

const COL_WARGA = {
  menunggu_verifikasi: 'bg-amber-50 text-amber-900 border-amber-400',
  terverifikasi: 'bg-emerald-50 text-emerald-900 border-emerald-500 font-semibold',
  ditolak: 'bg-rose-50 text-rose-900 border-rose-400',
};

const ROLE_LABEL = {
  admin: 'IT Administrator Sistem',
  lurah: 'Pimpinan Kelurahan (Lurah)',
  petugas: 'Staf Pelayanan & Tata Usaha',
  warga: 'Warga Pemohon',
};

const ROLE_THEME = {
  warga: {
    border: 'border-emerald-700',
    navActive: 'border-emerald-700 bg-emerald-50 font-bold text-emerald-950',
    pill: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    profileBox: 'bg-emerald-50/40',
    brandText: 'text-emerald-900',
    mainBg: 'bg-emerald-50/20',
    bar: 'bg-emerald-600',
  },
  petugas: {
    border: 'border-sky-700',
    navActive: 'border-sky-700 bg-sky-50 font-bold text-sky-950',
    pill: 'bg-sky-100 text-sky-900 border-sky-300',
    profileBox: 'bg-sky-50/40',
    brandText: 'text-sky-900',
    mainBg: 'bg-sky-50/20',
    bar: 'bg-sky-600',
  },
  lurah: {
    border: 'border-indigo-800',
    navActive: 'border-indigo-700 bg-indigo-50 font-bold text-indigo-950',
    pill: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    profileBox: 'bg-indigo-50/40',
    brandText: 'text-indigo-950',
    mainBg: 'bg-indigo-50/20',
    bar: 'bg-indigo-600',
  },
  admin: {
    border: 'border-violet-700',
    navActive: 'border-violet-700 bg-violet-50 font-bold text-violet-950',
    pill: 'bg-violet-100 text-violet-900 border-violet-300',
    profileBox: 'bg-violet-50/40',
    brandText: 'text-violet-950',
    mainBg: 'bg-violet-50/20',
    bar: 'bg-violet-600',
  },
};

const WARGA_LOCKED_PATHS = ['/app/ajukan', '/app/pengajuan', '/app/surat'];

const MENU = {
  warga: [
    ['/app', 'Beranda', '🏠'],
    ['/app/ajukan', 'Ajukan surat', '📝'],
    ['/app/pengajuan', 'Pengajuan saya', '📋'],
    ['/app/surat', 'Surat saya', '📜'],
    ['/app/berita', 'Berita & Pengumuman', '📰'],
    ['/app/profil', 'Profil kependudukan', '🪪'],
  ],
  petugas: [
    ['/app', 'Beranda Loket', '🏠'],
    ['/app/verifikasi-warga', 'Verifikasi Akun Warga', '🪪'],
    ['/app/pengajuan', 'Pemeriksaan Surat Warga', '📥'],
    ['/app/surat-masuk', 'Surat Masuk & Balasan', '📨'],
    ['/app/surat-keluar', 'Surat Keluar Kedinasan', '📤'],
    ['/app/arsip', 'Arsip Surat Warga', '🗂️'],
    ['/app/berita', 'Berita & Pengumuman', '📰'],
    ['/app/umkm', 'Direktori UMKM', '🏪'],
    ['/app/galeri', 'Galeri Kegiatan', '🖼️'],
    ['/app/profil', 'Profil & Paraf Petugas', '✍️'],
  ],
  lurah: [
    ['/app', 'Beranda Pimpinan', '🏛️'],
    ['/app/pengajuan', 'ACC & TTE Surat Warga', '✍️'],
    ['/app/surat-masuk', 'Disposisi Surat Masuk', '📨'],
    ['/app/surat-keluar', 'Surat Dinas Keluar', '📤'],
    ['/app/verifikasi-warga', 'Supervisi Warga', '👥'],
    ['/app/arsip', 'Arsip Surat Resmi', '🗂️'],
    ['/app/anggaran', 'Anggaran Kelurahan', '💰'],
    ['/app/berita', 'Berita & Kebijakan', '📰'],
    ['/app/profil-desa', 'Identitas & Kop Lurah', '🏢'],
    ['/app/profil', 'Profil & TTE Lurah', '🖋️'],
  ],
  admin: [
    ['/app', 'Beranda IT & Sistem', '🖥️'],
    ['/app/pengguna', 'Manajemen Pengguna & Peran', '👥'],
    ['/app/jenis', 'Master Surat & Template', '📋'],
    ['/app/profil-desa', 'Konfigurasi Portal & Kop', '⚙️'],
    ['/app/log', 'Audit Log & Keamanan', '🛡️'],
    ['/app/profil', 'Profil & Keamanan IT', '🔐'],
  ],
};

const em = (e) => e.response?.data?.message || 'Terjadi kesalahan pada sistem, coba lagi.';
const tg = (d) => {
  if (!d) return '-';
  const dt = new Date(typeof d === 'string' ? d.replace(' ', 'T') : d);
  return isNaN(dt.getTime()) ? '-' : dt.toLocaleString('id-ID');
};

const maskId = (str) => {
  if (!str || str.length < 16) return str || '-';
  return str.slice(0, 6) + '******' + str.slice(12);
};

function getPasswordStrength(p) {
  if (!p) return { score: 0, label: '', color: 'bg-slate-200', text: 'text-slate-400', width: '0%' };
  let score = 0;
  if (p.length >= 8) score += 1;
  if (p.length >= 10) score += 1;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
  if (/\d/.test(p)) score += 1;
  if (/[^A-Za-z0-9]/.test(p)) score += 1;

  if (score <= 2) return { score: 1, label: 'Lemah', color: 'bg-red-500', text: 'text-red-600', width: '33%' };
  if (score <= 4) return { score: 2, label: 'Sedang', color: 'bg-amber-500', text: 'text-amber-600', width: '66%' };
  return { score: 3, label: 'Kuat (Aman)', color: 'bg-emerald-500', text: 'text-emerald-600', width: '100%' };
}


function Icon({ name, className = 'w-4 h-4' }) {
  switch (name) {
    case 'home':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
    case 'file':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    case 'download':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
    case 'eye':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
    case 'check':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
    case 'shield':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
    case 'inbox':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>;
    case 'send':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
    case 'user':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    case 'building':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
    case 'alert':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
    case 'lock':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
    case 'logout':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
    case 'clock':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    default:
      return null;
  }
}

const Badge = ({ s }) => <span className={'badge ' + (COL[s] || 'bg-slate-100 text-slate-800 border-slate-400')}>{ST[s] || s}</span>;

const BadgeWarga = ({ s }) => (
  <span className={'badge ' + (COL_WARGA[s] || 'bg-slate-100 text-slate-800 border-slate-400')}>{ST_WARGA[s] || s}</span>
);

const Card = ({ title, subtitle, children, rightAction, className = '' }) => (
  <section className={`card ${className}`}>
    {(title || rightAction) && (
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          {title && <h2 className="text-base font-bold text-slate-950 sm:text-lg">{title}</h2>}
          {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
      </div>
    )}
    {children}
  </section>
);

const Field = ({ l, req, err, hint, children }) => (
  <label className="mb-4 block">
    <span className="mb-1.5 flex items-baseline justify-between gap-3 text-sm font-bold text-slate-800">
      <span>
        {l}
        {req && <span className="text-cap" aria-hidden="true"> *</span>}
      </span>
      {err && <span className="text-xs font-normal text-rose-700">{err}</span>}
    </span>
    <div>{children}</div>
    {hint && !err && <span className="mt-1 block text-xs text-slate-600">{hint}</span>}
  </label>
);

const Msg = ({ m }) =>
  m ? (
    <div
      role={m.ok ? 'status' : 'alert'}
      className={
        'mb-4 border-l-4 px-3 py-2.5 text-sm leading-snug ' +
        (m.ok ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-rose-700 bg-rose-50 text-rose-900')
      }
    >
      {m.t}
    </div>
  ) : null;

const Table = ({ head, rows }) => (
  <div className="w-full overflow-hidden rounded border border-slate-300 bg-white">
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-300 bg-slate-100 text-xs text-slate-700">
            {head.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-4 py-2.5 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {r.map((c, j) => (
                  <td key={j} className="px-4 py-3 align-middle text-slate-800">
                    {c}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-4 py-10 text-center text-sm text-slate-600" colSpan={head.length}>
                Belum ada data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

function useGet(url) {
  const [d, setD] = useState(null);
  const load = useCallback(() => api.get(url).then((r) => setD(r.data)).catch(() => setD([])), [url]);
  useEffect(() => {
    load();
  }, [load]);
  return [d, load];
}

function Provider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const login = (t, u) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
  };
  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);
  const logout = useCallback(() => {
    localStorage.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;
    api.get('/me')
      .then((res) => {
        if (res.data) {
          updateUser({
            nama: res.data.nama,
            role: res.data.role,
            jabatan: res.data.jabatan,
            nip: res.data.nip,
            status_verifikasi: res.data.status_verifikasi,
            catatan_verifikasi: res.data.catatan_verifikasi,
            must_change_password: Boolean(res.data.must_change_password),
            nik_masked: res.data.nik_masked,
          });
        }
      })
      .catch(() => {});
  }, []);

  return <Ctx.Provider value={{ user, login, logout, updateUser }}>{children}</Ctx.Provider>;
}

/* ====================================================================
   HALAMAN PUBLIK: LANDING, LOGIN, REGISTER, VERIFIKASI QR
   ==================================================================== */

const LAYANAN_LIST = [
  { kode: 'SKD', nama: 'Surat Keterangan Domisili', desc: 'Menerangkan alamat tempat tinggal resmi warga di wilayah kelurahan.', syarat: 'KTP, Kartu Keluarga, Pengantar RT/RW', tag: 'bg-blue-50 text-brand-700 border-blue-200' },
  { kode: 'SKTM', nama: 'Surat Keterangan Tidak Mampu', desc: 'Rekomendasi bantuan sosial, KIP/beasiswa, dan keringanan biaya.', syarat: 'KTP, Kartu Keluarga, Pernyataan Penghasilan', tag: 'bg-blue-50 text-brand-700 border-blue-200' },
  { kode: 'SKU', nama: 'Surat Keterangan Usaha', desc: 'Keterangan izin usaha mikro warga untuk pengajuan legalitas/kredit.', syarat: 'KTP, KK, Foto Usaha', tag: 'bg-blue-50 text-brand-700 border-blue-200' },
  { kode: 'SKCK', nama: 'Pengantar SKCK Kepolisian', desc: 'Surat pengantar permohonan SKCK di Polsek / Polres setempat.', syarat: 'KTP, Kartu Keluarga, Pas Foto', tag: 'bg-blue-50 text-brand-700 border-blue-200' },
  { kode: 'SKBM', nama: 'Surat Keterangan Belum Menikah', desc: 'Keterangan status perkawinan lajang untuk keperluan kerja / KPR.', syarat: 'KTP, KK, Surat Pernyataan Belum Menikah', tag: 'bg-blue-50 text-brand-700 border-blue-200' },
  { kode: 'SKLH', nama: 'Surat Keterangan Kelahiran', desc: 'Keterangan pengantar pencatatan kelahiran anak di Disdukcapil.', syarat: 'KTP Orang Tua, KK, Surat Bidan/RS', tag: 'bg-blue-50 text-brand-700 border-blue-200' },
  { kode: 'SKM', nama: 'Surat Keterangan Kematian', desc: 'Keterangan pencatatan kematian warga untuk pemakaman & taspen.', syarat: 'KTP Almarhum, KTP Pelapor, KK', tag: 'bg-blue-50 text-brand-700 border-blue-200' },
  { kode: 'SPP', nama: 'Surat Keterangan Penghasilan', desc: 'Keterangan rincian penghasilan rata-rata orang tua/wali pemohon.', syarat: 'KTP, Kartu Keluarga, Bukti Usaha/Slip', tag: 'bg-blue-50 text-brand-700 border-blue-200' },
];

function Landing() {
  const [desa] = useGet('/profil-desa');
  const [jenisSurat] = useGet('/jenis-surat');
  const [beritaData] = useGet('/berita');
  const [umkmData] = useGet('/umkm');
  const [galeriData] = useGet('/galeri');
  const [statistik] = useGet('/statistik-publik');
  const [navOpen, setNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('beranda');
  const [cekKode, setCekKode] = useState('');
  const [cekHasil, setCekHasil] = useState(null);
  const [cekLoading, setCekLoading] = useState(false);
  const [cekErr, setCekErr] = useState('');

  const namaDesa = desa?.nama_desa || 'Kelurahan Suka Maju';
  const pemkab = desa?.kabupaten_kota || 'Pemerintah Kota Medan';
  const alamat = desa?.alamat || 'Jl. STM No. 40, Kelurahan Suka Maju, Kecamatan Medan Johor, Kota Medan 20146';
  const telepon = desa?.telepon || '0823-4123-5734';
  const email = desa?.email || 'kelurahan@pemkomedan.go.id';
  const lurahNama = desa?.lurah_nama || desa?.nama_lurah || 'Muhammad Iqbal Samosir, S.E., M.A.P.';
  const lurahNip = desa?.lurah_nip || desa?.nip_lurah || 'NIP. 19850612 201001 1 005';

  const layananCepat = [
    { kode: 'SKD', icon: '🏠', nama: 'Surat Keterangan Domisili', desc: 'Keterangan tempat tinggal resmi warga', warna: 'from-blue-600 to-blue-800' },
    { kode: 'SKTM', icon: '🤝', nama: 'Surat Keterangan Tidak Mampu', desc: 'Rekomendasi bantuan sosial & beasiswa', warna: 'from-emerald-600 to-emerald-800' },
    { kode: 'SKU', icon: '🏪', nama: 'Surat Keterangan Usaha', desc: 'Legalitas UMKM & izin usaha mikro', warna: 'from-amber-600 to-orange-700' },
    { kode: 'SKCK', icon: '🛡️', nama: 'Pengantar SKCK', desc: 'Surat pengantar ke Polsek/Polres', warna: 'from-violet-600 to-purple-800' },
    { kode: 'SKBM', icon: '💍', nama: 'Belum Menikah', desc: 'Keterangan status lajang untuk kerja/KPR', warna: 'from-rose-600 to-rose-800' },
    { kode: 'SKLH', icon: '👶', nama: 'Keterangan Kelahiran', desc: 'Pengantar pencatatan kelahiran anak', warna: 'from-teal-600 to-teal-800' },
  ];

  const alurLayanan = [
    { no: '01', judul: 'Daftar & Masuk', teks: 'Buat akun warga menggunakan NIK & KK. Verifikasi data kependudukan oleh petugas.', icon: '👤' },
    { no: '02', judul: 'Ajukan Online', teks: 'Pilih jenis surat, isi formulir, dan unggah dokumen persyaratan dari rumah.', icon: '📋' },
    { no: '03', judul: 'Periksa & ACC', teks: 'Petugas memeriksa berkas, Lurah memberikan persetujuan dan tanda tangan digital.', icon: '✅' },
    { no: '04', judul: 'Unduh Surat Resmi', teks: 'Surat ber-QR Code siap diunduh atau dicetak secara mandiri kapan saja.', icon: '📄' },
  ];

  const faq = [
    { q: 'Berapa lama proses penerbitan surat?', a: 'Rata-rata 1–2 hari kerja setelah berkas lengkap terverifikasi oleh petugas.' },
    { q: 'Apakah surat yang diterbitkan sah secara hukum?', a: 'Ya. Surat ditandatangani digital oleh Lurah dan dilengkapi kode QR verifikasi keaslian dokumen.' },
    { q: 'Bagaimana cara cek keaslian surat?', a: 'Pindai kode QR yang tertera pada lembar surat menggunakan kamera ponsel Anda.' },
    { q: 'Apakah bisa diakses dari ponsel?', a: 'Ya, portal ini sepenuhnya responsif dan dapat diakses dari smartphone maupun tablet.' },
  ];

  const berita = (beritaData && beritaData.length > 0)
    ? beritaData.map((b) => ({
        id: b.id,
        tgl: b.tanggal ? new Date(b.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
        judul: b.judul,
        isi: b.isi,
        kategori: b.kategori || 'Pengumuman',
        warna: b.kategori === 'Himbauan' ? 'bg-emerald-100 text-emerald-800'
             : b.kategori === 'Info Layanan' ? 'bg-amber-100 text-amber-800'
             : b.kategori === 'Kegiatan' ? 'bg-purple-100 text-purple-800'
             : 'bg-brand-100 text-brand-800',
      }))
    : [
        { tgl: '15 Nov 2026', judul: 'Peluncuran Layanan Surat Online SIPESUR', isi: `Pemerintah ${namaDesa} meluncurkan sistem layanan surat kependudukan secara daring untuk mempermudah warga.`, kategori: 'Pengumuman', warna: 'bg-brand-100 text-brand-800' },
        { tgl: '10 Nov 2026', judul: 'Jam Layanan Loket Pelayanan Administrasi', isi: 'Loket pelayanan di kantor kelurahan dibuka pukul 08.00 - 15.00 WIB setiap hari kerja.', kategori: 'Info Layanan', warna: 'bg-amber-100 text-amber-800' },
        { tgl: '5 Nov 2026', judul: 'Pemutakhiran Data Kependudukan & BLT Lingkungan', isi: 'Bagi seluruh warga yang mengalami perubahan data KK/domisili dihimbau memperbarui berkas di kantor kelurahan.', kategori: 'Himbauan', warna: 'bg-emerald-100 text-emerald-800' },
      ];

  const struktur = [
    { jabatan: 'Lurah', nama: lurahNama, nip: lurahNip, icon: '👔' },
    { jabatan: 'Sekretaris Kelurahan (Seklur)', nama: 'Vicky Al Wirya, S.Pt., M.M.', nip: 'NIP. 19880415 201201 1 002', icon: '📋' },
    { jabatan: 'Kasi Pelayanan', nama: 'Bambang Eko, S.Sos', nip: 'NIP. 19850315 201001 1 001', icon: '🏢' },
    { jabatan: 'Kasi Pemerintahan', nama: 'Rini Anggraeni, SE', nip: 'NIP. 19870622 201101 2 003', icon: '⚖️' },
  ];

  const statDemografi = [
    { label: 'Total Penduduk', nilai: '12.847', icon: '👥', warna: 'text-blue-700 bg-blue-50 border-blue-200' },
    { label: 'Jumlah KK', nilai: '3.421', icon: '🏘️', warna: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { label: 'RW / Lingkungan', nilai: '12 Lingkungan', icon: '🗺️', warna: 'text-amber-700 bg-amber-50 border-amber-200' },
    { label: 'Luas Wilayah', nilai: '3,2 km²', icon: '📐', warna: 'text-violet-700 bg-violet-50 border-violet-200' },
  ];

  const umkm = (umkmData && umkmData.length > 0)
    ? umkmData
    : [
        { nama: 'Warung Nasi Khas Medan Bu Siti', jenis: 'Kuliner', alamat: 'Jl. STM No. 25, Suka Maju, Medan Johor', telepon: '0812-6543-2109' },
        { nama: 'Toko Kelontong Berkah Johor', jenis: 'Sembako', alamat: 'Jl. Sakti Lubis No. 12, Suka Maju', telepon: '0813-7890-1234' },
        { nama: 'Johor Laundry Express', jenis: 'Jasa', alamat: 'Jl. STM Ujung No. 8, Suka Maju', telepon: '0821-6789-0123' },
        { nama: 'Konveksi & Bordir Maju Bersama', jenis: 'Tekstil', alamat: 'Jl. Suka Maju Indah No. 5', telepon: '0852-3456-7890' },
        { nama: 'Apotek Sehat Medika STM', jenis: 'Kesehatan', alamat: 'Jl. STM No. 55, Suka Maju, Medan Johor', telepon: '0878-1234-5678' },
        { nama: 'Studio Foto & Percetakan Digital', jenis: 'Jasa', alamat: 'Jl. STM No. 32, Suka Maju', telepon: '0831-9876-5432' },
      ];

  const NAV = [
    { id: 'beranda', label: '🏠 Beranda' },
    { id: 'layanan', label: '📋 Layanan' },
    { id: 'profil', label: '🏛️ Profil' },
    { id: 'berita', label: '📰 Berita' },
    { id: 'galeri', label: '🖼️ Galeri' },
    { id: 'umkm', label: '🏪 UMKM' },
    { id: 'anggaran', label: '💰 Anggaran' },
    { id: 'kontak', label: '📞 Kontak' },
  ];

  const scrollTo = (id) => {
    setActiveSection(id);
    setNavOpen(false);
    document.getElementById('sec-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">

      {/* ═══════════════════════════════════════════════
          TOP BAR (Pita Pemerintah Resmi)
      ═══════════════════════════════════════════════ */}
      <div className="bg-[#1a3a5c] text-white text-xs py-1.5 px-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-2">
          <span className="opacity-80 hidden sm:block">🏛️ Portal Resmi Pemerintah — {pemkab}</span>
          <span className="opacity-80">Layanan Online 24 Jam • Verifikasi QR Aktif</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          HEADER & NAVIGASI UTAMA
      ═══════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white border-b-4 border-[#c8a84b] shadow-md">
        <div className="mx-auto max-w-6xl px-4">
          {/* Identitas Kelurahan */}
          <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-100">
            <Link to="/" className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-[#1a3a5c] text-white font-serif font-bold text-xl flex items-center justify-center shadow-md flex-shrink-0">
                {desa?.logo_url
                  ? <img src={desa.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded" />
                  : <span>🏛</span>
                }
              </div>
              <div>
                <div className="font-bold text-[#1a3a5c] text-sm sm:text-base leading-tight">{namaDesa}</div>
                <div className="text-xs text-slate-500">{pemkab}</div>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Link to="/login" className="hidden sm:inline-flex btn btn-o text-xs py-1.5 px-3 font-semibold">
                Masuk
              </Link>
              <Link to="/register" className="btn text-xs py-1.5 px-3 font-bold bg-[#1a3a5c] text-white hover:bg-[#122a45] transition-colors rounded-lg shadow-sm">
                Daftar Akun
              </Link>
              <button
                className="sm:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => setNavOpen(!navOpen)}
              >
                {navOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>

          {/* Menu Navigasi Desktop */}
          <nav className="hidden sm:flex items-center gap-1 py-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => scrollTo(n.id)}
                className={`px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  activeSection === n.id
                    ? 'bg-[#1a3a5c] text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-[#1a3a5c]'
                }`}
              >
                {n.label}
              </button>
            ))}
          </nav>

          {/* Menu Mobile Dropdown */}
          {navOpen && (
            <div className="sm:hidden py-2 border-t border-slate-100 flex flex-col gap-1">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => scrollTo(n.id)}
                  className="text-left px-3 py-2.5 text-sm font-semibold rounded-md text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {n.label}
                </button>
              ))}
              <div className="border-t border-slate-200 mt-1 pt-2 flex gap-2">
                <Link to="/login" className="flex-1 btn btn-o text-xs py-2 text-center">Masuk</Link>
                <Link to="/register" className="flex-1 btn text-xs py-2 font-bold bg-[#1a3a5c] text-white hover:bg-[#122a45] rounded-lg text-center">Daftar</Link>
              </div>
            </div>
          )}
        </div>
      </header>

      <main>
        {/* ═══════════════════════════════════════════════
            HERO SECTION
        ═══════════════════════════════════════════════ */}
        <section id="sec-beranda" className="bg-gradient-to-br from-[#1a3a5c] via-[#1e4876] to-[#0f2340] text-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <div className="grid lg:grid-cols-[1fr_380px] gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-white/90 mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c8a84b] animate-pulse"></span>
                  Portal Resmi • Layanan Online 24 Jam
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.2] mb-5">
                  Layanan Administrasi<br />
                  <span className="text-[#c8a84b]">Kependudukan Digital</span><br />
                  {namaDesa}
                </h1>
                <p className="text-white/80 text-base sm:text-lg leading-relaxed mb-8 max-w-xl">
                  Urus surat keterangan resmi dari rumah, tanpa antre di loket. 
                  Ajukan online, petugas verifikasi, Lurah sahkan dengan tanda tangan digital resmi.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c8a84b] hover:bg-[#b8983b] text-[#1a3a5c] font-bold text-sm sm:text-base py-3 px-6 transition-all shadow-lg hover:shadow-xl">
                    <span>📋</span>
                    <span>Ajukan Surat Online</span>
                  </Link>
                  <Link to="/cek-status" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold text-sm sm:text-base py-3 px-6 transition-all">
                    <span>🔍</span>
                    <span>Cek Status Permohonan</span>
                  </Link>
                </div>
              </div>

              {/* Card Sambutan Lurah */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/20">
                  <div className="w-14 h-14 rounded-xl bg-[#c8a84b]/20 border border-[#c8a84b]/40 flex items-center justify-center text-2xl">
                    👔
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{lurahNama}</div>
                    <div className="text-white/60 text-xs">{lurahNip}</div>
                    <div className="text-[#c8a84b] text-xs font-semibold mt-0.5">Lurah {namaDesa}</div>
                  </div>
                </div>
                <blockquote className="text-white/85 text-sm leading-relaxed italic">
                  "Selamat datang di portal layanan digital {namaDesa}. 
                  Kami berkomitmen memberikan pelayanan publik yang cepat, transparan, 
                  dan dapat diakses seluruh warga kapan saja dan di mana saja."
                </blockquote>
                <div className="mt-4 pt-3 border-t border-white/20 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="font-bold text-[#c8a84b] text-base">1–2</div>
                    <div className="text-white/60">Hari proses</div>
                  </div>
                  <div>
                    <div className="font-bold text-[#c8a84b] text-base">QR</div>
                    <div className="text-white/60">Verifikasi digital</div>
                  </div>
                  <div>
                    <div className="font-bold text-[#c8a84b] text-base">0 Rp</div>
                    <div className="text-white/60">Gratis</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            TOMBOL AKSI CEPAT (3 LAYANAN UTAMA)
        ═══════════════════════════════════════════════ */}
        <section className="bg-white border-b border-slate-200 shadow-sm">
          <div className="mx-auto max-w-6xl px-4 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link to="/register" className="flex items-center gap-3.5 p-4 rounded-xl border-2 border-[#1a3a5c] bg-[#1a3a5c] text-white hover:bg-[#122a45] transition-all group shadow-md">
                <span className="text-2xl">📋</span>
                <div>
                  <div className="font-bold text-sm">Ajukan Surat Online</div>
                  <div className="text-white/70 text-xs">Daftar & ajukan dari rumah</div>
                </div>
                <span className="ml-auto text-white/50 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link to="/cek-status" className="flex items-center gap-3.5 p-4 rounded-xl border-2 border-[#c8a84b] bg-[#c8a84b]/10 hover:bg-[#c8a84b]/20 text-[#8b6b1a] transition-all group shadow-sm">
                <span className="text-2xl">🔍</span>
                <div>
                  <div className="font-bold text-sm text-[#1a3a5c]">Cek Status Permohonan</div>
                  <div className="text-slate-500 text-xs">Pantau progres surat tanpa login</div>
                </div>
                <span className="ml-auto text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <a href={`tel:${telepon}`} className="flex items-center gap-3.5 p-4 rounded-xl border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 transition-all group shadow-sm">
                <span className="text-2xl">📞</span>
                <div>
                  <div className="font-bold text-sm">Kontak Darurat Lingkungan</div>
                  <div className="text-rose-600 text-xs">{telepon}</div>
                </div>
                <span className="ml-auto text-rose-400 group-hover:translate-x-1 transition-transform">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            KARTU LAYANAN CEPAT
        ═══════════════════════════════════════════════ */}
        <section id="sec-layanan" className="py-12 sm:py-16 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center mb-10">
              <div className="inline-block bg-[#1a3a5c]/10 text-[#1a3a5c] font-bold text-xs px-3 py-1 rounded-full mb-3">LAYANAN ADMINISTRASI</div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">Jenis Surat yang Dapat Diajukan</h2>
              <p className="mt-2 text-slate-500 text-sm max-w-xl mx-auto">Semua layanan surat keterangan kependudukan tersedia secara online, gratis, dan resmi berkekuatan hukum.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {layananCepat.map((l) => (
                <div key={l.kode} className="group bg-white rounded-2xl border border-slate-200 hover:border-[#1a3a5c]/30 hover:shadow-lg transition-all overflow-hidden">
                  <div className={`h-1.5 bg-gradient-to-r ${l.warna}`}></div>
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{l.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 text-sm leading-tight">{l.nama}</div>
                        <div className="text-xs text-slate-500 mt-1 leading-relaxed">{l.desc}</div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">{l.kode}</span>
                    </div>
                    <Link to="/register" className={`mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r ${l.warna} text-white text-xs font-bold py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <span>Ajukan Sekarang →</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Alur 3 Langkah */}
            <div className="mt-14 bg-gradient-to-r from-[#1a3a5c] to-[#0f2340] rounded-2xl p-6 sm:p-8 text-white">
              <h3 className="font-serif text-xl font-bold text-center mb-8">Cara Mengajukan Surat (3 Langkah Mudah)</h3>
              <div className="grid sm:grid-cols-4 gap-6">
                {alurLayanan.map((a, i) => (
                  <div key={a.no} className="text-center relative">
                    <div className="w-14 h-14 rounded-2xl bg-[#c8a84b]/20 border border-[#c8a84b]/40 flex items-center justify-center text-2xl mx-auto mb-3">
                      {a.icon}
                    </div>
                    <div className="text-[#c8a84b] text-xs font-bold mb-1">LANGKAH {a.no}</div>
                    <div className="font-bold text-white text-sm mb-1.5">{a.judul}</div>
                    <p className="text-white/65 text-xs leading-relaxed">{a.teks}</p>
                    {i < alurLayanan.length - 1 && (
                      <div className="hidden sm:block absolute top-7 -right-3 text-[#c8a84b]/50 text-lg">→</div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-8 text-center">
                <Link to="/register" className="inline-flex items-center gap-2 bg-[#c8a84b] hover:bg-[#b8983b] text-[#1a3a5c] font-bold py-3 px-8 rounded-xl transition-all shadow-lg text-sm">
                  Mulai Ajukan Sekarang
                </Link>
              </div>
            </div>

            {/* FAQ */}
            <div className="mt-10">
              <h3 className="font-serif text-xl font-bold text-slate-900 mb-5">Pertanyaan yang Sering Diajukan</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {faq.map((f, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="font-bold text-[#1a3a5c] text-sm mb-2 flex items-start gap-2">
                      <span className="text-[#c8a84b] font-black text-base leading-none mt-0.5">?</span>
                      <span>{f.q}</span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed pl-5">{f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            PROFIL WILAYAH & STRUKTUR PEMERINTAHAN
        ═══════════════════════════════════════════════ */}
        <section id="sec-profil" className="py-12 sm:py-16 bg-white border-y border-slate-200">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center mb-10">
              <div className="inline-block bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full mb-3">PROFIL WILAYAH</div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">Profil {namaDesa}</h2>
              <p className="mt-2 text-slate-500 text-sm max-w-lg mx-auto">Data kependudukan, geografi, dan struktur pemerintahan kelurahan resmi.</p>
            </div>

            {/* Data Demografi */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
              {statDemografi.map((s) => (
                <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.warna}`}>
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <div className="text-2xl font-bold font-serif">{s.nilai}</div>
                  <div className="text-xs font-semibold mt-1 opacity-80">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Struktur Pemerintahan */}
            <div className="bg-gradient-to-br from-[#1a3a5c]/5 to-[#1a3a5c]/10 rounded-2xl border border-[#1a3a5c]/20 p-6 sm:p-8">
              <h3 className="font-serif text-lg font-bold text-[#1a3a5c] mb-6 text-center">Struktur Pemerintahan Kelurahan</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {struktur.map((s) => (
                  <div key={s.jabatan} className="bg-white rounded-xl border border-[#1a3a5c]/15 p-4 text-center shadow-xs hover:shadow-md transition-shadow">
                    <div className="text-3xl mb-2">{s.icon}</div>
                    <div className="text-[#c8a84b] text-xs font-bold uppercase tracking-wide mb-1">{s.jabatan}</div>
                    <div className="font-bold text-slate-900 text-sm leading-tight">{s.nama}</div>
                    <div className="text-slate-400 text-[11px] mt-1">{s.nip}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            BERITA & PENGUMUMAN
        ═══════════════════════════════════════════════ */}
        <section id="sec-berita" className="py-12 sm:py-16 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <div className="inline-block bg-blue-100 text-blue-800 font-bold text-xs px-3 py-1 rounded-full mb-2">INFORMASI TERKINI</div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">Berita & Pengumuman</h2>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-5">
              {berita.slice(0, 6).map((b, i) => (
                <article key={b.id || i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group flex flex-col justify-between">
                  <div>
                    <div className="h-32 bg-gradient-to-br from-[#1a3a5c]/80 to-[#0f2340] flex items-center justify-center relative">
                      <span className="text-5xl opacity-30">🏛️</span>
                      <span className={`absolute top-3 left-3 text-[11px] font-bold px-2 py-0.5 rounded-full ${b.warna}`}>
                        {b.kategori}
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="text-xs text-slate-400 mb-1.5">{b.tgl}</div>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight mb-2 group-hover:text-[#1a3a5c] transition-colors">{b.judul}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{b.isi}</p>
                    </div>
                  </div>
                  <div className="px-5 pb-4 pt-1">
                    <Link to="/app/berita" className="text-xs font-bold text-[#1a3a5c] hover:underline inline-flex items-center gap-1">
                      Baca selengkapnya →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            GALERI KEGIATAN WARGA & KELURAHAN
        ═══════════════════════════════════════════════ */}
        <section id="sec-galeri" className="py-12 sm:py-16 bg-white border-t border-slate-200">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center mb-10">
              <div className="inline-block bg-purple-100 text-purple-800 font-bold text-xs px-3 py-1 rounded-full mb-3">DOKUMENTASI KEGIATAN</div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">Galeri Kegiatan Warga</h2>
              <p className="mt-2 text-slate-500 text-sm max-w-lg mx-auto">Potret kebersamaan gotong royong, musyawarah pembangunan, dan pelayanan masyarakat {namaDesa}.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(galeriData && galeriData.length > 0 ? galeriData : [
                { id: 1, judul: 'Gotong Royong Kebersihan Lingkungan', deskripsi: 'Warga bersama aparatur kelurahan membersihkan drainase lingkungan', tanggal: '2026-11-12' },
                { id: 2, judul: 'Penyaluran Bantuan Sembako Warga', deskripsi: 'Pemberian bantuan pangan bagi keluarga prasejahtera di Aula Kelurahan', tanggal: '2026-11-08' },
                { id: 3, judul: 'Musrenbang Kelurahan', deskripsi: 'Penyusunan usulan program kerja tahun depan bersama tokoh masyarakat', tanggal: '2026-10-25' },
                { id: 4, judul: 'Pelatihan Usaha Mikro & Legalitas SKU', deskripsi: 'Bimbingan pembuatan NIB dan SKU untuk pelaku UMKM lokal', tanggal: '2026-10-18' },
              ]).map((g, i) => (
                <div key={g.id || i} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-all group">
                  <div className="h-40 bg-gradient-to-br from-[#1a3a5c] to-slate-800 flex items-center justify-center relative overflow-hidden">
                    {g.url_foto ? (
                      <img src={g.url_foto} alt={g.judul} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <span className="text-4xl opacity-40">📸</span>
                    )}
                    <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-mono">
                      {g.tanggal || 'Dokumentasi'}
                    </span>
                  </div>
                  <div className="p-4">
                    <h4 className="font-bold text-slate-900 text-xs line-clamp-1 mb-1">{g.judul}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{g.deskripsi}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            DIREKTORI UMKM LOKAL
        ═══════════════════════════════════════════════ */}
        <section id="sec-umkm" className="py-12 sm:py-16 bg-white border-t border-slate-200">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center mb-10">
              <div className="inline-block bg-amber-100 text-amber-800 font-bold text-xs px-3 py-1 rounded-full mb-3">POTENSI LOKAL</div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">Direktori UMKM {namaDesa}</h2>
              <p className="mt-2 text-slate-500 text-sm max-w-lg mx-auto">Dukung usaha mikro dan kecil warga kelurahan. Butuh Surat Keterangan Usaha? Ajukan secara online.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {umkm.map((u, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-amber-300 hover:shadow-md transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-xl flex-shrink-0">🏪</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">{u.nama}</div>
                      <span className="inline-block text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded mt-1">{u.jenis}</span>
                      <div className="text-xs text-slate-500 mt-1.5">📍 {u.alamat}</div>
                      <a href={`tel:${u.telepon}`} className="text-xs text-[#1a3a5c] font-semibold hover:underline">📞 {u.telepon}</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
              <div className="text-amber-800 font-bold text-sm mb-1">Daftarkan UMKM Anda</div>
              <p className="text-amber-700 text-xs mb-3">Pemilik usaha di wilayah {namaDesa} dapat mendaftarkan UMKM dengan mengurus Surat Keterangan Usaha terlebih dahulu.</p>
              <Link to="/register" className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-5 rounded-lg transition-colors">
                Ajukan SKU Online →
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            TRANSPARANSI ANGGARAN KELURAHAN
        ═══════════════════════════════════════════════ */}
        <section id="sec-anggaran" className="py-12 sm:py-16 bg-slate-50 border-t border-slate-200">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <div className="inline-block bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full mb-2">AKUNTABILITAS PUBLIK</div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">Transparansi Anggaran</h2>
                <p className="mt-1 text-slate-500 text-xs sm:text-sm">Ringkasan alokasi dan realisasi program pembangunan di lingkungan {namaDesa}.</p>
              </div>
              <Link to="/anggaran" className="btn btn-p text-xs font-bold py-2.5 px-4 rounded-xl inline-flex items-center gap-1.5 shadow-sm self-start sm:self-auto">
                <span>💰</span>
                <span>Lihat Rincian Anggaran Lengkap →</span>
              </Link>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tahun Anggaran</div>
                <div className="text-2xl font-bold font-serif text-[#1a3a5c] mt-1">2026</div>
                <div className="text-xs text-slate-400 mt-1">APBD Kota & Dana Kelurahan</div>
              </div>
              <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-xs bg-emerald-50/30">
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Total Pagu Program</div>
                <div className="text-2xl font-bold font-serif text-emerald-800 mt-1">Rp 920.000.000</div>
                <div className="text-xs text-emerald-600 mt-1">5 Program Kegiatan Terlaksana</div>
              </div>
              <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-xs bg-blue-50/30">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Realisasi Anggaran</div>
                <div className="text-2xl font-bold font-serif text-blue-800 mt-1">92,5%</div>
                <div className="text-xs text-blue-600 mt-1">Audit Bersih & Akuntabel</div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            KONTAK & JAM OPERASIONAL & PETA LOKASI
        ═══════════════════════════════════════════════ */}
        <section id="sec-kontak" className="py-12 sm:py-16 bg-gradient-to-br from-[#1a3a5c] to-[#0f2340] text-white">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center mb-10">
              <div className="inline-block bg-white/10 text-white/80 font-bold text-xs px-3 py-1 rounded-full mb-3 border border-white/20">INFORMASI KANTOR</div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold">Hubungi & Kunjungi Kami</h2>
              <p className="mt-2 text-white/60 text-sm max-w-lg mx-auto">Kantor kami terbuka untuk melayani warga dengan ramah, santun, dan profesional pada hari kerja.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-2xl mb-3">🕐</div>
                <h3 className="font-bold text-[#c8a84b] mb-3 text-sm">Jam Operasional</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/70">Senin – Kamis</span>
                    <span className="font-bold">08.00 – 15.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Jumat</span>
                    <span className="font-bold">08.00 – 14.30</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Sabtu – Minggu</span>
                    <span className="font-bold text-red-400">Tutup</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/20 text-xs text-white/60">
                    Layanan online tersedia 24 jam setiap hari
                  </div>
                </div>
              </div>

              <div className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-2xl mb-3">📍</div>
                <h3 className="font-bold text-[#c8a84b] mb-3 text-sm">Alamat Kantor</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-white/70 text-xs mb-1">Kantor Kelurahan</div>
                    <div className="font-semibold leading-relaxed">{alamat}<br />{pemkab}</div>
                  </div>
                  <div>
                    <div className="text-white/70 text-xs mb-1">Kode Pos</div>
                    <div className="font-semibold">{desa?.kode_pos || '20146'}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-2xl mb-3">📞</div>
                <h3 className="font-bold text-[#c8a84b] mb-3 text-sm">Kontak & Media Resmi</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-white/70 text-xs mb-1">Telepon Kantor</div>
                    <a href={`tel:${telepon}`} className="font-bold hover:text-[#c8a84b] transition-colors">{telepon}</a>
                  </div>
                  <div>
                    <div className="text-white/70 text-xs mb-1">Email Resmi</div>
                    <a href={`mailto:${email}`} className="font-bold hover:text-[#c8a84b] transition-colors text-xs">{email}</a>
                  </div>
                  <div>
                    <div className="text-white/70 text-xs mb-1">Instagram Resmi</div>
                    <a href="https://www.instagram.com/kelurahansukamaju.medanjohor/" target="_blank" rel="noopener noreferrer" className="font-bold hover:text-[#c8a84b] transition-colors text-xs text-pink-300">
                      @kelurahansukamaju.medanjohor
                    </a>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <div className="text-white/70 text-xs mb-2">Layanan Pengaduan Warga</div>
                    <a href={`tel:${telepon}`} className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-colors">
                      <span>🚨</span>
                      <span>Hubungi Sekarang</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Peta Lokasi Kantor */}
            <div className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-[#c8a84b] text-sm">🗺️ Peta Lokasi Kantor Kelurahan Suka Maju</h3>
                  <p className="text-xs text-white/70">Jl. STM No. 40, Kelurahan Suka Maju, Kecamatan Medan Johor, Kota Medan 20146</p>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Kantor Kelurahan Suka Maju Jl. STM No. 40 Medan Johor')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn bg-[#c8a84b] hover:bg-[#b8983b] text-[#1a3a5c] text-xs font-bold py-1.5 px-3 rounded-lg self-start sm:self-auto inline-flex items-center gap-1"
                >
                  <span>Buka di Google Maps ↗</span>
                </a>
              </div>
              <div className="w-full h-64 rounded-xl overflow-hidden border border-white/20 shadow-inner bg-slate-800">
                <iframe
                  title="Peta Kantor Kelurahan Suka Maju Medan Johor"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=98.67%2C3.52%2C98.71%2C3.56&amp;layer=mapnik&amp;marker=3.5414%2C98.6923"
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═══════════════════════════════════════════════
          FOOTER RESMI
      ═══════════════════════════════════════════════ */}
      <footer className="bg-[#0a1a2e] text-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid sm:grid-cols-3 gap-8 pb-8 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#1a3a5c] border border-[#c8a84b]/30 flex items-center justify-center text-sm">🏛</div>
                <div>
                  <div className="font-bold text-sm">{namaDesa}</div>
                  <div className="text-white/50 text-xs">{pemkab}</div>
                </div>
              </div>
              <p className="text-white/50 text-xs leading-relaxed">
                Portal resmi layanan administrasi kependudukan digital. 
                Melayani warga dengan cepat, transparan, dan berkekuatan hukum.
              </p>
            </div>

            <div>
              <div className="font-bold text-[#c8a84b] text-sm mb-3">Layanan Utama</div>
              <ul className="space-y-1.5 text-xs text-white/60">
                {LAYANAN_LIST.slice(0, 5).map((l) => (
                  <li key={l.kode}>
                    <Link to="/register" className="hover:text-white transition-colors">→ {l.nama}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="font-bold text-[#c8a84b] text-sm mb-3">Tautan Penting</div>
              <ul className="space-y-1.5 text-xs text-white/60">
                <li><Link to="/login" className="hover:text-white transition-colors">→ Masuk ke Portal Warga</Link></li>
                <li><Link to="/register" className="hover:text-white transition-colors">→ Daftar Akun Baru</Link></li>
                <li><Link to="/cek-status" className="hover:text-white transition-colors">→ Cek Status Permohonan</Link></li>
                <li><Link to="/anggaran" className="hover:text-white transition-colors">→ Transparansi Anggaran</Link></li>
                <li><a href="#sec-layanan" className="hover:text-white transition-colors" onClick={(e) => { e.preventDefault(); scrollTo('layanan'); }}>→ Jenis Layanan Surat</a></li>
                <li><a href="#sec-kontak" className="hover:text-white transition-colors" onClick={(e) => { e.preventDefault(); scrollTo('kontak'); }}>→ Kontak & Jam Layanan</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
            <span>© {new Date().getFullYear()} SIPESUR – {namaDesa} • {pemkab}</span>
            <span>Sistem Pelayanan Surat Resmi Digital</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Center({ title, subtitle, children, maxWidth = 'max-w-md' }) {
  const [desa] = useGet('/profil-desa');
  const namaDesa = desa?.nama_desa || 'Kelurahan Suka Maju';

  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-100 p-4 py-8 sm:items-center">
      <div className={`w-full ${maxWidth}`}>
        <div className="border border-slate-300 bg-white rounded-xl shadow-xs overflow-hidden">
          <div className="border-b-[6px] border-double border-brand-800 px-5 py-4 sm:px-6">
            <Link to="/" className="inline-flex items-center gap-2">
              {desa?.logo_url ? (
                <img src={desa.logo_url} alt="Logo" className="w-7 h-7 object-contain rounded-xs" />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-brand-700 text-white font-serif font-bold text-sm flex items-center justify-center shadow-xs">
                  S
                </div>
              )}
              <div>
                <div className="font-serif text-xl font-bold leading-none text-brand-900">SIPESUR</div>
                <div className="mt-1 text-xs text-slate-600">{namaDesa}</div>
              </div>
            </Link>
          </div>
          <div className="p-5 sm:p-6">
            <h1 className="font-serif text-2xl font-bold text-slate-950">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{subtitle}</p>}
            <div className="mt-5">{children}</div>
          </div>
        </div>
        <p className="mt-4 text-center text-sm">
          <Link to="/" className="font-bold text-brand-700 underline underline-offset-2 hover:text-brand-900">
            Kembali ke beranda
          </Link>
        </p>
      </div>
    </div>
  );
}

function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ identifier: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [m, setM] = useState();

  const go = async (e) => {
    e.preventDefault();
    setLoading(true);
    setM(null);
    try {
      const { data } = await api.post('/auth/login', f);
      login(data.token, data.user);
      nav('/app');
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoading(false);
    }
  };

  const quick = [
    ['Warga', '3201010101900001', 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'],
    ['Petugas', 'petugas', 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'],
    ['Lurah', 'lurah', 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'],
    ['IT Admin', 'admin', 'bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100'],
  ];

  return (
    <Center
      title="Masuk"
      subtitle="Warga masuk dengan NIK atau email. Petugas, lurah, dan IT Admin dengan NIP atau username."
    >
      <form onSubmit={go}>
        <Field l="NIK, NIP, username, atau email" req>
          <input
            className="inp"
            placeholder="Contoh: 3201010101900001 atau petugas"
            required
            autoFocus
            autoComplete="username"
            value={f.identifier}
            onChange={(e) => setF({ ...f, identifier: e.target.value })}
          />
        </Field>
        <Field l="Password" req>
          <div className="relative">
            <input
              className="inp pr-24"
              type={showPw ? 'text' : 'password'}
              placeholder="Masukkan password"
              required
              autoComplete="current-password"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
            />
            <button
              type="button"
              aria-pressed={showPw}
              className="absolute inset-y-0 right-0 px-3 text-sm font-bold text-brand-700 hover:text-brand-900"
              onClick={() => setShowPw(!showPw)}
            >
              {showPw ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
        </Field>

        <Msg m={m} />

        <button className="btn btn-p w-full" disabled={loading}>
          {loading ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <div className="font-bold text-slate-900 mb-2">Akun uji coba (klik untuk isi otomatis · password: <code className="font-bold">Password123</code>)</div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {quick.map(([label, id, cls]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setF({ identifier: id, password: 'Password123' });
                setM(null);
              }}
              className={`rounded border px-2 py-1.5 text-center font-bold transition-colors ${cls}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-slate-700">
        Belum punya akun warga?{' '}
        <Link className="font-bold text-brand-700 underline underline-offset-2 hover:text-brand-900" to="/register">
          Daftar
        </Link>
      </p>
    </Center>
  );
}

/**
 * HALAMAN PENDAFTARAN WARGA LENGKAP
 * Desain modern, profesional, inline validation, password strength meter, show/hide toggle.
 */
function Register() {
  const nav = useNavigate();
  const [f, setF] = useState({
    nik: '',
    no_kk: '',
    nama: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    jenis_kelamin: '',
    alamat: '',
    pekerjaan: '',
    telepon: '',
    email: '',
    password: '',
    konfirmasi_password: '',
    setuju_syarat: false,
  });

  const [showPw, setShowPw] = useState(false);
  const [showKpw, setShowKpw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [m, setM] = useState();
  const [successData, setSuccessData] = useState(null);

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF({ ...f, [k]: val });
  };

  // Validasi Inline
  const nikValid = /^\d{16}$/.test(f.nik);
  const kkValid = /^\d{16}$/.test(f.no_kk);
  const pwStrength = getPasswordStrength(f.password);
  const pwValid = f.password.length >= 8 && /[A-Za-z]/.test(f.password) && /\d/.test(f.password);
  const kpwMatch = f.konfirmasi_password && f.konfirmasi_password === f.password;
  const telpValid = f.telepon.length >= 9;

  const go = async (e) => {
    e.preventDefault();
    setM(null);

    if (!nikValid) return setM({ t: 'NIK harus tepat 16 digit angka.' });
    if (!kkValid) return setM({ t: 'Nomor Kartu Keluarga (KK) harus tepat 16 digit angka.' });
    if (!pwValid) return setM({ t: 'Password minimal 8 karakter dan harus mengombinasikan huruf serta angka.' });
    if (!kpwMatch) return setM({ t: 'Konfirmasi password tidak sesuai dengan password.' });
    if (!f.setuju_syarat) return setM({ t: 'Anda wajib mencentang persetujuan syarat dan ketentuan.' });

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', f);
      setSuccessData(data);
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <Center title="Pendaftaran Berhasil" subtitle="Akun Anda telah tersimpan di sistem SIPESUR" maxWidth="max-w-lg">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 text-sm text-emerald-950">
          <div className="flex items-center gap-2 font-bold text-emerald-800 text-base">
            Pendaftaran berhasil
          </div>
          <p className="mt-2 text-slate-700 leading-relaxed">
            Akun Anda dengan NIK <b>{successData.nik_masked}</b> atas nama <b>{f.nama}</b> telah berhasil didaftarkan.
          </p>
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
            <b>⏳ Status: Menunggu Verifikasi Petugas</b>
            <p className="mt-1">
              Sesuai SOP pelayanan publik, data kependudukan Anda akan diperiksa secara manual oleh petugas Kelurahan Suka Maju untuk mencocokkan data NIK dan Kartu Keluarga sebelum Anda dapat mengajukan permohonan surat resmi.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button className="btn btn-p w-full py-2.5 font-bold shadow" onClick={() => nav('/login')}>
            Lanjut ke Halaman Login →
          </button>
          <Link to="/" className="text-center text-xs text-slate-500 hover:text-navy">
            Kembali ke Beranda
          </Link>
        </div>
      </Center>
    );
  }

  return (
    <Center
      title="Pendaftaran Akun Warga"
      subtitle="Silakan isi data kependudukan Anda dengan benar. Data akan diverifikasi oleh petugas kelurahan sebelum layanan surat dapat diakses."
      maxWidth="max-w-2xl"
    >
      <form onSubmit={go} className="space-y-4">
        {/* BAGIAN 1: IDENTITAS KEPENDUDUKAN RESMI */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/20 p-4">
          <h2 className="mb-3 text-xs font-bold text-brand-700">
            1. Identitas Kependudukan Resmi
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              l="Nomor Induk Kependudukan (NIK)"
              req
              hint={f.nik && (nikValid ? '✓ 16 digit valid' : 'Harus tepat 16 digit angka')}
              err={f.nik && !nikValid && !/^\d*$/.test(f.nik) ? 'Hanya boleh berisi angka' : null}
            >
              <input
                className={'inp ' + (f.nik ? (nikValid ? 'border-emerald-500' : 'border-red-400') : '')}
                required
                maxLength={16}
                pattern="\d{16}"
                placeholder="Contoh: 3201010101900001"
                value={f.nik}
                onChange={set('nik')}
              />
            </Field>

            <Field
              l="Nomor Kartu Keluarga (KK)"
              req
              hint={f.no_kk && (kkValid ? '✓ 16 digit valid' : 'Harus tepat 16 digit angka')}
              err={f.no_kk && !kkValid && !/^\d*$/.test(f.no_kk) ? 'Hanya boleh berisi angka' : null}
            >
              <input
                className={'inp ' + (f.no_kk ? (kkValid ? 'border-emerald-500' : 'border-red-400') : '')}
                required
                maxLength={16}
                pattern="\d{16}"
                placeholder="Contoh: 3201010101900002"
                value={f.no_kk}
                onChange={set('no_kk')}
              />
            </Field>
          </div>

          <Field l="Nama Lengkap (Sesuai KTP/KK)" req>
            <input
              className="inp"
              required
              minLength={3}
              placeholder="Contoh: Budi Santoso"
              value={f.nama}
              onChange={set('nama')}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field l="Tempat Lahir" req>
              <input
                className="inp"
                required
                placeholder="Contoh: Medan"
                value={f.tempat_lahir}
                onChange={set('tempat_lahir')}
              />
            </Field>
            <Field l="Tanggal Lahir" req>
              <input
                className="inp"
                type="date"
                required
                value={f.tanggal_lahir}
                onChange={set('tanggal_lahir')}
              />
            </Field>
            <Field l="Jenis Kelamin" req>
              <select className="inp" required value={f.jenis_kelamin} onChange={set('jenis_kelamin')}>
                <option value="">Pilih</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </Field>
          </div>
        </div>

        {/* BAGIAN 2: ALAMAT & KONTAK */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/20 p-4">
          <h2 className="mb-3 text-xs font-bold text-brand-700">
            2. Alamat & Kontak Aktif
          </h2>
          <Field l="Alamat Lengkap (Jalan, RT/RW, Kelurahan)" req>
            <textarea
              className="inp"
              rows={2}
              required
              minLength={5}
              placeholder="Contoh: Jl. STM No. 15 RT 02/RW 03, Kelurahan Suka Maju"
              value={f.alamat}
              onChange={set('alamat')}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field l="Pekerjaan">
              <input
                className="inp"
                placeholder="Contoh: Karyawan Swasta"
                value={f.pekerjaan}
                onChange={set('pekerjaan')}
              />
            </Field>
            <Field l="Nomor HP / WhatsApp" req hint={f.telepon && (telpValid ? '✓ Nomor aktif' : 'Minimal 9 digit')}>
              <input
                className="inp"
                type="tel"
                required
                placeholder="Contoh: 081234567890"
                value={f.telepon}
                onChange={set('telepon')}
              />
            </Field>
            <Field l="Email (Opsional)" hint="Untuk notifikasi status">
              <input
                className="inp"
                type="email"
                placeholder="warga@email.com"
                value={f.email}
                onChange={set('email')}
              />
            </Field>
          </div>
        </div>

        {/* BAGIAN 3: KEAMANAN AKUN */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/20 p-4">
          <h2 className="mb-3 text-xs font-bold text-brand-700">
            3. Keamanan Akun
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field l="Password" req>
              <div className="relative">
                <input
                  className={'inp pr-24 ' + (f.password ? (pwValid ? 'border-emerald-500' : 'border-amber-400') : '')}
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  placeholder="Min. 8 karakter (huruf & angka)"
                  value={f.password}
                  onChange={set('password')}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-brand-600"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {f.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Kekuatan Password:</span>
                    <span className={'font-bold ' + pwStrength.text}>{pwStrength.label}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={'h-full transition-all duration-300 ' + pwStrength.color}
                      style={{ width: pwStrength.width }}
                    />
                  </div>
                </div>
              )}
            </Field>

            <Field
              l="Konfirmasi Password"
              req
              hint={f.konfirmasi_password && (kpwMatch ? '✓ Password cocok' : 'Password belum cocok')}
            >
              <div className="relative">
                <input
                  className={'inp pr-24 ' + (f.konfirmasi_password ? (kpwMatch ? 'border-emerald-500' : 'border-red-400') : '')}
                  type={showKpw ? 'text' : 'password'}
                  required
                  placeholder="Ulangi password di samping"
                  value={f.konfirmasi_password}
                  onChange={set('konfirmasi_password')}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-brand-600"
                  onClick={() => setShowKpw(!showKpw)}
                >
                  {showKpw ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
            </Field>
          </div>
        </div>

        {/* PERSETUJUAN SYARAT & KETENTUAN */}
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 cursor-pointer hover:bg-slate-50">
          <input
            type="checkbox"
            required
            checked={f.setuju_syarat}
            onChange={set('setuju_syarat')}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
          />
          <span className="leading-relaxed">
            Saya menyatakan dengan sungguh-sungguh bahwa seluruh data identitas (NIK, Kartu Keluarga, dan data diri) yang saya masukkan adalah benar, sah, dan sesuai dengan dokumen kependudukan asli. Saya memahami bahwa data akan diverifikasi oleh petugas kelurahan sebelum akun diaktifkan.
          </span>
        </label>

        <Msg m={m} />

        <button
          className="btn btn-p w-full py-3 font-bold text-base disabled:opacity-50"
          disabled={loading || !f.setuju_syarat}
        >
          {loading ? 'Memproses Pendaftaran…' : 'Daftarkan Akun Warga'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Sudah memiliki akun?{' '}
        <Link className="font-bold text-brand-600 hover:text-brand-800 underline" to="/login">
          Masuk di sini
        </Link>
      </p>
    </Center>
  );
}

function Verifikasi() {
  const { kode } = useParams();
  const [r, setR] = useState();

  useEffect(() => {
    api
      .get('/verifikasi/' + kode)
      .then((x) => setR(x.data))
      .catch(() => setR({ valid: false }));
  }, [kode]);

  return (
    <Center title="Keaslian surat" subtitle="Pemeriksaan keaslian surat resmi kelurahan">
      {!r ? (
        <p className="py-4 text-sm text-slate-600">Memeriksa surat…</p>
      ) : r.valid ? (
        <div className="border-l-4 border-brand-700 bg-brand-50 p-4 text-sm text-brand-900">
          <p className="text-base font-bold">Surat ini asli dan terdaftar</p>
          <dl className="mt-3 space-y-1.5">
            <div><dt className="inline text-slate-600">Nomor surat: </dt><dd className="inline font-bold">{r.nomor}</dd></div>
            <div><dt className="inline text-slate-600">Jenis surat: </dt><dd className="inline font-bold">{r.jenis}</dd></div>
            <div><dt className="inline text-slate-600">Nama pemohon: </dt><dd className="inline font-bold">{r.pemohon}</dd></div>
            <div><dt className="inline text-slate-600">Tanggal terbit: </dt><dd className="inline font-bold">{tg(r.terbit_at)}</dd></div>
          </dl>
        </div>
      ) : (
        <div className="border-l-4 border-rose-700 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="text-base font-bold">Surat tidak ditemukan</p>
          <p className="mt-1">
            Kode pada QR ini tidak terdaftar di SIPESUR. Jika surat diterima dari orang lain, hubungi loket kelurahan.
          </p>
        </div>
      )}
    </Center>
  );
}

/* ====================================================================
   LAYOUT UTAMA APLIKASI
   ==================================================================== */

function Layout() {
  const { user, logout, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [n] = useGet('/notifikasi');
  const [desa] = useGet('/profil-desa');
  const [modalGantiPw, setModalGantiPw] = useState(false);

  const mustChangePw = user?.must_change_password;
  const isPendingWarga = user?.role === 'warga' && user?.status_verifikasi === 'menunggu_verifikasi';
  const unread = (n || []).filter((x) => !x.dibaca).length;
  const items = [...(MENU[user?.role] || []), ['/app/notifikasi', 'Notifikasi', '🔔']];
  const namaDesaNav = desa?.nama_desa || 'Pelayanan Kelurahan';
  const theme = ROLE_THEME[user?.role] || ROLE_THEME.warga;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-100 md:flex-row">
      <header className={`z-30 flex flex-shrink-0 items-center justify-between border-b-[6px] border-double ${theme.border} bg-white px-4 py-2.5 md:hidden`}>
        <div className="flex items-center gap-2 min-w-0">
          {desa?.logo_url ? (
            <img src={desa.logo_url} alt="Logo" className="w-7 h-7 object-contain rounded-xs shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-brand-700 text-white font-serif font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
              S
            </div>
          )}
          <div className="min-w-0">
            <div className={`font-serif text-lg font-bold leading-none ${theme.brandText}`}>SIPESUR</div>
            <div className="mt-0.5 text-xs text-slate-600 truncate max-w-[170px]">{namaDesaNav}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unread > 0 && (
            <Link to="/app/notifikasi" className="badge border-cap bg-white text-cap">
              {unread} baru
            </Link>
          )}
          <button
            type="button"
            className="btn btn-o px-3 py-1.5"
            aria-expanded={open}
            aria-controls="menu-utama"
            onClick={() => setOpen(!open)}
          >
            {open ? 'Tutup' : 'Menu'}
          </button>
        </div>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-slate-950/50 md:hidden" onClick={() => setOpen(false)} />}

      <aside
        id="menu-utama"
        className={
          'fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-72 flex-col overflow-hidden border-r border-slate-300 bg-white transition-transform duration-150 md:static md:h-screen md:w-64 md:flex-shrink-0 md:translate-x-0 ' +
          (open ? 'translate-x-0' : '-translate-x-full md:translate-x-0')
        }
      >
        <div className={`flex-shrink-0 border-b-[6px] border-double ${theme.border} px-4 py-4`}>
          <div className="flex items-center gap-2.5">
            {desa?.logo_url ? (
              <img src={desa.logo_url} alt="Logo" className="w-8 h-8 object-contain rounded-xs shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-brand-700 text-white font-serif font-bold text-base flex items-center justify-center shadow-xs shrink-0">
                S
              </div>
            )}
            <div className="min-w-0">
              <div className={`font-serif text-xl font-bold leading-none tracking-tight ${theme.brandText}`}>SIPESUR</div>
              <div className="mt-1 text-xs text-slate-600 truncate font-medium">{namaDesaNav}</div>
            </div>
          </div>
        </div>

        <div className={`flex-shrink-0 border-b border-slate-200 px-4 py-3 text-sm ${theme.profileBox}`}>
          <div className="truncate font-bold text-slate-950">{user?.nama}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-600">
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border ${theme.pill}`}>
              {ROLE_LABEL[user?.role] || user?.role}
            </span>
            {user?.role === 'warga' && <BadgeWarga s={user?.status_verifikasi} />}
          </div>
          {user?.nik_masked && <div className="mt-1 text-xs tabular-nums text-slate-600">NIK {user.nik_masked}</div>}
          {user?.nip && <div className="mt-1 text-[11px] tabular-nums text-slate-500">NIP. {user.nip}</div>}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto py-2" onClick={() => setOpen(false)} aria-label="Menu utama">
          {items.map(([to, l, icon = '•']) => {
            const isLocked = isPendingWarga && WARGA_LOCKED_PATHS.includes(to);
            return (
              <div key={to}>
                {to === '/app/pengguna' && <div className="mx-4 my-2 border-t border-slate-200" />}
                <NavLink
                  to={to}
                  end={to === '/app'}
                  className={({ isActive }) =>
                    'flex items-center justify-between gap-2 border-l-4 py-2 pl-3 pr-4 text-sm transition-colors ' +
                    (isActive
                      ? theme.navActive
                      : isLocked
                      ? 'border-transparent text-slate-400 hover:bg-slate-50'
                      : 'border-transparent text-slate-800 hover:bg-slate-100')
                  }
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm shrink-0">{icon}</span>
                    <span className="truncate">{l}</span>
                  </span>
                  {isLocked && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold shrink-0" title="Terkunci hingga akun diverifikasi">
                      🔒
                    </span>
                  )}
                  {to === '/app/notifikasi' && unread > 0 && (
                    <span className="badge border-cap bg-white text-cap shrink-0">{unread}</span>
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>

        <div className="pb-safe flex-shrink-0 border-t border-slate-200 px-2 py-2">
          <button
            type="button"
            className="w-full rounded px-2 py-2 text-left text-sm font-bold text-slate-800 hover:bg-slate-100"
            onClick={() => {
              setModalGantiPw(true);
              setOpen(false);
            }}
          >
            Ganti password
          </button>
          <button
            type="button"
            className="w-full rounded px-2 py-2 text-left text-sm font-bold text-rose-800 hover:bg-rose-50"
            onClick={logout}
          >
            Keluar
          </button>
        </div>
      </aside>

      <main className={`min-h-0 w-full min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${theme.mainBg}`}>
        <div className="mx-auto w-full max-w-6xl space-y-5 pb-16">
          {isPendingWarga && (
            <div role="status" className="border border-amber-300 border-l-4 border-l-amber-700 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">Akun Anda sedang diverifikasi petugas</p>
              <p className="mt-1 leading-relaxed">
                Pendaftaran dengan NIK {user.nik_masked} sudah tercatat. Anda bisa mengajukan surat setelah petugas memeriksa data kependudukan Anda.
              </p>
            </div>
          )}

          {mustChangePw && (
            <div role="alert" className="flex flex-col justify-between gap-3 border border-rose-300 border-l-4 border-l-rose-700 bg-rose-50 p-4 text-sm text-rose-950 sm:flex-row sm:items-center">
              <div>
                <p className="font-bold">Password Anda masih sementara</p>
                <p className="mt-1">Ganti password sekarang agar akun kedinasan aman.</p>
              </div>
              <button className="btn btn-d flex-shrink-0" onClick={() => setModalGantiPw(true)}>
                Ganti password
              </button>
            </div>
          )}

          <Outlet />
        </div>
      </main>

      {modalGantiPw && (
        <ModalGantiPassword
          onClose={() => setModalGantiPw(false)}
          onSuccess={() => {
            updateUser({ must_change_password: false });
            setModalGantiPw(false);
          }}
        />
      )}
    </div>
  );
}

function ModalGantiPassword({ onClose, onSuccess }) {
  const [f, setF] = useState({ password_lama: '', password_baru: '', konfirmasi_password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [m, setM] = useState();

  const pwStrength = getPasswordStrength(f.password_baru);

  const go = async (e) => {
    e.preventDefault();
    setM(null);
    if (f.password_baru.length < 8) return setM({ t: 'Password baru minimal 8 karakter.' });
    if (f.password_baru !== f.konfirmasi_password) return setM({ t: 'Konfirmasi password baru tidak cocok.' });

    setLoading(true);
    try {
      await api.post('/auth/ganti-password', f);
      alert('Password berhasil diperbarui!');
      onSuccess();
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="card w-full max-w-md">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Ganti Password Akun</h2>
            <p className="text-xs text-slate-500">Perbarui kata sandi untuk keamanan akses Anda</p>
          </div>
          <button className="text-slate-400 hover:text-slate-600 p-1 rounded-lg" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={go} className="space-y-3">
          <Field l="Password Saat Ini" req>
            <input
              className="inp"
              type="password"
              required
              placeholder="••••••••"
              value={f.password_lama}
              onChange={(e) => setF({ ...f, password_lama: e.target.value })}
            />
          </Field>
          <Field l="Password Baru (Min. 8 Karakter)" req>
            <div className="relative">
              <input
                className="inp pr-24"
                type={showPw ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="••••••••"
                value={f.password_baru}
                onChange={(e) => setF({ ...f, password_baru: e.target.value })}
              />
              <button
                type="button"
                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>
            {f.password_baru && (
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Kekuatan:</span>
                <span className={'font-bold ' + pwStrength.text}>{pwStrength.label}</span>
              </div>
            )}
          </Field>
          <Field l="Konfirmasi Password Baru" req>
            <input
              className="inp"
              type="password"
              required
              placeholder="••••••••"
              value={f.konfirmasi_password}
              onChange={(e) => setF({ ...f, konfirmasi_password: e.target.value })}
            />
          </Field>

          <Msg m={m} />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" className="btn btn-o text-xs" onClick={onClose}>
              Batal
            </button>
            <button className="btn btn-p text-xs font-bold" disabled={loading}>
              {loading ? 'Menyimpan…' : 'Simpan Password Baru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const Guard = () => (useAuth().user ? <Layout /> : <Navigate to="/login" />);
const Only = ({ r, children }) => (useAuth().user && r.includes(useAuth().user.role) ? children : <Navigate to="/app" />);

const Bars = ({ t, rows, barColor = 'bg-brand-700' }) => {
  const mx = Math.max(1, ...(rows || []).map((r) => r.n || 0));
  return (
    <Card title={t}>
      {(rows || []).length ? (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.nama} className="text-xs">
              <div className="flex justify-between mb-1">
                <span className="font-medium text-slate-700">{r.nama}</span>
                <b className="tabular-nums text-slate-900">{r.n}</b>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full ${barColor} transition-all duration-300`}
                  style={{ width: `${Math.min(100, Math.round(((r.n || 0) / mx) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-4">Belum ada data tercatat</p>
      )}
    </Card>
  );
};

function BeritaWargaDashboard() {
  const [list] = useGet('/berita');
  const [baca, setBaca] = useState(null);

  if (!list) return <p className="text-sm text-slate-500 py-4 text-center">Memuat pengumuman kelurahan…</p>;
  if (list.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">Belum ada pengumuman terbaru dari kelurahan.</p>;
  }

  return (
    <div>
      {/* Modal Baca Pengumuman Lengkap */}
      {baca && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setBaca(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-lg w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <span className="badge text-xs bg-blue-50 text-blue-800 border-blue-200 font-bold">
                {baca.kategori || 'Pengumuman'}
              </span>
              <span className="text-xs text-slate-400">
                {baca.tanggal ? new Date(baca.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg leading-snug">{baca.judul}</h3>
              <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{baca.isi}</p>
            </div>
            <div className="pt-3 border-t text-right">
              <button type="button" onClick={() => setBaca(null)} className="btn btn-p text-xs py-1.5 px-4 font-bold">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {list.slice(0, 3).map((b) => (
          <div key={b.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between hover:shadow-xs transition-shadow">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {b.kategori || 'Pengumuman'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {b.tanggal ? new Date(b.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2 mb-1">{b.judul}</h4>
              <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{b.isi}</p>
            </div>
            <button
              type="button"
              onClick={() => setBaca(b)}
              className="mt-2 text-[11px] font-bold text-brand-700 hover:text-brand-900 text-left"
            >
              Baca selengkapnya →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerifikasiDiperlukanGate({ user, title = 'Layanan Pengajuan Surat Terkunci Sementara' }) {
  return (
    <Card title={title} subtitle="Status Aktivasi Akun Kependudukan Warga Kelurahan Suka Maju">
      <div className="space-y-5">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900 text-base">
            <span>🔒</span>
            <span>Akun Anda Menunggu Verifikasi Petugas Loket</span>
          </div>
          <p className="text-slate-700 leading-relaxed">
            Demi validitas data kependudukan dan keamanan dokumen resmi kelurahan, fitur <strong>pengajuan surat, pelacakan permohonan aktif, dan unduh surat terbit</strong> hanya dibuka setelah akun Anda diverifikasi oleh Petugas Pelayanan Kelurahan.
          </p>
        </div>

        {/* Stepper Verifikasi Akun 3 Langkah */}
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-start gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white font-bold flex-shrink-0">✓</span>
            <div>
              <div className="font-bold text-emerald-950">1. Pendaftaran Terkirim</div>
              <div className="text-emerald-800/90 mt-0.5">NIK {user?.nik_masked || '-'} sudah tercatat di sistem.</div>
            </div>
          </div>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-2.5 ring-1 ring-amber-300">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-600 text-white font-bold flex-shrink-0 animate-pulse">2</span>
            <div>
              <div className="font-bold text-amber-950">2. Validasi Petugas Loket</div>
              <div className="text-amber-800 mt-0.5">Petugas sedang memeriksa kecocokan data NIK &amp; No. KK Anda.</div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-start gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-slate-700 font-bold flex-shrink-0">🔒</span>
            <div>
              <div className="font-bold text-slate-700">3. Layanan Surat Aktif</div>
              <div className="text-slate-500 mt-0.5">Ajukan &amp; unduh surat resmi setelah status Terverifikasi.</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <b className="text-slate-800 block">Yang dapat Anda lakukan saat ini:</b>
            <span>Periksa kembali kesesuaian NIK, alamat, atau nomor WhatsApp Anda agar proses verifikasi petugas lebih cepat, atau baca pengumuman kelurahan terbaru.</span>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <Link to="/app/profil" className="btn btn-p text-xs py-2 px-3.5 font-bold">
              Periksa Profil Kependudukan
            </Link>
            <Link to="/app/berita" className="btn btn-o text-xs py-2 px-3.5 font-semibold">
              Berita Kelurahan
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DashboardAdminIT({ user, dateStr }) {
  const [sys] = useGet('/admin/system-status');
  if (!sys || !sys.server) return <p className="text-sm text-slate-500 py-8 text-center">Memuat konsol sistem IT…</p>;

  const byRole = sys.users?.by_role || {};
  const roleRows = [
    { nama: 'Warga Terdaftar', n: byRole.warga || 0 },
    { nama: 'Petugas Pelayanan & Tata Usaha', n: byRole.petugas || 0 },
    { nama: 'Pimpinan Kelurahan (Lurah)', n: byRole.lurah || 0 },
    { nama: 'IT Administrator Sistem', n: byRole.admin || 0 },
  ];

  const metrics = [
    {
      label: 'Total Akun Sistem',
      value: sys.users?.total || 0,
      desc: `${sys.users?.aktif || 0} aktif • ${sys.users?.nonaktif || 0} nonaktif`,
      accent: 'border-t-4 border-t-slate-800',
    },
    {
      label: 'Status Akun Warga',
      value: sys.users?.warga_verifikasi?.terverifikasi || 0,
      desc: `Terverifikasi • ${sys.users?.warga_verifikasi?.menunggu || 0} menunggu`,
      accent: 'border-t-4 border-t-emerald-600',
    },
    {
      label: 'Master Jenis Surat',
      value: sys.master?.jenis_aktif || 0,
      desc: `Aktif dari ${sys.master?.jenis_total || 0} jenis • ${sys.master?.persyaratan_total || 0} syarat`,
      accent: 'border-t-4 border-t-brand-700',
    },
    {
      label: 'Jejak Audit Log',
      value: sys.security?.total_logs || 0,
      desc: `${sys.security?.logs_today || 0} aktivitas tercatat hari ini`,
      accent: 'border-t-4 border-t-indigo-600',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Banner Pusat Kendali IT */}
      <div className="rounded-2xl border border-violet-900/40 bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 text-white p-5 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-0.5 text-[11px] font-bold text-emerald-300 mb-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>KONSOL IT ADMINISTRATOR • SISTEM ONLINE</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">{user.nama}</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              {user.jabatan || 'Pranata Komputer / IT Administrator SIPESUR'} • {dateStr}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/pengguna" className="rounded-lg bg-white text-slate-900 hover:bg-slate-100 px-3.5 py-2 text-xs font-bold transition-colors">
              + Kelola Akun &amp; Role
            </Link>
            <Link to="/app/jenis" className="rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 text-xs font-semibold transition-colors">
              Konfigurasi Template Surat
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Kartu Metrik IT */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {metrics.map((m, i) => {
          const cardTints = ['from-white to-violet-50/40', 'from-white to-emerald-50/40', 'from-white to-sky-50/40', 'from-white to-amber-50/40'];
          const pillTints = ['bg-violet-50 text-violet-700 border-violet-200', 'bg-emerald-50 text-emerald-700 border-emerald-200', 'bg-sky-50 text-sky-700 border-sky-200', 'bg-amber-50 text-amber-700 border-amber-200'];
          const icons = ['👥', '🛡️', '📋', '🔐'];
          return (
            <div key={m.label} className={`rounded-xl border border-slate-200 bg-gradient-to-br ${cardTints[i % 4]} p-4 shadow-2xs ${m.accent}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-2xl font-bold text-slate-950 tabular-nums">{m.value}</div>
                <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm shrink-0 ${pillTints[i % 4]}`}>
                  {icons[i % 4]}
                </span>
              </div>
              <div className="mt-1.5 text-sm font-bold text-slate-800">{m.label}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{m.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Panel Infrastruktur & Distribusi Role */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Kesehatan Infrastruktur & Konfigurasi Server" subtitle="Status operasional teknis layanan SIPESUR">
          <dl className="divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium">Mesin Basis Data</dt>
              <dd className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] border ${
                sys.server.is_local_mode
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {sys.server.db_mode}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium">Runtime &amp; Uptime API</dt>
              <dd className="font-mono font-semibold text-slate-800">
                Node {sys.server.node_version} • {Math.floor((sys.server.uptime_seconds || 0) / 60)}m {(sys.server.uptime_seconds || 0) % 60}s
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium">Kebijakan Unggah Berkas</dt>
              <dd className="font-bold text-emerald-700">{sys.server.upload_policy}</dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium">Identitas &amp; Logo Portal</dt>
              <dd className="font-semibold text-slate-800">
                {sys.portal?.nama_desa} ({sys.portal?.has_logo ? 'Logo Aktif ✓' : 'Belum Pasang Logo'})
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium">Segregasi Wewenang Sistem</dt>
              <dd className="font-semibold text-brand-700">IT Terpisah dari Pengesahan Surat Lurah ✓</dd>
            </div>
          </dl>
        </Card>

        <div className="space-y-4">
          <Bars t="Distribusi Akun Pengguna per Peran" rows={roleRows} barColor={ROLE_THEME.admin.bar} />
          <Card title="Akses Cepat Tugas IT Administrator">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link to="/app/pengguna" className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 p-3 font-bold text-slate-800 transition-colors">
                👥 Manajemen User &amp; NIP
              </Link>
              <Link to="/app/jenis" className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 p-3 font-bold text-slate-800 transition-colors">
                🧩 Master Form &amp; Template
              </Link>
              <Link to="/app/profil-desa" className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 p-3 font-bold text-slate-800 transition-colors">
                🌐 Pengaturan Web &amp; Kop
              </Link>
              <Link to="/app/log" className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 p-3 font-bold text-slate-800 transition-colors">
                🛡️ Audit Keamanan Sistem
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Jejak Audit Terbaru */}
      <Card
        title="Pemantauan Audit Log Keamanan Terbaru"
        subtitle="6 transaksi autentikasi dan perubahan sistem terakhir"
        rightAction={
          <Link to="/app/log" className="text-xs font-bold text-brand-700 hover:underline">
            Lihat seluruh log →
          </Link>
        }
      >
        <Table
          head={['Waktu', 'Pengguna', 'Aktivitas', 'Detail', 'IP Address']}
          rows={(sys.security?.recent_logs || []).map((x) => [
            tg(x.created_at),
            x.nama || 'Sistem / Tamu',
            <b key="a" className="text-navy text-xs">{x.aksi}</b>,
            x.detail || '-',
            x.ip || '-',
          ])}
        />
      </Card>
    </div>
  );
}

function DashboardLurah({ user, s, dateStr }) {
  const st = s.status || {};
  const antreanACC = s.antrean_pengajuan || [];
  const antreanSM = s.antrean_surat_masuk || [];
  const totalTerbit = (st.issued || 0) + (s.sk_total || 0);

  const metrics = [
    {
      label: 'Menunggu ACC & TTE Anda',
      value: st.pending_approval || 0,
      desc: 'Permohonan warga lolos verifikasi loket',
      accent: 'border-t-4 border-t-brand-700',
      to: '/app/pengajuan',
    },
    {
      label: 'Perlu Disposisi Lurah',
      value: s.sm_menunggu || 0,
      desc: 'Surat dinas masuk menunggu arahan',
      accent: 'border-t-4 border-t-amber-600',
      to: '/app/surat-masuk',
    },
    {
      label: 'Dokumen Resmi Disahkan',
      value: totalTerbit,
      desc: `${st.issued || 0} surat warga • ${s.sk_total || 0} surat dinas keluar`,
      accent: 'border-t-4 border-t-emerald-600',
      to: '/app/arsip',
    },
    {
      label: 'Serapan Anggaran Kelurahan',
      value: `${s.anggaran?.persen || 0}%`,
      desc: `Realisasi Rp ${Number(s.anggaran?.total_realisasi || 0).toLocaleString('id-ID')}`,
      accent: 'border-t-4 border-t-indigo-600',
      to: '/app/anggaran',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Banner Pimpinan Lurah */}
      <div className="rounded-2xl border border-brand-800 bg-gradient-to-br from-brand-950 via-brand-900 to-indigo-950 text-white p-5 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-1">
              MEJA PIMPINAN • KELURAHAN SUKA MAJU MEDAN JOHOR
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">{user.nama}</h1>
            <p className="mt-1 text-xs sm:text-sm text-brand-100">
              {user.jabatan || 'Lurah Suka Maju'} {user.nip ? `• NIP. ${user.nip}` : ''} • {dateStr}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {s.has_signature ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3.5 py-1.5 text-xs font-bold text-emerald-200">
                ✓ Spesimen TTE Digital Siap
              </span>
            ) : (
              <Link to="/app/profil" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-2 text-xs font-bold transition-colors">
                ⚠️ Atur Tanda Tangan Lurah
              </Link>
            )}
            <Link to="/app/surat-keluar" className="rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 text-xs font-bold transition-colors">
              + Terbitkan Surat Dinas
            </Link>
          </div>
        </div>
      </div>

      {/* 4 KPI Pimpinan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {metrics.map((m, i) => {
          const cardTints = ['from-white to-amber-50/40', 'from-white to-indigo-50/40', 'from-white to-emerald-50/40', 'from-white to-sky-50/40'];
          const pillTints = ['bg-amber-50 text-amber-700 border-amber-200', 'bg-indigo-50 text-indigo-700 border-indigo-200', 'bg-emerald-50 text-emerald-700 border-emerald-200', 'bg-sky-50 text-sky-700 border-sky-200'];
          const icons = ['✍️', '📨', '✅', '💰'];
          return (
            <Link key={m.label} to={m.to} className={`rounded-xl border border-slate-200 bg-gradient-to-br ${cardTints[i % 4]} p-4 shadow-2xs hover:border-indigo-400 transition-colors ${m.accent}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-2xl font-bold text-slate-950 tabular-nums">{m.value}</div>
                <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm shrink-0 ${pillTints[i % 4]}`}>
                  {icons[i % 4]}
                </span>
              </div>
              <div className="mt-1.5 text-sm font-bold text-slate-800">{m.label}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{m.desc}</div>
            </Link>
          );
        })}
      </div>

      {/* Meja Kerja Pimpinan (2 Kolom Antrean Keputusan Lurah) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Antrean Pengesahan Surat Warga (ACC & TTE)"
          subtitle="Permohonan warga yang telah diverifikasi lengkap oleh Petugas Loket"
          rightAction={
            <Link to="/app/pengajuan" className="text-xs font-bold text-brand-700 hover:underline">
              Semua antrean →
            </Link>
          }
        >
          {antreanACC.length ? (
            <ul className="divide-y divide-slate-100 text-xs">
              {antreanACC.map((item) => (
                <li key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-bold text-brand-800">{item.kode}</code>
                      <Badge s={item.status} />
                    </div>
                    <div className="font-bold text-slate-900 mt-1 truncate">{item.jenis}</div>
                    <div className="text-slate-500 mt-0.5">Pemohon: <b>{item.pemohon}</b> • {tg(item.created_at)}</div>
                  </div>
                  <Link
                    to={`/app/pengajuan/${item.id}`}
                    className="btn btn-p text-xs py-1.5 px-3 font-bold flex-shrink-0"
                  >
                    Periksa &amp; ACC →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="text-2xl mb-1">✅</div>
              Semua permohonan surat warga yang naik ke meja Lurah sudah diputuskan.
            </div>
          )}
        </Card>

        <Card
          title="Surat Dinas Masuk Menunggu Disposisi Lurah"
          subtitle="Tentukan tujuan seksi dan instruksi tindak lanjut untuk staf kelurahan"
          rightAction={
            <Link to="/app/surat-masuk" className="text-xs font-bold text-brand-700 hover:underline">
              Buka agenda →
            </Link>
          }
        >
          {antreanSM.length ? (
            <ul className="divide-y divide-slate-100 text-xs">
              {antreanSM.map((sm) => (
                <li key={sm.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-slate-800">{sm.nomor_surat}</div>
                    <div className="font-bold text-slate-900 mt-0.5 truncate">{sm.perihal}</div>
                    <div className="text-slate-500 mt-0.5">Dari: <b>{sm.pengirim}</b></div>
                  </div>
                  <Link
                    to="/app/surat-masuk"
                    className="btn bg-amber-600 hover:bg-amber-700 text-white text-xs py-1.5 px-3 font-bold flex-shrink-0"
                  >
                    Disposisi →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="text-2xl mb-1">📬</div>
              Tidak ada surat dinas masuk yang menunggu disposisi saat ini.
            </div>
          )}
        </Card>
      </div>

      {/* Grafik Pelayanan */}
      <div className="grid gap-4 md:grid-cols-2">
        <Bars t="Volume Layanan per Jenis Surat" rows={s.jenis || []} barColor={ROLE_THEME.lurah.bar} />
        <Bars t="Tren Pengajuan 6 Bulan Terakhir" rows={s.bulan || []} barColor={ROLE_THEME.lurah.bar} />
      </div>
    </div>
  );
}

function DashboardPetugas({ user, s, dateStr }) {
  const st = s.status || {};
  const antreanSurat = s.antrean_pengajuan || [];
  const antreanWarga = s.antrean_warga || [];
  const antreanDisposisi = s.antrean_surat_masuk || [];

  const metrics = [
    {
      label: 'Verifikasi Akun Warga',
      value: s.warga_pending || 0,
      desc: `${s.warga_terverifikasi || 0} warga sudah terverifikasi`,
      accent: 'border-t-4 border-t-amber-600',
      to: '/app/verifikasi-warga',
    },
    {
      label: 'Permohonan Baru Masuk',
      value: st.submitted || 0,
      desc: 'Menunggu mulai diperiksa loket',
      accent: 'border-t-4 border-t-brand-700',
      to: '/app/pengajuan',
    },
    {
      label: 'Sedang Diperiksa Loket',
      value: st.under_review || 0,
      desc: `${st.pending_approval || 0} sudah diteruskan ke Lurah`,
      accent: 'border-t-4 border-t-sky-600',
      to: '/app/pengajuan',
    },
    {
      label: 'Disposisi Lurah Aktif',
      value: s.sm_didisposisi || 0,
      desc: 'Instruksi Lurah siap dibuatkan balasan',
      accent: 'border-t-4 border-t-emerald-600',
      to: '/app/surat-masuk',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Banner Meja Pelayanan Petugas */}
      <div className="rounded-2xl border border-sky-800 bg-gradient-to-br from-brand-900 via-sky-900 to-slate-900 text-white p-5 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300 mb-1">
              MEJA PELAYANAN &amp; TATA USAHA • KELURAHAN SUKA MAJU
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">{user.nama}</h1>
            <p className="mt-1 text-xs sm:text-sm text-sky-100">
              {user.jabatan || 'Petugas Pelayanan Administrasi'} {user.nip ? `• NIP. ${user.nip}` : ''} • {dateStr}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/verifikasi-warga" className="rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-2 text-xs font-bold transition-colors">
              Cek Verifikasi Warga ({s.warga_pending || 0})
            </Link>
            <Link to="/app/surat-masuk" className="rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 text-xs font-bold transition-colors">
              + Catat Surat Masuk
            </Link>
          </div>
        </div>
      </div>

      {/* Strip SOP Alur Pelayanan Petugas */}
      <div className="rounded-xl border border-sky-200/80 bg-gradient-to-r from-white via-sky-50/35 to-white p-3.5 shadow-2xs">
        <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700 mb-2.5">
          Alur Operasional Standar Petugas Kelurahan
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {[
            ['1', 'Validasi Pendaftar', 'Cek NIK & No. KK warga baru', 'border-sky-200 bg-sky-50/70', 'bg-sky-600 text-white'],
            ['2', 'Periksa Berkas Surat', 'Cek KTP, KK & lampiran pemohon', 'border-indigo-200 bg-indigo-50/60', 'bg-indigo-600 text-white'],
            ['3', 'Ajukan ACC Lurah', 'Teruskan berkas lengkap ke Lurah', 'border-amber-200 bg-amber-50/60', 'bg-amber-600 text-white'],
            ['4', 'Arsip & Tindak Lanjut', 'Cetak surat terbit & balas disposisi', 'border-emerald-200 bg-emerald-50/60', 'bg-emerald-600 text-white'],
          ].map(([num, judul, sub, boxCls, numCls]) => (
            <div key={judul} className={`rounded-lg border px-3 py-2.5 ${boxCls}`}>
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${numCls}`}>{num}</span>
                <span>{judul}</span>
              </div>
              <div className="text-[11px] text-slate-600 mt-1 pl-7">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 KPI Operasional */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {metrics.map((m, i) => {
          const cardTints = ['from-white to-sky-50/40', 'from-white to-amber-50/40', 'from-white to-indigo-50/40', 'from-white to-emerald-50/40'];
          const pillTints = ['bg-sky-50 text-sky-700 border-sky-200', 'bg-amber-50 text-amber-700 border-amber-200', 'bg-indigo-50 text-indigo-700 border-indigo-200', 'bg-emerald-50 text-emerald-700 border-emerald-200'];
          const icons = ['🪪', '📥', '📤', '📄'];
          return (
            <Link key={m.label} to={m.to} className={`rounded-xl border border-slate-200 bg-gradient-to-br ${cardTints[i % 4]} p-4 shadow-2xs hover:border-sky-400 transition-colors ${m.accent}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-2xl font-bold text-slate-950 tabular-nums">{m.value}</div>
                <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm shrink-0 ${pillTints[i % 4]}`}>
                  {icons[i % 4]}
                </span>
              </div>
              <div className="mt-1.5 text-sm font-bold text-slate-800">{m.label}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{m.desc}</div>
            </Link>
          );
        })}
      </div>

      {/* 2 Panel Antrean Operasional */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Antrean Pemeriksaan Surat Warga"
          subtitle="Permohonan yang perlu segera diperiksa berkas persyaratannya"
          rightAction={
            <Link to="/app/pengajuan" className="text-xs font-bold text-brand-700 hover:underline">
              Semua pengajuan →
            </Link>
          }
        >
          {antreanSurat.length ? (
            <ul className="divide-y divide-slate-100 text-xs">
              {antreanSurat.map((item) => (
                <li key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-bold text-navy">{item.kode}</code>
                      <Badge s={item.status} />
                    </div>
                    <div className="font-bold text-slate-900 mt-1 truncate">{item.jenis}</div>
                    <div className="text-slate-500 mt-0.5">Pemohon: <b>{item.pemohon}</b> • {tg(item.created_at)}</div>
                  </div>
                  <Link
                    to={`/app/pengajuan/${item.id}`}
                    className="btn btn-p text-xs py-1.5 px-3 font-bold flex-shrink-0"
                  >
                    Periksa →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="text-2xl mb-1">📋</div>
              Tidak ada antrean pemeriksaan surat di loket saat ini.
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card
            title="Pendaftar Warga Baru Menunggu Verifikasi"
            subtitle="Validasi NIK & KK sebelum akun dapat mengajukan surat"
            rightAction={
              <Link to="/app/verifikasi-warga" className="text-xs font-bold text-brand-700 hover:underline">
                Kelola warga →
              </Link>
            }
          >
            {antreanWarga.length ? (
              <ul className="divide-y divide-slate-100 text-xs">
                {antreanWarga.map((w) => (
                  <li key={w.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{w.nama}</div>
                      <div className="text-[11px] text-slate-500">Daftar: {tg(w.created_at)}</div>
                    </div>
                    <Link to="/app/verifikasi-warga" className="btn bg-amber-600 hover:bg-amber-700 text-white text-[11px] py-1 px-2.5 font-bold flex-shrink-0">
                      Verifikasi →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">Semua pendaftar akun warga telah diverifikasi ✓</p>
            )}
          </Card>

          <Card
            title="Disposisi Lurah untuk Ditindaklanjuti"
            subtitle="Instruksi pimpinan yang menunggu pembuatan surat balasan"
            rightAction={
              <Link to="/app/surat-masuk" className="text-xs font-bold text-brand-700 hover:underline">
                Buka agenda →
              </Link>
            }
          >
            {antreanDisposisi.length ? (
              <ul className="divide-y divide-slate-100 text-xs">
                {antreanDisposisi.map((sm) => (
                  <li key={sm.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{sm.perihal}</div>
                      <div className="text-[11px] text-slate-500">No. {sm.nomor_surat} • {sm.pengirim}</div>
                    </div>
                    <Link to="/app/surat-masuk" className="btn btn-o text-[11px] py-1 px-2.5 font-bold flex-shrink-0">
                      Tindak Lanjut →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">Tidak ada disposisi aktif yang tertunda ✓</p>
            )}
          </Card>
        </div>
      </div>

      {/* Grafik Beban Pelayanan */}
      <div className="grid gap-4 md:grid-cols-2">
        <Bars t="Permohonan per Jenis Surat" rows={s.jenis || []} barColor={ROLE_THEME.petugas.bar} />
        <Bars t="Volume Pelayanan 6 Bulan Terakhir" rows={s.bulan || []} barColor={ROLE_THEME.petugas.bar} />
      </div>
    </div>
  );
}

function DashboardWarga({ user, s, dateStr }) {
  const st = s.status || {};
  const isVerified = user?.status_verifikasi === 'terverifikasi';

  const metrics = [
    { label: 'Semua pengajuan', value: (st.submitted || 0) + (st.under_review || 0) + (st.pending_approval || 0) + (st.approved || 0) + (st.issued || 0), desc: 'Seluruh berkas yang masuk', icon: '🗂️', top: 'border-t-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Sedang diproses', value: (st.submitted || 0) + (st.under_review || 0) + (st.pending_approval || 0), desc: 'Diperiksa atau menunggu lurah', icon: '⏳', top: 'border-t-sky-500', pill: 'bg-sky-50 text-sky-700 border-sky-200' },
    { label: 'Surat terbit', value: st.issued || 0, desc: 'Sudah disahkan dan bisa diunduh', icon: '📜', top: 'border-t-teal-600', pill: 'bg-teal-50 text-teal-700 border-teal-200' },
    { label: 'Perlu perbaikan', value: (st.revision_required || 0) + (st.rejected || 0), desc: 'Direvisi atau ditolak', icon: '✏️', top: 'border-t-amber-500', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-900/15 bg-gradient-to-br from-emerald-900 via-teal-800 to-brand-900 text-white p-5 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-50">
              ● Portal Warga · {dateStr}
            </span>
            <h1 className="mt-2 font-serif text-2xl font-bold text-white sm:text-3xl">
              {user.nama}
            </h1>
            <p className="mt-1 text-sm text-emerald-100/90">
              {isVerified
                ? 'Akun kependudukan terverifikasi. Ajukan surat resmi kelurahan kapan saja secara daring.'
                : 'Status aktivasi akun kependudukan dan pengumuman terbaru Kelurahan Suka Maju.'}
            </p>
          </div>
          {isVerified && (
            <Link to="/app/ajukan" className="btn bg-white text-emerald-950 hover:bg-emerald-50 border border-white/60 text-xs py-2.5 px-4 font-bold self-start sm:self-auto shadow-xs">
              + Ajukan Surat Baru
            </Link>
          )}
        </div>
      </div>

      {!isVerified ? (
        <VerifikasiDiperlukanGate user={user} title="Status Verifikasi Akun Anda" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {metrics.map((m) => (
              <div key={m.label} className={`rounded-xl border border-slate-200 border-t-4 ${m.top} bg-gradient-to-br from-white to-emerald-50/25 p-4 shadow-2xs`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-2xl font-bold text-slate-950 tabular-nums">{m.value}</div>
                  <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm shrink-0 ${m.pill}`}>
                    {m.icon}
                  </span>
                </div>
                <div className="mt-1.5 text-sm font-bold text-slate-800">{m.label}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{m.desc}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Bars t="Pengajuan per jenis surat" rows={s.jenis || []} barColor={ROLE_THEME.warga.bar} />
            <Bars t="Pengajuan 6 bulan terakhir" rows={s.bulan || []} barColor={ROLE_THEME.warga.bar} />
          </div>
        </>
      )}

      <Card
        title="Pengumuman & Berita Kelurahan Terkini"
        subtitle="Informasi penting, agenda dinas, dan pengumuman resmi kelurahan"
        rightAction={
          <Link to="/app/berita" className="text-xs font-bold text-brand-700 hover:underline">
            Lihat semua pengumuman →
          </Link>
        }
      >
        <BeritaWargaDashboard />
      </Card>

      {isVerified && (
        <Card
          title="Surat saya yang sudah terbit"
          subtitle="Siap diunduh dan dicetak"
          rightAction={
            <Link to="/app/surat" className="text-xs font-bold text-brand-700 hover:underline">
              Lihat semua surat
            </Link>
          }
        >
          <WargaSuratList />
        </Card>
      )}
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (user?.role === 'admin') {
    return <DashboardAdminIT user={user} dateStr={dateStr} />;
  }

  return <DashboardPelayananLoader user={user} dateStr={dateStr} />;
}

function DashboardPelayananLoader({ user, dateStr }) {
  const [s] = useGet('/stats');
  if (!s) return <p className="text-sm text-slate-500 py-8 text-center">Memuat ringkasan…</p>;

  if (user?.role === 'lurah') return <DashboardLurah user={user} s={s} dateStr={dateStr} />;
  if (user?.role === 'petugas') return <DashboardPetugas user={user} s={s} dateStr={dateStr} />;
  return <DashboardWarga user={user} s={s} dateStr={dateStr} />;
}
/**
 * FITUR VERIFIKASI WARGA OLEH PETUGAS & ADMIN
 */
function VerifikasiWarga() {
  const [filter, setFilter] = useState('menunggu_verifikasi');
  const [rows, load] = useGet('/verifikasi-warga?status=' + filter);
  const [selected, setSelected] = useState(null);
  const [catatan, setCatatan] = useState('');
  const [loading, setLoading] = useState(false);
  const [m, setM] = useState();

  const handleVerif = async (hasil) => {
    if (hasil === 'ditolak' && !catatan.trim()) {
      return setM({ t: 'Alasan penolakan verifikasi wajib diisi.' });
    }
    setLoading(true);
    setM(null);
    try {
      const res = await api.post(`/verifikasi-warga/${selected.id}`, { hasil, catatan });
      const namaWarga = selected.nama;
      setSelected(null);
      setCatatan('');
      setM({ t: res.data?.message || `Akun warga ${namaWarga} berhasil ${hasil === 'terverifikasi' ? 'diverifikasi' : 'ditolak'}.`, ok: true });
      load();
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Verifikasi Akun Kependudukan Warga"
        subtitle="Pemeriksaan berkas dan data NIK & No KK warga sebelum dapat mengajukan permohonan surat"
        rightAction={
          <div className="flex gap-2">
            <select
              className="inp text-xs py-1"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setM(null);
              }}
            >
              <option value="menunggu_verifikasi">⏳ Menunggu Verifikasi</option>
              <option value="terverifikasi">✓ Terverifikasi</option>
              <option value="ditolak">✕ Ditolak</option>
              <option value="all">Semua Status</option>
            </select>
          </div>
        }
      >
        <Msg m={m} />
        <Table
          head={['Nama Warga', 'NIK (Tersensor)', 'No KK (Tersensor)', 'Telepon / WA', 'Tgl Daftar', 'Status', 'Tindakan']}
          rows={(rows || []).map((r) => [
            <b key="n" className="text-navy">{r.nama}</b>,
            r.nik_masked || '-',
            r.no_kk_masked || '-',
            r.telepon || '-',
            tg(r.created_at),
            <BadgeWarga key="s" s={r.status_verifikasi} />,
            <button
              key="act"
              className="btn btn-p text-xs py-1 px-2.5 font-semibold"
              onClick={() => {
                setSelected(r);
                setCatatan(r.catatan_verifikasi || '');
                setM(null);
              }}
            >
              {r.status_verifikasi === 'menunggu_verifikasi' ? 'Periksa & Verifikasi' : 'Lihat Detail Data'}
            </button>,
          ])}
        />
      </Card>

      {/* Modal Pemeriksaan Detail Warga */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-lg shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="font-bold text-navy text-base">Pemeriksaan Identitas Kependudukan</h3>
                <p className="text-xs text-slate-400">Verifikasi data NIK & KK warga Kelurahan Suka Maju</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600 text-sm p-1" onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>

            <Msg m={m} />

            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-lg border">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block">Nama Lengkap:</span>
                  <b className="text-navy text-sm">{selected.nama}</b>
                </div>
                <div>
                  <span className="text-slate-400 block">Status Saat Ini:</span>
                  <BadgeWarga s={selected.status_verifikasi} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-400 block">NIK:</span>
                  <code className="text-xs bg-white px-2 py-0.5 rounded font-mono font-bold text-slate-800 border">{selected.nik || '-'}</code>
                </div>
                <div>
                  <span className="text-slate-400 block">No. Kartu Keluarga:</span>
                  <code className="text-xs bg-white px-2 py-0.5 rounded font-mono font-bold text-slate-800 border">{selected.no_kk || '-'}</code>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-400 block">Tempat / Tgl Lahir:</span>
                  <b>{selected.tempat_lahir || '-'}, {selected.tanggal_lahir ? String(selected.tanggal_lahir).slice(0, 10) : '-'}</b>
                </div>
                <div>
                  <span className="text-slate-400 block">Jenis Kelamin:</span>
                  <b>{selected.jenis_kelamin === 'L' ? 'Laki-laki' : selected.jenis_kelamin === 'P' ? 'Perempuan' : '-'}</b>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-400 block">Alamat KTP / Tempat Tinggal:</span>
                <b>{selected.alamat || '-'}</b>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-400 block">Pekerjaan:</span>
                  <b>{selected.pekerjaan || '-'}</b>
                </div>
                <div>
                  <span className="text-slate-400 block">No. Telepon / WA:</span>
                  <b>{selected.telepon || '-'}</b>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-400 block">Alamat Email:</span>
                <b>{selected.email || '-'}</b>
              </div>

              {selected.diverifikasi_at && (
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 bg-white p-2 rounded border">
                  Diverifikasi oleh: <b>{selected.verifikator || 'Petugas Kelurahan'}</b> • {tg(selected.diverifikasi_at)}
                  {selected.catatan_verifikasi && (
                    <div className="mt-1 text-slate-700 italic">
                      Catatan: "{selected.catatan_verifikasi}"
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Catatan Petugas (Wajib jika menolak verifikasi):
              </label>
              <textarea
                className="inp text-xs"
                rows={2}
                placeholder="Contoh: Berkas KTP dan Kartu Keluarga telah diverifikasi sesuai kependudukan."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                className="btn btn-d text-xs py-2 px-3.5 font-bold"
                disabled={loading}
                onClick={() => handleVerif('ditolak')}
              >
                ✕ Tolak Verifikasi
              </button>
              <button
                type="button"
                className="btn bg-emerald-700 text-white hover:bg-emerald-800 text-xs py-2 px-4 font-bold"
                disabled={loading}
                onClick={() => handleVerif('terverifikasi')}
              >
                {loading ? 'Menyimpan…' : '✓ Setujui & Verifikasi Akun'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Ajukan() {
  const { user } = useAuth();
  const [js] = useGet('/jenis-surat');
  const [jid, setJid] = useState('');
  const [data, setData] = useState({});
  const [files, setFiles] = useState({});
  const [m, setM] = useState();
  const nav = useNavigate();

  // Warga belum terverifikasi tidak bisa mengajukan surat
  if (user?.role === 'warga' && user?.status_verifikasi !== 'terverifikasi') {
    return <VerifikasiDiperlukanGate user={user} title="Pengajuan Surat Ditutup Sementara" />;
  }

  const j = (js || []).find((x) => String(x.id) === jid);
  const formFields = j ? (Array.isArray(j.form_fields) ? j.form_fields : JSON.parse(j.form_fields || '[]')) : [];
  const persyaratan = j?.persyaratan || [];

  const send = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('jenis_surat_id', jid);
    fd.append('data_form', JSON.stringify(data));
    Object.entries(files).forEach(([k, f]) => fd.append(k, f));
    try {
      await api.post('/pengajuan', fd);
      nav('/app/pengajuan');
    } catch (x) {
      setM({ t: em(x) });
    }
  };

  return (
    <Card title="Ajukan Permohonan Surat Resmi" subtitle="Pilih jenis surat dan lengkapi data formulir beserta berkas persyaratan">
      <form onSubmit={send}>
        <Field l="Pilih Jenis Surat" req>
          <select
            className="inp"
            value={jid}
            required
            onChange={(e) => {
              setJid(e.target.value);
              setData({});
              setFiles({});
            }}
          >
            <option value="">-- Pilih Jenis Surat Keterangan / Pengantar --</option>
            {(js || []).map((x) => (
              <option key={x.id} value={x.id}>
                [{x.kode}] {x.nama}
              </option>
            ))}
          </select>
        </Field>

        {j && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-slate-50 p-4 border">
              <h3 className="mb-3 text-xs font-bold text-navy">Formulir Keterangan Khusus</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {formFields.map((f) => (
                  <Field key={f.name} l={f.label} req>
                    <input
                      className="inp"
                      required
                      type={f.name.includes('tanggal') ? 'date' : 'text'}
                      value={data[f.name] || ''}
                      onChange={(e) => setData({ ...data, [f.name]: e.target.value })}
                    />
                  </Field>
                ))}
                {!formFields.some((f) => (f.name || '').toLowerCase().includes('keperluan')) && (
                  <Field l="Keperluan / Alasan Pengajuan Surat" req>
                    <input
                      className="inp"
                      required
                      placeholder="Contoh: Pengurusan beasiswa, administrasi bank, melamar kerja, dll."
                      value={data.keperluan || ''}
                      onChange={(e) => setData({ ...data, keperluan: e.target.value })}
                    />
                  </Field>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 border">
              <h3 className="mb-2 text-xs font-bold text-navy">
                Unggah Dokumen Persyaratan (PDF/JPG/PNG - Bebas Ukuran Berkas)
              </h3>
              <div className="space-y-2">
                {persyaratan.map((p) => (
                  <Field key={p.id} l={p.nama} req>
                    <input
                      type="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="block text-xs"
                      onChange={(e) => setFiles({ ...files, ['doc_' + p.id]: e.target.files[0] })}
                    />
                  </Field>
                ))}
              </div>
            </div>
          </div>
        )}

        <Msg m={m} />

        <div className="mt-5">
          <button className="btn btn-p py-2.5 px-6 font-bold" disabled={!j}>
            Kirim Permohonan Surat →
          </button>
        </div>
      </form>
    </Card>
  );
}

function List() {
  const { user } = useAuth();
  const [st, setSt] = useState(user?.role === 'lurah' ? 'pending_approval' : '');
  const [rows, load] = useGet('/pengajuan' + (st ? '?status=' + st : ''));

  if (user?.role === 'warga' && user?.status_verifikasi !== 'terverifikasi') {
    return <VerifikasiDiperlukanGate user={user} title="Riwayat Pengajuan Surat Terkunci" />;
  }

  const handleHapusPengajuan = async (id, kode) => {
    if (!window.confirm(`Apakah Anda yakin ingin membatalkan/menghapus pengajuan dengan kode ${kode}?`)) return;
    try {
      await api.delete(`/pengajuan/${id}`);
      load();
    } catch (err) {
      alert('Gagal menghapus pengajuan: ' + em(err));
    }
  };

  const canDelete = (r) => {
    if (['petugas', 'lurah'].includes(user?.role)) return true;
    if (user?.role === 'warga' && user?.id === r.user_id && ['submitted', 'rejected', 'revision_required'].includes(r.status)) return true;
    return false;
  };

  return (
    <Card
      title={user?.role === 'lurah' ? 'Persetujuan & Pengesahan Surat Warga (Lurah)' : user?.role === 'petugas' ? 'Pemeriksaan Berkas Permohonan Surat Warga' : 'Daftar Pengajuan Surat Keterangan'}
      subtitle={user?.role === 'lurah' ? 'Tinjau hasil verifikasi loket, susun naskah final, dan bubuhkan Tanda Tangan Digital' : 'Agenda permohonan surat keterangan kependudukan warga'}
      rightAction={
        <select className="inp text-xs py-1.5 max-w-xs font-medium" value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="">Semua Status Pelayanan</option>
          {Object.entries(ST).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      }
    >
      <Table
        head={['Kode Permohonan', 'Jenis Surat', 'Nama Pemohon', 'Tanggal Pengajuan', 'Status', 'Aksi']}
        rows={(rows || []).map((r) => [
          <code key="k" className="tabular-nums font-bold text-navy text-xs">{r.kode}</code>,
          r.jenis,
          r.pemohon,
          tg(r.created_at),
          <Badge key="b" s={r.status} />,
          <div key="act" className="flex items-center gap-1.5">
            <Link className="rounded-lg px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors" to={'/app/pengajuan/' + r.id}>
              Detail
            </Link>
            {r.status === 'issued' && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                onClick={() => downloadPdf('/pengajuan/' + r.id + '/surat', 'Surat-' + r.kode + '.pdf')}
              >
                <Icon name="download" className="w-3.5 h-3.5" />
                <span>Unduh</span>
              </button>
            )}
            {canDelete(r) && (
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                title={user?.role === 'warga' ? 'Batalkan Pengajuan' : 'Hapus Pengajuan'}
                onClick={() => handleHapusPengajuan(r.id, r.kode)}
              >
                🗑️
              </button>
            )}
          </div>,
        ])}
      />
    </Card>
  );
}

function ModalPratinjauBerkas({ dok, onClose }) {
  const [key, setKey] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const isImage = /\.(jpe?g|png|webp|gif)$/i.test(dok?.nama_file || '');
  const url = getFileUrl(`/dokumen/${dok.id}/file?v=${key}`);

  const handleRefresh = () => {
    setLoadError(false);
    setKey((k) => k + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-xs">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-900 truncate">
              {dok.nama || 'Dokumen Persyaratan'}
            </h3>
            <p className="text-xs text-slate-500 truncate">{dok.nama_file}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isImage && (
              <div className="flex items-center bg-white rounded-lg border border-slate-200 text-xs overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  className="px-2.5 py-1 hover:bg-slate-100 font-bold"
                  title="Perkecil"
                >
                  -
                </button>
                <span className="px-2 text-[11px] font-mono font-semibold">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  className="px-2.5 py-1 hover:bg-slate-100 font-bold"
                  title="Perbesar"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="px-2 py-1 hover:bg-slate-100 text-[10px] text-slate-500 border-l border-slate-100"
                  title="Reset Zoom"
                >
                  Reset
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs py-1.5 px-3 transition-colors shadow-2xs"
              title="Muat Ulang Berkas (Refresh)"
            >
              <span>🔄</span>
              <span>Muat Ulang</span>
            </button>
            <button
              type="button"
              onClick={() => viewPdf(`/dokumen/${dok.id}/file`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs py-1.5 px-3 transition-colors shadow-2xs"
              title="Buka di Tab Baru Browser"
            >
              <Icon name="eye" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tab Baru</span>
            </button>
            <button
              type="button"
              onClick={() => downloadPdf(`/dokumen/${dok.id}/file`, dok.nama_file)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white font-semibold text-xs py-1.5 px-3 transition-colors shadow-2xs"
              title="Unduh Berkas ke Perangkat"
            >
              <Icon name="download" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unduh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 font-bold text-sm p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-auto bg-slate-100/80 p-4 flex items-center justify-center min-h-[360px]">
          {loadError ? (
            <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-md max-w-md text-center space-y-3">
              <span className="text-4xl block">⚠️</span>
              <div className="font-bold text-sm text-slate-900">Gagal Menampilkan Berkas</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Berkas dokumen fisik belum dapat dimuat atau koneksi terputus. Silakan klik tombol muat ulang di bawah.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="btn btn-p text-xs py-2 px-4 font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <span>🔄</span>
                  <span>Muat Ulang / Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadPdf(`/dokumen/${dok.id}/file`, dok.nama_file)}
                  className="btn btn-o text-xs py-2 px-3 font-semibold"
                >
                  Unduh Berkas
                </button>
              </div>
            </div>
          ) : isImage ? (
            <div className="overflow-auto max-h-[72vh] flex items-center justify-center w-full">
              <img
                key={key}
                src={url}
                alt={dok.nama_file}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.12s ease',
                }}
                className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-md border border-slate-200 bg-white"
                onError={() => setLoadError(true)}
              />
            </div>
          ) : (
            <iframe
              key={key}
              src={url}
              title={dok.nama_file}
              className="w-full h-[68vh] rounded-xl border border-slate-300 bg-white shadow-sm"
              onError={() => setLoadError(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [d, load] = useGet('/pengajuan/' + id);
  const [cat, setCat] = useState('');
  const [files, setFiles] = useState({});
  const [m, setM] = useState();
  const [loadingAct, setLoadingAct] = useState(false);
  const [tabDraf, setTabDraf] = useState(false);
  const [modalLurah, setModalLurah] = useState(false);
  const [pratinjauDok, setPratinjauDok] = useState(null);

  const handleHapusPengajuan = async () => {
    const konfirmasi = window.confirm(
      r === 'warga'
        ? 'Apakah Anda yakin ingin membatalkan permohonan surat ini?'
        : 'Apakah Anda yakin ingin menghapus permohonan surat ini dari sistem?'
    );
    if (!konfirmasi) return;
    setLoadingAct(true);
    try {
      await api.delete(`/pengajuan/${id}`);
      alert('Pengajuan berhasil dihapus/dibatalkan.');
      navigate('/app/pengajuan');
    } catch (err) {
      alert('Gagal menghapus pengajuan: ' + em(err));
      setLoadingAct(false);
    }
  };

  const handleLurahApprove = async (payload) => {
    setLoadingAct(true);
    try {
      await api.post(`/pengajuan/${id}/persetujuan`, payload);
      setModalLurah(false);
      setM({ ok: 1, t: 'Persetujuan ACC Lurah berhasil! Surat resmi langsung diterbitkan dengan tanda tangan Anda.' });
      load();
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoadingAct(false);
    }
  };

  if (user?.role === 'warga' && user?.status_verifikasi !== 'terverifikasi') {
    return <VerifikasiDiperlukanGate user={user} title="Detail Permohonan Terkunci" />;
  }
  if (!d || !d.p) return <p className="text-sm text-slate-500 py-8 text-center">Memuat rincian pengajuan surat…</p>;
  const { p } = d;
  const r = user?.role;
  const s = p.status;

  const formFields = Array.isArray(p.form_fields)
    ? p.form_fields
    : typeof p.form_fields === 'string'
    ? JSON.parse(p.form_fields || '[]')
    : [];
  const formData =
    typeof p.data_form === 'object' && p.data_form !== null
      ? p.data_form
      : typeof p.data_form === 'string'
      ? JSON.parse(p.data_form || '{}')
      : {};

  const act = async (path, body) => {
    setLoadingAct(true);
    try {
      await api.post(`/pengajuan/${id}/${path}`, body);
      setM({ ok: 1, t: 'Tindakan berhasil disimpan.' });
      setCat('');
      setFiles({});
      load();
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoadingAct(false);
    }
  };

  const rev = () => {
    const fd = new FormData();
    Object.entries(files).forEach(([k, f]) => fd.append(k, f));
    act('revisi', fd);
  };

  const canRev = r === 'warga' && s === 'revision_required';

  // Alur tahapan standar
  const steps = [
    { key: 'diajukan', label: '1. Diajukan Warga', done: true },
    { key: 'verifikasi', label: '2. Verifikasi Petugas', done: ['under_review', 'pending_approval', 'approved', 'issued'].includes(s), active: s === 'under_review' },
    { key: 'persetujuan', label: '3. Persetujuan Lurah', done: ['approved', 'issued'].includes(s), active: s === 'pending_approval' },
    { key: 'terbit', label: '4. Surat Terbit & Selesai', done: s === 'issued', active: s === 'approved' },
  ];

  // Template naskah resmi standar
  const templateNaskah = p.template || 'adalah benar warga yang bertempat tinggal di wilayah Kelurahan Suka Maju. Surat keterangan ini diterbitkan secara sah untuk keperluan yang bersangkutan sesuai dengan berkas permohonan yang diajukan.';

  return (
    <div className="space-y-5">
      {/* ── BREADCRUMB & HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Link to="/app/pengajuan" className="hover:text-brand-600">Pengajuan Surat</Link>
            <span>/</span>
            <span className="tabular-nums text-slate-700">{p.kode}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">{p.jenis}</h1>
          <div className="text-xs text-slate-500 mt-0.5">
            Diajukan pada {tg(p.created_at)} oleh <b className="text-slate-800">{p.pemohon}</b> (NIK: {maskId(p.nik)})
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge s={s} />
        </div>
      </div>

      {/* ── STEPPER ALUR PELAYANAN ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {steps.map((st) => (
            <div
              key={st.key}
              className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                st.done
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 font-semibold'
                  : st.active
                  ? 'border-brand-300 bg-brand-50/80 text-brand-900 font-bold ring-1 ring-brand-300'
                  : 'border-slate-100 bg-slate-50 text-slate-400'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  st.done
                    ? 'bg-emerald-600 text-white'
                    : st.active
                    ? 'bg-brand-600 text-white animate-pulse'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {st.done ? '✓' : st.active ? '●' : '○'}
              </span>
              <span className="truncate">{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── HASIL SETELAH DI-ACC LURAH (SURAT RESMI TELAH TERBIT) ── */}
      {(s === 'issued' || d.surat) && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                <Icon name="check" className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  Balasan Resmi: Surat Keterangan Telah Disahkan Lurah
                </h3>
                <p className="text-[11px] text-emerald-700">Dokumen berkekuatan hukum dengan Tanda Tangan Elektronik (TTE) & QR Code Lurah</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-200/80 px-3.5 py-1 text-xs font-bold text-emerald-900 border border-emerald-300 shadow-2xs">
              Disahkan & Siap Unduh
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 bg-white/95 p-4 rounded-xl border border-emerald-200 text-xs mb-4 shadow-2xs">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Nomor Registrasi Surat:</div>
              <div className="tabular-nums font-bold text-slate-900 text-sm mt-0.5">{d.surat?.nomor || '-'}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Tanggal Pengesahan:</div>
              <div className="font-bold text-slate-800 mt-0.5">{tg(d.surat?.terbit_at)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Pejabat Penandatangan:</div>
              <div className="font-bold text-slate-800 mt-0.5">{d.surat?.lurah_nama || 'Muhammad Iqbal Samosir, S.E., M.A.P.'}</div>
              <div className="text-[10px] text-slate-500">{d.surat?.lurah_jabatan || 'Lurah Suka Maju'}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Kode Verifikasi QR:</div>
              <div className="tabular-nums font-bold text-slate-800 mt-0.5">{d.surat?.kode_verifikasi || '-'}</div>
            </div>
          </div>

          <div className="rounded-lg bg-white/70 p-3 text-xs text-emerald-900 leading-relaxed mb-4 border border-emerald-200/60">
            <b>Pemberitahuan Pelayanan:</b> Dokumen fisik PDF resmi telah terbit dan siap digunakan. Anda dapat mengunduh berkas digital atau mencetaknya secara mandiri. Berkas ini memiliki kekuatan hukum yang sah.
          </div>

          {/* Tombol Unduh & Pratinjau Dokumen (Responsive Desktop & Mobile) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs sm:text-sm py-2.5 px-5 transition-all shadow-md w-full sm:w-auto"
              onClick={() => downloadPdf(`/pengajuan/${id}/surat`, `Surat-${(d.surat?.nomor || p.kode).replace(/[/\\?%*:|"<>]/g, '_')}.pdf`)}
            >
              <span className="text-base">🖨️</span>
              <span>Cetak / Unduh Dokumen Resmi (PDF)</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm py-2.5 px-5 transition-all w-full sm:w-auto"
              onClick={() => downloadPdf(`/pengajuan/${id}/surat`, `Surat-${(d.surat?.nomor || p.kode).replace(/[/\\?%*:|"<>]/g, '_')}.pdf`)}
            >
              <Icon name="download" className="w-4 h-4" />
              <span>Unduh Berkas PDF</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm py-2.5 px-4 shadow-2xs transition-colors w-full sm:w-auto"
              onClick={() => viewPdf(`/pengajuan/${id}/surat`)}
            >
              <Icon name="eye" className="w-4 h-4" />
              <span>Lihat PDF</span>
            </button>
            {d.surat?.kode_verifikasi && (
              <Link
                to={`/verifikasi/${d.surat.kode_verifikasi}`}
                target="_blank"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm py-2.5 px-4 transition-colors w-full sm:w-auto"
              >
                <Icon name="shield" className="w-4 h-4" />
                <span>Cek Validasi QR</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── KOTAK PENJELASAN DRAF NASKAH & ASAL TEMPLATE (BISA DIBUKA SEBELUM / SESUDAH DISAHKAN) ── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-slate-50/80 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Icon name="file" className="w-4 h-4 text-brand-600" />
              <span>Pratinjau Draf Naskah Surat (Template Kelurahan Suka Maju)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Naskah disusun otomatis dari Template Resmi Master Surat <b>{p.jenis}</b> ({p.jkode})
            </p>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-brand-700 bg-white hover:bg-brand-50 px-3 py-1.5 rounded-lg border border-slate-300 transition-colors"
            onClick={() => setTabDraf(!tabDraf)}
          >
            {tabDraf ? 'Tutup Pratinjau Naskah' : 'Lihat Susunan Naskah Surat'}
          </button>
        </div>

        {tabDraf && (
          <div className="p-6 bg-slate-100/60">
            {/* LEMBAR SIMULASI SURAT RESMI KELURAHAN */}
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg border border-slate-300 font-serif text-slate-900 text-xs sm:text-sm leading-relaxed">
              {/* KOP SURAT */}
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                <div className="text-xs font-bold">Pemerintah Kota Medan</div>
                <div className="text-sm sm:text-base font-bold tracking-tight">Kecamatan Medan Johor • Kelurahan Suka Maju</div>
                <div className="text-[10px] text-slate-600 font-sans mt-0.5">Jl. STM No. 40 • Telp: 0823-4123-5734 • Kode Pos: 20146</div>
              </div>

              {/* JUDUL */}
              <div className="text-center my-4 font-sans">
                <div className="font-bold underline text-sm sm:text-base">{p.jenis}</div>
                <div className="text-xs tabular-nums text-slate-600 mt-0.5">
                  Nomor: {d.surat?.nomor || `DRAF / ${p.jkode} / KEL-SKM / ${new Date().getFullYear()}`}
                </div>
              </div>

              {/* PEMBUKA */}
              <p className="mb-3 text-justify">
                Yang bertanda tangan di bawah ini, Lurah Kelurahan Suka Maju, Kecamatan Medan Johor, Kota Medan, dengan ini menerangkan bahwa:
              </p>

              {/* DATA IDENTITAS */}
              <div className="my-3 pl-4 space-y-1 font-sans text-xs">
                <div className="grid grid-cols-3"><span className="text-slate-500">Nama Lengkap</span><span className="col-span-2 font-bold">: {p.pemohon}</span></div>
                <div className="grid grid-cols-3"><span className="text-slate-500">NIK</span><span className="col-span-2 tabular-nums font-bold">: {maskId(p.nik)}</span></div>
                <div className="grid grid-cols-3"><span className="text-slate-500">Tempat, Tgl Lahir</span><span className="col-span-2">: {p.tempat_lahir || '-'}, {p.tanggal_lahir ? String(p.tanggal_lahir).slice(0, 10) : '-'}</span></div>
                <div className="grid grid-cols-3"><span className="text-slate-500">Jenis Kelamin</span><span className="col-span-2">: {p.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</span></div>
                <div className="grid grid-cols-3"><span className="text-slate-500">Alamat</span><span className="col-span-2">: {p.alamat || '-'}</span></div>
                <div className="grid grid-cols-3"><span className="text-slate-500">Pekerjaan</span><span className="col-span-2">: {p.pekerjaan || '-'}</span></div>
                {formFields.map((f) => (
                  <div key={f.name} className="grid grid-cols-3">
                    <span className="text-slate-500">{f.label}</span>
                    <span className="col-span-2 font-semibold">: {formData[f.name] || '-'}</span>
                  </div>
                ))}
              </div>

              {/* KLAUSUL TEMPLATE RESMI */}
              <div className="my-4 p-3 bg-slate-50 rounded border border-slate-200 text-justify">
                <p>
                  Berdasarkan basis data kependudukan dan hasil verifikasi berkas permohonan, yang bersangkutan <b>{templateNaskah}</b>
                </p>
              </div>

              <p className="mb-6 text-justify">
                Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.
              </p>

              {/* TANDA TANGAN */}
              <div className="flex justify-end pt-2 font-sans text-xs text-right">
                <div>
                  <div>Medan, {d.surat?.terbit_at ? tg(d.surat.terbit_at) : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div className="font-bold mt-0.5">Lurah Suka Maju</div>
                  <div className="my-3 flex justify-end">
                    {s === 'issued' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded border border-emerald-300">
                        [TTE Disahkan • QR Code Valid]
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 font-medium px-2 py-1 rounded border border-amber-200">
                        [Menunggu ACC & TTE Lurah]
                      </span>
                    )}
                  </div>
                  <div className="font-bold underline">{d.surat?.lurah_nama || 'Muhammad Iqbal Samosir, S.E., M.A.P.'}</div>
                  <div className="text-[10px] text-slate-500">{d.surat?.lurah_nip || 'NIP. 19850612 201001 1 005'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {s === 'approved' && !d.surat && (
        <div className="rounded-xl border border-blue-300 bg-blue-50/70 p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Icon name="check" className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-blue-950">
              Persetujuan Lurah Diberikan (Menunggu Penerbitan Berkas)
            </h3>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed mb-4">
            Lurah Suka Maju telah memberikan persetujuan ACC. Klik tombol di bawah untuk menerbitkan berkas PDF resmi ber-QR Code.
          </p>
          {['petugas', 'lurah'].includes(r) && (
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-2 px-4"
              onClick={() => act('terbitkan')}
              disabled={loadingAct}
            >
              <Icon name="file" className="w-4 h-4" />
              <span>{loadingAct ? 'Menerbitkan…' : 'Terbitkan Dokumen Resmi Sekarang'}</span>
            </button>
          )}
        </div>
      )}

      {s === 'rejected' && (
        <div className="rounded-xl border border-rose-300 bg-rose-50/80 p-5">
          <div className="flex items-center gap-2.5 mb-3 border-b border-rose-200 pb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white">
              <Icon name="alert" className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-rose-950">
              Pemberitahuan: Permohonan Tidak Dapat Disetujui
            </h3>
          </div>
          <div className="bg-white p-3.5 rounded-lg border border-rose-200 text-xs text-rose-900 mb-3">
            <div className="font-semibold text-slate-500 text-[11px] mb-1">Alasan Penolakan:</div>
            <p className="font-bold text-rose-800">{p.catatan || 'Dokumen persyaratan tidak memenuhi ketentuan administrasi yang berlaku.'}</p>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            Silakan ajukan permohonan baru dengan berkas persyaratan yang lengkap dan valid, atau kunjungi kantor Kelurahan Suka Maju untuk informasi lebih lanjut.
          </p>
        </div>
      )}

      {s === 'revision_required' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-5">
          <div className="flex items-center gap-2.5 mb-3 border-b border-amber-200 pb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-white">
              <Icon name="alert" className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-amber-950">
              Pemberitahuan: Diperlukan Perbaikan Dokumen Persyaratan
            </h3>
          </div>
          <div className="bg-white p-3.5 rounded-lg border border-amber-200 text-xs text-amber-900 mb-3">
            <div className="font-semibold text-slate-500 text-[11px] mb-1">Catatan Petugas Pemeriksa:</div>
            <p className="font-bold text-amber-800">{p.catatan || 'Mohon lengkapi dan unggah kembali dokumen persyaratan yang diminta.'}</p>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Pilih berkas baru pada daftar dokumen di bawah ini, lalu klik tombol "Kirim Dokumen Revisi" agar petugas dapat memproses ulang.
          </p>
        </div>
      )}

      {/* ── RINCIAN FORMULIR PERMOHONAN ── */}
      <Card title="Data Formulir Permohonan">
        <dl className="grid gap-3 text-xs sm:grid-cols-2 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
          <div>
            <dt className="text-slate-400 font-medium">Jenis Surat Keterangan:</dt>
            <dd className="font-bold text-slate-900 mt-0.5">{p.jenis} ({p.jkode})</dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">Nama Pemohon (Warga):</dt>
            <dd className="font-bold text-slate-900 mt-0.5">{p.pemohon}</dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">Nomor Induk Kependudukan (NIK):</dt>
            <dd className="tabular-nums font-bold text-slate-900 mt-0.5">{maskId(p.nik)}</dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">Tanggal Pengajuan Masuk:</dt>
            <dd className="font-bold text-slate-900 mt-0.5">{tg(p.created_at)}</dd>
          </div>
          {formFields.map((f) => (
            <div key={f.name}>
              <dt className="text-slate-400 font-medium">{f.label}:</dt>
              <dd className="font-semibold text-slate-800 mt-0.5">{formData[f.name] || '-'}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* ── DOKUMEN PERSYARATAN ── */}
      <Card title="Dokumen Lampiran Persyaratan">
        <div className="divide-y divide-slate-100 text-xs">
          {(d.syarat || []).map((sy) => {
            const dk = (d.dokumen || []).find((x) => x.persyaratan_id === sy.id);
            return (
              <div key={sy.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{sy.nama}</div>
                  {sy.keterangan && <div className="text-[11px] text-slate-400">{sy.keterangan}</div>}
                </div>
                <div className="flex items-center gap-3">
                  {dk ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg border border-brand-200 transition-colors"
                        onClick={() => setPratinjauDok({ id: dk.id, nama: sy.nama, nama_file: dk.nama_file })}
                        title="Buka / Pratinjau Berkas Dokumen"
                      >
                        <Icon name="eye" className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[200px]">{dk.nama_file}</span>
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-300 transition-colors text-xs"
                        onClick={() => downloadPdf('/dokumen/' + dk.id + '/file', dk.nama_file)}
                        title="Unduh Berkas Ini"
                      >
                        <Icon name="download" className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Unduh</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-rose-600 font-semibold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 text-[11px]">
                      Belum Diunggah
                    </span>
                  )}
                  {canRev && (
                    <input
                      type="file"
                      className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-brand-600 file:text-white"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setFiles({ ...files, ['doc_' + sy.id]: e.target.files[0] })}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {canRev && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <button className="btn btn-p text-xs py-2 px-4" onClick={rev} disabled={loadingAct}>
              {loadingAct ? 'Mengirim…' : 'Kirim Berkas Revisi'}
            </button>
          </div>
        )}
      </Card>

      {/* ── RIWAYAT TAHAPAN & AUDIT ── */}
      <Card title="Riwayat Verifikasi & Catatan Pelayanan">
        <Table
          head={['Waktu', 'Tahapan', 'Hasil Keputusan', 'Pejabat Pemeriksa', 'Catatan Resmi']}
          rows={(d.riwayat || []).map((x) => [
            tg(x.created_at),
            x.tipe,
            <span key="h" className="capitalize font-semibold text-slate-800">{x.hasil}</span>,
            x.oleh,
            x.catatan || '-'
          ])}
        />
      </Card>

      <Msg m={m} />

      {/* ── ACTION BAR UNTUK PETUGAS & LURAH ── */}
      {['petugas', 'lurah'].includes(r) && (
        <Card title="Tindakan Keputusan Petugas / Lurah">
          <div className="space-y-3">
            {((r === 'petugas' && s === 'under_review') || (r === 'lurah' && s === 'pending_approval')) && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Instruksi Resmi untuk Pemohon:
                </label>
                <input
                  className="inp text-xs"
                  placeholder="Masukkan catatan alasan perbaikan, disposisi, atau keterangan tambahan…"
                  value={cat}
                  onChange={(e) => setCat(e.target.value)}
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 pt-2">
              {r === 'petugas' && s === 'submitted' && (
                <button className="btn btn-p text-xs py-2.5 px-4 font-bold" onClick={() => act('mulai')} disabled={loadingAct}>
                  Mulai Periksa Berkas Permohonan
                </button>
              )}
              {r === 'petugas' && s === 'under_review' && (
                <>
                  <button className="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2.5 px-4 font-bold" onClick={() => act('verifikasi', { hasil: 'lengkap', catatan: cat })} disabled={loadingAct}>
                    ✓ Lengkap (Teruskan ke Lurah)
                  </button>
                  <button className="btn bg-amber-500 hover:bg-amber-600 text-white text-xs py-2.5 px-4 font-bold" onClick={() => act('verifikasi', { hasil: 'revisi', catatan: cat })} disabled={loadingAct}>
                    Minta Revisi Dokumen
                  </button>
                  <button className="btn btn-d text-xs py-2.5 px-4 font-bold" onClick={() => act('verifikasi', { hasil: 'ditolak', catatan: cat })} disabled={loadingAct}>
                    ✕ Tolak Pengajuan
                  </button>
                </>
              )}
              {r === 'lurah' && s === 'pending_approval' && (
                <>
                  <button className="btn bg-brand-700 hover:bg-brand-800 text-white text-xs py-2.5 px-5 font-bold shadow-md" onClick={() => setModalLurah(true)} disabled={loadingAct}>
                    ✓ Berikan Persetujuan (ACC Lurah) & Bubuhkan TTD
                  </button>
                  <button className="btn btn-d text-xs py-2.5 px-4 font-bold" onClick={() => act('persetujuan', { hasil: 'tolak', catatan: cat })} disabled={loadingAct}>
                    ✕ Tolak Pengajuan
                  </button>
                </>
              )}
              {['petugas', 'lurah'].includes(r) && (s === 'approved' || (!d.surat && s === 'issued')) && (
                <button className="btn btn-p text-xs py-2.5 px-4 font-bold" onClick={() => act('terbitkan')} disabled={loadingAct}>
                  Terbitkan Surat Resmi (PDF + QR)
                </button>
              )}
              {['petugas', 'lurah'].includes(r) && (
                <button
                  type="button"
                  className="btn btn-d text-xs py-2.5 px-4 font-bold flex items-center gap-1.5 ml-auto"
                  onClick={handleHapusPengajuan}
                  disabled={loadingAct}
                >
                  <span>🗑️</span>
                  <span>Hapus Pengajuan Ini</span>
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Tombol Batalkan untuk Warga */}
      {r === 'warga' && ['submitted', 'rejected', 'revision_required'].includes(s) && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            className="btn btn-d text-xs py-2 px-4 font-bold flex items-center gap-1.5"
            onClick={handleHapusPengajuan}
            disabled={loadingAct}
          >
            <span>🗑️</span>
            <span>Batalkan Permohonan Surat Saya</span>
          </button>
        </div>
      )}

      {/* MODAL PERSETUJUAN & TANDA TANGAN LURAH */}
      {modalLurah && (
        <ModalPersetujuanLurah
          pengajuan={p}
          user={user}
          onConfirm={handleLurahApprove}
          onClose={() => setModalLurah(false)}
          loading={loadingAct}
        />
      )}

      {/* MODAL PRATINJAU BERKAS PERSYARATAN (KTP, KK, DLL) */}
      {pratinjauDok && (
        <ModalPratinjauBerkas
          dok={pratinjauDok}
          onClose={() => setPratinjauDok(null)}
        />
      )}
    </div>
  );
}

function WargaSuratList() {
  const [rows] = useGet('/surat-saya');
  if (!rows) return <p className="text-sm text-slate-400">Memuat…</p>;
  if (!rows.length) return (
    <div className="text-center py-4 text-slate-400">
      
      <p className="text-xs">Belum ada surat terbit.</p>
    </div>
  );
  return (
    <ul className="divide-y text-sm">
      {rows.slice(0, 3).map((s) => (
        <li key={s.id} className="flex items-center justify-between py-2.5 gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-700 truncate text-xs">{s.jenis}</div>
            <div className="text-[11px] text-slate-400 tabular-nums">{s.nomor}</div>
          </div>
          <button
            className="btn btn-p text-[11px] py-1 px-2.5 flex-shrink-0"
            onClick={() => downloadPdf(`/pengajuan/${s.pengajuan_id}/surat`, `Surat-${s.nomor.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`)}
          >
            ⬇ Unduh
          </button>
        </li>
      ))}
    </ul>
  );
}

function SuratSaya() {
  const { user } = useAuth();
  const [rows] = useGet('/surat-saya');
  const [activePrint, setActivePrint] = useState(null);
  const [loadingPrint, setLoadingPrint] = useState(false);

  if (user?.role === 'warga' && user?.status_verifikasi !== 'terverifikasi') {
    return <VerifikasiDiperlukanGate user={user} title="Dokumen Surat Saya Terkunci" />;
  }

  const handleOpenPrint = async (pengajuanId) => {
    try {
      setLoadingPrint(true);
      const res = await api.get(`/pengajuan/${pengajuanId}`);
      setActivePrint(res.data);
    } catch (e) {
      alert('Gagal memuat dokumen untuk dicetak: ' + em(e));
    } finally {
      setLoadingPrint(false);
    }
  };

  return (
    <Card
      title="Surat Saya (Dokumen Kependudukan Resmi)"
      subtitle="Daftar surat keterangan resmi yang telah disahkan Lurah dan diterbitkan untuk Anda"
    >
      {!(rows || []).length && rows !== null ? (
        <div className="py-12 text-center text-slate-400">
          <div className="flex justify-center mb-3 text-slate-300">
            <Icon name="file" className="w-12 h-12" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Belum Ada Surat Keterangan yang Diterbitkan</p>
          <p className="text-xs mt-1 text-slate-400 max-w-sm mx-auto">
            Surat yang telah disetujui dan disahkan oleh Lurah akan otomatis tercatat di sini dan siap diunduh kapan saja.
          </p>
          <div className="mt-4">
            <Link to="/app/ajukan" className="btn btn-p text-xs py-2 px-4">
              Ajukan Permohonan Surat Sekarang
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(rows || []).map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="rounded-md bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    {s.kode}
                  </span>
                  <span className="text-[11px] text-slate-400">{tg(s.terbit_at)}</span>
                </div>
                <h4 className="text-base font-bold text-slate-900">{s.jenis}</h4>
                <div className="tabular-nums text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-sans">Nomor Dokumen:</span>
                  {s.nomor}
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Penandatangan: <b>{s.lurah_nama || 'Muhammad Iqbal Samosir, S.E., M.A.P.'}</b> ({s.lurah_jabatan || 'Lurah Suka Maju'})
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs py-2 px-3 transition-colors shadow-xs"
                  onClick={() => handleOpenPrint(s.pengajuan_id)}
                  disabled={loadingPrint}
                >
                  <span>🖨️</span>
                  <span>Cetak</span>
                </button>
                <button
                  type="button"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 transition-colors"
                  onClick={() => downloadPdf(`/pengajuan/${s.pengajuan_id}/surat`, `Surat-${s.nomor.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`)}
                >
                  <Icon name="download" className="w-3.5 h-3.5" />
                  <span>Unduh PDF</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs py-2 px-2.5 transition-colors"
                  onClick={() => viewPdf(`/pengajuan/${s.pengajuan_id}/surat`)}
                  title="Pratinjau Dokumen"
                >
                  <Icon name="eye" className="w-3.5 h-3.5" />
                </button>
                <Link
                  to={`/app/pengajuan/${s.pengajuan_id}`}
                  className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors"
                >
                  Detail
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CETAK LANGSUNG DARI HALAMAN SURAT SAYA */}
      {activePrint && <ModalCetakSurat data={activePrint} onClose={() => setActivePrint(null)} userRole="warga" />}
    </Card>
  );
}

/* ====================================================================
   FITUR PERSURATAN DINAS: SURAT MASUK, DISPOSISI LURAH & SURAT BALASAN
   ==================================================================== */

const ST_SM = {
  menunggu_disposisi: 'Menunggu Disposisi',
  didisposisi: 'Didisposisi Lurah',
  dibalas: 'Selesai (Surat Dibalas)',
};

const COL_SM = {
  menunggu_disposisi: 'bg-amber-50 text-amber-800 border border-amber-200',
  didisposisi: 'bg-blue-50 text-blue-800 border border-blue-200',
  dibalas: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
};

const BadgeSM = ({ s }) => (
  <span className={'badge ' + (COL_SM[s] || 'bg-slate-100 text-slate-700')}>
    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
    {ST_SM[s] || s}
  </span>
);

function SuratMasuk() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [rows, load] = useGet(`/surat-masuk?status=${filter}&q=${encodeURIComponent(q)}`);

  const [modalTambah, setModalTambah] = useState(false);
  const [selectedSurat, setSelectedSurat] = useState(null);
  const [detailData, setDetailData] = useState(null);

  // Form input surat masuk baru
  const [f, setF] = useState({
    nomor_surat: '',
    pengirim: '',
    tanggal_surat: new Date().toISOString().slice(0, 10),
    perihal: '',
    ringkasan_isi: '',
  });

  // Form disposisi lurah
  const [dispForm, setDispForm] = useState({
    tujuan_disposisi: 'Kasi Pelayanan & Petugas Loket',
    sifat: 'Biasa',
    arahan: '',
  });

  // Form surat balasan
  const [balasForm, setBalasForm] = useState({
    perihal: '',
    isi_surat: '',
  });

  const [loading, setLoading] = useState(false);
  const [m, setM] = useState();

  const handleHapusSM = async (id, nomor) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus catatan surat masuk nomor ${nomor || ''}? Seluruh riwayat disposisi dan balasan terkait akan ikut dihapus.`)) return;
    try {
      await api.delete(`/surat-masuk/${id}`);
      if (selectedSurat?.id === id) {
        setSelectedSurat(null);
        setDetailData(null);
      }
      load();
    } catch (err) {
      alert('Gagal menghapus surat masuk: ' + em(err));
    }
  };

  const loadDetail = async (id) => {
    try {
      const res = await api.get(`/surat-masuk/${id}`);
      setDetailData(res.data);
      setSelectedSurat(res.data.surat);
      setBalasForm({
        perihal: `Tanggapan / Balasan atas Surat Nomor: ${res.data.surat.nomor_surat}`,
        isi_surat: `Sehubungan dengan surat Saudara Nomor ${res.data.surat.nomor_surat} perihal "${res.data.surat.perihal}", bersama ini kami sampaikan bahwa Kelurahan Suka Maju telah menindaklanjuti hal tersebut sesuai dengan ketentuan yang berlaku.`,
      });
    } catch (err) {
      alert(em(err));
    }
  };

  const handleSimpanSuratMasuk = async (e) => {
    e.preventDefault();
    setLoading(true);
    setM(null);
    try {
      await api.post('/surat-masuk', f);
      setModalTambah(false);
      setF({
        nomor_surat: '',
        pengirim: '',
        tanggal_surat: new Date().toISOString().slice(0, 10),
        perihal: '',
        ringkasan_isi: '',
      });
      load();
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoading(false);
    }
  };

  const handleSimpanDisposisi = async (e) => {
    e.preventDefault();
    if (!dispForm.arahan.trim()) return alert('Arahan/instruksi Lurah wajib diisi');
    setLoading(true);
    try {
      await api.post(`/surat-masuk/${selectedSurat.id}/disposisi`, dispForm);
      setDispForm({ tujuan_disposisi: 'Kasi Pelayanan & Petugas Loket', sifat: 'Biasa', arahan: '' });
      await loadDetail(selectedSurat.id);
      load();
    } catch (x) {
      alert(em(x));
    } finally {
      setLoading(false);
    }
  };

  const handleKirimBalasan = async (e) => {
    e.preventDefault();
    if (!balasForm.isi_surat.trim()) return alert('Isi surat balasan wajib diisi');
    setLoading(true);
    try {
      await api.post(`/surat-masuk/${selectedSurat.id}/balas`, balasForm);
      alert('Surat balasan kedinasan resmi berhasil dibuat dan diarsipkan!');
      await loadDetail(selectedSurat.id);
      load();
    } catch (x) {
      alert(em(x));
    } finally {
      setLoading(false);
    }
  };

  const handleHapusBalasan = async (balasanId, nomor) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus surat dinas balasan resmi nomor ${nomor || ''}? Berkas PDF terkait pada server juga akan dihapus.`)) return;
    try {
      await api.delete(`/surat-keluar/${balasanId}`);
      await loadDetail(selectedSurat.id);
      load();
    } catch (err) {
      alert('Gagal menghapus surat balasan: ' + em(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Buku Agenda Surat Masuk & Lembar Disposisi"
        subtitle="Pencatatan surat masuk kedinasan, tindak lanjut instruksi Lurah, dan penerbitan surat balasan resmi"
        rightAction={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="inp text-xs py-1.5"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Semua Status</option>
              <option value="menunggu_disposisi">⏳ Menunggu Disposisi</option>
              <option value="didisposisi">Telah didisposisi</option>
              <option value="dibalas">Telah dibalas</option>
            </select>
            <input
              className="inp text-xs py-1.5 max-w-xs"
              placeholder="Cari surat / pengirim..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {['petugas', 'lurah'].includes(user?.role) && (
              <button
                className="btn btn-p text-xs py-1.5 font-bold"
                onClick={() => setModalTambah(true)}
              >
                + Catat Surat Masuk
              </button>
            )}
          </div>
        }
      >
        <Table
          head={['Nomor Surat', 'Asal Pengirim', 'Perihal & Tanggal', 'Status Disposisi', 'Surat Balasan', 'Tindakan']}
          rows={(rows || []).map((r) => [
            <b key="no" className="tabular-nums text-xs text-slate-900">{r.nomor_surat}</b>,
            <span key="p" className="text-xs font-semibold text-slate-800">{r.pengirim}</span>,
            <div key="per">
              <div className="text-xs font-medium text-slate-800 leading-tight">{r.perihal}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tgl Surat: {tg(r.tanggal_surat)}</div>
            </div>,
            <BadgeSM key="st" s={r.status} />,
            r.nomor_surat_balasan ? (
              <span key="sb" className="text-[11px] tabular-nums text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {r.nomor_surat_balasan}
              </span>
            ) : (
              <span key="sb" className="text-[11px] text-slate-400 italic">Belum dibalas</span>
            ),
            <div key="act" className="flex items-center gap-1.5">
              <button
                type="button"
                className="btn btn-o text-xs py-1 px-2.5 font-semibold text-navy hover:border-navy"
                onClick={() => loadDetail(r.id)}
              >
                Lihat Detail & Disposisi →
              </button>
              {['petugas', 'lurah'].includes(user?.role) && (
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                  title="Hapus Surat Masuk"
                  onClick={() => handleHapusSM(r.id, r.nomor_surat)}
                >
                  🗑️
                </button>
              )}
            </div>,
          ])}
        />
      </Card>

      {/* MODAL CATAT SURAT MASUK */}
      {modalTambah && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-lg">
            <div className="mb-4 flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-900 text-base">Catat Surat Masuk Kedinasan Baru</h3>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setModalTambah(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSimpanSuratMasuk} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field l="Nomor Surat Dari Pengirim" req>
                  <input
                    className="inp"
                    required
                    placeholder="Contoh: 005/142/KEC/2026"
                    value={f.nomor_surat}
                    onChange={(e) => setF({ ...f, nomor_surat: e.target.value })}
                  />
                </Field>
                <Field l="Tanggal Surat Pengirim" req>
                  <input
                    className="inp"
                    type="date"
                    required
                    value={f.tanggal_surat}
                    onChange={(e) => setF({ ...f, tanggal_surat: e.target.value })}
                  />
                </Field>
              </div>

              <Field l="Instansi / Asal Pengirim Surat" req>
                <input
                  className="inp"
                  required
                  placeholder="Contoh: Kantor Kecamatan Contoh / Pengurus RW 03"
                  value={f.pengirim}
                  onChange={(e) => setF({ ...f, pengirim: e.target.value })}
                />
              </Field>

              <Field l="Perihal Surat" req>
                <input
                  className="inp"
                  required
                  placeholder="Contoh: Undangan Rapat Koordinasi Wilayah"
                  value={f.perihal}
                  onChange={(e) => setF({ ...f, perihal: e.target.value })}
                />
              </Field>

              <Field l="Ringkasan Isi / Catatan Surat">
                <textarea
                  className="inp"
                  rows={3}
                  placeholder="Tuliskan ringkasan pokok isi surat masuk..."
                  value={f.ringkasan_isi}
                  onChange={(e) => setF({ ...f, ringkasan_isi: e.target.value })}
                />
              </Field>

              <Msg m={m} />

              <div className="mt-4 flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn btn-o text-xs" onClick={() => setModalTambah(false)}>
                  Batal
                </button>
                <button className="btn btn-p text-xs font-bold" disabled={loading}>
                  {loading ? 'Menyimpan…' : 'Simpan Surat Masuk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETAIL SURAT MASUK, DISPOSISI LURAH & PEMBUATAN SURAT BALASAN */}
      {selectedSurat && detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="card w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 bg-white space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-bold text-slate-400">Arsip Persuratan Kelurahan</span>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  Surat Masuk: {selectedSurat.nomor_surat}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {['petugas', 'lurah'].includes(user?.role) && (
                  <button
                    type="button"
                    className="btn btn-d text-xs py-1 px-2.5 font-bold flex items-center gap-1"
                    onClick={() => handleHapusSM(selectedSurat.id, selectedSurat.nomor_surat)}
                  >
                    <span>🗑️</span>
                    <span>Hapus Surat</span>
                  </button>
                )}
                <button
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => {
                    setSelectedSurat(null);
                    setDetailData(null);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Data Surat Masuk */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block">Asal Pengirim:</span>
                  <b className="text-slate-900 text-sm">{selectedSurat.pengirim}</b>
                </div>
                <div>
                  <span className="text-slate-400 block">Status Surat:</span>
                  <BadgeSM s={selectedSurat.status} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/80">
                <div>
                  <span className="text-slate-400 block">Perihal:</span>
                  <b className="text-slate-800">{selectedSurat.perihal}</b>
                </div>
                <div>
                  <span className="text-slate-400 block">Tanggal Surat & Diterima:</span>
                  <span>{tg(selectedSurat.tanggal_surat)} (Dicatat: {tg(selectedSurat.created_at)})</span>
                </div>
              </div>

              {selectedSurat.ringkasan_isi && (
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-slate-400 block mb-1">Ringkasan Isi Surat:</span>
                  <p className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700 leading-relaxed">
                    {selectedSurat.ringkasan_isi}
                  </p>
                </div>
              )}
            </div>

            {/* LEMBAR DISPOSISI LURAH */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
              <div className="flex items-center justify-between mb-3 border-b border-blue-200/60 pb-2">
                <div className="flex items-center gap-2">
                  
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Lembar Disposisi Resmi Lurah</h4>
                    <p className="text-[11px] text-slate-500">Instruksi arahan pimpinan kelurahan untuk tindak lanjut</p>
                  </div>
                </div>
              </div>

              {/* Riwayat Disposisi yang sudah ada */}
              {(detailData.disposisi || []).length > 0 ? (
                <div className="space-y-2 mb-3">
                  {detailData.disposisi.map((dp) => (
                    <div key={dp.id} className="rounded-lg bg-white p-3 border border-blue-200/80 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-900">
                          Tujuan: <span className="text-navy">{dp.tujuan_disposisi}</span>
                        </span>
                        <span className="rounded bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5">
                          Sifat: {dp.sifat}
                        </span>
                      </div>
                      <div className="text-slate-700 italic my-1.5 p-2 bg-slate-50 rounded border border-slate-100">
                        "{dp.arahan}"
                      </div>
                      <div className="text-[10px] text-slate-400 text-right">
                        Disposisi oleh: {dp.lurah_nama || 'Lurah Suka Maju'} • {tg(dp.tanggal_disposisi)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic mb-3">Belum ada lembar disposisi dari Lurah.</p>
              )}

              {/* Form Input Disposisi bagi Lurah */}
              {user?.role === 'lurah' && (
                <form onSubmit={handleSimpanDisposisi} className="space-y-3 bg-white p-3.5 rounded-lg border border-blue-200">
                  <span className="text-xs font-bold text-navy block">+ Berikan Instruksi Disposisi Baru</span>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Field l="Diteruskan / Ditujukan Kepada" req>
                      <select
                        className="inp text-xs"
                        value={dispForm.tujuan_disposisi}
                        onChange={(e) => setDispForm({ ...dispForm, tujuan_disposisi: e.target.value })}
                      >
                        <option value="Kasi Pelayanan & Petugas Loket">Kasi Pelayanan & Petugas Loket</option>
                        <option value="Kasi Pemerintahan & Ketentraman">Kasi Pemerintahan & Ketentraman</option>
                        <option value="Kasi Kesejahteraan Masyarakat">Kasi Kesejahteraan Masyarakat</option>
                        <option value="Sekretaris Kelurahan">Sekretaris Kelurahan</option>
                      </select>
                    </Field>
                    <Field l="Sifat Disposisi" req>
                      <select
                        className="inp text-xs"
                        value={dispForm.sifat}
                        onChange={(e) => setDispForm({ ...dispForm, sifat: e.target.value })}
                      >
                        <option value="Biasa">Biasa</option>
                        <option value="Penting">Penting</option>
                        <option value="Segera">Segera (Prioritas)</option>
                        <option value="Rahasia">Rahasia</option>
                      </select>
                    </Field>
                  </div>
                  <Field l="Instruksi / Arahan Tindak Lanjut" req>
                    <textarea
                      className="inp text-xs"
                      rows={2}
                      placeholder="Contoh: Segera pelajari dan buatkan surat balasan resmi konfirmasi kehadiran."
                      value={dispForm.arahan}
                      onChange={(e) => setDispForm({ ...dispForm, arahan: e.target.value })}
                    />
                  </Field>
                  <button className="btn btn-p text-xs py-2 font-bold w-full" disabled={loading}>
                    Simpan Lembar Disposisi Lurah
                  </button>
                </form>
              )}
            </div>

            {/* BAGIAN PENGERJAAN SURAT BALASAN RESMI KEDINASAN */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between mb-3 border-b border-emerald-200/60 pb-2">
                <div className="flex items-center gap-2">
                  
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Surat Balasan / Jawaban Resmi Kelurahan</h4>
                    <p className="text-[11px] text-slate-500">Penerbitan surat dinas keluar resmi balasan atas surat masuk ini</p>
                  </div>
                </div>
              </div>

              {/* Daftar Balasan yang telah dikerjakan */}
              {(detailData.balasan || []).length > 0 ? (
                <div className="space-y-2 mb-3">
                  {detailData.balasan.map((b) => (
                    <div key={b.id} className="rounded-lg bg-white p-3.5 border border-emerald-200 text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <div>
                          <span className="tabular-nums font-bold text-navy text-xs">{b.nomor_surat}</span>
                          <span className="text-slate-500 block text-[11px]">Kepada: {b.tujuan}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="btn bg-emerald-700 text-white hover:bg-emerald-800 text-xs py-1 px-3 font-bold"
                            onClick={() => openBlob(`/surat-keluar/${b.id}/pdf`)}
                          >
                            Unduh PDF Surat Balasan
                          </button>
                          {['petugas', 'lurah'].includes(user?.role) && (
                            <button
                              type="button"
                              className="btn btn-d text-xs py-1 px-2.5 font-bold flex items-center gap-1"
                              title="Hapus Surat Balasan Keluar"
                              onClick={() => handleHapusBalasan(b.id, b.nomor_surat)}
                            >
                              <span>🗑️</span>
                              <span>Hapus</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-slate-800 font-semibold">{b.perihal}</div>
                      <p className="bg-slate-50 p-2 rounded text-slate-600 leading-relaxed text-[11px]">
                        {b.isi_surat}
                      </p>
                      <div className="text-[10px] text-slate-400 text-right pt-1 border-t">
                        Dibuat: {tg(b.created_at)} • Penandatangan: {b.penandatangan || 'Lurah Suka Maju'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic mb-3">Belum ada surat balasan resmi yang dikerjakan.</p>
              )}

              {/* Form Pembuatan Surat Balasan */}
              {['petugas', 'lurah'].includes(user?.role) && (
                <form onSubmit={handleKirimBalasan} className="space-y-3 bg-white p-3.5 rounded-lg border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 block">
                      Buat & Terbitkan Surat Balasan Resmi
                    </span>
                    <span className="text-[10px] text-slate-400">Format Dinas Resmi Ber-KOP Kelurahan Suka Maju</span>
                  </div>

                  <Field l="Perihal Surat Balasan" req>
                    <input
                      className="inp text-xs"
                      required
                      value={balasForm.perihal}
                      onChange={(e) => setBalasForm({ ...balasForm, perihal: e.target.value })}
                    />
                  </Field>

                  <Field l="Isi Redaksi Surat Balasan Resmi" req>
                    <textarea
                      className="inp text-xs"
                      rows={4}
                      required
                      placeholder="Tuliskan isi kalimat jawaban/tanggapan resmi dari Kelurahan Suka Maju..."
                      value={balasForm.isi_surat}
                      onChange={(e) => setBalasForm({ ...balasForm, isi_surat: e.target.value })}
                    />
                  </Field>

                  <button className="btn bg-emerald-700 text-white hover:bg-emerald-800 text-xs py-2 font-bold w-full" disabled={loading}>
                    {loading ? 'Menerbitkan Dokumen PDF…' : 'Terbitkan & Arsipkan Surat Balasan Resmi (PDF)'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SuratKeluar() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [rows, load] = useGet(`/surat-keluar?q=${encodeURIComponent(q)}`);
  const [showModal, setShowModal] = useState(false);
  const [f, setF] = useState({ tujuan: '', perihal: '', isi_surat: '' });
  const [loading, setLoading] = useState(false);
  const [m, setM] = useState();
  const [hapusItem, setHapusItem] = useState(null);
  const [detailSK, setDetailSK] = useState(null);
  const [loadingHapus, setLoadingHapus] = useState(false);

  const handleBuatSurat = async (e) => {
    e.preventDefault();
    setLoading(true);
    setM(null);
    try {
      const res = await api.post('/surat-keluar', f);
      setF({ tujuan: '', perihal: '', isi_surat: '' });
      setShowModal(false);
      alert(`Surat dinas resmi berhasil diterbitkan dengan nomor: ${res.data.nomor_surat}`);
      load();
    } catch (err) {
      setM({ t: em(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleHapusSK = async () => {
    if (!hapusItem) return;
    setLoadingHapus(true);
    try {
      await api.delete(`/surat-keluar/${hapusItem.id}`);
      setHapusItem(null);
      load();
    } catch (err) {
      alert('Gagal menghapus surat keluar: ' + em(err));
    } finally {
      setLoadingHapus(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Buku Agenda Surat Keluar & Surat Dinas Kelurahan"
        subtitle="Daftar surat dinas resmi dan surat balasan yang diterbitkan serta disahkan oleh Lurah"
        rightAction={
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="inp text-xs py-1.5 max-w-xs"
              placeholder="Cari nomor, tujuan, perihal..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-p text-xs py-1.5 px-3.5 font-bold flex items-center gap-1.5 whitespace-nowrap"
              onClick={() => { setShowModal(true); setM(null); }}
            >
              <span>+ Buat Surat Dinas / Keluar</span>
            </button>
          </div>
        }
      >
        <Table
          head={['Nomor Surat Keluar', 'Kepada / Tujuan', 'Perihal Surat Dinas', 'Tanggal Terbit', 'Terkait Surat Masuk', 'Aksi']}
          rows={(rows || []).map((r) => [
            <b key="no" className="tabular-nums text-xs text-navy">{r.nomor_surat}</b>,
            <span key="tj" className="text-xs font-semibold text-slate-800">{r.tujuan}</span>,
            <div key="per">
              <div className="text-xs font-medium text-slate-800 leading-tight">{r.perihal}</div>
              <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{r.isi_surat}</div>
            </div>,
            <span key="tg" className="text-xs">{tg(r.tanggal_surat || r.created_at)}</span>,
            r.nomor_surat_masuk ? (
              <span key="sm" className="text-[11px] tabular-nums text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {r.nomor_surat_masuk}
              </span>
            ) : (
              <span key="sm" className={`text-[11px] px-2 py-0.5 rounded font-medium ${r.pembuat_role === 'lurah' ? 'text-brand-700 bg-blue-50' : 'text-sky-700 bg-sky-50'}`}>
                {r.pembuat_role === 'lurah' ? 'Inisiatif Lurah' : 'Tata Usaha Kelurahan'}
              </span>
            ),
            <div key="act" className="flex items-center gap-1.5 whitespace-nowrap">
              <button
                type="button"
                className="btn btn-o text-xs py-1 px-2.5 font-semibold text-navy hover:border-navy flex items-center gap-1"
                onClick={() => setDetailSK(r)}
              >
                <span>👁️</span>
                <span>Lihat</span>
              </button>
              <button
                type="button"
                className="btn bg-emerald-700 text-white hover:bg-emerald-800 text-xs py-1 px-2.5 font-bold flex items-center gap-1"
                onClick={() => downloadPdf(`/surat-keluar/${r.id}/pdf`, `Surat-Keluar-${r.nomor_surat.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`)}
              >
                Unduh PDF
              </button>
              <button
                type="button"
                className="btn btn-d text-xs py-1 px-2.5 font-bold flex items-center gap-1 shadow-2xs"
                title="Hapus Surat Keluar"
                onClick={() => setHapusItem(r)}
              >
                <span>🗑️</span>
                <span>Hapus</span>
              </button>
            </div>,
          ])}
        />
      </Card>

      {/* MODAL PRATINJAU NASKAH SURAT KELUAR */}
      {detailSK && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 bg-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-400">Arsip Surat Keluar Resmi</span>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  Nomor: {detailSK.nomor_surat}
                </h3>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm"
                onClick={() => setDetailSK(null)}
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block font-medium">Tujuan / Penerima:</span>
                  <b className="text-slate-900 text-sm">{detailSK.tujuan}</b>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Tanggal Terbit / Ditandatangani:</span>
                  <span>{tg(detailSK.tanggal_surat || detailSK.created_at)}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-400 block font-medium">Perihal Surat Dinas:</span>
                <b className="text-slate-800">{detailSK.perihal}</b>
              </div>
              {detailSK.nomor_surat_masuk && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 block font-medium">Surat Masuk Terkait:</span>
                  <span className="font-semibold text-brand-700">{detailSK.nomor_surat_masuk}</span>
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <span className="text-xs font-bold text-slate-700 block mb-2">Isi Redaksi Naskah Surat Dinas:</span>
              <p className="text-xs font-serif leading-relaxed text-slate-800 whitespace-pre-wrap p-3 bg-slate-50 rounded-lg border border-slate-100">
                {detailSK.isi_surat}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn btn-d text-xs py-2 px-3.5 font-bold flex items-center gap-1.5"
                onClick={() => {
                  const item = detailSK;
                  setDetailSK(null);
                  setHapusItem(item);
                }}
              >
                <span>🗑️</span>
                <span>Hapus Surat Keluar Ini</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-o text-xs py-2 px-3"
                  onClick={() => setDetailSK(null)}
                >
                  Tutup
                </button>
                <button
                  type="button"
                  className="btn bg-emerald-700 text-white hover:bg-emerald-800 text-xs py-2 px-4 font-bold flex items-center gap-1.5"
                  onClick={() => downloadPdf(`/surat-keluar/${detailSK.id}/pdf`, `Surat-Keluar-${detailSK.nomor_surat.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`)}
                >
                  <Icon name="download" className="w-3.5 h-3.5" />
                  <span>Unduh Dokumen PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS SURAT KELUAR */}
      {hapusItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="card w-full max-w-md border border-rose-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Hapus Surat Keluar / Dinas</h3>
                <p className="text-[11px] text-slate-500">Tindakan ini permanen dan akan menghapus berkas PDF</p>
              </div>
            </div>
            <div className="bg-rose-50 border border-rose-200/80 rounded-lg p-3 text-xs text-rose-900 mb-4 space-y-1">
              <div><b>Nomor Surat:</b> {hapusItem.nomor_surat}</div>
              <div><b>Tujuan:</b> {hapusItem.tujuan}</div>
              <div><b>Perihal:</b> {hapusItem.perihal}</div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus agenda surat dinas resmi ini? Catatan agenda dan dokumen PDF terkait pada server akan dihapus permanen.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn btn-o text-xs py-2 px-3"
                onClick={() => setHapusItem(null)}
                disabled={loadingHapus}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-d text-xs font-bold py-2 px-4 flex items-center gap-1.5"
                onClick={handleHapusSK}
                disabled={loadingHapus}
              >
                <span>🗑️</span>
                <span>{loadingHapus ? 'Menghapus…' : 'Ya, Hapus Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEMBUATAN SURAT DINAS / SURAT KELUAR RESMI OLEH LURAH / PETUGAS */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="card w-full max-w-xl border border-slate-200">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Icon name="file" className="w-4 h-4 text-brand-600" />
                  <span>Buat Surat Dinas / Surat Keluar Resmi</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Diterbitkan dengan KOP resmi Kelurahan Suka Maju & disahkan oleh Lurah
                </p>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBuatSurat} className="space-y-3.5">
              <Field l="Tujuan / Penerima Surat Dinas" req hint="Contoh: Seluruh Kepling se-Kelurahan Suka Maju / Camat Medan Johor / Tokoh Masyarakat">
                <input
                  className="inp text-xs"
                  required
                  placeholder="Nama instansi, pejabat, atau kelompok masyarakat penerima..."
                  value={f.tujuan}
                  onChange={(e) => setF({ ...f, tujuan: e.target.value })}
                />
              </Field>

              <Field l="Perihal Surat Dinas" req hint="Contoh: Undangan Rapat Koordinasi Wilayah / Surat Edaran Kebersihan / Surat Pemberitahuan Pelayanan">
                <input
                  className="inp text-xs"
                  required
                  placeholder="Hal / judul pokok surat dinas..."
                  value={f.perihal}
                  onChange={(e) => setF({ ...f, perihal: e.target.value })}
                />
              </Field>

              <Field l="Isi Redaksi Naskah Surat Dinas Resmi" req hint="Tuliskan isi kalimat instruksi, pengumuman, atau keterangan resmi secara lengkap">
                <textarea
                  className="inp text-xs font-serif leading-relaxed"
                  rows={6}
                  required
                  placeholder="Sehubungan dengan rencana pelaksanaan kegiatan gotong royong dan kebersihan lingkungan di wilayah Kelurahan Suka Maju, bersama ini kami sampaikan kepada seluruh warga..."
                  value={f.isi_surat}
                  onChange={(e) => setF({ ...f, isi_surat: e.target.value })}
                />
              </Field>

              <div className="rounded-lg bg-blue-50 border border-blue-200/80 p-3 text-[11px] text-blue-900 leading-relaxed">
                <b>Pengesahan Otomatis:</b> Dokumen fisik PDF akan otomatis dibubuhi KOP Resmi Pemerintah Kota Medan & Kelurahan Suka Maju, Nomor Registrasi Agenda Keluar, serta blok tanda tangan resmi Lurah Suka Maju.
              </div>

              <Msg m={m} />

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  className="btn btn-o text-xs"
                  onClick={() => setShowModal(false)}
                >
                  Batal
                </button>
                <button
                  className="btn btn-p text-xs font-bold py-2.5 px-4"
                  disabled={loading}
                >
                  {loading ? 'Menerbitkan Dokumen PDF…' : '✓ Terbitkan & Tandatangani Surat Dinas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Arsip() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [rows, load] = useGet('/arsip?q=' + encodeURIComponent(q));
  const [activePrint, setActivePrint] = useState(null);
  const [loadingPrint, setLoadingPrint] = useState(false);

  const handleOpenPrint = async (pengajuanId) => {
    try {
      setLoadingPrint(true);
      const res = await api.get(`/pengajuan/${pengajuanId}`);
      setActivePrint(res.data);
    } catch (e) {
      alert('Gagal memuat dokumen untuk dicetak: ' + em(e));
    } finally {
      setLoadingPrint(false);
    }
  };

  const handleHapusArsip = async (pengajuanId, nomor) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus arsip surat nomor ${nomor}?`)) return;
    try {
      await api.delete(`/arsip/${pengajuanId}`);
      load();
    } catch (err) {
      alert('Gagal menghapus arsip: ' + em(err));
    }
  };

  return (
    <Card
      title="Arsip Surat Kelurahan"
      subtitle="Daftar surat resmi yang telah disetujui dan diterbitkan"
      rightAction={
        <input
          className="inp text-xs py-1 max-w-xs"
          placeholder="Cari nomor, pemohon, jenis surat..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      }
    >
      <Table
        head={['Nomor Surat', 'Jenis Dokumen', 'Pemohon', 'Tanggal Terbit', 'Aksi']}
        rows={(rows || []).map((r) => [
          <b key="no" className="text-slate-900 font-bold text-xs">{r.nomor}</b>,
          r.jenis,
          r.pemohon,
          tg(r.terbit_at),
          <div key="act" className="flex items-center gap-1.5">
            <button
              type="button"
              className="btn btn-p py-1 px-2.5 text-xs font-semibold flex items-center gap-1 shadow-xs"
              onClick={() => handleOpenPrint(r.pengajuan_id)}
              disabled={loadingPrint}
            >
              <span>🖨️</span>
              <span>Cetak</span>
            </button>
            <button
              type="button"
              className="btn btn-o py-1 px-2.5 text-xs font-medium"
              onClick={() => downloadPdf(`/pengajuan/${r.pengajuan_id}/surat`, `Surat-${r.nomor.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`)}
            >
              Unduh PDF
            </button>
            {['petugas', 'lurah'].includes(user?.role) && (
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                title="Hapus Arsip Surat"
                onClick={() => handleHapusArsip(r.pengajuan_id, r.nomor)}
              >
                🗑️
              </button>
            )}
          </div>,
        ])}
      />
      {activePrint && <ModalCetakSurat data={activePrint} onClose={() => setActivePrint(null)} onUpdated={load} userRole={user?.role} />}
    </Card>
  );
}

function Profil() {
  const { logout } = useAuth();
  const [me] = useGet('/me');
  const [f, setF] = useState(null);
  const [m, setM] = useState();
  const [sig, setSig] = useState(null);
  const [sigMsg, setSigMsg] = useState(null);
  const [savingSig, setSavingSig] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (me && me.nama && !f) setF({ ...me });
  }, [me, f]);

  useEffect(() => {
    api.get('/users/signature')
      .then((res) => {
        if (res.data?.tanda_tangan) setSig(res.data.tanda_tangan);
      })
      .catch(() => {});
  }, []);

  if (!f) return <p className="text-sm text-slate-500 py-8 text-center">Memuat profil…</p>;
  const isWarga = f.role === 'warga';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    try {
      if (isWarga) {
        await api.put('/profil', f);
      }
      setM({ ok: 1, t: 'Profil berhasil diperbarui.' });
    } catch (x) {
      setM({ t: em(x) });
    }
  };

  const handleSaveSignature = async () => {
    if (!sig) {
      setSigMsg({ t: 'Silakan goreskan tanda tangan Anda terlebih dahulu.' });
      return;
    }
    setSavingSig(true);
    setSigMsg(null);
    try {
      await api.post('/users/signature', { tanda_tangan: sig });
      setSigMsg({ ok: 1, t: 'Tanda tangan digital Anda berhasil disimpan dan siap dibubuhkan pada dokumen resmi!' });
    } catch (err) {
      setSigMsg({ t: em(err) });
    } finally {
      setSavingSig(false);
    }
  };

  const handleHapusAkunSendiri = async (e) => {
    e.preventDefault();
    if (!deletePassword) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete('/profil', { data: { password: deletePassword } });
      alert('Akun Anda telah berhasil dihapus secara permanen dari sistem SIPESUR.');
      logout();
      window.location.href = '/';
    } catch (err) {
      setDeleteError(em(err));
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title={isWarga ? 'Profil Kependudukan Saya' : 'Profil Akun Kedinasan'}
        subtitle={isWarga ? 'Periksa dan perbarui data profil Anda' : 'Informasi identitas akun dan penugasan'}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3.5 text-xs border border-slate-200 space-y-1.5">
            {isWarga ? (
              <>
                <p><span className="text-slate-400">NIK (Tersensor):</span> <b>{f.nik_masked || maskId(f.nik)}</b></p>
                <p><span className="text-slate-400">No. KK (Tersensor):</span> <b>{f.no_kk_masked || maskId(f.no_kk)}</b></p>
                <p><span className="text-slate-400">Status Akun:</span> <BadgeWarga s={f.status_verifikasi} /></p>
              </>
            ) : (
              <>
                <p><span className="text-slate-500">Peran Sistem:</span> <b className="capitalize text-brand-900">{f.role}</b></p>
                <p><span className="text-slate-500">NIP / Username:</span> <b className="font-mono">{f.nip || f.username}</b></p>
                <p><span className="text-slate-500">Jabatan:</span> <b>{f.jabatan || 'Aparatur Kelurahan'}</b></p>
              </>
            )}
          </div>

          <Field l="Nama Lengkap" req={isWarga}>
            <input className="inp" required={isWarga} disabled={!isWarga} value={f.nama || ''} onChange={set('nama')} />
          </Field>

          {isWarga ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field l="Tempat Lahir">
                  <input className="inp" value={f.tempat_lahir || ''} onChange={set('tempat_lahir')} />
                </Field>
                <Field l="Tanggal Lahir">
                  <input
                    className="inp"
                    type="date"
                    value={(f.tanggal_lahir || '').slice(0, 10)}
                    onChange={set('tanggal_lahir')}
                  />
                </Field>
              </div>

              <Field l="Alamat Lengkap" req>
                <textarea className="inp" rows={2} required value={f.alamat || ''} onChange={set('alamat')} />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field l="Pekerjaan">
                  <input className="inp" value={f.pekerjaan || ''} onChange={set('pekerjaan')} />
                </Field>
                <Field l="Nomor HP / WhatsApp">
                  <input className="inp" value={f.telepon || ''} onChange={set('telepon')} />
                </Field>
              </div>

              <Msg m={m} />
              <button className="btn btn-p">Simpan Perubahan Profil</button>
            </>
          ) : (
            <div className="text-xs text-slate-500 italic">
              Data kedinasan dikelola oleh Administrator Sistem. Untuk perubahan NIP atau Jabatan, hubungi Admin.
            </div>
          )}
        </form>
      </Card>

      {/* SECTION TANDA TANGAN DIGITAL UNTUK LURAH & PETUGAS (BUKAN ADMIN IT) */}
      {!isWarga && f.role !== 'admin' && (
        <Card
          title={f.role === 'lurah' ? 'Spesimen Tanda Tangan Elektronik Lurah' : 'Paraf / Tanda Tangan Digital Petugas'}
          subtitle={
            f.role === 'lurah'
              ? 'Tanda tangan resmi ini akan dibubuhkan otomatis saat Lurah menyetujui surat warga atau menerbitkan surat dinas resmi'
              : 'Spesimen paraf digital petugas administrasi loket Kelurahan Suka Maju'
          }
        >
          <div className="space-y-4">
            <SignaturePad
              value={sig}
              onChange={setSig}
              label={`Goreskan Spesimen Tanda Tangan (${f.nama}):`}
              height={140}
            />

            <Msg m={sigMsg} />

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleSaveSignature}
                disabled={savingSig}
                className="btn btn-p py-2 px-5 font-bold text-xs"
              >
                {savingSig ? 'Menyimpan Tanda Tangan…' : '💾 Simpan Tanda Tangan Digital Saya'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {f.role === 'admin' && (
        <Card title="Wewenang Akun IT Administrator" subtitle="Pemisahan tugas keamanan (Segregation of Duties)">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed">
            <strong>🛡️ Fokus Peran IT Kelurahan:</strong> Akun IT Administrator mengelola manajemen pengguna, konfigurasi master formulir surat, identitas web portal, serta audit keamanan sistem. Sesuai tata kelola pemerintahan, pengesahan dan penandatanganan surat dinas merupakan kewenangan eksklusif <strong>Lurah</strong>.
          </div>
        </Card>
      )}

      {/* SECTION HAPUS AKUN SENDIRI (MANDIRI) */}
      <Card
        title="⚠️ Hapus Akun Saya"
        subtitle="Kelola kepemilikan dan penghapusan akun Anda secara mandiri"
      >
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-rose-950">Penghapusan Akun Permanen</h4>
              <p className="text-xs text-rose-800 leading-relaxed max-w-xl">
                Setelah akun Anda dihapus, semua data profil kependudukan, seluruh riwayat pengajuan surat, berkas persyaratan, dan notifikasi Anda akan dihapus secara permanen dari basis data kelurahan. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(true);
                setDeletePassword('');
                setDeleteError(null);
              }}
              className="px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-sm transition whitespace-nowrap flex items-center gap-1.5"
            >
              🗑️ Hapus Akun Saya
            </button>
          </div>
        </div>
      </Card>

      {/* MODAL KONFIRMASI HAPUS AKUN MANDIRI */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-rose-100">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-2xl font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Konfirmasi Hapus Akun</h3>
                <p className="text-xs text-slate-500">Tindakan ini permanen & tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              Apakah Anda benar-benar yakin ingin menghapus akun <b>{f.nama}</b> ({f.username || f.email})? Seluruh data identitas kependudukan, permohonan surat, dan berkas Anda akan dimusnahkan dari server.
            </p>

            <form onSubmit={handleHapusAkunSendiri} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Masukkan Kata Sandi Anda untuk Konfirmasi:
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Kata sandi akun Anda saat ini"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="inp text-sm"
                />
              </div>

              {deleteError && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletePassword('');
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={deleting || !deletePassword}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  {deleting ? 'Menghapus Akun…' : 'Ya, Hapus Akun Permanen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Notifikasi() {
  const [n, load] = useGet('/notifikasi');
  const [loading, setLoading] = useState(false);

  const tandaiDibaca = async () => {
    try {
      await api.post('/notifikasi/baca');
      load();
    } catch (e) {
      alert(em(e));
    }
  };

  const hapusSatu = async (id) => {
    try {
      await api.delete(`/notifikasi/${id}`);
      load();
    } catch (e) {
      alert(em(e));
    }
  };

  const bersihkanSemua = async () => {
    if (!window.confirm('Yakin ingin menghapus seluruh riwayat notifikasi?')) return;
    setLoading(true);
    try {
      await api.delete('/notifikasi');
      load();
    } catch (e) {
      alert(em(e));
    } finally {
      setLoading(false);
    }
  };

  const list = n || [];
  const adaBelumDibaca = list.some((x) => !x.dibaca);

  return (
    <Card
      title="Pusat Notifikasi & Pemberitahuan"
      subtitle="Riwayat pemberitahuan status verifikasi berkas dan penerbitan surat Anda"
      rightAction={
        list.length > 0 && (
          <div className="flex items-center gap-2">
            {adaBelumDibaca && (
              <button
                type="button"
                className="btn btn-o text-xs py-1.5 px-3"
                onClick={tandaiDibaca}
              >
                Tandai Dibaca
              </button>
            )}
            <button
              type="button"
              className="btn btn-o text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-xs py-1.5 px-3 font-medium transition-colors"
              onClick={bersihkanSemua}
              disabled={loading}
            >
              Bersihkan Semua
            </button>
          </div>
        )
      }
    >
      <ul className="divide-y divide-slate-100 text-xs">
        {list.length ? (
          list.map((x) => (
            <li
              key={x.id}
              className={`py-3 px-3 rounded-xl transition-colors flex items-start justify-between gap-3 group ${
                x.dibaca ? 'text-slate-600 hover:bg-slate-50/70' : 'font-semibold text-slate-900 bg-blue-50/40 hover:bg-blue-50/70 border border-blue-100/60'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${x.dibaca ? 'bg-slate-300' : 'bg-brand-600'}`} />
                <div className="min-w-0">
                  <p className="leading-snug break-words">{x.pesan}</p>
                  <div className="text-[10px] font-normal text-slate-400 mt-1">{tg(x.created_at)}</div>
                </div>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg opacity-70 group-hover:opacity-100 hover:bg-rose-50 transition-all flex-shrink-0"
                title="Hapus notifikasi ini"
                onClick={() => hapusSatu(x.id)}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </li>
          ))
        ) : (
          <li className="py-8 text-center text-slate-400">
            <div className="flex flex-col items-center justify-center gap-1.5">
              <Icon name="inbox" className="w-8 h-8 text-slate-300" />
              <span className="text-xs font-medium">Tidak ada notifikasi aktif saat ini.</span>
            </div>
          </li>
        )}
      </ul>
    </Card>
  );
}

/**
 * MANAJEMEN PENGGUNA (ADMINISTRATOR)
 * Pendaftaran Akun Pemerintahan (Petugas, Lurah, Admin) dengan password sementara.
 */
function Pengguna() {
  const [u, load] = useGet('/admin/users');
  const [f, setF] = useState({
    nama: '',
    username: '',
    nip: '',
    jabatan: '',
    telepon: '',
    email: '',
    password_sementara: '',
    role: 'petugas',
  });
  const [m, setM] = useState();
  const [konfirmHapus, setKonfirmHapus] = useState(null); // id pengguna yang akan dihapus

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', f);
      setM({ ok: 1, t: `Akun kedinasan ${f.role} (${f.nama}) berhasil dibuat.` });
      setF({
        nama: '',
        username: '',
        nip: '',
        jabatan: '',
        telepon: '',
        email: '',
        password_sementara: '',
        role: 'petugas',
      });
      load();
    } catch (x) {
      setM({ t: em(x) });
    }
  };

  const tog = async (id) => {
    try {
      await api.patch(`/admin/users/${id}/aktif`);
      load();
    } catch (x) {
      setM({ t: em(x) });
    }
  };

  const hapus = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      setKonfirmHapus(null);
      setM({ ok: 1, t: 'Akun pengguna berhasil dihapus dari sistem.' });
      load();
    } catch (x) {
      setKonfirmHapus(null);
      setM({ t: em(x) });
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Tambah Akun Pemerintahan (Kedinasan) — Panel IT Administrator"
        subtitle="Kelola pembagian hak akses pegawai (Petugas Loket, Lurah Pimpinan, atau Staf IT) dengan password sementara."
      >
        <form onSubmit={add} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field l="Nama Lengkap & Gelar" req>
              <input className="inp" required placeholder="Contoh: Siti Rohmah, S.AP" value={f.nama} onChange={set('nama')} />
            </Field>
            <Field l="NIP / Username Kedinasan" req>
              <input className="inp" required placeholder="Contoh: 198505122010012003" value={f.username} onChange={set('username')} />
            </Field>
            <Field l="Peran / Role" req>
              <select className="inp" value={f.role} onChange={set('role')}>
                <option value="petugas">Petugas Pelayanan &amp; Tata Usaha</option>
                <option value="lurah">Lurah (Pimpinan &amp; Penandatangan)</option>
                <option value="admin">IT Administrator Sistem</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field l="Jabatan Resmi">
              <input className="inp" placeholder="Contoh: Petugas Loket" value={f.jabatan} onChange={set('jabatan')} />
            </Field>
            <Field l="Nomor HP Kedinasan">
              <input className="inp" placeholder="081234567890" value={f.telepon} onChange={set('telepon')} />
            </Field>
            <Field l="Email Kedinasan">
              <input className="inp" type="email" placeholder="pegawai@kelurahan.go.id" value={f.email} onChange={set('email')} />
            </Field>
          </div>

          <Field l="Password Sementara (Min. 8 Karakter)" req hint="Pengguna wajib mengganti password saat login perdana.">
            <input
              className="inp"
              type="text"
              required
              minLength={8}
              placeholder="Contoh: SukaMaju2026!"
              value={f.password_sementara}
              onChange={set('password_sementara')}
            />
          </Field>

          <Msg m={m} />

          <button className="btn btn-p font-bold">Buat Akun Kedinasan →</button>
        </form>
      </Card>

      {/* Modal konfirmasi hapus */}
      {konfirmHapus && (() => {
        const target = (u || []).find(x => x.id === konfirmHapus);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setKonfirmHapus(null)}>
            <div className="bg-white rounded-2xl shadow-xl border-2 border-rose-200 p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
              <div className="text-center space-y-2">
                <div className="text-4xl">⚠️</div>
                <h3 className="font-bold text-rose-900 text-lg">Hapus Akun Pengguna</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Akun <strong>{target?.nama}</strong> ({target?.role}) akan dihapus permanen dari sistem. Semua data terkait akun ini ikut terhapus.
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setKonfirmHapus(null)} className="btn btn-o flex-1 font-semibold">Batal</button>
                <button type="button" onClick={() => hapus(konfirmHapus)} className="btn btn-d flex-1 font-bold">🗑️ Ya, Hapus</button>
              </div>
            </div>
          </div>
        );
      })()}

      <Card title="Daftar Pengguna Sistem SIPESUR">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                {['Nama', 'Username / NIP', 'Jabatan', 'Role', 'Status', 'Aksi'].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider py-2.5 px-3 first:pl-0 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(u || []).map((x) => (
                <tr key={x.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="py-3 px-3 pl-0 font-semibold text-slate-900 text-sm">{x.nama}</td>
                  <td className="py-3 px-3"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{x.username || x.email}</code></td>
                  <td className="py-3 px-3 text-xs text-slate-600">{x.jabatan || x.nip || '-'}</td>
                  <td className="py-3 px-3">
                    <span className={`badge text-[11px] font-bold capitalize ${
                      x.role === 'admin' ? 'bg-violet-100 text-violet-900 border-violet-200' :
                      x.role === 'lurah' ? 'bg-indigo-100 text-indigo-900 border-indigo-200' :
                      x.role === 'petugas' ? 'bg-sky-100 text-sky-900 border-sky-200' :
                      'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>{x.role}</span>
                  </td>
                  <td className="py-3 px-3">
                    {x.aktif
                      ? <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">✓ Aktif</span>
                      : <span className="badge bg-rose-50 text-rose-700 border-rose-200 text-[11px]">✗ Nonaktif</span>}
                  </td>
                  <td className="py-3 px-3 pr-0">
                    <div className="flex items-center gap-2">
                      <button
                        className={`btn text-[11px] py-1 px-2.5 font-semibold ${x.aktif ? 'btn-o text-slate-700' : 'btn-success'}`}
                        onClick={() => tog(x.id)}
                        title={x.aktif ? 'Nonaktifkan akun ini' : 'Aktifkan kembali akun ini'}
                      >
                        {x.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button
                        className="btn text-[11px] py-1 px-2.5 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50 hover:border-rose-400 transition-colors"
                        onClick={() => setKonfirmHapus(x.id)}
                        title="Hapus akun permanen"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!(u || []).length && (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-slate-400">Belum ada pengguna terdaftar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Jenis() {
  const [js, load] = useGet('/jenis-surat');
  const [f, setF] = useState({ kode: '', nama: '', template: '', fields: '' });
  const [ps, setPs] = useState({});
  const [m, setM] = useState();
  const [editTplId, setEditTplId] = useState(null);
  const [tplText, setTplText] = useState('');
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [konfirmHapusJenis, setKonfirmHapusJenis] = useState(null);

  const call = async (fn) => {
    try {
      await fn();
      setM(null);
      load();
    } catch (x) {
      setM({ t: em(x) });
    }
  };

  const simpanTemplate = async (id) => {
    setLoadingTpl(true);
    try {
      await api.put(`/admin/jenis-surat/${id}/template`, { template: tplText });
      setEditTplId(null);
      setM({ ok: 1, t: 'Template naskah dinas resmi berhasil disimpan ke database.' });
      load();
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoadingTpl(false);
    }
  };

  const hapusJenis = async (id) => {
    try {
      await api.delete(`/admin/jenis-surat/${id}`);
      setKonfirmHapusJenis(null);
      setM({ ok: 1, t: 'Jenis surat berhasil dihapus.' });
      load();
    } catch (x) {
      setKonfirmHapusJenis(null);
      setM({ t: em(x) });
    }
  };

  const targetHapus = konfirmHapusJenis ? (js || []).find(j => j.id === konfirmHapusJenis) : null;

  return (
    <div className="space-y-4">
      {/* Modal konfirmasi hapus jenis */}
      {konfirmHapusJenis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setKonfirmHapusJenis(null)}>
          <div className="bg-white rounded-2xl shadow-xl border-2 border-rose-200 p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="text-4xl">⚠️</div>
              <h3 className="font-bold text-rose-900 text-lg">Hapus Jenis Surat</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Jenis surat <strong>{targetHapus?.nama} ({targetHapus?.kode})</strong> beserta semua persyaratannya akan dihapus permanen. Pastikan tidak ada pengajuan aktif.
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setKonfirmHapusJenis(null)} className="btn btn-o flex-1 font-semibold">Batal</button>
              <button type="button" onClick={() => hapusJenis(konfirmHapusJenis)} className="btn btn-d flex-1 font-bold">🗑️ Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      <Card
        title="Master Template & Tata Naskah Jenis Surat"
        subtitle="Kelola klausul template resmi, kolom formulir, dan persyaratan dokumen untuk setiap jenis surat kelurahan"
      >
        <div className="rounded-xl bg-brand-50 border border-brand-200 p-3.5 text-xs text-brand-900 mb-4">
          <b>ℹ️ Sumber Template Surat Kelurahan:</b>
          <p className="mt-1 leading-relaxed text-brand-800">
            Setiap jenis surat di bawah ini memiliki kalimat template resmi yang tersimpan di basis data kelurahan.
            Saat warga mengajukan surat dan disetujui Lurah, sistem secara otomatis menggabungkan template ini dengan identitas kependudukan pemohon serta membubuhkan QR Code Tanda Tangan Elektronik (TTE) Lurah.
          </p>
        </div>

        <form
          className="grid gap-3 border-2 border-dashed border-brand-200 p-4 rounded-xl bg-brand-50/30"
          onSubmit={(e) => {
            e.preventDefault();
            call(async () => {
              await api.post('/admin/jenis-surat', f);
              setF({ kode: '', nama: '', template: '', fields: '' });
              setM({ ok: 1, t: 'Jenis surat baru berhasil ditambahkan.' });
            });
          }}
        >
          <div className="text-xs font-bold text-brand-900 flex items-center gap-2">➕ Tambah Jenis Surat Baru</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="inp text-xs" placeholder="Kode Surat (misal: SKD)" required value={f.kode} onChange={(e) => setF({ ...f, kode: e.target.value })} />
            <input className="inp text-xs" placeholder="Nama Surat (misal: Surat Keterangan Domisili)" required value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} />
          </div>
          <textarea
            className="inp text-xs"
            rows={2}
            placeholder="Template klausul naskah surat (contoh: adalah benar warga yang bertempat tinggal di wilayah Kelurahan Suka Maju...)"
            value={f.template}
            onChange={(e) => setF({ ...f, template: e.target.value })}
          />
          <input
            className="inp text-xs"
            placeholder="Field formulir tambahan (format: key:Label|key2:Label2, misal: keperluan:Keperluan Surat|nama_usaha:Nama Usaha)"
            required
            value={f.fields}
            onChange={(e) => setF({ ...f, fields: e.target.value })}
          />
          <div>
            <button className="btn btn-p text-xs font-bold py-2 px-4">Tambah Master Jenis Surat</button>
          </div>
        </form>

        <div className="mt-3">
          <Msg m={m} />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {(js || []).map((j) => (
          <Card key={j.id} title={
            <span className="flex items-center gap-2">
              <span className={`badge text-[11px] ${j.aktif ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {j.aktif ? 'Aktif' : 'Nonaktif'}
              </span>
              {j.nama} <span className="text-slate-400 font-normal text-xs">({j.kode})</span>
            </span>
          } rightAction={
            <div className="flex items-center gap-1.5">
              <button
                className={`btn text-[11px] py-1 px-2.5 font-semibold ${j.aktif ? 'btn-o text-slate-700' : 'btn-success'}`}
                onClick={() => call(() => api.patch(`/admin/jenis-surat/${j.id}/aktif`))}
              >
                {j.aktif ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button
                className="btn text-[11px] py-1 px-2.5 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50 hover:border-rose-400 transition-colors"
                onClick={() => setKonfirmHapusJenis(j.id)}
                title="Hapus jenis surat ini"
              >
                🗑️
              </button>
            </div>
          }>
            {/* Box Klausul Template Naskah */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs mb-3 space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 font-semibold text-[11px]">
                <span>📝 Template Naskah Surat:</span>
                <button
                  type="button"
                  className="text-brand-700 font-bold hover:underline"
                  onClick={() => {
                    if (editTplId === j.id) {
                      setEditTplId(null);
                    } else {
                      setEditTplId(j.id);
                      setTplText(j.template || '');
                    }
                  }}
                >
                  {editTplId === j.id ? 'Batal Ubah' : '✏️ Ubah template'}
                </button>
              </div>

              {editTplId === j.id ? (
                <div className="pt-1.5 space-y-2">
                  <textarea
                    className="inp text-xs"
                    rows={3}
                    value={tplText}
                    onChange={(e) => setTplText(e.target.value)}
                    placeholder="Tuliskan klausul resmi naskah surat..."
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn btn-o text-[11px] py-1 px-2"
                      onClick={() => setEditTplId(null)}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn btn-p text-[11px] py-1 px-3 font-bold"
                      disabled={loadingTpl}
                      onClick={() => simpanTemplate(j.id)}
                    >
                      {loadingTpl ? 'Menyimpan…' : 'Simpan Template'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-700 italic bg-white p-2 rounded border border-slate-200/70 text-[11px] leading-relaxed">
                  &ldquo;{j.template || 'Belum diatur (menggunakan template default sistem).'}&rdquo;
                </p>
              )}
            </div>

            {/* Persyaratan Berkas */}
            <div className="text-xs mb-2 font-semibold text-slate-600">📋 Dokumen Persyaratan:</div>
            <ul className="mb-3 text-xs space-y-1">
              {(j.persyaratan || []).map((p) => (
                <li key={p.id} className="flex justify-between items-center border-b border-slate-100 py-1.5 group">
                  <span className="text-slate-700">• {p.nama}</span>
                  <button
                    className="text-rose-600 font-semibold text-[11px] hover:underline opacity-70 group-hover:opacity-100 transition-opacity"
                    onClick={() => call(() => api.delete('/admin/persyaratan/' + p.id))}
                  >
                    🗑️ Hapus
                  </button>
                </li>
              ))}
              {!(j.persyaratan || []).length && (
                <li className="text-[11px] text-slate-400 italic py-1">Belum ada persyaratan dokumen khusus.</li>
              )}
            </ul>
            <div className="flex gap-2">
              <input
                className="inp text-xs flex-1"
                placeholder="Nama berkas persyaratan (contoh: KTP / KK)"
                value={ps[j.id] || ''}
                onChange={(e) => setPs({ ...ps, [j.id]: e.target.value })}
              />
              <button
                className="btn btn-p text-xs py-1.5 px-3 flex-shrink-0"
                onClick={() =>
                  call(async () => {
                    await api.post('/admin/persyaratan', { jenis_surat_id: j.id, nama: ps[j.id] });
                    setPs({ ...ps, [j.id]: '' });
                  })
                }
              >
                + Tambah
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Log() {
  const [l, load] = useGet('/admin/logs');
  const [q, setQ] = useState('');

  const badgeClass = (aksi = '') => {
    if (/HAPUS|TOLAK|DITOLAK/.test(aksi)) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (/TERBIT|SETUJU|VERIFIKASI_WARGA_TERVERIFIKASI|LENGKAP/.test(aksi)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (/LOGIN/.test(aksi)) return 'bg-violet-50 text-violet-700 border-violet-200';
    return 'bg-sky-50 text-sky-700 border-sky-200';
  };

  const filtered = (l || []).filter((x) => {
    if (!q.trim()) return true;
    const term = q.toLowerCase();
    return (
      (x.aksi || '').toLowerCase().includes(term) ||
      (x.nama || '').toLowerCase().includes(term) ||
      (x.detail || '').toLowerCase().includes(term) ||
      (x.ip || '').toLowerCase().includes(term)
    );
  });

  return (
    <Card
      title="Audit Log & Keamanan Sistem"
      subtitle="Pemantauan jejak autentikasi, verifikasi kependudukan, dan aktivitas persuratan secara real-time"
      rightAction={
        <div className="flex items-center gap-2">
          <input
            className="inp text-xs py-1.5 max-w-xs"
            placeholder="Cari aktivitas, user, atau IP..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" onClick={load} className="btn btn-o text-xs py-1.5 px-3 font-semibold">
            🔄 Refresh
          </button>
        </div>
      }
    >
      <Table
        head={['Waktu', 'Pengguna', 'Aktivitas', 'Detail', 'IP Address']}
        rows={filtered.map((x) => [
          tg(x.created_at),
          <span key="n" className="font-semibold text-slate-800">{x.nama || 'Sistem / Tamu'}</span>,
          <span key="a" className={`badge text-[11px] font-bold ${badgeClass(x.aksi)}`}>{x.aksi}</span>,
          x.detail || '-',
          <code key="ip" className="text-[11px] text-slate-500 font-mono">{x.ip || '-'}</code>,
        ])}
      />
    </Card>
  );
}

function ProfilDesaWrapper() {
  const { user } = useAuth();
  return <ProfilDesa userRole={user?.role} />;
}

/* ====================================================================
   1. MANAJEMEN BERITA & PENGUMUMAN (ADMIN / PETUGAS / LURAH)
   ==================================================================== */
function BeritaKelurahan() {
  const { user } = useAuth();
  const canManage = ['petugas', 'lurah'].includes(user?.role);
  const [list, load] = useGet('/berita');
  const [f, setF] = useState({
    judul: '',
    isi: '',
    kategori: 'Pengumuman',
    tanggal: new Date().toISOString().split('T')[0],
  });
  const [editId, setEditId] = useState(null);
  const [hapusId, setHapusId] = useState(null);
  const [bacaModal, setBacaModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [m, setM] = useState(null);
  const [katFilter, setKatFilter] = useState('Semua');
  const [qSearch, setQSearch] = useState('');

  const call = async (fn) => {
    try {
      setLoading(true);
      await fn();
      setM(null);
      load();
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoading(false);
    }
  };

  const simpan = (e) => {
    e.preventDefault();
    if (!f.judul.trim()) return setM({ t: 'Judul berita wajib diisi.' });
    if (!f.isi.trim()) return setM({ t: 'Isi berita wajib diisi.' });

    call(async () => {
      if (editId) {
        await api.put(`/berita/${editId}`, f);
        setEditId(null);
        setM({ ok: 1, t: 'Berita berhasil diperbarui dan langsung tampil di portal warga!' });
      } else {
        await api.post('/berita', f);
        setM({ ok: 1, t: 'Berita baru berhasil diterbitkan dan langsung tampil di beranda!' });
      }
      setF({ judul: '', isi: '', kategori: 'Pengumuman', tanggal: new Date().toISOString().split('T')[0] });
    });
  };

  const mulaiEdit = (b) => {
    setEditId(b.id);
    setF({
      judul: b.judul,
      isi: b.isi,
      kategori: b.kategori || 'Pengumuman',
      tanggal: b.tanggal ? b.tanggal.split('T')[0] : new Date().toISOString().split('T')[0],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const batalEdit = () => {
    setEditId(null);
    setF({ judul: '', isi: '', kategori: 'Pengumuman', tanggal: new Date().toISOString().split('T')[0] });
  };

  const hapus = async (id) => {
    call(async () => {
      await api.delete(`/berita/${id}`);
      setHapusId(null);
      setM({ ok: 1, t: 'Berita berhasil dihapus permanen.' });
    });
  };

  const filtered = (list || []).filter((b) => {
    const matchKat = katFilter === 'Semua' || b.kategori === katFilter;
    const matchQ = !qSearch.trim() ||
      (b.judul || '').toLowerCase().includes(qSearch.toLowerCase()) ||
      (b.isi || '').toLowerCase().includes(qSearch.toLowerCase());
    return matchKat && matchQ;
  });
  const targetHapus = hapusId ? (list || []).find((b) => b.id === hapusId) : null;

  return (
    <div className="space-y-6">
      {/* Modal Baca Pengumuman Lengkap untuk Warga & Petugas */}
      {bacaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setBacaModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-lg w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <span className="badge text-xs bg-blue-50 text-blue-800 border-blue-200 font-bold">
                {bacaModal.kategori || 'Pengumuman'}
              </span>
              <span className="text-xs text-slate-400">
                {bacaModal.tanggal ? new Date(bacaModal.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg leading-snug">{bacaModal.judul}</h3>
              <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{bacaModal.isi}</p>
            </div>
            <div className="pt-3 border-t text-right">
              <button type="button" onClick={() => setBacaModal(null)} className="btn btn-p text-xs py-1.5 px-4 font-bold">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal konfirmasi hapus berita */}
      {hapusId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setHapusId(null)}>
          <div className="bg-white rounded-2xl shadow-xl border-2 border-rose-200 p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="text-4xl">🗑️</div>
              <h3 className="font-bold text-rose-900 text-lg">Hapus Berita Ini?</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Berita <strong>"{targetHapus?.judul}"</strong> akan dihapus permanen dari basis data dan portal warga.
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setHapusId(null)} className="btn btn-o flex-1 font-semibold">Batal</button>
              <button type="button" onClick={() => hapus(hapusId)} className="btn btn-d flex-1 font-bold">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      {canManage && (
        <Card
          title={editId ? "✏️ Perbarui Berita / Pengumuman" : "📰 Terbitkan Berita & Pengumuman Baru"}
          subtitle="Berita yang dikelola di sini langsung tampil secara dinamis pada halaman Beranda portal publik warga"
        >
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3.5 text-xs text-blue-900 mb-4">
            <strong>ℹ️ Hak Akses Konten:</strong> Hanya Petugas Pelayanan dan Lurah yang dapat menerbitkan atau memperbarui berita kelurahan. Warga memiliki hak akses baca.
          </div>

          <form onSubmit={simpan} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Judul Berita / Pengumuman *</label>
                <input
                  className="inp text-sm"
                  required
                  placeholder="Contoh: Jadwal Pelayanan Khusus Akhir Pekan Kelurahan"
                  value={f.judul}
                  onChange={(e) => setF({ ...f, judul: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Kategori *</label>
                <select
                  className="inp text-sm"
                  value={f.kategori}
                  onChange={(e) => setF({ ...f, kategori: e.target.value })}
                >
                  <option value="Pengumuman">📢 Pengumuman</option>
                  <option value="Info Layanan">ℹ️ Info Layanan</option>
                  <option value="Himbauan">⚠️ Himbauan</option>
                  <option value="Kegiatan">🎉 Kegiatan</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tanggal Terbit</label>
                <input
                  type="date"
                  className="inp text-sm"
                  value={f.tanggal}
                  onChange={(e) => setF({ ...f, tanggal: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Isi Lengkap Berita / Uraian Pengumuman *</label>
              <textarea
                rows={4}
                className="inp text-sm"
                required
                placeholder="Tuliskan isi berita, pengumuman, atau instruksi resmi untuk warga..."
                value={f.isi}
                onChange={(e) => setF({ ...f, isi: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={loading} className="btn btn-p text-sm font-bold py-2 px-5">
                {loading ? 'Menyimpan...' : editId ? '💾 Simpan Perubahan' : '🚀 Terbitkan Berita'}
              </button>
              {editId && (
                <button type="button" onClick={batalEdit} className="btn btn-o text-sm py-2 px-4">
                  Batal Edit
                </button>
              )}
            </div>
          </form>

          <div className="mt-4">
            <Msg m={m} />
          </div>
        </Card>
      )}

      {/* Daftar Berita Terbit */}
      <Card
        title={`Daftar Berita & Pengumuman (${filtered.length})`}
        subtitle="Kelola dan pantau seluruh artikel pengumuman yang aktif di portal warga"
        rightAction={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Cari pengumuman..."
              value={qSearch}
              onChange={(e) => setQSearch(e.target.value)}
              className="inp text-xs py-1 px-2.5 w-40"
            />
            {['Semua', 'Pengumuman', 'Info Layanan', 'Himbauan', 'Kegiatan'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKatFilter(k)}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors ${
                  katFilter === k ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">Belum ada berita dalam kategori ini.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((b) => (
              <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="badge text-[11px] bg-blue-50 text-blue-800 border-blue-200">
                      {b.kategori || 'Pengumuman'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {b.tanggal ? new Date(b.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1.5 leading-snug">{b.judul}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-3">{b.isi}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setBacaModal(b)}
                    className="text-xs font-bold text-brand-700 hover:underline"
                  >
                    Baca Selengkapnya →
                  </button>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => mulaiEdit(b)}
                        className="btn btn-o text-xs py-1 px-3 font-semibold text-slate-700"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setHapusId(b.id)}
                        className="btn text-xs py-1 px-3 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ====================================================================
   2. MANAJEMEN DIREKTORI UMKM (ADMIN / PETUGAS / LURAH)
   ==================================================================== */
function UmkmKelurahan() {
  const [list, load] = useGet('/umkm');
  const [f, setF] = useState({
    nama: '',
    jenis: 'Kuliner',
    alamat: '',
    telepon: '',
    deskripsi: '',
  });
  const [editId, setEditId] = useState(null);
  const [hapusId, setHapusId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [m, setM] = useState(null);
  const [qSearch, setQSearch] = useState('');

  const call = async (fn) => {
    try {
      setLoading(true);
      await fn();
      setM(null);
      load();
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoading(false);
    }
  };

  const simpan = (e) => {
    e.preventDefault();
    if (!f.nama.trim()) return setM({ t: 'Nama UMKM wajib diisi.' });

    call(async () => {
      if (editId) {
        await api.put(`/umkm/${editId}`, f);
        setEditId(null);
        setM({ ok: 1, t: 'Data UMKM berhasil diperbarui dan tampil di portal warga!' });
      } else {
        await api.post('/umkm', f);
        setM({ ok: 1, t: 'UMKM baru berhasil didaftarkan ke direktori portal warga!' });
      }
      setF({ nama: '', jenis: 'Kuliner', alamat: '', telepon: '', deskripsi: '' });
    });
  };

  const mulaiEdit = (u) => {
    setEditId(u.id);
    setF({
      nama: u.nama,
      jenis: u.jenis || 'Kuliner',
      alamat: u.alamat || '',
      telepon: u.telepon || '',
      deskripsi: u.deskripsi || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const batalEdit = () => {
    setEditId(null);
    setF({ nama: '', jenis: 'Kuliner', alamat: '', telepon: '', deskripsi: '' });
  };

  const hapus = async (id) => {
    call(async () => {
      await api.delete(`/umkm/${id}`);
      setHapusId(null);
      setM({ ok: 1, t: 'UMKM berhasil dihapus dari direktori.' });
    });
  };

  const filtered = (list || []).filter((u) => {
    const qL = qSearch.toLowerCase();
    return (
      !qSearch ||
      String(u.nama || '').toLowerCase().includes(qL) ||
      String(u.jenis || '').toLowerCase().includes(qL) ||
      String(u.alamat || '').toLowerCase().includes(qL)
    );
  });
  const targetHapus = hapusId ? (list || []).find((u) => u.id === hapusId) : null;

  return (
    <div className="space-y-6">
      {/* Modal konfirmasi hapus UMKM */}
      {hapusId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setHapusId(null)}>
          <div className="bg-white rounded-2xl shadow-xl border-2 border-rose-200 p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="text-4xl">🏪</div>
              <h3 className="font-bold text-rose-900 text-lg">Hapus UMKM Ini?</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                UMKM <strong>"{targetHapus?.nama}"</strong> akan dihapus permanen dari direktori portal warga.
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setHapusId(null)} className="btn btn-o flex-1 font-semibold">Batal</button>
              <button type="button" onClick={() => hapus(hapusId)} className="btn btn-d flex-1 font-bold">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      <Card
        title={editId ? "✏️ Perbarui Data UMKM" : "🏪 Daftarkan UMKM Baru"}
        subtitle="Kelola direktori UMKM lokal binaan kelurahan agar dipromosikan langsung di beranda portal"
      >
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 mb-4">
          <strong>ℹ️ Pengelolaan Mandiri & Database:</strong> Data UMKM ini tersimpan di basis data resmi kelurahan dan langsung muncul di segmen direktori beranda.
        </div>

        <form onSubmit={simpan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nama Usaha / Merk Dagang *</label>
              <input
                className="inp text-sm"
                required
                placeholder="Contoh: Warung Makan Bu Tini"
                value={f.nama}
                onChange={(e) => setF({ ...f, nama: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Kategori / Bidang Usaha *</label>
              <select
                className="inp text-sm"
                value={f.jenis}
                onChange={(e) => setF({ ...f, jenis: e.target.value })}
              >
                <option value="Kuliner">🍲 Kuliner & Makanan</option>
                <option value="Material & Konstruksi">🔨 Material & Konstruksi</option>
                <option value="Jasa & Kebersihan">🧺 Jasa & Kebersihan</option>
                <option value="Tekstil & Pakaian">👗 Tekstil & Pakaian</option>
                <option value="Kesehatan & Obat">💊 Kesehatan & Obat</option>
                <option value="Jasa Kreatif">📸 Jasa Kreatif / Studio</option>
                <option value="Pertanian / Perikanan">🌱 Pertanian / Perikanan</option>
                <option value="Perdagangan Umum">🛒 Perdagangan Umum</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Alamat Usaha / Lokasi</label>
              <input
                className="inp text-sm"
                placeholder="Contoh: Jl. STM No. 40 RT 02/03"
                value={f.alamat}
                onChange={(e) => setF({ ...f, alamat: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nomor Kontak / WhatsApp</label>
              <input
                className="inp text-sm"
                placeholder="Contoh: 0812-3456-7890"
                value={f.telepon}
                onChange={(e) => setF({ ...f, telepon: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Deskripsi Produk / Layanan Unggulan</label>
            <textarea
              rows={2}
              className="inp text-sm"
              placeholder="Jelaskan produk atau layanan yang ditawarkan..."
              value={f.deskripsi}
              onChange={(e) => setF({ ...f, deskripsi: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={loading} className="btn btn-p text-sm font-bold py-2 px-5">
              {loading ? 'Menyimpan...' : editId ? '💾 Simpan Perubahan' : '➕ Daftarkan UMKM'}
            </button>
            {editId && (
              <button type="button" onClick={batalEdit} className="btn btn-o text-sm py-2 px-4">
                Batal Edit
              </button>
            )}
          </div>
        </form>

        <div className="mt-4">
          <Msg m={m} />
        </div>
      </Card>

      {/* Daftar UMKM */}
      <Card
        title={`Daftar UMKM Terdaftar (${filtered.length})`}
        subtitle="Direktori aktif yang dipublikasikan di halaman depan kelurahan"
        rightAction={
          <input
            type="text"
            className="inp text-xs py-1.5 px-3 w-48 sm:w-64"
            placeholder="🔍 Cari nama/kategori UMKM..."
            value={qSearch}
            onChange={(e) => setQSearch(e.target.value)}
          />
        }
      >
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">Belum ada UMKM yang cocok dengan pencarian.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((u) => (
              <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="badge text-[11px] bg-amber-50 text-amber-800 border-amber-200 font-semibold">
                      {u.jenis || 'Usaha'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1 leading-snug">{u.nama}</h3>
                  <div className="text-xs text-slate-500 mb-1">📍 {u.alamat || '-'}</div>
                  <div className="text-xs text-slate-600 mb-2">📞 {u.telepon || '-'}</div>
                  {u.deskripsi && <p className="text-xs text-slate-500 italic line-clamp-2">{u.deskripsi}</p>}
                </div>
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-3">
                  <button
                    type="button"
                    onClick={() => mulaiEdit(u)}
                    className="btn btn-o text-xs py-1 px-3 font-semibold text-slate-700"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setHapusId(u.id)}
                    className="btn text-xs py-1 px-3 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50"
                  >
                    🗑️ Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ====================================================================
   3. MANAJEMEN GALERI KEGIATAN WARGA (ADMIN / PETUGAS / LURAH)
   ==================================================================== */
function GaleriKelurahan() {
  const [list, load] = useGet('/galeri');
  const [f, setF] = useState({
    judul: '',
    deskripsi: '',
    url_foto: '',
    tanggal: new Date().toISOString().split('T')[0],
  });
  const [editId, setEditId] = useState(null);
  const [hapusId, setHapusId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [m, setM] = useState(null);

  const call = async (fn) => {
    try {
      setLoading(true);
      await fn();
      setM(null);
      load();
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setF((prev) => ({ ...prev, url_foto: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const simpan = (e) => {
    e.preventDefault();
    if (!f.judul.trim()) return setM({ t: 'Judul kegiatan wajib diisi.' });
    if (!f.url_foto.trim()) return setM({ t: 'Foto kegiatan wajib diunggah atau diisi URL.' });

    call(async () => {
      if (editId) {
        await api.put(`/galeri/${editId}`, f);
        setEditId(null);
        setM({ ok: 1, t: 'Foto kegiatan berhasil diperbarui!' });
      } else {
        await api.post('/galeri', f);
        setM({ ok: 1, t: 'Foto kegiatan baru berhasil ditambahkan ke galeri warga!' });
      }
      setF({ judul: '', deskripsi: '', url_foto: '', tanggal: new Date().toISOString().split('T')[0] });
    });
  };

  const mulaiEdit = (g) => {
    setEditId(g.id);
    setF({
      judul: g.judul,
      deskripsi: g.deskripsi || '',
      url_foto: g.url_foto,
      tanggal: g.tanggal ? g.tanggal.split('T')[0] : new Date().toISOString().split('T')[0],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const batalEdit = () => {
    setEditId(null);
    setF({ judul: '', deskripsi: '', url_foto: '', tanggal: new Date().toISOString().split('T')[0] });
  };

  const hapus = async (id) => {
    call(async () => {
      await api.delete(`/galeri/${id}`);
      setHapusId(null);
      setM({ ok: 1, t: 'Foto kegiatan berhasil dihapus.' });
    });
  };

  const targetHapus = hapusId ? (list || []).find((g) => g.id === hapusId) : null;

  return (
    <div className="space-y-6">
      {/* Modal konfirmasi hapus foto */}
      {hapusId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setHapusId(null)}>
          <div className="bg-white rounded-2xl shadow-xl border-2 border-rose-200 p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="text-4xl">🖼️</div>
              <h3 className="font-bold text-rose-900 text-lg">Hapus Foto Kegiatan Ini?</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Foto kegiatan <strong>"{targetHapus?.judul}"</strong> akan dihapus permanen dari galeri portal kelurahan.
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setHapusId(null)} className="btn btn-o flex-1 font-semibold">Batal</button>
              <button type="button" onClick={() => hapus(hapusId)} className="btn btn-d flex-1 font-bold">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      <Card
        title={editId ? "✏️ Perbarui Foto Kegiatan" : "🖼️ Tambah Dokumentasi Foto Kegiatan Warga"}
        subtitle="Dokumentasi yang Anda unggah langsung tampil di segmen Galeri Kegiatan Beranda Kelurahan"
      >
        <form onSubmit={simpan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nama / Judul Kegiatan *</label>
              <input
                className="inp text-sm"
                required
                placeholder="Contoh: Kerja Bakti Lingkungan RW 01 - RW 08"
                value={f.judul}
                onChange={(e) => setF({ ...f, judul: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Tanggal Kegiatan</label>
              <input
                type="date"
                className="inp text-sm"
                value={f.tanggal}
                onChange={(e) => setF({ ...f, tanggal: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Foto Kegiatan (Unggah Berkas / URL) *</label>
              <div className="flex gap-2">
                <label className="btn btn-o text-xs py-2 px-3 font-semibold cursor-pointer flex-shrink-0">
                  <span>📁 Unggah Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadFoto}
                  />
                </label>
                <input
                  className="inp text-xs flex-1"
                  placeholder="Atau tempel URL gambar (https://...)"
                  value={f.url_foto}
                  onChange={(e) => setF({ ...f, url_foto: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Deskripsi Singkat Kegiatan</label>
              <input
                className="inp text-sm"
                placeholder="Uraian ringkas kegiatan kebersamaan warga..."
                value={f.deskripsi}
                onChange={(e) => setF({ ...f, deskripsi: e.target.value })}
              />
            </div>
          </div>

          {f.url_foto && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-500 block mb-2">Pratinjau Foto:</span>
              <img src={f.url_foto} alt="Preview" className="h-36 object-cover rounded-lg border border-slate-300" />
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={loading} className="btn btn-p text-sm font-bold py-2 px-5">
              {loading ? 'Menyimpan...' : editId ? '💾 Simpan Perubahan' : '➕ Tambahkan ke Galeri'}
            </button>
            {editId && (
              <button type="button" onClick={batalEdit} className="btn btn-o text-sm py-2 px-4">
                Batal Edit
              </button>
            )}
          </div>
        </form>

        <div className="mt-4">
          <Msg m={m} />
        </div>
      </Card>

      {/* Grid Galeri Aktif */}
      <Card
        title={`Dokumentasi Galeri Aktif (${(list || []).length})`}
        subtitle="Semua foto kegiatan yang sedang dipublikasikan di halaman beranda"
      >
        {!(list || []).length ? (
          <div className="text-center py-10 text-slate-400 text-sm">Belum ada foto kegiatan di galeri.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(list || []).map((g) => (
              <div key={g.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
                <div className="h-40 bg-slate-100 overflow-hidden relative">
                  <img src={g.url_foto} alt={g.judul} className="w-full h-full object-cover" />
                  <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-mono">
                    {g.tanggal ? new Date(g.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </span>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1">{g.judul}</h3>
                    {g.deskripsi && <p className="text-xs text-slate-500 line-clamp-2">{g.deskripsi}</p>}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-3">
                    <button
                      type="button"
                      onClick={() => mulaiEdit(g)}
                      className="btn btn-o text-xs py-1 px-3 font-semibold text-slate-700"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setHapusId(g.id)}
                      className="btn text-xs py-1 px-3 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50"
                    >
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ====================================================================
   4. MANAJEMEN TRANSPARANSI ANGGARAN (ADMIN / LURAH / PETUGAS)
   ==================================================================== */
function AnggaranKelurahan() {
  const [list, load] = useGet('/anggaran');
  const [f, setF] = useState({
    tahun: 2026,
    program: '',
    pagu: '',
    realisasi: '',
    sumber: 'APBD Kota',
    keterangan: '',
  });
  const [editId, setEditId] = useState(null);
  const [hapusId, setHapusId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [m, setM] = useState(null);

  const call = async (fn) => {
    try {
      setLoading(true);
      await fn();
      setM(null);
      load();
    } catch (x) {
      setM({ t: em(x) });
    } finally {
      setLoading(false);
    }
  };

  const simpan = (e) => {
    e.preventDefault();
    if (!f.program.trim()) return setM({ t: 'Nama program / kegiatan wajib diisi.' });

    call(async () => {
      const payload = {
        ...f,
        tahun: Number(f.tahun) || new Date().getFullYear(),
        pagu: Number(f.pagu) || 0,
        realisasi: Number(f.realisasi) || 0,
      };
      if (editId) {
        await api.put(`/anggaran/${editId}`, payload);
        setEditId(null);
        setM({ ok: 1, t: 'Alokasi anggaran berhasil diperbarui dan tampil di portal warga!' });
      } else {
        await api.post('/anggaran', payload);
        setM({ ok: 1, t: 'Program anggaran baru berhasil ditambahkan ke transparansi publik!' });
      }
      setF({ tahun: 2026, program: '', pagu: '', realisasi: '', sumber: 'APBD Kota', keterangan: '' });
    });
  };

  const mulaiEdit = (a) => {
    setEditId(a.id);
    setF({
      tahun: a.tahun,
      program: a.program,
      pagu: a.pagu,
      realisasi: a.realisasi,
      sumber: a.sumber || 'APBD Kota',
      keterangan: a.keterangan || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const batalEdit = () => {
    setEditId(null);
    setF({ tahun: 2026, program: '', pagu: '', realisasi: '', sumber: 'APBD Kota', keterangan: '' });
  };

  const hapus = async (id) => {
    call(async () => {
      await api.delete(`/anggaran/${id}`);
      setHapusId(null);
      setM({ ok: 1, t: 'Data program anggaran berhasil dihapus.' });
    });
  };

  const totalPagu = (list || []).reduce((acc, curr) => acc + (Number(curr.pagu) || 0), 0);
  const totalRealisasi = (list || []).reduce((acc, curr) => acc + (Number(curr.realisasi) || 0), 0);
  const persenSerapan = totalPagu > 0 ? Math.round((totalRealisasi / totalPagu) * 100) : 0;
  const targetHapus = hapusId ? (list || []).find((a) => a.id === hapusId) : null;

  return (
    <div className="space-y-6">
      {/* Modal konfirmasi hapus anggaran */}
      {hapusId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setHapusId(null)}>
          <div className="bg-white rounded-2xl shadow-xl border-2 border-rose-200 p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="text-4xl">💰</div>
              <h3 className="font-bold text-rose-900 text-lg">Hapus Program Anggaran?</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Program <strong>"{targetHapus?.program}"</strong> akan dihapus permanen dari laporan transparansi publik.
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setHapusId(null)} className="btn btn-o flex-1 font-semibold">Batal</button>
              <button type="button" onClick={() => hapus(hapusId)} className="btn btn-d flex-1 font-bold">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* Rangkuman Metrik Keuangan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-blue-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block">Total Pagu Anggaran</span>
          <span className="text-lg sm:text-xl font-bold font-serif text-[#1a3a5c] block mt-1">
            {'Rp ' + Number(totalPagu).toLocaleString('id-ID')}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block">Total Realisasi Belanja</span>
          <span className="text-lg sm:text-xl font-bold font-serif text-emerald-700 block mt-1">
            {'Rp ' + Number(totalRealisasi).toLocaleString('id-ID')}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block">Persentase Serapan</span>
          <span className="text-lg sm:text-xl font-bold font-serif text-amber-700 block mt-1">
            {persenSerapan}%
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block">Sisa Alokasi Pagu</span>
          <span className="text-lg sm:text-xl font-bold font-serif text-slate-700 block mt-1">
            {'Rp ' + Number(Math.max(0, totalPagu - totalRealisasi)).toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      <Card
        title={editId ? "✏️ Perbarui Alokasi Anggaran" : "💰 Tambah Program Anggaran Kelurahan"}
        subtitle="Data anggaran ini dipublikasikan secara terbuka di beranda untuk transparansi kepada seluruh warga"
      >
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 mb-4">
          <strong>ℹ️ Keterbukaan Informasi Publik:</strong> Transparansi anggaran memenuhi ketentuan UU No. 14 Tahun 2008 tentang KIP. Seluruh warga berhak memantau serapan anggaran kelurahan.
        </div>

        <form onSubmit={simpan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">Nama Program / Kegiatan *</label>
              <input
                className="inp text-sm"
                required
                placeholder="Contoh: Peningkatan Sarana & Prasarana Lingkungan Permukiman"
                value={f.program}
                onChange={(e) => setF({ ...f, program: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Tahun Anggaran *</label>
              <input
                type="number"
                className="inp text-sm font-mono"
                required
                value={f.tahun}
                onChange={(e) => setF({ ...f, tahun: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Pagu Anggaran (Rp) *</label>
              <input
                type="number"
                className="inp text-sm font-mono"
                required
                placeholder="450000000"
                value={f.pagu}
                onChange={(e) => setF({ ...f, pagu: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Realisasi Belanja (Rp) *</label>
              <input
                type="number"
                className="inp text-sm font-mono"
                required
                placeholder="412500000"
                value={f.realisasi}
                onChange={(e) => setF({ ...f, realisasi: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Sumber Dana</label>
              <select
                className="inp text-sm"
                value={f.sumber}
                onChange={(e) => setF({ ...f, sumber: e.target.value })}
              >
                <option value="APBD Kota">APBD Kota</option>
                <option value="Dana Kelurahan">Dana Kelurahan</option>
                <option value="Bantuan Provinsi">Bantuan Provinsi</option>
                <option value="Swadaya Masyarakat">Swadaya Masyarakat</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Keterangan / Output Kegiatan</label>
            <input
              className="inp text-sm"
              placeholder="Contoh: Pengaspalan jalan lingkungan dan perbaikan drainase di 8 RW"
              value={f.keterangan}
              onChange={(e) => setF({ ...f, keterangan: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={loading} className="btn btn-p text-sm font-bold py-2 px-5">
              {loading ? 'Menyimpan...' : editId ? '💾 Simpan Perubahan' : '➕ Tambah Program Anggaran'}
            </button>
            {editId && (
              <button type="button" onClick={batalEdit} className="btn btn-o text-sm py-2 px-4">
                Batal Edit
              </button>
            )}
          </div>
        </form>

        <div className="mt-4">
          <Msg m={m} />
        </div>
      </Card>

      {/* Tabel Program Anggaran */}
      <Card
        title={`Rincian Anggaran & Capaian Belanja (${(list || []).length})`}
        subtitle="Daftar pos anggaran resmi kelurahan yang terpublikasikan"
      >
        <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-3 px-4">Tahun</th>
                <th className="py-3 px-4">Program / Kegiatan</th>
                <th className="py-3 px-4">Sumber</th>
                <th className="py-3 px-4 text-right">Pagu (Rp)</th>
                <th className="py-3 px-4 text-right">Realisasi (Rp)</th>
                <th className="py-3 px-4 text-center">Serapan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!(list || []).length ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Belum ada data anggaran yang diinput.</td>
                </tr>
              ) : (
                (list || []).map((a) => {
                  const p = Number(a.pagu) || 0;
                  const r = Number(a.realisasi) || 0;
                  const pct = p > 0 ? Math.min(100, Math.round((r / p) * 100)) : 0;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{a.tahun}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{a.program}</div>
                        {a.keterangan && <div className="text-[11px] text-slate-500 italic mt-0.5">{a.keterangan}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="badge text-[11px] bg-slate-100 text-slate-700 border-slate-300 font-semibold">{a.sumber}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {'Rp ' + p.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {'Rp ' + r.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-bold text-[11px]">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => mulaiEdit(a)}
                            className="btn btn-o text-xs py-1 px-2.5 font-semibold text-slate-700"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => setHapusId(a.id)}
                            className="btn text-xs py-1 px-2.5 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ====================================================================
   5. HALAMAN PUBLIK: CEK STATUS PERMOHONAN (TANPA LOGIN)
   ==================================================================== */
function CekStatusPublic() {
  const [desa] = useGet('/profil-desa');
  const [kode, setKode] = useState('');
  const [hasil, setHasil] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const namaDesa = desa?.nama_desa || 'Kelurahan Suka Maju';
  const pemkab = desa?.kabupaten_kota || 'Pemerintah Kota Medan';

  const lacak = async (e) => {
    e.preventDefault();
    if (!kode.trim()) return;
    setLoading(true);
    setHasil(null);
    setErr('');
    try {
      const { data } = await api.get('/cek-status/' + encodeURIComponent(kode.trim()));
      setHasil(data);
    } catch (x) {
      setErr(x.response?.data?.message || 'Pengajuan tidak ditemukan. Pastikan nomor surat atau kode tracking yang Anda masukkan benar.');
    } finally {
      setLoading(false);
    }
  };

  const ST_COLOR = {
    submitted: 'bg-slate-100 text-slate-800 border-slate-300',
    under_review: 'bg-sky-50 text-sky-900 border-sky-400',
    revision_required: 'bg-amber-50 text-amber-900 border-amber-400',
    pending_approval: 'bg-indigo-50 text-indigo-900 border-indigo-400 font-semibold',
    rejected: 'bg-rose-50 text-rose-900 border-rose-400',
    approved: 'bg-indigo-50 text-indigo-900 border-indigo-400',
    issued: 'bg-emerald-600 text-white border-emerald-700 font-bold',
  };
  const ST_LABEL = {
    submitted: 'Diajukan',
    under_review: 'Sedang Diperiksa Petugas',
    revision_required: 'Perlu Revisi Dokumen',
    pending_approval: 'Menunggu Persetujuan Lurah',
    rejected: 'Ditolak',
    approved: 'Disetujui',
    issued: 'Surat Resmi Telah Terbit',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="bg-[#1a3a5c] text-white py-4 px-4 border-b-4 border-[#c8a84b]">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">🏛️</span>
            <div>
              <div className="font-bold text-sm leading-tight">{namaDesa}</div>
              <div className="text-[11px] text-white/60">{pemkab}</div>
            </div>
          </Link>
          <Link to="/" className="text-xs font-semibold text-white/80 hover:text-white underline">
            ← Kembali ke Beranda
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl w-full p-4 py-10 flex-1">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#c8a84b]/15 text-[#8b6b1a] flex items-center justify-center text-3xl mx-auto mb-2">
              🔍
            </div>
            <h1 className="font-serif text-2xl font-bold text-slate-900">Lacak Status Permohonan Surat</h1>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Cek tahapan verifikasi dan persetujuan surat Anda secara langsung tanpa perlu masuk/login ke akun.
            </p>
          </div>

          <form onSubmit={lacak} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              className="inp text-sm py-3 px-4 flex-1 font-mono uppercase"
              required
              placeholder="Masukkan ID Pengajuan atau Nomor Surat"
              value={kode}
              onChange={(e) => setKode(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !kode.trim()}
              className="btn btn-p text-sm py-3 px-6 font-bold flex-shrink-0"
            >
              {loading ? 'Mencari...' : 'Lacak Status'}
            </button>
          </form>

          {err && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs text-center">
              ⚠️ {err}
            </div>
          )}

          {hasil && (
            <div className="border-2 border-brand-200 rounded-xl p-5 space-y-4 bg-brand-50/20">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-400 font-mono">ID #{hasil.id}</div>
                  <h3 className="font-bold text-slate-900 text-base">{hasil.jenis_surat}</h3>
                  <div className="text-xs text-slate-600 mt-0.5">Pemohon: <strong>{hasil.nama_pemohon}</strong></div>
                </div>
                <div>
                  <span className={`badge text-xs px-3 py-1 font-bold ${ST_COLOR[hasil.status] || 'bg-slate-100 text-slate-700'}`}>
                    {ST_LABEL[hasil.status] || hasil.status}
                  </span>
                </div>
              </div>

              {/* Progress 4 steps */}
              <div className="grid grid-cols-4 gap-2 text-center text-[11px] pt-1">
                {[
                  { step: 1, label: 'Diajukan', ok: ['submitted', 'under_review', 'revision_required', 'pending_approval', 'approved', 'issued'].includes(hasil.status) },
                  { step: 2, label: 'Pemeriksaan', ok: ['under_review', 'pending_approval', 'approved', 'issued'].includes(hasil.status) },
                  { step: 3, label: 'Persetujuan Lurah', ok: ['pending_approval', 'approved', 'issued'].includes(hasil.status) },
                  { step: 4, label: 'Surat Terbit', ok: hasil.status === 'issued' },
                ].map((s) => (
                  <div key={s.step} className="space-y-1">
                    <div className={`w-7 h-7 rounded-full mx-auto flex items-center justify-center font-bold text-xs ${
                      s.ok ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {s.ok ? '✓' : s.step}
                    </div>
                    <div className={`font-semibold ${s.ok ? 'text-emerald-800' : 'text-slate-400'}`}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400">Diajukan Pada:</span>
                  <div className="font-semibold text-slate-700 mt-0.5">{tg(hasil.tanggal_pengajuan)}</div>
                </div>
                <div>
                  <span className="text-slate-400">Pembaruan Terakhir:</span>
                  <div className="font-semibold text-slate-700 mt-0.5">{tg(hasil.tanggal_update)}</div>
                </div>
              </div>

              {hasil.catatan && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 leading-relaxed">
                  <strong>Catatan dari Petugas:</strong><br />
                  {hasil.catatan}
                </div>
              )}

              {hasil.status === 'issued' && (
                <div className="text-center pt-2">
                  <Link to="/login" className="btn btn-p text-xs py-2 px-5 font-bold">
                    📥 Masuk untuk Mengunduh Surat Resmi
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-slate-400 border-t border-slate-200">
        © {new Date().getFullYear()} SIPESUR – {namaDesa}
      </footer>
    </div>
  );
}

/* ====================================================================
   6. HALAMAN PUBLIK: TRANSPARANSI ANGGARAN KELURAHAN
   ==================================================================== */
function TransparansiAnggaranPublic() {
  const [desa] = useGet('/profil-desa');
  const [anggaran] = useGet('/anggaran');
  const namaDesa = desa?.nama_desa || 'Kelurahan Suka Maju';
  const pemkab = desa?.kabupaten_kota || 'Pemerintah Kota Medan';

  const totalPagu = (anggaran || []).reduce((a, c) => a + (Number(c.pagu) || 0), 0);
  const totalRealisasi = (anggaran || []).reduce((a, c) => a + (Number(c.realisasi) || 0), 0);
  const persen = totalPagu > 0 ? Math.round((totalRealisasi / totalPagu) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="bg-[#1a3a5c] text-white py-4 px-4 border-b-4 border-[#c8a84b]">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">🏛️</span>
            <div>
              <div className="font-bold text-sm leading-tight">{namaDesa}</div>
              <div className="text-[11px] text-white/60">{pemkab}</div>
            </div>
          </Link>
          <Link to="/" className="text-xs font-semibold text-white/80 hover:text-white underline">
            ← Kembali ke Beranda
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl w-full p-4 py-8 flex-1 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-block bg-[#1a3a5c]/10 text-[#1a3a5c] font-bold text-xs px-3 py-1 rounded-full mb-1">
            KETERBUKAAN INFORMASI PUBLIK
          </div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">Transparansi Anggaran {namaDesa}</h1>
          <p className="text-slate-600 text-sm max-w-xl mx-auto">
            Laporan pertanggungjawaban pengelolaan keuangan publik, APBD Kota, dan Dana Kelurahan demi tata kelola pemerintahan yang bersih dan terpercaya.
          </p>
        </div>

        {/* Metrik Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-blue-200 p-4 shadow-xs text-center">
            <span className="text-xs text-slate-500 font-semibold block">Total Pagu Anggaran</span>
            <span className="font-serif text-xl sm:text-2xl font-bold text-[#1a3a5c] mt-1 block">
              {'Rp ' + Number(totalPagu).toLocaleString('id-ID')}
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-xs text-center">
            <span className="text-xs text-slate-500 font-semibold block">Total Realisasi Belanja</span>
            <span className="font-serif text-xl sm:text-2xl font-bold text-emerald-700 mt-1 block">
              {'Rp ' + Number(totalRealisasi).toLocaleString('id-ID')}
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-xs text-center">
            <span className="text-xs text-slate-500 font-semibold block">Persentase Serapan</span>
            <span className="font-serif text-xl sm:text-2xl font-bold text-amber-700 mt-1 block">
              {persen}%
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs text-center">
            <span className="text-xs text-slate-500 font-semibold block">Predikat Akuntabilitas</span>
            <span className="font-serif text-base sm:text-lg font-bold text-emerald-800 mt-1 block">
              ✓ WTP (Transparan)
            </span>
          </div>
        </div>

        {/* Program Cards */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <h2 className="font-bold text-slate-900 text-base">Rincian Program &amp; Kegiatan Tahun Anggaran 2026</h2>
          <div className="space-y-4">
            {(anggaran || []).map((a) => {
              const p = Number(a.pagu) || 0;
              const r = Number(a.realisasi) || 0;
              const pct = p > 0 ? Math.min(100, Math.round((r / p) * 100)) : 0;
              return (
                <div key={a.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <span className="font-bold text-slate-900 text-sm">
                      {a.program} <span className="font-normal text-xs text-slate-400">({a.sumber || 'APBD'})</span>
                    </span>
                    <div className="text-xs font-semibold text-slate-700">
                      <span className="text-emerald-700 font-bold">{'Rp ' + r.toLocaleString('id-ID')}</span> / {'Rp ' + p.toLocaleString('id-ID')} ({pct}%)
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-emerald-600 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  {a.keterangan && (
                    <div className="text-xs text-slate-500 italic mt-1">Capaian: {a.keterangan}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-slate-400 border-t border-slate-200">
        © {new Date().getFullYear()} SIPESUR – {namaDesa} • Keterbukaan Informasi Publik
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Provider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verifikasi/:kode" element={<Verifikasi />} />
          <Route path="/cek-status" element={<CekStatusPublic />} />
          <Route path="/anggaran" element={<TransparansiAnggaranPublic />} />
          <Route path="/app" element={<Guard />}>
            <Route index element={<Dashboard />} />
            <Route
              path="verifikasi-warga"
              element={
                <Only r={['petugas', 'lurah']}>
                  <VerifikasiWarga />
                </Only>
              }
            />
            <Route
              path="ajukan"
              element={
                <Only r={['warga']}>
                  <Ajukan />
                </Only>
              }
            />
            <Route path="profil" element={<Profil />} />
            <Route
              path="profil-desa"
              element={
                <Only r={['admin', 'lurah']}>
                  <ProfilDesaWrapper />
                </Only>
              }
            />
            <Route
              path="berita"
              element={<BeritaKelurahan />}
            />
            <Route
              path="umkm"
              element={
                <Only r={['petugas', 'lurah']}>
                  <UmkmKelurahan />
                </Only>
              }
            />
            <Route
              path="galeri"
              element={
                <Only r={['petugas', 'lurah']}>
                  <GaleriKelurahan />
                </Only>
              }
            />
            <Route
              path="anggaran"
              element={
                <Only r={['lurah']}>
                  <AnggaranKelurahan />
                </Only>
              }
            />
            <Route
              path="pengajuan"
              element={
                <Only r={['warga', 'petugas', 'lurah']}>
                  <List />
                </Only>
              }
            />
            <Route
              path="pengajuan/:id"
              element={
                <Only r={['warga', 'petugas', 'lurah']}>
                  <Detail />
                </Only>
              }
            />
            <Route
              path="surat"
              element={
                <Only r={['warga']}>
                  <SuratSaya />
                </Only>
              }
            />
            <Route
              path="surat-masuk"
              element={
                <Only r={['petugas', 'lurah']}>
                  <SuratMasuk />
                </Only>
              }
            />
            <Route
              path="surat-keluar"
              element={
                <Only r={['petugas', 'lurah']}>
                  <SuratKeluar />
                </Only>
              }
            />
            <Route
              path="arsip"
              element={
                <Only r={['petugas', 'lurah']}>
                  <Arsip />
                </Only>
              }
            />
            <Route path="notifikasi" element={<Notifikasi />} />
            <Route
              path="pengguna"
              element={
                <Only r={['admin']}>
                  <Pengguna />
                </Only>
              }
            />
            <Route
              path="jenis"
              element={
                <Only r={['admin']}>
                  <Jenis />
                </Only>
              }
            />
            <Route
              path="log"
              element={
                <Only r={['admin']}>
                  <Log />
                </Only>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}
