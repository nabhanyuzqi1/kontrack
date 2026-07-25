// src/utils/themes.js
// Preset tema warna Kontrack — nilai RGB triplet untuk CSS variables.
// Dipakai runtime via applyTheme(); disimpan per-tenant di settings/companyProfile.

export const THEME_PRESETS = {
  electric: {
    label: 'Electric Blue',
    preview: ['#3358f4', '#06b6d4'],
    vars: {
      '--brand-50': '238 242 255',
      '--brand-100': '223 231 255',
      '--brand-200': '197 210 255',
      '--brand-300': '161 180 254',
      '--brand-400': '123 141 251',
      '--brand-500': '91 108 246',
      '--brand-600': '51 88 244',
      '--brand-700': '42 67 216',
      '--brand-800': '39 57 174',
      '--brand-900': '38 54 137',
      '--accent-300': '103 232 249',
      '--accent-400': '34 211 238',
      '--accent-500': '6 182 212',
      '--accent-600': '8 145 178'
    }
  },
  emerald: {
    label: 'Emerald',
    preview: ['#059669', '#14b8a6'],
    vars: {
      '--brand-50': '236 253 245',
      '--brand-100': '209 250 229',
      '--brand-200': '167 243 208',
      '--brand-300': '110 231 183',
      '--brand-400': '52 211 153',
      '--brand-500': '16 185 129',
      '--brand-600': '5 150 105',
      '--brand-700': '4 120 87',
      '--brand-800': '6 95 70',
      '--brand-900': '6 78 59',
      '--accent-300': '94 234 212',
      '--accent-400': '45 212 191',
      '--accent-500': '20 184 166',
      '--accent-600': '13 148 136'
    }
  },
  ocean: {
    label: 'Ocean',
    preview: ['#0284c7', '#6366f1'],
    vars: {
      '--brand-50': '240 249 255',
      '--brand-100': '224 242 254',
      '--brand-200': '186 230 253',
      '--brand-300': '125 211 252',
      '--brand-400': '56 189 248',
      '--brand-500': '14 165 233',
      '--brand-600': '2 132 199',
      '--brand-700': '3 105 161',
      '--brand-800': '7 89 133',
      '--brand-900': '12 74 110',
      '--accent-300': '165 180 252',
      '--accent-400': '129 140 248',
      '--accent-500': '99 102 241',
      '--accent-600': '79 70 229'
    }
  },
  sunset: {
    label: 'Sunset',
    preview: ['#ea580c', '#f43f5e'],
    vars: {
      '--brand-50': '255 247 237',
      '--brand-100': '255 237 213',
      '--brand-200': '254 215 170',
      '--brand-300': '253 186 116',
      '--brand-400': '251 146 60',
      '--brand-500': '249 115 22',
      '--brand-600': '234 88 12',
      '--brand-700': '194 65 12',
      '--brand-800': '154 52 18',
      '--brand-900': '124 45 18',
      '--accent-300': '253 164 175',
      '--accent-400': '251 113 133',
      '--accent-500': '244 63 94',
      '--accent-600': '225 29 72'
    }
  },
  graphite: {
    label: 'Graphite',
    preview: ['#475569', '#3b82f6'],
    vars: {
      '--brand-50': '248 250 252',
      '--brand-100': '241 245 249',
      '--brand-200': '226 232 240',
      '--brand-300': '203 213 225',
      '--brand-400': '148 163 184',
      '--brand-500': '100 116 139',
      '--brand-600': '71 85 105',
      '--brand-700': '51 65 85',
      '--brand-800': '30 41 59',
      '--brand-900': '15 23 42',
      '--accent-300': '147 197 253',
      '--accent-400': '96 165 250',
      '--accent-500': '59 130 246',
      '--accent-600': '37 99 235'
    }
  }
};

export const DEFAULT_THEME = 'electric';
const STORAGE_KEY = 'kontrack-theme';

// Terapkan preset ke :root. Dipanggil saat boot + saat user ganti tema.
export const applyTheme = (presetName) => {
  const preset = THEME_PRESETS[presetName] || THEME_PRESETS[DEFAULT_THEME];
  const root = document.documentElement;
  Object.entries(preset.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  try {
    localStorage.setItem(STORAGE_KEY, presetName);
  } catch (e) {
    /* private mode */
  }
};

// Cache lokal supaya tema terpasang instan sebelum Firestore termuat.
export const getCachedTheme = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  } catch (e) {
    return DEFAULT_THEME;
  }
};
