// src/utils/companyConfig.js
// Profil perusahaan penerbit invoice. Untuk sekarang single-tenant (PT PEB);
// saat multi-tenant, ini diganti data dari dokumen orgs/{orgId}.
// Data diambil dari template invoice resmi PT Permata Energi Borneo.

export const COMPANY_INFO = {
  name: 'PT. PERMATA ENERGI BORNEO',
  addressLines: [
    'Jalan Gatot Subroto (Gedung Permata) RT.20 RW.07',
    'Kelurahan Sawahan, Kecamatan Mentawa Baru Ketapang',
    'Kabupaten Kotawaringin Timur, Provinsi Kalimantan Tengah - SAMPIT Kode Pos: 74321'
  ],
  email: 'permataenergiborneo@gmail.com',
  city: 'Sampit',
  npwp: '',
  // Kopsurat/letterhead lengkap (logo diamond + identitas) dari Firebase Storage —
  // dipakai sebagai banner header invoice. Nanti dibaca dinamis dari settings/companyProfile.
  letterheadUrl:
    'https://firebasestorage.googleapis.com/v0/b/kontrack/o/settings%2FcompanyProfile%2Fletterhead%2F1764897239809_PT.%20PERMATA%20ENERGI%20BORNEO.png?alt=media&token=2818d2a6-f7cb-4fbc-83dd-114363080fc2',
  logoDataUrl: '', // opsional: logo saja (jika tanpa letterhead)
  bank: {
    name: 'BCA',
    accountNumber: '6695593736',
    accountHolder: 'PT PERMATA ENERGI BORNEO'
  },
  signatory: {
    name: 'Noor Febriyanto',
    title: 'Direktur'
  }
};

// Default konfigurasi invoice.
export const INVOICE_DEFAULTS = {
  paymentTerm: '14 Hari',
  ppnRate: 11, // PPN 11%
  pphRate: 0, // PPh final jasa konstruksi diisi manual sesuai kualifikasi
  paymentNote:
    'Silakan transfer pembayaran invoice ini ke BCA No. Rek 6695593736 a.n PT PERMATA ENERGI BORNEO.'
};

export default COMPANY_INFO;
