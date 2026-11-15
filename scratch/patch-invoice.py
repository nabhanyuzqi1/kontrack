import io

f = 'src/components/invoices/InvoiceDetailModal.jsx'
s = open(f, encoding='utf-8', newline='').read()

# --- 1) Modal dibuka penuh ---
old = '      size="xl"\n      drawer\n      footer={'
new = '      size="xl"\n      drawer\n      drawerWidth="full"\n      footer={'
assert old in s, 'pembuka Modal tidak ditemukan'
s = s.replace(old, new, 1)

start = s.index("      {/* Tab: Detail | Arsip Berkas */}")
end_marker = "      )}\n    </Modal>"
end = s.index(end_marker)

body = open('scratch/invoice-body.jsx', encoding='utf-8').read()
s = s[:start] + body + s[end:]

# --- 3) state tab tidak dipakai lagi ---
s = s.replace("  const [tab, setTab] = useState('detail');\n", "", 1)

open(f, 'w', encoding='utf-8', newline='').write(s)
print('ok')
