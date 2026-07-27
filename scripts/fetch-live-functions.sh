#!/usr/bin/env bash
# Mengunduh source Cloud Functions v2 yang sedang berjalan di production.
#
# Prasyarat (sekali saja):
#   gcloud auth login permataenergiborneo@gmail.com
#
# Pemakaian:
#   bash scripts/fetch-live-functions.sh              # semua function
#   bash scripts/fetch-live-functions.sh addUserToCompany updateUserRole
#
# Hasil diekstrak ke functions-live/<nama-function>/

set -euo pipefail

export PATH="/usr/local/share/google-cloud-sdk/bin:$PATH"

PROJECT="sistem-keuangan-ptpeb"
REGION="us-central1"
OUT="functions-live"

command -v gcloud >/dev/null || { echo "gcloud belum terpasang."; exit 1; }

ACCOUNT="$(gcloud config get-value account 2>/dev/null || true)"
echo "Akun aktif: ${ACCOUNT:-(belum login)}"

TOKEN="$(gcloud auth print-access-token 2>/dev/null)" || {
  echo "Gagal mengambil access token. Jalankan dulu:"
  echo "  gcloud auth login permataenergiborneo@gmail.com"
  exit 1
}

# Daftar function bila tidak disebutkan sebagai argumen
if [ "$#" -gt 0 ]; then
  NAMES=("$@")
else
  echo "Mengambil daftar function…"
  # bash 3.2 (bawaan macOS) tidak punya `mapfile`, jadi baca baris per baris.
  NAMES=()
  LIST_JSON="$(curl -sS -H "Authorization: Bearer ${TOKEN}" \
    "https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/functions")"
  while IFS= read -r line; do
    [ -n "$line" ] && NAMES+=("$line")
  done <<EOF
$(printf '%s' "$LIST_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(f['name'].split('/')[-1] for f in d.get('functions',[])))")
EOF
fi

[ "${#NAMES[@]}" -gt 0 ] || { echo "Tidak ada function ditemukan (cek izin akun)."; exit 1; }
echo "Function: ${NAMES[*]}"

mkdir -p "$OUT"

for NAME in "${NAMES[@]}"; do
  URL="$(
    curl -sS -X POST \
      -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' -d '{}' \
      "https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/functions/${NAME}:generateDownloadUrl" |
      python3 -c "import json,sys; print(json.load(sys.stdin).get('downloadUrl',''))"
  )"

  if [ -z "$URL" ]; then
    echo "✗ ${NAME}: gagal mendapat URL unduh"
    continue
  fi

  curl -sS -o "${OUT}/${NAME}.zip" "$URL"
  mkdir -p "${OUT}/${NAME}"
  unzip -oq "${OUT}/${NAME}.zip" -d "${OUT}/${NAME}"
  rm -f "${OUT}/${NAME}.zip"
  echo "✓ ${NAME} → ${OUT}/${NAME}/"
done

echo
echo "Selesai. Source ada di ${OUT}/"
echo "CATATAN: folder ini berisi kode produksi — periksa sebelum di-commit."
