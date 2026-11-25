import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';

// Template body default per kode surat
const TEMPLATE_DEFAULT = {
  SKD: 'adalah benar warga dan berdomisili di wilayah kelurahan kami. Surat keterangan domisili ini diberikan untuk keperluan yang bersangkutan sesuai permohonan.',
  SKTM: 'adalah benar warga kelurahan kami dan berdasarkan hasil verifikasi lapangan, yang bersangkutan tergolong ke dalam warga tidak mampu secara ekonomi. Surat ini diterbitkan untuk keperluan yang bersangkutan.',
  SKCK: 'adalah warga kelurahan kami yang bermaksud mengurus Surat Keterangan Catatan Kepolisian (SKCK) di Polsek/Polres setempat. Yang bersangkutan adalah warga yang baik dan tidak pernah terlibat tindak pidana berdasarkan catatan lingkungan setempat.',
  SKU: 'adalah warga kelurahan kami yang menjalankan usaha aktif di wilayah kelurahan. Surat ini dibuat untuk menerangkan keberadaan usaha yang bersangkutan sesuai dengan keadaan sebenarnya.',
  SKLH: 'adalah warga kelurahan kami. Surat ini menerangkan bahwa telah lahir seorang anak yang merupakan anggota keluarga yang bersangkutan, sebagaimana data yang tertera.',
  SKM: 'adalah warga kelurahan kami. Surat ini menerangkan bahwa telah terjadi peristiwa kematian dalam keluarga yang bersangkutan. Surat ini dibuat untuk keperluan pelaporan resmi sesuai ketentuan yang berlaku.',
  SKBM: 'adalah warga kelurahan kami. Berdasarkan data kependudukan dan hasil verifikasi, yang bersangkutan hingga saat ini berstatus belum pernah menikah. Surat ini dibuat untuk keperluan yang bersangkutan.',
  SPP: 'adalah warga kelurahan kami yang bermaksud melakukan pindah domisili. Surat pengantar ini dibuat untuk mempermudah proses administrasi kependudukan yang bersangkutan di tempat tujuan.',
};

/**
 * Helper: Parse base64 image data URL ke buffer
 */
function parseBase64Image(dataStr) {
  if (!dataStr) return null;
  try {
    if (dataStr.startsWith('data:image')) {
      const base64Data = dataStr.replace(/^data:image\/\w+;base64,/, '');
      return Buffer.from(base64Data, 'base64');
    }
    if (fs.existsSync(dataStr)) {
      return fs.readFileSync(dataStr);
    }
  } catch (err) {
    console.error('[PDF] Gagal membaca data gambar tanda tangan / logo:', err.message);
  }
  return null;
}

/**
 * Helper: Sanitasi & standarisasi data Profil Kelurahan resmi Suka Maju Medan Johor
 */
function getKopResmi(kop = {}) {
  const isOld = (s) => !s || /merdeka|contoh|sukamaju(?!\.medan)|\(021\)|12345/i.test(String(s));

  const pemkab = (!isOld(kop.kabupaten_kota) ? kop.kabupaten_kota : 'Pemerintah Kota Medan').toUpperCase();
  const namaDesa = (!isOld(kop.nama_desa) ? kop.nama_desa : 'Kelurahan Suka Maju').toUpperCase();
  const namaKec = (!isOld(kop.kecamatan) ? kop.kecamatan : 'Kecamatan Medan Johor').toUpperCase();
  const alamat = !isOld(kop.alamat) ? kop.alamat : 'Jl. STM No. 40, Kelurahan Suka Maju';
  const telepon = !isOld(kop.telepon) ? kop.telepon : '0823-4123-5734';
  const kodePos = !isOld(kop.kode_pos) ? kop.kode_pos : '20146';
  const email = !isOld(kop.email) ? kop.email : 'kelurahan@pemkomedan.go.id';
  const website = !isOld(kop.website) ? kop.website : 'sukamaju.medan.go.id';
  const alamatLengkap = `${alamat}, Telp. ${telepon} • Kode Pos: ${kodePos}`;

  return {
    pemkab,
    namaDesa,
    namaKec,
    alamat,
    telepon,
    kodePos,
    email,
    website,
    alamatLengkap,
    logoUrl: kop.logo_url || null,
  };
}

/**
 * Buat PDF surat keterangan resmi kelurahan dengan Kop & TTD Dinamis (Format Pas 1 Halaman A4).
 */
export async function buatPdf(opts, file) {
  const {
    nomor,
    jenis,
    kode,
    template,
    pembuka: customPembuka,
    penutup: customPenutup,
    fields = [],
    data = {},
    warga = {},
    kop = {},
    lurah = 'Muhammad Iqbal Samosir, S.E., M.A.P.',
    nip = '198506122010011005',
    jabatan = 'Lurah Suka Maju',
    tanda_tangan = null,
    url,
    tanggal,
  } = opts;

  const kopInfo = getKopResmi(kop);
  const infoKontak = [
    kopInfo.email ? `Email: ${kopInfo.email}` : '',
    kopInfo.website ? `Website: ${kopInfo.website}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  // Buat QR code verifikasi
  const qrBuffer = await QRCode.toBuffer(url || 'https://sipesur.id', {
    margin: 1,
    width: 120,
  });

  const sigBuffer = parseBase64Image(tanda_tangan);
  const logoBuffer = parseBase64Image(kopInfo.logoUrl);

  // Inisialisasi dokumen PDF (Margin bottom: 15 agar footer tidak melewati batas bawah dan tidak memicu lembar ke-2)
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 34, bottom: 15, left: 44, right: 44 },
    bufferPages: true,
    autoFirstPage: true,
  });

  const stream = fs.createWriteStream(file);
  doc.pipe(stream);

  const L = 44;   // margin kiri
  const R = 551;  // margin kanan (lebar isi = 507)
  const W = 507;  // lebar konten

  // ----------------------------------------------------------------
  // 1. KOP SURAT DINAMIS RESMI
  // ----------------------------------------------------------------
  const kopStartY = doc.y;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, L, kopStartY, { width: 55, height: 55, fit: [55, 55] });
    } catch (e) {
      console.warn('[PDF] Logo tidak dapat dimuat, dilewati:', e.message);
    }
  }

  doc.font('Helvetica-Bold').fontSize(11.5).text(kopInfo.pemkab, L, doc.y, { align: 'center', width: W });
  doc.font('Helvetica-Bold').fontSize(13).text(kopInfo.namaDesa, { align: 'center', width: W });
  doc.font('Helvetica-Bold').fontSize(10.5).text(kopInfo.namaKec, { align: 'center', width: W });
  doc.font('Helvetica').fontSize(8.5).text(kopInfo.alamatLengkap, { align: 'center', width: W });
  if (infoKontak) {
    doc.font('Helvetica').fontSize(8).text(infoKontak, { align: 'center', width: W });
  }

  // Garis pembatas tebal ganda standar resmi pemerintah
  const lineY = Math.max(doc.y + 5, kopStartY + (logoBuffer ? 58 : 0));
  doc.y = lineY;
  doc.moveTo(L, lineY).lineTo(R, lineY).lineWidth(2.2).stroke();
  doc.moveTo(L, lineY + 2.5).lineTo(R, lineY + 2.5).lineWidth(0.5).stroke();
  doc.lineWidth(1);
  doc.y = lineY + 4;

  // ----------------------------------------------------------------
  // 2. JUDUL & NOMOR SURAT
  // ----------------------------------------------------------------
  doc.moveDown(0.7);
  doc.font('Helvetica-Bold').fontSize(12).text(jenis.toUpperCase(), L, doc.y, {
    align: 'center',
    width: W,
    underline: true,
  });
  doc.font('Helvetica').fontSize(9.5).text(`Nomor: ${nomor}`, L, doc.y + 3, { align: 'center', width: W });

  // ----------------------------------------------------------------
  // 3. KALIMAT PEMBUKA
  // ----------------------------------------------------------------
  doc.moveDown(0.7);
  const kalimatPembuka = customPembuka || `Yang bertanda tangan di bawah ini, ${jabatan} ${kopInfo.namaDesa}, ${kopInfo.namaKec}, ${kopInfo.pemkab}, dengan ini menerangkan bahwa:`;
  doc.font('Helvetica').fontSize(9.5).text(
    kalimatPembuka,
    L,
    doc.y,
    { width: W, align: 'justify', lineGap: 1.5 }
  );

  // ----------------------------------------------------------------
  // 4. DATA IDENTITAS WARGA (Tabel)
  // ----------------------------------------------------------------
  doc.moveDown(0.5);

  const identitasRows = [
    ['Nama Lengkap', warga.nama],
    ['NIK', warga.nik],
    ['Tempat / Tgl. Lahir', `${warga.tempat_lahir || '-'}, ${warga.tanggal_lahir || '-'}`],
    ['Jenis Kelamin', warga.jenis_kelamin || '-'],
    ['Alamat', warga.alamat],
    ['Pekerjaan', warga.pekerjaan || '-'],
    ['No. Telepon', warga.telepon || '-'],
  ];

  const colKey = L + 8;
  const colSep = L + 150;
  const colVal = L + 160;
  const valWidth = R - colVal;

  doc.font('Helvetica').fontSize(9.5);
  for (const [key, val] of identitasRows) {
    const startY = doc.y;
    const textHeight = doc.heightOfString(String(val || '-'), { width: valWidth, lineGap: 1 });
    const rowH = Math.max(textHeight, 13) + 1;

    doc.text(key, colKey, startY, { width: 140 });
    doc.text(':', colSep, startY, { width: 8 });
    doc.text(String(val || '-'), colVal, startY, { width: valWidth, lineGap: 1 });

    doc.y = startY + rowH;
  }

  // ----------------------------------------------------------------
  // 5. DATA FORM TAMBAHAN (Jika Ada)
  // ----------------------------------------------------------------
  const dataEntries = Object.entries(data || {}).filter(
    ([k, v]) => v !== null && v !== undefined && v !== '' && !['redaksi_kustom', 'pembuka_kustom', 'penutup_kustom'].includes(k)
  );

  if (dataEntries.length > 0 && fields.length > 0) {
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9.5).text('Keterangan Tambahan:', colKey, doc.y, { width: W - 10 });
    doc.font('Helvetica').fontSize(9.5);

    for (const f of fields) {
      const val = data[f.name];
      if (val === null || val === undefined || val === '') continue;
      const startY = doc.y;
      const textHeight = doc.heightOfString(String(val), { width: valWidth, lineGap: 1 });
      const rowH = Math.max(textHeight, 13) + 1;
      doc.text(f.label || f.name, colKey, startY, { width: 140 });
      doc.text(':', colSep, startY, { width: 8 });
      doc.text(String(val), colVal, startY, { width: valWidth, lineGap: 1 });
      doc.y = startY + rowH;
    }
  }

  // ----------------------------------------------------------------
  // 6. BODY / ISI SURAT
  // ----------------------------------------------------------------
  doc.moveDown(0.5);

  const bodyText = (template && template.trim())
    ? template.trim()
    : (TEMPLATE_DEFAULT[kode] || `adalah benar warga ${kopInfo.namaDesa}.`);

  doc.font('Helvetica').fontSize(9.5).text(
    `Demikian bahwa yang bersangkutan ${bodyText}`,
    L,
    doc.y,
    { width: W, align: 'justify', lineGap: 1.5 }
  );

  // ----------------------------------------------------------------
  // 7. KALIMAT PENUTUP
  // ----------------------------------------------------------------
  doc.moveDown(0.5);
  const kalimatPenutup = customPenutup || 'Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.';
  doc.font('Helvetica').fontSize(9.5).text(
    kalimatPenutup,
    L,
    doc.y,
    { width: W, align: 'justify', lineGap: 1.5 }
  );

  // ----------------------------------------------------------------
  // 8. TANDA TANGAN, CAP KELURAHAN & QR CODE (Tepat di Bagian Bawah Halaman 1)
  // ----------------------------------------------------------------
  const sigY = Math.min(Math.max(doc.y + 10, 600), 635);

  // QR Code (kiri bawah)
  doc.image(qrBuffer, L + 10, sigY, { width: 72 });
  doc.font('Helvetica').fontSize(7).fillColor('#333333').text(
    'Pindai QR untuk verifikasi\nkeaslian dokumen resmi',
    L,
    sigY + 76,
    { width: 92, align: 'center', lineBreak: true }
  );

  // Area tanda tangan (kanan bawah)
  const sigX = 325;
  const sigW = 220;
  const namaLokasi = kopInfo.namaDesa ? kopInfo.namaDesa.replace(/^(kelurahan|desa)\s+/i, '') : 'Suka Maju';
  const lokasiTgl = `${namaLokasi}, ${tanggal}`;

  doc.font('Helvetica').fontSize(9.5).fillColor('#000000').text(lokasiTgl, sigX, sigY, { width: sigW, align: 'center' });
  doc.font('Helvetica').fontSize(9.5).text(`${jabatan} ${kopInfo.namaDesa}`, sigX, doc.y + 2, { width: sigW, align: 'center' });

  // Tanda Tangan Gambar (jika ada)
  const ttdTopY = doc.y + 3;

  if (sigBuffer) {
    try {
      doc.image(sigBuffer, sigX + 45, ttdTopY, { width: 130, height: 42, fit: [130, 42] });
    } catch (sigErr) {
      console.warn('[PDF] Gagal menyematkan tanda tangan gambar:', sigErr.message);
    }
  }

  // Stempel Digital Resmi Kelurahan Suka Maju (Cap basah ungu/merah transparan)
  try {
    const stampRadius = 24;
    const stampCenterX = sigX + 55;
    const stampCenterY = ttdTopY + 20;

    doc.save();
    doc.opacity(0.42);
    doc.lineWidth(1.1);
    doc.circle(stampCenterX, stampCenterY, stampRadius).stroke('#4f5b93');
    doc.circle(stampCenterX, stampCenterY, stampRadius - 2.5).stroke('#4f5b93');
    doc.font('Helvetica-Bold').fontSize(6).fillColor('#4f5b93');
    doc.text('PEMERINTAH KOTA', stampCenterX - 24, stampCenterY - 12, { width: 48, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(5).text('★ KELURAHAN ★', stampCenterX - 24, stampCenterY - 2, { width: 48, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(5.5).text('RESMI TERVERIFIKASI', stampCenterX - 24, stampCenterY + 7, { width: 48, align: 'center' });
    doc.restore();
  } catch (stampErr) {
    // Ignore stempel error if any
  }

  doc.y = ttdTopY + 46;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000000').text(lurah, sigX, doc.y, {
    width: sigW,
    align: 'center',
    underline: true,
  });
  doc.font('Helvetica').fontSize(8.5).text(`NIP. ${nip || '-'}`, sigX, doc.y + 2, { width: sigW, align: 'center' });

  // ----------------------------------------------------------------
  // 9. FOOTER RESMI (Pas di Batas Bawah Halaman 1 A4)
  // ----------------------------------------------------------------
  const footerY = 804;
  doc.moveTo(L, footerY - 5).lineTo(R, footerY - 5).lineWidth(0.5).stroke('#cbd5e1');
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(
    `${kopInfo.namaDesa} • ${kopInfo.alamatLengkap}`,
    L,
    footerY,
    { width: W, align: 'center', lineBreak: false }
  );

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

/**
 * Buat PDF Surat Dinas / Balasan Resmi Kelurahan dengan Kop Dinamis & TTD Lurah (Pas 1 Halaman A4).
 */
export async function buatPdfSuratDinas(opts, file) {
  const {
    nomor,
    tujuan,
    perihal,
    isi,
    tanggal,
    kop = {},
    lurah = 'Muhammad Iqbal Samosir, S.E., M.A.P.',
    nip = '198506122010011005',
    jabatan = 'Lurah Suka Maju',
    tanda_tangan = null,
  } = opts;

  const kopInfo = getKopResmi(kop);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 34, bottom: 15, left: 44, right: 44 },
    bufferPages: true,
    autoFirstPage: true,
  });

  const stream = fs.createWriteStream(file);
  doc.pipe(stream);

  const L = 44;
  const R = 551;
  const W = 507;

  // KOP SURAT DINAMIS
  const kopStartY = doc.y;
  const logoBuffer = parseBase64Image(kopInfo.logoUrl);
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, L, kopStartY, { width: 55, height: 55, fit: [55, 55] });
    } catch (e) { }
  }

  doc.font('Helvetica-Bold').fontSize(11.5).text(kopInfo.pemkab, L, doc.y, { align: 'center', width: W });
  doc.font('Helvetica-Bold').fontSize(13).text(kopInfo.namaDesa, { align: 'center', width: W });
  doc.font('Helvetica-Bold').fontSize(10.5).text(kopInfo.namaKec, { align: 'center', width: W });
  doc.font('Helvetica').fontSize(8.5).text(kopInfo.alamatLengkap, { align: 'center', width: W });

  const lineY = Math.max(doc.y + 5, kopStartY + (logoBuffer ? 58 : 0));
  doc.y = lineY;
  doc.moveTo(L, lineY).lineTo(R, lineY).lineWidth(2.2).stroke();
  doc.moveTo(L, lineY + 2.5).lineTo(R, lineY + 2.5).lineWidth(0.5).stroke();
  doc.lineWidth(1);
  doc.y = lineY + 4;

  // Tanggal & Nomor Surat
  doc.moveDown(1.0);
  const startY = doc.y;
  const namaLokasi = kopInfo.namaDesa ? kopInfo.namaDesa.replace(/^(kelurahan|desa)\s+/i, '') : 'Suka Maju';
  const lokasiTgl = `${namaLokasi}, ${tanggal}`;

  doc.font('Helvetica').fontSize(9.5);
  doc.text(`Nomor     : ${nomor}`, L, startY);
  doc.text('Sifat        : Penting', L, doc.y + 2);
  doc.text('Lampiran : -', L, doc.y + 2);
  doc.text(`Perihal    : ${perihal}`, L, doc.y + 2);

  doc.text(lokasiTgl, 325, startY, { width: 220, align: 'right' });
  doc.text('Kepada Yth.', 325, doc.y + 6, { width: 220, align: 'left' });
  doc.font('Helvetica-Bold').text(tujuan, 325, doc.y + 2, { width: 220, align: 'left' });
  doc.font('Helvetica').text('di -', 325, doc.y + 2, { width: 220, align: 'left' });
  doc.text('    Tempat', 325, doc.y + 2, { width: 220, align: 'left' });

  // Isi Surat
  doc.moveDown(1.2);
  doc.font('Helvetica').fontSize(9.5).text('Dengan hormat,', L, doc.y, { width: W });
  doc.moveDown(0.5);
  doc.text(isi, L, doc.y, { width: W, align: 'justify', lineGap: 2 });

  doc.moveDown(0.7);
  doc.text(
    'Demikian surat ini kami sampaikan untuk menjadi perhatian dan tindak lanjut sebagaimana mestinya. Atas perhatian dan kerja samanya kami ucapkan terima kasih.',
    L,
    doc.y,
    { width: W, align: 'justify', lineGap: 1.5 }
  );

  // Tanda Tangan (diposisikan presisi agar pas 1 lembar A4)
  const sigY = Math.min(Math.max(doc.y + 14, 610), 640);
  const sigX = 325;
  const sigW = 220;
  doc.text(`${jabatan} ${kopInfo.namaDesa},`, sigX, sigY, { width: sigW, align: 'center' });

  const sigBuffer = parseBase64Image(tanda_tangan);
  const ttdTopY = doc.y + 3;
  if (sigBuffer) {
    try {
      doc.image(sigBuffer, sigX + 45, ttdTopY, { width: 130, height: 42, fit: [130, 42] });
    } catch (e) { }
  }

  doc.y = ttdTopY + 46;
  doc.font('Helvetica-Bold').text(lurah, sigX, doc.y, { width: sigW, align: 'center', underline: true });
  doc.font('Helvetica').fontSize(8.5).text(`NIP. ${nip}`, sigX, doc.y + 2, { width: sigW, align: 'center' });

  // Footer
  const footerY = 804;
  doc.moveTo(L, footerY - 5).lineTo(R, footerY - 5).lineWidth(0.5).stroke('#cbd5e1');
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(
    `${kopInfo.namaDesa} • ${kopInfo.alamatLengkap}`,
    L,
    footerY,
    { width: W, align: 'center', lineBreak: false }
  );

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
