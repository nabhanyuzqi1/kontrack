#!/usr/bin/env bash
# Migrasi Cloud Storage: bucket lama (US-CENTRAL1) → gs://kontrack (ASIA-SOUTHEAST2)
#
#   bash scripts/migrate-storage.sh            # dry-run
#   bash scripts/migrate-storage.sh --apply    # benar-benar menyalin
#
# rsync menyalin metadata objek, termasuk firebaseStorageDownloadTokens, sehingga
# URL download lama tetap sah setelah nama bucket ditukar oleh migrate-firestore.cjs.
set -euo pipefail

SRC="gs://sistem-keuangan-ptpeb.firebasestorage.app"
DST="gs://kontrack"
PROJECT="sistem-keuangan-ptpeb"

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

echo "Sumber : $SRC"
echo "Tujuan : $DST"
echo

TOTAL=$(gcloud storage ls -r "$SRC/**" --project="$PROJECT" 2>/dev/null | grep -c '^gs://' || true)
echo "Objek di sumber: $TOTAL"

if [[ "$APPLY" == false ]]; then
  echo
  echo ">> DRY-RUN — tidak ada yang disalin."
  gcloud storage rsync -r --dry-run "$SRC" "$DST" --project="$PROJECT"
  echo
  echo "Jalankan ulang dengan --apply untuk menyalin."
  exit 0
fi

echo ">> MENYALIN..."
gcloud storage rsync -r "$SRC" "$DST" --project="$PROJECT"

echo
COPIED=$(gcloud storage ls -r "$DST/**" --project="$PROJECT" 2>/dev/null | grep -c '^gs://' || true)
echo "Objek di tujuan: $COPIED (sumber: $TOTAL)"

if [[ "$COPIED" -lt "$TOTAL" ]]; then
  echo "PERINGATAN: jumlah objek belum sama — periksa keluaran di atas."
  exit 1
fi
echo "Migrasi storage selesai."
