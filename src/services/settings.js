// src/services/settings.js
// Pengaturan perusahaan — dokumen Firestore `settings/companyProfile`,
// path yang sama dengan Kontrack live sehingga data PT PEB yang ada ikut terbaca.

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { COMPANY_INFO, INVOICE_DEFAULTS } from '../utils/companyConfig';
import { DEFAULT_THEME } from '../utils/themes';

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

// Upload letterhead/kopsurat PNG ke Storage (path sama dengan live).
export const uploadLetterhead = async (file) => {
  const path = `settings/companyProfile/letterhead/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  return { url, path: snapshot.metadata.fullPath };
};

// Gabungkan settings tersimpan + fallback statis → bentuk yang dipakai invoice generator.
// Nama field mengikuti dokumen live `settings/companyProfile`.
export const mergeCompanyInfo = (settings) => {
  if (!settings) return COMPANY_INFO;
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
    letterheadUrl: settings.letterheadUrl || COMPANY_INFO.letterheadUrl,
    logoUrl: settings.logoUrl || '',
    signatureUrl: settings.signatureUrl || '',
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
