// src/services/settings.js
// Pengaturan perusahaan — dokumen Firestore `settings/companyProfile`,
// path yang sama dengan Kontrack live sehingga data PT PEB yang ada ikut terbaca.

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { COMPANY_INFO, INVOICE_DEFAULTS } from '../utils/companyConfig';
import { DEFAULT_THEME } from '../utils/themes';
import { compressImage } from '../utils/imageCompress';

const SETTINGS_REF = () => doc(db, 'settings', 'companyProfile');

export const getCompanySettings = async () => {
  try {
    const snap = await getDoc(SETTINGS_REF());
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error('Error loading company settings:', error);
    return null;
  }
};

export const saveCompanySettings = async (data) => {
  await setDoc(SETTINGS_REF(), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
};

// Kecilkan gambar lalu ubah ke data URL (PNG) — dipakai langsung oleh jsPDF
// sehingga TIDAK bergantung pada konfigurasi CORS bucket Storage.
export const imageFileToDataUrl = (file, maxWidth = 1200) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Upload letterhead/kopsurat PNG ke Storage (path sama dengan live) DAN
// kembalikan data URL-nya untuk disimpan di Firestore — agar PDF tetap
// memuat kop surat walau CORS bucket belum diaktifkan.
export const uploadLetterhead = async (file) => {
  // preserveAlpha: kop surat kerap PNG transparan agar menyatu dengan kertas.
  const asset = await compressImage(file, { maxDimension: 2000, preserveAlpha: true });
  const path = `settings/companyProfile/letterhead/${Date.now()}_${asset.name}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, asset);
  const url = await getDownloadURL(snapshot.ref);
  const dataUrl = await imageFileToDataUrl(file).catch(() => '');
  return { url, path: snapshot.metadata.fullPath, dataUrl };
};

// Upload tanda tangan (PNG transparan) + data URL.
export const uploadSignature = async (file) => {
  // Tanda tangan WAJIB tetap transparan — kalau tidak, akan muncul kotak putih
  // menutupi teks invoice di bawahnya.
  const asset = await compressImage(file, { maxDimension: 1200, preserveAlpha: true });
  const path = `settings/companyProfile/signature/${Date.now()}_${asset.name}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, asset);
  const url = await getDownloadURL(snapshot.ref);
  const dataUrl = await imageFileToDataUrl(file, 600).catch(() => '');
  return { url, path: snapshot.metadata.fullPath, dataUrl };
};

/**
 * Hapus kop surat / tanda tangan.
 *
 * Berkas di Storage ikut dihapus supaya tidak menyisakan sampah, tetapi
 * kegagalan penghapusan berkas TIDAK boleh menggagalkan aksi — yang menentukan
 * tampil-tidaknya aset di invoice adalah field di Firestore, dan berkas lama
 * bisa saja sudah tidak ada (mis. sisa migrasi bucket).
 *
 * @param {'letterhead'|'signature'} kind
 * @param {object} settings dokumen settings saat ini (untuk tahu path berkas)
 */
export const removeCompanyAsset = async (kind, settings = {}) => {
  const path = settings[`${kind}Path`];
  if (path) {
    try {
      await deleteObject(ref(storage, path));
    } catch (e) {
      console.warn(`Berkas ${kind} tidak dapat dihapus dari Storage:`, e?.code || e);
    }
  }

  await saveCompanySettings({
    [`${kind}Url`]: '',
    [`${kind}DataUrl`]: '',
    [`${kind}Path`]: '',
    [`${kind}Enabled`]: false
  });
};

// Gabungkan settings tersimpan + fallback statis → bentuk yang dipakai invoice generator.
// Nama field mengikuti dokumen live `settings/companyProfile`.
export const mergeCompanyInfo = (settings) => {
  if (!settings) return COMPANY_INFO;

  // Saklar kop surat & tanda tangan. Default menyala agar dokumen lama yang
  // belum punya field ini tetap tampil seperti semula — hanya nilai `false`
  // eksplisit yang mematikannya.
  //
  // Saat dimatikan, URL-nya dikosongkan sehingga generator PDF otomatis memakai
  // jalur cadangannya: header teks untuk kop surat, dan baris nama penanda
  // tangan tanpa gambar.
  const letterheadOn = settings.letterheadEnabled !== false;
  const signatureOn = settings.signatureEnabled !== false;

  const addressLines =
    settings.addressLines ||
    [
      settings.address,
      [settings.city, settings.province].filter(Boolean).join(', '),
      settings.postalCode ? `Kode Pos: ${settings.postalCode}` : ''
    ].filter(Boolean);
  return {
    ...COMPANY_INFO,
    name: settings.companyName || settings.name || COMPANY_INFO.name,
    addressLines: addressLines.length ? addressLines : COMPANY_INFO.addressLines,
    email: settings.email || COMPANY_INFO.email,
    phone: settings.phone || COMPANY_INFO.phone,
    city: settings.city || COMPANY_INFO.city,
    npwp: settings.npwp || COMPANY_INFO.npwp,
    // Header invoice = letterhead (banner logo+identitas). Logo & tanda tangan terpisah.
    letterheadUrl: letterheadOn ? settings.letterheadUrl || COMPANY_INFO.letterheadUrl : '',
    // Data URL diprioritaskan generator PDF (tak butuh CORS bucket)
    letterheadDataUrl: letterheadOn ? settings.letterheadDataUrl || '' : '',
    signatureDataUrl: signatureOn ? settings.signatureDataUrl || '' : '',
    logoUrl: settings.logoUrl || '',
    signatureUrl: signatureOn ? settings.signatureUrl || '' : '',
    letterheadEnabled: letterheadOn,
    signatureEnabled: signatureOn,
    footerNote: settings.footerNote || settings.attachmentFooter || '',
    // Webhook hanya aktif bila toggle whatsappEnabled true
    whatsappWebhookUrl: settings.notifications?.whatsappEnabled
      ? settings.notifications?.whatsappWebhookUrl || ''
      : '',
    bank: {
      name: settings.bankName || COMPANY_INFO.bank.name,
      accountNumber: settings.bankAccountNumber || COMPANY_INFO.bank.accountNumber,
      accountHolder:
        settings.bankAccountName || settings.bankAccountHolder || COMPANY_INFO.bank.accountHolder
    },
    signatory: {
      name: settings.representativeName || settings.signatoryName || COMPANY_INFO.signatory.name,
      title: settings.representativeTitle || settings.signatoryTitle || COMPANY_INFO.signatory.title
    }
  };
};

export const getThemeFromSettings = (settings) => settings?.themePreset || DEFAULT_THEME;

export { COMPANY_INFO, INVOICE_DEFAULTS };
