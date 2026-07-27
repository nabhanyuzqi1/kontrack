// src/services/functionsRegion.js
// Region Cloud Functions.
//
// Function AI milik Kontrack baru di-deploy ke Jakarta (asia-southeast2) karena
// penggunanya di Indonesia — latensi ±30-50ms dibanding ±200ms+ ke us-central1.
//
// Function warisan Kontrack lama (addUserToCompany, updateUserRole,
// getStorageAssetDataUrl, parseBoqWithAI) masih di us-central1. Selama belum
// dimigrasi, pemanggilnya harus memakai LEGACY_REGION.

import { getFunctions } from 'firebase/functions';
import app from './firebase';

export const AI_REGION = 'asia-southeast2';
export const LEGACY_REGION = 'us-central1';

/** Functions instance untuk function AI (Jakarta). */
export const aiFunctions = () => getFunctions(app, AI_REGION);

/** Functions instance untuk function warisan (us-central1). */
export const legacyFunctions = () => getFunctions(app, LEGACY_REGION);
