/**
 * PetaKelurahan.jsx
 * Peta Interaktif Kelurahan Suka Maju — OpenStreetMap + Leaflet
 * Fitur: pin kantor kelurahan, UMKM, fasilitas publik; popup detail;
 *        filter kategori; fullscreen; geolokasi pengguna; mode publik.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api';

// ── Fix Leaflet default icon path (Vite tidak include otomatis)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Koordinat default: Kelurahan Suka Maju, Medan Johor
const DEFAULT_CENTER = [3.5490, 98.6937];
const DEFAULT_ZOOM = 15;

// ── Kategori & konfigurasi warna/emoji
const CATEGORIES = {
  kantor:    { label: 'Kantor Kelurahan',  emoji: '🏛️', color: '#1a3a5c', bg: '#e8f0fb' },
  umkm:      { label: 'UMKM & Usaha',      emoji: '🏪', color: '#c8a84b', bg: '#fef9ec' },
  fasilitas: { label: 'Fasilitas Publik',  emoji: '🏥', color: '#16a34a', bg: '#ecfdf5' },
  pendidikan:{ label: 'Pendidikan',         emoji: '🏫', color: '#7c3aed', bg: '#f5f3ff' },
  ibadah:    { label: 'Tempat Ibadah',      emoji: '🕌', color: '#ea580c', bg: '#fff7ed' },
  lain:      { label: 'Lainnya',            emoji: '📍', color: '#64748b', bg: '#f8fafc' },
};

// ── Buat custom DivIcon per kategori
function makeIcon(cat) {
  const cfg = CATEGORIES[cat] || CATEGORIES.lain;
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${cfg.color};
      color:white;
      width:36px;height:36px;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      border:3px solid white;
    ">
      <span style="transform:rotate(45deg);font-size:16px;line-height:1;">${cfg.emoji}</span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
  });
}

// ── Data titik default (bisa dioverride dari Supabase / local_db)
const DEFAULT_TITIK = [
  {
    id: 'kantor-1',
    nama: 'Kantor Kelurahan Suka Maju',
    kategori: 'kantor',
    lat: 3.5490,
    lng: 98.6937,
    alamat: 'Jl. Suka Maju No. 1, Medan Johor',
    telepon: '061-XXXXXXX',
    jam: 'Senin–Jumat 08.00–16.00',
    deskripsi: 'Pusat pelayanan administrasi kependudukan dan surat menyurat warga Kelurahan Suka Maju.',
    foto: null,
  },
  {
    id: 'fas-1',
    nama: 'Puskesmas Pembantu Suka Maju',
    kategori: 'fasilitas',
    lat: 3.5503,
    lng: 98.6952,
    alamat: 'Jl. Kesehatan No. 5',
    jam: 'Senin–Sabtu 08.00–14.00',
    deskripsi: 'Pelayanan kesehatan dasar untuk warga kelurahan.',
    foto: null,
  },
  {
    id: 'fas-2',
    nama: 'Lapangan Olahraga Suka Maju',
    kategori: 'fasilitas',
    lat: 3.5478,
    lng: 98.6918,
    alamat: 'Jl. Merdeka No. 10',
    jam: 'Setiap hari 06.00–21.00',
    deskripsi: 'Lapangan serbaguna untuk kegiatan olahraga dan acara kelurahan.',
    foto: null,
  },
  {
    id: 'ibadah-1',
    nama: 'Masjid Al-Ikhlas',
    kategori: 'ibadah',
    lat: 3.5497,
    lng: 98.6908,
    alamat: 'Jl. Al-Ikhlas No. 2',
    deskripsi: 'Masjid utama lingkungan Kelurahan Suka Maju.',
    foto: null,
  },
  {
    id: 'pend-1',
    nama: 'SDN 067246 Suka Maju',
    kategori: 'pendidikan',
    lat: 3.5476,
    lng: 98.6945,
    alamat: 'Jl. Pendidikan No. 3',
    jam: 'Senin–Sabtu 07.00–13.00',
    deskripsi: 'Sekolah dasar negeri di wilayah Kelurahan Suka Maju.',
    foto: null,
  },
];

// ── Komponen tombol Fullscreen
function FullscreenButton() {
  const map = useMap();
  const [fs, setFs] = useState(false);
  const toggle = useCallback(() => {
    const el = map.getContainer().parentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setFs(true));
    } else {
      document.exitFullscreen?.().then(() => setFs(false));
    }
  }, [map]);
  return (
    <button
      onClick={toggle}
      title={fs ? 'Keluar Layar Penuh' : 'Layar Penuh'}
      className="leaflet-control leaflet-bar"
      style={{
        position: 'absolute', top: 80, right: 10, zIndex: 1000,
        background: 'white', border: '2px solid rgba(0,0,0,0.2)',
        borderRadius: 4, padding: '4px 6px', cursor: 'pointer',
        fontSize: 16, lineHeight: 1,
      }}
    >
      {fs ? '⛶' : '⛶'}
    </button>
  );
}

// ── Komponen geolokasi
function GeoButton({ onLocate }) {
  const map = useMap();
  const locate = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        map.flyTo(latlng, 17, { duration: 1.5 });
        onLocate(latlng, pos.coords.accuracy);
      },
      () => alert('Gagal mendapatkan lokasi. Pastikan izin lokasi diaktifkan.'),
    );
  }, [map, onLocate]);
  return (
    <button
      onClick={locate}
      title="Temukan Lokasi Saya"
      style={{
        position: 'absolute', top: 120, right: 10, zIndex: 1000,
        background: 'white', border: '2px solid rgba(0,0,0,0.2)',
        borderRadius: 4, padding: '4px 6px', cursor: 'pointer',
        fontSize: 16, lineHeight: 1,
      }}
    >
      📍
    </button>
  );
}

// ── Komponen utama
export default function PetaKelurahan({ mode = 'public', canEdit = false, umkmList = [] }) {
  const [titik, setTitik] = useState(DEFAULT_TITIK);
  const [filter, setFilter] = useState('semua');
  const [userLoc, setUserLoc] = useState(null);
  const [userAcc, setUserAcc] = useState(null);
  const [cari, setCari] = useState('');
  const [modalAdd, setModalAdd] = useState(false);
  const [modalData, setModalData] = useState({ nama:'', kategori:'umkm', lat:'', lng:'', alamat:'', telepon:'', jam:'', deskripsi:'' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Muat UMKM dari prop atau default
  useEffect(() => {
    if (umkmList && umkmList.length > 0) {
      const mapped = umkmList
        .filter(u => u.lat && u.lng)
        .map(u => ({
          id: 'umkm-' + u.id,
          nama: u.nama,
          kategori: 'umkm',
          lat: parseFloat(u.lat),
          lng: parseFloat(u.lng),
          alamat: u.alamat || '',
          telepon: u.telepon || '',
          deskripsi: u.deskripsi || '',
          foto: u.foto_url || null,
        }));
      if (mapped.length > 0) {
        setTitik(prev => [
          ...prev.filter(t => t.kategori !== 'umkm'),
          ...mapped,
        ]);
      }
    }
  }, [umkmList]);

  // Filter & cari
  const tampil = titik.filter(t => {
    const cocokKat = filter === 'semua' || t.kategori === filter;
    const cocokCari = !cari || t.nama.toLowerCase().includes(cari.toLowerCase()) || t.alamat?.toLowerCase().includes(cari.toLowerCase());
    return cocokKat && cocokCari;
  });

  // Tambah titik baru (admin/petugas)
  async function handleTambah(e) {
    e.preventDefault();
    if (!modalData.lat || !modalData.lng) return alert('Isi koordinat lintang & bujur.');
    setSaving(true);
    const baru = {
      id: Date.now().toString(),
      ...modalData,
      lat: parseFloat(modalData.lat),
      lng: parseFloat(modalData.lng),
    };
    setTitik(prev => [...prev, baru]);
    setModalAdd(false);
    setModalData({ nama:'', kategori:'umkm', lat:'', lng:'', alamat:'', telepon:'', jam:'', deskripsi:'' });
    setSaving(false);
  }

  function hapusTitik(id) {
    if (!confirm('Hapus titik ini dari peta?')) return;
    setTitik(prev => prev.filter(t => t.id !== id));
  }

  const catCounts = Object.keys(CATEGORIES).reduce((acc, k) => {
    acc[k] = titik.filter(t => t.kategori === k).length;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1a3a5c]">🗺️ Peta Interaktif Kelurahan</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Temukan lokasi kantor, UMKM, fasilitas & tempat penting di wilayah kelurahan
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setModalAdd(true)}
            className="btn btn-p shrink-0 flex items-center gap-2"
          >
            ➕ Tambah Titik
          </button>
        )}
      </div>

      {/* Filter & Search */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="🔍 Cari nama / alamat…"
          value={cari}
          onChange={e => setCari(e.target.value)}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm flex-1 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]/30"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('semua')}
            className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
              filter === 'semua'
                ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Semua ({titik.length})
          </button>
          {Object.entries(CATEGORIES).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                filter === key
                  ? 'text-white border-transparent'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
              style={filter === key ? { background: cfg.color } : {}}
            >
              {cfg.emoji} {cfg.label} ({catCounts[key] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Peta */}
      <div className="relative rounded-xl overflow-hidden border-2 border-[#1a3a5c]/20 shadow-lg" style={{ height: 500 }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Titik-titik */}
          {tampil.map(t => (
            <Marker key={t.id} position={[t.lat, t.lng]} icon={makeIcon(t.kategori)}>
              <Popup maxWidth={280} className="leaflet-popup-custom">
                <div className="p-1 min-w-[220px]">
                  {/* Badge kategori */}
                  <div
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full mb-2"
                    style={{
                      background: CATEGORIES[t.kategori]?.bg || '#f8fafc',
                      color: CATEGORIES[t.kategori]?.color || '#64748b',
                    }}
                  >
                    {CATEGORIES[t.kategori]?.emoji} {CATEGORIES[t.kategori]?.label}
                  </div>

                  {/* Foto */}
                  {t.foto && (
                    <img src={t.foto} alt={t.nama} className="w-full h-28 object-cover rounded mb-2" />
                  )}

                  <h3 className="font-bold text-[#1a3a5c] text-sm leading-tight mb-1">{t.nama}</h3>

                  {t.alamat && (
                    <p className="text-xs text-slate-600 flex gap-1 mt-1">
                      <span>📌</span><span>{t.alamat}</span>
                    </p>
                  )}
                  {t.telepon && (
                    <p className="text-xs text-slate-600 flex gap-1 mt-0.5">
                      <span>📞</span>
                      <a href={`tel:${t.telepon}`} className="text-blue-600 hover:underline">{t.telepon}</a>
                    </p>
                  )}
                  {t.jam && (
                    <p className="text-xs text-slate-600 flex gap-1 mt-0.5">
                      <span>🕐</span><span>{t.jam}</span>
                    </p>
                  )}
                  {t.deskripsi && (
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed border-t border-slate-100 pt-1.5">
                      {t.deskripsi}
                    </p>
                  )}

                  {/* Link Google Maps */}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#1a3a5c] hover:bg-[#163150] px-3 py-1.5 rounded w-full justify-center"
                  >
                    🧭 Petunjuk Arah
                  </a>

                  {canEdit && (
                    <button
                      onClick={() => hapusTitik(t.id)}
                      className="mt-1 text-xs text-rose-600 hover:underline w-full text-center"
                    >
                      🗑 Hapus titik ini
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Lingkaran lokasi pengguna */}
          {userLoc && (
            <>
              <Circle
                center={userLoc}
                radius={userAcc || 50}
                pathOptions={{ color: '#3b82f6', fillColor: '#93c5fd', fillOpacity: 0.3, weight: 2 }}
              />
              <Marker
                position={userLoc}
                icon={L.divIcon({
                  className: '',
                  html: `<div style="
                    width:16px;height:16px;border-radius:50%;
                    background:#3b82f6;border:3px solid white;
                    box-shadow:0 0 0 4px rgba(59,130,246,0.3);
                  "></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8],
                })}
              >
                <Popup><p className="text-sm font-semibold text-blue-700">📍 Lokasi Anda</p></Popup>
              </Marker>
            </>
          )}

          {/* Tombol kontrol */}
          <GeoButton onLocate={(latlng, acc) => { setUserLoc(latlng); setUserAcc(acc); }} />
        </MapContainer>
      </div>

      {/* Legenda */}
      <div className="bg-white rounded-lg border border-slate-200 p-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Legenda</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(CATEGORIES).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-slate-700">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
                style={{ background: cfg.color }}
              >
                {cfg.emoji}
              </div>
              <span>{cfg.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <div className="w-4 h-4 rounded-full border-2 border-blue-400 bg-blue-200" />
            <span>Lokasi Anda</span>
          </div>
        </div>
      </div>

      {/* Daftar Lokasi */}
      <div>
        <h3 className="text-sm font-bold text-[#1a3a5c] mb-2">📋 Daftar Lokasi ({tampil.length})</h3>
        {tampil.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
            Tidak ada lokasi yang cocok dengan pencarian/filter
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tampil.map(t => {
              const cfg = CATEGORIES[t.kategori] || CATEGORIES.lain;
              return (
                <div
                  key={t.id}
                  className="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-md transition-shadow"
                  style={{ borderLeftColor: cfg.color, borderLeftWidth: 4 }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                      style={{ background: cfg.bg }}
                    >
                      {cfg.emoji}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#1a3a5c] leading-tight">{t.nama}</p>
                      {t.alamat && <p className="text-xs text-slate-500 mt-0.5 truncate">{t.alamat}</p>}
                      {t.jam && <p className="text-xs text-slate-400 mt-0.5">🕐 {t.jam}</p>}
                      {t.telepon && (
                        <a href={`tel:${t.telepon}`} className="text-xs text-blue-600 hover:underline mt-0.5 block">
                          📞 {t.telepon}
                        </a>
                      )}
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-xs text-[#1a3a5c] hover:underline flex items-center gap-1 justify-end"
                  >
                    🧭 Petunjuk Arah →
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tambah Titik (admin/petugas) */}
      {modalAdd && canEdit && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-[#1a3a5c]">➕ Tambah Titik Lokasi</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tip: Buka Google Maps → klik lokasi → salin koordinat lintang & bujur
              </p>
            </div>
            <form onSubmit={handleTambah} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Nama Lokasi *</label>
                <input required value={modalData.nama} onChange={e => setModalData(p=>({...p,nama:e.target.value}))}
                  className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Kategori *</label>
                <select value={modalData.kategori} onChange={e => setModalData(p=>({...p,kategori:e.target.value}))}
                  className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white">
                  {Object.entries(CATEGORIES).map(([k,c]) => (
                    <option key={k} value={k}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Lintang (lat) *</label>
                  <input required type="number" step="any" placeholder="3.5490"
                    value={modalData.lat} onChange={e => setModalData(p=>({...p,lat:e.target.value}))}
                    className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Bujur (lng) *</label>
                  <input required type="number" step="any" placeholder="98.6937"
                    value={modalData.lng} onChange={e => setModalData(p=>({...p,lng:e.target.value}))}
                    className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Alamat</label>
                <input value={modalData.alamat} onChange={e => setModalData(p=>({...p,alamat:e.target.value}))}
                  className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Telepon</label>
                <input value={modalData.telepon} onChange={e => setModalData(p=>({...p,telepon:e.target.value}))}
                  className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Jam Operasional</label>
                <input placeholder="Senin–Jumat 08.00–16.00"
                  value={modalData.jam} onChange={e => setModalData(p=>({...p,jam:e.target.value}))}
                  className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Deskripsi</label>
                <textarea rows={3} value={modalData.deskripsi} onChange={e => setModalData(p=>({...p,deskripsi:e.target.value}))}
                  className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalAdd(false)}
                  className="flex-1 btn btn-outline">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="flex-1 btn btn-p">
                  {saving ? 'Menyimpan…' : '✔ Simpan Titik'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
