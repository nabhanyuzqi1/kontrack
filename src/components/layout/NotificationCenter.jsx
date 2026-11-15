// src/components/layout/NotificationCenter.jsx
// Isi panel notifikasi header.
//
// Panel lama hanya daftar teks: pengguna harus menutup panel, mencari invoice
// yang dimaksud, lalu menandainya satu per satu. Notifikasi yang tidak bisa
// ditindak dari tempatnya sendiri memang tidak berguna.
//
// Panel ini: ringkasan angka, daftar berprioritas (paling mendesak di atas),
// tindakan cepat per item (buka, kirim email/WhatsApp pengingat), filter
// "belum dibaca" yang disimpan di localStorage, dan satu tombol untuk
// mengirim semua pengingat sekaligus. Hasil kirim dilaporkan apa adanya.

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Mail, MessageCircle, Loader2, CheckCheck, ExternalLink } from 'lucide-react';
import { notifyByEmail, sendWhatsApp, buildInvoiceWhatsApp } from '../../services/notify';

const READ_KEY = 'kontrack-notif-read';

const readSet = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));
  } catch (e) {
    return new Set();
  }
};

const persistRead = (set) => {
  try {
    // Batasi 200 id terakhir supaya localStorage tidak tumbuh tanpa batas.
    localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-200)));
  } catch (e) {
    /* mode privat */
  }
};

const TONE_DOT = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  brand: 'bg-brand-500',
  emerald: 'bg-emerald-500',
  slate: 'bg-slate-400'
};

/**
 * @param {object} props
 * @param {Array} props.items notifikasi terhitung (lihat AppLayout)
 * @param {boolean} props.loading
 * @param {Function} props.onNavigate pindah halaman
 * @param {object|null} props.company profil perusahaan (untuk isi pesan)
 * @param {boolean} props.isAdmin
 */
const NotificationCenter = ({ items, loading, onNavigate, company, isAdmin }) => {
  const navigate = useNavigate();
  const [read, setRead] = useState(readSet);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [bulk, setBulk] = useState(null);
  const [feedback, setFeedback] = useState('');

  const list = useMemo(() => {
    const sorted = [...(items || [])].sort((a, b) => (a.priority || 3) - (b.priority || 3));
    return onlyUnread ? sorted.filter((n) => !read.has(n.id)) : sorted;
  }, [items, onlyUnread, read]);

  const unreadCount = (items || []).filter((n) => !read.has(n.id)).length;

  const go = (to) => {
    onNavigate?.(to) || navigate(to);
  };

  const markRead = (id) => {
    setRead((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistRead(next);
      return next;
    });
  };

  const markAllRead = () => {
    const next = new Set(read);
    (items || []).forEach((n) => next.add(n.id));
    persistRead(next);
    setRead(next);
  };

  /** Kirim pengingat untuk satu item (email dan/atau WhatsApp). */
  const remind = async (item, channel) => {
    const invoice = item.invoice || {};
    const recipient = invoice.clientEmail || '';
    setBusyId(item.id);
    setFeedback('');
    try {
      if (channel === 'email') {
        if (!recipient) {
          setFeedback('Invoice ini tidak punya email klien. Lengkapi di detail invoice.');
          return;
        }
        const res = await notifyByEmail({
          kind: 'invoice',
          subject: `Pengingat pembayaran ${invoice.invoiceNumber || ''}`.trim(),
          summary: `Invoice ${invoice.invoiceNumber || ''} sebesar Rp${
            Number(invoice.grandTotal || 0).toLocaleString('id-ID')
          } masih menunggu pembayaran. Mohon konfirmasi bila sudah ditransfer.`,
          url: '/app/invoices',
          to: [recipient]
        });
        setFeedback(
          res?.sent
            ? `Pengingat email terkirim ke ${recipient}.`
            : res?.reason || 'Email pengingat belum bisa dikirim (SMTP belum disetel pemilik).'
        );
      } else {
        const phone = invoice.clientPhone || '';
        if (!phone) {
          setFeedback('Invoice ini tidak punya nomor WhatsApp klien.');
          return;
        }
        const res = await sendWhatsApp({ to: phone, message: buildInvoiceWhatsApp({ invoice, company }) });
        setFeedback(
          res?.sent
            ? 'Pesan WhatsApp terkirim lewat nomor resmi Kontrack.'
            : res?.reason || 'Gateway WhatsApp belum disetel pemilik.'
        );
      }
      markRead(item.id);
    } finally {
      setBusyId(null);
    }
  };

  /** Kirim semua pengingat tagihan yang punya email klien. */
  const remindAll = async () => {
    const targets = (items || []).filter((n) => n.kind === 'invoice' && n.invoice?.clientEmail);
    if (targets.length === 0) {
      setFeedback('Tidak ada tagihan dengan email klien untuk diingatkan.');
      return;
    }
    setBulk({ done: 0, total: targets.length });
    let sent = 0;
    for (const [index, item] of targets.entries()) {
      const res = await notifyByEmail({
        kind: 'invoice',
        subject: `Pengingat pembayaran ${item.invoice?.invoiceNumber || ''}`.trim(),
        summary: `Invoice ${item.invoice?.invoiceNumber || ''} sebesar Rp${Number(
          item.invoice?.grandTotal || 0
        ).toLocaleString('id-ID')} masih menunggu pembayaran.`,
        url: '/app/invoices',
        to: [item.invoice.clientEmail]
      });
      if (res?.sent) sent += 1;
      setBulk({ done: index + 1, total: targets.length });
    }
    setBulk(null);
    setFeedback(`${sent} dari ${targets.length} pengingat email terkirim.`);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
        <div>
          <p className="text-sm font-semibold text-slate-800">Notifikasi</p>
          <p className="text-xs text-slate-500">
            {loading ? 'Memuat…' : unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-500/10"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Tandai dibaca
          </button>
        )}
      </div>

      {(items || []).length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
          <div className="flex gap-1">
            <button
              onClick={() => setOnlyUnread(false)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                onlyUnread ? 'text-slate-500 hover:bg-slate-500/10' : 'bg-brand-500/10 text-brand-700'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setOnlyUnread(true)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                onlyUnread ? 'bg-brand-500/10 text-brand-700' : 'text-slate-500 hover:bg-slate-500/10'
              }`}
            >
              Belum dibaca
            </button>
          </div>
          {isAdmin && (
            <button
              onClick={remindAll}
              disabled={Boolean(bulk)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-500/10 disabled:opacity-60"
            >
              {bulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              {bulk ? `${bulk.done}/${bulk.total}` : 'Ingatkan semua'}
            </button>
          )}
        </div>
      )}

      {feedback && (
        <p className="border-b border-slate-200/70 bg-slate-500/5 px-4 py-2 text-[11px] leading-relaxed text-slate-600 dark:border-white/10">
          {feedback}
        </p>
      )}

      <div className="max-h-[380px] overflow-y-auto p-1.5">
        {loading && <p className="px-3 py-6 text-center text-sm text-slate-400">Memuat…</p>}

        {!loading && list.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              {onlyUnread ? 'Tidak ada notifikasi baru' : 'Tidak ada yang perlu ditindak'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {onlyUnread ? 'Beralih ke "Semua" untuk melihat riwayat.' : 'Tenggat proyek dan tagihan akan muncul di sini.'}
            </p>
          </div>
        )}

        {list.map((n) => {
          const Icon = n.icon || Bell;
          const isUnread = !read.has(n.id);
          return (
            <div
              key={n.id}
              className={`group rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-500/[0.06] ${
                isUnread ? '' : 'opacity-70'
              }`}
            >
              <button
                onClick={() => {
                  markRead(n.id);
                  go(n.to);
                }}
                className="flex w-full items-start gap-2.5 text-left"
              >
                <span className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-500/10 text-slate-600">
                  <Icon className="h-3.5 w-3.5" />
                  {isUnread && (
                    <span
                      className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ${
                        TONE_DOT[n.tone] || TONE_DOT.slate
                      }`}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-800">{n.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{n.desc}</span>
                </span>
                <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300" />
              </button>

              {/* Tindakan cepat: hanya untuk tagihan yang punya kontak klien. */}
              {n.kind === 'invoice' && isAdmin && (
                <div className="mt-1.5 flex flex-wrap gap-1 pl-9">
                  {n.invoice?.clientEmail && (
                    <button
                      onClick={() => remind(n, 'email')}
                      disabled={busyId === n.id}
                      className="flex items-center gap-1 rounded border border-slate-300/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-500/10 disabled:opacity-50 dark:border-white/15"
                    >
                      {busyId === n.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Mail className="h-3 w-3" />
                      )}
                      Email pengingat
                    </button>
                  )}
                  {n.invoice?.clientPhone && (
                    <button
                      onClick={() => remind(n, 'wa')}
                      disabled={busyId === n.id}
                      className="flex items-center gap-1 rounded border border-slate-300/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-500/10 disabled:opacity-50 dark:border-white/15"
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </button>
                  )}
                  <button
                    onClick={() => {
                      markRead(n.id);
                      go(n.to);
                    }}
                    className="flex items-center gap-1 rounded border border-slate-300/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-500/10 dark:border-white/15"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Buka
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-200/70 px-4 py-2 dark:border-white/10">
        <button
          onClick={() => {
            onNavigate?.('/app/reports');
          }}
          className="flex w-full items-center justify-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
        >
          Lihat laporan &amp; tenggat pajak
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </>
  );
};

export default NotificationCenter;
