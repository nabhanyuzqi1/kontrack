// src/services/functionsRegion.js
// Seluruh Cloud Function Kontrack berada di asia-southeast2 (Jakarta) —
// penggunanya di Indonesia, latensi ±30-50ms dibanding ±200ms+ ke us-central1.
// Tidak ada lagi function yang tersisa di region lain.

import { getFunctions } from 'firebase/functions';
import app from './firebase';

export const REGION = 'asia-southeast2';

/** Instance Functions Kontrack (Jakarta). */
export const kontrackFunctions = () => getFunctions(app, REGION);

// Alias historis — dulu memisahkan function AI (Jakarta) dari function warisan
// (us-central1). Setelah konsolidasi region, keduanya menunjuk instance sama.
export const aiFunctions = kontrackFunctions;
export const legacyFunctions = kontrackFunctions;
export const AI_REGION = REGION;
export const LEGACY_REGION = REGION;
