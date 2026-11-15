// src/components/settings/TaxSettings.jsx
// Tab Pajak: parameter yang dipakai generator faktur CoreTax.
//
// Nilai default mengikuti PMK 131/2024 (PPN 12% dengan DPP Nilai Lain 11/12,
// efektif 11%) dan kode jasa konstruksi. Yang bisa diubah di sini hanya apa yang
// memang berbeda per perusahaan: NPWP sudah ada di tab Perusahaan.

import React from 'react';
import { Card } from '../ui/Card';
import { Field, Input, Select } from '../ui/Field';
import { Landmark, Info } from 'lucide-react';
import { GOODSERVICE_OPT, DEFAULT_UNIT_FOR_OPT } from '../../utils/coretaxXml';

const TaxSettings = ({ form, set }) => {
  const subtotal = 100000000;
  const dpp = Math.round(subtotal * (11 / 12));
  const ppn = Math.round(dpp * 0.12);

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-2.5">
          <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800">Parameter Faktur Pajak</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Dipakai saat mengekspor XML CoreTax. Ubah hanya bila kebijakan pajak perusahaan berbeda.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kode Transaksi" hint="04 = DPP Nilai Lain (PPN 12% x 11/12, efektif 11%)">
            <Select value={form.taxTrxCode || '04'} onChange={set('taxTrxCode')}>
              <option value="04">04 — DPP Nilai Lain</option>
              <option value="01">01 — Kepada bukan pemungut</option>
            </Select>
          </Field>
          <Field label="Jenis Barang/Jasa (Opt)" hint="B = jasa; satuan jasa wajib memakai kode Kegiatan">
            <Select value={form.taxOpt || GOODSERVICE_OPT.JASA} onChange={set('taxOpt')}>
              <option value="B">B — Jasa</option>
              <option value="A">A — Barang</option>
            </Select>
          </Field>
          <Field label="Kode Satuan Default">
            <Input
              value={form.taxUnit || DEFAULT_UNIT_FOR_OPT[GOODSERVICE_OPT.JASA]}
              onChange={set('taxUnit')}
              placeholder="UM.0030"
            />
          </Field>
          <Field label="Kode Objek Pajak Jasa Konstruksi">
            <Input value={form.taxObjectCode || '010000'} onChange={set('taxObjectCode')} placeholder="010000" />
          </Field>
          <Field label="Masa Pajak Default" hint="Bulan pengkreditan saat invoice tidak punya tanggal pajak">
            <Input value={form.taxPeriod || ''} onChange={set('taxPeriod')} placeholder="mm/yyyy" />
          </Field>
          <Field label="Fasilitas / Keterangan Tambahan" hint="Baris keterangan di faktur, opsional">
            <Input value={form.taxNote || ''} onChange={set('taxNote')} placeholder="Mis. kontrak pemerintah" />
          </Field>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <h3 className="mb-3 font-display text-sm font-semibold text-slate-800">Simulasi Perhitungan</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2 text-slate-500">Nilai pekerjaan (contoh)</td>
                <td className="py-2 text-right font-medium text-slate-800">Rp{subtotal.toLocaleString('id-ID')}</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-500">DPP Nilai Lain (11/12)</td>
                <td className="py-2 text-right font-medium text-slate-800">Rp{dpp.toLocaleString('id-ID')}</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-500">PPN 12% x DPP</td>
                <td className="py-2 text-right font-medium text-slate-800">Rp{ppn.toLocaleString('id-ID')}</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold text-slate-700">Total ditagihkan</td>
                <td className="py-2 text-right font-semibold text-slate-900">
                  Rp{(subtotal + ppn).toLocaleString('id-ID')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            PPh Pasal 4(2) konstruksi umumnya dipotong pemberi kerja. Kontrack tidak mengurangkan PPh dari nilai
            tagihan karena nominal potongannya baru diketahui dari bukti potong mitra; catat bukti potongnya di
            detail invoice agar laporan tahunan akurat.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default TaxSettings;
