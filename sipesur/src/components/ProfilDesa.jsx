import { useState, useEffect, useContext, createContext } from 'react';
import api from '../api';

// Reuse auth context dari App.jsx (tersedia global via window.__sipesur_user__)
function useCurrentUser() {
  const [u, setU] = useState(null);
  useEffect(() => {
    // Coba ambil dari localStorage token decode sederhana
    try {
      const t = localStorage.getItem('token');
      if (t) {
        const payload = JSON.parse(atob(t.split('.')[1]));
        setU(payload);
      }
    } catch {}
  }, []);
  return u;
}

// ---- Komponen kecil reusable ----
function InputField({ label, required, hint, children }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1 text-xs font-bold text-slate-700">
        {label}
        {required && <span className="text-rose-500 font-bold">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function SectionCard({ icon, title, subtitle, accent = 'brand', children, locked }) {
  const accents = {
    brand: 'border-brand-200 bg-gradient-to-br from-white to-brand-50/30',
    indigo: 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30',
    violet: 'border-violet-200 bg-gradient-to-br from-white to-violet-50/30',
    amber: 'border-amber-200 bg-gradient-to-br from-white to-amber-50/20',
  };
  const headerAccents = {
    brand: 'bg-brand-700 text-white',
    indigo: 'bg-indigo-600 text-white',
    violet: 'bg-violet-600 text-white',
    amber: 'bg-amber-600 text-white',
  };
  return (
    <section
      className={`rounded-2xl border-2 shadow-sm transition-all ${accents[accent]} ${locked ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-t-xl ${headerAccents[accent]}`}>
        <span className="text-lg">{icon}</span>
        <div>
          <div className="font-bold text-sm leading-tight">{title}</div>
          {subtitle && <div className="text-[11px] opacity-80 leading-tight mt-0.5">{subtitle}</div>}
        </div>
        {locked && (
          <span className="ml-auto text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
            🔒 Hanya Admin
          </span>
        )}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

function Alert({ type, children, onClose }) {
  const styles = {
    success: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    error: 'bg-rose-50 border-rose-300 text-rose-900',
    info: 'bg-brand-50 border-brand-200 text-brand-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
  };
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm font-medium ${styles[type]}`}>
      <span className="text-base flex-shrink-0 mt-0.5">{icons[type]}</span>
      <span className="flex-1 leading-relaxed">{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="text-xs font-bold opacity-60 hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
          ✕
        </button>
      )}
    </div>
  );
}

export default function ProfilDesa({ userRole }) {
  const [f, setF] = useState(null);
  const [orig, setOrig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState('identitas');
  const [konfirmHapusLogo, setKonfirmHapusLogo] = useState(false);

  // Role-aware: Admin IT (pengelola portal) & Lurah yang bisa edit konfigurasi identitas & kop
  const role = userRole || 'warga';
  const bisaEdit = ['admin', 'lurah'].includes(role);
  const bisaHapus = role === 'admin';

  useEffect(() => {
    fetchProfil();
  }, []);

  const fetchProfil = async () => {
    try {
      setLoading(true);
      const res = await api.get('/profil-desa');
      const data = res.data || {};
      setF(data);
      setOrig(JSON.parse(JSON.stringify(data)));
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal memuat profil desa.' });
    } finally {
      setLoading(false);
    }
  };

  const ch = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }));

  const convertImageToPngBlob = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        const maxSide = 320;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objUrl);
        canvas.toBlob((blob) => resolve(blob || file), 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(file);
      };
      img.src = objUrl;
    });

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setMsg({ type: 'error', text: 'Logo harus berupa berkas PNG, JPG, atau WebP.' });
      return;
    }
    try {
      setUploadingLogo(true);
      setMsg(null);
      const pngBlob = await convertImageToPngBlob(file);
      const formData = new FormData();
      formData.append('logo', pngBlob, 'logo-kelurahan.png');
      const res = await api.post('/profil-desa/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setF((prev) => ({ ...prev, logo_url: res.data.logo_url }));
      setOrig((prev) => (prev ? { ...prev, logo_url: res.data.logo_url } : prev));
      setMsg({ type: 'success', text: 'Logo kelurahan berhasil diunggah dan langsung diterapkan ke kop surat.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal mengunggah logo.' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleHapusLogo = async () => {
    setKonfirmHapusLogo(false);
    setF((prev) => ({ ...prev, logo_url: null }));
    // Langsung simpan perubahan logo null
    try {
      await api.put('/profil-desa', { ...f, logo_url: null });
      setMsg({ type: 'success', text: 'Logo berhasil dihapus dari kop surat.' });
    } catch {
      setMsg({ type: 'warn', text: 'Logo dihapus secara lokal, simpan perubahan untuk memperbarui ke server.' });
    }
  };

  const handleReset = () => {
    if (orig) {
      setF(JSON.parse(JSON.stringify(orig)));
      setMsg({ type: 'info', text: 'Formulir dikembalikan ke data tersimpan terakhir.' });
    }
  };

  const hasChanged = JSON.stringify(f) !== JSON.stringify(orig);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!f.nama_desa?.trim()) {
      setMsg({ type: 'error', text: 'Nama kelurahan/desa wajib diisi.' });
      return;
    }
    try {
      setSaving(true);
      setMsg(null);
      const res = await api.put('/profil-desa', f);
      setOrig(JSON.parse(JSON.stringify(f)));
      setMsg({ type: 'success', text: res.data.message || 'Profil desa & kop surat berhasil diperbarui! Semua dokumen cetak akan menggunakan data terbaru.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal menyimpan perubahan.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
        <svg className="w-8 h-8 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span className="text-sm font-medium">Memuat informasi profil desa…</span>
      </div>
    );
  }

  // Data pratinjau kop surat
  const pemkab = (f?.kabupaten_kota || 'PEMERINTAH KOTA MEDAN').toUpperCase();
  const namaDesa = (f?.nama_desa || 'KELURAHAN SUKA MAJU').toUpperCase();
  const namaKec = (f?.kecamatan || 'KECAMATAN MEDAN JOHOR').toUpperCase();
  const alamatPrev = `${f?.alamat || 'Jl. STM No. 40'}${f?.kode_pos ? ', Kode Pos: ' + f.kode_pos : ''}${f?.telepon ? '  •  Telp. ' + f.telepon : ''}`;
  const kontakPrev = [f?.email && `Email: ${f.email}`, f?.website && `Website: ${f.website}`].filter(Boolean).join('  •  ');

  const TABS = [
    { id: 'identitas', label: '🏛️ Identitas Wilayah', icon: '🏛️' },
    { id: 'kontak', label: '📍 Kontak & Alamat', icon: '📍' },
    { id: 'pejabat', label: '👤 Pejabat & Lurah', icon: '👤' },
    { id: 'peta', label: '🗺️ Peta Lokasi', icon: '🗺️' },
  ];

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-brand-950 tracking-tight">
            Profil Desa &amp; Kop Surat
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-xl leading-relaxed">
            {bisaEdit
              ? 'Kelola identitas resmi kelurahan/desa. Setiap perubahan akan langsung memperbarui kop surat pada semua dokumen cetak dan berkas PDF.'
              : 'Informasi resmi identitas kelurahan/desa. Hubungi IT Administrator atau Lurah untuk mengubah data ini.'}
          </p>
        </div>
        {/* Badge role */}
        <div className={`flex-shrink-0 self-start px-3 py-2 rounded-xl text-xs font-bold border-2 shadow-sm ${
          bisaEdit ? 'bg-brand-700 text-white border-brand-800' : 'bg-slate-100 text-slate-600 border-slate-200'
        }`}>
          {bisaEdit ? (
            <span>✏️ Mode Edit — {role === 'admin' ? 'IT Administrator' : 'Lurah'}</span>
          ) : (
            <span>👁️ Mode Lihat — {role === 'petugas' ? 'Petugas' : 'Warga'}</span>
          )}
        </div>
      </div>

      {/* ── PERINGATAN JIKA TIDAK BISA EDIT ── */}
      {!bisaEdit && (
        <Alert type="info">
          Anda hanya memiliki akses lihat. Konfigurasi identitas &amp; kop portal kelurahan dikelola oleh <strong>IT Administrator</strong> atau <strong>Lurah</strong>.
        </Alert>
      )}

      {/* ── PESAN STATUS ── */}
      {msg && (
        <Alert type={msg.type} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {/* ── PRATINJAU LANGSUNG KOP SURAT ── */}
      <div className="rounded-2xl border-2 border-brand-300 bg-gradient-to-br from-brand-50/60 to-indigo-50/40 shadow-php overflow-hidden">
        {/* Header pratinjau */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 bg-gradient-to-r from-brand-700 to-indigo-600 text-white">
          <div className="flex items-center gap-2 font-bold text-sm">
            <span>👁️</span>
            <span>Pratinjau Kop Surat — Langsung Terbarui</span>
          </div>
          <span className="text-[11px] opacity-80 italic">Tampilan kop surat pada dokumen resmi</span>
        </div>
        {/* Replika kop surat A4 */}
        <div className="p-4 sm:p-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 font-serif">
            <div className="border-b-[3.5px] border-double border-slate-800 pb-4">
              <div className="flex items-center gap-4">
                {/* Logo */}
                {f?.logo_url ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                    <img src={f.logo_url} alt="Logo Daerah" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 flex flex-col items-center justify-center gap-1">
                    <span className="text-2xl">🏛️</span>
                    <span className="text-[9px] text-brand-500 font-sans text-center leading-tight">Logo Daerah</span>
                  </div>
                )}
                {/* Teks kop */}
                <div className="flex-1 text-center space-y-0.5">
                  <div className="font-sans text-[10.5pt] sm:text-[12pt] font-bold tracking-widest text-slate-700 leading-tight">{pemkab}</div>
                  <div className="font-sans text-[13pt] sm:text-[16pt] font-extrabold tracking-wider text-brand-900 leading-tight">{namaDesa}</div>
                  <div className="font-sans text-[10pt] sm:text-[11pt] font-bold tracking-wider text-slate-800 leading-tight">{namaKec}</div>
                  <div className="font-sans text-[8pt] sm:text-[9pt] text-slate-600 leading-snug mt-1">{alamatPrev}</div>
                  {kontakPrev && <div className="font-sans text-[7.5pt] sm:text-[8pt] text-slate-500">{kontakPrev}</div>}
                </div>
              </div>
            </div>
            <div className="mt-3 text-center text-[10px] text-slate-400 font-sans italic">
              Format kop surat resmi • Tata Naskah Dinas Pemerintahan RI
            </div>
          </div>
        </div>
      </div>

      {/* ── FORM EDIT (hanya jika punya akses) ── */}
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── TAB NAVIGASI ── */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-max px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'bg-gradient-to-r from-brand-700 to-indigo-600 text-white shadow-md shadow-brand-200'
                  : 'text-slate-600 hover:bg-white hover:text-brand-800 hover:shadow-sm'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: IDENTITAS WILAYAH ── */}
        {tab === 'identitas' && (
          <SectionCard
            icon="🏛️"
            title="Identitas Wilayah & Pemerintahan"
            subtitle="Data ini tampil sebagai baris utama kop surat resmi"
            accent="brand"
            locked={!bisaEdit}
          >
            <InputField label="Pemerintah Kabupaten / Kota" required hint="Contoh: Pemerintah Kota Medan">
              <input
                type="text"
                className="inp"
                required={bisaEdit}
                disabled={!bisaEdit}
                placeholder="Pemerintah Kota Medan"
                value={f?.kabupaten_kota || ''}
                onChange={ch('kabupaten_kota')}
              />
            </InputField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Nama Kelurahan / Desa" required hint="Contoh: Kelurahan Suka Maju">
                <input
                  type="text"
                  className="inp"
                  required={bisaEdit}
                  disabled={!bisaEdit}
                  placeholder="Kelurahan Suka Maju"
                  value={f?.nama_desa || ''}
                  onChange={ch('nama_desa')}
                />
              </InputField>
              <InputField label="Nama Kecamatan" required hint="Contoh: Kecamatan Medan Johor">
                <input
                  type="text"
                  className="inp"
                  required={bisaEdit}
                  disabled={!bisaEdit}
                  placeholder="Kecamatan Medan Johor"
                  value={f?.kecamatan || ''}
                  onChange={ch('kecamatan')}
                />
              </InputField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Provinsi" hint="Contoh: Sumatera Utara">
                <input
                  type="text"
                  className="inp"
                  disabled={!bisaEdit}
                  placeholder="Sumatera Utara"
                  value={f?.provinsi || ''}
                  onChange={ch('provinsi')}
                />
              </InputField>
              <InputField label="Kode Desa / Kelurahan (Kemendagri)" hint="Kode wilayah resmi 10 digit">
                <input
                  type="text"
                  className="inp font-mono"
                  disabled={!bisaEdit}
                  placeholder="3273020001"
                  maxLength={15}
                  value={f?.kode_wilayah || ''}
                  onChange={ch('kode_wilayah')}
                />
              </InputField>
            </div>

            {/* UPLOAD LOGO */}
            <div className="border-t border-slate-200 pt-4">
              <div className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                <span>🖼️</span> Logo Resmi Kelurahan / Pemda
              </div>
              <div className="flex items-start gap-4">
                {/* Preview logo */}
                <div className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center overflow-hidden flex-shrink-0 ${
                  f?.logo_url ? 'border-brand-300 bg-white' : 'border-dashed border-slate-300 bg-slate-50'
                }`}>
                  {f?.logo_url ? (
                    <img src={f.logo_url} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
                  ) : (
                    <span className="text-2xl">🏛️</span>
                  )}
                </div>
                {/* Tombol-tombol logo */}
                {bisaEdit && (
                  <div className="flex flex-col gap-2">
                    <label className="btn btn-o py-2 px-3 text-xs font-semibold cursor-pointer">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                        className="hidden"
                      />
                      {uploadingLogo ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          Mengunggah…
                        </span>
                      ) : '📤 Unggah Logo Baru'}
                    </label>
                    {f?.logo_url && !konfirmHapusLogo && (
                      <button
                        type="button"
                        onClick={() => setKonfirmHapusLogo(true)}
                        className="btn py-1.5 px-3 text-xs text-rose-600 border border-rose-200 hover:bg-rose-50 font-semibold"
                      >
                        🗑️ Hapus Logo
                      </button>
                    )}
                    {konfirmHapusLogo && (
                      <div className="flex gap-2 items-center">
                        <span className="text-[11px] text-rose-700 font-semibold">Yakin hapus?</span>
                        <button type="button" onClick={handleHapusLogo} className="btn btn-d text-[11px] py-1 px-2.5 font-bold">Ya, Hapus</button>
                        <button type="button" onClick={() => setKonfirmHapusLogo(false)} className="btn btn-o text-[11px] py-1 px-2.5">Batal</button>
                      </div>
                    )}
                    <span className="text-[11px] text-slate-400 leading-tight">
                      PNG/JPG/WebP transparan, min. 200×200px (tanpa batasan ukuran).
                    </span>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── TAB: KONTAK & ALAMAT ── */}
        {tab === 'kontak' && (
          <SectionCard
            icon="📍"
            title="Alamat Kantor & Informasi Kontak"
            subtitle="Tampil di baris bawah kop surat dan dokumen resmi"
            accent="indigo"
            locked={!bisaEdit}
          >
            <InputField label="Alamat Kantor Kelurahan" required hint="Nomor jalan, RT/RW, nama lingkungan">
              <textarea
                rows={2}
                className="inp"
                disabled={!bisaEdit}
                placeholder="Jl. STM No. 40, Kelurahan Suka Maju, Kecamatan Medan Johor, Kota Medan 20146"
                value={f?.alamat || ''}
                onChange={ch('alamat')}
              />
            </InputField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Kode Pos" hint="5 digit kode pos wilayah">
                <input
                  type="text"
                  className="inp font-mono"
                  disabled={!bisaEdit}
                  placeholder="20146"
                  maxLength={5}
                  value={f?.kode_pos || ''}
                  onChange={ch('kode_pos')}
                />
              </InputField>
              <InputField label="Nomor Telepon Kantor" hint="Nomor telepon dinas / HP">
                <input
                  type="tel"
                  className="inp"
                  disabled={!bisaEdit}
                  placeholder="0823-4123-5734"
                  value={f?.telepon || ''}
                  onChange={ch('telepon')}
                />
              </InputField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Nomor Fax / WhatsApp Kelurahan" hint="Opsional">
                <input
                  type="text"
                  className="inp"
                  disabled={!bisaEdit}
                  placeholder="0823-4123-5734"
                  value={f?.fax || ''}
                  onChange={ch('fax')}
                />
              </InputField>
              <InputField label="Jam Pelayanan" hint="Contoh: Senin–Jumat, 08.00–15.00 WIB">
                <input
                  type="text"
                  className="inp"
                  disabled={!bisaEdit}
                  placeholder="Senin–Jumat, 08.00–15.00 WIB"
                  value={f?.jam_pelayanan || ''}
                  onChange={ch('jam_pelayanan')}
                />
              </InputField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Email Resmi Kelurahan" hint="Gunakan email resmi pemda">
                <input
                  type="email"
                  className="inp"
                  disabled={!bisaEdit}
                  placeholder="kelurahan@pemkomedan.go.id"
                  value={f?.email || ''}
                  onChange={ch('email')}
                />
              </InputField>
              <InputField label="Situs Web / Portal Resmi" hint="Tanpa https://">
                <input
                  type="text"
                  className="inp"
                  disabled={!bisaEdit}
                  placeholder="sukamaju.medan.go.id"
                  value={f?.website || ''}
                  onChange={ch('website')}
                />
              </InputField>
            </div>

            <InputField label="Visi Kelurahan" hint="Opsional — tampil di halaman beranda warga">
              <textarea
                rows={2}
                className="inp text-sm"
                disabled={!bisaEdit}
                placeholder="Contoh: Terwujudnya Kelurahan Suka Maju yang Maju, Sejahtera, dan Berdaya."
                value={f?.visi || ''}
                onChange={ch('visi')}
              />
            </InputField>
          </SectionCard>
        )}

        {/* ── TAB: PEJABAT & LURAH ── */}
        {tab === 'pejabat' && (
          <SectionCard
            icon="👤"
            title="Kepala Desa / Lurah & Pejabat Default"
            subtitle="Data ini digunakan sebagai penandatangan surat apabila lurah belum mengatur TTD mandiri"
            accent="violet"
            locked={!bisaEdit}
          >
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 leading-relaxed">
              <strong>⚠️ Catatan Penting:</strong> Data lurah di sini adalah <em>data default fallback</em>. Jika akun Lurah sudah mengatur tanda tangan mandiri di menu "<em>Profil &amp; Tanda Tangan Lurah</em>", tanda tangan akun tersebut akan digunakan secara otomatis dan lebih diprioritaskan.
            </div>

            <InputField label="Nama Lengkap & Gelar Kepala Desa/Lurah" hint="Beserta gelar akademis resmi">
              <input
                type="text"
                className="inp"
                disabled={!bisaEdit}
                placeholder="Muhammad Iqbal Samosir, S.E., M.A.P."
                value={f?.nama_lurah || ''}
                onChange={ch('nama_lurah')}
              />
            </InputField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="NIP Kepala Desa / Lurah" hint="18 digit Nomor Induk Pegawai">
                <input
                  type="text"
                  className="inp font-mono tracking-wider"
                  disabled={!bisaEdit}
                  placeholder="198506122010011005"
                  maxLength={18}
                  value={f?.nip_lurah || ''}
                  onChange={ch('nip_lurah')}
                />
              </InputField>
              <InputField label="Sebutan Jabatan Resmi" hint="Sesuai SK pengangkatan">
                <input
                  type="text"
                  className="inp"
                  disabled={!bisaEdit}
                  placeholder="Lurah Suka Maju"
                  value={f?.jabatan_lurah || ''}
                  onChange={ch('jabatan_lurah')}
                />
              </InputField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Tanggal Mulai Menjabat" hint="Format: YYYY-MM-DD">
                <input
                  type="date"
                  className="inp"
                  disabled={!bisaEdit}
                  value={f?.tmt_lurah || ''}
                  onChange={ch('tmt_lurah')}
                />
              </InputField>
              <InputField label="Tanggal Berakhir Masa Jabatan" hint="Opsional">
                <input
                  type="date"
                  className="inp"
                  disabled={!bisaEdit}
                  value={f?.tmt_akhir_lurah || ''}
                  onChange={ch('tmt_akhir_lurah')}
                />
              </InputField>
            </div>

            <InputField label="Sekretaris Kelurahan (Seklur)" hint="Nama & gelar Sekretaris">
              <input
                type="text"
                className="inp"
                disabled={!bisaEdit}
                placeholder="Vicky Al Wirya, S.Pt., M.M."
                value={f?.nama_sekretaris || ''}
                onChange={ch('nama_sekretaris')}
              />
            </InputField>
          </SectionCard>
        )}

        {/* ── TAB: PETA LOKASI ── */}
        {tab === 'peta' && (
          <SectionCard
            icon="🗺️"
            title="Peta Lokasi Kantor Kelurahan"
            subtitle="Widget lokasi interaktif untuk memandu warga menuju kantor kelurahan"
            accent="brand"
            locked={!bisaEdit}
          >
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
              <iframe
                title="Peta Lokasi Kantor Kelurahan Suka Maju Medan Johor"
                className="w-full h-80 border-0"
                src="https://www.openstreetmap.org/export/embed.html?bbox=98.67%2C3.52%2C98.71%2C3.56&amp;layer=mapnik&amp;marker=3.5414%2C98.6923"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
              <div>
                <div className="font-bold text-slate-800 text-sm">📍 {f?.nama_desa || 'Kelurahan Suka Maju'}</div>
                <div className="text-xs text-slate-500 mt-0.5">{f?.alamat || 'Jl. STM No. 40, Kelurahan Suka Maju, Kecamatan Medan Johor'}, {f?.kabupaten_kota || 'Pemerintah Kota Medan'}</div>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Kantor Kelurahan Suka Maju Jl. STM No. 40 Medan Johor')}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-p text-xs py-2 px-4 flex items-center gap-2 flex-shrink-0"
              >
                <span>🗺️</span>
                <span>Buka di Google Maps</span>
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Koordinat Latitude (Lintang)" hint="Contoh: 3.541420">
                <input
                  type="text"
                  className="inp font-mono"
                  disabled={!bisaEdit}
                  placeholder="3.541420"
                  value={f?.latitude || ''}
                  onChange={ch('latitude')}
                />
              </InputField>
              <InputField label="Koordinat Longitude (Bujur)" hint="Contoh: 98.692310">
                <input
                  type="text"
                  className="inp font-mono"
                  disabled={!bisaEdit}
                  placeholder="98.692310"
                  value={f?.longitude || ''}
                  onChange={ch('longitude')}
                />
              </InputField>
            </div>
            <InputField label="Petunjuk Arah / Rute Menuju Kantor" hint="Patokan atau angkutan umum">
              <textarea
                rows={2}
                className="inp text-xs"
                disabled={!bisaEdit}
                placeholder="Kantor Kelurahan Suka Maju berlokasi di Jl. STM No. 40 Medan Johor, mudah diakses kendaraan roda 2 dan roda 4."
                value={f?.petunjuk_arah || ''}
                onChange={ch('petunjuk_arah')}
              />
            </InputField>
          </SectionCard>
        )}

        {/* ── TOMBOL AKSI ── */}
        {bisaEdit && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t-2 border-slate-200">
            <div className="flex items-center gap-2">
              {hasChanged && (
                <span className="text-xs text-amber-700 font-semibold flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                  ⚠️ Ada perubahan yang belum disimpan
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {hasChanged && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn btn-o py-2.5 px-5 text-sm font-semibold text-slate-700"
                >
                  ↩️ Batalkan Perubahan
                </button>
              )}
              <button
                type="submit"
                disabled={saving || !bisaEdit}
                className="btn py-2.5 px-7 text-sm font-bold shadow-md shadow-brand-200/60 transition-all disabled:opacity-60"
                style={{
                  background: saving ? '#777BB4' : 'linear-gradient(135deg, #4F5B93 0%, #6366f1 100%)',
                  color: 'white',
                }}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Menyimpan…
                  </span>
                ) : '💾 Simpan Profil Desa & Kop Surat'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
