import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'sipesur_a11y_prefs';

const DEFAULT_PREFS = {
  fontScale: 100, // 90 | 100 | 115 | 130
  theme: 'normal', // 'normal' | 'dark' | 'contrast'
  readable: false,
  clickToRead: false,
};

function getIndonesianVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  return (
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('id')) ||
    voices.find((v) => v.name && v.name.toLowerCase().includes('indonesia')) ||
    null
  );
}

function speakIndonesian(text, { onStart, onEnd, onError } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.('Browser Anda belum mendukung fitur suara (Text-to-Speech).');
    return;
  }
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    onError?.('Tidak ada teks yang dapat dibacakan pada bagian ini.');
    return;
  }

  window.speechSynthesis.cancel();

  // Pecah teks per kalimat (maks ~220 karakter) agar tidak terpotong oleh batas browser
  const sentences = clean.match(/[^.!?]+[.!?]*/g) || [clean];
  const chunks = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).trim().length > 220 && buf) {
      chunks.push(buf.trim());
      buf = s;
    } else {
      buf = (buf + ' ' + s).trim();
    }
  }
  if (buf) chunks.push(buf.trim());

  const voice = getIndonesianVoice();
  onStart?.();

  chunks.forEach((chunk, idx) => {
    const utter = new SpeechSynthesisUtterance(chunk);
    utter.lang = 'id-ID';
    if (voice) utter.voice = voice;
    utter.rate = 0.95;
    utter.pitch = 1;
    if (idx === chunks.length - 1) {
      utter.onend = () => onEnd?.();
      utter.onerror = () => onEnd?.();
    }
    window.speechSynthesis.speak(utter);
  });
}

export default function AccessibilityPanel() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ttsNotice, setTtsNotice] = useState('');
  const panelRef = useRef(null);

  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Terapkan preferensi ke <html> dan simpan ke localStorage
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${prefs.fontScale}%`;

    root.classList.toggle('a11y-dark', prefs.theme === 'dark');
    root.classList.toggle('a11y-contrast', prefs.theme === 'contrast');
    root.classList.toggle('a11y-readable', Boolean(prefs.readable));

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [prefs]);

  // Mode Baca Saat Klik Elemen
  useEffect(() => {
    if (!prefs.clickToRead || !ttsSupported) return;

    const onDocClick = (e) => {
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      const target = e.target.closest('h1, h2, h3, h4, p, li, a, button, label, td, th');
      if (!target) return;
      const txt = target.getAttribute('aria-label') || target.innerText || '';
      if (txt.trim().length > 1) {
        speakIndonesian(txt.slice(0, 350), {
          onStart: () => {
            setSpeaking(true);
            setPaused(false);
          },
          onEnd: () => {
            setSpeaking(false);
            setPaused(false);
          },
        });
      }
    };

    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [prefs.clickToRead, ttsSupported]);

  // Hentikan suara saat komponen unmount
  useEffect(() => {
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, [ttsSupported]);

  const handleReadPage = () => {
    setTtsNotice('');
    const rootEl = document.querySelector('main') || document.body;
    const nodes = rootEl.querySelectorAll('h1, h2, h3, p, li');
    const parts = [];
    nodes.forEach((el) => {
      if (panelRef.current && panelRef.current.contains(el)) return;
      const t = (el.innerText || '').trim();
      if (t && !parts.includes(t)) parts.push(t);
    });
    const fullText = parts.join('. ').slice(0, 3500);
    speakIndonesian(fullText, {
      onStart: () => {
        setSpeaking(true);
        setPaused(false);
      },
      onEnd: () => {
        setSpeaking(false);
        setPaused(false);
      },
      onError: (msg) => setTtsNotice(msg),
    });
  };

  const handlePauseResume = () => {
    if (!ttsSupported) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  };

  const handleStopSpeech = () => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  };

  const handleReset = () => {
    handleStopSpeech();
    setTtsNotice('');
    setPrefs(DEFAULT_PREFS);
  };

  const isModified =
    prefs.fontScale !== 100 ||
    prefs.theme !== 'normal' ||
    prefs.readable ||
    prefs.clickToRead;

  return (
    <div ref={panelRef} className="no-print fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      {open && (
        <div
          role="dialog"
          aria-label="Panel Aksesibilitas Ramah Lansia dan Mode Gelap"
          className="w-[320px] sm:w-[350px] max-h-[82vh] overflow-y-auto rounded-2xl border-2 border-[#c8a84b]/60 bg-white text-slate-900 shadow-2xl p-4 space-y-4"
        >
          {/* Header Panel */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a3a5c] text-[#c8a84b] text-lg font-bold shadow-sm">
                ♿
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1a3a5c] leading-tight">Panel Aksesibilitas</h3>
                <p className="text-[11px] text-slate-500">Ramah Lansia &amp; Mode Gelap</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup panel aksesibilitas"
              className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              ✕
            </button>
          </div>

          {/* 1. Ukuran Teks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>🔠 Ukuran Teks</span>
              <span className="font-mono text-[#1a3a5c]">{prefs.fontScale}%</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { v: 90, label: 'A-' },
                { v: 100, label: 'Normal' },
                { v: 115, label: 'A+' },
                { v: 130, label: 'A++' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, fontScale: opt.v }))}
                  className={`rounded-lg border py-2 text-xs font-bold transition-all ${
                    prefs.fontScale === opt.v
                      ? 'bg-[#1a3a5c] text-white border-[#1a3a5c] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#1a3a5c]/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Mode Tampilan Layar */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700">🎨 Tampilan Layar</div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { v: 'normal', icon: '☀️', label: 'Normal' },
                { v: 'dark', icon: '🌙', label: 'Gelap' },
                { v: 'contrast', icon: '◑', label: 'Kontras' },
              ].map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, theme: t.v }))}
                  className={`rounded-lg border py-2 px-1.5 text-xs font-bold flex flex-col items-center gap-0.5 transition-all ${
                    prefs.theme === t.v
                      ? 'bg-[#1a3a5c] text-white border-[#1a3a5c] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#1a3a5c]/50'
                  }`}
                >
                  <span className="text-base">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Keterbacaan Ekstra */}
          <button
            type="button"
            onClick={() => setPrefs((p) => ({ ...p, readable: !p.readable }))}
            className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs font-bold flex items-center justify-between transition-all ${
              prefs.readable
                ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <span>📖 Spasi Teks &amp; Garis Bawah Link</span>
            <span className={`px-2 py-0.5 rounded text-[10px] ${prefs.readable ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {prefs.readable ? 'AKTIF' : 'OFF'}
            </span>
          </button>

          {/* 4. Bacakan Halaman (Suara Bahasa Indonesia) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
            <div className="text-xs font-bold text-[#1a3a5c]">🔊 Suara Bahasa Indonesia</div>
            {!ttsSupported ? (
              <p className="text-[11px] text-rose-700">Browser Anda belum mendukung fitur pembaca layar.</p>
            ) : (
              <>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleReadPage}
                    className="flex-1 rounded-lg bg-[#1a3a5c] hover:bg-[#122a45] text-white py-2 px-3 text-xs font-bold transition-colors"
                  >
                    🔊 Bacakan Halaman
                  </button>
                  {speaking && (
                    <>
                      <button
                        type="button"
                        onClick={handlePauseResume}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                        title={paused ? 'Lanjutkan suara' : 'Jeda suara'}
                      >
                        {paused ? '▶️' : '⏸️'}
                      </button>
                      <button
                        type="button"
                        onClick={handleStopSpeech}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        title="Hentikan suara"
                      >
                        ⏹️
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, clickToRead: !p.clickToRead }))}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left text-[11px] font-bold flex items-center justify-between transition-all ${
                    prefs.clickToRead
                      ? 'bg-amber-50 border-[#c8a84b] text-[#1a3a5c]'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <span>👆 Bacakan Saat Teks Diklik</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${prefs.clickToRead ? 'bg-[#1a3a5c] text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {prefs.clickToRead ? 'AKTIF' : 'OFF'}
                  </span>
                </button>
                {ttsNotice && <p className="text-[11px] text-amber-800">{ttsNotice}</p>}
              </>
            )}
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={handleReset}
            className="w-full rounded-xl border border-slate-300 bg-white hover:bg-slate-100 py-2 text-xs font-bold text-slate-700 transition-colors"
          >
            ↺ Reset ke Pengaturan Awal
          </button>
        </div>
      )}

      {/* Tombol Mengambang di Pojok Layar */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Panel Aksesibilitas Ramah Lansia dan Mode Gelap"
        title="Aksesibilitas: Perbesar Teks, Mode Gelap, & Suara Bahasa Indonesia"
        className="relative flex items-center gap-2 rounded-full border-2 border-[#c8a84b] bg-[#1a3a5c] hover:bg-[#122a45] text-white px-3.5 py-2.5 shadow-xl transition-all hover:scale-105 active:scale-95"
      >
        <span className="text-lg leading-none">♿</span>
        <span className="hidden sm:inline text-xs font-bold tracking-wide">Aksesibilitas</span>
        {isModified && (
          <span
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#c8a84b] ring-2 ring-white"
            title="Pengaturan aksesibilitas aktif"
          />
        )}
      </button>
    </div>
  );
}
