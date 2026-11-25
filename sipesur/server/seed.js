import 'dotenv/config';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import db from './db.js';

async function main() {
  try {
    console.log('Menghubungkan ke Supabase...');
    const schema = fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8');

    // Eksekusi skema SQL
    await db.pool.query(schema);
    console.log('Skema database berhasil diterapkan ke Supabase/PostgreSQL.');

    const pw = await bcrypt.hash('Password123', 10);

    // Akun Pemerintahan (Petugas, Lurah, Admin) dan Warga
    const users = [
      {
        nama: 'Admin IT Kelurahan',
        email: 'admin@sipesur.test',
        username: 'admin',
        nip: '198001012005011001',
        jabatan: 'Pranata Komputer / IT Administrator Sistem',
        telepon: '081234567890',
        role: 'admin',
        status_verifikasi: 'terverifikasi',
        must_change_password: 0,
      },
      {
        nama: 'Siti Rohmah, S.AP',
        email: 'petugas@sipesur.test',
        username: 'petugas',
        nip: '198505122010012003',
        jabatan: 'Petugas Pelayanan Administrasi',
        telepon: '081234567891',
        role: 'petugas',
        status_verifikasi: 'terverifikasi',
        must_change_password: 0,
      },
      {
        nama: 'Muhammad Iqbal Samosir, S.E., M.A.P.',
        email: 'lurah@sipesur.test',
        username: 'lurah',
        nip: '198506122010011005',
        jabatan: 'Lurah Suka Maju',
        telepon: '0823-4123-5734',
        role: 'lurah',
        status_verifikasi: 'terverifikasi',
        must_change_password: 0,
      },
      {
        nama: 'Budi Santoso',
        email: 'warga@sipesur.test',
        username: '3201010101900001',
        nip: null,
        jabatan: null,
        telepon: '081200000001',
        role: 'warga',
        status_verifikasi: 'terverifikasi',
        must_change_password: 0,
        nik: '3201010101900001',
        no_kk: '3201010101900002',
        tempat_lahir: 'Medan',
        tanggal_lahir: '1990-01-01',
        jenis_kelamin: 'L',
        alamat: 'Jl. STM No. 38 RT 02/RW 03 (Dekat Kantor Lurah), Kelurahan Suka Maju, Medan Johor',
        pekerjaan: 'Karyawan Swasta',
      },
      {
        nama: 'Ahmad Pratama',
        email: 'ahmad.pratama@gmail.com',
        username: '3201010202950001',
        nip: null,
        jabatan: null,
        telepon: '081200000002',
        role: 'warga',
        status_verifikasi: 'menunggu_verifikasi',
        must_change_password: 0,
        nik: '3201010202950001',
        no_kk: '3201010202950002',
        tempat_lahir: 'Medan',
        tanggal_lahir: '1995-02-02',
        jenis_kelamin: 'L',
        alamat: 'Jl. Sakti Lubis No. 12 RT 01/RW 04, Suka Maju, Medan Johor',
        pekerjaan: 'Wiraswasta',
      },
    ];

    for (const u of users) {
      const [x] = await db.query(
        'INSERT INTO users(nama,email,username,nip,jabatan,telepon,password,role,status_verifikasi,must_change_password) VALUES(?,?,?,?,?,?,?,?,?,?)',
        [
          u.nama,
          u.email,
          u.username,
          u.nip,
          u.jabatan,
          u.telepon,
          pw,
          u.role,
          u.status_verifikasi,
          u.must_change_password,
        ]
      );

      if (u.role === 'warga') {
        await db.query(
          'INSERT INTO warga(user_id,nik,no_kk,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,pekerjaan,telepon) VALUES(?,?,?,?,?,?,?,?,?)',
          [
            x.insertId,
            u.nik,
            u.no_kk,
            u.tempat_lahir,
            u.tanggal_lahir,
            u.jenis_kelamin,
            u.alamat,
            u.pekerjaan,
            u.telepon,
          ]
        );
      }
    }

    const P = (s) =>
      s.split('|').map((x) => {
        const [name, label] = x.split(':');
        return { name: name.trim(), label: (label || name).trim() };
      });

    const RT = 'Surat Pengantar RT/RW';
    const J = [
      ['SKD', 'Surat Keterangan Domisili', 'Orang tersebut benar berdomisili di wilayah Kelurahan Suka Maju.', 'alamat_domisili:Alamat Domisili|lama_tinggal:Lama Tinggal|keperluan:Keperluan', ['KTP', 'Kartu Keluarga', RT]],
      ['SKTM', 'Surat Keterangan Tidak Mampu', 'Orang tersebut benar tergolong keluarga kurang mampu.', 'penghasilan:Penghasilan per Bulan|jumlah_tanggungan:Jumlah Tanggungan|keperluan:Keperluan', ['KTP', 'Kartu Keluarga', RT]],
      ['SKCK', 'Surat Pengantar SKCK', 'Orang tersebut berkelakuan baik dan diberi pengantar untuk pengurusan SKCK.', 'agama:Agama|status_perkawinan:Status Perkawinan|keperluan:Keperluan', ['KTP', 'Kartu Keluarga', 'Pas Foto']],
      ['SKU', 'Surat Keterangan Usaha', 'Orang tersebut benar memiliki usaha di wilayah Kelurahan Suka Maju.', 'nama_usaha:Nama Usaha|jenis_usaha:Jenis Usaha|alamat_usaha:Alamat Usaha|lama_usaha:Lama Usaha', ['KTP', 'Foto Tempat Usaha', RT]],
      ['SKLH', 'Surat Keterangan Kelahiran', 'Telah terjadi kelahiran sebagaimana data di atas.', 'nama_bayi:Nama Bayi|tempat_lahir_bayi:Tempat Lahir Bayi|tanggal_lahir_bayi:Tanggal Lahir Bayi|nama_ayah:Nama Ayah|nama_ibu:Nama Ibu', ['KTP Pelapor', 'Kartu Keluarga', 'Surat Keterangan Lahir (Bidan/RS)']],
      ['SKM', 'Surat Keterangan Kematian', 'Telah terjadi kematian sebagaimana data di atas.', 'nama_almarhum:Nama Almarhum|nik_almarhum:NIK Almarhum|tanggal_meninggal:Tanggal Meninggal|penyebab:Penyebab|hubungan_pelapor:Hubungan Pelapor', ['KTP Pelapor', 'Kartu Keluarga', 'Surat Keterangan Kematian (RS/RT)']],
      ['SKBM', 'Surat Keterangan Belum Menikah', 'Orang tersebut sampai saat ini belum pernah menikah.', 'agama:Agama|keperluan:Keperluan', ['KTP', 'Kartu Keluarga', RT]],
      ['SPP', 'Surat Pengantar Pindah', 'Orang tersebut bermaksud pindah domisili sebagaimana data di atas.', 'alamat_tujuan:Alamat Tujuan|alasan_pindah:Alasan Pindah|jumlah_pengikut:Jumlah Pengikut', ['KTP', 'Kartu Keluarga', 'Pas Foto']],
    ];

    for (const [k, n, t, f, s] of J) {
      const [x] = await db.query(
        'INSERT INTO jenis_surat(kode,nama,template,form_fields) VALUES(?,?,?,?)',
        [k, n, t, JSON.stringify(P(f))]
      );
      for (const p of s) {
        await db.query('INSERT INTO persyaratan(jenis_surat_id,nama) VALUES(?,?)', [x.insertId, p]);
      }
    }

    console.log('\n[V] Database Supabase siap! Akun uji (password: Password123):');
    users.forEach((u) => {
      const loginId = u.nip || u.nik || u.username || u.email;
      console.log(`   - ${u.role.toUpperCase().padEnd(8)}: ID/Login='${loginId}' (${u.nama}) - Status: ${u.status_verifikasi}`);
    });
  } catch (err) {
    console.error('\n[X] Gagal melakukan setup database:', err.message || err);
    console.error('\nTips: pastikan SUPABASE_URL dan SUPABASE_KEY di file .env benar, dan database/setup_supabase.sql sudah dijalankan di Supabase SQL Editor.');
  } finally {
    await db.end();
  }
}

main();
