      {/*
        Dua kolom, bukan dua tab.
        Sebab: isi invoice (nomor referensi, rincian pekerjaan, pembayaran,
        dokumen pajak, arsip berkas) tadinya dipotong menjadi dua tab yang
        saling menyembunyikan. Dengan panel selebar layar, semuanya terbaca
        sekaligus tanpa menggulir bolak-balik; kekurangan tempat di layar
        kecil diserahkan ke breakpoint, bukan ke tab.
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        {/* KIRI — identitas, nomor referensi, rincian pekerjaan */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone[inv.status] || 'slate'}>
                  {INVOICE_STATUS_LABEL[inv.status] || inv.status || 'Draft'}
                </Badge>
                {inv.billingStage && (
                  <Badge tone="violet">
                    {billingStageLabel(inv.billingStage)}
                    {inv.quantity ? ` · ${inv.quantity}` : ''}
                  </Badge>
                )}
                {isPpnCair(inv) && <Badge tone="cyan">PPN Cair</Badge>}
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
                <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                {inv.clientName || inv.client?.client_name || '—'}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate-500">
                <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                {inv.projectName || '—'}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                Terbit {formatDate(inv.issueDate)} · Jatuh tempo {formatDate(inv.dueDate)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Grand Total</p>
              <p className="tnum font-display text-2xl font-bold tracking-tight text-slate-900">
                {formatCurrency(inv.grandTotal || 0)}
              </p>
              {inv.taxDeductedAmount > 0 && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Diterima <span className="tnum font-medium">{formatCurrency(inv.netProceeds)}</span>
                </p>
              )}
            </div>
          </div>

          <div>
            <SectionLabel>
              <FileText className="mr-1 inline h-3.5 w-3.5" />
              Nomor Referensi
            </SectionLabel>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
              <RefRow label="No. PO" value={inv.poNumber} />
              <RefRow label="No. SPK / Kontrak" value={inv.spkNumber} />
              <RefRow label="No. PK" value={inv.pkNumber} />
              <RefRow label="No. BAHK" value={inv.bahkNumber} />
              <RefRow label="No. WPHO / BAST" value={inv.wphoNumber} />
              <RefRow label="No. Faktur Pajak" value={inv.taxInvoiceNumber} />
              <RefRow label="Kode Billing" value={inv.billingCode} />
              <RefRow label="NTPN" value={inv.ntpnNumber} />
            </div>
          </div>

          {items.length > 0 && (
            <div>
              <SectionLabel>Rincian Pekerjaan</SectionLabel>
              <div className="overflow-hidden rounded-[10px] ring-1 ring-inset ring-slate-200/70 dark:ring-white/10">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200/70 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10">
                      <th className="px-3 py-1.5 font-medium">Deskripsi</th>
                      <th className="px-3 py-1.5 font-medium">Qty</th>
                      <th className="px-3 py-1.5 text-right font-medium">Harga</th>
                      <th className="px-3 py-1.5 text-right font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-b border-slate-200/50 last:border-0 dark:border-white/5">
                        <td className="px-3 py-1.5 text-slate-800">{it.description || '—'}</td>
                        <td className="px-3 py-1.5 text-slate-500">
                          {it.qty || '—'} {it.unit || ''}
                        </td>
                        <td className="tnum px-3 py-1.5 text-right text-slate-500">
                          {it.unitPrice ? formatCurrency(it.unitPrice) : '—'}
                        </td>
                        <td className="tnum px-3 py-1.5 text-right font-semibold text-slate-800">
                          {formatCurrency(
                            it.amount !== '' && it.amount != null
                              ? Number(it.amount)
                              : (Number(it.qty) || 1) * (Number(it.unitPrice) || 0)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* KANAN — pembayaran, dokumen pajak, arsip berkas */}
        <div className="min-w-0 space-y-4 lg:border-l lg:border-slate-200/70 lg:pl-6 dark:lg:border-white/10">
          <div>
            <SectionLabel>Pembayaran</SectionLabel>
            <div className="space-y-1 text-[13px]">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="tnum">{formatCurrency(inv.subtotal ?? inv.dppNilaiLain ?? 0)}</span>
              </div>
              {inv.dppNilaiLain > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>DPP Nilai Lain</span>
                  <span className="tnum">{formatCurrency(inv.dppNilaiLain)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>PPN</span>
                <span className="tnum">{formatCurrency(inv.pajak11 || 0)}</span>
              </div>
              {inv.taxDeductedAmount > 0 && (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>PPh (dipotong client)</span>
                    <span className="tnum">−{formatCurrency(inv.taxDeductedAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>Diterima</span>
                    <span className="tnum">{formatCurrency(inv.netProceeds)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <SectionLabel>Dokumen Pajak</SectionLabel>
              <span className="text-xs text-slate-400">{doneCount}/4</span>
            </div>
            <div className="space-y-1.5">
              {progress.map((p) => (
                <div key={p.key} className="flex items-center justify-between text-[13px]">
                  <span className={p.done ? 'font-medium text-slate-800' : 'text-slate-400'}>
                    {p.label}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${p.done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <SectionLabel>Arsip Berkas</SectionLabel>
              <span className="text-xs text-slate-400">{Object.keys(docs).length}/3</span>
            </div>
            <p className="mb-2 text-xs text-slate-400">
              Berkas penagihan terkait invoice ini membentuk arsip digital.
            </p>
            <div className="space-y-2">
              {DOC_KEYS.map((k) => (
                <div key={k} className="flex items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 ring-1 ring-inset ring-slate-200/70 dark:ring-white/10">
                  <div className="min-w-0">
                    <p className={docs[k] ? 'text-sm font-medium text-slate-800' : 'text-sm text-slate-400'}>
                      {INVOICE_DOC_LABELS[k]}
                    </p>
                    {docs[k] && <p className="truncate text-xs text-slate-400">{docs[k].name}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {docs[k] ? (
                      <a
                        href={docs[k].url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                      >
                        Lihat
                      </a>
                    ) : (
                      <span className="text-xs text-slate-300">belum ada</span>
                    )}
                    <label
                      title={`Unggah ${INVOICE_DOC_LABELS[k]}`}
                      className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.tif,.tiff"
                        disabled={uploading === k}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) handleUpload(k, file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
