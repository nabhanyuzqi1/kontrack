# Fix: Kop Surat (letterhead) & Tanda Tangan tidak muncul di PDF Invoice

## Penyebab
Bucket Firebase Storage `sistem-keuangan-ptpeb.firebasestorage.app` belum
mengaktifkan CORS. Browser bisa menampilkan gambar via `<img>`, tapi **tidak
bisa menyalinnya ke PDF** (jsPDF/canvas & fetch butuh header
`Access-Control-Allow-Origin`, dan bucket belum mengirimnya).

Cek: `curl -sI "<letterheadUrl>"` — tidak ada baris `access-control-allow-origin`.

## Solusi (satu kali, aman untuk app live)
Aktifkan CORS **read-only (GET)** pada bucket. Ini hanya MENGIZINKAN
pengambilan gambar lintas-origin; tidak mengubah perilaku Kontrack lama.

```bash
# Butuh gcloud/gsutil terpasang + login ke project sistem-keuangan-ptpeb
gsutil cors set storage.cors.json gs://sistem-keuangan-ptpeb.firebasestorage.app

# Verifikasi
gsutil cors get gs://sistem-keuangan-ptpeb.firebasestorage.app
```

Alternatif tanpa gsutil (Cloud Shell di console.firebase.google.com):
upload `storage.cors.json`, lalu jalankan perintah `gsutil cors set` yang sama.

Setelah ini, generate ulang invoice → kop surat + tanda tangan otomatis masuk.

## Kenapa tidak dibuat proxy Cloud Function?
Bisa, tapi menambah endpoint & perlu deploy (berisiko konflik dgn app live).
CORS bucket adalah fix standar, minimal, dan tidak menyentuh kode live.
