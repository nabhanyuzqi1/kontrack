          <FormSection title="Anggaran Biaya (RAB)">
            <p className="mb-3 text-xs text-slate-500">
              Isi anggaran per kategori pengeluaran. Kosongkan bila belum ada RAB; serapan biaya
              otomatis dibandingkan dengan angka di sini.
            </p>

            {rabRows.length === 0 && (
              <p className="mb-3 rounded-lg bg-slate-500/5 px-3 py-2.5 text-xs text-slate-400">
                Belum ada baris anggaran.
              </p>
            )}

            <div className="space-y-2">
              {rabRows.map((row, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={row.category}
                      onChange={(e) => {
                        const next = [...rabRows];
                        next[idx] = { ...next[idx], category: e.target.value };
                        setRabRows(next);
                      }}
                      disabled={loading}
                    >
                      <option value="">— Pilih kategori —</option>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-36 shrink-0">
                    <Input
                      type="number"
                      value={row.budget}
                      min="0"
                      step="any"
                      placeholder="Anggaran"
                      onChange={(e) => {
                        const next = [...rabRows];
                        next[idx] = { ...next[idx], budget: e.target.value };
                        setRabRows(next);
                      }}
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setRabRows(rabRows.filter((_, i) => i !== idx))}
                    disabled={loading}
                    className="mb-1 shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-600"
                    aria-label="Hapus baris anggaran"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setRabRows([...rabRows, { category: '', budget: '' }])}
              disabled={loading}
              className="mt-2 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              + Tambah kategori anggaran
            </button>

            {rabRows.length > 0 && (
              <p className="mt-2 border-t border-slate-200/60 pt-2 text-xs text-slate-500 dark:border-white/10">
                Total anggaran:{' '}
                <span className="tnum font-semibold text-slate-700">
                  {formatRupiah(rabRows.reduce((s, r) => s + (Number(r.budget) || 0), 0))}
                </span>
              </p>
            )}
          </FormSection>
