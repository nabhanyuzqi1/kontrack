// Mock data & layanan untuk pratinjau lokal halaman Laporan (tanpa login).
// Folder .preview hanya dipakai saat memeriksa tampilan, tidak ikut di-commit.

export const projects = [
  {
    id: 'p1',
    name: 'Rehabilitasi Jalan Poros Kasongan',
    partner: 'Dinas PUPR Katingan',
    status: 'ongoing',
    value: 4850000000,
    paidAmount: 2182500000,
    taxRate: 11,
    contractNumber: '602/SPK/DPUPR/2026',
    startDate: '2026-03-04',
    endDate: '2026-12-20',
    progress: 62,
    retentionPct: 5,
    retentionMonths: 3,
    lastBaDate: '2026-09-30',
    units: [
      {
            'id': 'u1',
            'name': 'IPAL Unit 1',
            'location': 'Kasongan',
            'value': 285000000,
            'pkNumber': 'PK-01/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 100,
            'status': 'selesai',
            'bahkNumber': 'BAHK-001/SLM/2026',
            'bahkDate': '2026-08-31',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u2',
            'name': 'IPAL Unit 2',
            'location': 'Kereng Bangkirai',
            'value': 285000000,
            'pkNumber': 'PK-01/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 100,
            'status': 'selesai',
            'bahkNumber': 'BAHK-002/SLM/2026',
            'bahkDate': '2026-09-30',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u3',
            'name': 'IPAL Unit 3',
            'location': 'Baun Bango',
            'value': 285000000,
            'pkNumber': 'PK-01/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 100,
            'status': 'selesai',
            'bahkNumber': 'BAHK-003/SLM/2026',
            'bahkDate': '2026-11-10',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u4',
            'name': 'IPAL Unit 4',
            'location': 'Petuk Katimpun',
            'value': 285000000,
            'pkNumber': 'PK-04/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 100,
            'status': 'selesai',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u5',
            'name': 'IPAL Unit 5',
            'location': 'Tumbang Rungan',
            'value': 285000000,
            'pkNumber': 'PK-05/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 62,
            'status': 'berjalan',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u6',
            'name': 'IPAL Unit 6',
            'location': 'Mentawa Baru',
            'value': 285000000,
            'pkNumber': 'PK-06/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u7',
            'name': 'IPAL Unit 7',
            'location': 'Parenggean',
            'value': 285000000,
            'pkNumber': 'PK-07/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u8',
            'name': 'IPAL Unit 8',
            'location': 'Sampit Hilir',
            'value': 285000000,
            'pkNumber': 'PK-08/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u9',
            'name': 'IPAL Unit 9',
            'location': 'Pulau Hanaut',
            'value': 285000000,
            'pkNumber': 'PK-09/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u10',
            'name': 'IPAL Unit 10',
            'location': 'Seranau',
            'value': 285000000,
            'pkNumber': 'PK-10/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u11',
            'name': 'IPAL Unit 11',
            'location': 'Telaga Antang',
            'value': 285000000,
            'pkNumber': 'PK-11/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u12',
            'name': 'IPAL Unit 12',
            'location': 'Antang Kalang',
            'value': 285000000,
            'pkNumber': 'PK-12/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u13',
            'name': 'IPAL Unit 13',
            'location': 'Tualan Hulu',
            'value': 285000000,
            'pkNumber': 'PK-13/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u14',
            'name': 'IPAL Unit 14',
            'location': 'Bukit Santuai',
            'value': 285000000,
            'pkNumber': 'PK-14/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u15',
            'name': 'IPAL Unit 15',
            'location': 'Sanaman Mantikei',
            'value': 285000000,
            'pkNumber': 'PK-15/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u16',
            'name': 'IPAL Unit 16',
            'location': 'Kamipang',
            'value': 285000000,
            'pkNumber': 'PK-16/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      },
      {
            'id': 'u17',
            'name': 'IPAL Unit 17',
            'location': 'Marikit',
            'value': 285000000,
            'pkNumber': 'PK-17/IPAL/2026',
            'spkNumber': 'SPK/017/IPAL-SLM/2026',
            'progress': 0,
            'status': 'belum',
            'bahkNumber': '',
            'bahkDate': '',
            'retainedAmount': 0,
            'retentionReleasedDate': ''
      }
],
    spkNumber: 'SPK/017/IPAL-SLM/2026',
    rabTotal: 3900000000,
    rab: [
      { category: 'Material', budget: 2450000000 },
      { category: 'Upah Karyawan/Tukang', budget: 980000000 },
      { category: 'Operasional', budget: 320000000 }
    ],
    terminPlan: [
      { label: 'DP 30%', dueDate: '2026-03-20', amount: 1455000000, invoiceId: 'i1' },
      { label: 'Termin II 15%', dueDate: '2026-05-20', amount: 727500000 },
      { label: 'Termin III 25%', dueDate: '2026-08-20', amount: 1212500000 },
      { label: 'Termin IV 25%', dueDate: '2026-11-20', amount: 1212500000 },
      { label: 'Retensi 5%', dueDate: '2027-03-31', amount: 242500000 }
    ]
  },
  {
    id: 'p2',
    name: 'Pembangunan Gedung Serbaguna Desa Baun Bango',
    partner: 'Pemerintah Desa Baun Bango',
    status: 'retensi',
    value: 1275000000,
    paidAmount: 1180000000,
    taxRate: 11,
    contractNumber: '11/SPK/DS-BB/2025',
    startDate: '2025-09-01',
    endDate: '2026-06-30'
  },
  {
    id: 'p3',
    name: 'Peningkatan Drainase Ruas Jalan Tumbang Samba',
    partner: 'Dinas PUPR Katingan',
    status: 'selesai',
    value: 780000000,
    paidAmount: 780000000,
    taxRate: 11,
    contractNumber: '337/SPK/DPUPR/2025',
    startDate: '2026-01-12',
    endDate: '2026-05-28'
  },
  {
    id: 'p4',
    name: 'Pekerjaan Cut and Fill Lahan Gudang',
    partner: 'CV Mitra Borneo',
    status: 'akan-datang',
    value: 320000000,
    paidAmount: 0,
    taxRate: 0,
    startDate: '2026-12-01',
    endDate: '2027-02-15'
  },
  {
    id: 'p5',
    name: 'Perbaikan Jembatan Gantung Desa Tewang Kadamba',
    partner: 'Dinas PUPR Katingan',
    status: 'ongoing',
    value: 2140000000,
    paidAmount: 642000000,
    taxRate: 11,
    contractNumber: '418/SPK/DPUPR/2026',
    startDate: '2026-07-14',
    endDate: '2026-11-30'
  },
  {
    id: 'p6',
    name: 'Penataan Kawasan Pasar Sampit Tahap II',
    partner: 'Pemerintah Kabupaten Kotim',
    status: 'retensi',
    value: 3960000000,
    paidAmount: 3762000000,
    taxRate: 11,
    contractNumber: '77/SPK/PUPR-KOTIM/2025',
    startDate: '2025-04-02',
    endDate: '2026-02-20'
  }
];

const ts = (iso) => ({ seconds: Math.floor(new Date(iso).getTime() / 1000), nanoseconds: 0 });

export const transactions = [
  { id: 't1', projectId: 'p1', type: 'income', amount: 1455000000, date: '2026-03-20', category: 'Pembayaran' },
  { id: 't2', projectId: 'p1', type: 'expense', amount: 612000000, date: '2026-03-24', category: 'Material', imageUrl: 'x' },
  { id: 't3', projectId: 'p1', type: 'expense', amount: 148000000, date: '2026-04-02', category: 'Upah Karyawan/Tukang' },
  { id: 't4', projectId: 'p1', type: 'income', amount: 727500000, date: '2026-06-15', category: 'Pembayaran' },
  { id: 't5', projectId: 'p2', type: 'income', amount: 600000000, date: '2026-01-08', category: 'Pembayaran' },
  { id: 't6', projectId: 'p2', type: 'expense', amount: 335000000, date: '2026-01-19', category: 'Material', imageUrl: 'x' },
  { id: 't7', projectId: 'p2', type: 'expense', amount: 92400000, date: '2026-02-11', category: 'Operasional' },
  { id: 't8', projectId: 'p3', type: 'income', amount: 780000000, date: ts('2026-05-30T10:15:00+07:00'), category: 'Pembayaran' },
  { id: 't9', projectId: 'p3', type: 'expense', amount: 214500000, date: '2026-02-02', category: 'Material', imageUrl: 'x' },
  { id: 't10', projectId: 'p3', type: 'expense', amount: 58600000, date: '2026-03-11', category: 'Upah Karyawan/Tukang' },
  { id: 't11', projectId: 'p1', type: 'expense', amount: 37750000, date: '2026-10-04', category: 'Pengeluaran Lain' },
  { id: 't12', projectId: 'p2', type: 'income', amount: 580000000, date: '2026-11-03', category: 'Pembayaran' },
  { id: 't13', projectId: 'p1', type: 'expense', amount: 96500000, date: '2026-11-09', category: 'Material', imageUrl: 'x' },
  { id: 't14', projectId: 'p2', type: 'expense', amount: 42750000, date: '2026-11-12', category: 'Operasional' }
];

export const invoices = [
  {
    id: 'i1', status: 'paid', number: '001/INV/PEB/III/2026', invoiceNumber: '001/INV/PEB/III/2026',
    issueDate: '2026-03-15', dppNilaiLain: 1310810810, pajak11: 157297297,
    taxPaidAt: '2026-04-22', taxPaymentAmount: 157297297,
    grandTotal: 1468108107, projectId: 'p1', clientId: 'c1'
  },
  {
    id: 'i2', status: 'paid', number: '002/INV/PEB/VI/2026', invoiceNumber: '002/INV/PEB/VI/2026',
    issueDate: '2026-06-10', dppNilaiLain: 655405405, pajak11: 78648648,
    taxPaidAt: '2026-07-18', taxPaymentAmount: 78648648,
    grandTotal: 734054053, projectId: 'p1', clientId: 'c1'
  },
  {
    id: 'i3', status: 'paid', number: '003/INV/PEB/X/2026', invoiceNumber: '003/INV/PEB/X/2026',
    issueDate: '2026-10-12', dppNilaiLain: 522522522, pajak11: 62702702,
    grandTotal: 585225224, projectId: 'p2', clientId: 'c2'
  },
  {
    id: 'i4', status: 'sent', number: '004/INV/PEB/XI/2026', invoiceNumber: '004/INV/PEB/XI/2026',
    issueDate: { seconds: Math.floor(new Date('2026-11-06T09:00:00+07:00').getTime() / 1000) },
    dppNilaiLain: 261261261, pajak11: 31351351,
    grandTotal: 292612612, projectId: 'p1', clientId: 'c1'
  }
];
