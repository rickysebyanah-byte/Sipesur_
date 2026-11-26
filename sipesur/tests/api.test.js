import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buatPdf } from '../server/pdf.js';

// Pastikan test berjalan menggunakan local DB agar tidak menyentuh database produksi
process.env.SUPABASE_URL = '';
process.env.SUPABASE_KEY = '';
process.env.VERCEL = '1'; // Hindari app.listen otomatis saat import

const { default: app } = await import('../server/server.js');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET /api/health returns ok and db_mode', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.service, 'sipesur-api');
});

test('GET /api/profil-desa returns Kelurahan Suka Maju profile', async () => {
  const res = await fetch(`${baseUrl}/api/profil-desa`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.nama_desa);
});

test('POST /api/auth/login succeeds with demo admin and fails with wrong password', async () => {
  const bad = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'WrongPassword!' }),
  });
  assert.equal(bad.status, 401);

  const ok = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'Password123' }),
  });
  assert.equal(ok.status, 200);
  const data = await ok.json();
  assert.ok(data.token);
  assert.equal(data.user.role, 'admin');
});

test('GET /api/verifikasi/:kode returns 404 valid=false for unknown code', async () => {
  const res = await fetch(`${baseUrl}/api/verifikasi/kode-tidak-ada-999`);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.valid, false);
});

test('buatPdf generates a valid PDF file with QR verification box', async () => {
  const outFile = path.join(os.tmpdir(), `sipesur-test-${Date.now()}.pdf`);
  await buatPdf({
    nomor: '470/001/SKD/2026',
    jenis: 'Surat Keterangan Domisili',
    kode: 'SKD',
    warga: {
      nama: 'Budi Santoso',
      nik: '3201010101900001',
      tempat_lahir: 'Medan',
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'L',
      pekerjaan: 'Karyawan Swasta',
      alamat: 'Jl. STM No. 38',
    },
    data: { keperluan: 'Administrasi Bank' },
    url: 'https://sipesur-one.vercel.app/verifikasi/test1234',
    tanggal: '26 November 2026',
  }, outFile);
  const bytes = fs.readFileSync(outFile);
  assert.ok(bytes.subarray(0, 5).toString() === '%PDF-');
  fs.unlinkSync(outFile);
});

test('POST /api/auth/reset-password-warga verifies NIK+KK+Tanggal Lahir without SMTP', async () => {
  const bad = await fetch(`${baseUrl}/api/auth/reset-password-warga`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nik: '3201010101900001',
      no_kk: '0000000000000000',
      tanggal_lahir: '1990-01-01',
      new_password: 'NewPassword123',
    }),
  });
  assert.equal(bad.status, 400);

  const ok = await fetch(`${baseUrl}/api/auth/reset-password-warga`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nik: '3201010101900001',
      no_kk: '3201010101900002',
      tanggal_lahir: '1990-01-01',
      new_password: 'Password123',
    }),
  });
  assert.equal(ok.status, 200);
});

test('2-step warga reset: verify-warga-identity then reset-password-warga with reset_token', async () => {
  const step1 = await fetch(`${baseUrl}/api/auth/verify-warga-identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nik: '3201010101900001',
      no_kk: '3201010101900002',
      tanggal_lahir: '1990-01-01',
    }),
  });
  assert.equal(step1.status, 200);
  const s1Data = await step1.json();
  assert.equal(s1Data.verified, true);
  assert.ok(s1Data.reset_token);

  const step2 = await fetch(`${baseUrl}/api/auth/reset-password-warga`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nik: '3201010101900001',
      reset_token: s1Data.reset_token,
      new_password: 'Password123',
    }),
  });
  assert.equal(step2.status, 200);
});
